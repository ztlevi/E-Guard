//function hello() {
//    $.ajax({
//        url: "http://localhost/E-Guard/E-Guard-Server/index.php",
//        cache: false,
//        type: "POST",
//        data: JSON.stringify({action: "request", url: "www.test.com"}),
//        dataType: "json"
//    }).done(function (data, textStatus, jqXHR) {
//        MessageSent( data, textStatus, jqXHR);
//    }).fail(function (jqXHR, textStatus, errorThrown) {
//        MessageRejected(jqXHR, textStatus, errorThrown);
//    })
//}
//
//
//function MessageSent(data, textStatus, jqXHR){
//    console.log("Success Message");
//    console.log(data);
//    console.log(textStatus);
//    console.log(jqXHR);
//
//}
//
//function MessageRejected(jqXHR, textStatus, errorThrown){
//    console.log("Error Message:");
//    console.log(jqXHR);
//    console.log(textStatus);
//    console.log(errorThrown);
//}
//
//document.getElementById('test').addEventListener('click', hello);

// declare View_OptionPage Class
var View_OptionPage = function(localStorage) {
    var bg = chrome.extension.getBackgroundPage();

    // Load the Visualization API and the piechart package.
    google.load('visualization', '1.0', {'packages': ['corechart', 'table']});

        // google.charts.load("current", {packages:["corechart"]});
        // google.charts.setOnLoadCallback(drawBar);
    this.getBg = function(){
        return bg;
    }

    // Show options in a new tab
    this.showOptions = function() {
        chrome.tabs.create({
            url: 'options.html'
        });
    }

    // Converts duration to String
    var timeString = function(numSeconds) {
        if (numSeconds === 0) {
            return "0 seconds";
        }
        var remainder = numSeconds;
        var timeStr = "";
        var timeTerms = {
            hour: 3600,
            minute: 60,
            second: 1
        };
        // Don't show seconds if time is more than one hour
        if (remainder >= timeTerms.hour) {
            remainder = remainder - (remainder % timeTerms.minute);
            delete timeTerms.second;
        }
        // Construct the time string
        for (var term in timeTerms) {
            var divisor = timeTerms[term];
            if (remainder >= divisor) {
                var numUnits = Math.floor(remainder / divisor);
                timeStr += numUnits + " " + term;
                // Make it plural
                if (numUnits > 1) {
                    timeStr += "s";
                }
                remainder = remainder % divisor;
                if (remainder) {
                    timeStr += " and ";
                }
            }
        }
        return timeStr;
    }

    // Show the data for the time period indicated by addon
    var displayData = function(type) {
        // Get the domain data
        var domains = JSON.parse(localStorage["domains"]);
        var chart_data = [];
        for (var domain in domains) {
            var domain_data = JSON.parse(localStorage[domain]);
            var numSeconds = 0;
            if (type === bg.TYPE.today) {
                numSeconds = domain_data.today;
            } else if (type === bg.TYPE.average) {
                numSeconds = Math.floor(domain_data.all / parseInt(localStorage["num_days"], 10));
            } else if (type === bg.TYPE.all) {
                numSeconds = domain_data.all;
            } else {
                console.error("No such type: " + type);
            }
            if (numSeconds > 0) {
                chart_data.push([domain, {
                    v: numSeconds,
                    f: timeString(numSeconds),
                    p: {
                        style: "text-align: left; white-space: normal;font-size:15px;"
                    }
                }]);
            }
        }

        // Display help message if no data
        if (chart_data.length === 0) {
            document.getElementById("nodata").style.display = "inline";
        } else {
            document.getElementById("nodata").style.display = "none";
        }

        // Sort data by descending duration
        chart_data.sort(function (a, b) {
            return b[1].v - a[1].v;
        });

        // Limit chart data
        var limited_data = [];
        var chart_limit;
        // For screenshot: if in iframe, image should always have 9 items
        if (top == self) {
            chart_limit = parseInt(localStorage["chart_limit"], 10);
        } else {
            chart_limit = 9;
        }
        for (var i = 0; i < chart_limit && i < chart_data.length; i++) {
            limited_data.push(chart_data[i]);
        }
        var sum = 0;
        for (var i = chart_limit; i < chart_data.length; i++) {
            sum += chart_data[i][1].v;
        }
        // Add time in "other" category for total and average
        var other = JSON.parse(localStorage["other"]);
        if (type === bg.TYPE.average) {
            sum += Math.floor(other.all / parseInt(localStorage["num_days"], 10));
        } else if (type === bg.TYPE.all) {
            sum += other.all;
        }
        if (sum > 0) {
            limited_data.push(["Other", {
                v: sum,
                f: timeString(sum),
                p: {
                    style: "text-align: left; white-space: normal; font-size:15px;"
                }
            }]);
        }

        // Draw the chart
        drawChart(limited_data);
        // Draw the Bar
        drawBar(limited_data, type);

        // Add total time
        var total = JSON.parse(localStorage["total"]);
        var numSeconds = 0;
        if (type === bg.TYPE.today) {
            numSeconds = total.today;

        } else if (type === bg.TYPE.average) {
            numSeconds = Math.floor(total.all / parseInt(localStorage["num_days"], 10));
        } else if (type === bg.TYPE.all) {
            numSeconds = total.all;
        } else {
            console.error("No such type: " + type);
        }
        limited_data.push([{
            v: "Total",
            p: {
                style: "font-weight: bold; font-size:15px;"
            }
        }, {
            v: numSeconds,
            f: timeString(numSeconds),
            p: {
                style: "text-align: left; white-space: normal; font-weight: bold; font-size:15px;"
            }
        }]);

        // Draw the table
        drawTable(limited_data, type);
    }

    var updateNav = function(type) {
        document.getElementById('today').className = '';
        document.getElementById('average').className = '';
        document.getElementById('all').className = '';
        document.getElementById(type).className = 'active';
    }

    this.show = function(mode) {
        bg.mode = mode;
        displayData(mode);
        updateNav(mode);
    }


    // Callback that creates and populates a data table,
    // instantiates the pie chart, passes in the data and
    // draws it.
    var drawChart = function(chart_data) {
        // Create the data table.
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Website');
        data.addColumn('number', 'Time');
        data.addRows(chart_data);

        // Set chart options
        var options = {
            title: "Time Percentage",
            tooltip: {
                text: 'percentage'
            },
            height: 350,
            width: 600,
            chartArea: {
                width: 500,
                height: 300
            },
            slices: {1: {offset: 0.1},
                     3: {offset: 0.1},
                     5: {offset: 0.1},
                     7: {offset: 0.1}},
            is3D: true
        };

        // Instantiate and draw our chart, passing in some options.
        var chart = new google.visualization.PieChart(document.getElementById('chart_div'));
        chart.draw(data, options);
    }

    var drawBar = function (table_data, type) {
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Domain');
        var timeDesc;
        if (type === bg.TYPE.today) {
            timeDesc = "Today";
        } else if (type === bg.TYPE.average) {
            timeDesc = "Daily Average";
        } else if (type === bg.TYPE.all) {
            timeDesc = "Over " + localStorage["num_days"] + " Days";
        } else {
            console.error("No such type: " + type);
        }

        var options = {
            title: "Time Spent Bar Chart",
            'allowHtml': true,
            height: 400,
            width: 600
        };

        data.addColumn('number', "Time Spent (" + timeDesc + ")");
        data.addRows(table_data);

        var bar = new google.visualization.BarChart(document.getElementById('bar_div'));
        bar.draw(data, options);
    }

    var drawTable = function (table_data, type) {
        var cssClassNames = {
            'headerRow': 'italic-darkblue-font large-font bold-font',
            'tableRow': '',
            'oddTableRow': 'beige-background',
            'selectedTableRow': 'orange-background large-font',
            'hoverTableRow': '',
            'headerCell': 'gold-border',
            'tableCell': '',
            'rowNumberCell': 'underline-blue-font'};
        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Domain');
        var timeDesc;
        if (type === bg.TYPE.today) {
            timeDesc = "Today";
        } else if (type === bg.TYPE.average) {
            timeDesc = "Daily Average";        } else if (type === bg.TYPE.all) {
            timeDesc = "Over " + localStorage["num_days"] + " Days";
        } else {
            console.error("No such type: " + type);
        }

        var options = {
            'allowHtml': true,
            'cssClassNames': cssClassNames
        };

        data.addColumn('number', "Time Spent (" + timeDesc + ")");
        data.addRows(table_data);

        var formatter = new google.visualization.ColorFormat();
        formatter.addRange(0, 1800, '#1e90ff', 'white');
        formatter.addRange(1800, null, 'red', 'white');
        formatter.format(data, 1); // Apply formatter to second column

        var table = new google.visualization.Table(document.getElementById('table_div'));
        table.draw(data, options);
    }
}
// Main
var view_optionpage = new View_OptionPage(this.localStorage);
var bg = view_optionpage.getBg();
// Set a callback to run when the Google Visualization API is loaded.
if (top === self) {
    google.setOnLoadCallback(function () {
        view_optionpage.show(bg.TYPE.today);
    });
} else {
    // For screenshot: if in iframe, load the most recently viewed mode
    google.setOnLoadCallback(function () {
        if (bg.mode === bg.TYPE.today) {
            view_optionpage.show(bg.TYPE.today);
        } else if (bg.mode === bg.TYPE.average) {
            view_optionpage.show(bg.TYPE.average);
        } else if (bg.mode === bg.TYPE.all) {
            view_optionpage.show(bg.TYPE.all);
        } else {
            console.error("No such type: " + bg.mode);
        }
    });
}
document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('#today').addEventListener('click', function() { view_optionpage.show(bg.TYPE.today); });
    document.querySelector('#average').addEventListener('click', function() { view_optionpage.show(bg.TYPE.average); });
    document.querySelector('#all').addEventListener('click', function() { view_optionpage.show(bg.TYPE.all); });
    document.querySelector('#options').addEventListener('click', view_optionpage.showOptions);
    document.getElementById('showBar').addEventListener('click',function() {
        document.getElementById("bar_div").hidden = false;
        document.getElementById("table_div").hidden = true;
        document.getElementById("chart_div").hidden = true;
        document.getElementById("showBar").hidden = true;
        document.getElementById("showTable").hidden = false;
        document.getElementById("showChart").hidden = false;
    });
    document.getElementById('showTable').addEventListener('click',function() {
        document.getElementById("table_div").hidden = false;
        document.getElementById("bar_div").hidden = true;
        document.getElementById("chart_div").hidden = true;
        document.getElementById("showBar").hidden = false;
        document.getElementById("showChart").hidden = false;
        document.getElementById("showTable").hidden = true;
    });
    document.getElementById('showChart').addEventListener('click',function() {
        document.getElementById("chart_div").hidden = false;
        document.getElementById("table_div").hidden = true;
        document.getElementById("bar_div").hidden = true;
        document.getElementById("showChart").hidden = true;
        document.getElementById("showTable").hidden = false;
        document.getElementById("showBar").hidden = false;
    });
});

setInterval(updateTimer(this.localStorage), 1000);
function updateTimer(localStorage){
    var limitedTime = parseInt(localStorage["timeLimitation"]);
    document.getElementById("time").textContent = "Time Limitation: " + limitedTime/3600 + " hours";
}
