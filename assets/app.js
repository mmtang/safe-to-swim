/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/


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
            // $("#aboutModal").modal('show');
        }, 1000);
    }
}

function onMarkerClick(e) {
    var siteClicked = e.layer.feature.properties.StationCode;
    // reset layer style
    highlightMarker(e);

    function highlightMarker(e) {
        e.layer.options.color = "#00e5ee";
        e.layer.options.fillColor = "#00e5ee";
        e.layer.options.weight = 3;
    }

    var featureContent = '<div id="popupMenu"><div id="analyteContainer"></div><div id="filterContainer"></div></div>' + '<div id="siteGraph"><svg width="862" height="390"></div><div class="panel-date"></div><div id="scale-container"></div>';
    $("#feature-info").html(featureContent);
    $("#featureModal").modal("show");
    $(".background-mask").show();

    var trendDataURL = createURL('23a59a2c-4a95-456f-b39e-41446bdc5724', siteClicked);
    // request trend data
    getData(trendDataURL, createViz);

    function createViz(initialData) {
            var ecoli = "E. coli",
                enterococcus = "Enterococcus",
                coliformtotal = "Coliform, Total",
                coliformfecal = "Coliform, Fecal";    
    
            var ecoli_STV = 320,
                enterococcus_STV = 110,
                ecoli_GM = 100,
                enterococcus_GM = 30;

            var dataQuality0 = "MetaData, QC record",
                dataQuality1 = "Passed QC"
                dataQuality2 = "Some review needed",
                dataQuality3 = "Spatial Accuracy Unknown",
                dataQuality4 = "Extensive review needed",
                dataQuality5 = "Unknown data quality",
                dataQuality6 = "Reject record",
                dataQuality7 = "Error";

            /* removed data quality filtering for now
            var qualityData = initialData.filter(d => {
                return (d.DataQuality === dataQuality1) || (d.DataQuality === dataQuality2) || (d.DataQuality === dataQuality3);
            });
            */

            if (initialData.length > 0) {
                processData(initialData);
                $(".background-mask").hide(); 
            } else {
                $(".background-mask").hide(); 
                alert("No data for selected site.");
            }

            function processData(data) {
                var parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
                var indicatorSet = new Set(); 

                data.forEach(function(d) {
                    d.sampleDate = parseDate(d.SampleDate);
                    d.analyte = d.Analyte;
                    d.resultqualcode = d.ResultQualCode;
                    d.mdl = +d.MDL;
                    if (checkND(d)) {
                        var sub = d.mdl / 2;
                        d.result = sub;
                    } else {
                        d.result = +d.Result;
                    }
                    indicatorSet.add(d.analyte);
                });
                console.log(data);

                function checkND(d) {
                    if ((d.result <= 0) || (d.resultqualcode === "ND")) {
                        return true;
                    } else {
                        return false;
                    }
                }

                // Array.from not supported by IE11
                var indicators = [];
                indicatorSet.forEach(function(i) {
                    indicators.push(i);
                }); 
                // sort desc so that Enteroccocus and E. coli appear first 
                indicators.sort(function(a,b) { return b > a; });
                var defaultAnalyte = indicators[0];

                // clear analyte menu
                $('#analyteMenu').empty();

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
                // scale menu
                $('#scale-container').append('<div class="btn-group btn-group-sm" role="group"><button type="button" class="btn btn-default">Linear Scale</button><button type="button" class="btn btn-default">Log Scale</button></div>');

                drawGraph(defaultAnalyte);

                // listener for analyte change
                $("#analyteMenu").on("change", function() {
                    drawGraph(this.value);
                });

                function drawGraph(analyte) {
                    $(".panel-date").empty();
                    $(".panel-date").append('Drag the handles of the gray box above to change the date view.<p class="js-date-range">Currently viewing: <span class="js-start-date"></span> to <span class="js-end-date"></span></p>');
                    clearChart(); 
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
                                    return null;
                                }
                                var dateArray = [];
                                for (var i = 0; i < data.length; i++) {
                                    var d = data[i];
                                    if ((convertDate(d.sampleDate) <= convertDate(startDate)) && (convertDate(d.sampleDate) >= convertDate(cutoffDate))) {
                                            dateArray.push(d); 
                                    }
                                };
                                return dateArray;
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
                                        // check for NDs and substitue with half of MDL
                                        if (checkND(d)) {
                                            var sub = d.mdl / 2;
                                            d.result = sub;
                                            product *= sub;
                                        } else {
                                            product *= d.result;    
                                        }
                                    });
                                    var geomean = Math.pow(product, (1 / data.length)); // nth root
                                    return geomean;  
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
                        margin2 = {top: 380, right: 20, bottom: 10, left: 50},
                        width = 862 - margin.left - margin.right,
                        height = 420 - margin.top - margin.bottom,
                        height2 = 410 - margin2.top - margin2.bottom;
                
                    var svg = d3.select("#siteGraph")
                        .select("svg")
                            .attr("width", width + margin.left + margin.right)
                            .attr("height", height + margin.top + margin.bottom + margin2.bottom)
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
                    var xBufferExtent = bufferExtent(currentExtent, 35);  // buffer x-axis extent
                    var yMax = d3.max(graphData, function(d) { return d.result });  // find max Y data point 
                    var displayY = compareThresholds(yMax);  // compare threshold values to find max Y for display

                    var xScale = d3.scaleTime().range([0, width]),
                        xScale2 = d3.scaleTime().range([0, width]),
                        yScale = d3.scaleLinear().range([height, 0]),
                        yScale2 = d3.scaleLinear().range([height2, 0]);

                    var logScale = d3.scaleLog()
                        .domain([0.1, displayY])
                        .range([height, 0]);


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

                    var gColor = "#ED6874"; 
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
                                tooltipD.transition()
                                    .duration(100)
                                    .style("opacity", tooltipOpacity);
                                tooltipD.html("Sample Date: " + tooltipDate(d.sampleDate) + "<br/ >" + "Program: " + d.Program + "<br/ >" + "Result: " + d.result + " " + d.Unit)
                                    .style("left", function() {
                                        var windowWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
                                        var widthThreshold = windowWidth * 0.75;
                                        var tooltipWidth = document.getElementById("tooltipD").offsetWidth;
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
                                        var tooltipHeight = document.getElementById("tooltipD").offsetHeight;
                                        // checks for points positioned in lower half of graph and moves the tooltip up
                                        if (relativePos < 0) {
                                            return d3.event.pageY - tooltipHeight + "px";
                                        } else {
                                            return d3.event.pageY + "px";
                                        }
                                    });
                                d3.select(this)
                                    .attr("fill", "#84c0e3");

                            })
                            .on("mouseout", function(d) {
                                tooltipD.transition()
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
                                        // checks for points positioned in lower half of graph and moves the tooltip up
                                        if (relativePos < 0) {
                                            return d3.event.pageY - tooltipHeight + "px";
                                        } else {
                                            return d3.event.pageY + "px";
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

        showSidebar();
        setTimeout(function() {
            map.invalidateSize(true);
        }, 100); 

    } // createViz()

} // onMarkerClick()





/*
/ Listeners
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

function createURL(resource, site) {
    var url = 'https://data.ca.gov/api/action/datastore/search.jsonp?resource_id=' + resource + '&limit=' + recordLimit;
    if (typeof site === 'undefined') {
        return url;
    } else {
        // optional site parameter
        return url + '&filters[StationCode]=' + site;
    }
}

function getData(url, callback, offset, data) {
    if (typeof offset === 'undefined') { offset = 0; }
    if (typeof data === 'undefined') { data = []; }

    var request = $.ajax({
        url: url,
        data: {offset: offset},
        dataType: "jsonp",
        jsonpCallback: callback.name,
    });
    request.done(function(res) {
        var dataPage = res.result.records;
        data = data.concat(dataPage);
        if (dataPage.length < recordLimit) {
            callback(data);
        } else {
            getData(url, callback, offset + recordLimit, data);
        }
    });
    request.fail(function(res) {
        console.log(res);
        hideLoading(); 
        alert("Data failed to load.");
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

function resetLayerMenu() {
    document.getElementById("topo-tile-radio").checked="true";
    document.getElementById("sites-box").checked="true";
    document.getElementById("counties-box").checked="";
    document.getElementById("rb-boundaries-box").checked="";
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

function clearChart() {
    var svg = d3.select("svg");
    svg.selectAll("*").remove();
    d3.selectAll(".tooltip").remove();
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