# ChartJS SAP OData
This is a small library I created for working with SAP OData sources (Such as BEx Queries), specifically for building dashboards with ChartJS and JQuery.

I have a number of SAP BEx Queries which I wanted to bring together into a modern responsive dashboard using (Chart.js)[https://www.chartjs.org].

It is possible to publish SAP BEx Queries as OData sources which are accessible through the SAP Netweaver Gateway. I wrote this library to define the OData source and then interact with the query.

# Example Architecture
Modern Web Browser <-> HTTP Server <-> SAP BW Server

The browser has to support HTML5 - I've tested Chrome, Safari, Edge, Mobile Safari and all work perfect. IE does not work.

The HTTP Server serves up the static javascript/html page to the browser. It also hosts a proxy script which serves three purposes:

1. It works around Access-Control-Allow-Origin problems
2. It prevents the user from having to sign in to see the dashboard as the proxy script stores credentials
3. It can cache data to speed up the loading


# Example Code
```javascript
// Create an odataSource object
// useCache will tell the proxy script to cache the metadata of the query
var ZPURCHASE_ODATA = new odataSource({
	url: "http://sapbw.host.mycompany.com:8080/sap/opu/odata/sap/",
	queryName: "ZPURCHASE_ODATA",
	useCache: true
});

// ZPURCHASE_ODATA.metadata contains all fields in the query which can be used in a drill down and/or filter
// ZPURCHASE_ODATA.parameters contains all variables (selection parameters) from the BEx variable screen

// Create a query object which references the odata source
// useCache will tell the proxy script to cache the queried data
var myQuery = new query({
	odataSource: ZPURCHASE_ODATA,
	useCache: true
});

// Set the selection parameters (variables)
// We want all data from the first 3 months of 2018 in currency USD
myQuery.setVariables({
	ZP_TBCUR: "USD",
	ZFISCAL_RIOD_YEAR_MAND_RANGE: "01-2018",
	ZFISCAL_RIOD_YEAR_MAND_RANGETo: "03-2018"
});


// Set the fields which we should aggregate/summarize by in the drill down
// A0FISCPER_T = Fiscal Year / Period
// A0COMP_CODE = Company Code
// F30MFF3ZH9WKHI9N417BMQYR0 = Net Value of purchased items
myQuery.setAggregateBy(["A0FISCPER","A0COMP_CODE","F30MFF3ZH9WKHI9N417BMQYR0"]);


// Set any filters that should be applied
// This filter removes company code ABC1
myQuery.setFilter(
	[{
		field:"A0COMP_CODE",
		operator:"ne",
		value:"ABC1"
	}]
);

// Now that we have specified the query, the aggregation, the parameters and the filter, we can output the ODATA URL (useful for testing)
console.log(myQuery.makeURL());

// Now finally run the query
myQuery.runQuery(function(thisQuery){
	// Do something with the returned data
});

```

This library provides a series of functions for converting the data into something we can quickly use in ChartJS
	
__getSeriesValues__ returns an array of unique values for the specified field
`thisQuery.getSeriesValues("A0COMP_CODE");` Will return a unique array of company codes, which could be used for building up the chart series, say one line for each company
	
__extractData__ returns a data array in a format that ChartJS understands
* _field_ - the name of the field who's value will be charted - this is usually a key figure
* _filter_ - Which records to restrict to. [{field:"A0COMP_CODE", value:"XYZ1"}] will return only the records where company code is equal to XYZ1
* _key_field_ - optional - a field to key the `field` by - used to line up X & Y 
* _format_ - the format the data is returned in.
* * _array_ gives a standard unindexed array of values
* * _object_ returns an object where the properties are the key_field and the value is the field
* * _point_ returns an array of x,y point objects where x is the key_field and y is the field

`thisQuery.extractData({field:"F30MFF3ZH9WKHI9N417BMQYR0", filter: [{field:"A0COMP_CODE", value:"XYZ1"}], format:"array"});`
	
Returns `[20,15,32]`

`thisQuery.extractData({field:"F30MFF3ZH9WKHI9N417BMQYR0", filter: [{field:"A0COMP_CODE", value:"XYZ1"}], key_field:"A0FISCPER", format:"object"});`
	
Returns `{"01-2018": 20, "02-2018": 15, "03-2018": 32}`

`thisQuery.extractData({field:"F30MFF3ZH9WKHI9N417BMQYR0", filter: [{field:"A0COMP_CODE", value:"XYZ1"}], key_field:"A0FISCPER", format:"point"});`
	
Returns `[{x: "01-2018",y: 20}, {x: "02-2018",y: 15}, {x: "03-2018",y: 32}]`

# Create a Chart
``` javascript
myLineChart = new Chart($("#my_chart_canvas"), {
	type: 'line',
	data: {
		labels: [],
		datasets: []
	}
});
```

# Create the label & datasets

To run the query and write a callback function to process the data. This process is asynchronous

``` javascript

myQuery.runQuery(function(thisQuery){
	console.log(thisQuery); //
	// thisQuery.dataSet contains the raw data, but normally you only need to use the class methods to interact with it
	
	// Assign the labels
	myLineChart.data.labels = thisQuery.getSeriesValues("A0FISCPER");
	
	// Build the dataset array. We will have one dataset per company code
	// loop through all of the company codes from the dataSet
	thisQuery.getSeriesValues("A0COMP_CODE").forEach((comp_code) => {
		// Now extract the data for that company code as a x/y point
		var comp_data = thisQuery.extractData({
				field:"F30MFF3ZH9WKHI9N417BMQYR0",
				filter: [{field:"A0COMP_CODE", value:comp_code}],
				key_field:"A0FISCPER",
				format:"point"
			});
		
		// Now push it onto the ChartJS dataset array
		myLineChart.data.datasets.push({
			label: comp_code,
			data: comp_data
		});
	});

	// Render the chart
	myLineChart.update();
});

```
