var one_day = (24 * 60 * 60 * 1000),
    gm_length = 42; // 6 week rolling geomean


function getGeomeans(data) {
    // sort array descending by sample date
    var orderedData = data.sort(function(a, b) { return a.sampledate - b.sampledate });
    // reference dates
    var firstDate = orderedData[0].sampledate,
        firstDateUNIX = convertDate(firstDate),
        lastDate = orderedData[orderedData.length - 1].sampledate,
        lastDateUNIX = convertDate(lastDate);
    return compileGeomeans();
    
    // compile objects for all date ranges
    function compileGeomeans() {
        var geomeans = [],
            startDate = firstDateUNIX,
            endDate = startDate + one_day * gm_length;
        while (endDate <= lastDateUNIX) {
            var object = createGeomeanObject(startDate, endDate);
            geomeans.push(object);
            startDate += one_day * 7;
            endDate += one_day * 7;
        }
        return geomeans;
    }

    // create an object for the given date range
    // 6-week geomean requires at least 5 data points
    function createGeomeanObject(startDate, cutoffDate) {
        var rangeData = getRangeData(startDate, cutoffDate); 
        if (rangeData.length < 1) {
            var geomean = null; // no data
        } else if (rangeData.length < 5) {
            var geomean = 'NES'; // fewer than 5 data points
        } else {
            var geomean = calculateGeomean(rangeData).toFixed(2);
        }
        return {startdate: convertUNIX(startDate), enddate: convertUNIX(cutoffDate), geomean: geomean};
    }

    // get all data points within a given date range
    function getRangeData(startDate, cutoffDate) {
        var rangeData = [];
        for (var i = 0; i < orderedData.length; i++) {
            if ((orderedData[i].sampledate >= startDate) && (orderedData[i].sampledate <= cutoffDate)) {
                rangeData.push(orderedData[i]);
            }
        }
        return rangeData;
    }

    function calculateGeomean(data) {
        if (!(data.length)) { return null; }
        else {
            var product = 1;
            data.forEach(function(d) {
                product *= d.result;
            });
            var geomean = Math.pow(product, (1 / data.length)); // nth root
            return geomean;
        }
    }
}

