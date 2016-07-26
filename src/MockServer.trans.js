exports = module.exports = TemplateTrans;

function TemplateTrans(profile) {
	var net = require('net');
	var mockTools = require('./MockServerUtil.js');

	var readBuffer = [];
	var writeBuffer = [];
	var __dumpCounter = 0;
	var __profile = profile;
	var __socket = null;
	var __currentMode = '';
	var __currentStage = '';

	var __storeResponse = function(message){
		var __client = new net.Socket();
		__client.connect(__profile.realPort, __profile.host, function() {
			for (var i = 0, len = message.length; i < len; i++){
				console.log(':> ' + message[i].toString());
				__client.write(message[i]);
			};
			readBuffer = [];
		});
		__client.on('data', function(data){
			console.log('<: ' + data.toString());
			writeBuffer.push(data);
		});
		__client.on('close', function(){
			console.log(':: closing client and writing buffer');
			var fileName = ('0000' + __dumpCounter).slice(-4) + '-test-out.dmp';
			mockTools.Utils.dumpBufferToFile(writeBuffer, fileName);
		});
	};

	var __read = function(data){
		if (!mockTools.Utils.isEmpty(data)){
			readBuffer.push(data);
			if (mockTools.Utils.normalize(data) === 'end'){
				__dumpCounter++;
				var fileName = ('0000' + __dumpCounter).slice(-4) + '-test-in.dmp';
				console.log('-> dumping file ' + fileName);
				mockTools.Utils.dumpBufferToFile(readBuffer, fileName);
				__storeResponse(readBuffer);
			}
		}
	};
	

	var __close = function(data){
		console.log('closing port ' + __profile.port);
	};
	var start = function() {
		__client = net.createServer(function(sock){
			sock.on('data', __read);
			sock.on('close', __close);
		}).listen(__profile.port, __profile.host);
		console.log('--> starting to port ' + __profile.port);
	};
	var stop = function(){
		if (__client) {
			__client.close();
			__client.destroy();
		}
	};

	var setMode = function(mode){
		__currentMode = mode;
	};

	var setStage = function(stage){
		__currentStage = stage;
	};

	return {
		start: start,
		stop: stop,
		setMode: setMode,
		setStage: setStage
	};
}
