/*************************************************************
*************************************************************/

// callback for processData
function createChart(data) {
    // instantiate new Chart class object
    var chartMargin = {top: 10, right: 20, bottom: 90, left: 50};
    var chart = new Chart({
        element: document.getElementById('chart-container'),
        margin: chartMargin,
        data: data,
        width: 960,
        height: 400
    });
}

var Chart = function(opts) {
    this.element = opts.element;
    this.data = opts.data;
    // margin = {top: ?, right: ?, bottom: ?, left: ?}
    this.margin = opts.margin;
    this.width = opts.width;
    this.height = opts.height;

    this.initializeChart();
    this.drawChart();
    this.initializeBrush();
    this.drawBrush();
}

Chart.prototype.initializeChart = function() {
    this.element.innerHTML = '';
    this.svg = d3.select(this.element).append('svg')
        .attr('id', 'graph')
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom);
    this.focus = this.svg.append('g')
        .attr('class', 'focus')
        .attr('transform', 'translate(' + this.margin.left + ', ' + (this.margin.top + 10) + ')');
    // add geometry for clipping chart elements
    this.svg.append('defs').append('clipPath')
            .attr('id', 'clip')
        .append('rect')
            .attr('width', this.width)
            .attr('height', this.height);
    this.clearGraph();
}

Chart.prototype.initializeBrush = function() {
    this.brushHeight = 25;
    // position of brush from top of graph
    var brushSpace = this.height + this.brushHeight + 20;
    this.brushMargin = {top: brushSpace, right: 20, bottom: 10, left: 50};
    // create svg for chart brush
    this.context = this.svg.append('g')
        .attr('class', 'context')
        .attr('transform', 'translate(' + this.brushMargin.left + ',' + (this.brushMargin.top + 10) + ')');
    // add geometry for clipping brush elements
    this.context.append('defs').append('clipPath')
            .attr('id', 'clip')
        .append('rect')
            .attr('width', this.width)
            .attr('height', this.height);
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

Chart.prototype.createBrush = function() {
    var _this = this;
    this.brush = d3.brushX()
        .extent([[0, 0], [this.width, this.brushHeight]])
        .on('brush', function() { _this.brushed(_this); })
        .on('end', function() { var s = d3.event.selection; });
}

Chart.prototype.createBrushScales = function() {
    this.xBrushScale = d3.scaleTime().range([0, this.width]);
    this.yBrushScale = d3.scaleLinear().range([this.brushHeight, 0]);
    this.xBrushScale.domain(this.xScale.domain());
    this.yBrushScale.domain(this.yScale.domain());
}

Chart.prototype.drawBrush = function() {
    this.createBrushScales();
    this.createBrush();
    this.addBrush();
    this.createBrushAxis();
    this.addBrushAxis();
}

Chart.prototype.brushed = function(parent) {
    // save brush start and end values
    var selection = d3.event.selection;
    parent.xScale.domain(selection.map(parent.xBrushScale.invert, parent.xBrushScale));
    // manage graph elements when dragged outside extent
    if (selection[0] >= this.width) { 
        this.focus.selectAll('.circle')
            .style('opacity', 0);
        this.focus.selectAll('.line')
            .style('opacity', 0);
        this.focus.selectAll('.x-axis')
            .style('opacity', 0);
    } else {
        this.focus.selectAll('.circle')
            .style('opacity', 0.7);
        this.focus.selectAll('.line')
            .style('opacity', 0.7);
        this.focus.selectAll('.x-axis')
            .style('opacity', 1);
    }
    // redraw graph elements
    parent.focus.selectAll('.circle')
        .attr('cx', function(d) { return parent.xScale(d.sampleDate); })
        .attr('cy', function(d) { return parent.yScale(d.result); });
    parent.focus.select('.x-axis').call(parent.xAxis);
}

Chart.prototype.clearGraph = function() {
    d3.selectAll('.tooltip').remove();
}

Chart.prototype.createTooltip = function(name) {
    d3.select('body').append('div')
        .attr('id', name)
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

Chart.prototype.drawChart = function() {
    this.createScales();
    this.addAxes();
    var stvLine = this.addLine(9320, '#ed3935', tooltipSTV);
    var results = this.addPoints(this.data, 6, 'rgb(51, 91, 150)', tooltipResult);
}

Chart.prototype.createScales = function() {
    // calculate min and max for data
    var xExtent = d3.extent(this.data, function(d,i) { return d.sampleDate; });
    var yExtent = d3.extent(this.data, function(d,i) { return d.result; });
    // force zero baseline if all data points are positive
    if (yExtent[0] > 0) {
        yExtent[0] = 0;
    }
    this.xScale = d3.scaleTime()
        .domain(xExtent)
        .range([0, this.width]);
    this.yScale = d3.scaleLinear()
        .domain(yExtent)
        .range([this.height, 0]);
}

Chart.prototype.addAxes = function() {
    this.xAxis = d3.axisBottom()
        .scale(this.xScale);
    this.yAxis = d3.axisLeft()
        .scale(this.yScale);
    this.focus.append('g')
        .attr('class', 'x-axis')
        .attr('transform', 'translate(0,' + this.height + ')')
        .call(this.xAxis);
    this.focus.append('g')
        .attr('class', 'y-axis')
        .call(this.yAxis);
}

Chart.prototype.addLine = function(val, color, content) {
    //initialize tooltip
    this.createTooltip('tooltipLine');

    var _this = this;
    var line = _this.focus.append('line')
        .attr('class', 'line')
        .style('stroke', color)
        .style('stroke-width', 2.5)
        .style('stroke-dasharray', ('9, 3'))
        .attr('x1', 0)
        .attr('x2', _this.width)
        .attr('y1', _this.yScale(val))
        .attr('y2', _this.yScale(val))
        .on('mousemove', function(d) {
            var _d = d;
            _this.toggleTooltip(tooltipLine, 1);
            d3.select(tooltipLine)
                .html(function() { return content.call(this, _d) })
                .style('left', function() { return _this.positionLineTooltip('x', 'tooltipLine'); })
                .style('top', function() { return _this.positionLineTooltip('y', 'tooltipLine'); })
                .style('border-color', color);
        })
        .on('mouseout', function(d) {
            _this.toggleTooltip(tooltipLine, 0);
        });
}

Chart.prototype.createTooltip = function(name) {
    d3.select('body').append('div')
        .attr('id', name)
        .attr('class', 'tooltip')
        .style('opacity', 0);
}

Chart.prototype.addPoints = function(data, radius, color, content) {
    //initialize tooltip
    this.createTooltip('tooltipPoint');

    var _this = this;
    var points = this.focus.append('g');
    points.attr('clip-path', 'url(#clip)');
    points.selectAll('circle')
        .data(data)
        .enter().append('circle')
        .attr('class', 'circle')
        .attr('r', radius)
        .attr('fill', color)
        .attr('cx', function(d) { return _this.xScale(d.sampleDate); })
        .attr('cy', function(d) { return _this.yScale(d.result); })
        .style('opacity', 0.7)
        .on('mouseover', function(d) {
            var _d = d;
            _this.toggleTooltip(tooltipPoint, 1);
            d3.select(this).attr('fill', '#84c0e3');
            d3.select(tooltipPoint)
                .html(function() { return content.call(this, _d); })
                .style('left', function() { return _this.positionTooltip('x', 'tooltipPoint'); })
                .style('top', function() { return _this.positionTooltip('y', 'tooltipPoint'); })
                .style('border-color', color);
        })
        .on('mouseout', function() {
            _this.toggleTooltip(tooltipPoint, 0);
            d3.select(this)
                .attr('fill', 'rgb(51, 91, 150)');
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
        var eventPos = d3.event.pageX;
        var divExtent = document.getElementById('chart-container').offsetWidth;
        var divOffset = document.getElementById('chart-container').offsetLeft;
        var tooltipExtent = document.getElementById(tooltipID).offsetWidth;
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
