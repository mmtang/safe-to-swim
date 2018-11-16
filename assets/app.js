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

var dataQuality0 = "MetaData, QC record",
    dataQuality1 = "Passed QC"
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

// before API format change: '%m/%d/%Y %H:%M'
var parseDate = d3.timeParse('%Y-%m-%d %H:%M:%S');
// limit the number of records from the API
var recordLimit = 1000;
// variable for keeping track of map clicks
var lastStation = new Object();
var currentScale = 'linear';
var sitesList = [];
var countiesList = [];
var geomeanData = [];

var primColor = '#1f78b4', secColor = '#ff7f0e';

//closePanel();
clearSearch();
resetLayerMenu(); 
addTileLayers();
addRefLayers(); 
addMapControls(); 
addSiteLayer(); 

function onMarkerClick(e) {
    var clickedSite = e.layer.feature.properties.StationCode;
    var path = createURL('6e99b457-0719-47d6-9191-8f5e7cd8866f', clickedSite);
    // highlightMarker(e);
    $('#chart-container').css('display', 'inline-block');
    resetPanel();
    openPanel();
    showSiteLoading(); 

    getData(path, processData); 

    function processData(data) { 
        console.log('data: ', data);
        if (data.length > 0) { 
            clearChartPanel();
            initializeChartPanel();
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
                // result = new (converted) field, Result = original field
                if (checkND(data[i])) {
                    // use half the mdl for non-detects
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
            // sort descending so that enteroccocus and e. coli appear first 
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
            showSiteError();
            console.log('ERROR: Dataset is empty');
        }
    }  

    function addChart(data, analyte) {
        resetFilters();
        resetScaleMenu();
        initializeDatePanel();
        currentScale = 'linear';
        lineData = [];
        var chartData = data.filter(function(d) {
            return d.Analyte === analyte;
        });
        
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

        // calculate geomeans
        if ((analyte === ecoli.name) || (analyte === enterococcus.name)) {
            chart.gData = getGeomeans(chartData).filter(function(d) { 
                if (d.geomean) { return d; }
            });
        }

        chart.addAxes();
        chart.drawGPoints();
        chart.drawObjectives(analyte);
        chart.drawPoints();
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
        d3.select('#linearButton').on('click', function() { clickLinear(chart); });
        d3.select('#logButton').on('click', function() { clickLog(chart); });
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
    var filterMenu = '<div id="filter-menu"><div class="form-check"><label><input id="filter-result" value="data" class="form-check-input" type="checkbox" checked>&nbsp;Observations&nbsp;&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i></label></div><div class="form-check"><label><input id="filter-geomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;Geometric mean&nbsp;&nbsp;<img src="assets/triangle.gif"></label></div></div>';
    filterContainer.innerHTML += filterMenu;
}

function addScaleMenu() {
    $('#scale-container').append('<div class="btn-group btn-group-sm" role="group"><button type="button" id="linearButton" class="btn btn-default active">Linear Scale</button><button type="button" id="logButton" class="btn btn-default">Log Scale</button></div>');
}

function Analyte(name, stv, geomean) {
    this.name = name;
    this.stv = stv;
    this.geomean = geomean;
}

function clearChartPanel() {
    $('#chart-panel').html('');
}

function clearSearch() {
    $('#searchbox').val('');
}

function clickLinear(chart) {
    if (currentScale === 'log') {
        resetScaleMenu();
        currentScale = 'linear';
        chart.redraw();
    }
}

function clickLog(chart) {
    if (currentScale === 'linear') {
        $('#linearButton').removeClass('active');
        $('#logButton').addClass('active');
        currentScale = 'log';
        chart.redraw();
    }
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
    // var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    var url = 'https://data.cnra.ca.gov/api/3/action/datastore_search?resource_id=b6f30bfc-badd-47d3-93b9-445bd90f9738';
    url += '&fields=Analyte,DataQuality,MDL,Program,Result,ResultQualCode,SampleDate,StationCode,StationName,Unit';
    url += '&filters={%22StationCode%22:%22' + site + '%22}';
    url += '&limit=' + recordLimit;
    return url;
}

// recursive function for requesting site data from the CA open data portal (data.ca.gov)
function getData(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }
    console.log(url);

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        dataType: 'json',
        success: function(res) {
                var records = res.result.records;
                var firstRecord = records[0];
                // check that the site matches the last site clicked in the event that the user clicks multiple sites in succession
                if (firstRecord.StationCode === lastStation.code) {
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
            // parse the url to get the site code and check that it matches the last site clicked
            var splitURL = url.split('=');
            var parsedSite = splitURL[splitURL.length - 1];
            if (parsedSite === lastStation.code) {
                showSiteError();
            } else {
                console.log('ERROR: Request for ' + parsedSite);
            }
        }
    });
}

// recursive function for requesting the most recent records (sampled within the last year)
function getDataRecent(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }
    console.log(url);

    $.ajax({
        type: 'GET',
        url: url,
        data: {offset: offset},
        dataType: 'json',
        success: function(res) {
            var records = res.result.records;
            data = data.concat(records);
            var lastDate = parseDate(records[0].SampleDate);
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

// recursive function for requesting the site list from the CA open data portal (data.ca.gov)
function getDataSites(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }
    console.log(url);

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
        error: function(e) {
            console.log(e);
            hideLoadingMask();
            showMapLoadError();
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

function hideLoadingMask() {
    $("#map-loading-mask").hide();  
}

function initializeDatePanel() {
    $(".date-panel").empty();
    $(".date-panel").append('Drag the handles of the gray box above to change the date view.<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span></p>');
}

function initializeChartPanel() {
    var featureContent = '<div id="popup-menu"><div id="analyte-container"></div><div id="scale-container"></div><div id="filter-container"></div></div>' + '<div id="chart-space"></div><div class="date-panel"></div>';
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
    document.getElementById("carto-tile-radio").checked="true";
    document.getElementById("sites-box").checked="true";
    document.getElementById("counties-box").checked="";
    document.getElementById("rb-boundaries-box").checked="";
}

function resetPanel() {
    $('#chart-container').removeClass('panel-warning');
    $('#chart-container').addClass('panel-primary');
}

function resetScaleMenu() {
    $('#logButton').removeClass('active');
    $('#linearButton').addClass('active');
}

function showMapLoadError() {
    $('#chart-container').css('display', 'inline-block');
    openPanel();
    $('#chart-container').removeClass('panel-primary');
    $('#chart-container').addClass('panel-warning');
    $('.panel-text').html('<h3 class="panel-title">Error!</h3>');
    $('#chart-panel').html('<p class="warning">Error fetching the map data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="window.location.reload()">Retry</button></div>');
}

function showSiteLoading() {
    $('#chart-panel').html('Fetching data<div id="loading"><div class="loading-indicator"><div class="progress progress-striped active"><div class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100" style="width:100%"></div></div></div></div>');
}

function showSiteError() {
    $('#chart-container').removeClass('panel-primary');
    $('#chart-container').addClass('panel-warning');
    $('.panel-text').html('<h3 class="panel-title">Error!</h3>');
    $('#chart-panel').html('<p class="warning">Error fetching the site data. Please try again.</p><div><button type="button" class="btn btn-default" onclick="resendRequest()">Retry</button></div>');
}

/*
/ Map Helper Functions 
*/

function addMapControls() {
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
    var countyLayer = L.esri.featureLayer({
        url: 'https://gispublic.waterboards.ca.gov/arcgis/rest/services/webmap/CountyBoundaries/MapServer/0',
        pane: 'refPane',
        style: function (feature) {
            return {
                color: '#30A5E7',
                weight: 3,
                fillOpacity: 0
            };
        },
        onEachFeature: function(feature, layer) {
            countiesList.push({
                name: layer.feature.properties.CNTY_NAME,
                bounds: layer.getBounds()
            })
        }
    });
    /*
    var rbLayer = L.esri.featureLayer({
        url: 'https://gispublic.waterboards.ca.gov/arcgis/rest/services/webmap/rbbound/MapServer/0',
        pane: 'refPane',
        style: function (feature) {
            return {
                color: '#732B8D', 
                weight: 3,
                fillOpacity: 0
            };
        }
    });
    */
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

    // *** request sites from API and process data
    // data.ca.gov endpoint
    // var sitesPath = createURL('02e59b14-99e9-489f-bc62-987108bc8e27');
    // data.cnra.ca.gov endpoint 
    var sitesPath = 'https://data.cnra.ca.gov/api/3/action/datastore_search?resource_id=eb3e96c9-15f5-4734-9d25-f7d2eca2b883&limit=' + recordLimit;
    // *** request most recent samples from API for join
    // data.ca.gov endpoint, started using 11/6/18
    // var siteDataPath = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=6e99b457-0719-47d6-9191-8f5e7cd8866f&fields[t]=StationCode,SampleDate&limit=5000&sort[SampleDate]=desc';
    // data.cnra.ca.gov endpoint, started using 11/6/18
    var siteDataPath = 'https://data.cnra.ca.gov/api/3/action/datastore_search?resource_id=b6f30bfc-badd-47d3-93b9-445bd90f9738&fields=StationCode,SampleDate&sort=%22SampleDate%22%20desc&limit=' + recordLimit;

    getDataSites(sitesPath, processSites);

    // add listeners
    document.getElementById('sites-box').addEventListener('click', function() { toggleLayer(siteLayer); });
    // leaflet event
    siteLayer.on('click', function(e) {
        // record new selection in global variable
        lastStation.e = e;
        lastStation.code = e.layer.feature.properties.StationCode;
        lastStation.name = e.layer.feature.properties.StationName;
        $('.panel-text').html('<h3 class="panel-title">' + e.layer.feature.properties.StationName + ' (' + e.layer.feature.properties.StationCode + ')</h3>');
        onMarkerClick(e);
    });

    function addSites(data) {
        siteLayer.addData(data);
        setTimeout(hideLoadingMask, 1000);
    }

    function processSites(data) {
        features = [];
        for (var i = 0; i < data.length; i++) {
            var site = {};
            // check for missing values
            if (!(data[i].Longitude) || !(data[i].Latitude) || !(data[i].StationName) || !(data[i].SiteCode)) { 
                continue; 
            } else {
                // filter out site name 'Leona Creek at Brommer Trailer Park' for inaccurate coordinates
                if (data[i].SiteCode === '304-LEONA-21') {
                    continue;
                } else {
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
        // 'features' is the site list from processSites()
        db.exec('SELECT * INTO feature FROM ?', [features]);
        db.exec('SELECT * INTO att FROM ?', [data]);
        // get list of distinct sites based on most recent sample date
        var date = db.exec('SELECT stationcode, max(sampledate) as sampledate FROM att GROUP BY stationcode');
        db.exec('CREATE TABLE date');
        db.exec('SELECT * INTO date FROM ?', [date]);
        // join data back to site list
        var joined = db.exec('SELECT feature.*, date.sampledate FROM feature LEFT JOIN date ON feature.StationCode = date.stationcode ORDER BY date.sampledate');
        return joined;
    }

    function processSiteData(data) {
        var siteData = [];
        for (var i = 0; i < data.length; i++) {
            var record = {};
            // create new fields for join
            // convert date to UTC timestamp for use in max function
            record.stationcode = data[i].StationCode;
            record.sampledate = parseDate(data[i].SampleDate).getTime();
            siteData.push(record); 
        }
        var joined = joinSiteData(siteData);
        // reformat objects to geojson
        var today = new Date();
        for (var i = 0; i < joined.length; i++) {
            var site = {};
            var date = null;
            var dateDiff = null;
            if (joined[i].sampledate) {
                // convert UTC timestamp to date
                date = convertUNIX(joined[i].sampledate);
                dateDiff = daysBetween(date, today);
            }
            site.type = 'Feature';
            site.geometry = {'type': 'Point', 'coordinates': [joined[i].Longitude, joined[i].Latitude]};
            site.properties = {'StationName': joined[i].StationName, 'StationCode': joined[i].StationCode, 'LastSampleDate': date, 'DateDifference': dateDiff};
            // store in global variable
            sitesList.push(site);
        }
        addSites(sitesList);
        initializeSearch();
    }
}

function initializeSearch() {
    var sites = sitesList.map(function(d) {
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

    $('#searchbox').click(function () {
        $(this).select();
    });

    $('#searchbox').on('typeahead:selected', function (e, datum) {
        closePanel();
        $('.navbar-collapse').collapse('hide');
        map.setView([datum.lat, datum.lng], 17);
    }).on('focus', function () {
        $(".navbar-collapse.in").css("max-height", $(document).height() - $(".navbar-header").height());
        $(".navbar-collapse.in").css("height", $(document).height() - $(".navbar-header").height());
    }).on("focusout", function () {
        $(".navbar-collapse.in").css("max-height", "");
        $(".navbar-collapse.in").css("height", "");
    });

    $(".twitter-typeahead").css("position", "static");
    $(".twitter-typeahead").css("display", "block");
}

function addTileLayers() {
    var Carto_Voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    /*
    var Esri_WorldTopoMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'}).addTo(map);
    */
    var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'});
        
    // listener for toggling tile layers
    $('#tile-menu input').on('change', function() {
        var selectedBasemap = $('input[name=tileRadio]:checked').val(); 
        if (selectedBasemap === 'carto') {
            if (map.hasLayer(Esri_WorldImagery)) {
                map.removeLayer(Esri_WorldImagery);
                map.addLayer(Carto_Voyager);
            }
        }
        if (selectedBasemap === 'satellite') {
            if (map.hasLayer(Carto_Voyager)) {
                map.removeLayer(Carto_Voyager);
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

function toggleElement(context, name) {
    if (d3.select(context).property('checked')) {
        d3.selectAll(name).attr('visibility', 'visible');
    } else {
        d3.selectAll(name).attr('visibility', 'hidden');
    }
}