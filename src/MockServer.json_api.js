exports = module.exports = TemplateJSON;

function TemplateJSON(profile) {
	var mockTools = require('./MockServerUtil.js');
  var Hapi = require('hapi');
  var HapiCors = require('hapi-cors-headers');
  var mock = new Hapi.Server();
	var fs = require('fs');
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
  mock.ext('onPreResponse', HapiCors);

	// - - - - - - - - - - - - - - - - - - - - - - -
	// Constructor
	profile.currentCounter = 0;
	mockTools.Utils.ensurePath(profile);
	if (! mockTools.Utils.validateMode(profile.mode)){
		profile.mode = 'playing';
	};

  var getReplyPathPrefix = function(reply){
    return (profile.workingDir + "/" + profile.mode + "/" + profile.stage + "/" + reply);
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
    // load the headers
    /*
    var headers = fs.readFileSync(replyPrefix + ".headers.out");
    headers = headers.toString().split('\n');
    for (var i = 0, len = headers.length - 1; i < len; i++) {
      var index = headers[i].indexOf(":");
      reply().header(headers[i].substring(0, index), headers[i].substring(index + 1, headers[i].length)).hold();
    }
    */

    // rule.reply has the file to be loaded
	  return reply(fs.readFileSync(replyPrefix + ".out"))
        .header("Content-Type", "application/json; charset=utf-8")
        .header("X-SCM-API-Version", "11");
  }

		mock.start((err) => {
			if (err){
				throw err;
			};
			console.log('started server ' + profile.name + ' (' + profile.type + ') running at: ' + mock.info.uri);
		});

	// - - - - - - - - - - - - - - - - - - - - - - -
	var start = function() {
		console.log('creating server ' + profile.name + ' (' + profile.type + '), at port ' +  profile.port);
    console.log("Loading rules:");

    for (var i = 0, len = profile.static.rules.length; i < len; i++) {
      console.log("adding route:", profile.static.rules[i].method, profile.static.rules[i].path);
      mock.route({
        method: profile.static.rules[i].method,
        path: profile.static.rules[i].path,
        handler: defaultStaticHandler
      });
    }
  };

	var stop = function(){
		if (client) {
			client.close();
		}
	};

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

	var getConfig = function(){
		return JSON.parse(JSON.stringify(profile));
	};

	return {
		start: start,
		stop: stop,
		config: config,
		getConfig: getConfig
	};
}

