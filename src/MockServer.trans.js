exports = module.exports = TemplateTrans;

function TemplateTrans(profile) {
	var net = require('net');
	var mockTools = require('./MockServerUtil.js');

	var readBuffer = [];
	var writeBuffer = [];

	var socket = null;

	profile.currentCounter = 0;
	mockTools.Utils.ensurePath(profile);
	if (! mockTools.Utils.validateMode(profile.mode)){
		profile.mode = 'playing';
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	function handleIncomingMessage(profile, readBuffer){
		console.log('handling message mode: ', profile.mode, '; stage: ', profile.stage);
		profile.currentCounter++;
		mockTools.Utils.storeIncomingMessage(profile, readBuffer, function(){
			console.log('--> el mensaje de entrada debe ya estar guardado en el disco');
			console.log('ejecutando modo:', profile.mode);
			switch(profile.mode){
				case 'recording':
					getAndStoreResponse(profile, readBuffer, function(){
						 console.log('--> la respuesta del servicio real debe estar ya guardada en el disco'); 
					});
					break;
				case 'playing':
					mockTools.Utils.loadStoredMessage(profile);
					break;
				default:
					throw new Error('Non-valid mode ' + profile.mode);
			};
		});
	};

	function getAndStoreResponse(profile, message, success){
		// TODO: attach buffer to client to avoid use of a global var
		var client = new net.Socket();
		client.connect(profile.realPort, profile.host, function() {
			for (var i = 0, len = message.length; i < len; i++){
				client.write(message[i]);
			};
			readBuffer = [];
		});
		client.on('data', function(data){
			writeBuffer.push(data);
		});
		client.on('close', function(){
			console.log('--> el mensaje ha sido reenviado, se procede a guardarlo');
			mockTools.Utils.storeOutgoingMessage(profile, writeBuffer, success);
		});
	};

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
			readBuffer.push(data);
			if (isEOF(data)) {
				handleIncomingMessage(profile, readBuffer);
				socket.end();
			};
		}
	};

	var close = function(data){
		console.log('closing port ' + profile.port);
	};

	var start = function() {
		client = net.createServer(function(s){
			s.on('data', read);
			s.on('close', close);
			socket = s;
		}).listen(profile.port, profile.host);
		console.log('--> starting to port ' + profile.port);
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
					profile.mode  = setup.mode;
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
