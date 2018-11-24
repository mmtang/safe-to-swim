function getGeomeans(data) {
    // define geomean length (6 weeks = 42 days)
    var gm_length = 42;
    // sort descending by sample date
    var sortedData = data.sort(function(a, b) { return b.sampledate - a.sampledate });
    // reference dates
    var lastDate = sortedData[0].sampledate,
        firstDate = sortedData[sortedData.length - 1].sampledate,
        lastDateUNIX = convertDate(lastDate),
        firstDateUNIX = convertDate(firstDate);
    return compileGeomeans();
    
    // create objects for all date ranges
    function compileGeomeans() {
        var geomeans = [];
        var refDate = lastDateUNIX;
        while (refDate >= firstDateUNIX) {
            var cutoffDate = refDate - MS_PER_DAY * gm_length;
            var object = createGeomeanObject(refDate, cutoffDate);
            // createGeomeanObject can return null if there are not enough sample points
            if (object) { geomeans.push(object); }
            refDate -= (MS_PER_DAY * 7);
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
        } else {
            return null;
        }
    }

    // get all data points within a given date range
    function getRangeData(refDate, cutoffDate) {
        var rangeData = [];
        for (var i = 0; i < sortedData.length; i++) {
            if (sortedData[i].sampledate > refDate) {
                continue;
            } else if ((sortedData[i].sampledate <= refDate) && (sortedData[i].sampledate >= cutoffDate)) {
                rangeData.push(sortedData[i]);
            } else if (sortedData[i].sampldate < cutoffDate) {
                break;
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

