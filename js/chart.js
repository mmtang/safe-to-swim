/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

var Chart = function(opts) {
    this.element = opts.element;
    this.data = opts.data;
    this.gData = [];
    this.margin = opts.margin;
    this.width = opts.width;
    this.height = opts.height;
    this.initializeChart();
}

Chart.prototype.addAxes = function() {
    var _this = this;
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
        .attr('class', 'y-axis')
        .call(this.yAxis);
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

Chart.prototype.addLine = function(val, type, color) {
    var _this = this;
    if (type === 'stv') {
        var color = mainColor;
    } else if (type === 'gm') {
        var color = secColor;
    }

    this.focus.append('line')
        .datum(val)
        .attr('class', 'line ' + type)
        .style('stroke', color)
        .style('stroke-width', 3)
        .attr('x1', 0)
        .attr('x2', _this.width)
        .attr('y1', _this.yScale(val))
        .attr('y2', _this.yScale(val))
        .style('opacity', chartOpacity)
        .on('mousemove', function(d) {
            toggleTooltip(tooltipLine, 1);
            d3.select(tooltipLine)
                .html(function() { 
                    if (type === 'stv') {
                        return tooltipThresholdSTV(val); 
                    } else if (type === 'gm') {
                        return tooltipThresholdGM(val);
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
        .attr('cy', function(d) { return parent.yScale(d.ChartResult); });
    parent.focus.selectAll('.triangle')
        .attr('transform', function(d) { return 'translate(' + parent.xScale(d.enddate) + ',' + parent.yScale(d.chartGeomean) + ')'; })
    parent.focus.select('.x-axis').call(parent.xAxis);
    // update date placeholders
    var formatDate = d3.timeFormat("%b %e, %Y");
    $(".js-start-date").text(formatDate(this.xBrushScale.invert(selection[0])));
    $(".js-end-date").text(formatDate(this.xBrushScale.invert(selection[1])));
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
    // calculate min and max for data
    var xExtent = d3.extent(this.data, function(d,i) { return d.SampleDate; });
    var xBuffered = bufferX(xExtent, 35);  
    // compare the max Y to the threshold and pick the greater value
    var yMax = d3.max(this.data, function(d) { return d.ChartResult }); 
    var yDisplay = Math.max(yMax, threshold);
    // add arbitrary buffer to y axis
    var yLinearBuffered = Math.ceil(roundHundred(yDisplay + (yDisplay / 3)));
    var yLogBuffered = Math.ceil(roundHundred(yDisplay + (yDisplay / 2)));

    this.xScale = d3.scaleTime()
        .domain(xBuffered)
        .range([0, this.width]);
    this.linearScale = d3.scaleLinear()
        .domain([0, yLinearBuffered])
        .range([this.height, 0]);
    this.logScale = d3.scaleLog() 
        .domain([0.1, yLogBuffered])
        .range([this.height, 0]);
    // set to log on creation
    this.yScale = this.logScale;

    function bufferX(extent, days) {
        var min = convertToTimestamp(extent[0]);
        var max = convertToTimestamp(extent[1]);
        var newMin = min - MS_PER_DAY * days; 
        var newMax = max + MS_PER_DAY * days;
        return [convertToDateObj(newMin), convertToDateObj(newMax)];
    }
}

Chart.prototype.drawBrush = function() {
    this.initializeBrush();
    this.createBrushScales();
    this.createBrush();
    this.addBrushAxis();
    this.addBrush();
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
        .attr('cy', function(d) { return _this.yBrushScale(d.ChartResult); })
        .style('opacity', chartOpacity);
}

Chart.prototype.drawGPoints = function() {
    var _this = this;
    var gPoints = this.focus.append('g')
        .attr('clip-path', 'url(#clip)');
    gPoints.selectAll('.triangle')
        .data(this.gData, function(d) { return d; })
        .enter().append('path')
        .attr('class', 'triangle')
        .attr('d', d3.symbol().type(d3.symbolTriangle))
        .attr('transform', function(d) { return 'translate(' + _this.xScale(d.enddate) + ',' + _this.yScale(d.chartGeomean) + ')'; })
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
        .attr('transform', function(d) { return 'translate(' + _this.xScale(d.enddate) + ',' + _this.yScale(d.chartGeomean) + ')'; });
    gPoints.exit()
        .remove();

    function drawRect(d) {
        var _d = d;
        _this.gmRect
            .attr('visibility', 'visible')
            .attr('x', function() { return _this.xScale(_d.startdate); })
            .attr('y', 0)
            .attr('width', function() { return _this.xScale(_d.enddate) - _this.xScale(_d.startdate); })
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

Chart.prototype.drawLines = function(analyte) {
    if (analyte === ecoli.name) {
        this.addLine(ecoli.stv, 'stv');
        this.addLine(ecoli.geomean, 'gm');
    } else if (analyte === enterococcus.name) {
        this.addLine(enterococcus.stv, 'stv');
        this.addLine(enterococcus.geomean, 'gm');
    }
}

Chart.prototype.drawPoints = function() {
    var _this = this;
    var points = this.focus.append('g')
        .attr('clip-path', 'url(#clip)');
    points.selectAll('.circle')
        .data(this.data)
        .enter().append('circle')
        .attr('class', 'circle')
        .attr('r', 6)
        .attr('cx', function(d) { return _this.xScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yScale(d.ChartResult); })
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
        .attr('cy', function(d) { return _this.yScale(d.ChartResult); })
    points.exit()
        .remove();
}

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
        .attr('id', 'graph')
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom)
        .call(responsive);
    this.focus = this.svg.append('g')
        .attr('class', 'focus')
        .attr('transform', 'translate(' + this.margin.left + ', ' + (this.margin.top + 10) + ')');
    // add geometry for clipping chart elements
    this.svg.append('defs').append('clipPath')
            .attr('id', 'clip')
        .append('rect')
            .attr('width', this.width)
            .attr('height', this.height);
    // initialize tooltips
    createTooltip('tooltipLine');
    createTooltip('tooltipPoint');
    // initialize gm rectangle, one element only
    // draw this first, under the other elements
    this.gmRect = this.focus.append('rect')
        .attr('clip-path', 'url(#clip)')
        .attr('class', 'gm-rect');
}

Chart.prototype.redraw = function() {
    this.updateScales();
    this.updateAxis();
    this.updatePoints();
    this.updateGPoints();
    this.updateObjectives();
    this.updateBrushPoints();
}

Chart.prototype.updateAxis = function() {
    d3.selectAll('.y-axis')
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
        .attr('transform', function(d) { return 'translate(' + _this.xScale(d.enddate) + ',' + _this.yScale(d.chartGeomean) + ')'; });
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
        .attr('y1', function(d) { return _this.yScale(d); })
        .attr('y2', function(d) { return _this.yScale(d); });
}

Chart.prototype.updatePoints = function() {
    var _this = this;
    var points = this.svg.selectAll('.circle');
    points.enter()
        .merge(points)
        .transition()
        .duration(1000)
        .attr('cx', function(d) { return _this.xScale(d.SampleDate); })
        .attr('cy', function(d) { return _this.yScale(d.ChartResult); });
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
        .attr('cy', function(d) { return _this.yBrushScale(d.ChartResult); })
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
    var divExtent = document.getElementById('chart-space').offsetWidth; // get width of container holding chart
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

function tooltipResult(d) {;
    var tooltipDate = d3.timeFormat('%b %e, %Y');
    var resultContent = '<strong>' + tooltipDate(d.SampleDate) + '</strong><br>Program: ' + d.Program + '<br>Result: ' + d['CalculatedResult'].toString() + ' ' + d.Unit;
    return resultContent;
}

function tooltipGM(d) {
    var tooltipNumber = d3.format(",.1f");
    var tooltipDate = d3.timeFormat('%b %e, %Y');
    var content = "<strong>" + tooltipDate(d.startdate) + ' - ' + tooltipDate(d.enddate) + "</strong><br>Geometric Mean: " + tooltipNumber(d.geomean) + " MPN/100 mL<br>Sample Count: " + d.count;
    return content;
}

function tooltipThresholdSTV(val) {
    var content = 'Statistical Threshold Value (STV):<br/>' + val + ' cfu/100 mL';
    return content;
}

function tooltipThresholdGM(val) {
    var content = 'Geomean Threshold:<br/>' + val + ' cfu/100 mL';
    return content;
}

