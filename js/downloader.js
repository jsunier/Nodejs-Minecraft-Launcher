/*==================================
=            Downloader            =
==================================*/

var dld = require('dld');
var ivn = require('is-version-newer');
var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var async = require('async');
var Cache = require('ds-cache');
var base_url = "http://minecraft.usinacraft.ch/";
var cache = new Cache({
	auto_save: true,
	filename: 'data.json'
});
cache.load();

function Downloader(options) {
	this.minecraft_folder = options.minecraft_folder;
	this.files = {};
}

/**
 * Récuperer les versions existantes
 * @param  {Function} callback 
 */
Downloader.prototype.getVersions = function(callback) {
	http.get(base_url + "new_launcher/versions.json", function(res) {
	    var body = '';

	    res.on('data', function(chunk) {
	        body += chunk;
	    });

	    res.on('end', function() {
	        var JSONResponse = JSON.parse(body);
	        cache.set('remote_versions', JSONResponse);
	        callback(JSONResponse);
	    });
	}).on('error', function(e) {
	    console.error("Erreur lors du chargement des versions: ", e);
	    throw e;
	});
}

/**
 * Vérifier si le launcher est à jour
 * @param  {Object}  versions JSON des versions (doit aussi contenir la version du launcher)
 * @return {Boolean}          true si une mise à jour est disponible et false si le launcher est à jour
 */
Downloader.prototype.isUpToDate = function(local_version, callback) {
	var versions = cache.get('remote_versions');
	if (typeof versions == "undefined" || versions == null) {
		console.error('Impossible de vérifier la version du launcher');
	}
	else {
		if (ivn(local_version, versions.launcher)) {
			console.log('Une nouvelle version du launcher est disponible');
		} else {
		  	console.log('Launcher à jour');
		}
	}
	callback();
}

/**
 * Récuperer les hashes du contenu de tout les fichiers en MD5
 * @return {[type]} [description]
 */
Downloader.prototype.getLocalHashes = function(main_callback) {
	var minecraft_folder = this.minecraft_folder;
	var data = this.files;
	if (fs.existsSync(minecraft_folder)) {
		fs.readdir(minecraft_folder + "/mods/", function(err,files){
		    if (err) throw err;
		    async.each(files, function(file, callback) {
		    	var dirfile = minecraft_folder + "/mods/" + file;
		        if (fs.lstatSync(dirfile).isFile()) {
		        	var hash = getHash(dirfile, function(hash) {
		        		data[file] = hash;
		        		callback();
		        	});
			    }
			    else {
			    	callback();
			    }
		    }, function() {
				cache.set('local_hash', data);
				cache.save();
				main_callback();
		    });
		});
	}
	else {
		console.log("Le dossier d'installation n'existe pas");
		main_callback();
	}
}

Downloader.prototype.getRemoteHashes = function() {

}

Downloader.prototype.getDifference = function() {

}

Downloader.prototype.countSize = function() {

}

Downloader.prototype.downloadFiles = function() {

}

function getHash(file, callback) {
	var fd = fs.createReadStream(file);
	var hash = crypto.createHash('md5');
	hash.setEncoding('hex');

	fd.on('end', function() {
	    hash.end();
	    var file_hash = hash.read();
		callback(file_hash);
	});

	// read all file and pipe it (write it) to the hash object
	fd.pipe(hash);
}

module.exports = Downloader;