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
			server.start();
			services.push(server);
			profile.success(server);
		});
		return null;
	}
	return {
		services: services,
		create: create
	};
})();

module.exports.factory = factory;
