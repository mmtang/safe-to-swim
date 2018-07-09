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

// default style for map markers
var siteMarker = {
    radius: 5,
    fillColor: "#008080",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

// limit the number of records from the API
var recordLimit = 5000;

resetLayerMenu(); 
addTileLayers();
addRefLayers(); 
addMapControls(); 
addSiteLayer(); 

function onMarkerClick(e) {
    var siteClicked = e.layer.feature.properties.StationCode;
    var path = createURL('23a59a2c-4a95-456f-b39e-41446bdc5724', siteClicked);
    highlightMarker(e);
    showLoading(); 
    initializeSidebar(); 
    getData(path, processData);

    function processData(data) {
        /*  
        // data quality column names
        var dataQuality0 = "MetaData, QC record",
            dataQuality1 = "Passed QC"
            dataQuality2 = "Some review needed",
            dataQuality3 = "Spatial Accuracy Unknown",
            dataQuality4 = "Extensive review needed",
            dataQuality5 = "Unknown data quality",
            dataQuality6 = "Reject record",
            dataQuality7 = "Error";

        var qualityData = initialData.filter(d => {
            return (d.DataQuality === dataQuality1) || (d.DataQuality === dataQuality2) || (d.DataQuality === dataQuality3);
        });
        */
        if (data.length > 0) {
            hideLoading();
            var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
            var analyteSet = new Set(); 
            var chartData = [];
            for(var i = 0; i < data.length; i++) {
                var d = {};
                d.Analyte = data[i].Analyte;
                analyteSet.add(data[i].Analyte);
                d.DataQuality = data[i].DataQuality;
                d.DataQualityIndicator = data[i].DataQualityIndicator;
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
            hideLoading();
            alert("No data for selected site.");
        }
    }  

    function addChart(data, analyte) {
        resetFilters();
        initializeDatePanel();
        var chartData = data.filter(function(d) {
            return d.Analyte === analyte;
        });
        var geomeanData = getGeomeans(chartData);
        console.log(geomeanData);
        
        var blue = '#335b96', red = '#ED6874';
        var chartMargin = {top: 10, right: 20, bottom: 100, left: 50};
        var chart = new Chart({
            element: document.getElementById('chart-container'),
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
            chart.addLine(ecoli.geomean, red, tooltipThresholdGM);
        } else if (analyte === enterococcus.name) {
            chart.addLine(enterococcus.stv, blue, tooltipThresholdSTV);
            chart.addLine(enterococcus.geomean, red, tooltipThresholdGM);
        }
        
        chart.addPoints(chartData, 6, blue, tooltipResult);
        chart.addGPoints(geomeanData, 5, red, tooltipGM);
        chart.drawBrush();


        // add chart filter listeners
        d3.select('#filter-result').on('change', function() { togglePoints(this, '.circle'); });
        d3.select('#filter-geomean').on('change', function() { togglePoints(this, '.gCircle'); });
    }

    

    function processDataOld(data) {
        

        function addChartOld(data, analyte) {
              
            
            // x-axis grid
            focus.append("g")
                .attr("class", "axis grid")
                .call(ygAxis);

            context.append("g")
                .attr("class", "xAxis2")
                .attr("transform", "translate(0," + height2 + ")")
                .call(xAxis2);
            
            /* 
            var resultsContext = context.append("g");
                resultsContext.attr("clip-path", "url(#clip)");
                resultsContext.selectAll("dot")
                    .data(graphData)
                    .enter().append("circle")
                    .attr('class', 'dotContext')
                    .attr("r", 3)
                    .style("opacity", 0.5)
                    .attr("cx", function(d) { return xScale2(d.sampleDate); })
                    .attr("cy", function(d) { return yScale2(d.result); });
            */

        } // drawGraph()

    } // processData()

showSidebar();
setTimeout(function() {
    map.invalidateSize(true);
}, 100); 

} // createChart()





/*
/ Global Listeners
*/

$("#about-btn").click(function() {
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

// listeners for toggling layers
$("#sites-box").click( function() {
    toggleLayer(siteLayer);
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
    var filterMenu = '<div id="filter-menu"><div class="form-check"><label><input id="filter-result" value="data" class="form-check-input" type="checkbox" checked>&nbsp;Sample data&nbsp;&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i></label></div><div class="form-check"><label><input id="filter-geomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;Geometric mean&nbsp;&nbsp;<i class="fa fa-circle gm-dot" aria-hidden="true"></i></label></div></div>';
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

function createURL(resource, site) {
    var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    if (typeof site === 'undefined') {
        return url;
    } else {
        // optional site parameter
        return url + '&filters[StationCode]=' + site;
    }
}

function getData(url, callback) {
    $.ajax({
        type: "GET",
        url: url,
        jsonpCallback: callback.name,
        dataType: "jsonp",
        success: function(res) {
            var records = res.result.records;
            callback(records);
        },
        error: function(e) {
            console.log(e);
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

function hideLoading() {
    $(".background-mask").hide();
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
    var featureContent = '<div id="popup-menu"><div id="analyte-container"></div><div id="filter-container"></div></div>' + '<div id="chart-container"></div><div class="date-panel"></div><div id="scale-container"></div>';
    $("#feature-info").html(featureContent);
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

function showLoading() {
    $(".background-mask").show();
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
    var zoomControl = L.control.zoom({ position:'bottomleft' }).addTo(map);
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
            return L.circleMarker(latlng, siteMarker);
        }
    }).addTo(map);

    // request sites from API and process data
    var sites = createURL('02e59b14-99e9-489f-bc62-987108bc8e27');
    getData(sites, processSites); 

    // add listener
    siteLayer.on('click', function(e) {
        $("#feature-title").html(e.layer.feature.properties.StationName + "<p>Station Code: " + e.layer.feature.properties.StationCode + "</p>");
        setTimeout(function() {
            hideSidebarControl();
        }, 400);
        // reset layer style to clear site selection
        siteLayer.setStyle(siteMarker);
        onMarkerClick(e);
    });

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
                site.type = "Feature";
                site.geometry = {"type": "Point", "coordinates": [data[i].Longitude, data[i].Latitude]};
                site.properties = { "StationName": data[i].StationName, "StationCode": data[i].SiteCode };
                features.push(site);
                }
            }
        }
        siteLayer.addData(features);
        setTimeout(function() {
            $(".background-mask").hide();  
        }, 1000);
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

function highlightMarker(e) {
    e.layer.options.color = "#00e5ee";
    e.layer.options.fillColor = "#00e5ee";
    e.layer.options.weight = 3;
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
    var resultContent = 'Program: ' + d.Program + '<br>Analyte: ' + d.Analyte + '<br>Date: ' + tooltipDate(d.sampledate) + '<br>Result: ' + d.result + ' ' + d.Unit;
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