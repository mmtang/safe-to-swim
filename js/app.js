/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

function onMarkerClick(e) {
    resetPanel();
    showSiteLoading(); 
    getSiteData(); 

    function getSiteData() {
        var clickedSite = e.layer.feature.properties.StationCode;
        var path = createURL(clickedSite);
        var siteDataConfig = {
            url: path,
            success: checkSiteData,
            error: handleSiteError
        };

        requestData(siteDataConfig);

        function checkSiteData(res, config) {
            // check that the site matches the last site clicked in case the user clicks multiple sites in succession
            var firstRecord = res.result.records[0];
            if (firstRecord.StationCode === lastSite.code) {
                var records = res.result.records;
                config.data = config.data.concat(records);
                if (records.length < recordLimit) {
                    processData(config.data);
                } else {
                    config.offset += recordLimit;
                    requestData(config);
                }
            } else {
                console.log('Ignored request for ' + firstRecord.StationName + ' (' + firstRecord.StationCode + ')');
            }
        }

        function handleSiteError(config) {
            // if multiple sites are clicked in succession, only the last request should show an error
            // get the site code from the url and check that it matches the last site clicked
            var splitURL = config.url.split('=');
            var splitSite = splitURL[splitURL.length - 1];
            var parsedSite = decode(splitSite); 
            if (parsedSite === lastSite.code) {
                showSiteError();
            } else {
                console.log('ERROR: Request for ' + parsedSite);
            }
        }
    }

    function processData(data) { 
        // filter on data quality category
        var chartData = data.filter(function(d) {
            if (d.DataQuality === dataQuality1 || d.DataQuality === dataQuality2 || d.DataQuality === dataQuality3 || d.DataQuality === dataQuality4 || d.DataQuality === dataQuality5) {
                return d;
            }
        });
        // force data types and handle NDs
        for (var i = 0; i < chartData.length; i++) { 
            chartData[i].MDL = +chartData[i].MDL;
            chartData[i].Result = +chartData[i].Result;
            chartData[i].sampledate = parseDate(chartData[i].SampleDate);
            handleND(chartData[i]);
        }
        // filter to keep all results above 0
        chartData = chartData.filter(function(d) { return d.result > 0; });

        if (chartData.length > 0) { 
            var analyteSet = new Set(); 
            for (var i = 0; i < chartData.length; i++) { 
                analyteSet.add(chartData[i].Analyte);
            }
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
            addPanelContent();
        } else {
            showDataError();
            console.log('ERROR: Dataset is empty');
        }

        function addPanelContent() {
            clearPanelContent();
            initializeChartPanel();
            initializeDatePanel(); 
            initializeDownloadMenu();
            addAnalyteMenu(analytes);
            addAnalyteListener(chartData);
            addScaleMenu(); 
            addFilterMenu(); 
            addChart(chartData, currentAnalyte);
        }

        function handleND(d) {
            if (isND(d)) {
                d.result = calculateND(d);
            } else {
                d.result = d.Result;
            }
        
            function calculateND(d) {
                return d.MDL * 0.5;
            }
        
            function isND(d) {
                if ((d.Result <= 0) || (d.ResultQualCode === 'ND')) { 
                    return true;
                } else {
                    return false;
                }
            }
        }
    }  

    function addAnalyteListener(data) {
        document.getElementById('analyte-menu').addEventListener('change', function() {
            currentAnalyte = this.value;
            updateFilters();
            addChart(data, this.value);
        });
    }

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

    function addChart(data, analyte) {
        updateFilters();
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

        var windowSize = getWindowSize(),
            windowWidth = windowSize[0],
            windowHeight = windowSize[1];
            
        if (windowWidth < 768) {
            var panelWidth = 620;
            var panelHeight = 349;
        } else {
            var panelWidth = 745;
            var panelHeight = Math.min(349, Math.round((windowHeight * 0.5)));
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

        // chart filter listeners
        d3.select('#filter-result').on('change', function() { 
            toggleElement(this, '.circle'); 
            toggleElement(this, '.line.stv');
        });
        d3.select('#filter-geomean').on('change', function() { 
            toggleElement(this, '.triangle'); 
            toggleElement(this, '.line.gm');
        });

        // scale listeners
        d3.select('#linear-button').on('click', function() { changeScale(); });
        d3.select('#log-button').on('click', function() { changeScale(); });

        updateDownloadMenu();
        
        function changeScale() {
            if (currentScale === 'linear') {
                document.getElementById('linear-button').classList.remove('active');
                document.getElementById('log-button').classList.add('active');
                currentScale = 'log';
                chart.redraw();
            } else if (currentScale === 'log') {
                resetScaleMenu();
                currentScale = 'linear';
                chart.redraw();
            }
        }

        function toggleElement(context, name) {
            if (d3.select(context).property('checked')) {
                d3.selectAll(name).attr('visibility', 'visible');
            } else {
                d3.selectAll(name).attr('visibility', 'hidden');
            }
        }

        function updateDownloadMenu() {
            toggleDownloadMenu();
            d3.selectAll('#download-menu a').on('click', function() { 
                switch (this.text) {
                    case downloadOp1:
                        convertToCSV(formatSampleData(chart.data));
                        break;
                    case downloadOp2:
                        convertToCSV(formatGeomeanData(chart.gData));
                        break;
                    case downloadOp3:
                        console.log('External link clicked.');
                        break;
                    default:
                        console.log('ERROR: No match for download value.');
                }
            });
        }
    } // addChart

    function toggleDownloadMenu() {
        var menuItem = document.getElementById('geomean-dropdown-op');
        if ((currentAnalyte === ecoli.name) || (currentAnalyte === enterococcus.name)) {
            menuItem.classList.remove('disabled');
        } else {
            if (!(menuItem.classList.contains('disabled'))) {
                menuItem.classList.add('disabled');
            }
        }
    }
} // onMarkerClick

document.getElementById('panel-arrow-container').addEventListener('click', function() {
    if (this.classList.contains('panel-collapsed')) {
        openPanel();
    } else {
        collapsePanel();
    }
});

$('#about-btn').click(function() {
    $('#aboutModal').modal('show');
    $('.navbar-collapse.in').collapse('hide');
});

$('#nav-btn').click(function() {
    $('.navbar-collapse').collapse('toggle');
});

function addFilterMenu() {
    var filterContainer = document.getElementById('filter-container');
    var content = '<div id="filter-menu"><div class="form-check"><label><input id="filter-result" value="data" class="form-check-input" type="checkbox" checked>&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i>&nbsp;&nbsp;Samples</label></div><div id="gm-form-container" class="form-check"><label><input id="filter-geomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;<img src="assets/triangle.gif">&nbsp;&nbsp;Geometric mean&nbsp;&nbsp;<a href="#"><i class="fa fa-question-circle pop-left" data-toggle="popover" title="Geometric Mean" data-content="For E. coli and enterococci only: the six-week geometric mean is calculated weekly on a rolling basis, starting with the most recent sample date. At least two sample results are required for the calculation. Position the mouse cursor over a geometric mean chart element to highlight the date period used in the calculation."></i></a></label></div></div>';
    filterContainer.innerHTML = content;
    updateFilters();
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
    document.getElementById('chart-container').style.display = 'inline-block';
    document.getElementById('panel-content').style.display = 'block';
    var container = document.getElementById('panel-arrow-container');
    container.classList.remove('panel-collapsed');
    var icon = container.querySelectorAll('i')[0];
    icon.classList.remove('fa-caret-down');
    icon.classList.add('fa-caret-up');
}

function collapsePanel() {
    document.getElementById('panel-content').style.display = 'none';
    var container = document.getElementById('panel-arrow-container');
    container.classList.add('panel-collapsed');
    var icon = container.querySelectorAll('i')[0];
    icon.classList.remove('fa-caret-up');
    icon.classList.add('fa-caret-down');
}

function convertToCSV(data) {
    var csvString = '';
    var fileName = 'SafeToSwim_Download_' + Date.now() + '.csv';
    var header = Object.keys(data[0]);
    var values = data.map(function(obj) {
        return Object.keys(obj)
            .map(function(e) { return obj[e]; })
            .join(',');
    });
    var body = values.join('\r\n');
    csvString += header + '\r\n' + body;

    if (msieversion()) {
        var IEwindow = window.open();
        IEwindow.document.write(csvString);
        IEwindow.document.close();
        IEwindow.document.execCommand('SaveAs', true, fileName);
        IEwindow.close();
    } else {
        var csv = document.createElement('a');
        csv.href = 'data:text/csv;charset=utf-8,' +  encodeURIComponent(csvString);
        csv.target = '_blank';
        csv.download = fileName;
        document.body.appendChild(csv);
        csv.click();
    }

    function msieversion() {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf("MSIE ");
    
        if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) {
            return true;
        }
        else {
            return false;
        }
        return false;
    }

    function utf8_to_b64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }
}

function createURL(site) {
    // url encoding for site code, add more as needed
    var cleanSite = encode(site);
    var url = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=fd2d24ee-3ca9-4557-85ab-b53aa375e9fc';
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

function formatGeomeanData(data) {
    var formatDate = d3.timeFormat("%Y-%m-%d %X");
    var selected = data.map(function(d) {
        return {
            'EndDate': formatDate(d.enddate),
            'Geomean': d.geomean,
            'SampleCount': d.count,
            'StartDate': formatDate(d.startdate),
            'StationCode': '"' + lastSite.code + '"',
            'StationName': '"' + lastSite.name + '"'
        };
    });
    return selected;
}

function formatSampleData(data) {
    var selected = data.map(function(d) {
        return {
            'Analyte': '"' + d.Analyte + '"',
            'DataQuality': '"' + d.DataQuality + '"',
            'MDL': d.MDL,
            'Program': '"' + d.Program + '"',
            'Result': d.result,
            'ResultQualCode': d.ResultQualCode,
            'SampleDate': d.SampleDate,
            'StationCode': '"' + d.StationCode + '"',
            'StationName': '"' + d.StationName + '"',
            'Unit': '"' + d.Unit + '"'
        };
    });
    return selected;
}

function requestData(config) {
    console.log(config.url, 'offset = ' + config.offset);
    if (typeof config.offset === 'undefined') { config.offset = 0; }
    if (typeof config.data === 'undefined') { config.data = []; }

    $.ajax({
        type: 'GET',
        url: config.url,
        data: {offset: config.offset},
        dataType: 'json',
        success: function(res) {
            config.success(res, config);
        },
        error: function(xhr, textStatus, error) {
            console.log(xhr.statusText);
            console.log(textStatus);
            console.log(error);
            config.error(config);
        }
    });
}

function getWindowSize() {
    return [document.documentElement.clientWidth, document.documentElement.clientHeight];
}

function handleMapLoadError() {
    hideLoadingMask();
    showMapLoadError();
}

function hideLoadingMask() {
    document.getElementById('map-loading-mask').style.display = 'none';
}

function hidePanelArrow() {
    var container = document.getElementById('panel-arrow-container');
    var icon = container.querySelectorAll('i')[0];
    icon.style.display = 'none';
}

function initializeChartPanel() {
    var featureContent = '<div id="popup-menu"><div id="analyte-container" class="popup-container"></div><div id="scale-container" class="popup-container"></div><div id="filter-container" class="popup-container"></div></div>' + '<div id="chart-space"></div><div id="date-container" class="panel-container"></div><div id="download-container"></div>';
    document.getElementById('panel-content').innerHTML = featureContent;
}

function initializeDatePanel() {
    var datePanel = document.getElementById('date-container');
    datePanel.innerHTML = '';
    datePanel.innerHTML = '<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span>&nbsp;&nbsp;<a href="#"><i class="fa fa-question-circle pop-top" data-toggle="popover" data-placement="top" data-html="true" data-content="Use the timeline above to change the date view of the chart. Click and hold the left or right side of the gray box and drag it towards the center of the timeline."></i></a></p>';
}

function initializeDownloadMenu() {
    var container = document.getElementById('download-container');
    container.innerHTML = '<div class="dropdown panel-container text-center"><div class="btn-group dropup"><button type="button" class="btn btn-default btn-sm dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><span class="glyphicon glyphicon-download-alt"></span>&nbsp;&nbsp;Download Data&nbsp;&nbsp;<span class="caret"></span></button><ul id="download-menu" class="dropdown-menu"><li><a href="#">' + downloadOp1 + '</a></li><li id="geomean-dropdown-op"><a href="#">' + downloadOp2 + '</a></li><li><a href="https://data.cnra.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results" target="_blank">' + downloadOp3 + '</a></li></ul></div>';
}

function resendRequest() {
    document.getElementById('site-title').innerHTML = '<h3 class="panel-title">' + lastSite.name + ' (' + lastSite.code + ')</h3>';
    onMarkerClick(lastSite.e);
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

function showPanelError(message) {
    var container = document.getElementById('chart-container');
    container.classList.remove('panel-primary');
    container.classList.add('panel-warning');
    document.getElementById('site-title').innerHTML = '<h3 class="panel-title">Error!</h3>';
    setPanelContent(message);
    openPanel();
}

function showSiteError() {
    var message = '<p class="warning">Error fetching data from the server. Please try again.</p><div><button type="button" class="btn btn-default" onclick="resendRequest()">Retry</button></div>';
    showPanelError(message);
}

function showDataError() {
    var message = '<p class="warning">Not enough data for the selected site. Please select another site.</p></div>';
    showPanelError(message);
}

function showMapLoadError() {
    var message = '<p class="warning">Error fetching the map data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="window.location.reload()">Retry</button></div>';
    showPanelError(message);
}

function showSiteLoading() {
    var message = 'Fetching data<div id="loading"><div class="loading-indicator"><div class="progress progress-striped active"><div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width:100%"></div></div></div></div>';
    setPanelContent(message);
    openPanel();
}

function setPanelContent(html) {
    document.getElementById('panel-content').innerHTML = html;
}

function updateFilters() {
    var sampleFilter = document.getElementById('filter-result');
    sampleFilter.checked = true;

    var gmFilter = document.getElementById('filter-geomean');
    if ((currentAnalyte === ecoli.name) || (currentAnalyte === enterococcus.name)) {
        gmFilter.disabled = false;
        gmFilter.checked = true;
    } else {
        gmFilter.disabled = true;
        gmFilter.checked = false;
    }
}

function addMapControls() {
    L.control.zoom({ position: 'topleft' }).addTo(map);
    addMapLegend();

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
}

function addSiteLayer() {
    var siteListPath = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=4f41c529-a33f-4006-9cfc-71b6944cb951&limit=' + recordLimit;
    var recentDataPath = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=fd2d24ee-3ca9-4557-85ab-b53aa375e9fc&fields=StationCode,SampleDate&sort=%22SampleDate%22%20desc&limit=' + recordLimit;

    // assign to global scope for highlight functions
    siteLayer = L.geoJson([], {
        onEachFeature: function(feature, layer) {
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

    getSiteList();

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
        // sort features based on sample date ascending
        // this will draw the sites with the most recent dates on top
        features.sort(function(a, b) {
            return a.properties.LastSampleDate > b.properties.LastSampleDate;
        });
        siteLayer.addData(data);
        setTimeout(function() {
            hideLoadingMask();
            $('#aboutModal').modal('show');
        }, 1000);
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

    function getSiteList() {
        var config = {
            url: siteListPath,
            success: checkSiteList,
            error: handleMapLoadError
        };
        requestData(config);
    }

    function checkSiteList(res, config) {
        var records = res.result.records;
        config.data = config.data.concat(records);
        if (records.length < recordLimit) {
            processSites(config.data);
        } else {
            config.offset += recordLimit;
            requestData(config);
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
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
    }

    function processSites(data) {
        var today = new Date();
        features = [];
        for (var i = 0; i < data.length; i++) {
            // check for missing values
            // filter out site 'Leona Creek at Brommer Trailer Park' for inaccurate coordinates
            // this is a temporary solution until we correct the coordinates
            if (!(data[i].Longitude) || !(data[i].Latitude) || !(data[i].StationName) || !(data[i].SiteCode) || (data[i].SiteCode === '304-LEONA-21')) { 
                continue; 
            } else {
                // process data and reformat objects to geojson
                var site = {};
                site.type = 'Feature';
                site.geometry = { 'type': 'Point', 'coordinates': [+data[i].Longitude, +data[i].Latitude] };
                site.properties = { 'StationName': data[i].StationName, 'StationCode': data[i].SiteCode, 'LastSampleDate': parseDate(data[i].LastSampleDate), 'DateDifference': daysBetween(convertUNIX(data[i].LastSampleDate), today) };
                features.push(site);
            }
        }
        console.log(features);
        addSites(features);
        initializeSearch(features);
    }

    function resetHighlight(e) {
        siteLayer.resetStyle(e.target);
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
        collapsePanel();
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
}

function addMapTiles() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
}

// convert to UNIX time
function convertDate(date) {
    return date.getTime();
}

// convert to date object
function convertUNIX(seconds) {
    return new Date(seconds);
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

function roundHundred(value) {
    return (value / 100) * 100
}

var ecoli = new Analyte('E. coli', 320, 100),
    enterococcus = new Analyte('Enterococcus', 110, 30),
    coliformtotal = new Analyte('Coliform, Total'),
    coliformfecal = new Analyte('Coliform, Fecal');

var dataQuality0 = "MetaData",
    dataQuality1 = "Passed"
    dataQuality2 = "Some review needed",
    dataQuality3 = "Spatial accuracy unknown",
    dataQuality4 = "Extensive review needed",
    dataQuality5 = "Unknown data quality",
    dataQuality6 = "Reject record",
    dataQuality7 = "Error";

var downloadOp1 = 'Download monitoring data (.csv)',
    downloadOp2 = 'Download geometric mean data (.csv)',
    downloadOp3 = 'Download monitoring data for all sites (data.cnra.ca.gov)';

var map = L.map('map',{ 
    center: [37.4050, -119.365], 
    zoom: 6, 
    preferCanvas: true,
    doubleClickZoom: false, 
    zoomControl: false,
}); 

var chartOpacity = 0.8;
var currentAnalyte; 
var currentScale = 'linear';
var lastSite = new Object();
var mainColor = '#1f78b4', secColor = '#ff7f0e';
var MS_PER_DAY = (24 * 60 * 60 * 1000);
var parseDate = d3.timeParse('%Y-%m-%d %H:%M:%S');
var recordLimit = 5000;
var siteLayer; // accessed globally for highlight functions

clearSearch();
addMapTiles();
addMapControls(); 
addSiteLayer(); 