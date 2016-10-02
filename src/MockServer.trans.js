exports = module.exports = TemplateTrans;

function TemplateTrans(profile) {
	var net = require('net');
	var pass = require('stream').PassThrough;
	var streamFactory = require('./MockStream.js');
	var mockTools = require('./MockServerUtil.js');
	var mock = new net.Server();
	var trans = new net.Socket();

	// - - - - - - - - - - - - - - - - - - - - - - -
	// Constructor

	profile.currentCounter = 0;
	var stream = streamFactory(profile);

	mockTools.Utils.ensurePath(profile);
	if (! mockTools.Utils.validateMode(profile.mode)){
		profile.mode = 'play';
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

	var close = function(data){
		console.log('closing port ' + profile.port);
	};

	var start = function() {
		console.log('creating a connection at port', profile.port);
		mock.listen(profile.port, profile.host, function(){
			console.log('trans mock server listening at', profile.port);
		});
		mock.on('connection', function(socket){
			console.log('get a new socket!');
			var buffer = [];
			// setup streams
			var a = new pass();
			var b = new pass();
			var c = new pass();
			var x = new pass();
			var y = new pass();
			var z = new pass();

			a.pipe(b);
			a.pipe(c);
			x.pipe(y);
			x.pipe(z);
			b.on('data', function(data){
				// write file
				console.log('writing to file 1:', data.toString());
			});
			c.on('data', function(data){
				// forwarding message to trans
				buffer.push(data);
				if (isEOF(data)){
					trans.connect(profile.realPort, profile.host, function(){
						for (i = 0, len = buffer.length; i < len; i++){
							trans.write(buffer[i]);
						}
					});
					trans.pipe(x);
				}
			});
			y.on('data', function(data){
				// write file
				console.log('writing to file 2:', data.toString());
			});
			socket.pipe(a);
			z.pipe(socket);
		});
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
