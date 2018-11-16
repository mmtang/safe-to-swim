function getGeomeans(data) {
    var one_day = (24 * 60 * 60 * 1000);
    // define geomean length (42 days = 6 weeks)
    var gm_length = 42;
    // sort array descending by sample date
    var orderedData = data.sort(function(a, b) { return b.sampledate - a.sampledate });
    // reference dates
    var lastDate = orderedData[0].sampledate,
        lastDateUNIX = convertDate(lastDate),
        firstDate = orderedData[orderedData.length - 1].sampledate,
        firstDateUNIX = convertDate(firstDate);
    return compileGeomeans();
    
    // compile objects for all date ranges
    function compileGeomeans() {
        var geomeans = [],
            refDate = lastDateUNIX;
        while (refDate >= firstDateUNIX) {
            var cutoffDate = refDate - one_day * gm_length;
            var object = createGeomeanObject(refDate, cutoffDate);
            // exclude undefined objects (less than 2 samples)
            if (object) { geomeans.push(object); };
            refDate -= one_day * 7;
        }
        console.log('geomeans:', geomeans);
        return geomeans;
    }
    
    // create an object for the given date range
    // geomean calculation requires at least two sample points
    function createGeomeanObject(refDate, cutoffDate) {
        var rangeData = getRangeData(refDate, cutoffDate); 
        if (rangeData.length >= 2) {
            var geomean = calculateGeomean(rangeData).toFixed(2);
            return {enddate: convertUNIX(refDate), startdate: convertUNIX(cutoffDate), geomean: geomean, count: rangeData.length};
        }
    }

    // get all data points within a given date range
    function getRangeData(refDate, cutoffDate) {
        var rangeData = [];
        for (var i = 0; i < orderedData.length; i++) {
            if ((orderedData[i].sampledate <= refDate) && (orderedData[i].sampledate >= cutoffDate)) {
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

