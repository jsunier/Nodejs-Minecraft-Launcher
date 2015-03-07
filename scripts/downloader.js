/*==================================
=            Downloader            =
==================================*/

var ivn = require('is-version-newer');
var http = require('http');
var path = require('path');
var fs = require('fs-extra');
var crypto = require('crypto');
var async = require('async');
var Cache = require('ds-cache');
var manyHashes = require('many-file-hashes');
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
	        cache.save();
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
	fs.ensureDir(minecraft_folder + "/mods", function(err) {
		if (err) {
			console.log(err);
			main_callback();
		}
		else {
			console.log("Le dossier d'installation existe!");
			fs.readdir(minecraft_folder + "/mods", function(err,files){
			    if (err) console.log(err);
			    /*async.each(files, function(file, callback) {
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
			    });*/
				var all_files = new Array();
				async.each(files, function(file, callback) {
					if (fs.lstatSync(minecraft_folder + "/mods/" + file).isFile()) {
						all_files.push(minecraft_folder + "/mods/" + file);
						callback();
					}
					else 
						callback();
					
				}, function(err) {
					var options = {
					    files: all_files,
					    hash: 'md5'
					};

					manyHashes(options, function(err, hashes) {
						if (err) console.log(err);
					    cache.set('local_hash', hashes);
					    cache.save();
					    main_callback();
					});
				});
			});
		}
	});
}

Downloader.prototype.getRemoteHashes = function(callback) {
	cache.load();
	var version = cache.get('selected_version');
	http.get(base_url + "ressources/hash.php?version=" + version, function(res) {
	    var body = '';

	    res.on('data', function(chunk) {
	        body += chunk;
	    });

	    res.on('end', function() {
	        var JSONResponse = JSON.parse(body);
	        cache.set('remote_hash', JSONResponse);
	        cache.save();
	        callback();
	    });
	}).on('error', function(e) {
	    console.error("Erreur lors du chargement des hashes: ", e);
	    throw e;
	});
}


Downloader.prototype.getDifference = function(callback) {

	cache.load();
	var local_hashes = cache.get('local_hash');
	var remote_hashes = cache.get('remote_hash');
	var local_files = new Array();
	var remote_files = new Array();

	for(var hash in local_hashes) {
		var hash = local_hashes[hash];
		local_files.push(hash.hash);
	}
	for(var hash in remote_hashes.files.mods) {
		var hash = remote_hashes.files.mods[hash];
		remote_files.push(hash.etag);
	}

	var difference = removeFolderHash(diffArray(remote_files, local_files));

	console.log(difference);

	cache.set('difference', difference);

	var version_file = cache.get('minecraft_folder') + "/usinacraft_version.txt";

	cache.set('local_version', '0.0.0');
	cache.save();
	
	fs.stat(version_file, function(err, stat) {
	    if(err == null) {
			fs.readFile(version_file, 'utf8', function (err,data) {
				if (err) {
					console.log(err);
					callback();
				}
				cache.set('local_version', data);
				cache.save();
				callback();
			});
	    } else if(err.code == 'ENOENT') {
	        fs.writeFile(version_file, cache.get('remote_versions').versions[cache.get('selected_version')]);
	        callback();
	    } else {
	        console.log('Some other error: ', err.code);
	        callback();
	    }
	});


}

Downloader.prototype.deleteFolders = function(callback) {
	cache.load();
	rmdirAsync(cache.get('minecraft_folder') + "/config", function() {
		rmdirAsync(cache.get('minecraft_folder') + "/mods", function() {
			callback();
		})
	});
}

Downloader.prototype.countSize = function() {

}

Downloader.prototype.downloadFiles = function(force_update, main_callback) {
	cache.load();
	var minecraft_folder = cache.get('minecraft_folder') + "/";
	var selected_version = cache.get('selected_version');
	var local_version = cache.get('local_version');
	var last_version = cache.get('remote_versions');
	var remote_files = cache.get('remote_hash');
	var difference = cache.get('difference');
	var download_list = new Array();

	if (!fs.existsSync(cache.get('minecraft_folder') + "/config") || ivn(local_version, last_version.versions[selected_version]) || force_update)
		cache.set('refresh_configs', true);
	else
		cache.set('refresh_configs', false);

	for(var file in remote_files.files.mods) {
		var file = remote_files.files.mods[file];
		if (difference.indexOf(file.etag) > -1 || force_update) {
			download_list.push(file.path);
		}
	}

    var loader = window.document.getElementById('loader');
    loader.style.width = 0;

	async.eachSeries(download_list, function(file, callback) {
		if (!endsWith(file, '/')) {
			var url = base_url + 'ressources/' + selected_version + "/" + file;
			console.log("Téléchargement de: " + file);
			window.printInfo("Téléchargement de: " + file);
			fs.ensureFile(minecraft_folder + "/" + file, function(err) {
				if (err) console.log(err);
				var stream = fs.createWriteStream(minecraft_folder + "/" + file);
		        var loader = window.document.getElementById('loader');

				http.get(url, function(res) {
					var len = parseInt(res.headers['content-length'], 10);
		            var cur = 0;

				    res.pipe(stream);

				    res.on('data', function(chunk) {
				    	cur += chunk.length;
				    	loader.style.width = (100.0 * cur / len).toFixed(2) + "%";
				    });

				    res.on('end', function() {
				    	console.log("Téléchargement terminé");
				        callback();
				    });
				}).on('error', function(e) {
				    console.error("Erreur lors du téléchargement du fichier: " + file + " : ", e);
				    callback();
				});
			});
		}
		else {
			callback();
		}
	}, function(err) {
		if (err) console.log(err);
		console.log('Téléchargement des mods terminé.');
		main_callback();
	});

}

Downloader.prototype.downloadConfigs = function(main_callback) {
	cache.load();
	var download_list = new Array();
	var minecraft_folder = cache.get('minecraft_folder') + "/";
	var selected_version = cache.get('selected_version');
	var remote_files = cache.get('remote_hash');

	for(var file in remote_files.files.config) {
		var file = remote_files.files.config[file];
		download_list.push(file.path);
	}

	if(!fs.existsSync(cache.get('minecraft_folder') + "/config")) {
		fs.mkdirSync(cache.get('minecraft_folder') + "/config");
	}

    var loader = window.document.getElementById('loader');
    loader.style.width = 0;

	async.eachSeries(download_list, function(file, callback) {
		if (!endsWith(file, '/')) {
			var url = base_url + 'ressources/' + selected_version + "/" + file;
			console.log("Téléchargement de: " + file);
			window.printInfo("Téléchargement de: " + file);
			fs.ensureFile(minecraft_folder + "/" + file, function(err) {
				if (err) console.log(err);
				var stream = fs.createWriteStream(minecraft_folder + "/" + file);
		        var loader = window.document.getElementById('loader');
		        
				http.get(url, function(res) {
					var len = parseInt(res.headers['content-length'], 10);
		            var cur = 0;

				    res.pipe(stream);

				    res.on('data', function(chunk) {
				    	cur += chunk.length;
				    	loader.style.width = (100.0 * cur / len).toFixed(2) + "%";
				    });

				    res.on('end', function() {
				    	console.log("Téléchargement terminé");
				        callback();
				    });
				}).on('error', function(e) {
				    console.error("Erreur lors du téléchargement du fichier: " + file + " : ", e);
				    callback();
				});
			});
		}
		else {
			callback();
		}
	}, function(err) {
		if (err) console.log(err);
		console.log('Téléchargement des configurations terminé.');
		main_callback();
	});
}

/*==========  Additionnal functions  ==========*/


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

function diffArray(a, b) {
  var seen = [], diff = [];
  for ( var i = 0; i < b.length; i++)
      seen[b[i]] = true;
  for ( var i = 0; i < a.length; i++)
      if (!seen[a[i]])
          diff.push(a[i]);
  return diff;
}

function removeFolderHash(a) {
	for (var i = 0; i < a.length; i++) {
		if(a[i] == "d41d8cd98f00b204e9800998ecf8427e") delete a[i];
	}
	return a;
}

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function rmdirAsync(path, callback) {
	fs.readdir(path, function(err, files) {
		if(err) {
			// Pass the error on to callback
			callback(err, []);
			return;
		}
		var wait = files.length,
			count = 0,
			folderDone = function(err) {
			count++;
			// If we cleaned out all the files, continue
			if( count >= wait || err) {
				fs.rmdir(path,callback);
			}
		};
		// Empty directory to bail early
		if(!wait) {
			folderDone();
			return;
		}
		
		// Remove one or more trailing slash to keep from doubling up
		path = path.replace(/\/+$/,"");
		files.forEach(function(file) {
			var curPath = path + "/" + file;
			fs.lstat(curPath, function(err, stats) {
				if( err ) {
					callback(err, []);
					return;
				}
				if( stats.isDirectory() ) {
					rmdirAsync(curPath, folderDone);
				} else {
					fs.unlink(curPath, folderDone);
				}
			});
		});
	});
};

module.exports = Downloader;