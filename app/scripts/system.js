/*==============================================
=            Operating System Class            =
==============================================*/

/*==========  Variables  ==========*/

var gui = global.window.nwDispatcher.requireNwGui();
/*
var isWin = /^win/.test(process.platform);
var user_folder = process.env[isWin ? 'USERPROFILE' : 'HOME'];
var options = {
	version: gui.App.manifest.version.toString(),
	minecraft_folder: getMinecraftFolder(isWin, user_folder),
	minecraft_launcher: getMinecraftLauncher(isWin, user_folder),
	title: " - BETA v" + gui.App.manifest.version.toString(),
	update_link: "http://usinacraft.ch/server/launcher",
	is_windows : isWin,
	user_folder : user_folder,
	launch_minecraft: true
};*/
var LowDB = require('lowdb');
var db = new LowDB('db.json');
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
	Log.info("Configurations du launcher en cours de chargement...");

	window.lockInterface();

	var options = this;

	async.series([
		function(callback) {
			if(gui.App.argv.indexOf("--reset") > -1) {
				Log.info(t.get('info.clear_all'));
				db('system.configurations').remove();
				gui.App.clearCache();
			}
			callback();
		},
		function(callback) { // Si la base de données n'existe pas, on la créé
			if (db("system.configurations").size() == 0) {
				db("system.configurations").push({
					os: options.os,
					is: options.is,
					user_folder: options.user_folder,
					base_url: options.base_url,
					update_url: options.update_url,
					launcher_version: options.launcher_version,
					launch_minecraft_on_finish: true
				});
				callback();
			}
			else callback();
		},
		function(callback) {
			if (db('launcher.version').size() == 0) {
				db('launcher.version').push({
					local: '0.0.0',
					remote: '0.0.0'
				});
				callback();
			}
			else callback();
		},
		function(callback) {
			if (db('minecraft.versions').size() == 0) {
				db('minecraft.versions').push({
					all: {},
					latest: "Usinacraft"
				});
				callback();
			}
			else callback();
		},
		function(callback) {
			// Application des informations conservés dans la base de données
			for(var i in db('system.configurations').first()) {
				this[i] = db('system.configurations').first()[i];
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
	Log.info("Chargement des versions en cours...");
	http.get(db('system.configurations').first().base_url + "launcher/versions.json", function(res) {
	    var body = '';

	    res.on('data', function(chunk) {
	        body += chunk;
	    });

	    res.on('end', function() {
	        var JSONResponse = JSON.parse(body); // Parsing data to JSON Object
	        // Ajout des versions du launcher
	        db('launcher.version').chain().first().assign({
	        	local: launcher_version,
	        	remote: JSONResponse.launcher
	        }).value();
	        // Ajout des versions de Minecraft disponibles et la dernière disponible
	        db('minecraft.versions').chain().first().assign({
	        	all: JSONResponse.versions,
	        	latest: JSONResponse.latest
	        }).value();
	        
        	Log.clear();
        	setTimeout(function() {
        		callback();
        	}, 200);
	    });
	}).on('error', function(e) {
		Log.error("Erreur lors du chargement des versions: ", e);
	    throw e;
	});
}

/**
 * Vérification de la version du launcher
 * @param  {Function} callback [description]
 */
System.prototype.isUpToDate = function(callback) {
	if (db('launcher.version') == "") {
		Log.error("Impossible de vérifier la version du launcher");
		callback();
	}
	else {
		if (ivn(db('launcher.version').first().local, db('launcher.version').first().remote)) {
			Log.info("Une nouvelle version du launcher est disponible!");
			window.doUpdate();
		} else {
		  	Log.info("Le launcher est à jour");
		}
		callback();
	}
	
}

module.exports = System;