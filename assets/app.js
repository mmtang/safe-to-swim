var map = L.map('map',{ 
    center: [37.4050, -119.4179], 
    zoom: 6, 
    preferCanvas: true,
    zoomControl: false
}); 

/* For main loading animation
$(document).one("ajaxStop", function () {
    $("#loading").hide();
    sizeLayerControl();
});
*/

$("#pluswrap").hide();  // Hide loader animation

$("#about-btn").click(function() {
    $("#aboutModal").modal("show");
    $(".navbar-collapse.in").collapse("hide");
    return false;
});

$("#nav-btn").click(function() {
    $(".navbar-collapse").collapse("toggle");
    return false;
});

$("#sidebar-toggle-btn").click(function() {
    animateSidebar();
    return false;
});

$("#sidebar-hide-btn").click(function() {
    animateSidebar();
    return false;
});

function animateSidebar() {
    $("#sidebar").animate({
        width: "toggle"
    }, 250, function() {
        map.invalidateSize();
        showSidebarControl();
    });
}

function showSidebar() {
    hideSidebarControl();
    $("#sidebar").show(250, function() {
        map.invalidateSize();
    });
}

function showSidebarControl() {
    document.getElementById("sidebar-control").style.display = "block";
}

function hideSidebarControl() {
    document.getElementById("sidebar-control").style.display = "none";
}

var ecoli = "E. coli",
    enterococcus = "Enterococcus",
    coliformtotal = "Coliform, Total",
    coliformfecal = "Coliform, Fecal";    

var ecoli_STV = 320,
    enterococcus_STV = 110,
    ecoli_GM = 100,
    enterococcus_GM = 30;

var Esri_WorldTopoMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
attribution: 'Tiles &copy; Esri'
}).addTo(map);

var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
attribution: 'Tiles &copy; Esri'
});

var baseLayers = {
    "Topo": Esri_WorldTopoMap,
    "World Imagery": Esri_WorldImagery
    };

var zoomControl = L.control.zoom({ position:'topleft' }).addTo(map);

var layerControl = L.control.layers(baseLayers, null, {collapsed: true, position: 'bottomleft'}).addTo(map);

var sidebarControl = L.Control.extend({
        options: {
            position: 'topright'
        },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'sidebar-control-container');
        container.innerHTML = '<div id="sidebar-control"><a href="#" id="sidebar-show-btn" onClick="showSidebar()"><button type="button" class="btn btn-xs btn-default pull-left" id="sidebar-show-btn"><i class="fa fa-chevron-left fa-lg"></i></button></a></div>';
        return container;
    }
});

map.addControl(new sidebarControl());

var defaultMarker = {
    radius: 5,
    fillColor: "#008080",
    color: "#fff",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

var siteLayer = L.geoJSON(null, {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, defaultMarker);
    },
    onEachFeature: function (feature, layer) {
            if (feature.properties) {
                layer.on({
                    click: function (e) {
                        $("#feature-title").html(feature.properties.StationName + "<p>Station Code: " + feature.properties.StationCode + "</p>");
                    }
                })
            }
    } 
}).addTo(map); 

// Load site data
omnivore.csv('input/UniqueStations.csv', null, siteLayer).addTo(map);

siteLayer.on('click', function(e) {
    clearGraph(); 
    hideSidebarControl();
    var currentZoom = map.getZoom();
    if (currentZoom > 12) { 
        var targetZoom = currentZoom;   // Preserve current zoom 
    } else {
        targetZoom = 12;
    }
    map.setView(e.latlng, targetZoom, { animation: true });  
    $("#sidebar").show(250, function() {
        map.invalidateSize(); 
        onMarkerClick(e);
    });
});

function onMarkerClick(e) {

    var siteClicked = e.layer.feature.properties.StationCode;

    // Reset layer style
    siteLayer.setStyle(defaultMarker);
    console.log(e, siteClicked);

    highlightMarker(e);

    function highlightMarker(e) {
        e.layer.options.color = "#00e5ee";
        e.layer.options.fillColor = "#00e5ee";
        e.layer.options.weight = 3;
    }

    var content = '<div id="popupMenu"><div id="analyteMenu"></div><div id="filterMenu"></div></div>' + '<div id="siteGraph"><svg width="862" height="390"></div>';
    $("#feature-info").html(content);
    $("#featureModal").modal("show");
    $("#pluswrap").show();

    function createURL(limit) {
        var baseURL = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=7fe7df64-16b5-4866-b34f-1870a94ee607';
        return baseURL + '&limit=' + limit + '&filters[StationCode]=' + siteClicked; ;
    }

    var initialURL = createURL(100);
    console.log("initialURL:", initialURL);


    /*************************************/
    /*** Synchronus Recursive API Call ***/
    /*************************************/

    getRecords(createViz);

    function getRecords(callback, offset, data) {
        if (typeof offset === 'undefined') { offset = 0; }
        if (typeof data === 'undefined') { data = []; }

        $.ajax({
            type: "GET",
            url: initialURL,
            data: {offset: offset},
            dataType: "jsonp",
            jsonpCallback: 'createViz',
            success: function(res) {
                var dataPage = res.result.records;
                console.log("total records:", res.result.total); 
                data = data.concat(dataPage);
                if (dataPage.length < 100) {
                    console.log("called data", data);
                    callback(data);
                } else {
                    getRecords(callback, offset + 100, data);
                }
            }
        });
    }
    
    /*************************************/
    /*************************************/

    // Get data and draw graph
    function createViz(data) {

            $("#pluswrap").hide();      // Hide loader animation

            var Data = processData(data);

            function processData(d) {

                var data = d;
                // For JSONP API. Parse dates formatted as "2017-09-31 00:00:00"
                var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
                // For JSON local file. Parse dates formattted as "09/14/2012 0:00"
                //  var parseDate = d3.timeParse("%m/%d/%Y %H:%M:%S")

                var indicatorSet = new Set(); 

                data.forEach(function(d) {
                    d.sampleDate = parseDate(d.SampleDate);
                    d.result = +d.Result;
                    d.analyte = d.Analyte;
                    indicatorSet.add(d.analyte);
                    d.resultqualcode = d.ResultQualCode;
                    d.mdl = +d.MDL;
                });

                // Compatible with IE
                var indicators = [];
                indicatorSet.forEach(function(v) {
                    indicators.push(v);
                });
                
                var defaultAnalyte = indicators[0];
                console.log("indicators", indicators); 

                d3.select("#analyteSelect").remove();

                // Create sidebar menus
                if (indicators.length > 0) {
                    // Create analyte menu
                    var analyteSelect = document.createElement("select");
                    analyteSelect.id = "analyteSelect";
                    analyteSelect.className = "form-control input-sm";
                    analyteSelect.innerHTML = "";
                    for (var i = 0; i < indicators.length; i++) {
                        var opt = indicators[i];
                        analyteSelect.innerHTML += "<option value=\"" + opt + "\">" + opt + "</option>";
                    }
                    var selectDiv = document.getElementById("analyteMenu");
                    selectDiv.appendChild(analyteSelect);

                    // Create filter menu
                    var filterSpace = document.getElementById("filterMenu");
                    var filterContent = '<div id="filterMenu"><div class="form-check"><label><input id="filterData" value="data" class="form-check-input" type="checkbox" checked>&nbsp;Sample data&nbsp;&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i></label></div><div class="form-check"><label><input id="filterGeomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;Geometric mean&nbsp;&nbsp;<i class="fa fa-circle gMean-dot" aria-hidden="true"></i></label></div></div>';
                    filterSpace.innerHTML += filterContent;

                    drawGraph(defaultAnalyte);

                } else {
                    alert("No data for this site.");
                }

                // Listen for analyte change
                d3.selectAll("select").on("change", function() {
                        drawGraph(this.value);
                });

                function drawGraph(formAnalyte) {

                    clearGraph(); 
                    resetCheckboxes();
        
                    var div = d3.select("body").append("div")
                        .attr("class", "tooltip")
                        .style("opacity", 0);

                    var newData = data.filter(function(data) { 
                        if ((data.StationCode === siteClicked) && (data.analyte === formAnalyte)) { return d; }
                    });

                    // Need to redo checks
                    if (newData.length < 1 ) { window.alert("No data for this indicator."); }

                    newData = newData.sort(function(a, b) { return b.sampleDate - a.sampleDate });  // Sort descending

                    // Get reference dates
                    var lastSampleDate = newData[0].sampleDate,
                        dataArrayLength = newData.length,
                        earliestDate = newData[dataArrayLength - 1].sampleDate;

                    var oneDay = (24 * 60 * 60 * 1000);
                    var geomeanDays = 42;   // Offset days: 6 weeks * 7 days
                    
                    function getGeomeans(data, startDate, endDate, days) {
                        var geomeansArray = [];
                        var offsetValue = oneDay * days; 
                        var refDate = convertDate(startDate);
                        var stopDate = convertDate(endDate);
                        while(refDate >= stopDate) {
                            var newDate = convertUNIX(refDate);
                            geomeansArray.push(getGeomeanObject(data, newDate, days));
                            refDate -= oneDay * 7;  // Offset is one week
                        }
                        return geomeansArray;
                    }
                    
                    // Calculates the geometric mean for a single 6-week date range
                    function getGeomeanObject(data, startDate, offsetDays) {

                            function getCutoffDate(date, offsetDays) {
                                var offsetValue = oneDay * offsetDays;  
                                var offsetDate = date.getTime() - offsetValue;
                                return convertUNIX(offsetDate);
                            }

                            function getSampleArray(data, startDate, cutoffDate) {
                                if (data.length === 0) {
                                    console.log("No data for geomean range.");
                                    return null;
                                }
                                var newData = data;
                                var dateArray = [];
                                for (var i = 0; i < newData.length; i++) {
                                    var d = newData[i];
                                    if ((convertDate(d.sampleDate) <= convertDate(startDate)) && (convertDate(d.sampleDate) >= convertDate(cutoffDate))) {
                                        if (keepData(d)) {
                                            dateArray.push(d); 
                                        }
                                    }
                                };
                                return dateArray;
                            }

                            // Checks whether result is a valid ND (Res Qual Code = "ND" and Result is positive)
                            function keepData(d) {
                                if ((d.DataQuality === 0) || (d.DataQuality === 4) || (d.DataQuality === 5)) {
                                    return false;
                                } else if ((d.resultqualcode === "ND") && (d.result > 0)) {
                                        return false; 
                                } else if ((d.resultqualcode === "P") && !(d.result)) {
                                        return false;
                                } else {
                                    return true;
                                }
                            }

                            function calculateGeomean(data) {
                                if (data.length <= 0) {
                                    console.log("Geomean: Array is empty.");
                                    return null;
                                } else {
                                    var product = 1;
                                    data.forEach(function(d) {
                                        if ((d.resultqualcode === "ND") && (d.mdl > 0)) {
                                            product *= d.mdl * 0.5;     // Substitute NDs with half of MDL
                                        } else {
                                            product *= d.result;    // Use result for detects
                                        }
                                    });
                                    var gMean = Math.pow(product, (1 / data.length));   // nth root
                                    return gMean;
                                }
                            }

                            var cutoffDate = getCutoffDate(startDate, offsetDays);
                            var geomeanData = getSampleArray(data, startDate, cutoffDate);

                            // Assemble geomean object for single 6-week range
                            if (geomeanData.length < 1) { 
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: null}; // No data
                            } else if (geomeanData.length < 5) {
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: "NES"}; // Not enough samples
                            } else {
                                var geomean = decimalRound(calculateGeomean(geomeanData), 2);
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: geomean};
                            }
                            return geomeanObject;
                    
                    } // getGeomeanObject()

                    // Compile array of geomean objects
                    geomeanObjects = getGeomeans(newData, lastSampleDate, earliestDate, geomeanDays);
                    endPoint = geomeanObjects[geomeanObjects.length - 1];

                    // Create endpoint geomean object and add to array
                    geomeanObjects.push({beginDate: null, endDate: earliestDate, geomean: endPoint.geomean});
                    console.log("geomeanObjects", geomeanObjects);


                    var margin = {top: 10, right: 20, bottom: 90, left: 70},
                        margin2 = {top: 340, right: 20, bottom: 10, left: 70},
                        width = 862 - margin.left - margin.right,
                        height = 390 - margin.top - margin.bottom,
                        height2 = 370 - margin2.top - margin2.bottom;
                    
                    // Set ranges
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
                        // you need to add namespace, i.e., 'click.foo'
                        // necessary if you call invoke this function for multiple svgs
                        // api docs: https://github.com/mbostock/d3/wiki/Selections#on
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

                    
                    var currentExtent = d3.extent(newData, function(d) { return d.sampleDate; });   // Find extent for x-axis
                    var xBufferExtent = bufferExtent(currentExtent, 35);    // Buffer x-axis extent so points at end are not cut off
                    var yMax = d3.max(newData, function(d) { return d.result });    // Find max Y data point 
                    var displayY = compareThresholds(yMax);     // Compare threshold values to find max Y for display

                    xScale.domain(xBufferExtent);
                    yScale.domain([0, Math.ceil(roundHundred(displayY + (displayY / 3)))]); // Add buffer to top
                    xScale2.domain(xScale.domain());
                    yScale2.domain(yScale.domain());

                    // Preferred number of ticks 
                    var ticksN = 8;

                    // Define axes
                    var yAxis = d3.axisLeft(yScale)
                        .tickSize(0)
                        .tickPadding(10);
                    var xAxis = d3.axisBottom(xScale)
                        .ticks(ticksN)
                        .tickSize(0)
                        .tickPadding(10);
                    var xAxis2 = d3.axisBottom(xScale2)
                        .ticks(ticksN)
                        .tickSizeOuter(0);

                    // Define gridlines
                    var xgAxis = d3.axisBottom(xScale)
                        .ticks(ticksN)
                        .tickSize(-height);
                    var ygAxis = d3.axisLeft(yScale)
                        .tickSize(-width);

                    var brush = d3.brushX()
                        .extent([[0, 0], [width, height2]])
                        .on("brush", brushed)
                        .on('end', function() {
                            var s = d3.event.selection;
                        });
                    
                    focus.append("g")
                        .attr("class", "axis grid")
                        .attr("transform", "translate(0," + height + ")")
                        .call(xgAxis);

                    focus.append("g")
                        .attr("class", "axis grid")
                        .call(ygAxis);

                    // Add x-axis to main chart
                    focus.append("g")
                        .attr("class", "xAxis")
                        .attr("transform", "translate(0," + height + ")")
                        .call(xAxis);
                        
                    // Add y-axis to main chart
                    focus.append("g")
                        .attr("class", "yAxis")
                        .call(yAxis);
        
                    // Add y-axis label to main chart  
                    focus.append("text")
                        .attr("transform", "rotate(-90)")
                        .attr("y", 0 - 70)
                        .attr("x", 0 - (height / 2))
                        .attr("dy", "1em")
                        .style("text-anchor", "middle")
                        .text("cfu / 100 ml")
                        .attr("class", "graphLabel");

                    var gColor = "#ED6874";     // Color for geomean elements
                    var gCircleOpacity = 1;
                    var circleOpacity = 0.7;
                    var tooltipOpacity = 1;
                    var lineOpacity = 1;

                    // Add STV threshold lines // To-do: create class
                    switch (formAnalyte) {
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
                                .attr("transform", "translate(" + (width - 105) + "," + (yScale(ecoli_STV) - 10) + ")")
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
                                .attr("transform", "translate(" + (width - 105) + "," + (yScale(enterococcus_STV) - 10) + ")")
                                .attr("dy", ".35em")
                                .attr("class","stvLineLabel")
                                .attr("id", "stvLineLabel")
                                .attr("text-anchor", "start")
                                .style("fill", "rgb(51, 91, 150)")
                                .text("STV: " + enterococcus_STV + " cfu/100 mL");
                            break;
                    }

                    // Add geomean threshold lines // To-do: create class
                    switch (formAnalyte) {
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
                                .attr("transform", "translate(" + (width - 105) + "," + (yScale(ecoli_GM) - 10) + ")")
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
                                .attr("transform", "translate(" + (width - 98) + "," + (yScale(enterococcus_GM) - 10) + ")")
                                .attr("dy", ".35em")
                                .attr("class","gmLineLabel")
                                .attr("id", "gmLineLabel")
                                .attr("text-anchor", "start")
                                .style("fill", gColor)
                                .text("GM: " + enterococcus_GM + " cfu/100 mL");
                            break;
                    }

                    // Move line labels if overlapping
                    if ((formAnalyte === enterococcus) || (formAnalyte === ecoli)) {

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

                    // Add sample data to main chart area // To-do: create class
                    var dots = focus.append("g");
                        dots.attr("clip-path", "url(#clip)");
                        dots.selectAll("circle")
                            .data(newData)
                            .enter().append("circle")
                            .attr('class', 'circles')
                            .attr("r", 6)
                            .attr("fill", "rgb(51, 91, 150)")
                            .attr("cx", function(d) { return xScale(d.sampleDate); })
                            .attr("cy", function(d) { return yScale(d.result); })
                            .style("opacity", circleOpacity)
                            .on("mouseover", function(d) {
                                // Format date value for tooltip
                                var tooltipDate = d3.timeFormat("%b %e, %Y");
                                div.transition()
                                    .duration(100)
                                    .style("opacity", tooltipOpacity);
                                div.html("<strong>Sample Date: </strong>" + tooltipDate(d.sampleDate) + "<br/ >" + "<strong>Program: </strong>" + d.Program + "<br/ >" + "<strong>Result: </strong>" + d.result + " " + d.Unit)
                                    .style("left", (d3.event.pageX) + "px")
                                    .style("top", (d3.event.pageY) + "px");
                                d3.select(this)
                                    .attr("fill", "#84c0e3");

                            })
                            .on("mouseout", function(d) {
                                div.transition()
                                    .duration(100)
                                    .style("opacity", 0);
                                d3.select(this)
                                    .attr("fill", "rgb(51, 91, 150)")
                                    .style("opacity", circleOpacity);
                            });

                    // Add geomean points to main chart // To-do: create class
                    var gDots = focus.append("g");
                        gDots.attr("clip-path", "url(#clip)");
                        gDots.selectAll("circle")
                            .data(geomeanObjects)
                            .enter().append("circle")
                            .filter(function(d) { return (d.geomean !== null) && (d.geomean != "NES") })  // Strict not version for null
                            .attr('class', 'gCircles')
                            .attr("r", 4)
                            .attr("fill", gColor)
                            .attr("cx", function(d) { return xScale(d.endDate); })
                            .attr("cy", function(d) { return yScale(d.geomean); })
                            .style("opacity", gCircleOpacity)
                            .on("mouseover", function(d) {
                                // Format date value for tooltip
                                var tooltipDate = d3.timeFormat("%b %e, %Y");
                                div.transition()
                                    .duration(50)
                                    .style("opacity", tooltipOpacity);
                                div.html("<strong>Date: </strong>" + tooltipDate(d.endDate) + "<br/ ><strong>Geometric Mean: </strong>" + d.geomean)
                                    .style("left", (d3.event.pageX) + "px")
                                    .style("top", (d3.event.pageY) + "px");
                                d3.select(this)
                                    .attr("fill", "#f2afa4");
                            })
                            .on("mouseout", function(d) {
                                div.transition()
                                    .duration(50)
                                    .style("opacity", 0);
                                d3.select(this)
                                    .attr("fill", gColor)
                                    .style("opacity", gCircleOpacity);
                            });


                    context.append("g")
                        .attr("class", "axis axis--x")
                        .attr("transform", "translate(0," + height2 + ")")
                        .call(xAxis2);
                    
                    var dots = context.append("g");
                        dots.attr("clip-path", "url(#clip)");
                        dots.selectAll("dot")
                            .data(newData)
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

                    // Filter listeners
                    d3.select("#filterData").on("change", toggleData);
                    d3.select("#filterGeomean").on("change", toggleGeomean);

                    function toggleData() {
                        if(d3.select(this).property("checked")){
                            d3.selectAll(".circles").attr("visibility", "visible");
                            // Include below for toggling off threshold lines 
                            // d3.selectAll(".stvLine").attr("visibility", "visible"); 
                            // d3.selectAll(".stvGraphLabel").attr("visibility", "visible");
                        } else {
                            d3.selectAll(".circles").attr("visibility", "hidden");
                            // Include below for toggling off threshold lines 
                            // d3.selectAll(".stvLine").attr("visibility", "hidden");
                            // d3.selectAll(".stvGraphLabel").attr("visibility", "hidden");
                        }			
                    }

                    function toggleGeomean() {
                        if(d3.select(this).property("checked")){
                            d3.selectAll(".gCircles").attr("visibility", "visible");
                            // Include below for toggling off threshold lines 
                            // d3.selectAll(".gLine").attr("visibility", "visible");
                            // d3.selectAll(".gmGraphLabel").attr("visibility", "visible");
                        } else {
                            d3.selectAll(".gCircles").attr("visibility", "hidden");
                            // Include below for toggling off threshold lines 
                            // d3.selectAll(".gLine").attr("visibility", "hidden");
                            // d3.selectAll(".gmGraphLabel").attr("visibility", "hidden");
                        }			
                    }

                    function brushed() {
                        var s = d3.event.selection || xScale2.range();
                        var brushWidth = s[1] - s[0];

                        // Manage on-screen d3 elements when brush is dragged outside extent
                        if ((brushWidth === 0) || (s[0] >= width)) { 
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

                        xScale.domain(s.map(xScale2.invert, xScale2));
                        focus.selectAll(".circles")
                                .attr("cx", function(d) { return xScale(d.sampleDate); })
                                .attr("cy", function(d) { return yScale(d.result); });
                        focus.selectAll(".gCircles")
                                .attr("cx", function(d) { return xScale(d.endDate); })
                                .attr("cy", function(d) { return yScale(d.geomean); });
                        focus.select(".xAxis").call(xAxis);
                        focus.select(".grid").call(xgAxis);
                    }

                    function bufferExtent(extent, days) {
                        // Pad min
                        var extentMin = convertDate(extent[0]);
                        var newExtentMin = extentMin - (oneDay * days); 
                        newExtentMin = convertUNIX(newExtentMin);
                        // Pad max
                        var extentMax = convertDate(extent[1]);
                        var newExtentMax = extentMax + (oneDay * days);
                        newExtentMax = convertUNIX(newExtentMax);
                        newExtentObject = [newExtentMin, newExtentMax]; 
                        return newExtentObject;
                    }

                    function compareThresholds(y) {
                        var maxThreshold;
                        // Only compare STV because STV > GM
                        // To do: completely redo this
                        if (formAnalyte === ecoli) {
                            if (y < ecoli_STV) {
                                maxThreshold = ecoli_STV;
                            } else if (y > ecoli_STV) {
                                maxThreshold = y;
                            } else {
                                maxThreshold = ecoli_STV
                            }
                        } else if (formAnalyte === enterococcus) {
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
                        document.getElementById("filterData").checked="true";
                        document.getElementById("filterGeomean").checked="true";
                    }

                } // drawGraph()

            } // processData()

    } // createViz()

} // onMarkerClick()

function clearGraph() {
    d3.selectAll(".axis grid").remove();
    d3.selectAll(".circles").remove();
    d3.selectAll(".gCircles").remove();
    d3.selectAll('.line').remove();
    d3.selectAll(".xAxis").remove();
    d3.selectAll('.yAxis').remove();
    d3.selectAll('.xLabel').remove();
    d3.selectAll('.yLabel').remove();
    d3.selectAll('.axis').remove();
    d3.selectAll('.dotContext').remove();
    d3.selectAll('.brush').remove();
    d3.selectAll('.gmLineLabel').remove();
    d3.selectAll('.stvLineLabel').remove();
    d3.selectAll('.svgLegend').remove();
    d3.selectAll('.legend').remove();
    d3.selectAll('.graphLabel').remove();
}

function decimalRound(x, n) {
    if (x === null) { return null; }
    return x.toFixed(n);
}

function roundHundred(value) {
    return (value / 100) * 100
}

// Convert to UNIX time
function convertDate(date) {
    return date.getTime();
}

// Convert to Javascript date
function convertUNIX(seconds) {
    return new Date(seconds);
}