exports = module.exports = TemplateTrans;

function TemplateTrans(profile) {
	var net = require('net');
	var streamFactory = require('./MockStream.js');
	var mockTools = require('./MockServerUtil.js');

	// - - - - - - - - - - - - - - - - - - - - - - -
	// Constructor

	profile.currentCounter = 0;
	var stream = streamFactory(profile);

	mockTools.Utils.ensurePath(profile);
	if (! mockTools.Utils.validateMode(profile.mode)){
		profile.mode = 'playing';
	};

	// - - - - - - - - - - - - - - - - - - - - - - -
	
	function isEOF(data){
		var message = data.toString().split('\n');
		for (var i = 0,len = message.length; i < len; i++){
			if (message[i].replace('\r', '') === 'end'){
				return true;
			}
		}
		return false;
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var read = function(data){
		if (!mockTools.Utils.isEmpty(data)){
			stream.data(data);
			if (isEOF(data)) {
				stream.eof();
			};
		}
	};

	var close = function(data){
		// console.log('closing port ' + profile.port);
		stream.close()
		profile.currentCounter++;
		stream = streamFactory(profile);
	};

	var start = function() {
		client = net.createServer(function(s){
			s.on('data', read);
			s.on('close', close);
		}).listen(profile.port, profile.host);
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
