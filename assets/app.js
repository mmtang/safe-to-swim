var map = L.map('map',{ 
    center: [37.4050, -119.4179], 
    zoom: 6, 
    preferCanvas: true,
    zoomControl: false,
    doubleClickZoom: false
}); 

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
    attribution: 'Tiles &copy; Esri'}).addTo(map);

var Esri_WorldImagery = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'});


var zoomControl = L.control.zoom({ position:'bottomleft' }).addTo(map);

var sidebarControl = L.Control.extend({
        options: {
            position: 'topright'
        },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'sidebar-control-container');
        container.innerHTML = '<div id="sidebar-control"><a href="#" id="sidebar-show-btn" onClick="showSidebar()"><button type="button" class="btn btn-xs btn-default pull-left" id="sidebar-show-btn"><i class="fa fa-chevron-left fa"></i></button></a></div>';
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

var selectedSitesLayer = L.geoJson([], {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, defaultMarker);
    }
}).addTo(map);

var recordLimit = 100;

var sitesURL = createURL('e1e977d9-7a2a-401d-aa75-8e7e2ddb4e83');

function createURL(resource, site) {
    var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    if (typeof site === 'undefined') {
        return url;
    } else {
        return url + '&filters[StationCode]=' + site;
    }
}

/*************************************
********* API CALL FOR SITES  ********
*************************************/

getData(processSites, 'processSites', sitesURL);

function getData(callback, callbackText, url, offset, data) {
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
        console.log("total site records:", res.result.total); 
        data = data.concat(dataPage);
        if (dataPage.length < recordLimit) {
            console.log("called site data", data);
            callback(data);
        } else {
            getData(callback, callbackText, url, offset + recordLimit, data);
        }
    });

    request.fail(function(res) {
        console.log(res);
    });

}
        
/*************************************
**************************************
*************************************/

function processSites(data) {
    featureCollection = [];
    for (var i = 0; i < data.length; i++) {
        var site = {};
        site.type = "Feature";
        site.geometry = {"type": "Point", "coordinates": [data[i].TargetLongitude, data[i].TargetLatitude]};
        site.properties = { "StationName": data[i].StationName, "StationCode": data[i].StationCode };
        featureCollection.push(site);
    }
    selectedSitesLayer.addData(featureCollection);
    $("#cover-wrap").hide();  
}

$("#selected-sites-box").click( function() {
    toggleLayer(selectedSitesLayer);
});

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

function toggleLayer(layer) { 
    if (map.hasLayer(layer)) {
        map.removeLayer(layer);
    } else {
        map.addLayer(layer);
    }
}

selectedSitesLayer.on('click', function(e) {
    console.log(e);
    clearGraph();
    $("#feature-title").html(e.layer.feature.properties.StationName + "<p>Station Code: " + e.layer.feature.properties.StationCode + "</p>");
    $("#sidebar").show(200, function() {
        setTimeout(function() {
            map.invalidateSize()
        }, 200); 
        setTimeout(function() {
            changeMapView(e);
        }, 350);
        onMarkerClick(e);
    });
});

document.getElementById("topo-tile-radio").checked="true";
document.getElementById("selected-sites-box").checked="true";

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
    selectedSitesLayer.setStyle(defaultMarker);
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
    $("#cover-wrap").show();

    var siteDataURL = createURL('64ccaca5-456c-4a72-98d3-f721d6cb806b', siteClicked);
    console.log("siteDataURL:", siteDataURL);


    /*************************************
    ******* API CALL FOR SITE DATA *******
    *************************************/

    getData(createViz, 'createViz', siteDataURL);
    
    /*************************************
    **************************************
    *************************************/

    function createViz(data) {

            $("#cover-wrap").hide(); 
            var Data = processData(data);

            function processData(data) {
                var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
                var indicatorSet = new Set(); 

                data.forEach(function(d) {
                    d.sampleDate = parseDate(d.SampleDate);
                    d.result = +d.Result;
                    d.analyte = d.Analyte;
                    indicatorSet.add(d.analyte);
                    d.resultqualcode = d.ResultQualCode;
                    d.mdl = +d.MDL;
                });

                // compatible with IE
                var indicators = [];
                indicatorSet.forEach(function(v) {
                    indicators.push(v);
                });
                
                var defaultAnalyte = indicators[0];
                console.log("indicators", indicators); 

                d3.select("#analyteSelect").remove();

                // create sidebar menus
                if (indicators.length > 0) {
                    // create analyte menu
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
                    // create filter menu
                    var filterSpace = document.getElementById("filterMenu");
                    var filterContent = '<div id="filterMenu"><div class="form-check"><label><input id="filterData" value="data" class="form-check-input" type="checkbox" checked>&nbsp;Sample data&nbsp;&nbsp;<i class="fa fa-circle data-dot" aria-hidden="true"></i></label></div><div class="form-check"><label><input id="filterGeomean" value="geomean" class="form-check-input" type="checkbox" checked>&nbsp;Geometric mean&nbsp;&nbsp;<i class="fa fa-circle gm-dot" aria-hidden="true"></i></label></div></div>';
                    filterSpace.innerHTML += filterContent;

                    drawGraph(defaultAnalyte);
                } else {
                    alert("No data for this site.");
                }

                // listen for analyte change
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
                        if ((data.StationCode === siteClicked) && (data.analyte === formAnalyte)) { return data; }
                    });

                    // need to redo checks
                    if (newData.length < 1 ) { window.alert("No data for this indicator."); }

                    newData = newData.sort(function(a, b) { return b.sampleDate - a.sampleDate });  // Sort descending

                    // get reference dates
                    var lastSampleDate = newData[0].sampleDate,
                        dataArrayLength = newData.length,
                        earliestDate = newData[dataArrayLength - 1].sampleDate;

                    var oneDay = (24 * 60 * 60 * 1000);
                    var geomeanDays = 42;   // offset days: 6 weeks
                    
                    function getGeomeans(data, startDate, endDate, days) {
                        var geomeansArray = [];
                        var offsetValue = oneDay * days; 
                        var refDate = convertDate(startDate);
                        var stopDate = convertDate(endDate);
                        while(refDate >= stopDate) {
                            var newDate = convertUNIX(refDate);
                            geomeansArray.push(getGeomeanObject(data, newDate, days));
                            refDate -= oneDay * 7;  // offset is one week
                        }
                        return geomeansArray;
                    }
                    
                    // calculates the geometric mean for a single 6-week date range
                    function getGeomeanObject(data, startDate, offsetDays) {

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
                                        if (keepData(d)) {
                                            dateArray.push(d); 
                                        }
                                    }
                                };
                                return dateArray;
                            }

                            // checks whether result is a valid ND (res qual code = "ND" and result is positive)
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
                                    console.log("geomean array is empty");
                                    return null;
                                } else {
                                    var product = 1;
                                    data.forEach(function(d) {
                                        if ((d.resultqualcode === "ND") && (d.mdl > 0)) {
                                            product *= d.mdl * 0.5;     // substitute NDs with half of MDL
                                        } else {
                                            product *= d.result;    // use result for detects
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
                                var geomean = decimalRound(calculateGeomean(geomeanData), 2);
                                var geomeanObject = {beginDate: cutoffDate, endDate: startDate, geomean: geomean};
                            }
                            return geomeanObject;
                    
                    } // getGeomeanObject()

                    
                    // Compile array of geomean objects
                    geomeanObjects = getGeomeans(newData, lastSampleDate, earliestDate, geomeanDays);
                    endPoint = geomeanObjects[geomeanObjects.length - 1];

                    // Create endpoint geomean object
                    geomeanObjects.push({beginDate: null, endDate: earliestDate, geomean: endPoint.geomean});
                    console.log("geomeanObjects", geomeanObjects);


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

                    
                    var currentExtent = d3.extent(newData, function(d) { return d.sampleDate; });  // find extent for x-axis
                    var xBufferExtent = bufferExtent(currentExtent, 35);  // buffer x-axis extent so points at end are not cut off
                    var yMax = d3.max(newData, function(d) { return d.result });  // find max Y data point 
                    var displayY = compareThresholds(yMax);  // compare threshold values to find max Y for display

                    xScale.domain(xBufferExtent);
                    yScale.domain([0, Math.ceil(roundHundred(displayY + (displayY / 3)))]);  // add buffer to top
                    xScale2.domain(xScale.domain());
                    yScale2.domain(yScale.domain());

                    var ticksN = 8;  // preferred number of ticks 

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

                    // add data to main chart
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
                                var tooltipDate = d3.timeFormat("%b %e, %Y");  // format date value for tooltip
                                div.transition()
                                    .duration(100)
                                    .style("opacity", tooltipOpacity);
                                div.html("Sample Date: " + tooltipDate(d.sampleDate) + "<br/ >" + "Program: " + d.Program + "<br/ >" + "Result: " + d.result + " " + d.Unit)
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

                    // add geomean to main chart
                    var gDots = focus.append("g");
                        gDots.attr("clip-path", "url(#clip)");
                        gDots.selectAll("circle")
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
                                div.transition()
                                    .duration(50)
                                    .style("opacity", tooltipOpacity);
                                div.html("Date: " + tooltipDate(d.endDate) + "<br/ >Geometric Mean: " + d.geomean)
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
                        .attr("class", "xAxis2")
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

                    // filter listeners
                    d3.select("#filterData").on("change", toggleData);
                    d3.select("#filterGeomean").on("change", toggleGeomean);

                    function toggleData() {
                        if(d3.select(this).property("checked")){
                            d3.selectAll(".circles").attr("visibility", "visible");
                            // include below for toggling off threshold lines 
                            // d3.selectAll(".stvLine").attr("visibility", "visible"); 
                            // d3.selectAll(".stvGraphLabel").attr("visibility", "visible");
                        } else {
                            d3.selectAll(".circles").attr("visibility", "hidden");
                            // include below for toggling off threshold lines 
                            // d3.selectAll(".stvLine").attr("visibility", "hidden");
                            // d3.selectAll(".stvGraphLabel").attr("visibility", "hidden");
                        }			
                    }

                    function toggleGeomean() {
                        if(d3.select(this).property("checked")){
                            d3.selectAll(".gCircles").attr("visibility", "visible");
                            // include below for toggling off threshold lines 
                            // d3.selectAll(".gLine").attr("visibility", "visible");
                            // d3.selectAll(".gmGraphLabel").attr("visibility", "visible");
                        } else {
                            d3.selectAll(".gCircles").attr("visibility", "hidden");
                            // include below for toggling off threshold lines 
                            // d3.selectAll(".gLine").attr("visibility", "hidden");
                            // d3.selectAll(".gmGraphLabel").attr("visibility", "hidden");
                        }			
                    }

                    function brushed() {
                        var s = d3.event.selection || xScale2.range();
                        var brushWidth = s[1] - s[0];

                        // manage on-screen graph elements when brush is dragged outside extent
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
                        // focus.select(".grid").call(xgAxis);
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
    d3.selectAll(".grid line").remove();
    d3.selectAll(".circles").remove();
    d3.selectAll(".gCircles").remove();
    d3.selectAll('.line').remove();
    d3.selectAll(".xAxis").remove();
    d3.selectAll(".xAxis2").remove();
    d3.selectAll('.yAxis').remove();
    d3.selectAll('.xLabel').remove();
    d3.selectAll('.yLabel').remove();
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

// convert to UNIX time
function convertDate(date) {
    return date.getTime();
}

// convert to Javascript date
function convertUNIX(seconds) {
    return new Date(seconds);
}