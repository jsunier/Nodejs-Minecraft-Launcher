/*==================================
=            Downloader            =
==================================*/

var dld = require('dld');
var ivn = require('is-version-newer');
var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var base_url = "http://minecraft.usinacraft.ch/";

function Downloader(options) {
	this.gui = options.gui;
	this.minecraft_folder = options.minecraft_folder;
	this.cache = options.cache;
	this.files = {};
}

/**
 * Récuperer les versions existantes
 * @param  {Function} callback 
 */
Downloader.prototype.getVersions = function(callback) {
	var cache = this.cache;
	http.get(base_url + "new_launcher/versions.json", function(res) {
	    var body = '';

	    res.on('data', function(chunk) {
	        body += chunk;
	    });

	    res.on('end', function() {
	        var JSONResponse = JSON.parse(body);
	        cache.put('remote_versions', JSONResponse);
	        callback(JSONResponse);
	    });
	}).on('error', function(e) {
	      console.error("Erreur lors du chargement des versions: ", e);
	});
}

/**
 * Vérifier si le launcher est à jour
 * @param  {Object}  versions JSON des versions (doit aussi contenir la version du launcher)
 * @return {Boolean}          true si une mise à jour est disponible et false si le launcher est à jour
 */
Downloader.prototype.isUpToDate = function(versions) {
	var local_version = this.gui.App.manifest.version;
	if (typeof versions == "undefined") {
		console.error('Impossible de vérifier la version du launcher');
	}
	else {
		if (ivn(local_version, versions.launcher)) {
			console.log('Une nouvelle version du launcher est disponible');
			return true;
		} else {
		  	console.log('Launcher à jour');
			return false;
		}
	}
}

/**
 * Récuperer les hashes du contenu de tout les fichiers en MD5
 * @return {[type]} [description]
 */
Downloader.prototype.getLocalHashes = function() {
	var cache = this.cache;
	var minecraft_folder = this.minecraft_folder;
	fs.readdir(minecraft_folder,function(err,files){
	    if (err) throw err;
	    var c=0;
	    files.forEach(function(file){
	        c++;
	        fs.readFile(minecraft_folder+file,'utf-8',function(err,html){
	            if (err) throw err;
	            data[file]=html;
	            if (0===--c) {
	                console.log(data);
	            }
	        });
	    });
	});
	
	for(var file in this.files) {
		var fd = fs.createReadStream('file');
		var hash = crypto.createHash('md5');
		hash.setEncoding('hex');

		fd.on('end', function() {
		    hash.end();
		    console.log(hash.read()); // the desired sha1sum
		});

		// read all file and pipe it (write it) to the hash object
		fd.pipe(hash);
	}
}

Downloader.prototype.countSize = function() {

}

Downloader.prototype.downloadFiles = function() {

}

module.exports = Downloader;