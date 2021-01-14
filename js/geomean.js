/*

California State Water Resources Control Board (SWRCB)
Office of Information Management and Analysis (OIMA) 

Michelle Tang (michelle.tang@waterboards.ca.gov)
https://github.com/mmtang

*/

function getGeomeans(data) {
    // define geomean length (6 weeks = 42 days)
    var gm_length = 42;
    // sort descending by sample date
    var sortedData = data.sort(function(a, b) { return b.SampleDate - a.SampleDate });
    // reference dates
    var lastDate = sortedData[0].SampleDate,
        firstDate = sortedData[sortedData.length - 1].SampleDate,
        lastDateUNIX = convertToTimestamp(lastDate),
        firstDateUNIX = convertToTimestamp(firstDate);
    var all_geomeans = compileGeomeans();
    var final_geomeans = addKey(all_geomeans);
    return final_geomeans;
    
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
        return geomeans;
    }
    
    // create an object for the given date range
    // geomean calculation requires at least two sample points
    function createGeomeanObject(refDate, cutoffDate) {
        var rangeData = getRangeData(refDate, cutoffDate); 
        if (rangeData.length >= 2) {
            var geomean = +calculateGeomean(rangeData).toFixed(2);
            var chartGeomean = +checkForZero(geomean);
            return {
                enddate: convertToDateObj(refDate), 
                startdate: convertToDateObj(cutoffDate), 
                geomean: geomean,  // the actual calculated value based off the calculated result values
                chartGeomean: chartGeomean,  // the value for use in the chart, zeroes are converted to 0.1 so that they can be graphed using a log scale
                count: rangeData.length
            };
        } else {
            return null;
        }
    }

    function checkForZero(d) {
        if (d === 0) {
            return 0.1;
        } else {
            return d;
        }
    }

    // get all data points within a given date range
    function getRangeData(refDate, cutoffDate) {
        var rangeData = [];
        for (var i = 0; i < sortedData.length; i++) {
            if (sortedData[i].SampleDate > refDate) {
                continue;
            } else if ((sortedData[i].SampleDate <= refDate) && (sortedData[i].SampleDate >= cutoffDate)) {
                rangeData.push(sortedData[i]);
            } else if (sortedData[i].SampleDate < cutoffDate) {
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
                product *= d.CalculatedResult;
            });
            var geomean = Math.pow(product, (1 / data.length)); // nth root
            return geomean;
        }
    }

    function addKey(data) {
        for (var i = 0; i < data.length; i++) {
            data[i].key = i + 1;
        }
        return data;
    }
}

