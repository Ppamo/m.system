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
	
	function generateResponse(profile, buffer){
		// if buffer is nothing read the data from stored message
		if (buffer) {
			try {
				for (var i = 0, len = buffer.length; i < len; i++){
					socket.write(buffer[i]);
				};
				socket.end();
			} catch(err) {
				console.log('=> exception writing to response connection', err);
			} finally {
				writeBuffer = [];
			};
		} else {
			mockTools.Utils.loadStoredMessage(profile, function(err, data){
				console.log('writing back:', data.toString());
				if (err) {
					console.log(err);
					return ;
				};
				try {
					socket.write(data);
					socket.end();
				} catch (err) {
					console.log('=> exception writing to response connection', err);
				};
			});
		}
	};

	function handleIncomingMessage(profile, readBuffer){
		console.log('handling message mode:', profile.mode, '- stage:', profile.stage);
		profile.currentCounter++;
		mockTools.Utils.storeIncomingMessage(profile, readBuffer, function(){
			switch(profile.mode){
				case 'recording':
					getAndStoreResponse(profile, readBuffer, function(buffer){
						generateResponse(profile, writeBuffer);
					});
					break;
				case 'playing':
					generateResponse(profile);
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
			};
		}
	};

	var close = function(data){
		// console.log('closing port ' + profile.port);
	};

	var start = function() {
		client = net.createServer(function(s){
			s.on('data', read);
			s.on('close', close);
			socket = s;
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
