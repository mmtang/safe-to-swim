var map = L.map('map',{ 
    center: [37.4050, -119.4179], 
    zoom: 6, 
    preferCanvas: true,
    zoomControl: false,
    doubleClickZoom: false
}); 

resetMenu(); 

// initialize tile layers
var Esri_WorldTopoMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'}).addTo(map);

var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'});

// create custom map pane for reference layers
map.createPane('refPane');
// set z-index of reference pane 
// below overlay pane (z-index: 400) and over tile pane (z-index: 200)
map.getPane('refPane').style.zIndex = 350;

// initialize reference layers
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

// initialize map control
var showSidebarMapControl = L.Control.extend({
    options: { position: 'topright'
    },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'sidebar-control-container');
        container.innerHTML = '<div id="sidebar-control"><a href="#" id="sidebar-show-btn" onClick="showSidebar()"><button type="button" class="btn btn-xs btn-default pull-left" id="sidebar-show-btn"><i class="fa fa-chevron-left fa"></i></button></a></div>';
        return container;
    }
});

// add map controls
var zoomControl = L.control.zoom({ position:'bottomleft' }).addTo(map);
map.addControl(new showSidebarMapControl());

// define default style for map markers
var siteMarker = {
    radius: 5,
    fillColor: "#008080",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

// add site layer
var siteLayer = L.geoJson([], {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, siteMarker);
    }
}).addTo(map);


var isSidebarOpen = false;

// define API request limit
var recordLimit = 5000;

function createURL(resource, site) {
    var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    if (typeof site === 'undefined') {
        return url;
    } else {
        return url + '&filters[StationCode]=' + site;
    }
}

var siteDataURL = createURL('ffdbb549-5bb9-4d07-92a4-7fb3f4eb42e6');

// API request for site data
getData(siteDataURL, processSites, 'processSites');

function getData(url, callback, callbackText, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }

    var request = $.ajax({
        url: url,
        data: {offset: offset},
        dataType: "jsonp",
        jsonpCallback: callbackText,
    });

    request.done(function(res) {
        var dataPage = res.result.records;
        data = data.concat(dataPage);
        if (dataPage.length <= recordLimit) {
            callback(data);
        } else {
            getData(url, callback, callbackText, offset + recordLimit, data);
        }
    });

    request.fail(function(res) {
        console.log(res);
    });
}

function processSites(data) {
    features = [];
    for (var i = 0; i < data.length; i++) {
        var site = {};
        // check for missing properties
        if (!(data[i].Longitude) || !(data[i].Latitude) || !(data[i].StationName) || !(data[i].SiteCode)) { 
            continue; 
        } else {
            site.type = "Feature";
            site.geometry = {"type": "Point", "coordinates": [data[i].Longitude, data[i].Latitude]};
            site.properties = { "StationName": data[i].StationName, "StationCode": data[i].SiteCode };
            features.push(site);
        }
    }
    siteLayer.addData(features);
    $(".background-mask").hide();  
}

function toggleLayer(layer, customPane) { 
    if (map.hasLayer(layer)) {
        map.removeLayer(layer);
    } else {
        map.addLayer(layer);
    }
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

siteLayer.on('click', function(e) {

    clearGraph();
    $("#feature-title").html(e.layer.feature.properties.StationName + "<p>Station Code: " + e.layer.feature.properties.StationCode + "</p>");
    showSidebar();
    setTimeout(function() {
        changeMapView(e);
    }, 350);
    onMarkerClick(e);
});

function changeMapView(e) {
    hideSidebarControl();
    var currentZoom = map.getZoom();
    if (currentZoom > 12) { 
        var targetZoom = currentZoom;  // preserve current zoom 
    } else {
        targetZoom = 12;
    }
    map.setView(e.latlng, targetZoom, { animation: true });  
}

function onMarkerClick(e) {
    var siteClicked = e.layer.feature.properties.StationCode;
    // reset layer style
    siteLayer.setStyle(siteMarker);
    highlightMarker(e);

    function highlightMarker(e) {
        e.layer.options.color = "#00e5ee";
        e.layer.options.fillColor = "#00e5ee";
        e.layer.options.weight = 3;
    }

    var featureContent = '<div id="popupMenu"><div id="analyteContainer"></div><div id="filterContainer"></div></div>' + '<div id="siteGraph"><svg width="862" height="390"></div><div class="panel-date"></div>';
    $("#feature-info").html(featureContent);
    $("#featureModal").modal("show");
    // $(".background-mask").show();

    var trendDataURL = createURL('92efe9a2-075c-419d-8305-3184cc5e55ef', siteClicked);
    console.log("trendData:", trendDataURL);

    // ***** currently not returning the full dataset *****
    // request trend data
    getData(trendDataURL, createViz, 'createViz');

    function createViz(data) {
            var ecoli = "E. coli",
                enterococcus = "Enterococcus",
                coliformtotal = "Coliform, Total",
                coliformfecal = "Coliform, Fecal";    
    
            var ecoli_STV = 320,
                enterococcus_STV = 110,
                ecoli_GM = 100,
                enterococcus_GM = 30;

            $(".background-mask").hide(); 
            var Data = processData(data);

            function processData(data) {
                var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
                var indicatorSet = new Set(); 

                data.forEach(function(d) {
                    d.sampleDate = parseDate(d.SampleDate);
                    d.result = +d.Result;
                    d.analyte = d.Analyte;
                    d.resultqualcode = d.ResultQualCode;
                    d.mdl = +d.MDL;
                    indicatorSet.add(d.analyte);
                });

                // convert set object to regular object
                // changed for IE 11
                var indicators = [];
                indicatorSet.forEach(function(i) {
                    indicators.push(i);
                }); 
                var defaultAnalyte = indicators[0];

                // clear analyte menu
                $('#analyteMenu').empty();

                if (indicators.length > 0) {
                    // initialize analyte menu
                    var analyteMenu = document.createElement("select");
                    analyteMenu.id = "analyteMenu";
                    analyteMenu.className = "form-control input-sm";
                    analyteMenu.innerHTML = "";
                    // populate analyte menu
                    for (var i = 0; i < indicators.length; i++) {
                        var opt = indicators[i];
                        analyteMenu.innerHTML += "<option value=\"" + opt + "\">" + opt + "</option>";
                    }
                    var analyteContainer = document.getElementById("analyteContainer");
                    analyteContainer.appendChild(analyteMenu);
                    // create filter menu
                    var filterContainer = document.getElementById("filterContainer");
                    var filterMenu = '<div id="filterMenu"><div class="form-check"><label><input id="filterResult" value="data" class="form-check-input" type="checkbox" checked>&nbsp;Sample data&nbsp;&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i></label></div><div class="form-check"><label><input id="filterGeomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;Geometric mean&nbsp;&nbsp;<i class="fa fa-circle gm-dot" aria-hidden="true"></i></label></div></div>';
                    filterContainer.innerHTML += filterMenu;

                    drawGraph(defaultAnalyte);

                } else {
                    alert("No data for this site.");
                }

                // listener for analyte change
                $("#analyteMenu").on("change", function() {
                    drawGraph(this.value);
                });

                function drawGraph(analyte) {
                    $(".panel-date").empty();
                    $(".panel-date").append('Drag the handles of the gray box above to change the date view.<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span></p>');
                    clearGraph(); 
                    resetCheckboxes();

                    var graphData = data.filter(function(data) { 
                        if ((data.StationCode === siteClicked) && (data.analyte === analyte)) { return data; }
                    });
                    graphData = graphData.sort(function(a, b) { return b.sampleDate - a.sampleDate });  // sort descending

                    // get reference dates
                    var lastSampleDate = graphData[0].sampleDate,
                        dataArrayLength = graphData.length,
                        earliestDate = graphData[dataArrayLength - 1].sampleDate;

                    var oneDay = (24 * 60 * 60 * 1000);
                    var SIX_WEEKS = 42;  // 6 weeks * 7 days = 42
                    
                    function getGeomeans(data, startDate, endDate, days) {
                        var geomeansArray = [];
                        var offsetValue = oneDay * days; 
                        var refDate = convertDate(startDate);
                        var stopDate = convertDate(endDate);
                        while(refDate >= stopDate) {
                            var newDate = convertUNIX(refDate);
                            geomeansArray.push(createGeomeanObject(data, newDate, days));
                            refDate -= oneDay * 7;  // offset is one week
                        }
                        return geomeansArray;

                    // calculates the geometric mean for a single 6-week date range
                    function createGeomeanObject(data, startDate, offsetDays) {

                            function getCutoffDate(date, offsetDays) {
                                var offsetDate = date.getTime() - (oneDay * offsetDays);
                                return convertUNIX(offsetDate);
                            }

                            function getSampleArray(data, startDate, cutoffDate) {
                                if (data.length === 0) {
                                    console.log("no data for geomean range");
                                    return null;
                                }
                                var dateArray = [];
                                for (var i = 0; i < data.length; i++) {
                                    var d = data[i];
                                    if ((convertDate(d.sampleDate) <= convertDate(startDate)) && (convertDate(d.sampleDate) >= convertDate(cutoffDate))) {
                                        if (checkND(d)) {
                                            dateArray.push(d); 
                                        }
                                    }
                                };
                                return dateArray;
                            }

                            // checks whether result is a valid ND (res qual code = "ND" and result is positive)
                            function checkND(d) {
                                if ((d.resultqualcode === "ND") && (d.result > 0)) {
                                    return false; 
                                } else if ((d.resultqualcode === "P") && !(d.result)) {
                                    return false;
                                } else {
                                    return true;
                                }
                            }

                            // checks whether record has a data quality score of 1-3
                            function checkQuality(d) {
                                if ((d.DataQuality === 0) || (d.DataQuality === 4) || (d.DataQuality === 5)) {
                                    return false;
                                } else {
                                    return true;
                                }
                            }

                            function gmean(data) {
                                if (!(data)) { 
                                    throw new TypeError('gmean()::empty input argument');
                                }
                                if (!(data.length)) {
                                    return null; 
                                } else {
                                    var product = 1;
                                    data.forEach(function(d) {
                                        if (checkND(d) && (d.mdl > 0)) {
                                            product *= d.mdl * 0.5;     // substitute NDs with half of MDL
                                        } else {
                                            product *= d.result;    
                                        }
                                    });
                                    return Math.pow(product, (1 / data.length));  // nth root
                                }
                            }

                            var cutoffDate = getCutoffDate(startDate, offsetDays);
                            var geomeanData = getSampleArray(data, startDate, cutoffDate);

                            // Assemble geomean object for single 6-week range
                            if (geomeanData.length < 1) { 
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: null}; // no data
                            } else if (geomeanData.length < 5) {
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: "NES"}; // not enough samples
                            } else {
                                var geomean = decimalRound(gmean(geomeanData), 2);
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: geomean};
                            }
                            return geomeanObject;
                    
                    } // getGeomeanObject()
                    }
                    
                    // Compile array of geomean objects
                    geomeanObjects = getGeomeans(graphData, lastSampleDate, earliestDate, SIX_WEEKS); 
                    endPoint = geomeanObjects[geomeanObjects.length - 1];

                    // Create endpoint geomean object
                    geomeanObjects.push({beginDate: null, endDate: earliestDate, geomean: endPoint.geomean});

                    // initialize graph tooltip
                    var tooltipD = d3.select("body").append("div")
                        .attr("class", "tooltip")
                        .attr("id", "tooltipD")
                        .style("opacity", 0);

                    // initialize geomean tooltip
                    var tooltipG = d3.select("body").append("div")
                        .attr("class", "tooltip")
                        .attr("id", "tooltipG")
                        .style("opacity", 0);

                    var margin = {top: 10, right: 20, bottom: 90, left: 50},
                        margin2 = {top: 340, right: 20, bottom: 10, left: 50},
                        width = 862 - margin.left - margin.right,
                        height = 390 - margin.top - margin.bottom,
                        height2 = 370 - margin2.top - margin2.bottom;
                    
                    var xScale = d3.scaleTime().range([0, width]),
                        xScale2 = d3.scaleTime().range([0, width]),
                        yScale = d3.scaleLinear().range([height, 0]),
                        yScale2 = d3.scaleLinear().range([height2, 0]);
                
                    var svg = d3.select("#siteGraph")
                        .select("svg")
                            .attr("width", width + margin.left + margin.right)
                            .attr("height", height + margin.top + margin.bottom)
                            .attr("class", "graph")
                            .call(responsive);
                    
                    function responsive(svg) {
                        // get container + svg aspect ratio
                        var container = d3.select(svg.node().parentNode),
                            width = parseInt(svg.style("width")),
                            height = parseInt(svg.style("height")),
                            aspect = width / height;

                        // add viewBox and preserveAspectRatio properties,
                        // and call resize so that svg resizes on inital page load
                        svg.attr("viewBox", "0 0 " + width + " " + height)
                            .attr("perserveAspectRatio", "xMinYMid")
                            .call(resize);

                        // to register multiple listeners for same event type, 
-                       // you need to add namespace, i.e., 'click.foo'
-                       // necessary if you call invoke this function for multiple svgs
-                       // api docs: https://github.com/mbostock/d3/wiki/Selections#on
                        d3.select(window).on("resize." + container.attr("id"), resize);

                        // get width of container and resize svg to fit it
                        function resize() {
                            var targetWidth = parseInt(container.style("width"));
                            svg.attr("width", targetWidth);
                            svg.attr("height", Math.round(targetWidth / aspect));
                        }
                    } 
                        
                    var focus = svg.append("g")
                        .attr("class", "focus")
                        .attr("transform", "translate(" + margin.left + "," + (margin.top + 10) + ")");
                    
                    var context = svg.append("g")
                        .attr("class", "context")
                        .attr("transform", "translate(" + margin2.left + "," + (margin2.top + 10) + ")");

                    context.append("defs").append("clipPath")
                                .attr("id", "clip")
                                .attr("fill", gColor)
                            .append("rect")
                                .attr("width", width)
                                .attr("height", height);

                    
                    var currentExtent = d3.extent(graphData, function(d) { return d.sampleDate; });  // find extent for x-axis
                    var xBufferExtent = bufferExtent(currentExtent, 35);  // buffer x-axis extent so points at end are not cut off
                    var yMax = d3.max(graphData, function(d) { return d.result });  // find max Y data point 
                    var displayY = compareThresholds(yMax);  // compare threshold values to find max Y for display

                    xScale.domain(xBufferExtent);
                    yScale.domain([0, Math.ceil(roundHundred(displayY + (displayY / 3)))]);  // add buffer to top
                    xScale2.domain(xScale.domain());
                    yScale2.domain(yScale.domain());

                    var yAxis = d3.axisLeft(yScale)
                        .tickSize(0)
                        .tickPadding(10);
                    var xAxis = d3.axisBottom(xScale)
                        .tickSize(0)
                        .tickPadding(10);
                    var xAxis2 = d3.axisBottom(xScale2)
                        .tickSizeOuter(0);
                    var xgAxis = d3.axisBottom(xScale)
                        .tickSize(-height);
                    var ygAxis = d3.axisLeft(yScale)
                        .tickSize(-width);

                    var brush = d3.brushX()
                        .extent([[0, 0], [width, height2]])
                        .on("brush", brushed)
                        .on('end', function() {
                            var s = d3.event.selection;
                        });
                    
                    // x-axis grid
                    focus.append("g")
                        .attr("class", "axis grid")
                        .call(ygAxis);

                    focus.append("g")
                        .attr("class", "xAxis")
                        .attr("transform", "translate(0," + height + ")")
                        .call(xAxis);
                        
                    focus.append("g")
                        .attr("class", "yAxis")
                        .call(yAxis);

                    var gColor = "#ED6874";  // color for geomean elements
                    var gCircleOpacity = 1;
                    var circleOpacity = 0.7;
                    var tooltipOpacity = 1;
                    var lineOpacity = 1;

                    // draw stv threshold line
                    switch (analyte) {
                        case ecoli:
                            var geomeanThreshold = focus.append('line')
                                .attr("class", "line")
                                .style('stroke', "rgb(51, 91, 150)")
                                .style('stroke-width', 2)
                                .style('opacity', lineOpacity)
                                .attr('x1', 0)
                                .attr('y1', yScale(ecoli_STV))
                                .attr('x2', width)
                                .attr('y2', yScale(ecoli_STV));
                            focus.append("text")
                                .attr("transform", "translate(" + (width - 100) + "," + (yScale(ecoli_STV) - 10) + ")")
                                .attr("dy", ".35em")
                                .attr("class","stvLineLabel")
                                .attr("id", "stvLineLabel")
                                .attr("text-anchor", "start")
                                .style("fill", "rgb(51, 91, 150)")
                                .text("STV: " + ecoli_STV + " cfu/100 mL");
                            break;
                        case enterococcus:
                            var geomeanThreshold = focus.append('line')
                                .attr("class", "line")
                                .style('stroke', "rgb(51, 91, 150)")
                                .style('stroke-width', 2)
                                .style('opacity', lineOpacity)
                                .attr('x1', 0)
                                .attr('y1', yScale(enterococcus_STV))
                                .attr('x2', width)
                                .attr('y2', yScale(enterococcus_STV));
                            focus.append("text")
                                .attr("transform", "translate(" + (width - 100) + "," + (yScale(enterococcus_STV) - 10) + ")")
                                .attr("dy", ".35em")
                                .attr("class","stvLineLabel")
                                .attr("id", "stvLineLabel")
                                .attr("text-anchor", "start")
                                .style("fill", "rgb(51, 91, 150)")
                                .text("STV: " + enterococcus_STV + " cfu/100 mL");
                            break;
                    }

                    // draw gm threshold line
                    switch (analyte) {
                        case ecoli:
                            var stvThreshold = focus.append('line')
                                .attr("class", "line")
                                .style('stroke', gColor)
                                .style('stroke-width', 2)
                                .style('opacity', lineOpacity)
                                .attr('x1', 0)
                                .attr('y1', yScale(ecoli_GM))
                                .attr('x2', width)
                                .attr('y2', yScale(ecoli_GM));
                            focus.append("text")
                                .attr("transform", "translate(" + (width - 91) + "," + (yScale(ecoli_GM) - 10) + ")")
                                .attr("dy", ".35em")
                                .attr("class","gmLineLabel")
                                .attr("id", "gmLineLabel")
                                .attr("text-anchor", "start")
                                .style("fill", gColor)
                                .text("GM: " + ecoli_GM + " cfu/100 mL");
                            break;
                        case enterococcus:
                            var stvThreshold = focus.append('line')
                                .attr("class", "line")
                                .style('stroke', gColor)
                                .style('stroke-width', 2)
                                .style('opacity', lineOpacity)
                                .attr('x1', 0)
                                .attr('y1', yScale(enterococcus_GM))
                                .attr('x2', width)
                                .attr('y2', yScale(enterococcus_GM));
                            focus.append("text")
                                .attr("transform", "translate(" + (width - 91) + "," + (yScale(enterococcus_GM) - 10) + ")")
                                .attr("dy", ".35em")
                                .attr("class","gmLineLabel")
                                .attr("id", "gmLineLabel")
                                .attr("text-anchor", "start")
                                .style("fill", gColor)
                                .text("GM: " + enterococcus_GM + " cfu/100 mL");
                            break;
                    }

                    // move line labels if overlapping
                    if ((analyte === enterococcus) || (analyte === ecoli)) {

                        var gThresholdLabel = document.getElementById("gmLineLabel"),
                            stvThresholdLabel = document.getElementById("stvLineLabel");
                        
                        if (intersect(gThresholdLabel, stvThresholdLabel)) {
                            d3.select("#stvLineLabel").attr("dy", "-8");;
                        }
                    }

                    function getPositions(elem) {
                        var clientRect = elem.getBoundingClientRect();
                        return [
                            [ clientRect.left, clientRect.left + clientRect.width ],
                            [ clientRect.top, clientRect.top + clientRect.height ]
                        ];
                    }

                    function intersect(elemA, elemB) {
                        var posA = getPositions(elemA),
                            posB = getPositions(elemB),
                            isOverlap = false;

                        if (posA[0][0] < posB[0][1] && posA[0][1] > posB[0][0] &&
                            posA[1][0] < posB[1][1] && posA[1][1] > posB[1][0])
                            isOverlap = true;

                        return isOverlap;
                    }

                    // add data to main chart
                    var results = focus.append("g");
                        results.attr("clip-path", "url(#clip)");
                        results.selectAll("circle")
                            .data(graphData)
                            .enter().append("circle")
                            .attr('class', 'circles')
                            .attr("r", 6)
                            .attr("fill", "rgb(51, 91, 150)")
                            .attr("cx", function(d) { return xScale(d.sampleDate); })
                            .attr("cy", function(d) { return yScale(d.result); })
                            .style("opacity", circleOpacity)
                            .on("mouseover", function(d) {
                                var tooltipDate = d3.timeFormat("%b %e, %Y");  // format date value for tooltip
                                tooltipA.transition()
                                    .duration(100)
                                    .style("opacity", tooltipOpacity);
                                tooltipA.html("Sample Date: " + tooltipDate(d.sampleDate) + "<br/ >" + "Program: " + d.Program + "<br/ >" + "Result: " + d.result + " " + d.Unit)
                                    .style("left", function() {
                                        var windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                                        var widthThreshold = windowWidth * 0.75;
                                        var tooltipWidth = document.getElementById("tooltipD").offsetWidth;
                                        // checks for points positioned in second half of graph and moves the tooltip left
                                        return d3.select(this).attr("cx") + "px";
                                    })
                                    .style("top", function() {
                                        var divOffset = document.getElementById("siteGraph").offsetHeight;
                                        var relativePos = divOffset - d3.event.pageY;
                                        var tooltipHeight = document.getElementById("tooltipD").offsetHeight;
                                        return d3.select(this).attr("cy") + "px";
                                    });
                                d3.select(this)
                                    .attr("fill", "#84c0e3");

                            })
                            .on("mouseout", function(d) {
                                tooltipA.transition()
                                    .duration(100)
                                    .style("opacity", 0);
                                d3.select(this)
                                    .attr("fill", "rgb(51, 91, 150)")
                                    .style("opacity", circleOpacity);
                            });

                    // add geomean to main chart
                    var geomeans = focus.append("g");
                        geomeans.attr("clip-path", "url(#clip)");
                        geomeans.selectAll("circle")
                            .data(geomeanObjects)
                            .enter().append("circle")
                            .filter(function(d) { return (d.geomean !== null) && (d.geomean != "NES") })  // strict not version for null
                            .attr('class', 'gCircles')
                            .attr("r", 4)
                            .attr("fill", gColor)
                            .attr("cx", function(d) { return xScale(d.endDate); })
                            .attr("cy", function(d) { return yScale(d.geomean); })
                            .style("opacity", gCircleOpacity)
                            .on("mouseover", function(d) {
                                var tooltipDate = d3.timeFormat("%b %e, %Y");  // format date value for tooltip
                                tooltipG.transition()
                                    .duration(50)
                                    .style("opacity", tooltipOpacity);
                                tooltipG.html("Date: " + tooltipDate(d.endDate) + "<br/ >Geometric Mean: " + d.geomean)
                                    .style("left", function() {
                                        var windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                                        var widthThreshold = windowWidth * 0.75;
                                        var tooltipWidth = document.getElementById("tooltipG").offsetWidth;
                                        // checks for points positioned in second half of graph and moves the tooltip left
                                        if (d3.event.pageX > widthThreshold) {
                                            return d3.event.pageX - tooltipWidth + "px";
                                        } else {
                                            return d3.event.pageX + "px";
                                        }
                                    })
                                    .style("top", function() {
                                        var divOffset = document.getElementById("siteGraph").offsetHeight;
                                        var relativePos = divOffset - d3.event.pageY;
                                        var tooltipHeight = document.getElementById("tooltipG").offsetHeight;
                                        if (relativePos > 0) {
                                            return d3.event.pageY + "px";
                                        } else {
                                            return d3.event.pageY - tooltipHeight + "px";
                                        }
                                    });
                                d3.select(this)
                                    .attr("fill", "#f2afa4");
                            })
                            .on("mouseout", function(d) {
                                tooltipG.transition()
                                    .duration(50)
                                    .style("opacity", 0);
                                d3.select(this)
                                    .attr("fill", gColor)
                                    .style("opacity", gCircleOpacity);
                            });


                    context.append("g")
                        .attr("class", "xAxis2")
                        .attr("transform", "translate(0," + height2 + ")")
                        .call(xAxis2);
                    
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
                                                                
                    context.append("g")
                        .attr("class", "brush")
                        .call(brush)
                        .call(brush.move, xScale.range());

                    // filter listeners
                    d3.select("#filterResult").on("change", toggleResult);
                    d3.select("#filterGeomean").on("change", toggleGeomean);

                    function toggleResult() {
                        if(d3.select(this).property("checked")){
                            d3.selectAll(".circles").attr("visibility", "visible");
                        } else {
                            d3.selectAll(".circles").attr("visibility", "hidden");
                        }			
                    }

                    function toggleGeomean() {
                        if(d3.select(this).property("checked")){
                            d3.selectAll(".gCircles").attr("visibility", "visible");
                        } else {
                            d3.selectAll(".gCircles").attr("visibility", "hidden");
                        }			
                    }

                    function brushed() {
                        // save brush start and end values
                        var extent = d3.event.selection || xScale2.range();
                        var brushWidth = extent[1] - extent[0];

                        // update date placeholders
                        var formatDate = d3.timeFormat("%b %e, %Y");
                        $(".js-start-date").text(formatDate(xScale2.invert(extent[0])));
                        $(".js-end-date").text(formatDate(xScale2.invert(extent[1])));

                        // manage on-screen graph elements when brush is dragged outside extent
                        if ((brushWidth === 0) || (extent[0] >= width)) { 
                            focus.selectAll(".circles")
                                .style("opacity", 0);
                            focus.selectAll(".gCircles")
                                .style("opacity", 0);
                            focus.selectAll(".line")
                                .style("opacity", 0);
                            focus.selectAll(".graphLabel")
                                .style("opacity", 0);
                        } else {
                            focus.selectAll(".circles")
                                .style("opacity", circleOpacity);
                            focus.selectAll(".gCircles")
                                .style("opacity", gCircleOpacity);
                            focus.selectAll(".line")
                                .style("opacity", lineOpacity);
                            focus.selectAll(".graphLabel")
                                .style("opacity", lineOpacity);
                        }

                        xScale.domain(extent.map(xScale2.invert, xScale2));
                        focus.selectAll(".circles")
                                .attr("cx", function(d) { return xScale(d.sampleDate); })
                                .attr("cy", function(d) { return yScale(d.result); });
                        focus.selectAll(".gCircles")
                                .attr("cx", function(d) { return xScale(d.endDate); })
                                .attr("cy", function(d) { return yScale(d.geomean); });
                        focus.select(".xAxis").call(xAxis);
                    }

                    function bufferExtent(extent, days) {
                        // pad min
                        var extentMin = convertDate(extent[0]);
                        var newExtentMin = extentMin - (oneDay * days); 
                        newExtentMin = convertUNIX(newExtentMin);
                        // pad max
                        var extentMax = convertDate(extent[1]);
                        var newExtentMax = extentMax + (oneDay * days);
                        newExtentMax = convertUNIX(newExtentMax);
                        newExtentObject = [newExtentMin, newExtentMax]; 
                        return newExtentObject;
                    }

                    function compareThresholds(y) {
                        var maxThreshold;
                        // only compare STV because STV > GM
                        // to-do: completely redo this
                        if (analyte === ecoli) {
                            if (y < ecoli_STV) {
                                maxThreshold = ecoli_STV;
                            } else if (y > ecoli_STV) {
                                maxThreshold = y;
                            } else {
                                maxThreshold = ecoli_STV
                            }
                        } else if (analyte === enterococcus) {
                            if (y < enterococcus_STV) {
                                maxThreshold = enterococcus_STV;
                            } else if (y > enterococcus_STV) {
                                maxThreshold = y;
                            } else {
                                maxThreshold = enterococcus_STV;
                            }
                        } else {
                            return y;
                        }
                        return maxThreshold; 
                    }

                    function resetCheckboxes() {
                        document.getElementById("filterResult").checked="true";
                        document.getElementById("filterGeomean").checked="true";
                    }

                } // drawGraph()

            } // processData()

    } // createViz()

} // onMarkerClick()

function showSidebar() {
    var windowWidth = getWidth();
    if (windowWidth <= 767) {  // base mobile layout max width = 767 px
        document.getElementById('mobile-menu-btn').style.display = 'none';
        document.getElementById('mobile-close-btn').style.display = 'inline';
        var animationTime = 0;
    } else {
        var animationTime = 200;
    }
    $("#sidebar").show(animationTime, function() {
        setTimeout(function() {
            map.invalidateSize()
        }, 200); 
    });
    hideSidebarControl();
}

function hideSidebar() {
    isSidebarOpen = false;
    var windowWidth = getWidth();
    if (windowWidth <= 767) {  // base mobile layout max width = 767 px
        document.getElementById('mobile-menu-btn').style.display = 'inline';
        document.getElementById('mobile-close-btn').style.display = 'none';
        var animationTime = 0;
    } else {
        var animationTime = 200;
    }
    $("#sidebar").hide(animationTime, function() {
        setTimeout(function() {
            map.invalidateSize()
        }, 200); 
    });
    showSidebarControl();
}

function showSidebarControl() {
    document.getElementById("sidebar-control").style.display = "block";
}

function hideSidebarControl() {
    document.getElementById("sidebar-control").style.display = "none";
}

// listeners for sidebar actions
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

$("#counties-box").click( function() {
    toggleLayer(countyLayer);
});

$("#rb-boundaries-box").click( function() {
    toggleLayer(rbLayer);
});

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

function resetMenu() {
    document.getElementById("topo-tile-radio").checked="true";
    document.getElementById("sites-box").checked="true";
    document.getElementById("counties-box").checked="";
    document.getElementById("rb-boundaries-box").checked="";
}

function clearGraph() {
    var svg = d3.select("svg");
    svg.selectAll("*").remove();
}

function decimalRound(x, n) {
    if (x === null) { return null; }
    return x.toFixed(n);
}

function roundHundred(value) {
    return (value / 100) * 100
}

// convert to UNIX time
function convertDate(date) {
    return date.getTime();
}

// convert to Javascript date
function convertUNIX(seconds) {
    return new Date(seconds);
}