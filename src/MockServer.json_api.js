exports = module.exports = TemplateJSON;

function TemplateJSON(profile) {
	var fs = require("fs");
	var tools = require("./MockServerUtil.js");
	var Hapi = require("hapi");
	var mock = new Hapi.Server();

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getReplyPathPrefix = function(reply){
		return (profile.workingDir + "/" + profile.name + "/"
				+ profile.mode + "/" + profile.stage + "/" + reply);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var defaultStaticHandler = function(request, reply){
		tools.Utils.debug(profile, "static handler for",
				request.route.method.toUpperCase(), request.route.path);
		var rule;
		// get the rule from the route
		for (var i = 0, len = profile.rules.static.length; i < len; i++) {
			rule = profile.rules.static[i];
			if (rule.method.toLowerCase() == request.route.method.toLowerCase()
					&& rule.path == request.route.path){
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

	var defaultStaticHandler = function(request, reply){
		tools.Utils.debug(profile, "recording",
				request.route.method.toUpperCase(), request.route.path);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var killMock = function(options){
		var restart = (options && options.restart) ? options.restart : false ;
		if (mock) {
			tools.Utils.debug(profile, "stoping ", profile.name, "server");
			mock.stop({timeout: 1000}, (err) => {
				tools.Utils.debug(profile, "server stoped");
				if (restart){
					mock = new Hapi.Server();
					start();
				}
			});
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
				profile.error(err);
				return;
			};
			tools.Utils.debug(profile, "started", profile.type,
				"server, running at", mock.info.uri);
		});
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var loadStaticRules = function(){
		var route, rules = profile.rules.static;
		if (!rules){
			return;
		}
		for (var i = 0, len = rules.length; i < len; i++) {
			tools.Utils.debug(profile, "adding route:",
					rules[i].method.toUpperCase(), rules[i].path);
			mock.route({
				method: rules[i].method,
				path: rules[i].path,
				handler: (rules[i].handler) ? rules[i].handler : defaultStaticHandler
			});
		}
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var start = function(){
		tools.Utils.debug(profile, "creating", profile.type,
				"server, at port", profile.connection.port);
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
		if (!tools.Utils.validateMode(mode)){
			tools.Utils.error(profile, "Mode " + mode + "not valid", "Could not set mode");
			return;
		}
		tools.Utils.debug(profile, "setting mode to", mode);
		profile.mode = mode;
		profile.currentCounter = 0;
		tools.Utils.ensurePath(profile);
		killMock({restart: true});
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var setStage = function(stage){
		if (typeof(stage) == "undefined"){
			stage = "default";
		}
		tools.Utils.debug(profile, "setting stage to", stage);
		profile.stage = stage;
		tools.Utils.ensurePath(profile);
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
	// Constructor
	profile.currentCounter = 0;
	setStage(profile.stage);
	if (!tools.Utils.validateMode(profile.mode)){
		profile.mode = "play";
	};
	tools.Utils.ensurePath(profile);

	// - - - - - - - - - - - - - - - - - - - - - - -

	return{
		start: start,
		stop: stop,
		config: config,
		getConfig: getConfig
	};
}
