/*
var profile = (function (){
	var trans = function(node) {
		console.log("creating a trans mock!!");
		bind = function(){
			console.log("bind trans!");
		};
	}
	return {
		trans: trans
	};
})();
*/



var factory = (function () {
	var services = [];

	var create = function (profile) {
		var path = "./MockServer." + profile.type + ".js";
		var fs = require("fs");
		fs.stat(path, function(error, stats){
			if (error) {
				profile.error(error);
				return;
			}
			var template = require(path);
			var server = template(profile);
			server.bind();
			services.push(server);
			profile.success(server);
		});


		/*
		if (fs.existsSync(path)) {
			console.log("file " + path + "exists!")
			var template = require(path);
			console.log(template);
			console.log("create instance");
			var server = template();
		}
		*/

		return null;
	}
	return {
		services: services,
		create: create
	};
})();

module.exports.factory = factory;
