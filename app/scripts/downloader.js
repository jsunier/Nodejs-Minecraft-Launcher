/*==================================
=            Downloader            =
==================================*/

var ivn = require('is-version-newer');
var http = require('http');
var path = require('path');
var fs = require('fs-extra');
var crypto = require('crypto');
var async = require('async');
var manyHashes = require('many-file-hashes');

/**
 * Downloader
 */
function Downloader() {
	var default_args = {
		'main_dir': "%APPDATA%/.minecraft",
		'scan_folders': ["mods", "config", "libraries"],
		'remove_folders':	["mods", "config"],
		'base_url':	"http://files.usinacraft.ch/"
	}

	for(var i in default_args) {
		this[i] = default_args[i];
	}

	if (!endsWith(this.main_dir, '/')) {
		this.main_dir += "/";
	}
}

/**
 * Define main dir of Minecraft (.minecraft)
 * @param {String} dir 
 */
Downloader.prototype.setMainDir = function(dir) {
	if (typeof dir != "undefined") {
		Log.debug("Dossier principal défini sur '" + dir + "'");
		this.main_dir = dir;
		if (!endsWith(this.main_dir, '/')) {
			this.main_dir += "/";
		}
	}
}

Downloader.prototype.load = function(callback) {
	cache.load();
	Log.info("Chargement des versions en cours...");
	http.get(this.base_url + "launcher/versions.json", function(res) {
	    var body = '';

	    res.on('data', function(chunk) {
	        body += chunk;
	    });

	    res.on('end', function() {
	        var JSONResponse = JSON.parse(body);
	        cache.set('remote_versions', JSONResponse);
        	cache.save();
        	Log.clear();
        	callback(JSONResponse);
	    });
	}).on('error', function(e) {
		Log.error("Erreur lors du chargement des versions: ", e);
	    throw e;
	});
}

/**
 * Récuperer les versions existantes
 * @param  {Function} callback 
 */
Downloader.prototype.getVersions = function(callback) {
	cache.load();
	http.get(this.base_url + "launcher/versions.json", function(res) {
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
		Log.error("Erreur lors du chargement des versions: ", e);
	    throw e;
	});
}

/**
 * Vérifier si le launcher est à jour
 * @param  {Object}  versions JSON des versions (doit aussi contenir la version du launcher)
 * @return {Boolean}          true si une mise à jour est disponible et false si le launcher est à jour
 */
Downloader.prototype.isUpToDate = function(local_version, callback) {
	cache.load();
	var remote_versions = cache.get('remote_versions');
	if (typeof remote_versions == "undefined" || remote_versions == null) {
		Log.error("Impossible de vérifier la version du launcher");
	}
	else {
		if (ivn(local_version, remote_versions.launcher)) {
			Log.info("Une nouvelle version du launcher est disponible!");
			window.doUpdate();
		} else {
		  	Log.info("Le launcher est à jour");
		}
	}
	
	callback();
}

/**
 * Récuperer les hashes du contenu de tout les fichiers en MD5
 * @param {Function} main_callback Callback
 */
Downloader.prototype.getLocalHashes = function(main_callback) {
	cache.load();
	var main_dir = this.main_dir;
	getFoldersHashes(this.scan_folders, main_dir, function(hashes) {
		cache.clear('local_hash');
	    cache.set('local_hash', hashes);
	    cache.save();
	    main_callback();
	});
}

/**
 * Récupération des hashes sur le serveur
 * @param  {Function} callback
 */
Downloader.prototype.getRemoteHashes = function(callback) {
	cache.load();
	var version = cache.get('selected_version');
	http.get(this.base_url + "ressources/index.php?version=" + version, function(res) {
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
	    Log.error("Erreur lors du chargement des hashes: ", e);
	    throw e;
	});
}

/**
 * Calcul de la différence entre les hashes locaux et les hashes distants
 * @param  {Function} callback
 */
Downloader.prototype.getDifference = function(callback) {
	cache.load();
	var local_hashes = cache.get('local_hash');
	var remote_hashes = cache.get('remote_hash');
	var remote_versions = cache.get('remote_versions');
	var local_files = new Array();
	var remote_files = new Array();

	for(var hash in local_hashes) {
		var hash = local_hashes[hash];
		local_files.push(hash.hash);
	}
	for(var hash in remote_hashes.files) {
		var hash = remote_hashes.files[hash];
		remote_files.push(hash.etag);
	}

	var difference = removeFolderHash(diffArray(remote_files, local_files)); // Difference entre local et distant (mods manquants)
	var difference2 = removeFolderHash(diffArray(local_files, remote_files)); // Difference entre distant et local (mods en trop)

	cache.clear('difference');
	cache.clear('difference2');
	cache.set('difference', difference);
	cache.set('difference2', difference2);
	cache.save();

	var version_file = this.main_dir + "usinacraft_version.txt";
	
	fs.stat(version_file, function(err, stat) {
	    if(err == null) {
			fs.readFile(version_file, 'utf8', function (err,data) {
				if (err) {
					Log.error(err);
					callback();
				}
				cache.set('mods_version', data);
				fs.writeFile(version_file, remote_versions.versions[cache.get('selected_version')], function(err) {
					if(err) Log.error(err);
					callback();
				});
			});
	    } else if(err.code == 'ENOENT') {
	        fs.writeFile(version_file, remote_versions.versions[cache.get('selected_version')], function(err) {
	        	if(err) Log.error(err);
	        	cache.set('mods_version', remote_versions.versions[cache.get('selected_version')]);
	        	cache.save();
	        	callback();
	        });
	    } else {
	        Log.error('Impossible de déterminer la version locale des mods: ', err.code);
	        callback();
	    }
	});


}

/**
 * Suppression des dossiers lors d'un "force update" ou lors du premier téléchargement
 * @param  {Function} main_callback
 */
Downloader.prototype.deleteFolders = function(main_callback) {
	cache.load();
	var main_dir = this.main_dir, dest = null;
	async.eachSeries(this.remove_folders, function(folder, callback) {
		dest = main_dir + folder;
		fs.exists(dest, function(exist) {
			if(!exist) {
				Log.info("Les dossiers à supprimer n'existe pas");
				callback();
			}
			fs.remove(dest, function(err) {
				if(err) {
					Log.error(err);
					callback();
				}
				callback();
			});
		});
	}, function(err) {
		Log.info("Suppression des dossiers terminée");
		main_callback();
	});
}

/**
 * Suppression des fichiers dont le hash local n'existe pas dans la liste des hashes distants
 * @param  {Function} main_callback
 */
Downloader.prototype.deleteOldFiles = function(main_callback) {
	cache.load();
	var difference = cache.get('difference2');
	var local_files = cache.get('local_hash');

	async.eachSeries(local_files, function(file, callback) {
		if (difference.indexOf(file.hash) > -1 && difference.indexOf(file.hash) != false) {
			Log.info("Suppression de : " + file.fullPath);
			fs.remove(file.fullPath, function(err) {
				if (err) Log.error(err);
				callback()
			});
		}
		else
			callback();
	}, function(err) {
		if (err) Log.error(err);
		Log.info("Anciens mods supprimés!");
		main_callback();
	});
}

/**
 * Téléchargement des fichiers de base nécessaire au démarrage de minecraft
 * @param  {Function} main_callback 
 */
Downloader.prototype.downloadBase = function(main_callback) {
	cache.load();
	var types = [".jar", ".json"];
	var selected_version = cache.get('selected_version');
	var main_dir = this.main_dir;
	var dest = main_dir + "versions/" + selected_version + "/" + selected_version;
	var url = this.base_url + 'ressources/' + selected_version + "/" + selected_version;

	async.eachSeries(types, function(type, callback) {
		Log.info("Téléchargement de " + selected_version + type);
		downloadFile(dest + type, url + type, callback);
	}, function(err) {
		if (err) Log.error(err);
		Log.info("Téléchargement des fichiers de base terminé");
		main_callback();
	});
}

/**
 * Téléchargement des fichiers selon la différence entre les hashes distants et les hashes locaux
 * @param  {Boolean} force_update  Forcer la mise à jour
 * @param  {Function} main_callback 
 */
Downloader.prototype.downloadFiles = function(force_update, main_callback) {
	cache.load();
	var main_dir = this.main_dir;
	var selected_version = cache.get('selected_version');
	var mods_version = cache.get('mods_version');
	var last_version = cache.get('remote_versions');
	var remote_files = cache.get('remote_hash');
	var difference = cache.get('difference');
	var download_list = new Array();
	var base_url = this.base_url;

	for(var file in remote_files.files) {
		var file = remote_files.files[file];
		if (difference.indexOf(file.etag) > -1 || force_update) {
			download_list.push(file.path);
		}
	}

    var loader = window.document.getElementById('loader');
    loader.style.width = 0;

	async.eachSeries(download_list, function(file, callback) {
		if (!endsWith(file, '/')) {
			var url = base_url + 'ressources/' + selected_version + "/" + file;
			var dest = main_dir + file;
			Log.info("Téléchargement de : " + path.basename(file));
			downloadFile(dest, url, callback);
		}
		else {
			callback();
		}
	}, function(err) {
		if (err) Log.error(err);
		Log.info('Téléchargement des fichiers terminé.');
		main_callback();
	});

}

/**
 * Téléchargement des configurations des mods selon la différence entre les hashes distants et les hashes locaux
 * @param  {Function} main_callback
 */
Downloader.prototype.downloadLibraries = function(main_callback) {
	cache.load();
	var download_list = new Array();
	var main_dir = this.main_dir;
	var selected_version = cache.get('selected_version');
	var remote_files = cache.get('remote_hash');
	var base_url = this.base_url;

	for(var file in remote_files.libraries) {
		var file = remote_files.libraries[file];
		download_list.push(file.path);
	}

    var loader = window.document.getElementById('loader');
    loader.style.width = 0;

	async.eachSeries(download_list, function(file, callback) {
		if (!endsWith(file, '/')) {
			var url = base_url + 'ressources/libraries/' + file;
			var dest = main_dir + "libraries/" + file;
			Log.info("Téléchargement de la librairie : " + path.basename(file));
			downloadFile(dest, url, callback);
		}
		else {
			callback();
		}
	}, function(err) {
		if (err) Log.error(err);
		Log.info('Téléchargement des librairies terminé.');
		main_callback();
	});
}

/*==========  Additionnal functions  ==========*/

/**
 * Téléchargement d'un fichier avec affichage dans la barre de progression
 * @param  {String}   dest     Destination du fichier
 * @param  {String}   url      URL de téléchargement
 * @param  {Function} callback
 * @return {[type]}            [description]
 */
function downloadFile(dest, url, callback) {
	fs.ensureFile(dest, function(err) {
		if (err) {
			Log.error(err);
			callback();
		}
		var stream = fs.createOutputStream(dest);
        var loader = window.document.getElementById('loader');
        var basename = path.basename(dest);
        
		try {
			http.get(url, function(res) {
				var len = parseInt(res.headers['content-length'], 10);
	            var cur = 0, percent;

			    res.pipe(stream);

			    res.on('data', function(chunk) {
			    	cur += chunk.length;
			    	percent = (100.0 * cur / len).toFixed(2) + "%";
			    	loader.style.width = percent;
			    	Log.info("Téléchargement de " + basename + " en cours... " + percent, true);
			    });

			    res.on('end', function() {
			    	Log.debug("Téléchargement terminé : " + dest);
			        callback();
			    });
			}).on('error', function(e) {
			    Log.error("Erreur lors du téléchargement du fichier: " + dest + " : ", e);
			    callback();
			});
		} catch(e) {
			Log.error(e);
			callback();
		}
	});
}

/**
 * Scan tous les dossiers du tableau et récupère tous les "hash" de chaque fichier
 * @param  {[type]} folders          [description]
 * @param  {[type]} main_dir [description]
 * @param  {[type]} main_callback    [description]
 * @return {[type]}                  [description]
 */
function getFoldersHashes(folders, main_dir, main_callback) {
	var all_files = new Array();
	async.each(folders, function(folder, callback_1) {
		fs.ensureDir(main_dir + folder, function(err) {
			if (err) {
				Log.error(err);
				callback_1();
			}
			else {
				fs.readdir(main_dir + folder, function(err,files) {
				    if (err) Log.error(err);
					async.each(files, function(file, callback) {
						if (fs.lstatSync(main_dir + folder + "/" + file).isFile()) {
							all_files.push(main_dir + folder + "/" + file);
							callback();
						}
						else 
							callback();
					}, function(err) {
						callback_1();
					});
				});
			}
		});
	}, function(err) {
		if (err) {
			Log.error(err);
			main_callback();
		}

		manyHashes({files: all_files, hash: 'md5'}, function(err, hashes) {
			if (err) Log.error(err);
		    main_callback(hashes);
		});
	});
}

/**
 * Récuperer le contenu d'un fichier et le crypt en MD5 pour en récuperer le "hash"
 * @param  {String}   file     Chemin d'accès au fichier
 * @param  {Function} callback Retourne le hash dans un callback
 */
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

/**
 * Calcul la différence entre 2 tableaux
 * @param  {Array} a Premier tableau
 * @param  {Array} b Deuxième tableau
 * @return {Array}   Retourne le tableau sans le hash des dossiers
 */
function diffArray(a, b) {
  var seen = [], diff = [];
  for ( var i = 0; i < b.length; i++)
      seen[b[i]] = true;
  for ( var i = 0; i < a.length; i++)
      if (!seen[a[i]])
          diff.push(a[i]);
  return diff;
}

/**
 * Retirer le "hash" de base des dossiers dans un tableau
 * @param  {Array} a Tableau de hash
 */
function removeFolderHash(a) {
	for (var i = 0; i < a.length; i++) {
		if(a[i] == "d41d8cd98f00b204e9800998ecf8427e") delete a[i];
	}
	return a;
}

/**
 * Vérifier si une chaîne de caractères se terminent par un caractère précis
 * @param  {String} str    Chaîne de caractère
 * @param  {String} suffix Caractère à vérifier
 * @return {Boolean}       Si la chaîne de caractère se termine par le caractère spécifié, return true, sinon return false 
 */
function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

/**
 * Suppression de dossier de manière "récursive" en supprimant tout les sous-dossier
 * @param  {String}   path     Chemin d'accès au dossier
 * @param  {Function} callback
 */
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
}

module.exports = Downloader;