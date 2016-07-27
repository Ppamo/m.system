exports = module.exports = TemplateTrans;

function TemplateTrans(profile) {
	var net = require('net');
	var mockTools = require('./MockServerUtil.js');

	var readBuffer = [];
	var writeBuffer = [];
	var dumpCounter = 0;
	var socket = null;
	var currentMode = '';
	var currentStage = '';

	var storeResponse = function(message){
		var client = new net.Socket();
		client.connect(profile.realPort, profile.host, function() {
			for (var i = 0, len = message.length; i < len; i++){
				console.log(':> ' + message[i].toString());
				client.write(message[i]);
			};
			readBuffer = [];
		});
		client.on('data', function(data){
			console.log('<: ' + data.toString());
			writeBuffer.push(data);
		});
		client.on('close', function(){
			console.log(':: closing client and writing buffer');
			var fileName = ('0000' + dumpCounter).slice(-4) + '-test-out.dmp';
			mockTools.Utils.dumpBufferToFile(writeBuffer, fileName);
		});
	};

	var read = function(data){
		if (!mockTools.Utils.isEmpty(data)){
			readBuffer.push(data);
			if (mockTools.Utils.normalize(data) === 'end'){
				dumpCounter++;
				var fileName = ('0000' + dumpCounter).slice(-4) + '-test-in.dmp';
				console.log('-> dumping file ' + fileName);
				mockTools.Utils.dumpBufferToFile(readBuffer, fileName);
				storeResponse(readBuffer);
			}
		}
	};
	

	var close = function(data){
		console.log('closing port ' + profile.port);
	};
	var start = function() {
		client = net.createServer(function(sock){
			sock.on('data', read);
			sock.on('close', close);
		}).listen(profile.port, profile.host);
		console.log('--> starting to port ' + profile.port);
	};
	var stop = function(){
		if (client) {
			client.close();
		}
	};

	var update = function(setup){
		if (setup.mode){
			this.getConfig().mode  = setup.mode;
		};
		if (setup.stage){
			this.getConfig().stage = setup.stage;
		};
		return this.getConfig();
	};

	var getConfig = function(){
		return profile;
	};

	return {
		start: start,
		stop: stop,
		update: update,
		getConfig: getConfig
	};
}
