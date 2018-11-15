var Chart = function(opts) {
    this.element = opts.element;
    this.data = opts.data;
    // margin = {top: ?, right: ?, bottom: ?, left: ?}
    this.margin = opts.margin;
    this.width = opts.width;
    this.height = opts.height;
    console.log('initial data:', this.data);

    this.initializeChart();
}

var chartOpacity = 0.8;
var primColor = '#1f78b4', secColor = '#68c182';

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
    this.createTooltip('tooltipLine');
    this.createTooltip('tooltipPoint');
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

Chart.prototype.createBrushAxis = function() {
    this.xBrushAxis = d3.axisBottom(this.xBrushScale)
        .tickSizeOuter(0);
}

Chart.prototype.addBrush = function() {
    this.context.append('g')
        .attr('class', 'brush')
        .call(this.brush)
        .call(this.brush.move, this.xScale.range());
}

Chart.prototype.addBrushAxis = function() {
    this.context.append('g')
        .attr('class', 'x-axis')
        .attr('transform', 'translate(0,' + this.brushHeight + ')')
        .call(this.xBrushAxis);
}

Chart.prototype.drawBrushPoints = function() {
    var _this = this;
    var points = this.context.append('g');
    points.attr('clip-path', 'url("#bClip")');
    points.selectAll('circle')
        .data(this.data)
        .enter().append('circle')
        .attr('class', 'bCircle brush')
        .attr('r', 3)
        .attr('fill', primColor)
        .attr('cx', function(d) { return _this.xBrushScale(d.sampledate); })
        .attr('cy', function(d) { return _this.yBrushScale(d.result); })
        .style('opacity', chartOpacity);
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
    this.yBrushScale = this.linearBrushScale;
}

Chart.prototype.drawBrush = function() {
    this.initializeBrush();
    this.createBrushScales();
    this.createBrush();
    this.createBrushAxis();
    this.addBrushAxis();
    this.addBrush();
}

Chart.prototype.brushed = function(parent) {
    // save brush start and end values
    var selection = d3.event.selection;
    parent.xScale.domain(selection.map(parent.xBrushScale.invert, parent.xBrushScale));
    // manage graph elements when dragged outside extent
    if ((selection[0] >= this.width) || (selection[1] <= 0)) { 
        this.focus.selectAll('.circle').style('opacity', 0);
        this.focus.selectAll('.gCircle').style('opacity', 0);
    } else {
        this.focus.selectAll('.circle').style('opacity', chartOpacity);
        this.focus.selectAll('.gCircle').style('opacity', chartOpacity);
    }
    // redraw graph elements
    parent.focus.selectAll('.circle')
        .attr('cx', function(d) { return parent.xScale(d.sampledate); })
        .attr('cy', function(d) { return parent.yScale(d.result); });
    parent.focus.selectAll('.gCircle')
        .attr('cx', function(d) { return parent.xScale(d.enddate); })
        .attr('cy', function(d) { return parent.yScale(d.geomean); });
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

Chart.prototype.createTooltip = function(name) {
    d3.select('body').append('div')
        .attr('id', name)
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

Chart.prototype.drawChart = function() {

}

Chart.prototype.createScales = function(threshold) {
    // calculate min and max for data
    var xExtent = d3.extent(this.data, function(d,i) { return d.sampledate; });
    var yExtent = d3.extent(this.data, function(d,i) { return d.result; });
    var xBuffered = bufferX(xExtent, 35);  
    var yMax = d3.max(this.data, function(d) { return d.result }); 
    // compare the max Y to the given threshold and pick the greater value
    var yDisplay = Math.max(yMax, threshold);
    // add arbitrary buffer to y axis
    var yBuffered = Math.ceil(roundHundred(yDisplay + (yDisplay / 3)))

    this.xScale = d3.scaleTime()
        .domain(xBuffered)
        .range([0, this.width]);
    this.linearScale = d3.scaleLinear()
        .domain([0, yBuffered])
        .range([this.height, 0]);
    this.logScale = d3.scaleLog() 
        .domain([0.1, yBuffered])
        .range([this.height, 0]);
    this.yScale = this.linearScale;

    function bufferX(extent, days) {
        var extentMin = convertDate(extent[0]);
        var extentMax = convertDate(extent[1]);
        var newMin = extentMin - ((24 * 60 * 60 * 1000) * days); 
        var newMax = extentMax + ((24 * 60 * 60 * 1000) * days);
        return [convertUNIX(newMin), convertUNIX(newMax)];
    }
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
        .ticks(10)
        .tickFormat(function(d) {
            return _this.yScale.tickFormat(10, d3.format(",d"))(d);
        });
}

Chart.prototype.redraw = function() {
    var _this = this;
    this.updateScales();
    d3.selectAll('.y-axis')
        .transition()
        .duration(1000)
        .call(this.yAxis.scale(this.yScale));
    this.updatePoints();
    d3.selectAll('.gCircle')
        .data(geomeanData)
        .transition()
        .duration(1000)
        .attr('cx', function(d) { return _this.xScale(d.enddate); })
        .attr('cy', function(d) { return _this.yScale(d.geomean); });
    var lines = d3.selectAll('.line')
        .data(lineData)
        .transition()
        .duration(1000)
        .attr('y1', function(d) { return _this.yScale(d); })
        .attr('y2', function(d) { return _this.yScale(d); });
}

Chart.prototype.addAxes = function() {
    this.xAxis = d3.axisBottom()
        .scale(this.xScale);
    this.yAxis = d3.axisLeft()
        .scale(this.yScale)
        .ticks(10);
    this.focus.append('g')
        .attr('class', 'x-axis')
        .attr('transform', 'translate(0,' + this.height + ')')
        .call(this.xAxis);
    this.focus.append('g')
        .attr('class', 'y-axis')
        .call(this.yAxis);
}

Chart.prototype.addLine = function(val, color, content) {
    var _this = this;
    var line = _this.focus.append('line')
        .datum(val)
        .attr('class', 'line')
        .style('stroke', color)
        .style('stroke-width', 3)
        .style('stroke-dasharray', ('9, 3'))
        .attr('x1', 0)
        .attr('x2', _this.width)
        .attr('y1', _this.yScale(val))
        .attr('y2', _this.yScale(val))
        .style('opacity', chartOpacity)
        .on('mousemove', function(d) {
            var _d = d;
            _this.toggleTooltip(tooltipLine, 1);
            d3.select(tooltipLine)
                .html(function() { return caller(content, val); })
                .style('left', function() { return _this.positionLineTooltip('x', 'tooltipLine'); })
                .style('top', function() { return _this.positionLineTooltip('y', 'tooltipLine'); })
                .style('border-color', color);
        })
        .on('mouseout', function(d) {
            _this.toggleTooltip(tooltipLine, 0);
        });
}

Chart.prototype.drawPoints = function() {
    var _this = this;
    var points = this.focus.append('g');
    points.attr('clip-path', 'url(#clip)');
    points.selectAll('.circle')
        .data(this.data)
        .enter().append('circle')
        .attr('class', 'circle')
        .attr('r', 6)
        .attr('cx', function(d) { return _this.xScale(d.sampledate); })
        .attr('cy', function(d) { return _this.yScale(d.result); })
        .attr('fill', primColor)
        .style('opacity', chartOpacity)
        .on('mouseover', function(d) {
            var _d = d;
            _this.toggleTooltip(tooltipPoint, 1);
            d3.select(this)
                .attr('fill', '#56f6ff');
            d3.select(tooltipPoint)
                .html(function() { return tooltipResult(_d); })
                .style('left', function() { return _this.positionTooltip('x', 'tooltipPoint'); })
                .style('top', function() { return _this.positionTooltip('y', 'tooltipPoint'); })
                .style('border-color', primColor);
        })
        .on('mouseout', function() {
            _this.toggleTooltip(tooltipPoint, 0);
            d3.select(this)
                .attr('fill', primColor);
        });
}

Chart.prototype.updatePoints = function() {
    var _this = this;
    var points = this.svg.selectAll('.circle');
    points.enter()
        .merge(points)
        .transition()
        .duration(1000)
        .attr('cx', function(d) { return _this.xScale(d.sampledate); })
        .attr('cy', function(d) { return _this.yScale(d.result); });
    points.exit()
        .remove();
}

Chart.prototype.addGPoints = function(data, radius, color, content) {
    var _this = this;
    var points = this.focus.append('g');
    points.attr('clip-path', 'url(#clip)');
    points.selectAll('circle')
        .data(data, function(d) { return d; })
        .enter().append('circle')
        .filter(function(d) { return (d.geomean !== null) && (d.geomean != "NES") })
        .attr('class', 'gCircle')
        .attr('r', radius)
        .attr('fill', color)
        .attr('cx', function(d) { return _this.xScale(d.enddate); })
        .attr('cy', function(d) { return _this.yScale(d.geomean); })
        .style('opacity', chartOpacity)
        .on('mouseover', function(d) {
            var _d = d;
            _this.toggleTooltip(tooltipPoint, 1);
            d3.select(this).attr('fill', '#56f6ff');
            d3.select(tooltipPoint)
                .html(function() { return content.call(this, _d); })
                .style('left', function() { return _this.positionTooltip('x', 'tooltipPoint'); })
                .style('top', function() { return _this.positionTooltip('y', 'tooltipPoint'); })
                .style('border-color', color);
        })
        .on('mouseout', function() {
            _this.toggleTooltip(tooltipPoint, 0);
            d3.select(this)
                .attr('fill', color);
        });
}

Chart.prototype.positionLineTooltip = function(axis, tooltipID) {
    if (axis === 'x') {
        var eventPos = d3.event.pageX;
        var tooltipWidth = document.getElementById(tooltipID).offsetWidth;
        return eventPos - tooltipWidth / 2 + 'px';
    } else if (axis === 'y') {
        var eventPos = d3.event.pageY;
        var tooltipHeight = document.getElementById(tooltipID).offsetHeight;
        return eventPos - tooltipHeight - 15 + 'px';
    }
}

Chart.prototype.positionTooltip = function(axis, tooltipID) {
    // checks for elements plotted in the left/right or top/bottom half of chart and positions the tooltip accordingly
    // axis is 'x' or 'y'
    if (axis === 'x') {
        var eventPos = d3.event.pageX; // get mouse position
        var divExtent = document.getElementById('chart-space').offsetWidth; // get width of container holding chart
        var divOffset = document.getElementById('chart-container').offsetLeft; // get offset of chart container from left (parent container)
        var tooltipExtent = document.getElementById(tooltipID).offsetWidth; // get tooltip div width
    } else if (axis === 'y') {
        var eventPos = d3.event.pageY;
        var divExtent = document.getElementById('chart-container').offsetHeight;
        var divOffset = document.getElementById('chart-container').offsetTop;
        var tooltipExtent = document.getElementById(tooltipID).offsetHeight;
    }
    // calculate element position within container
    var relativePos = eventPos - divOffset; 
    if (relativePos <= (divExtent / 2)) {
        // if event is in the top/left half of graph
        return eventPos + 'px';
    } else {
        // if event is in the bottom/right half of graph
        var tooltipHeight = document.getElementById(tooltipID).offsetHeight;
        return eventPos - tooltipExtent + 'px';
    }
}

Chart.prototype.toggleTooltip = function(id, opacity) {
        d3.select(id) 
            .transition()
                .duration(200)
                .style('opacity', opacity);
}

function tooltipResult(d) {
    var tooltipDate = d3.timeFormat('%b %e, %Y');
    var resultContent = 'Program: ' + d.Program + '<br>Site: ' + d.StationName + '<br>Analyte: ' + d.Analyte + '<br>Date: ' + tooltipDate(d.sampledate) + '<br>Result: ' + d.result + ' ' + d.Unit;
    return resultContent;
}
