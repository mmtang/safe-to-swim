/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

var Chart = function(opts) {
    this.id = opts.id;
    this.element = opts.element;
    this.data = opts.data;
    this.gData = [];
    this.hasDdpcrData = opts.hasDdpcrData;
    this.margin = opts.margin;
    this.width = opts.width;
    this.height = opts.height;
    // padding so that the point elements aren't cut off to the right of the chart 
    this.elementPadding = 6;
    this.initializeChart();
}

Chart.prototype.addAxes = function() {
    var _this = this;
    var unit = this.data[0].Unit;
    this.xAxis = d3.axisBottom()
        .scale(this.xScale)
        .ticks(5);
    this.yAxis = d3.axisLeft()
        .scale(this.yScale)
        .ticks(5)
        .tickFormat(function (d) {
            return _this.yScale.tickFormat(4, d3.format(",d"))(d)
        });
    this.focus.append('g')
        .attr('class', 'x-axis')
        .attr('transform', 'translate(0,' + this.height + ')')
        .call(this.xAxis);
    this.focus.append('g')
        .attr('id', this.id === 'chart-1' ? 'y-axis-1' : 'y-axis-2')
        .attr('class', 'y-axis')
        .call(this.yAxis)
        .append('text')
        .attr('fill', '#333333')
        .attr('transform', 'translate(7, -12)')
        .style('text-anchor', 'end')
        .text(unit);
}

Chart.prototype.addBrush = function() {
    this.context.append('g')
        .attr('class', 'brush')
        .call(this.brush)
        .call(this.brush.move, this.xScale.range());
}

Chart.prototype.addBrushAxis = function() {
    this.xBrushAxis = d3.axisBottom(this.xBrushScale)
        .ticks(5)
        .tickSizeOuter(0);
    this.context.append('g')
        .attr('class', 'x-axis')
        .attr('transform', 'translate(0,' + this.brushHeight + ')')
        .call(this.xBrushAxis);
}

Chart.prototype.addLine = function(d) {
    console.log(d);
    var _this = this;
    if (d.type === 'stv') {
        var color = mainColor;
    } else if (d.type === 'gm') {
        var color = secColor;
    }

    this.focus.append('line')
        .datum(d)
        .attr('class', 'line ' + d.type)
        .style('stroke', color)
        .style('stroke-width', 3)
        .attr('x1', 0)
        .attr('x2', _this.width + _this.elementPadding)
        .attr('y1', _this.yScale(d.val))
        .attr('y2', _this.yScale(d.val))
        .style('opacity', chartOpacity)
        .on('mousemove', function(d) {
            toggleTooltip(tooltipLine, 1);
            d3.select(tooltipLine)
                .html(function() { 
                    if (d.type === 'stv') {
                        return tooltipThresholdSTV(d.val, d.unit); 
                    } else if (d.type === 'gm') {
                        return tooltipThresholdGM(d.val, d.unit);
                    }
                })
                .style('left', function() { return positionTooltipX('tooltipLine'); })
                .style('top', function() { return positionLineTooltipY('tooltipLine'); })
                .style('color', '#FFF');
        })
        .on('mouseout', function(d) {
            toggleTooltip(tooltipLine, 0);
        });
}

Chart.prototype.addTitle = function() {
    if (this.hasDdpcrData) {
        var titleText;
        if (this.id === 'chart-1') {
            titleText = 'Culture-based Testing Method';
        } else if (this.id === 'chart-2') {
            titleText = 'Droplet Digital Polymerase Chain Reaction (ddPCR) Testing Method'
        }
        this.svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', this.margin.left + (this.width / 2))             
            .attr('y', 0 + (this.margin.top / 2))
            .attr('text-anchor', 'middle')  
            .style('fill', '#333333')
            .style('font-size', '1.6rem') 
            .text(titleText);
        }
}

Chart.prototype.setDateView = function(dateObj1, dateObj2) {
    var _this = this;
    if (isValidDate(dateObj1) && isValidDate(dateObj2)) {
        _this.xScale.domain([dateObj1, dateObj2]);
        // redraw graph elements
        _this.focus.selectAll('.circle')
            .attr('cx', function(d) { return _this.xScale(d.SampleDate); })
            .attr('cy', function(d) { return _this.yScale(d.ResultDisplay); });
        _this.focus.selectAll('.triangle')
            .attr('transform', function(d) { return 'translate(' + _this.xScale(d.SampleDate) + ',' + _this.yScale(d['6WeekGeoMean']) + ')'; })
        _this.focus.select('.x-axis').call(_this.xAxis);
    }
}

Chart.prototype.brushed = function(parent) {
    // save brush start and end values
    var selection = d3.event.selection;
    parent.xScale.domain(selection.map(parent.xBrushScale.invert, parent.xBrushScale));
    // manage graph elements when dragged outside extent
    if ((selection[0] >= this.width) || (selection[1] <= 0)) { 
        this.focus.selectAll('.circle').style('opacity', 0);
        this.focus.selectAll('.triangle').style('opacity', 0);
    } else {
        this.focus.selectAll('.circle').style('opacity', chartOpacity);
        this.focus.selectAll('.triangle').style('opacity', chartOpacity);
    }
    // redraw graph elements
    parent.focus.selectAll('.circle')
        .attr('cx', function(d) { return parent.xScale(d.SampleDate); })
        .attr('cy', function(d) { return parent.yScale(d.ResultDisplay); });
    parent.focus.selectAll('.triangle')
        .attr('transform', function(d) { return 'translate(' + parent.xScale(d.SampleDate) + ',' + parent.yScale(d['6WeekGeoMean']) + ')'; })
    parent.focus.select('.x-axis').call(parent.xAxis);
    // update date pickers
    var newXDate = this.xBrushScale.invert(selection[0]);
    var newYDate = this.xBrushScale.invert(selection[1]);
}

Chart.prototype.clearChart = function() {
    this.element.innerHTML = '';
    d3.selectAll('.tooltip').remove();
}

Chart.prototype.createBrush = function() {
    var _this = this;
    this.brush = d3.brushX()
        .extent([[0, 0], [this.width, this.brushHeight]])
        .on('brush', function() { _this.brushed(_this); })
        .on('end', function() { var s = d3.event.selection; });
}

Chart.prototype.createBrushScales = function() {
    this.xBrushScale = d3.scaleTime()
        .domain(this.xScale.domain())
        .range([0, this.width]);
    this.linearBrushScale = d3.scaleLinear()
        .domain(this.yScale.domain())
        .range([this.brushHeight, 0]);
    this.logBrushScale = d3.scaleLog()
        .domain(this.yScale.domain())
        .range([this.brushHeight, 0]);
    this.yBrushScale = this.logBrushScale;
}

Chart.prototype.createScales = function(threshold) {
    // calculate min and max dates for data
    /*
    this.xExtent = d3.extent(this.data, function(d,i) { return d.SampleDate; });
    if (this.data.length === 1) {
        this.xExtent = bufferX(this.xExtent, 35);  
    }
    */

    // compare the max Y to the threshold and pick the greater value
    var yMax = d3.max(this.data, function(d) { return d.ResultDisplay }); 
    var yDisplay = Math.max(yMax, threshold);
    // add arbitrary buffer to y axis
    var yLinearBuffered = Math.ceil(roundHundred(yDisplay + (yDisplay / 3)));
    var yLogBuffered = Math.ceil(roundHundred(yDisplay + (yDisplay / 2)));

    function bufferX(extent, days) {
        var min = convertToTimestamp(extent[0]);
        var max = convertToTimestamp(extent[1]);
        var newMin = min - MS_PER_DAY * days; 
        var newMax = max + MS_PER_DAY * days;
        return [convertToDateObj(newMin), convertToDateObj(newMax)];
    }

    this.xScale = d3.scaleTime()
        //.domain(this.xExtent)
        .domain([minDate, today])
        .range([0, this.width]);
    this.linearScale = d3.scaleLinear()
        .domain([0, yLinearBuffered])
        .range([this.height, 0]);
    this.logScale = d3.scaleLog() 
        .domain([0.1, yLogBuffered])
        .range([this.height, 0]);
    // set to log on creation
    this.yScale = this.logScale;
}

Chart.prototype.drawBrush = function() {
    this.initializeBrush();
    this.createBrushScales();
    this.createBrush();
    this.addBrushAxis();
    this.addBrush();
    this.setInitialView();
}

Chart.prototype.drawBrushPoints = function() {
    var _this = this;
    var points = this.context.append('g')
        .attr('clip-path', 'url("#bClip")');
    points.selectAll('circle')
        .data(this.data)
        .enter().append('circle')
        .attr('class', 'bCircle brush')
        .attr('r', 3)
        .attr('fill', mainColor)
        .attr('cx', function(d) { return _this.xBrushScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yBrushScale(d.ResultDisplay); })
        .style('opacity', chartOpacity);
}

Chart.prototype.drawGPoints = function() {
    var maskId = this.id === 'chart-1' ? 'gMask-1' : 'gMask-2';
    var _this = this;
    var gPoints = this.focus.append('g')
        .attr('clip-path', 'url(#clipBuffered)')
        .attr('id', maskId);
    gPoints.selectAll('.triangle')
        .data(this.data.filter(function(d) { return d['6WeekCount'] >= gmLimit }), function(d) { return d.key; })
        .enter().append('path')
        .attr('class', 'triangle')
        .attr('d', d3.symbol().type(d3.symbolTriangle))
        .attr('transform', function(d) { return 'translate(' + _this.xScale(d.SampleDate) + ',' + _this.yScale(d['6WeekGeoMean']) + ')'; })
        .style('fill', secColor)
        .style('opacity', chartOpacity)
        .on('mouseover', function(d) {
            var _d = d;
            toggleTooltip(tooltipPoint, 1);
            d3.select(this).style('fill', '#56f6ff');
            d3.select(tooltipPoint)
                .html(function() { return tooltipGM(_d); })
                .style('left', function() { return positionTooltipX('tooltipPoint'); })
                .style('top', function() { return positionTooltipY('tooltipPoint'); })
                .style('border-color', secColor);
            drawRect(_d);
        })
        .on('mouseout', function() {
            toggleTooltip(tooltipPoint, 0);
            d3.select(this).style('fill', secColor);
            hideRect();
        })
        .merge(gPoints)
        .attr('transform', function(d) { return 'translate(' + _this.xScale(d.SampleDate) + ',' + _this.yScale(d['6WeekGeoMean']) + ')'; });
    gPoints.exit()
        .remove();

    function drawRect(d) {
        var _d = d;
        _this.gmRect
            .attr('visibility', 'visible')
            .attr('x', function() { return _this.xScale(_d['6WeekCutoffDate']); })
            .attr('y', 0)
            .attr('width', function() { return _this.xScale(_d.SampleDate) - _this.xScale(_d['6WeekCutoffDate']); })
            .attr('height', _this.height)
            .attr('fill', '#d6d6d6')
            .style('opacity', 0.5);
    }

    function hideRect() {
        if (_this.gmRect) { 
            _this.gmRect.attr('visibility', 'hidden'); 
        }
    }
}

Chart.prototype.drawLines = function(analyte, isDdpcrData) {
    if (!isDdpcrData) {
        if (analyte === ecoli.info.name) {
            this.addLine({ val: ecoli.info['stv'], type: 'stv', unit: ecoli.info['unit'] });
            this.addLine({ val: ecoli.info['gm'], type: 'gm', unit: ecoli.info['unit'] });
        } else if (analyte === enterococcus.info.name) {
            this.addLine({ val: enterococcus.info['stv'], type: 'stv', unit: enterococcus.info['unit'] });
            this.addLine({ val: enterococcus.info['gm'], type: 'gm', unit: enterococcus.info['unit']});
        }
    } else {
        if (analyte === enterococcusDdpcr.info.name) {
            this.addLine({ val: enterococcusDdpcr.info['stv'], type: 'stv', unit: enterococcusDdpcr.info['unit']});
        }
    }
}

Chart.prototype.drawPoints = function() {
    var _this = this;
    var points = this.focus.append('g')
        .attr('clip-path', 'url(#clipBuffered)');
    points.selectAll('.circle')
        .data(this.data)
        .enter().append('circle')
        .attr('class', 'circle')
        .attr('r', 6)
        .attr('cx', function(d) { return _this.xScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yScale(d.ResultDisplay); })
        .attr('fill', mainColor)
        .style('opacity', chartOpacity)
        .on('mouseover', function(d) {
            var _d = d;
            toggleTooltip(tooltipPoint, 1);
            d3.select(this).attr('fill', '#56f6ff');
            d3.select(tooltipPoint)
                .html(function() { return tooltipResult(_d); })
                .style('left', function() { return positionTooltipX('tooltipPoint'); })
                .style('top', function() { return positionTooltipY('tooltipPoint'); })
                .style('border-color', mainColor);
        })
        .on('mouseout', function() {
            toggleTooltip(tooltipPoint, 0);
            d3.select(this).attr('fill', mainColor);
        })
        .merge(points)
        .attr('cx', function(d) { return _this.xScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yScale(d.ResultDisplay); })
    points.exit()
        .remove();
}

Chart.prototype.filterGPoints = function() {
    var elementId = this.id === 'chart-1' ? '#gMask-1' : '#gMask-2';
    var comboId = elementId + ' .triangle';
    d3.selectAll(comboId).remove(); // select all gpoints in the specified element
    d3.select(elementId).remove();
    this.drawGPoints();
}

// could potentially use this for the geomean updates instead of straight out clearing the elements as done above, but i don't like how the code is duplicated with the original code that initializes the points. maybe we could refactor some of this.
// you have to select the mask before you append so that the new appended elements reside within the mask. This part works if you add the attribute lines back in.
/*
Chart.prototype.filterGPoints = function() {
    var _this = this;
    var filtered = this.gData.filter(function(d) { return d.count >= gmLimit });
    var mask = d3.select('#gMask');
    var gPoints = mask.selectAll('.triangle')
        .data(filtered);
    gPoints.enter().append('path')
        .merge(gPoints);
    gPoints.exit()
        .remove();
}
*/

Chart.prototype.initializeBrush = function() {
    this.brushHeight = 25;
    // position of brush from top of graph
    var brushSpace = this.height + this.brushHeight + 30;
    this.brushMargin = {top: brushSpace, right: 20, bottom: 10, left: 50};
    // create svg for chart brush
    this.context = this.svg.append('g')
        .attr('class', 'context')
        .attr('transform', 'translate(' + this.brushMargin.left + ',' + (this.brushMargin.top + 10) + ')');
    // add geometry for clipping brush elements
    this.context.append('defs').append('clipPath')
            .attr('id', 'bClip')
        .append('rect')
            .attr('width', this.width)
            .attr('height', this.brushHeight);
}

Chart.prototype.initializeChart = function() {
    this.clearChart();
    // initialize chart space
    this.svg = d3.select(this.element).append('svg')
        .attr('id', this.id)
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom)
        .call(this.id === 'chart-1' ? responsive : responsive2);
    this.focus = this.svg.append('g')
        .attr('class', 'focus')
        .attr('transform', 'translate(' + this.margin.left + ', ' + (this.margin.top) + ')');
    // clip path for clipping to the exact width of the chart element
    this.svg.append('defs').append('clipPath')
            .attr('id', 'clip')
        .append('rect')
            .attr('width', this.width)
            .attr('height', this.height);
    // clip path for clipping to the width of the chart element + an extra buffer to the right for point elements
    // used for the points, gm triangles, and objective lines
    this.svg.append('defs').append('clipPath')
            .attr('id', 'clipBuffered')
        .append('rect')
            .attr('width', this.width + this.elementPadding)
            .attr('height', this.height);
    // initialize tooltips
    createTooltip('tooltipLine');
    createTooltip('tooltipPoint');
    // initialize gm rectangle, one element only
    // draw this first, under the other elements
    this.gmRect = this.focus.append('rect')
        .attr('clip-path', 'url(#clip)')
        .attr('class', 'gm-rect');
    this.addTitle();
}

Chart.prototype.redraw = function() {
    this.updateScales();
    this.updateAxis();
    this.updatePoints();
    this.updateGPoints();
    this.updateObjectives();
    this.updateBrushPoints();
}

Chart.prototype.setBrushPosition = function(dateObj1, dateObj2) {
    if (isValidDate(dateObj1) && isValidDate(dateObj2)) {
        d3.select('.brush').call(this.brush.move, [dateObj1, dateObj2].map(this.xScale));
    }
}

Chart.prototype.updateAxis = function() {
    var selectId = this.id === 'chart-1' ? '#y-axis-1' : '#y-axis-2';
    d3.select(selectId)
        .transition()
        .duration(1000)
        .call(this.yAxis.scale(this.yScale));
}

Chart.prototype.updateGPoints = function() {
    var _this = this;
    var gPoints = this.svg.selectAll('.triangle');
    gPoints.enter()
        .merge(gPoints)
        .transition()
        .duration(1000)
        .attr('transform', function(d) { return 'translate(' + _this.xScale(d.SampleDate) + ',' + _this.yScale(d['6WeekGeoMean']) + ')'; });
    gPoints.exit()
        .remove();
}

Chart.prototype.updateObjectives = function() {
    var _this = this;
    var lines = d3.selectAll('.line');
    lines.enter()
        .merge(lines)
        .transition()
        .duration(1000)
        .attr('y1', function(d) { return _this.yScale(d.val); })
        .attr('y2', function(d) { return _this.yScale(d.val); });
}

Chart.prototype.updatePoints = function() {
    var _this = this;
    var points = this.svg.selectAll('.circle');
    points.enter()
        .merge(points)
        .transition()
        .duration(1000)
        .attr('cx', function(d) { return _this.xScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yScale(d.ResultDisplay); });
    points.exit()
        .remove();
}

Chart.prototype.updateBrushPoints = function() {
    var _this = this;
    var points = this.svg.selectAll('.bCircle');
    points.enter()
        .merge(points)
        .transition()
        .duration(1000)
        .attr('cx', function(d) { return _this.xBrushScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yBrushScale(d.ResultDisplay); })
    points.exit()
        .remove();
}

Chart.prototype.updateScales = function() {
    var _this = this;
    if (currentScale === 'linear') {
        this.yScale = this.linearScale;
        this.yBrushScale = this.linearBrushScale;
    } else if (currentScale === 'log') {
        this.yScale = this.logScale;
        this.yBrushScale = this.logBrushScale;
    }
    this.yAxis = d3.axisLeft()
        .scale(this.yScale)
        .ticks(5)
        .tickFormat(function(d) {
            return _this.yScale.tickFormat(10, d3.format(",d"))(d);
        });
}

var createTooltip = function(id) {
    d3.select('body').append('div')
        .attr('id', id)
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

var positionLineTooltipY = function(tooltipID) {
    var eventPos = d3.event.pageY;
    var tooltipHeight = document.getElementById(tooltipID).offsetHeight;
    return eventPos - tooltipHeight - 10 + 'px';
}

var positionTooltipX = function(tooltipID) {
    var eventPos = d3.event.pageX; // get mouse position
    var divExtent = document.getElementById('chart-space-1').offsetWidth; // get width of container holding chart
    var divOffset = document.getElementById('chart-container').offsetLeft; // get offset of chart container from left (parent container)
    var tooltipExtent = document.getElementById(tooltipID).offsetWidth; // get tooltip div width
    // calculate element position within container
    var relativePos = eventPos - divOffset; 
    if (relativePos <= (divExtent / 2)) {
        // if event is in the left half of chart
        return eventPos + 'px';
    } else {
        // if event is in the right half of chart
        return eventPos - tooltipExtent + 'px';
    }
}

var positionTooltipY = function(tooltipID) {
    var eventPos = d3.event.pageY; // get mouse position
    var divExtent = document.getElementById('chart-container').offsetHeight; // get height of container holding chart
    var divOffset = document.getElementById('chart-container').offsetTop; // get offset of chart container from left (parent container)
    var tooltipExtent = document.getElementById(tooltipID).offsetHeight; // get tooltip div height
    // calculate element position within container
    var relativePos = eventPos - divOffset; 
    if (relativePos <= (divExtent / 2)) {
        // if event is in the top half of chart
        return eventPos + 'px';
    } else {
        // if event is in the bottom half of chart
        return eventPos - tooltipExtent + 'px';
    }
}

function toggleTooltip (id, opacity) {
    d3.select(id) 
        .transition()
        .duration(200)
        .style('opacity', opacity);
}

function tooltipResult(d) {
    var formatDate = d3.timeFormat('%b %e, %Y');
    var displayCodes = ['<', '<=', '>', '>='];
    var resultQualCode = ''
    if (d.ResultQualCode) {
        if (displayCodes.includes(d.ResultQualCode)) {
            resultQualCode = d.ResultQualCode + ' ';
        } else if (d.ResultQualCode === 'ND') {
            resultQualCode = 'Non-detect';
        }
    }
    if (resultQualCode === 'Non-detect') {
        return '<strong>' + formatDate(d.SampleDate) + '</strong><br>Program: ' + d.Program + '<br>Result: ' + resultQualCode;
    } else {
        return '<strong>' + formatDate(d.SampleDate) + '</strong><br>Program: ' + d.Program + '<br>Result: ' + resultQualCode + formatNum(d['ResultSub']).toString() + ' ' + d.Unit;
    }
}

function tooltipGM(d) {
    var tooltipNumber = d3.format(",.1f");
    var tooltipDate = d3.timeFormat('%b %e, %Y');
    var content = "<strong>" + tooltipDate(d['6WeekCutoffDate']) + ' - ' + tooltipDate(d.SampleDate) + "</strong><br>Geometric Mean: " + tooltipNumber(d['6WeekGeoMean']) + " " + d.Unit + "<br>Sample Count: " + d['6WeekCount'];
    return content;
}

function tooltipThresholdSTV(val, unit) {
    var content = 'Water quality objective/standard<br/> (single sample): ' + formatNum(val) + ' ' + unit + '<br/></br/><i>Results above the objective<br/> indicate a higher risk of illness.</i>';
    return content;
}

function tooltipThresholdGM(val, unit) {
    var content = 'Water quality objective/standard<br/> (geometric mean): ' + formatNum(val) + ' ' + unit + '<br/></br/><i>Results above the objective<br/> indicate a higher risk of illness.</i>';
    return content;
}

