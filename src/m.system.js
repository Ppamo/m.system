var config = require("./config.json");
var service = require("./ServerFactory.js");
var control = require("./ControlServer.js");
var tools = require("./MockServerUtil.js");

// - - - - - - - - - - - - - - - - - - - - - - -

// create control service
config.control.stopHandler = function(request, reply){
	var mockService = null;
	for (var i = 0, len = service.factory.services.length; i < len; i++){
		mockService=service.factory.services[i];
		if (mockService.stop){
			mockService.stop();
		};
	};
	reply('{"ok": true}');
	control.server.stop();
};

// - - - - - - - - - - - - - - - - - - - - - - -

config.control.configHandler = function(request, reply){
	var response = {};
	var updated = null;
	var mockService = null;
	for (var i = 0, len = service.factory.services.length; i < len; i++){
		mockService=service.factory.services[i];
		if (mockService.config){
			updated = mockService.config(request.payload);
			response[updated.name] = updated;
		};
	};
	reply(response);
};

// - - - - - - - - - - - - - - - - - - - - - - -

control.server.start(config.control);

// - - - - - - - - - - - - - - - - - - - - - - -

// create server
var node = null;
var profile = null;
var services = [];

for (var i = 0, len = config.roles.length; i < len; i++){
	profile = config.roles[i];
	profile.workingDir = config.workingDir;
	profile.success = function(server) {
		console.log("created " + this.name + " at "
				+ this.connection.host + ":" + this.connection.port);
	};
	profile.error = function(e) {
		tools.Utils.error("error creating " + this.name, profile, e);
	};

	service.factory.create(profile);
}
