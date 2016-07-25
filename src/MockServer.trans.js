exports = module.exports = TemplateTrans;

function TemplateTrans(profile) {
	var net = require('net');
	var fs = require('fs');

	var readBuffer = [];
	var writeBuffer = [];
	var dumpCounter = 0;
	var __profile = profile;

	var dumpBufferToFile = function(readBuffer, file) {
		var ws = fs.createWriteStream('/tmp/dump/' + file);
		for (var i = 0, len = readBuffer.length; i < len; i++){
			ws.write(readBuffer[i]);
		};
		ws.end();
	};

	var isEOF = function(data) {
		return (normalize(data) === 'end');
	};

	var isEmpty = function(data){
		return (data.toString().trim().length == 0);
	};

	var normalize = function(data){
		var message = data.toString();
		if (message.charCodeAt(message.length - 1) == 10){
			message = message.substring(0, message.length - 1);
		}
		if (message.charCodeAt(message.length - 1) == 13){
			message = message.substring(0, message.length - 1);
		}
		 return message;
	};

	var getResponse = function(message){
		var client = new net.Socket();
		client.connect(__profile.realPort, __profile.host, function() {
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
			dumpBufferToFile(writeBuffer, fileName);
		});
	};

	var read = function(data){
		if (!isEmpty(data)){
			readBuffer.push(data);
			if (isEOF(data)){
				dumpCounter++;
				var fileName = ('0000' + dumpCounter).slice(-4) + '-test-in.dmp';
				console.log('-> dumping file ' + fileName);
				dumpBufferToFile(readBuffer, fileName);
				getResponse(readBuffer);
			}
		}
	};
	
	var close = function(data){
		console.log('closing port ' + __profile.port);
	};

	var bind = function() {
		net.createServer(function(sock){
			sock.on('data', read);
			sock.on('close', close);
		}).listen(__profile.port, __profile.host);
		console.log('--> binding to port ' + __profile.port);
	};

	return {
		bind: bind 
	};
}
