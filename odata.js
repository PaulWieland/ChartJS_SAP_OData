var _metadata = {}; // meta data cache

// options: url,queryName,useCache
function odataSource(options){
	this.url = options.url;
	this.queryName = options.queryName;
	this.useCache = (options.useCache ? 1 : 0);

	this.metadata = []; // array of objects representing the characteristics and key figures
	this.parameters = []; // array of objects representing the parameters available on the variable screen

	this.loadMetaData = function(){
		// check and pull from the cache
		if(this.useCache && _metadata[this.queryName]){
			this.metadata = _metadata[this.queryName].metadata;
			this.paramaters = _metadata[this.queryName].paramaters;
			return;
		}
		
		var thisObj = this;
		thisObj.metadataUrl = thisObj.url + thisObj.queryName +"_SRV/$metadata";

		$.ajax({
			async: false,
			type: "POST",
			data: {url: thisObj.metadataUrl, usecache: thisObj.useCache},
			url: _proxy_url,
			dataType: 'xml',
			success: function (xml){
			  var attributes = ["Name","sap:label","sap:aggregation-role","sap:text"];

			  // Find all of the Properties entities from the XML - these are the fields in the data source
			  for(var i=0; i<$(xml).find("EntityType[sap\\:semantics=aggregate]").find("Property").length; i++){
				  thisObj.metadata[i] = {};

				  // Extract the XML attributes for each field (name, label, agregation role, etc)
				  for(var k=0; k<attributes.length; k++){
					  thisObj.metadata[i][attributes[k]] = $(xml).find("EntityType[sap\\:semantics=aggregate]").find("Property").eq(i).attr(attributes[k]);
				  }
			  }

			  // Find all of the parameters from the variable screen
			  var validParams = [];
			  for(var i=0; i<$(xml).find("EntityType[sap\\:semantics=parameters] Key PropertyRef").length; i++){
				  validParams.push( $(xml).find("EntityType[sap\\:semantics=parameters] Key PropertyRef").eq(i).attr("Name"));
			  }
			  
			  for(var i=0; i<$(xml).find("EntityType[sap\\:semantics=parameters]").find("Property").length; i++){
				  var param = {};
				  
				  // Extract the XML attributes for each field (name, label, agregation role, etc)
				  for(var k=0; k<attributes.length; k++){
					  param[attributes[k]] = $(xml).find("EntityType[sap\\:semantics=parameters]").find("Property").eq(i).attr(attributes[k]);
				  }
				  // If the param is in the list of valid parameters, add it to the object parameter list
				  if(validParams.indexOf(param.Name) > -1){
					  thisObj.parameters.push(param);
				  }
			  }
			  
			  if(thisObj.metadata.length == 0){
				  console.log("No metadata found for "+thisObj.queryName)
				  console.log("Check "+thisObj.metadataUrl);
			  }
			  
			  // update the cache
			  _metadata[this.queryName] = {};
			  _metadata[this.queryName].metadata = this.metadata;
			  _metadata[this.queryName].parameters = this.parameters;
			},
			error: function(er){
				console.log("Error loading Metadata for "+thisObj.queryName);
				console.log(er);
			}
		});
	}
	
	this.loadMetaData();
} // END odataSource Class

// options: odataSource,useCache
function query(options){
	this.odataSource = options.odataSource;
	this.useCache = (options.useCache ? 1 : 0);

	this.dataSet = []; // holds the data set after runQuery is executed
	this.aggregateBy = []; // characteristics & key figures to aggregate by in rows - array of field ids from metadata. key figures must go last.
	this.variables = {};   // the selection variables (variable screen in bex)
	this.filter = [];      // the filters to apply after the selection. array of objects. each object contains field id, operator, value. [{"field":"xyz","operator":"ne","value":"exclude me"}]
	
	// Helper function
	this.makeArrayOfProperties = function(object_list,property_name){
		var retval = [];
		for(var i in object_list){
			retval.push(object_list[i][property_name]);
		}
		return retval;
	}
	
	// returns a field object based on the field_id (which is called "Name" in the metadata)
	// this.getField = function(field_id){
	// 	for(var i in this.metadata){
	// 		if(this.metadata[i].Name == field_id) return this.metadata[i];
	// 	}
	// }


	// field_list must be an array of field ids from metadata. the id is confusingly called "Name" in the metadata xml
	this.setAggregateBy = function(field_list){
		if(!jQuery.isArray(field_list)){
			console.trace();
			console.log(field_list +" is not an array.");
		}
		
		var fields = this.makeArrayOfProperties(this.odataSource.metadata,"Name");

		// Convert the label list array into field id array
		for(var i in field_list){
			if(fields.indexOf(field_list[i]) == -1){
				console.trace();
				console.log("Error: `"+field_list[i]+"` is not a valid field. Valid fields are ["+fields.join(", ")+"]");
				return;
			}
		}
		
		this.aggregateBy = field_list;
	}
					
	// needs an object. each property must be a valid parameter ID
	this.setVariables = function(obj){
		var params = this.makeArrayOfProperties(this.odataSource.parameters,"Name");

		for(var i in obj){
			if(params.indexOf(i) == -1){
				console.trace();
				console.log("Error: `"+i+"` is not a valid parameter. Valid parameters are ["+params.join(", ")+"]");
				this.variables = {};
				return;
			}
		}

		this.variables = obj;
	}

	// Validate an array of objects.
	// Filters are specified like this: `fieldID1 ne value, fieldID2 eq value2`
	// In order to build this string, object_list is an array of objects. each object must have field, operator, value.
	this.setFilter = function(object_list){
		if(!jQuery.isArray(object_list)){
			console.trace();
			console.log(field_list +" is not an array.");
		}
		
		var fields = this.makeArrayOfProperties(this.odataSource.metadata,"Name");
		
		for(var i in object_list){
			if(object_list[i].field === undefined || object_list[i].operator === undefined || object_list[i].value === undefined){
				console.trace();
				console.log("filter object missing a required property. [`field`,`operator`,`value`] are required properties:  "+ JSON.stringify(object_list[i]));
				return;
			}else if(fields.indexOf(object_list[i].field) === -1){
				console.trace();
				console.log("Error: `"+object_list[i].field+"` is not a valid field. Valid fields are ["+fields.join(", ")+"]");
				return;
			}
		}
		this.filter = object_list;
	}
	

	// Make a string of all parameters + defined variables for the odata url
	this.makeVariableString = function(){
		var params = this.makeArrayOfProperties(this.odataSource.parameters,"Name");
		inputParametersString = "(" + params.join("='',") + "='')/";

		for(var i in this.variables){
			inputParametersString = inputParametersString.replace(i+"=''",i+"='"+encodeURIComponent(this.variables[i])+"'");
		}
		
		return inputParametersString;
	}
	
	// Convert the aggregateBy field list into a string for the query
	this.makeAggregateByString = function(){
		return this.aggregateBy.join(",");
	}
	
	// Convert the array of filter objects into a filter string
	this.makeFilterString = function(){
		var filterString = [];
		
		for(var i in this.filter){
			if(this.filter[i].operator === "startswith"){
				filterString.push("startswith("+this.filter[i].field+",'"+this.filter[i].value+"')");
			}else{
				filterString.push(this.filter[i].field +" "+ this.filter[i].operator +" '"+ this.filter[i].value + "'");
			}
		}
		
		return filterString.join(" and ");
	}
	
	// Data processing functions
	// Get a field by id
	this.getFieldByID = function(id){
		var retval = {};
		
		this.odataSource.metadata.forEach((field) => {
			if(field["Name"].toLowerCase() == id.toLowerCase()){
				retval = field;
			}
		});
		return retval;
	}
	
	// Get a unique set of values for a given field id
	this.getSeriesValues = function(field){
		var retval = [];

	 			// Get all of the possible values for this field
		for(var i=0; i<this.dataSet.length; i++){
			if(retval.indexOf(this.dataSet[i][field]) == -1){
				retval.push(this.dataSet[i][field]);
			}
		}

		return retval;
	}
	
	// Get the specified key figure from the dataset where the characteristic values match
	// Options {field:, filter:{field: , value: }, value:, key_field:, format:array|point|object}
	this.extractData = function(options){
		var field = options.field; // The field to extract, normally a key figure but can be a characteristic
		var filters = options.filter || []; // An array of objects containing characteristic & value properites 
		// var characteristic = options.characteristic; // The characteristic to filter with
		// var value = options.value; // The value the characteristic must be


		var format = options.format || "array"; // The format to return, `array` (no key_field used), `point` (x/y object for chartjs e.g. [{x: "Jan", y: 10}, {x: "Mar", y: 5}]), or `object` (key:value pairs).
		var key_field = format === "array" ? undefined : options.key_field; // The key field to index the return with. required if format is point or object. not used for array
		
				
		// if(this.aggregateBy.indexOf(field) === -1){ console.trace(); console.log("Not in aggregate field list: `"+field+"`. Aggregated fields are ["+this.aggregateBy.join(", ")+"]"); }
		// if(this.aggregateBy.indexOf(characteristic) === -1){ console.trace(); console.log("Not in aggregate field list: `"+field+"`. Aggregated fields are ["+this.aggregateBy.join(", ")+"]"); }

		var retval = (format === "object" ? {} : []); // Return an object if the format is object, all other formats are an array
		
		// Filter the dataSet down to just those records that have a characteristic with the specified value
		var filtered = this.dataSet.filter(function(el){
		    return filters.every(filter => el[filter.field] === filter.value);			
			// return filtersel[characteristic] === value;
		});

		if(key_field !== undefined){
			if(format === "point"){
				// Extract the key figure and put it into an array to be returned
				filtered.forEach((el) => {
					var point = {};
					point.x = el[key_field];
					point.y = el[field];
			
					retval.push(point);
				});
			}else if(format === "object"){
				filtered.forEach((el) => {
					retval[el[key_field]] = el[field];
				});
			}
		}else{
			// Extract the key figure and put it into an array to be returned
			filtered.forEach((el) => {
				retval.push(el[field]);
			});
		}
		
		return retval;
	}
	

	// make the URL for the odata source givne the provided variables/paramaters, aggregation fields & filter
	this.makeURL = function(){
		return this.odataSource.url + this.odataSource.queryName + "_SRV/" + this.odataSource.queryName + this.makeVariableString() + "Results?$select="+ this.makeAggregateByString() +"&$filter="+encodeURIComponent(this.makeFilterString()) +"&$format=json";
	}
	
	
	this.runQuery = function(callback){
		var thisObj = this;
		
		$.ajax
		({
		  async: true,
		  timeout: 400000,
		  type: "POST",
		  url: _proxy_url,
          data: {url: thisObj.makeURL(), usecache: thisObj.useCache},
		  dataType: 'json',
		  success: function (obj){
			  if(obj !== null && obj.d !== null && typeof(obj.d) === "object" && jQuery.isArray(obj.d.results)){
				  thisObj.dataSet = obj.d.results;
				  callback(thisObj);
			  }else{
				  // alert("Unexpected data returned from "+thisObj.odataSource.queryName);
				  console.log("Unexpected data returned from "+thisObj.odataSource.queryName);
				  console.log(thisObj.makeURL());
				  console.log(obj);
			  }
		  },
		  error: function(er){
			  // alert("Error loading data for query "+thisObj.odataSource.queryName);
			  console.log("Error loading data for query "+thisObj.odataSource.queryName);
			  console.log(er);
		  }
		});
	}

}
