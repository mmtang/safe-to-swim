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
            // before 2010
            getData('1d333989-559a-433f-b93f-bb43d21da2b9', site),
            // 2010-2020
            getData('04d98c22-5523-4cc1-86e7-3a6abf40bb60', site),
            // 2020-present
            getData('15a63495-8d9f-4a49-b43a-3092ef3106b9', site)
        ).done(function(res11, res12, res13) {
            // Results are returned in order of the functions listed above in the when statement
            // checks that the returned site matches the last site clicked 
            // this is in case the user clicks multiple sites in succession
            if (site === lastSite.code) {
                // merge the CEDEN data responses
                var dataPart1 = processData(res11[0].result.records);
                var dataPart2 = processData(res12[0].result.records);
                var dataPart3 = processData(res13[0].result.records);
                var allData = dataPart1.concat(dataPart2, dataPart3);
                // render data
                addPanelContent(allData);
            } else {
                console.log('Ignored request for ' + site);
            }
        });
    }

    function getData(resource, site) {
        var baseURL = 'https://data.ca.gov/api/3/action/datastore_search?resource_id=';
        var requestURL = createURL(baseURL + resource, site);
        return $.ajax({
            type: 'GET',
            url: requestURL,
            dataType: 'json',
            error: function(xhr, textStatus, error) {
                handleSiteError(site);
                console.log(xhr.statusText);
                console.log(textStatus);
                console.log(error);
            }
        });
    }
    
    function handleSiteError(siteCode) {
        // if multiple sites are clicked in succession, only the last request should show an error
        if (siteCode === lastSite.code) {
            showSiteError();
        }
    }

    function processData(data) { 
        // filter on data quality category
        var chartData = data.filter(d => dqCategories.includes(d.DataQuality));
        // Filter out null values
        chartData = chartData.filter(d => d.ResultSub != 'NaN');
        // force data types and handle NDs
        for (var i = 0; i < chartData.length; i++) { 
            chartData[i].ResultSub = +chartData[i].ResultSub;
            // New column: Assign a new value to results that are 0 (cannot be shown on log scale graph)
            chartData[i].ResultDisplay = checkDisplay(chartData[i].ResultSub);
            // parse date fields
            for (var d = 0; d < dateFields.length; d++) { 
                chartData[i][dateFields[d]] = parseDate(chartData[i][dateFields[d]]);
            }
        }
        return chartData;
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

    function addAnalyteListener(data) {
        document.getElementById('analyte-menu').addEventListener('change', function() {
            currentAnalyte = this.value;
            updateFilters();
            addChart(data, currentAnalyte);
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

    // a function for separating ddPCR data and non-ddPCR data and returning them separately
    // first item returned in the array is an array of the non-ddpcr data; second item is an array of the ddpcr data
    function separateData(data) {
        if (data && data.length > 0) {
            var tradData = data.filter(function(d) {
                return d.MethodName !== 'ddPCR';
            });
            var ddPcrData = data.filter(function(d) {
                return d.MethodName === 'ddPCR';
            });
            return [tradData, ddPcrData];
        } else {
            return [[], []];
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

        // calculate x-extent of all analyte data
        var xExtent = d3.extent(chartData, function(d) { return d.SampleDate; });
        minDate = xExtent[0];
        maxDate = today;
        inputStartDate = xExtent[0];
        inputEndDate = today;
        viewStartDate = xExtent[0];
        viewEndDate = today;

        // set values and min/max values of the date selectors
        var minDateString = convertDateObjToPickerDate(minDate);
        var maxDateString = convertDateObjToPickerDate(today);
        setPickerMinDate(minDateString);
        setPickerMaxDate(maxDateString);
        setPickerStartDate(minDateString);
        setPickerEndDate(maxDateString);
        
        // does the entire dataset for this analyte have ddpcr data?
        var hasDdpcrData = chartData.filter(function(d) {
            return d.Unit === 'copies/100 mL';
        }).length > 0;

        // separate the data and return the non-ddpcr data and ddpcr data
        // first item in array will have non-ddpcr data, second item will have ddpcr data
        var separatedData = separateData(chartData);

        // chart 1: draw graph for non-ddpcr data
        if (separatedData[0].length > 0) {
            var chartData1 = separatedData[0];
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
            var chartMargin = {top: 60, right: 30, bottom: 50, left: 60};
            var chart1 = new Chart({
                id: 'chart-1',
                element: document.getElementById('chart-space-1'),
                hasDdpcrData: hasDdpcrData,
                margin: chartMargin,
                data: chartData1,
                width: panelWidth - chartMargin.left - chartMargin.right,
                height: panelHeight - chartMargin.top - chartMargin.bottom
            });

            // does the separated data have ddpcr data?
            var isDdpcrData = chartData1.filter(function(d) {
                return d.Unit === 'copies/100 mL';
            }).length > 0;

            // calculate axis buffers based on analyte-specific objectives
            if (isDdpcrData) {
                if (analyte === enterococcusDdpcr.info.name) {
                    chart1.createScales(enterococcusDdpcr.info.stv);
                } else {
                    chart1.createScales(null);
                }
            } else {
                if (analyte === ecoli.info.name) {
                    chart1.createScales(ecoli.info.stv);
                } else if (analyte === enterococcus.info.name) {
                    chart1.createScales(enterococcus.info.stv);
                } else {
                    chart1.createScales(null);
                }
            }
            chart1.addAxes();
            chart1.drawLines(analyte, isDdpcrData);
            chart1.drawPoints();
            chart1.drawGPoints();
            //chart1.drawBrush();
            //chart1.drawBrushPoints();
        } else {
           var chartElement = d3.select('chart-1');
           chartElement.selectAll('*').remove();
        }

        // chart 2: draw graph for ddpcr data
        if (separatedData[1].length > 0) {
            var chartData2 = separatedData[1];
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
            var chartMargin = {top: 60, right: 30, bottom: 50, left: 60};
            var chart2 = new Chart({
                id: 'chart-2',
                element: document.getElementById('chart-space-2'),
                hasDdpcrData: hasDdpcrData,
                margin: chartMargin,
                data: chartData2,
                width: panelWidth - chartMargin.left - chartMargin.right,
                height: panelHeight - chartMargin.top - chartMargin.bottom
            });

            // does the separated data have ddpcr data?
            var isDdpcrData = chartData2.filter(function(d) {
                return d.Unit === 'copies/100 mL';
            }).length > 0;

            // calculate axis buffers based on analyte-specific objectives
            if (isDdpcrData) {
                if (analyte === enterococcusDdpcr.info.name) {
                    chart2.createScales(enterococcusDdpcr.info.stv);
                } else {
                    chart2.createScales(null);
                }
            } else {
                if (analyte === ecoli.info.name) {
                    chart2.createScales(ecoli.info.stv);
                } else if (analyte === enterococcus.info.name) {
                    chart2.createScales(enterococcus.info.stv);
                } else {
                    chart2.createScales(null);
                }
            }
            chart2.addAxes();
            chart2.drawLines(analyte, isDdpcrData);
            chart2.drawPoints();
            chart2.drawGPoints();
            //chart2.drawBrush();
            //chart2.drawBrushPoints();
        } else {
            d3.select('#chart-space-2').selectAll('*').remove();
        }

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

        addGeomeanListener();
        updateDownloadMenu();
        addPickerStartDateListener();
        addPickerEndDateListener();
        addDateButtonListeners();

        function addDateButtonListeners() {
            var pickerStart = document.getElementById('picker-start-date');
            var pickerEnd = document.getElementById('picker-end-date');
            document.getElementById('date-button-all-data').addEventListener('click', function() {
                hidePickerError(); // reset error if shown
                inputStartDate = minDate;  
                inputEndDate = maxDate;
                viewStartDate = maxDate;
                viewEndDate = maxDate;
                pickerStart.value = convertDateObjToPickerDate(minDate);
                pickerEnd.value = convertDateObjToPickerDate(maxDate);
                if (chart1) { chart1.setDateView(minDate, maxDate) };
                if (chart2) { chart2.setDateView(minDate, maxDate) };
            });
            document.getElementById('date-button-last-year').addEventListener('click', function() {
                hidePickerError(); // reset error if shown
                var refDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                inputStartDate = refDate;  
                inputEndDate = maxDate;
                viewStartDate = refDate;
                viewEndDate = maxDate;
                pickerStart.value = convertDateObjToPickerDate(refDate);
                pickerEnd.value = convertDateObjToPickerDate(today);
                if (chart1) { chart1.setDateView(refDate, maxDate) };
                if (chart2) { chart2.setDateView(refDate, maxDate) };
            });
            document.getElementById('date-button-30-days').addEventListener('click', function() {
                hidePickerError(); // reset error if shown
                var refDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                inputStartDate = refDate;  
                inputEndDate = maxDate;
                viewStartDate = refDate;
                viewEndDate = maxDate;
                pickerStart.value = convertDateObjToPickerDate(refDate);
                pickerEnd.value = convertDateObjToPickerDate(today);
                if (chart1) { chart1.setDateView(refDate, maxDate) };
                if (chart2) { chart2.setDateView(refDate, maxDate) };
            });
            document.getElementById('date-button-7-days').addEventListener('click', function() {
                hidePickerError(); // reset error if shown
                var refDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)  
                inputStartDate = refDate;  
                inputEndDate = maxDate;
                viewStartDate = refDate;
                viewEndDate = maxDate;
                pickerStart.value = convertDateObjToPickerDate(refDate);
                pickerEnd.value = convertDateObjToPickerDate(today);
                if (chart1) { chart1.setDateView(refDate, maxDate) };
                if (chart2) { chart2.setDateView(refDate, maxDate) };
            });
        }

        function addPickerEndDateListener() {
            document.getElementById('picker-end-date').addEventListener('change', function() {
                var input = this.value; // format is YYYY-MM-DD
                // there is a bug(?) with the parsed date being off by about 8 hours (it shows up as one day earlier), append time value here
                input = input + 'T23:59:00'; 
                var newDate = new Date(input);
                inputEndDate = newDate;
                // check if entered date is within acceptable range
                if (newDate < inputStartDate) {
                    showPickerError('End date is before start date');
                } else if (newDate > maxDate || newDate < minDate) {
                    var formatDate = d3.timeFormat('%m/%d/%Y');
                    showPickerError('End date must be ' + formatDate(maxDate) + ' or earlier');
                } else if (newDate <= maxDate && newDate >= minDate) {
                    if (isInputStartDateValid(inputStartDate)) {
                        hidePickerError();
                        viewEndDate = newDate; // save to global
                        if (chart1) { chart1.setDateView(inputStartDate, newDate) };
                        if (chart2) { chart2.setDateView(inputStartDate, newDate) };
                    } 
                } else {
                    showPickerError('End date not valid');
                }
            });
        }
        
        function addPickerStartDateListener() {
            document.getElementById('picker-start-date').addEventListener('change', function() {
                var input = this.value; // format is YYYY-MM-DD
                // there is a bug(?) with the parsed date being off by about 8 hours (it shows up as one day earlier), append time value here
                input = input + 'T00:00:00'; 
                var newDate = new Date(input);
                inputStartDate = newDate;
                // check if entered date is within acceptable range
                if (newDate > inputEndDate) {
                    showPickerError('Start date is after end date');
                } else if (newDate < minDate || newDate > maxDate) {
                    var formatDate = d3.timeFormat('%m/%d/%Y');
                    showPickerError('Start date must be ' + formatDate(minDate) + ' or later');
                } else if (newDate <= maxDate && newDate >= minDate) {
                    if (isInputEndDateValid(inputEndDate)) {
                        hidePickerError();
                        viewStartDate = newDate; // save to global
                        if (chart1) { chart1.setDateView(newDate, inputEndDate) };
                        if (chart2) { chart2.setDateView(newDate, inputEndDate) };
                    }
                } else {
                    showPickerError('Start date not valid');
                }
            });
        }

        function isInputEndDateValid(newDate) {
            if (newDate < viewStartDate) {
                showPickerError('End date is before start date');
                return false;
            } else if (newDate > maxDate || newDate < minDate) {
                var formatDate = d3.timeFormat('%m/%d/%Y');
                showPickerError('End date must be ' + formatDate(maxDate) + ' or earlier.');
                return false;
            } else if (newDate <= maxDate && newDate >= minDate) {
                return true;
            } else {
                showPickerError('End date not valid');
                return false;
            }
        }

        function isInputStartDateValid(newDate) {
            if (newDate > viewEndDate) {
                showPickerError('Start date is after end date');
                return false;
            } else if (newDate < minDate || newDate > maxDate) {
                var formatDate = d3.timeFormat('%m/%d/%Y');
                showPickerError('Start date must be ' + formatDate(minDate) + ' or later.');
                return false;
            } else if (newDate <= maxDate && newDate >= minDate) {
                return true;
            } else {
                showPickerError('Start date not valid');
                return false;
            }
        }

        function hidePickerError() {
            var pickerError = document.querySelector('#picker-error-message');
            pickerError.innerHTML = ''; // Reset the content
        }

        function showPickerError(message) {
            var pickerError = document.querySelector('#picker-error-message');
            pickerError.textContent = message;
        }

        function addGeomeanListener() {
            document.getElementById('geomean-menu').addEventListener('change', function() {
                selected = Number(this.value);
                if (selected === 2) {
                    gmLimit = 2;
                } else if (selected === 5) {
                    gmLimit = 5;
                }
                if (chart1) { chart1.filterGPoints() };
                if (chart2) { chart2.filterGPoints() };
            })
        }
        
        function changeScale() {
            if (currentScale === 'linear') {
                resetScaleMenu();
                currentScale = 'log';
                if (chart1) { chart1.redraw() };
                if (chart2) { chart2.redraw() };
            } else if (currentScale === 'log') {
                document.getElementById('log-button').classList.remove('active');
                document.getElementById('linear-button').classList.add('active');
                currentScale = 'linear';
                if (chart1) { chart1.redraw() };
                if (chart2) { chart2.redraw() };
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
            d3.selectAll('#download-menu a').on('click', function() { 
                switch (this.text) {
                    case downloadOp1:
                        downloadCSV(chartData);
                        break;
                    case downloadOp2:
                        console.log('External link clicked.');
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

function Analyte(name, stv, geomean, unit) {
    this.info = {
        name: name,
        stv: stv,
        gm: geomean,
        unit: unit
    }
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

/* DELETE
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
        */

function createURL(baseURL, site) {
    // url encoding for site code, add more as needed
    var cleanSite = encode(site);
    var url = baseURL;
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

// This function converts an array of JavaScript objects to a tab delimited string.
function convertArrayOfObjectsToCSV(array, fields, columnDelimiter = ',') {
    var formatDate = d3.timeFormat('%Y-%m-%d %H:%M:%S'); // Date formatting for open data portal
    if (array.length > 0) {
        // Initialize empty string variable
        // Convert data records to strings and append them
        let dataString = '';
        const csvFields = fields ? fields : Object.keys(array[0]);
        const header = csvFields.join(columnDelimiter);
        const rows = array.map(obj => {
            return csvFields.map(fieldName => { 
                    if (dateFields.includes(fieldName)) {
                        if (obj[fieldName]) {
                            //return formatDate(obj[fieldName]); 
                            return formatDate(new Date(obj[fieldName]));
                        } else {
                            return null;
                        }
                    } else {
                        // If text string contains a comma, wrap double quotes around text string
                        if (obj[fieldName]) {
                            if (obj[fieldName].toString().includes(',')) {
                                return `"${obj[fieldName]}"`;
                            } else {
                                return obj[fieldName]; 
                            }
                        } else {
                            return null;
                        }
                    }
                })
                .join(columnDelimiter);
        });
        const body = rows.join('\r\n');
        dataString += header + '\r\n' + body;
        return dataString;
    }
}

function downloadCSV(array) {
    var fields = Object.keys(array[0]); // get field names and order
    fields = removeItem(fields, '_id');
    fields = removeItem(fields, 'ResultDisplay');
    var link = document.createElement('a');
    var csv = convertArrayOfObjectsToCSV(array, fields);
    if (csv == null) return;
    const filename = 'SafeToSwim_Data_Download_' + Date.now() + '.csv';
    // Two lines below are required to export ALL rows in the file.
    // https://stackoverflow.com/questions/24610694/export-html-table-to-csv-in-google-chrome-browser/24611096#24611096
    var csvData = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); 
    link.setAttribute('href', URL.createObjectURL(csvData));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link); 
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
    var featureContent = '<div id="popup-menu"><div id="analyte-container" class="popup-container"></div><div id="scale-container" class="popup-container"></div><div id="filter-container" class="popup-container"><div id="checkbox-container"></div><div id="geomean-container" class="popup-container"></div></div></div>' + '<div id="chart-space-2"></div><div id="chart-space-1"></div><div id="date-container" class="panel-container"></div><div id="download-container"></div>';
    document.getElementById('panel-content').innerHTML = featureContent;
}

function initializeDatePanel() {
    var todayText = convertDateObjToPickerDate(today);
    var datePanel = document.getElementById('date-container');
    datePanel.innerHTML = '';
    datePanel.innerHTML = '<div class="picker-col"><div><p class="js-date-range">Currently viewing:</p></div><div class="picker-col"><div class="picker-row"><div class="picker-wrapper"><label for="picker-start-date"><input type="date" id="picker-start-date" class="date-picker" name="view-start" value="' + todayText + '"/></label></div>' + ' to ' + '<div class="picker-wrapper"><label for="picker-end-date"><input type="date" id="picker-end-date" class="date-picker" name="view-end" value="' + todayText + '" /></label></div>&nbsp;&nbsp;<div><a href="#"><i class="fa fa-question-circle pop-top" data-toggle="popover" data-placement="top" data-html="true" data-content="Change the viewable time span of the graph."></i></a></div></div><div class="picker-row"><span id="picker-error-message" class="error" aria-live="polite"></span></div><div class="picker-row"><div class="btn-group btn-group-sm" role="group" aria-label="Preset date views"><button type="button" id="date-button-all-data" class="btn btn-default">All data</button><button id="date-button-last-year" type="button" class="btn btn-default">Last year</button><button id="date-button-30-days" type="button" class="btn btn-default">Last 30 days</button><button id="date-button-7-days" type="button" class="btn btn-default">Last 7 days</button></div></div></div>';
}

function initializeDownloadMenu() {
    var container = document.getElementById('download-container');
    container.innerHTML = '<div class="dropdown panel-container text-center"><div class="btn-group dropup"><button type="button" class="btn btn-default btn-sm dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><span class="glyphicon glyphicon-download-alt"></span>&nbsp;&nbsp;Download Data&nbsp;&nbsp;<span class="caret"></span></button><ul id="download-menu" class="dropdown-menu"><li><a href="#">' + downloadOp1 + '</a></li><li id="portal-dropdown-op"><a href="https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results" target="_blank" rel="noopener noreferrer">' + downloadOp2 + '</a></li></ul></div>';
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
    gmFilter.checked = true;
    updateGeomeanMenu();
}

function updateGeomeanMenu() {
    var gmFilter = document.getElementById('filter-geomean');
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
        var url = 'https://data.ca.gov/api/3/action/datastore_search_sql?sql=';
        var queryBefore2010 = `SELECT DISTINCT ON ("StationCode") "StationCode", "StationName", "TargetLatitude", "TargetLongitude", "RegionNumber", MAX("SampleDate") OVER (PARTITION BY "StationCode") FROM "1d333989-559a-433f-b93f-bb43d21da2b9"`;
        var query2010To2020 = `SELECT DISTINCT ON ("StationCode") "StationCode", "StationName", "TargetLatitude", "TargetLongitude", "RegionNumber", MAX("SampleDate") OVER (PARTITION BY "StationCode") FROM "04d98c22-5523-4cc1-86e7-3a6abf40bb60"`;
        var query2020Present = `SELECT DISTINCT ON ("StationCode") "StationCode", "StationName", "TargetLatitude", "TargetLongitude", "RegionNumber", MAX("SampleDate") OVER (PARTITION BY "StationCode") FROM "15a63495-8d9f-4a49-b43a-3092ef3106b9"`
        var call1 = $.get(url + queryBefore2010);
        var call2 = $.get(url + query2010To2020);
        var call3 = $.get(url + query2020Present);
        $.when(call1, call2, call3).then(function (res1, res2, res3) {
            var siteData1 = res1[0]['result']['records'];
            var siteData2 = res2[0]['result']['records'];
            var siteData3 = res3[0]['result']['records'];
            var siteData = siteData1.concat(siteData2, siteData3);
            // convert to date objects
            siteData.forEach(function(d) { d.LastSampleDate = parseDate(d.max); });
            // sort descending by sample date
            siteData.sort(function(a,b) { return b['LastSampleDate'] - a['LastSampleDate'] });
            // drop duplicates
            var siteData = siteData.filter((elem, index, self) => self.findIndex(
                (t) => {return (t.StationCode === elem.StationCode)}) === index)
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

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function responsive() {
    // get container + svg aspect ratio
    var svg = d3.select('#chart-1'),
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

function responsive2() {
    // get container + svg aspect ratio
    var svg = d3.select('#chart-2'),
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

// removes a single occurrence of a value in an array
// returns an array with that value removed
function removeItem(arr, value) {
    var index = arr.indexOf(value);
    if (index > -1) {
      arr.splice(index, 1);
    }
    return arr;
}

function roundHundred(value) {
    return (value / 100) * 100
}

function convertDateObjToPickerDate(date) {
    // Format dates to YYYY-MM-DD
    if (date instanceof Date) {
        var convertedDate = date.toISOString().slice(0, 10);
        return convertedDate;
    } else {
        return null;
    }
}

// date as a date string YYYY-MM-DD
function setPickerStartDate(date) {
    var datepicker = document.getElementById('picker-start-date');
    datepicker.value = date;
}

// date as a date string YYYY-MM-DD
function setPickerEndDate(date) {
    var datepicker = document.getElementById('picker-end-date');
    datepicker.value = date;
}

// date as a date string YYYY-MM-DD
function setPickerMinDate(date) {
    var datepicker = document.getElementById('picker-start-date');
    datepicker.min = date;
}

// date as a date string YYYY-MM-DD
function setPickerMaxDate(date) {
    var datepicker = document.getElementById('picker-end-date');
    datepicker.max = date;
}

var ecoli = new Analyte('E. coli', 320, 100, 'CFU/100 mL'),
    enterococcus = new Analyte('Enterococcus', 110, 30, 'CFU/100 mL'),
    enterococcusDdpcr = new Analyte('Enterococcus', 1413, null, 'copies');
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

var downloadOp1 = 'Download data (.csv)',
    downloadOp2 = 'Open data portal (data.ca.gov)';

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
var dateFields = ['SampleDate', 'CalibrationDate', 'PrepPreservationDate', 'DigestExtractDate', 'AnalysisDate', 'SampleDateTime', '30DayCutoffDate', '6WeekCutoffDate'];
var formatNum = d3.format(',');
var gmLength = 41; // define geomean length (6 weeks = 42 - 1 days = 41 days)
var gmLimit = 2;
var lastSite = new Object();
// var mainColor = '#1f78b4', secColor = '#ff7f0e';
var mainColor = '#145785', secColor = '#e86348';
var MS_PER_DAY = (24 * 60 * 60 * 1000);
var parseDate = d3.timeParse('%Y-%m-%dT%H:%M:%S');
var maxDate = null;
var minDate = null;
var inputEndDate = null;
var inputStartDate = null;
var viewEndDate = null;
var viewStartDate = null;
var recordLimit = 10000;
var siteLayer; // accessed globally for highlight functions
var today = new Date();
var _r5Sites; // accessed globally for checking if a site is an R5 site

clearSearch();
addMessages();
addMapTiles();
addMapControls(); 
addSiteLayer(); 