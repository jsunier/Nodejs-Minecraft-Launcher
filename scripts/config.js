/*====================================
=            Config class            =
====================================*/

var fs = require('fs-extra');

/*==========  Fonction principale  ==========*/

function Config(options) {
	this.file = "configs.json";
	this.configs = {};
	this.options = options;
}

Config.prototype.load = function(callback) {
	fs.exists(this.file, function(e) {
		if (e) {
			this.content = fs.readJsonSync(this.file, {throws: false});
			callback();
		}
		else {
			fs.writeJson(this.file, this.options, function(err) {
				if (err) console.log(err);
				callback();
			});
		}
	});
}
