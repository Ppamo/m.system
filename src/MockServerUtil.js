var Utils = (function () {
	var fs = require('fs');
	var path = require('path');

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getFilePath = function(profile, incoming){
		if (typeof(incoming) == 'undefined'){
			incoming = true;
		};
		var filename = ('0000' + profile.currentCounter).slice(-4) + '-' +
			(incoming ? 'in' : 'out') + '.data';

		return path.join(profile.workingDir, profile.name, profile.stage, filename);
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var storeMessage = function(profile, buffer, success, incoming) {
		if (typeof(incoming) == 'undefined'){
			incoming = true;
		};
		var filename = getFilePath(profile, incoming);
		var ws = fs.createWriteStream(filename);
		ws.on('finish', success);
		for (var i = 0, len = buffer.length; i < len; i++){
			ws.write(buffer[i]);
		};
		ws.end();
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var storeIncomingMessage = function(profile, buffer, success){
		storeMessage(profile, buffer, success, true);
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var storeOutgoingMessage = function(profile, buffer, success){
		storeMessage(profile, buffer, success, false);
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var loadStoredMessage = function(profile, success, outgoing){
		if (typeof(outgoing) == 'undefined'){
			outgoing = true;
		};
		var filename = getFilePath(profile, !outgoing);
		fs.readFile(filename, function(err, data){
			success(err, data);
		});
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var isEmpty = function(data){
		return (data.toString().trim().length == 0);
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var ensurePath = function(profile){
		var fillpath;
		if (profile.mode == "static"){
			fullpath = path.resolve(path.normalize(path.join(profile.workingDir,
						profile.name, profile.mode, profile.stage)));
		} else {
			fullpath = path.resolve(path.normalize(path.join(profile.workingDir,
						profile.name, profile.stage)));
		}
		var nodes = fullpath.split(path.sep);
		fullpath = '/';
		for (var i = 1, len = nodes.length; i < len; i++){
			fullpath = path.join(fullpath, nodes[i]);
			if (!fs.existsSync(fullpath)){
				fs.mkdirSync(fullpath);
			};
		};
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var validateMode = function(mode){
		var modes = ['play', 'record', 'static'];
		return (modes.indexOf(mode) != -1);
	};

	// - - - - - - - - - - - - - - - - - - - - - - -

	var printError = function(profile, message, error){
		var args = [ "\033[31m" + profile.name + ":", message]
		console.log.apply(null, args);
		console.log(error.message, "\033[0m");
	}

	var printMessage = function (profile, message){
		arguments[0] = profile.name + ":";
		console.log.apply(null, arguments);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var writeStream = function(filePath, data, callback){
		fs.writeFileSync(filePath, data, "utf-8");
		callback();
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getPath = function(profile, tag, ext){
		tag = (typeof(tag) == "undefined") ? "data" : tag.replace(/ /g, "_");
		ext = (typeof(ext) == "undefined") ? ".dat" : ext;
		var filename = ("0000" + profile.currentCounter).slice(-4) + "-" + tag + ext;
		return path.join(getWorkingPath(profile), filename);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var requestDumpExists = function(profile, tag){
		return fs.existsSync(getRequestDumpPath(profile, tag));
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var responseDumpExists = function(profile, tag){
		return fs.existsSync(getResponseDumpPath(profile, tag));
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getWorkingPath = function(profile){
		return path.join(profile.workingDir, profile.name, profile.stage);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getRequestDumpPath = function(profile, tag){
		return getPath(profile, tag, ".req");
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getResponseDumpPath = function(profile, tag){
		return getPath(profile, tag, ".res");
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var dumpJsonRequest = function(profile, data){
		var filename = getRequestDumpPath(profile);
		var callback = function(err){
			if (err) printError(profile, "could not dump request", err);
			else printMessage(profile, "file wroted", filename);
		};
		writeStream(filename, JSON.stringify(data, null, 2), callback);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var dumpJsonResponse = function(profile, data){
		var filename = getResponseDumpPath(profile);
		var callback = function(err){
			if (err) printError(profile, "could not dump response", err);
			else printMessage(profile, "file wroted", filename);
		};
		writeStream(filename, JSON.stringify(data, null, 2), callback);
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	var getResponseDumpStream = function(profile, write, tag){
		var ws, filename = getResponseDumpPath(profile, tag);
		write = (typeof(write) == "undefined") ? true : write;
		if (write){
			ws = fs.createWriteStream(filename);
		} else {
			ws = fs.createReadStream(filename);
		}
		ws.on("finish", function() {
					printMessage(profile, "stream closed", filename);
				});
		return ws;
	}

	// - - - - - - - - - - - - - - - - - - - - - - -

	return {
		isEmpty: isEmpty,
		ensurePath: ensurePath,
		validateMode: validateMode,
		loadStoredMessage: loadStoredMessage,
		storeMessage: storeMessage,
		storeIncomingMessage: storeIncomingMessage,
		storeOutgoingMessage: storeOutgoingMessage,
		error: printError,
		debug: printMessage,
		dumpJsonRequest: dumpJsonRequest,
		dumpJsonResponse: dumpJsonResponse,
		getResponseDumpStream: getResponseDumpStream,
		getWorkingPath: getWorkingPath,
		getRequestDumpPath: getRequestDumpPath,
		getResponseDumpPath: getResponseDumpPath,
		requestDumpExists: requestDumpExists,
		responseDumpExists: responseDumpExists
	};
})();

module.exports.Utils = Utils
