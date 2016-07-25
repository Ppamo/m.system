var message = function(message){
	if (!message) message = '';
	var now = new Date();
	var time = now.getHours() + ":" + now.getMinutes() +
		":" + now.getSeconds() + "." + now.getMilliseconds();
	console.log(time + " - " + message);
}

// - - - - - - - - - - - - - - - -

var config = require("./config.json");
var service = require("./ServerFactory.js");

// create server
var node = null;
var profile = null;
var services = [];

for (var i = 0, len = config.roles.length; i < len; i++){
	profile = config.roles[i];
	profile.success = function(server) {
		message("created " + this.name);
	};
	profile.error = function(e) {
		message("error creating " + this.name);
	};
	message("creating service " + profile.name);

	service.factory.create(profile);
}
