exports = module.exports = TemplateJSON;

function TemplateJSON(profile) {
	var fs = require("fs");
	var mockTools = require("./MockServerUtil.js");
	var Hapi = require("hapi");
	var mock = new Hapi.Server();

	// - - - - - - - - - - - - - - - - - - - - - - -
	// Constructor
	profile.currentCounter = 0;
	mockTools.Utils.ensurePath(profile);
	if (! mockTools.Utils.validateMode(profile.mode)){
		profile.mode = "play";
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getReplyPathPrefix = function(reply){
		return (profile.workingDir + "/" + profile.name + "/" + profile.mode + "/" + profile.stage + "/" + reply);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var defaultStaticHandler = function(request, reply){
		console.log(profile.name, "handle", request.route.method, request.route.path);
		var rule;
		// get the rule from the route
		for (var i = 0, len = profile.rules.static.length; i < len; i++) {
			rule = profile.rules.static[i];
			if (rule.method.toLowerCase() == request.route.method.toLowerCase() && rule.path == request.route.path){
				break;
			 }
		}
		var replyPrefix = getReplyPathPrefix(rule.reply);
		var output = reply(fs.readFileSync(replyPrefix + ".out"));
		// load the headers
		var headers = fs.readFileSync(replyPrefix + ".headers.out");
		headers = headers.toString().split("\n");
		for (var i = 0, len = headers.length - 1; i < len; i++) {
			var index = headers[i].indexOf(":");
			output.header(
				headers[i].substring(0, index),
				headers[i].substring(index + 1, headers[i].length));
		}
		return output;
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var killMock = function(){
		if (mock) {
			console.log("stoping ", profile.name, "server");
			mock.stop();
		}
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var startMock = function(){
		// check the tls configutation
		var tls = profile.connection.tls;
		if (!tls.key && tls.keyPath){
			tls.key = fs.readFileSync(tls.keyPath);
		}
		if (!tls.cert && tls.certPath){
			tls.cert = fs.readFileSync(tls.certPath);
		}

		// connect the server
		mock.connection(profile.connection);

		// handle CORS
		mock.ext("onPreResponse", require("hapi-cors-headers"));

		mock.start((err) => {
			if (err){
				console.log("\033[31m");
				console.log("unable to start " + profile.name + " (" + profile.type + ")");
				console.error(err.message);
				console.log("\033[0m");
				return;
			};
			console.log("started server " + profile.name + " (" + profile.type + ") running at: " + mock.info.uri);
		});
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var loadStaticRules = function(){
		var route, rules = profile.rules.static;
		if (!rules){
			return;
		}
		for (var i = 0, len = rules.length; i < len; i++) {
			console.log("adding route:", rules[i].method, rules[i].path);
			mock.route({
				method: rules[i].method,
				path: rules[i].path,
				handler: (rules[i].handler) ? rules[i].handler : defaultStaticHandler
			});
		}
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var start = function(){
		console.log("creating server " + profile.name + " (" + profile.type + "), at port " +	profile.port);
		startMock();
		switch(profile.mode){
				case "static":
						loadStaticRules();
					break;
		}
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var stop = function(){
		killMock();
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var setMode = function(mode){
		if (! mockTools.Utils.validateMode(setup.mode)){
			throw new Error("Mode " + mode + "not valid");
		}
		profile.mode = setup.mode;
		profile.currentCounter = 0;
		switch(mode){
			case "static":
					loadStaticRoutes();
				break;
		}
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var setStage = function(stage){
		profile.stage = setup.stage;
		mockTools.Utils.ensurePath(profile);
		profile.currentCounter = 0;
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var config = function(setup){
		if (setup){
			if (setup.mode){
				setMode(setup.mode);
			};
			if (setup.stage){
				setStage(setup.stage);
			};
		};
		return this.getConfig();
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getConfig = function(){
		return JSON.parse(JSON.stringify(profile));
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	return{
		start: start,
		stop: stop,
		config: config,
		getConfig: getConfig
	};
}
