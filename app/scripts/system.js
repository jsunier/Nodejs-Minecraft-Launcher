/*==============================================
=            Operating System Class            =
==============================================*/

/*==========  Variables  ==========*/

var gui = global.window.nwDispatcher.requireNwGui();
var async = require('async');
var ivn = require('is-version-newer');
var http = require('http');
var path = require('path');
var fs = require('fs-extra');

/*==========  Class  ==========*/

/**
 * Gestion des intéractions et des paramètres avec le système d'exploitation
 */
function System() {
	this.os = process.platform;
	this.is = {
		windows: /^win/.test(this.os),
		linux: /^linux/.test(this.os),
		mac: /^mac/.test(this.os)
	}
	this.user_folder = process.env[this.is.windows ? 'USERPROFILE' : 'HOME'];
	this.minecraft_folder = this.is.windows ? this.user_folder + "/Appdata/Roaming/.minecraft" : this.user_folder + "/.minecraft";
	this.minecraft_launcher = this.is.windows ? this.user_folder + "/Desktop/Minecraft.exe" : null;
	this.launcher_version = gui.App.manifest.version.toString();
	this.title = " - BETA v" + this.launcher_version;
	this.base_url = "http://files.usinacraft.ch/";
	this.update_url = "http://usinacraft.ch/server/launcher";
	this.launch_minecraft_on_finish = true;
}

/**
 * Mise en place de la base de données et des configurations de base
 * @return {[type]} [description]
 */
System.prototype.setup = function(main_callback) {
	Log.info(t.get('system.setup'));

	window.lockInterface();

	var options = this;
	db.reload();

	async.series([
		function(callback) {
			if(gui.App.argv.indexOf("--reset") > -1) {
				Log.info(t.get('system.clear_all'));
				db.delete('/');
				gui.App.clearCache();
			}
			callback();
		},
		function(callback) {
			try {
				db.getData("/system/configurations");	
			}
			catch (err) {
				db.push('/system/configurations', {
					os: options.os,
					is: options.is,
					user_folder: options.user_folder,
					base_url: options.base_url,
					update_url: options.update_url,
					launcher_version: options.launcher_version,
					launch_minecraft_on_finish: true,
				});
			}
			callback();
		},
		function(callback) {
			fs.stat(options.minecraft_folder, function (err, stats) {
				if (err == null) {
					Log.debug(t.get('system.base_folder', options.minecraft_folder));
					db.push('/system/configurations', {
						minecraft_folder: options.minecraft_folder
					}, false);
				}
				else {
					db.push('/system/configurations', {
						minecraft_folder: ""
					}, false);
					Log.debug(t.get('error.base_folder_not_found'));
				}
				setTimeout(callback, 300);
			});
		},
		function(callback) {
			fs.stat(options.minecraft_launcher, function (err, stats) {
				if (err == null) {
					Log.debug(t.get('system.base_launcher', options.minecraft_launcher));
					db.push('/system/configurations', {
						minecraft_launcher: options.minecraft_launcher
					}, false);
				}
				else {
					Log.debug(t.get('error.base_launcher_not_found'));
					db.push('/system/configurations', {
						minecraft_launcher: ""
					}, false);
				}
				setTimeout(callback, 300);
			});
		},
		function(callback) {
			try	{
				db.getData('/launcher/version');
			} 
			catch (err) {
				db.push('/launcher/version', {
					local: '0.0.0',
					remote: '0.0.0'
				});
			}
			callback();
		},
		function(callback) {
			try {
				db.getData('/minecraft/versions');
			}
			catch (err) {
				db.push('/minecraft/versions', {
					all: {},
					latest: "Usinacraft 2.0.0"
				});
			}
			callback();
		},
		function(callback) {
			// Application des informations conservés dans la base de données
			for(var i in db.getData('/system/configurations')) {
				this[i] = db.getData('/system/configurations')[i];
			}
			callback();
		},
		function(callback) {
			System.prototype.loadVersions(options.launcher_version, callback); // Chargement des versions disponibles de Minecraft et du launcher
		},
		function(callback) {
			// Vérification de la version du launcher
			Log.info(t.get('info.check_launcher_version'));
			System.prototype.isUpToDate(callback);
		}
	], function(err, results) {
		if (err) Log.error(err);
		Log.clear();
		window.unlockInterface();
		main_callback();
	});
}

/**
 * Télécharge le fichier contenant les versions disponibles et stock les informations dans la base de données
 * @param  {Function} callback
 * @return {[type]}            [description]
 */
System.prototype.loadVersions = function(launcher_version, callback) {
	Log.info(t.get('system.loading_versions'));
	db.reload();
	http.get(db.getData('/system/configurations').base_url + "launcher/versions.json", function(res) {
	    var body = '';

	    res.on('data', function(chunk) {
	        body += chunk;
	    });

	    res.on('end', function() {
	        var JSONResponse = JSON.parse(body); // Parsing data to JSON Object
	        // Ajout des versions du launcher
	        db.push('/launcher/version', {
	        	local: launcher_version,
	        	remote: JSONResponse.launcher
	        });
	        // Ajout des versions de Minecraft disponibles et la dernière disponible
	        db.push('/minecraft/versions', {
	        	all: JSONResponse.versions,
	        	latest: JSONResponse.latest
	        });
	        
        	Log.clear();
        	setTimeout(function() {
        		callback();
        	}, 500);
	    });
	}).on('error', function(e) {
		Log.error(t.get('error.loading_versions'), e);
	    throw e;
	});
}

/**
 * Vérification de la version du launcher
 * @param  {Function} callback [description]
 */
System.prototype.isUpToDate = function(callback) {
	db.reload();
	if (db.getData('/launcher/version').remote == "0.0.0") {
		Log.error(t.get('error.check_launcher_update'));
		callback();
	}
	else {
		if (ivn(db.getData('/launcher/version').local, db.getData('/launcher/version').remote)) {
			Log.info(t.get('system.update_available'));
			window.doUpdate();
		} else {
		  	Log.info(t.get('system.no_update_available'));
		}
		callback();
	}
	
}

/**
 * Permet de vérifier si les mods sont à jour (au niveau de la version local dans un fichier)
 * @param  {Function} callback
 * @return {Boolean}           [description]
 */
System.prototype.isModsUpToDate = function(callback) {
	if (ivn(db.getData('/minecraft/versions').all[db.getData('/launcher/selected_version')], db.getData('/minecraft/versions/local'))) {
		callback(true);
		return true;
	} else {
	  	callback(false);
	  	return false;
	}
}

module.exports = System;