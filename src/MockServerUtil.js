var Utils = (function () {
	var fs = require('fs');

	var dumpBufferToFile = function(readBuffer, file) {
		var ws = fs.createWriteStream('/tmp/dump/' + file);
		for (var i = 0, len = readBuffer.length; i < len; i++){
			ws.write(readBuffer[i]);
		};
		ws.end();
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

	return {
		dumpBufferToFile: dumpBufferToFile,
		isEmpty: isEmpty,
		normalize: normalize
	};
})();

module.exports.Utils = Utils
