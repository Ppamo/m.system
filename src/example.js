var config = require('./config.json');
var service = require('./ServerFactory.js');
var control = require('./ControlServer.js');

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
config.control.updateHandler = function(request, reply){
	console.log('--> update:', request.payload);
	var response = {};
	var updated = null;
	var mockService = null;
	for (var i = 0, len = service.factory.services.length; i < len; i++){
		mockService=service.factory.services[i];
		if (mockService.update){
			updated = mockService.update(request.payload);
			response[updated.name] = updated;
		};
	};
	reply(response);
};
control.server.start(config.control);

// create server
var node = null;
var profile = null;
var services = [];

for (var i = 0, len = config.roles.length; i < len; i++){
	profile = config.roles[i];
	profile.success = function(server) {
		console.log('created ' + this.name);
	};
	profile.error = function(e) {
		console.log('error creating ' + this.name);
	};
	console.log('creating service ' + profile.name);

	service.factory.create(profile);
}
