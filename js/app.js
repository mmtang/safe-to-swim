/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

function onMarkerClick(e) {
    var site = e.layer.feature.properties.StationCode;
    resetPanel();
    showSiteLoading(); 
    getSiteData(); 

    function getSiteData() {
        $.when(
            // prior to 2010
            getCEDENData('18c57345-bf87-4c46-b358-b634d36be4d2', site),
            // 2010-2020
            getCEDENData('7639446f-8c62-43d9-a526-8bc7952dd8bd', site),
            // 2020-present
            getCEDENData('1987c159-ce07-47c6-8d4f-4483db6e6460', site),
            getR5Data(site)
        ).done(function(res11, res12, res13, res2) {
            // Results are returned in order of the functions listed above in the when statement
            // checks that the returned site matches the last site clicked 
            // this is in case the user clicks multiple sites in succession
            if (site === lastSite.code) {
                // merge the CEDEN data responses
                var cedenPart1 = processCEDENData(res11[0].result.records);
                var cedenPart2 = processCEDENData(res12[0].result.records);
                var cedenPart3 = processCEDENData(res13[0].result.records);
                var allData = cedenPart1.concat(cedenPart2, cedenPart3);
                allData = filterCedenData(allData);
                // merge R5 data with CEDEN data
                // can add more if statements for other datasets we bring in, following the same pattern
                if (res2) {
                    var r5Data = processR5Data(res2[0].result.records);
                    var uniqueR5Data = compareData(allData, r5Data);
                    Array.prototype.push.apply(allData, uniqueR5Data);
                }
                addPanelContent(allData);
            } else {
                console.log('Ignored request for ' + site);
            }
        });
    }

    function compareData(data, targetData) {
        // returns the unique records found in the second argument "targetData"
        // this is being used to extract the records from the R5 dataset that are not already in CEDEN
        // could be reused for any other datasets that we bring in
        var newData = [];
        for (var i = 0; i < targetData.length; i++) {
            var analyte = targetData[i]['Analyte'];
            var sampleDate = convertToTimestamp(targetData[i]['SampleDate']);
            var result = targetData[i]['Result'];
            // console.log(analyte, sampleDate, result);
            // determine whether record already exists in the first dataset, will return a match if it does
            var matches = data.filter(function(rec) {
                return ((rec['Analyte'] === analyte) && (convertToTimestamp(rec['SampleDate']) === sampleDate) && (rec['Result'] === result));
            });
            // testing: use to examine the found duplicate records
            // console.log(matches);
            if (matches.length === 0) {
                // if no matches, then keep it
                newData.push(targetData[i]);
            }
        }
        return newData;
    }

    function getCEDENData(resource, site) {
        var baseURL = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=';
        var cedenColumns = ['Analyte', 'DataQuality', 'RL', 'Program', 'Result', 'ResultQualCode', 'SampleDate', 'MethodName', 'StationCode', 'StationName', 'Unit'];
        var cedenURL = createURL(baseURL + resource, cedenColumns, site);
        return $.ajax({
            type: 'GET',
            url: cedenURL,
            dataType: 'json',
            error: function(xhr, textStatus, error) {
                handleSiteError(site);
                console.log(xhr.statusText);
                console.log(textStatus);
                console.log(error);
            }
        });
    }

    function getR5Data(site) {
        if (_r5Sites.indexOf(site) >= 0) {
            var resource = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=fc450fb6-e997-4bcf-b824-1b3ed0f06045';
            var columns = ['StationCode', 'StationName', 'SampleDate', 'Analyte', 'Result', 'Unit', 'Program'];
            var r5URL = createURL(resource, columns, site);
            return $.ajax({
                type: 'GET',
                url: r5URL,
                dataType: 'json',
                error: function(xhr, textStatus, error) {
                    handleSiteError(site);
                    console.log(xhr.statusText);
                    console.log(textStatus);
                    console.log(error);
                }
            });
        }
    }
    
    function handleSiteError(siteCode) {
        // if multiple sites are clicked in succession, only the last request should show an error
        if (siteCode === lastSite.code) {
            showSiteError();
        }
    }

    function processCEDENData(data) { 
        // filter on data quality category
        var chartData = data.filter(d => dqCategories.includes(d.DataQuality));
        // Filter out null values
        chartData = chartData.filter(d => d.Result != 'NaN');
        // force data types and handle NDs
        for (var i = 0; i < chartData.length; i++) { 
            chartData[i].RL = +chartData[i].RL;
            chartData[i].Result = +chartData[i].Result;
            // New column: Treat result less than the RL as being one half the RL
            chartData[i].CalculatedResult = calculateResult(chartData[i]);
            // New column: Assign a new value to results that are 0 (cannot be shown on log scale graph)
            chartData[i].ChartResult = checkDisplay(chartData[i].CalculatedResult);
            chartData[i].SampleDate = parseDate(chartData[i].SampleDate);
        }
        return chartData;
    }  

    function filterCedenData(data) {
        // Filter out records where record is ND/DNQ and RL < 0
        var filteredData = data.filter(function(d) {
            if (!((d.ResultQualCode === 'DNQ' || d.ResultQualCode === 'ND') && (d.RL < 0))) {
                return d;
            }
        });
        // Filter out records where Result < 0 and RL < 0
        filteredData = filteredData.filter(function(d) {
            if (!((d.Result < 0) && (d.RL < 0))) {
                return d;
            }
        });
        return filteredData;
    }

    function calculateResult(d) {
        if (isND(d)) {
            var calculated = 0.5 * d.RL;
            return calculated;
        } else {
            return d.Result;
        }
    }

    // Assign new values if result is 0 or negative. For chart display (log scale) only. 
    function checkDisplay(d) {
        if (d === 0) {
            return 0.1;
        } else {
            return d;
        }
    }

    // For handling censored data
    function isND(d) {
        if ((d.ResultQualCode === 'DNQ') || (d.ResultQualCode === 'ND')) { 
            return true;
        } else {
            return false;
        }
    }

    function processR5Data(data) {
        // shaping R5's data to look like CEDEN's
        var parseDate = d3.timeParse('%Y-%m-%d');
        for (d = 0; d < data.length; d++) {
            data[d]['DataQuality'] = 'NA';
            // RL for E. coli = 1
            data[d]['RL'] = 1;
            data[d]['MethodName'] = 'NA';
            data[d]['ResultQualCode'] = 'NA';
            data[d]['SampleDate'] = parseDate(data[d]['SampleDate']);
            // Add new columns to store modified result values
            data[d]['CalculatedResult'] = calculateResult(data[d]);  // any calculations for 1/2 the detection limit are stored here
            data[d]['ChartResult'] = checkDisplay(data[d]['CalculatedResult']);  // zeroes are changed to 0.1 so that they can be graph using a log scale
        }
        return data;
    }

    function addAnalyteListener(data) {
        document.getElementById('analyte-menu').addEventListener('change', function() {
            currentAnalyte = this.value;
            updateFilters();
            addChart(data, this.value);
        });
    }

    function addPanelContent(data) {
        if (data.length > 0) { 
            // create analyte set
            var analyteSet = new Set(); 
            for (var i = 0; i < data.length; i++) { 
                analyteSet.add(data[i].Analyte);
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
            // assigned to global env.
            currentAnalyte = analytes[0];
            clearPanelContent();
            initializeChartPanel();
            initializeDatePanel(); 
            initializeDownloadMenu();
            addAnalyteMenu(analytes);
            addAnalyteListener(data);
            addScaleMenu(); 
            addGeomeanMenu();
            addFilterMenu(); 
            addChart(data, currentAnalyte);
        } else {
            showDataError();
            console.log('ERROR: Dataset is empty');
        }
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
        currentScale = 'log';

        // initialize popovers after they have been added, popovers must be visible
        // jquery selectors required for popover
        $('.pop-top').popover({ 
            trigger: 'hover', 
            placement: 'top',
            template: '<div class="popover"><div class="arrow"></div><div class="popover-content"></div></div>'
        });
        $('.pop-bottom').popover({ 
            trigger: 'hover', 
            placement : 'bottom',
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
            var panelHeight = Math.min(349, Math.round((windowHeight * 0.47)));
        }

        var chartMargin = {top: 10, right: 30, bottom: 100, left: 50};
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
            updateGeomeanMenu();
        });

        // scale listeners
        d3.select('#linear-button').on('click', function() { changeScale(); });
        d3.select('#log-button').on('click', function() { changeScale(); });

        // geomean listener
        addGeomeanListener();

        updateDownloadMenu();

        function addGeomeanListener() {
            document.getElementById('geomean-menu').addEventListener('change', function() {
                selected = Number(this.value);
                if (selected === 2) {
                    gmLimit = 2;
                } else if (selected === 5) {
                    gmLimit = 5;
                }
                chart.filterGPoints();
            })
        }
        
        function changeScale() {
            if (currentScale === 'linear') {
                resetScaleMenu();
                currentScale = 'log';
                chart.redraw();
            } else if (currentScale === 'log') {
                document.getElementById('log-button').classList.remove('active');
                document.getElementById('linear-button').classList.add('active');
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
    var filterContainer = document.getElementById('checkbox-container');
    var content = '<div id="filter-menu"><div class="form-check"><label><input id="filter-result" value="data" class="form-check-input" type="checkbox" checked>&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i>&nbsp;&nbsp;Samples</label></div><div id="gm-form-container" class="form-check"><label><input id="filter-geomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;<img src="assets/triangle.gif">&nbsp;Geometric mean&nbsp;&nbsp;<a href="#"><i class="fa fa-question-circle pop-bottom" data-toggle="popover" data-html="true" title="Geometric Mean" data-content="<p>The geometric mean is a type of mean or average that indicates the central tendency or typical value of a set of numbers by using the product of their values (as opposed to the arithmetic mean which uses their sum). It is defined as the nth root of the product of n numbers.</p><p>For E. coli and enterococcus only: the six-week geometric mean is calculated weekly on a rolling basis, starting with the most recent sample date. The minimum number of samples required for the calculation is two but can be changed to five using the dropdown menu below. Position your mouse cursor over a geometric mean triangle on the chart to highlight the six-week date period used for the calculation.</p>"></i></a></label></div></div>';
    filterContainer.innerHTML = content;
    updateFilters();
}

function addGeomeanMenu() {
    gmLimit = 2;
    var gmContainer = document.getElementById('geomean-container');
    var content = '<select id="geomean-menu" class="bootstrap-select"><option value="2" selected="selected">2 sample min.</option><option value="5">5 sample min.</option></select>';
    gmContainer.innerHTML = content;
}

function addScaleMenu() {
    var scaleContainer = document.getElementById('scale-container');
    var content = '<div class="btn-group btn-group-sm" role="group"><button type="button" id="log-button" class="btn btn-default active">Log Scale</button><button type="button" id="linear-button" class="btn btn-default">Linear Scale</button></div>';
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

function addMessages() {
    // This function adds the last updated dates for the CEDEN and R5 datasets.
    // It also adds a message to the top of the welcome modal. This message (if available/present) is queried from the open data portal dataset description using the keyword "__Attention__": https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results
    // This URL points to the Safe to Swim sites dataset on the portal. Any of the other datasets can be used with the same result.
    // https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results/resource/848d2e3f-2846-449c-90e0-9aaf5c45853e
    var cedenResourceId = '848d2e3f-2846-449c-90e0-9aaf5c45853e';
    var r5ResourceId = 'fc450fb6-e997-4bcf-b824-1b3ed0f06045';
    var datasetId = 'surface-water-fecal-indicator-bacteria-results'; // the main dataset with metadata for all resources
    $.when(
        getResourceInfo(cedenResourceId),
        getResourceInfo(r5ResourceId),
        getPackageInfo(datasetId)
    ).done(function(res1, res2, res3) {
        // Add data last updated dates to the popup that shows when the map is loaded
        // Date helper functions
        var parseDate = d3.timeParse('%Y-%m-%dT%H:%M:%S.%f');
        var formatDate = d3.timeFormat("%b %e, %Y");
        // Process CEDEN dataset date
        var cedenResult = res1[0].result['last_modified'];
        var cedenDate = formatDate(parseDate(cedenResult));
        // Process R5 dataset date
        var r5Result = res2[0].result['last_modified'];
        var r5Date = formatDate(parseDate(r5Result));
        // Contruct HTML and set div content
        var content = 'CEDEN/BeachWatch data updated: ' + cedenDate + '<br>' + 'Central Valley E. coli data updated: ' + r5Date;
        document.getElementById('update-date-container').innerHTML = content;

        // Add message from portal (if present/available)
        // Locate if the keyword 'Attention' appears in the dataset description
        var packageDescription = res3[0].result['notes'];
        if (packageDescription.includes('Attention')) {
            // Extract text using regular expressions and add text to the update message
            var regEx = /<p>__Attention__:(.*?)<\/p>/g;
            var found = regEx.exec(packageDescription);
            if (found[1]) {
                var message = '<p><div class="alert alert-info" role="alert">' + found[1] + '</div></p>';
                document.getElementById('message-container').innerHTML = message;
            }
        }
    });
}

function getPackageInfo(package) {
    if (package) {
        var baseUrl = 'https://data.ca.gov/api/3/action/package_show?id=';
        var packageUrl = baseUrl + package;
        return $.ajax({
            type: 'GET',
            url: packageUrl,
            dataType: 'json',
            error: function(xhr, textStatus, error) {
                console.log(xhr.statusText);
                console.log(textStatus);
                console.log(error);
            }
        });
    } else {
        console.log('Missing package ID');
    }
}

function getResourceInfo(resource) {
    if (resource) {
        var baseUrl = 'https://data.ca.gov/api/3/action/resource_show?id=';
        var resourceUrl = baseUrl + resource;
        return $.ajax({
            type: 'GET',
            url: resourceUrl,
            dataType: 'json',
            error: function(xhr, textStatus, error) {
                console.log(xhr.statusText);
                console.log(textStatus);
                console.log(error);
            }
        });
    } else {
        console.log('Missing resource ID')
    }
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
    // use filesaver.js to export data as csv file (cross-browser support)
    var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
    window.saveAs(blob, fileName);
}

function createURL(baseURL, columns, site) {
    // url encoding for site code, add more as needed
    var cleanSite = encode(site);
    var url = baseURL;
    url += '&fields=' + columns.join();
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
            'GeoMean': d.geomean,
            'SampleCount': d.count,
            'StartDate': formatDate(d.startdate),
            'StationCode': '"' + lastSite.code + '"',
            'StationName': '"' + lastSite.name + '"'
        };
    });
    return selected;
}

function formatSampleData(data) {
    var formatDate = d3.timeFormat("%Y-%m-%d");
    var selected = data.map(function(d) {
        return {
            'Program': '"' + d.Program + '"',
            'StationName': '"' + d.StationName + '"',
            'StationCode': '"' + d.StationCode + '"',
            'SampleDate': '"' + formatDate(d.SampleDate) + '"',
            'MethodName': '"' + d.MethodName + '"',
            'Analyte': '"' + d.Analyte + '"',
            'Unit': '"' + d.Unit + '"',
            'OriginalResult': d.Result,
            'CalculatedResult': d.CalculatedResult,
            'RL': d.RL,
            'ResultQualCode': d.ResultQualCode,
            'DataQuality': '"' + d.DataQuality + '"'
        };
    });
    return selected;
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
    var featureContent = '<div id="popup-menu"><div id="analyte-container" class="popup-container"></div><div id="scale-container" class="popup-container"></div><div id="filter-container" class="popup-container"><div id="checkbox-container"></div><div id="geomean-container" class="popup-container"></div></div></div>' + '<div id="chart-space"></div><div id="date-container" class="panel-container"></div><div id="download-container"></div>';
    document.getElementById('panel-content').innerHTML = featureContent;
}

function initializeDatePanel() {
    var datePanel = document.getElementById('date-container');
    datePanel.innerHTML = '';
    datePanel.innerHTML = '<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span>&nbsp;&nbsp;<a href="#"><i class="fa fa-question-circle pop-top" data-toggle="popover" data-placement="top" data-html="true" data-content="Use the timeline above to change the date view of the chart. Click and hold your mouse cursor on the left or right outside side of the gray box. Drag it across the timeline area to change the viewable date range of the chart."></i></a></p>';
}

function initializeDownloadMenu() {
    var container = document.getElementById('download-container');
    container.innerHTML = '<div class="dropdown panel-container text-center"><div class="btn-group dropup"><button type="button" class="btn btn-default btn-sm dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><span class="glyphicon glyphicon-download-alt"></span>&nbsp;&nbsp;Download Data&nbsp;&nbsp;<span class="caret"></span></button><ul id="download-menu" class="dropdown-menu"><li><a href="#">' + downloadOp1 + '</a></li><li id="geomean-dropdown-op"><a href="#">' + downloadOp2 + '</a></li></ul></div>';
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
    document.getElementById('log-button').classList.add('active');
    document.getElementById('linear-button').classList.remove('active');
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
    // configuration based on analyte selection
    if ((currentAnalyte === ecoli.name) || (currentAnalyte === enterococcus.name)) {
        gmFilter.disabled = false;
        gmFilter.checked = true;
    } else {
        gmFilter.disabled = true;
        gmFilter.checked = false;
    }
    updateGeomeanMenu();
}

function updateGeomeanMenu() {
    var gmFilter = document.getElementById('filter-geomean');
    var gmContainer = document.getElementById('geomean-container');
    var gmMenu = document.getElementById('geomean-menu');
    if (gmFilter.checked === true) {
        gmMenu.disabled = false;
        // for hiding the gm menu checkbox when unchecked
        // not using this for now because i think the change is too dramatic
        // gmContainer.style.display = 'inline';
    } else if (gmFilter.checked === false) {
        gmMenu.disabled = true;
        // gmContainer.style.display = 'none';
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
                categories = ['Within last 7 days', 'Within last 14 days', 'Within last 30 days', 'Within last year', 'Older than one year'],
                colors = ['#253494', '#2c7fb8', '#41b6c4', '#a1dab4', '#ffffe0'];
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
    // assign to global scope for highlight functions
    siteLayer = L.geoJson([], {
        onEachFeature: function(feature, layer) {
            if (feature.properties) {
                var popupContent = feature.properties.StationName + ' (' + feature.properties.StationCode + ')';
                layer.bindPopup(popupContent, {closeButton: false, offset: L.point(0, 0)});
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
        siteLayer.addData(data);
        setTimeout(function() {
            hideLoadingMask();
            $('#aboutModal').modal('show');
        }, 1000);
    }

    function getColor(d) {
        if (d === null) { 
            return '#ffffe0'; // null date
        } else if (d <=7) {
            return '#253494';
        } else if (d <= 14) {
            return '#2c7fb8';
        } else if (d <= 30) { 
            return '#41b6c4'; // 1 month
        } else if (d <= 360) { 
            return '#a1dab4'; // 1 year
        } else { 
            return '#ffffe0'; // older than 1 year, same as null
        } 
    }

    function getSiteList() {
        var siteListURL = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=848d2e3f-2846-449c-90e0-9aaf5c45853e&limit=' + recordLimit;
        var r5URL = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=fc450fb6-e997-4bcf-b824-1b3ed0f06045&fields=StationCode,SampleDate&sort=%22SampleDate%22%20desc&limit=' + recordLimit;
        var call1 = $.get(siteListURL);
        var call2 = $.get(r5URL);
        $.when(call1, call2).then(function (res1, res2) {
            var siteData = res1[0]['result']['records'];
            // convert to date objects
            siteData.forEach(function(d) { d.LastSampleDate = parseDate(d.LastSampleDate); });
            var r5Data = res2[0]['result']['records'];
            var r5Sites = processR5SiteData(r5Data);
            // join R5 data to main site list
            siteData.forEach(function(d) {
                if (d.StationCode in r5Sites) {
                    if (d.LastSampleDate < r5Sites[d.StationCode]) {
                        d.LastSampleDate = r5Sites[d.StationCode];
                    }
                }
            });
            processSites(siteData);
        });
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

    // outputs a dictionary of the R5 sites with last sample date
    function processR5SiteData(data) {
        var parseR5Date = d3.timeParse('%Y-%m-%d');
        var r5Sites = {};
        // IE11 no longer supports sets
        var uniqueSites = [];
        for (var i = 0; i < data.length; i++) {
            var stationCode = data[i]['StationCode'];
            if (uniqueSites.indexOf(stationCode) < 0) {
                uniqueSites.push(stationCode);
            }
        }
        _r5Sites = uniqueSites;
        for (var i = 0; i < uniqueSites.length; i++) {
            var dates = data.filter(function(d) { return d.StationCode === uniqueSites[i]; });
            var maxDate = d3.max(dates.map(function(d) { return parseR5Date(d.SampleDate); }));
            r5Sites[uniqueSites[i]] = maxDate;
        }
        return r5Sites;
    }

    function processSites(data) {
        var today = new Date();
        features = [];
        for (var i = 0; i < data.length; i++) {
            var sampleDate = data[i].LastSampleDate;
            // check for missing values
            // filter out site 'Leona Creek at Brommer Trailer Park' for inaccurate coordinates
            // this is a temporary solution until we correct the coordinates
            if ((data[i].TargetLongitude === 'NaN') || (data[i].TargetLatitude === 'NaN') || !(data[i].StationName) || !(data[i].StationCode) || (data[i].StationCode === '304-LEONA-21')) { 
                continue; 
            } else {
                // reformat as geojson
                var site = {};
                site.type = 'Feature';
                site.geometry = { 'type': 'Point', 'coordinates': [+data[i].TargetLongitude, +data[i].TargetLatitude] };
                site.properties = { 'StationName': data[i].StationName, 'StationCode': data[i].StationCode, 'LastSampleDate': sampleDate, 'DateDifference': daysBetween(sampleDate, today) };
                features.push(site);
            }
        }
        // sort by ascending on field "DateDifference"
        // this is for displaying the most recently sampled sites on top
        // i tried to use panes to control the order in which the sites are displayed;
        // however, there were performance issues
        // this is the best solution for now, but may try webgl in the future
        features.sort(function(a, b) {
            return b.properties.DateDifference - a.properties.DateDifference;
        });
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

// convert to UNIX timestamp
function convertToTimestamp(date) {
    return date.getTime();
}

// convert to date object
function convertToDateObj(seconds) {
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

// Which data quality categories to include
var dqCategories = [dataQuality1, dataQuality2, dataQuality3, dataQuality4, dataQuality5];

var downloadOp1 = 'Download monitoring data (.csv)',
    downloadOp2 = 'Download geometric mean data (.csv)';

var map = L.map('map',{ 
    center: [37.5050, -119.965], 
    zoom: 6, 
    preferCanvas: true,
    doubleClickZoom: false, 
    zoomControl: false,
}); 

// panes are used in leaflet control the order in which the markers are displayed
var otherPane = map.createPane('otherPane');
var yearPane = map.createPane('yearPane');
var monthPane = map.createPane('monthPane');
map.getPane('otherPane').style.zIndex = 650;
map.getPane('yearPane').style.zIndex = 660;
map.getPane('monthPane').style.zIndex = 670;

var chartOpacity = 0.8;
var currentAnalyte; 
var currentScale = 'log';
var gmLimit = 2;
var lastSite = new Object();
// var mainColor = '#1f78b4', secColor = '#ff7f0e';
var mainColor = '#145785', secColor = '#e86348';
var MS_PER_DAY = (24 * 60 * 60 * 1000);
var parseDate = d3.timeParse('%Y-%m-%dT%H:%M:%S');
var recordLimit = 10000;
var siteLayer; // accessed globally for highlight functions
var _r5Sites; // accessed globally for checking if a site is an R5 site

clearSearch();
addMessages();
addMapTiles();
addMapControls(); 
addSiteLayer(); 