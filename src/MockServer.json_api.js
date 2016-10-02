exports = module.exports = TemplateJSON;

function TemplateJSON(profile) {
	var fs = require('fs');
	var mockTools = require('./MockServerUtil.js');
	var Hapi = require('hapi');
	var mock = new Hapi.Server();
	if (profile.ssl != null){
		var tls = {
			key: fs.readFileSync(profile.ssl.tls.keyFilePath),
			cert: fs.readFileSync(profile.ssl.tls.certFilePath)
		};
		mock.connection({
			host: profile.host,
			port: profile.port,
			tls: tls
		});
	} else {
		mock.connection({
			host: profile.host,
			port: profile.port
		});
	}
	// handle CORS
	var HapiCors = require('hapi-cors-headers');
	mock.ext('onPreResponse', HapiCors);

	// - - - - - - - - - - - - - - - - - - - - - - -
	// Constructor
	profile.currentCounter = 0;
	mockTools.Utils.ensurePath(profile);
	if (! mockTools.Utils.validateMode(profile.mode)){
		profile.mode = 'play';
	};

	var getReplyPathPrefix = function(reply){
		return (profile.workingDir + "/" + profile.name + "/" + profile.mode + "/" + profile.stage + "/" + reply);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -
	var defaultStaticHandler = function(request, reply) {
		console.log("handling", request.route.method, request.route.path);
		var rule = null;
		// get the rule
		for (var i = 0, len = profile.static.rules.length; i < len; i++) {
			rule = profile.static.rules[i];
			if (rule.method.toLowerCase() == request.route.method.toLowerCase() && rule.path == request.route.path){
				break;
			 }
		}
		var replyPrefix = getReplyPathPrefix(rule.reply);
		var output = reply(fs.readFileSync(replyPrefix + ".out"));
		// load the headers
		var headers = fs.readFileSync(replyPrefix + ".headers.out");
		headers = headers.toString().split('\n');
		for (var i = 0, len = headers.length - 1; i < len; i++) {
			var index = headers[i].indexOf(":");
			output.header(
					 headers[i].substring(0, index),
					 headers[i].substring(index + 1, headers[i].length));
		}
		return output;
	}

		mock.start((err) => {
			if (err){
				throw err;
			};
			console.log('started server ' + profile.name + ' (' + profile.type + ') running at: ' + mock.info.uri);
		});

	// - - - - - - - - - - - - - - - - - - - - - - -

	var start = function() {
		console.log('creating server ' + profile.name + ' (' + profile.type + '), at port ' +	profile.port);

		for (var i = 0, len = profile.static.rules.length; i < len; i++) {
			console.log("adding route:", profile.static.rules[i].method, profile.static.rules[i].path);
			mock.route({
				method: profile.static.rules[i].method,
				path: profile.static.rules[i].path,
				handler: defaultStaticHandler
			});
		}
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var stop = function(){
		if (client) {
			client.close();
		}
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var config = function(setup){
		if (setup){
			if (setup.mode){
				if (mockTools.Utils.validateMode(setup.mode)){
					profile.mode = setup.mode;
					profile.currentCounter = 0;
				}
			};
			if (setup.stage){
				profile.stage = setup.stage;
				mockTools.Utils.ensurePath(profile);
				profile.currentCounter = 0;
			};
		};
		return this.getConfig();
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getConfig = function(){
		return JSON.parse(JSON.stringify(profile));
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	return {
		start: start,
		stop: stop,
		config: config,
		getConfig: getConfig
	};
}
