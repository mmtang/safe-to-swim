/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

function onMarkerClick(e) {
    var clickedSite = e.layer.feature.properties.StationCode;
    var path = createURL('6e99b457-0719-47d6-9191-8f5e7cd8866f', clickedSite);
    // only need to change once, on initial load
    document.getElementById('chart-container').style.display = 'inline-block';
    resetPanel();
    openPanel();
    showSiteLoading(); 

    getData(path, processData); 

    function processData(data) { 
        var chartData = data;
        if (chartData.length > 0) { 
            var analyteSet = new Set(); 
            for (var i = 0; i < chartData.length; i++) { 
                // filter on data quality code
                if ((chartData[i].DataQuality === dataQuality0) || (chartData[i].DataQuality === dataQuality6) || (chartData[i].DataQuality === dataQuality7)) {
                    continue;
                } else {
                    // force data types
                    chartData[i].MDL = +chartData[i].MDL;
                    chartData[i].Result = +chartData[i].Result;
                    chartData[i].sampledate = parseDate(chartData[i].SampleDate);
                    // handle NDs and copy over results to new field
                    if ((chartData[i].Result <= 0) || (chartData[i].ResultQualCode === 'ND')) { 
                        // use half of MDL for all NDs
                        chartData[i].result = chartData[i].MDL * 0.5;
                    } else {
                        chartData[i].result = chartData[i].Result;
                    }
                    analyteSet.add(chartData[i].Analyte);
                }
            }
            // filter to keep all results above 0
            chartData = chartData.filter(function(d) { return d.result > 0; });
            // convert set to array, forEach used for older browsers
            var analytes = [];
            analyteSet.forEach(function(i) { analytes.push(i); }); 
            // sort descending so enteroccocus and e. coli appear first 
            analytes.sort(function(a, b) { 
                if (a < b) { return 1; }
                else if (a > b) { return -1; }
                else { return 0; }
            });
            currentAnalyte = analytes[0];
            // initialize and add panel elements
            clearPanelContent();
            initializeChartPanel();
            initializeDatePanel(); 
            addAnalyteMenu(analytes);
            addFilterMenu(); 
            updateFilterMenu();
            addScaleMenu(); 
            addChart(chartData, currentAnalyte);
            addDownloadBtn();
            updateDownloadBtn();
            // add listener for analyte menu
            document.getElementById('analyte-menu').addEventListener('change', function() {
                currentAnalyte = this.value;
                addChart(chartData, this.value);
                updateFilterMenu();
                updateDownloadBtn();
            });
        } else {
            showSiteError();
            console.log('ERROR: Dataset is empty');
        }
    }  

    function addChart(data, analyte) {
        console.log(currentAnalyte);
        resetFilters();
        resetScaleMenu();
        // initializeDatePanel();
        currentScale = 'linear';

        // initialize popovers after they have been added, popovers must be visible
        // jquery selectors required for popover
        $('.pop-top').popover({ 
            trigger: 'hover', 
            placement: 'top',
            template: '<div class="popover"><div class="arrow"></div><div class="popover-content"></div></div>'
        });
        $('.pop-left').popover({ 
            trigger: 'hover', 
            placement : 'left',
            template: '<div class="popover"><div class="arrow"></div><div class="popover-content"></div></div>' 
        });

        var chartData = data.filter(function(d) {
            return d.Analyte === analyte;
        });

        // 16:8 or 2:1 aspect ratio
        var windowSize = getWindowSize(),
            panelWidth = Math.round(windowSize[0] * 0.60),
            panelHeight = Math.round(panelWidth * (8 / 16));

        if (panelWidth < 620) {
            panelWidth = 620;
            panelHeight = 349;
        } else if (panelWidth > 940) {
            panelWidth = 940;
            panelHeight = 470;
        }

        var chartMargin = {top: 10, right: 20, bottom: 100, left: 50};
        var chart = new Chart({
            element: document.getElementById('chart-space'),
            margin: chartMargin,
            data: chartData,
            width: panelWidth - chartMargin.left - chartMargin.right,
            height: panelHeight - chartMargin.top - chartMargin.bottom
        });

        // calculate axis buffers based on analyte-specific objectives
        // calculate geomeans based on analyte selected
        if (analyte === ecoli.name) {
            chart.createScales(ecoli.stv);
            chart.gData = getGeomeans(chartData);
        } else if (analyte === enterococcus.name) {
            chart.createScales(enterococcus.stv);
            chart.gData = getGeomeans(chartData);
        } else {
            chart.createScales(null);
        }

        chart.addAxes();
        chart.drawLines(analyte);
        chart.drawPoints();
        chart.drawGPoints();
        chart.drawBrush();
        chart.drawBrushPoints();

        // add chart filter listeners
        d3.select('#filter-result').on('change', function() { 
            toggleElement(this, '.circle'); 
            toggleElement(this, '.line.stv');
        });
        d3.select('#filter-geomean').on('change', function() { 
            toggleElement(this, '.triangle'); 
            toggleElement(this, '.line.gm');
        });

        // add scale listeners
        d3.select('#linear-button').on('click', function() { clickLinear(chart); });
        d3.select('#log-button').on('click', function() { clickLog(chart); });

        function clickLinear() {
            if (currentScale === 'log') {
                resetScaleMenu();
                currentScale = 'linear';
                chart.redraw();
            }
        }
        
        function clickLog() {
            if (currentScale === 'linear') {
                document.getElementById('linear-button').classList.remove('active');
                document.getElementById('log-button').classList.add('active');
                currentScale = 'log';
                chart.redraw();
            }
        }
    } // addChart
} // onMarkerClick


/*
/ Global Listeners
*/

document.getElementById('panel-arrow-container').addEventListener('click', function() {
    if (this.classList.contains('panel-collapsed')) {
        openPanel();
    } else {
        closePanel();
    }
});

$('#about-btn').click(function() {
    $('#aboutModal').modal('show');
    $('.navbar-collapse.in').collapse('hide');
});

$('#nav-btn').click(function() {
    $('.navbar-collapse').collapse('toggle');
});


/*
/ App Helper Functions 
*/

function addAnalyteMenu(analytes) {
    // initialize dropdown
    var analyteMenu = document.createElement('select');
    analyteMenu.id = 'analyte-menu';
    analyteMenu.className = 'form-control input-sm';
    analyteMenu.innerHTML = '';
    // populate dropdown
    for (var i = 0; i < analytes.length; i++) {
        var opt = analytes[i];
        analyteMenu.innerHTML += '<option value=\"' + opt + '\">' + opt + '</option>';
    }
    var analyteContainer = document.getElementById('analyte-container');
    analyteContainer.appendChild(analyteMenu);
}

function addDownloadBtn() {
    var container = document.getElementById('download-container');
    // container.innerHTML = '<a href="#" id="download-btn" class="btn btn-sm btn-default"><span class="glyphicon glyphicon-download-alt"></span>&nbsp;&nbsp;Download Data</a>';
    container.innerHTML = '<div class="dropdown panel-container text-center"><div class="btn-group dropup"><button type="button" class="btn btn-default btn-sm dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><span class="glyphicon glyphicon-download-alt"></span>&nbsp;&nbsp;Download Data&nbsp;&nbsp;<span class="caret"></span></button><ul class="dropdown-menu"><li><a href="#">Download sample data (.csv)</a></li><li id="geomean-dropdown-op"><a href="#">Download geometric mean data (.csv)</a></li><li><a href="https://data.cnra.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results" target="_blank">Download full dataset (data.cnra.ca.gov)</a></li></ul></div>';

    $('#download-btn').click(function() {
        $('#downloadModal').modal('show');
        $('.navbar-collapse.in').collapse('hide');
    });
}

function addFilterMenu() {
    var filterContainer = document.getElementById('filter-container');
    var content = '<div id="filter-menu"><div class="form-check"><label><input id="filter-result" value="data" class="form-check-input" type="checkbox" checked>&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i>&nbsp;&nbsp;Samples</label></div><div id="gm-form-container" class="form-check"><label><input id="filter-geomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;<img src="assets/triangle.gif">&nbsp;&nbsp;Geometric mean&nbsp;&nbsp;<a href="#"><i class="fa fa-question-circle pop-left" data-toggle="popover" title="Geometric Mean" data-content="For E. coli and enterococci only: the six-week geometric mean is calculated weekly on a rolling basis, starting with the most recent sample date. At least two sample results are required for the calculation. Hover the mouse cursor over a geometric mean chart element to highlight the date period used in the calculation."></i></a></label></div></div>';
    filterContainer.innerHTML = content;
}

function addScaleMenu() {
    var scaleContainer = document.getElementById('scale-container');
    var content = '<div class="btn-group btn-group-sm" role="group"><button type="button" id="linear-button" class="btn btn-default active">Linear Scale</button><button type="button" id="log-button" class="btn btn-default">Log Scale</button></div>';
    scaleContainer.innerHTML = content;
}

function Analyte(name, stv, geomean) {
    this.name = name;
    this.stv = stv;
    this.geomean = geomean;
}

function clearPanelContent() {
    document.getElementById('panel-content').innerHTML = '';
}

function clearSearch() {
    document.getElementById('searchbox').value = '';
}

function openPanel() {
    document.getElementById('panel-content').style.display = 'block';
    var container = document.getElementById('panel-arrow-container');
    container.classList.remove('panel-collapsed');
    var icon = container.querySelectorAll('i')[0];
    icon.classList.remove('fa-caret-down');
    icon.classList.add('fa-caret-up');
}

function closePanel() {
    document.getElementById('panel-content').style.display = 'none';
    var container = document.getElementById('panel-arrow-container');
    container.classList.add('panel-collapsed');
    var icon = container.querySelectorAll('i')[0];
    icon.classList.remove('fa-caret-up');
    icon.classList.add('fa-caret-down');
}

function createURL(resource, site) {
    // url encoding for site code, add more as needed
    var cleanSite = encode(site);
    // data.ca.gov endpoint
    // var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    // data.cnra.ca.gov endpoint, started using 11/6/18
    var url = 'https://data.cnra.ca.gov/api/3/action/datastore_search?resource_id=b6f30bfc-badd-47d3-93b9-445bd90f9738';
    url += '&fields=Analyte,DataQuality,MDL,Program,Result,ResultQualCode,SampleDate,StationCode,StationName,Unit';
    url += '&limit=' + recordLimit;
    url += '&filters={%22StationCode%22:%22' + cleanSite + '%22}';
    return url;
}

function decode(str) {
    str = str.replace(/\%23/, '#')
        .replace(/\%20/g, ' ')
        .replace(/\%28/g, '(')
        .replace(/\%29/g, ')')
        .replace(/\%2E/g, '.')
        .replace(/\%27/g, "'")
        .replace(/\%2C/g, ",")
        .replace(/\%2F/g, "/");
    return str;
}

function encode(str) {
    str = str.replace(/\#/, '%23')
        .replace(/\ /g, '%20')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\./g, '%2E')
        .replace(/\'/g, '%27')
        .replace(/\,/g, '%2C')
        .replace(/\//g, '%2F');
    return str;
}

// request site data
function getData(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        dataType: 'json',
        success: function(res) {
                // check that the site matches the last site clicked in case the user clicks multiple sites in succession
                var firstRecord = res.result.records[0];
                if (firstRecord.StationCode === lastSite.code) {
                    var records = res.result.records;
                    data = data.concat(records);
                    if (records.length < recordLimit) {
                        callback(data);
                    } else {
                        getData(url, callback, offset + recordLimit, data);
                    }
                } else {
                    console.log('Ignored request for ' + firstRecord.StationName + ' (' + firstRecord.StationCode + ')');
                }
        },
        error: function(xhr, textStatus, error) {
            console.log(xhr.statusText);
            console.log(textStatus);
            console.log(error);
            // if multiple sites are clicked in succession, only the last request should show an error
            // get the site code from the url and check that it matches the last site clicked
            var splitURL = url.split('=');
            var splitSite = splitURL[splitURL.length - 1];
            var parsedSite = decode(splitSite); 
            if (parsedSite === lastSite.code) {
                showSiteError();
            } else {
                console.log('ERROR: Request for ' + parsedSite);
            }
        }
    });
}

// request the most recent records (sampled within the last year)
function getDataRecent(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        dataType: 'json',
        success: function(res) {
            var records = res.result.records;
            data = data.concat(records);
            // get the sample date of the last record in the array 
            // check if the date is within 365 days
            var length = records.length;
            var lastDate = parseDate(records[length - 1].SampleDate);
            var today = new Date();
            var dateDiff = daysBetween(lastDate, today);
            if (dateDiff > 365) {
                callback(data);
            } else {
                getDataRecent(url, callback, offset + recordLimit, data);
            }
        },
        error: function(xhr, textStatus, error) {
            console.log(xhr.statusText);
            console.log(textStatus);
            console.log(error);
            hideLoadingMask();
            showMapLoadError();
        }
    });
}

// request the site list
function getDataSites(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        dataType: 'json',
        success: function(res) {
            var records = res.result.records;
            data = data.concat(records);
            if (records.length < recordLimit) {
                callback(data);
            } else {
                getDataSites(url, callback, offset + recordLimit, data);
            }
        },
        error: function(xhr, textStatus, error) {
            console.log(xhr.statusText);
            console.log(textStatus);
            console.log(error);
            hideLoadingMask();
            showMapLoadError();
        }
    });
}

function getWindowSize() {
    return [Math.max(
      //document.body.scrollWidth,
      //document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    ), Math.max(
        //document.body.scrollHeight,
        //document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
    )];
}

function hideLoadingMask() {
    document.getElementById('map-loading-mask').style.display = 'none';
}

function hidePanelArrow() {
    var container = document.getElementById('panel-arrow-container');
    var icon = container.querySelectorAll('i')[0];
    icon.style.display = 'none';
}

/*
function hidePanelFooter() {
    var footer = document.getElementById('download-footer');
    footer.style.display = 'none';
}
*/

function initializeDatePanel() {
    var datePanel = document.getElementById('date-container');
    datePanel.innerHTML = '';
    datePanel.innerHTML = '<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span>&nbsp;&nbsp;<a href="#"><i class="fa fa-question-circle pop-top" data-toggle="popover" data-placement="top" data-html="true" data-content="Use the timeline above to change the date view of the chart. Click and hold the left or right side of the gray box and drag it towards the center of the timeline."></i></a></p>';
}

function initializeChartPanel() {
    var featureContent = '<div id="popup-menu"><div id="analyte-container" class="popup-container"></div><div id="scale-container" class="popup-container"></div><div id="filter-container" class="popup-container"></div></div>' + '<div id="chart-space"></div><div id="date-container" class="panel-container"></div><div id="download-container"></div>';
    document.getElementById('panel-content').innerHTML = featureContent;
}

function resendRequest() {
    document.getElementById('site-title').innerHTML = '<h3 class="panel-title">' + lastSite.name + ' (' + lastSite.code + ')</h3>';
    onMarkerClick(lastSite.e);
}

function resetFilters() {
    document.getElementById('filter-result').checked='true';
    document.getElementById('filter-geomean').checked='true';
}

function resetPanel() {
    var chartContainer = document.getElementById('chart-container');
    if (chartContainer.classList.contains('panel-warning')) {
        chartContainer.classList.remove('panel-warning');
        chartContainer.classList.add('panel-primary');
    };
}

function resetScaleMenu() {
    document.getElementById('log-button').classList.remove('active');
    document.getElementById('linear-button').classList.add('active');
}

function showMapLoadError() {
    var chartContainer = document.getElementById('chart-container');
    // chartContainer.style.display = 'inline-block';
    openPanel();
    chartContainer.classList.remove('panel-primary');
    chartContainer.classList.add('panel-warning');
    document.getElementById('site-title').innerHTML = '<h3 class="panel-title">Error!</h3>';
    document.getElementById('chart-panel').innerHTML = '<p class="warning">Error fetching the map data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="window.location.reload()">Retry</button></div>';
}

/*
function showPanelFooter() {
    var footer = document.getElementById('download-footer');
    footer.style.display = 'block';
}
*/

function showSiteLoading() {
    document.getElementById('panel-content').innerHTML = 'Fetching data<div id="loading"><div class="loading-indicator"><div class="progress progress-striped active"><div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width:100%"></div></div></div></div>';
}

function showSiteError() {
    var chartContainer = document.getElementById('chart-container');
    chartContainer.classList.remove('panel-primary');
    chartContainer.classList.add('panel-warning');
    document.getElementById('site-title').innerHTML = '<h3 class="panel-title">Error!</h3>';
    document.getElementById('chart-panel').innerHTML = '<p class="warning">Error fetching the site data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="resendRequest()">Retry</button></div>';
}

function updateDownloadBtn() {
    var menuItem = document.getElementById('geomean-dropdown-op');
    if ((currentAnalyte === ecoli.name) || (currentAnalyte === enterococcus.name)) {
        menuItem.classList.remove('disabled');
    } else {
        if (!(menuItem.classList.contains('disabled'))) {
            menuItem.classList.add('disabled');
        }
    }
}

function updateFilterMenu() {
    var menuItem = document.getElementById('filter-geomean');
    if ((currentAnalyte === ecoli.name) || (currentAnalyte === enterococcus.name)) {
        menuItem.disabled = false;
        menuItem.checked = true;
    } else {
        menuItem.disabled = true;
        menuItem.checked = false;
    }
}

/*
/ Map Helper Functions 
*/

function addMapControls() {
    L.control.zoom({ position:'topleft' }).addTo(map);
    addMapLegend();
}

function addMapLegend() {
    var legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function(map) {
        var div = L.DomUtil.create('div', 'info legend'),
            labels = ['<strong>Last Sample Date</strong>'],
            categories = ['Within last 30 days', 'Within last year', 'Older than one year'],
            colors = ['#fefb47', '#82ff83', '#50cfe9'];
        for (var i = 0; i < categories.length; i++ ) {
            div.innerHTML += labels.push(
                '<i class="circle" style="background:' + colors[i] + '"></i> ' + (categories[i] ? categories[i] : '+')
            );
        };
        div.innerHTML = labels.join('<br>');
        return div;
    };
    legend.addTo(map);
}

function addSiteLayer() {
    // assign to global scope for highlight functions
    siteLayer = L.geoJson([], {
        onEachFeature: function(feature, layer) {
            // add tooltip
            if (feature.properties.StationName) {
                layer.bindPopup(feature.properties.StationName, {closeButton: false, offset: L.point(0, 0)});
                layer.on('mouseover', function(e) { 
                    highlightMarker(e);
                    layer.openPopup(); 
                });
                layer.on('mouseout', function(e) { 
                    resetHighlight(e);
                    layer.closePopup(); 
                });
            }
        },
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 5,
                fillColor: getColor(feature.properties.DateDifference),
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 1
            });
        }
    }).addTo(map);

    /* request site list */
    // data.ca.gov endpoint
    // var sitesPath = createURL('02e59b14-99e9-489f-bc62-987108bc8e27');

    // data.cnra.ca.gov endpoint, started using 11/6/18
    var sitesPath = 'https://data.cnra.ca.gov/api/3/action/datastore_search?resource_id=eb3e96c9-15f5-4734-9d25-f7d2eca2b883&limit=' + recordLimit;

    /* request join data */
    // data.ca.gov endpoint
    // var siteDataPath = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=6e99b457-0719-47d6-9191-8f5e7cd8866f&fields[t]=StationCode,SampleDate&limit=5000&sort[SampleDate]=desc';

    // data.cnra.ca.gov endpoint, started using 11/6/18
    var siteDataPath = 'https://data.cnra.ca.gov/api/3/action/datastore_search?resource_id=b6f30bfc-badd-47d3-93b9-445bd90f9738&fields=StationCode,SampleDate&sort=%22SampleDate%22%20desc&limit=' + recordLimit;

    getDataSites(sitesPath, processSites);

    // leaflet event
    siteLayer.on('click', function(e) {
        // assign to global scope
        lastSite.e = e;
        lastSite.code = e.layer.feature.properties.StationCode;
        lastSite.name = e.layer.feature.properties.StationName;
        document.getElementById('site-title').innerHTML = '<h3 class="panel-title">' + e.layer.feature.properties.StationName + ' (' + e.layer.feature.properties.StationCode + ')</h3>';
        onMarkerClick(e);
    });

    function addSites(data) {
        siteLayer.addData(data);
        setTimeout(function() {
            hideLoadingMask();
            $('#aboutModal').modal('show');
        }, 1000);
    }

    function processSites(data) {
        // use this array for the join to sample date
        features = [];
        for (var i = 0; i < data.length; i++) {
            // check for missing values
            // filter out site 'Leona Creek at Brommer Trailer Park' for inaccurate coordinates
            // this is a temporary solution until we correct the coordinates
            if (!(data[i].Longitude) || !(data[i].Latitude) || !(data[i].StationName) || !(data[i].SiteCode) || (data[i].SiteCode === '304-LEONA-21')) { 
                continue; 
            } else {
                var site = {};
                site.StationName = data[i].StationName;
                site.StationCode = data[i].SiteCode;
                site.Latitude = +data[i].Latitude;
                site.Longitude = +data[i].Longitude;
                features.push(site);
            }
        }
        getDataRecent(siteDataPath, processSiteData);
    }

    function joinSiteData(data) {
        var db = new alasql.Database();
        db.exec('CREATE TABLE feature');
        db.exec('CREATE TABLE att');
        // 'features' is the site list from processSites()
        db.exec('SELECT * INTO feature FROM ?', [features]);
        db.exec('SELECT * INTO att FROM ?', [data]);
        // get list of distinct sites based on most recent sample date
        var date = db.exec('SELECT stationcode, max(sampledate) AS sampledate FROM att GROUP BY stationcode');
        db.exec('CREATE TABLE date');
        db.exec('SELECT * INTO date FROM ?', [date]);
        // join data back to site list, left join to keep all sites
        var joined = db.exec('SELECT feature.*, date.sampledate FROM feature LEFT JOIN date ON feature.StationCode = date.stationcode ORDER BY date.sampledate');
        return joined;
    }

    function processSiteData(data) {
        var siteData = [];
        for (var i = 0; i < data.length; i++) {
            var record = {};
            // create new fields for join
            // convert date to UTC for use in max function
            record.stationcode = data[i].StationCode;
            record.sampledate = parseDate(data[i].SampleDate).getTime();
            siteData.push(record); 
        }
        var joined = joinSiteData(siteData);
        // reformat objects to geojson
        var siteList = [];
        var today = new Date();
        for (var i = 0; i < joined.length; i++) {
            var site = {};
            var date = null;
            var dateDiff = null;
            if (joined[i].sampledate) {
                // convert UTC to date
                date = convertUNIX(joined[i].sampledate);
                dateDiff = daysBetween(date, today);
            }
            site.type = 'Feature';
            site.geometry = {'type': 'Point', 'coordinates': [joined[i].Longitude, joined[i].Latitude]};
            site.properties = {'StationName': joined[i].StationName, 'StationCode': joined[i].StationCode, 'LastSampleDate': date, 'DateDifference': dateDiff};
            siteList.push(site);
        }
        addSites(siteList);
        initializeSearch(siteList);
    }
}

function initializeSearch(arr) {
    var sites = arr.map(function(d) {
        return {
            name: d.properties.StationName + ' ' + d.properties.StationCode,
            lat: d.geometry.coordinates[1],
            lng: d.geometry.coordinates[0]
        };
    });
    var sitesBH = new Bloodhound({
        datumTokenizer: function(d) {
            return Bloodhound.tokenizers.whitespace(d.name);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: sites
    });

    $('#searchbox').typeahead({
        hint: true,
        highlight: true,
        minLength: 1,
        limit: Infinity
    }, {
        name: 'sites',
        displayKey: 'name',
        source: sitesBH
    });

    // jquery required for typeahead:selected
    $('#searchbox').on('typeahead:selected', function (e, datum) {
        closePanel();
        $('.navbar-collapse').collapse('hide');
        map.setView([datum.lat, datum.lng], 17);
        // unfocus input text
        this.blur();
    }).on('focus', function () {
        $('.navbar-collapse.in').css('max-height', $(document).height() - $('.navbar-header').height());
        $('.navbar-collapse.in').css('height', $(document).height() - $('.navbar-header').height());
        // select input text when clicked
        this.select();
    }).on('focusout', function () {
        $('.navbar-collapse.in').css('max-height', '');
        $('.navbar-collapse.in').css('height', '');
    });

    // commented out 11/20/18
    // $(".twitter-typeahead").css("position", "static");
    // $(".twitter-typeahead").css("display", "block");
}

function addMapTiles() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
}

function getColor(d) {
    if (d === null) { 
        return '#50cfe9'; // null date
    } else if (d <= 30) { 
        return '#fefb47'; // 1 month
    } else if (d <= 360) { 
        return '#82ff83'; // 1 year
    } else { 
        return '#50cfe9'; // older than 1 year, same as null
    } 
}

function highlightMarker(e) {
    var layer = e.target;
    layer.setStyle({
        fillcolor: '#00e5ee',
        color: '#00e5ee',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
    })
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}
function resetHighlight(e) {
    siteLayer.resetStyle(e.target);
}

function toggleLayer(layer, customPane) { 
    if (map.hasLayer(layer)) {
        map.removeLayer(layer);
    } else {
        map.addLayer(layer);
    }
}

/*
/ D3 Helper Functions 
*/

function convertND(d) {
    // for all NDs, use half of MDL
    var val = d.MDL * 0.5;
    if (val > 0) {
        return val;
    } else {}
}

// convert to UNIX time
function convertDate(date) {
    return date.getTime();
}

// convert to date object
function convertUNIX(seconds) {
    return new Date(seconds);
}

function roundHundred(value) {
    return (value / 100) * 100
}

function daysBetween(a, b) {
    var MS_PER_DAY = 1000 * 60 * 60 * 24;
    var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

function responsive() {
    // get container + svg aspect ratio
    var svg = d3.select('#graph'),
        container = svg.node().parentNode,
        width = parseInt(svg.style('width')),
        height = parseInt(svg.style('height')),
        aspect = width / height;
    
    // add viewBox and preserveAspectRatio properties,
    // and call resize so that svg resizes on inital page load
    svg.attr('viewBox', '0 0 ' + width + ' ' + height)
        .attr('perserveAspectRatio', 'xMinYMid')
        .call(resize);

    // to register multiple listeners for same event type, 
    // you need to add namespace, i.e., 'click.foo'
    // necessary if you call invoke this function for multiple svgs
    // api docs: https://github.com/mbostock/d3/wiki/Selections#on
    d3.select(window).on('resize.' + container.id, resize);

    // get width of container and resize svg to fit it
    function resize() {
        var targetWidth = parseInt(container.offsetWidth);
        svg.attr('width', targetWidth);
        svg.attr('height', Math.round(targetWidth / aspect));
    }
}

function toggleElement(context, name) {
    if (d3.select(context).property('checked')) {
        d3.selectAll(name).attr('visibility', 'visible');
    } else {
        d3.selectAll(name).attr('visibility', 'hidden');
    }
}

var ecoli = new Analyte('E. coli', 320, 100),
    enterococcus = new Analyte('Enterococcus', 110, 30),
    coliformtotal = new Analyte('Coliform, Total'),
    coliformfecal = new Analyte('Coliform, Fecal');

var dataQuality0 = "MetaData, QC record",
    dataQuality1 = "Passed"
    dataQuality2 = "Some review needed",
    dataQuality3 = "Spatial Accuracy Unknown",
    dataQuality4 = "Extensive review needed",
    dataQuality5 = "Unknown data quality",
    dataQuality6 = "Reject record",
    dataQuality7 = "Error";

var map = L.map('map',{ 
    center: [37.4050, -119.365], 
    zoom: 6, 
    preferCanvas: true,
    doubleClickZoom: false, 
    zoomControl: false
}); 

var chartOpacity = 0.8;
var currentAnalyte;
var currentScale = 'linear';
var lastSite = new Object();
var mainColor = '#1f78b4', secColor = '#ff7f0e';
var MS_PER_DAY = (24 * 60 * 60 * 1000);
var parseDate = d3.timeParse('%Y-%m-%d %H:%M:%S');
var recordLimit = 1000;
var siteLayer; // accessed globally for highlight functions

clearSearch();
addMapTiles();
addMapControls(); 
addSiteLayer(); 