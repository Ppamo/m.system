var controlServer = (function(){
	var service = null;

	var startService = function(setup){
		var Hapi = require('hapi');
		controlServer.service = new Hapi.Server();
		controlServer.service.connection({
			host: setup.host,
			port: setup.port
		});

		controlServer.service.route({
			method: 'GET',
			path: '/stop',
			handler: setup.stopHandler
		});

		controlServer.service.route({
			method: 'POST',
			path: '/config',
			handler: setup.configHandler
		});

		controlServer.service.route({
			method: 'GET',
			path: '/config',
			handler: setup.configHandler
		});

		controlServer.service.start((err) => {
			if (err){
				throw err;
			};
			console.log('Control Service Running at: ' + controlServer.service.info.uri);
		});
	};
	
	var stopService = function(setup){
		console.log('---> stop control server: ');
		console.log(controlServer);
		console.log(controlServer.service);
		controlServer.service.stop();
	};

	return {
		start: startService,
		stop: stopService,
		service: service
	};
})();

module.exports.server = controlServer;
