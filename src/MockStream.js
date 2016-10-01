exports = module.exports = MockStream; 

function MockStream(profile) {
	console.log('new stream: ', profile.currentCounter);

	// - - - - - - - - - - - - - - - - - - - - - -

	var getFilePath = function(profile, incoming){
		if (typeof(incoming) == 'undefined'){
			incoming = true;
		};
		var filename = ('0000' + profile.currentCounter).slice(-4) + '-' +
			(incoming ? 'in' : 'out') + '.data';

		return path.join(profile.workingDir, profile.name, profile.stage, filename);
	};

	// - - - - - - - - - - - - - - - - - - - - - -

	var net = require('net');
	var fs = require('fs');
	// var file = fs.createWriteStream(getFilePath(profile, false));

	var data = function(data){
		console.log('> streaming data:', data.toString());
		// file.write(data);
	};
	var close = function(){
		console.log('> closing streams');
	};
	var eof = function(){
		console.log('> EOF');
	};

	return {
		data: data,
		eof: eof,
		close: close
	};
}
