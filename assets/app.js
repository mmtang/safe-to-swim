/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

var ecoli = new Analyte('E. coli', 320, 100),
    enterococcus = new Analyte('Enterococcus', 110, 30),
    coliformtotal = new Analyte('Coliform, Total'),
    coliformfecal = new Analyte('Coliform, Fecal');

var map = L.map('map',{ 
    center: [37.4050, -119.0179], 
    zoom: 6, 
    preferCanvas: true,
    doubleClickZoom: false, 
    zoomControl: false
}); 

// before API format change: '%m/%d/%Y %H:%M'
var parseDate = d3.timeParse('%Y-%m-%d %H:%M:%S');
// initialize request tracker
var requestCount = 0; 
// limit the number of records from the API
var recordLimit = 5000;
var lastStation = new Object();

//closePanel();
sendInitialRequest();
resetLayerMenu(); 
addTileLayers();
addRefLayers(); 
addMapControls(); 
addSiteLayer(); 
/* FOR TESTING
$('#chart-container').css('display', 'inline-block');
openPanel();
showPanelError();
*/


function onMarkerClick(e) {
    var path = createURL('6e99b457-0719-47d6-9191-8f5e7cd8866f', lastStation.code);
    // highlightMarker(e);
    $('#chart-container').css('display', 'inline-block');
    resetPanel();
    openPanel();
    showPanelLoading(); 

    getData(path, processData); 

    function processData(data) { 
        $('#chart-panel').html('');
        initializeSidebar();
        // data quality classes
        var dataQuality0 = "MetaData, QC record",
            dataQuality1 = "Passed QC"
            dataQuality2 = "Some review needed",
            dataQuality3 = "Spatial Accuracy Unknown",
            dataQuality4 = "Extensive review needed",
            dataQuality5 = "Unknown data quality",
            dataQuality6 = "Reject record",
            dataQuality7 = "Error";

        if (data.length > 0) { 
            var analyteSet = new Set(); 
            var chartData = [];
            for(var i = 0; i < data.length; i++) {
                var d = {};
                d.Analyte = data[i].Analyte;
                analyteSet.add(data[i].Analyte);
                d.DataQuality = data[i].DataQuality;
                d.mdl = +data[i].MDL;
                d.Program = data[i].Program;
                // change all non-detects before charting and calculating the geomean
                // result = new field, Result = original field
                if (checkND(data[i])) {
                    // use half the method detection limit for non-detects
                    d.result = d.mdl * 0.5;
                } else {
                    d.result = +data[i].Result;
                }
                if (d.result <= 0) { continue; }
                d.ResultQualCode = data[i].ResultQualCode;
                d.sampledate = parseDate(data[i].SampleDate);
                d.StationCode = data[i].StationCode;
                d.StationName = data[i].StationName;
                d.Unit = data[i].Unit;
                chartData.push(d);
            }
            var analytes = [];
            analyteSet.forEach(function(i) { analytes.push(i); }); 
            // sort descending so that Enteroccocus and E. coli appear first 
            analytes.sort(function(a,b) { return b > a; });
            var defaultAnalyte = analytes[0];
            addAnalyteMenu(analytes);
            addFilterMenu(); 
            addScaleMenu(); 
            addChart(chartData, defaultAnalyte);
            // add listener for analyte menu
            $('#analyte-menu').on('change', function() {
                addChart(chartData, this.value);
            });
        } else {
            closePanel();
            alert("No data for selected site.");
        }
    }  

    function addChart(data, analyte) {
        resetFilters();
        initializeDatePanel();
        var chartData = data.filter(function(d) {
            return d.Analyte === analyte;
        });
        
        var blue = '#1f78b4', green = '#68c182';
        var chartMargin = {top: 10, right: 20, bottom: 100, left: 50};
        var chart = new Chart({
            element: document.getElementById('chart-space'),
            margin: chartMargin,
            data: chartData,
            width: 862 - chartMargin.left - chartMargin.right,
            height: 490 - chartMargin.top - chartMargin.bottom
        })

        // calculate axis buffers based on analyte selected
        if (analyte === ecoli.name) {
            chart.createScales(ecoli.stv);
        } else if (analyte === enterococcus.name) {
            chart.createScales(enterococcus.stv);
        } else {
            chart.createScales(null);
        }
        
        chart.addAxes();
        chart.createTooltip('tooltipLine');
        chart.createTooltip('tooltipPoint');

        // add threshold lines based on analyte selected
        if (analyte === ecoli.name) {
            chart.addLine(ecoli.stv, blue, tooltipThresholdSTV);
            chart.addLine(ecoli.geomean, green, tooltipThresholdGM);
        } else if (analyte === enterococcus.name) {
            chart.addLine(enterococcus.stv, blue, tooltipThresholdSTV);
            chart.addLine(enterococcus.geomean, green, tooltipThresholdGM);
        }
        chart.addPoints(chartData, 6, blue, tooltipResult);

        if ((analyte === ecoli.name) || (analyte === enterococcus.name)) {
            var geomeanData = getGeomeans(chartData);
            chart.addGPoints(geomeanData, 5, green, tooltipGM);
        }
        
        chart.drawBrush();
        chart.addBrushPoints(chartData, 3, blue);


        // add chart filter listeners
        d3.select('#filter-result').on('change', function() { togglePoints(this, '.circle'); });
        d3.select('#filter-geomean').on('change', function() { togglePoints(this, '.gCircle'); });
    }
} // onMarkerClick


/*
/ Global Listeners
*/

$(document).on('click', '.panel-heading span.clickable', function(e) {
    var $this = $(this);
	if ($this.hasClass('panel-collapsed')) {
        openPanel();
	} else {
		closePanel();
	}
})

$("#about-btn").click(function() {
    $("#aboutModal").modal("show");
    $(".navbar-collapse.in").collapse("hide");
    return false;
});

$("#mobile-about-btn").click(function() {
    $("#aboutModal").modal("show");
    $(".navbar-collapse.in").collapse("hide");
    return false;
});

$("#nav-btn").click(function() {
    $(".navbar-collapse").collapse("toggle");
    return false;
});

$("#sidebar-hide-btn").click(function() {
    hideSidebar();
    return false;
});

$("#mobile-close-btn").click(function() {
    hideSidebar();
    return false;
})


/*
/ App Helper Functions 
*/

function addAnalyteMenu(analytes) {
    $('#analyte-menu').empty();
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
    var analyteContainer = document.getElementById("analyte-container");
    analyteContainer.appendChild(analyteMenu);
}

function addFilterMenu() {
    var filterContainer = document.getElementById("filter-container");
    var filterMenu = '<div id="filter-menu"><div class="form-check"><label><input id="filter-result" value="data" class="form-check-input" type="checkbox" checked>&nbsp;Observations&nbsp;&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i></label></div><div class="form-check"><label><input id="filter-geomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;Geometric mean&nbsp;&nbsp;<i class="fa fa-circle gm-dot" aria-hidden="true"></i></label></div></div>';
    filterContainer.innerHTML += filterMenu;
}

function addScaleMenu() {
    $('#scale-container').append('<div class="btn-group btn-group-sm" role="group"><button type="button" class="btn btn-default">Linear Scale</button><button type="button" class="btn btn-default">Log Scale</button></div>');
}

function Analyte(name, stv, geomean) {
    this.name = name;
    this.stv = stv;
    this.geomean = geomean;
}

function openPanel() {
    $('#chart-panel').css('display', 'block');
    $('.panel-heading span.clickable').removeClass('panel-collapsed');
    $('.panel-heading span.clickable').find('i').removeClass('fa fa-caret-down').addClass('fa fa-caret-up');
}

function closePanel() {
    $('#chart-panel').css('display', 'none');
    $('.panel-heading span.clickable').addClass('panel-collapsed');
    $('.panel-heading span.clickable').find('i').removeClass('fa fa-caret-up').addClass('fa fa-caret-down');
}

function createURL(resource, site) {
    var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    if (typeof site === 'undefined') {
        return url;
    } else {
        // optional site parameter
        var fullPath = url + '&fields[t]=Analyte,DataQuality,MDL,Program,Result,ResultQualCode,SampleDate,StationCode,StationName,Unit'
        fullPath += '&filters[StationCode]=' + site;
        var cleanPath = fullPath.replace(/\#/, '%23');
        return cleanPath;
    }
}

function getData(url, callback, offset, data) {
    requestCount++;
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }
    console.log(url);
    console.log(callback);

    var xhr = $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        jsonpCallback: callback.name,
        dataType: 'jsonp',
        requestCount: ++requestCount,
        success: function(res) {
            console.log(requestCount, this.requestCount);
            if (requestCount === this.requestCount) {
                var records = res.result.records;
                console.log(records);
                data = data.concat(records);
                if (records.length < recordLimit) {
                    callback(data);
                } else {
                    getData(url, callback, offset + recordLimit, data);
                }
            } else {
                console.log('Ignore request');
                console.log('Ignored data: ', res.result.records)
                xhr.abort();
            }
        },
        error: function(xhr, status, errorThrown) {
            console.log(xhr);
            console.log(status);
            console.log(errorThrown);
            showPanelError();
        }
    });
}

// gets data from last year
function getDataRecent(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }
    console.log(url);

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        jsonpCallback: callback.name,
        dataType: 'jsonp',
        requestCount: ++requestCount,
        success: function(res) {
            if (requestCount == this.requestCount) {
                var records = res.result.records;
                data = data.concat(records);
                var dataLen = records.length,
                    lastRec = records[dataLen - 1],
                    lastDate = parseDate(lastRec.SampleDate);
                var today = new Date();
                var dateDiff = daysBetween(lastDate, today);
                if (dateDiff > 365) {
                    callback(data);
                } else {
                    getDataRecent(url, callback, offset + recordLimit, data);
                }
            } else {
                console.log('Ignore request');
            }
        },
        error: function(xhr, status, errorThrown) {
            console.log(xhr);
            console.log(status);
            console.log(errorThrown);
            showInitialError();
        }
    });
}

function getDataSites(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }
    console.log(url);

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        jsonpCallback: callback.name,
        dataType: 'jsonp',
        requestCount: ++requestCount,
        success: function(res) {
            console.log(requestCount, this.requestCount);
            if (requestCount == this.requestCount) {
                var records = res.result.records;
                console.log(records);
                data = data.concat(records);
                if (records.length < recordLimit) {
                    callback(data);
                } else {
                    getDataSites(url, callback, offset + recordLimit, data);
                }
            } else {
                console.log('Ignore request');
            }
        },
        error: function(e) {
            console.log(e);
            showInitialError();
        }
    });
}

function getWidth() {
    return Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    );
}

function hideSidebar() {
    isSidebarOpen = false;
    var windowWidth = getWidth();
    if (windowWidth <= 767) {  // for mobile layout
        document.getElementById('mobile-menu-btn').style.display = 'inline';
        document.getElementById('mobile-close-btn').style.display = 'none';
        var animationTime = 0;
    } else {
        var animationTime = 0;
    }
    $("#sidebar").hide(animationTime, function() {
        setTimeout(function() {
            map.invalidateSize(true);
        }, 200); 
    });
    showSidebarControl();
}

function hideSidebarControl() {
    document.getElementById("sidebar-control").style.display = "none";
}

function initializeDatePanel() {
    $(".date-panel").empty();
    $(".date-panel").append('Drag the handles of the gray box above to change the date view.<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span></p>');
}

function initializeSidebar() {
    var featureContent = '<div id="popup-menu"><div id="analyte-container"></div><div id="filter-container"></div></div>' + '<div id="chart-space"></div><div class="date-panel"></div><div id="scale-container"></div>';
    $('#chart-panel').html(featureContent);
}

function resendRequest() {
    $('.panel-text').html('<h3 class="panel-title">' + lastStation.name + ' (' + lastStation.code + ')</h3>');
    onMarkerClick(lastStation.e);
}

function resetFilters() {
    document.getElementById("filter-result").checked="true";
    document.getElementById("filter-geomean").checked="true";
}

function resetLayerMenu() {
    document.getElementById("topo-tile-radio").checked="true";
    document.getElementById("sites-box").checked="true";
    document.getElementById("counties-box").checked="";
    document.getElementById("rb-boundaries-box").checked="";
}

function resetPanel() {
    $('#chart-container').removeClass('panel-warning');
    $('#chart-container').addClass('panel-primary');
}

function sendInitialRequest() {
    var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=6e99b457-0719-47d6-9191-8f5e7cd8866f&limit=500&fields[t]=Analyte,DataQuality,MDL,Program,Result,ResultQualCode,SampleDate,StationCode,StationName,Unit&filters[StationCode]=633WFCB02';
    console.log('Sending initial request.');
    $.ajax({
        type: 'GET',
        url: url,
        dataType: 'jsonp',
        success: function(res) {
            console.log('Initial request returned.');
            console.log(res);
        },
        error: function(e) {
            console.log('Initial request error.');
            console.log(e);
        }
    });
}

function showInitialError() {
    $('#chart-container').css('display', 'inline-block');
    openPanel();
    $('#chart-container').removeClass('panel-primary');
    $('#chart-container').addClass('panel-warning');
    $('.panel-text').html('<h3 class="panel-title">Error!</h3>');
    $('#chart-panel').html('<p class="warning">Error fetching the map data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="window.location.reload()">Retry</button></div>');
}

function showPanelError() {
    $('#chart-container').removeClass('panel-primary');
    $('#chart-container').addClass('panel-warning');
    $('.panel-text').html('<h3 class="panel-title">Error!</h3>');
    $('#chart-panel').html('<p class="warning">Error fetching the site data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="resendRequest()">Retry</button></div>');
}

function showPanelLoading() {
    $('#chart-panel').html('Fetching data<div id="loading"><div class="loading-indicator"><div class="progress progress-striped active"><div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width:100%"></div></div></div></div>');
}

function showSidebar() {
    var windowWidth = getWidth();
    if (windowWidth <= 767) {  // for mobile layout
        document.getElementById('mobile-menu-btn').style.display = 'none';
        document.getElementById('mobile-close-btn').style.display = 'inline';
        var animationTime = 0;
    } else {
        var animationTime = 0;
    }
    $("#sidebar").show(animationTime, function() {
        setTimeout(function() {
            map.invalidateSize(true);
        }, 200); 
    });
    hideSidebarControl();
}

function showSidebarControl() {
    document.getElementById("sidebar-control").style.display = "block";
}

/*
/ Map Helper Functions 
*/

function addMapControls() {
    var sidebarControl = L.Control.extend({
        options: { position: 'topright'
        },
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'sidebar-control-container');
            container.innerHTML = '<div id="sidebar-control"><a href="#" onClick="showSidebar()"><button type="button" class="btn btn-xs btn-default pull-left" id="sidebar-show-btn"><i class="fa fa-chevron-left fa"></i></button></a></div>';
            return container;
        }
    });
    map.addControl(new sidebarControl());
    var zoomControl = L.control.zoom({ position:'topleft' }).addTo(map);
    addMapLegend();
}

function addMapLegend() {
    var legend = L.control({ position: 'bottomleft' });

    legend.onAdd = function(map) {
        var div = L.DomUtil.create('div', 'info legend'),
            labels = ['<strong>Last Sample Date</strong>'],
            categories = ['Within last 30 days', 'Within last year', 'Older than a year'],
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

function addRefLayers() {
    map.createPane('refPane');
    // set z-index of reference pane under overlay pane (400) and over tile pane (200)
    map.getPane('refPane').style.zIndex = 350;
    // initialize layers
    var countyLayer = L.esri.featureLayer({
        url: 'https://gispublic.waterboards.ca.gov/arcgis/rest/services/webmap/CountyBoundaries/MapServer/0',
        pane: 'refPane',
        style: function (feature) {
            return {
                color: '#30A5E7',
                weight: 3,
                fillOpacity: 0.1
            };
        }
    });
    var rbLayer = L.esri.featureLayer({
        url: 'https://gispublic.waterboards.ca.gov/arcgis/rest/services/webmap/rbbound/MapServer/0',
        pane: 'refPane',
        style: function (feature) {
            return {
                color: '#732B8D', 
                weight: 3,
                fillOpacity: 0.1
            };
        }
    });
    // add listeners
    $("#counties-box").click( function() { toggleLayer(countyLayer); });
    $("#rb-boundaries-box").click( function() { toggleLayer(rbLayer); });
}

function addSiteLayer() {
    // initialize variable for keeping track of clicked sites
    var selected = null;
    // initialize layer
    var siteLayer = L.geoJson([], {
        onEachFeature: function(feature, layer) {
            // add site name tooltip
            if (feature.properties.StationName) {
                layer.bindPopup(feature.properties.StationName, {closeButton: false, offset: L.point(0, 0)});
                layer.on('mouseover', function() { layer.openPopup(); });
                layer.on('mouseout', function() { layer.closePopup(); });
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

    // request sites from API and process data
    var sitesPath = createURL('02e59b14-99e9-489f-bc62-987108bc8e27');
    // most recent samples from API for join
    var siteDataPath = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=6e99b457-0719-47d6-9191-8f5e7cd8866f&fields[t]=StationCode,SampleDate&limit=5000&sort[SampleDate]=desc';

    getDataSites(sitesPath, processSites);

    // add listeners
    document.getElementById('sites-box').addEventListener('click', function() { toggleLayer(siteLayer); });
    // leaflet event
    siteLayer.on('click', function(e) {
        // record new selection
        lastStation.e = e;
        lastStation.code = e.layer.feature.properties.StationCode;
        lastStation.name = e.layer.feature.properties.StationName;
        $('.panel-text').html('<h3 class="panel-title">' + e.layer.feature.properties.StationName + ' (' + e.layer.feature.properties.StationCode + ')</h3>');
        setTimeout(function() {
            hideSidebarControl();
        }, 400);
        onMarkerClick(e);
    });

    function addSites(data) {
        siteLayer.addData(data);
        setTimeout(function() {
            $(".background-mask").hide();  
        }, 1000);
    }

    function processSites(data, callback) {
        features = [];
        for (var i = 0; i < data.length; i++) {
            var site = {};
            // check for missing essential properties
            if (!(data[i].Longitude) || !(data[i].Latitude) || !(data[i].StationName) || !(data[i].SiteCode)) { 
                continue; 
            } else {
                // filter out site name 'Leona Creek at Brommer Trailer Park' for inaccurate coordinates
                if (data[i].SiteCode === '304-LEONA-21') {
                    continue
                } else {
                    /*
                    site.type = "Feature";
                    site.geometry = {"type": "Point", "coordinates": [data[i].Longitude, data[i].Latitude]};
                    site.properties = { "StationName": data[i].StationName, "StationCode": data[i].SiteCode };
                    features.push(site);
                    */
                    site.StationName = data[i].StationName;
                    site.StationCode = data[i].SiteCode;
                    site.Latitude = +data[i].Latitude;
                    site.Longitude = +data[i].Longitude;
                    features.push(site);
                }
            }
        }
        getDataRecent(siteDataPath, processSiteData);
    }

    function joinSiteData(data) {
        var db = new alasql.Database();
        db.exec('CREATE TABLE feature');
        db.exec('CREATE TABLE att');
        // 'features' is from processSites
        db.exec('SELECT * INTO feature FROM ?', [features]);
        db.exec('SELECT * INTO att FROM ?', [data]);
        // will output only those sites with matches
        var date = db.exec('SELECT stationcode, max(sampledate) as sampledate FROM att GROUP BY stationcode');
        db.exec('CREATE TABLE date');
        db.exec('SELECT * INTO date FROM ?', [date]);
        // join data back to full site list
        var joined = db.exec('SELECT feature.*, date.sampledate FROM feature LEFT JOIN date ON feature.StationCode = date.stationcode ORDER BY date.sampledate');
        return joined;
    }

    function processSiteData(data) {
        var siteData = [];
        for (var i = 0; i < data.length; i++) {
            var record = {};
            // check for missing properties needed for join
            if (!(data[i].StationCode) || !(data[i].SampleDate)) {
                continue;
            } else {
                // pick out station code and sample date for join
                record.stationcode = data[i].StationCode;
                // convert date to UTC timestamp for max function
                record.sampledate = parseDate(data[i].SampleDate).getTime();
                siteData.push(record); 
            }
        }
        var joined = joinSiteData(siteData);
        // reformat objects to geojson
        var mapSites = [];
        var today = new Date();
        var date = null;
        var dateDiff = null;
        for (var i = 0; i < joined.length; i++) {
            var site = {};
            if (joined[i].sampledate) {
                // convert UTC timestamp
                // calculate date difference with today's date
                date = convertUNIX(joined[i].sampledate);
                dateDiff = daysBetween(date, today);
            } else {
                date = null;
                dateDiff = null;
            }
            site.type = 'Feature';
            site.geometry = {'type': 'Point', 'coordinates': [joined[i].Longitude, joined[i].Latitude]};
            site.properties = {'StationName': joined[i].StationName, 'StationCode': joined[i].StationCode, 'LastSampleDate': date, 'DateDifference': dateDiff};
            mapSites.push(site);
        }
        addSites(mapSites);
    }
}

function addTileLayers() {
    var Esri_WorldTopoMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'}).addTo(map);
    var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'});
        
    // listener for toggling tile layers
    $('#tile-menu input').on('change', function() {
        var selectedBasemap = $('input[name=tileRadio]:checked').val(); 
        if (selectedBasemap === "topo") {
            if (map.hasLayer(Esri_WorldImagery)) {
                map.removeLayer(Esri_WorldImagery);
                map.addLayer(Esri_WorldTopoMap);
            }
        }
        if (selectedBasemap === "satellite") {
            if (map.hasLayer(Esri_WorldTopoMap)) {
                map.removeLayer(Esri_WorldTopoMap);
                map.addLayer(Esri_WorldImagery);
            }
        }
    });
}

function getColor(d) {
    if (d === null) {
        return '#50cfe9'; // null date
    } else if (d <= 30) {
        return '#fefb47' // 1 month
    } else if (d <= 360) {
        return '#82ff83'; // 1 year
    } else {
        return '#50cfe9'; // older than 1 year, same as null
    } 
}

/*
function highlightMarker(e) {
    e.layer.options.color = '#00e5ee';
    e.layer.options.fillColor = '#00e5ee';
    e.layer.options.weight = 3;
}
function resetMarker(e) {
    e.layer.options.color = '#000';
    e.layer.options.fillcolor = '#000';
    e.layer.weight = 1;
}
*/

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

function checkND(d) {
    if ((d.result <= 0) || (d.ResultQualCode === "ND")) {
        return true;
    } else {
        return false;
    }
}

function clearChart() {
    var svg = d3.select("svg");
    svg.selectAll("*").remove();
    d3.selectAll(".tooltip").remove();
}

// convert to UNIX time
function convertDate(date) {
    return date.getTime();
}

// convert to Javascript date
function convertUNIX(seconds) {
    return new Date(seconds);
}

function maxDisplay(y) {
    // for both analytes, STV value is higher than the GM value
    if (analyte === ecoli) {
        return Math.max(stvEcoli, y);
    } else if (analyte === enterococcus) {
        return Math.max(stvEnterococcus, y);
    }
}

function roundHundred(value) {
    return (value / 100) * 100
}

function caller(callback, param) {
    return callback(param);
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

function togglePoints(context, name) {
    if (d3.select(context).property('checked')){
        d3.selectAll(name).attr('visibility', 'visible');
    } else {
        d3.selectAll(name).attr('visibility', 'hidden');
    }
}	

function tooltipGM(d) {
    var tooltipDate = d3.timeFormat('%b %e, %Y');
    var content = "Date: " + tooltipDate(d.enddate) + "<br/ >Geometric Mean: " + d.geomean;
    return content;
}

function tooltipResult(d) {
    var tooltipDate = d3.timeFormat('%b %e, %Y');
    var resultContent = 'Program: ' + d.Program + '<br>Analyte: ' + d.Analyte + '<br>Date: ' + tooltipDate(d.sampledate) + '<br>Result: ' + d.result + ' ' + d.Unit + '<br>Site: ' + d.StationName;
    return resultContent;
}

function tooltipThresholdSTV(val) {
    var content = 'Statistical Threshold Value (STV):<br/>' + val + ' cfu/100 mL';
    return content;
}

function tooltipThresholdGM(val) {
    var content = 'Geomean Threshold:<br/>' + val + ' cfu/100 mL';
    return content;
}