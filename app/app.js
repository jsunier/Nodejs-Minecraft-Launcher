jQuery(document).ready(function($) {
	var gui = require('nw.gui');
	var fs = require('fs-extra');
	var async = require('async');
	var path = require('path');
	var Lang = require('mcms-node-localization');
	var Downloader = require(path.join(process.cwd(), 'scripts/downloader.js'));
	var Cache = require('ds-cache');
	var locales = ['fr','en']; //assuming you have 2 languages
	var t = new Lang({
	    directory : path.join(process.cwd(), 'app/locales'),
	    locales : locales
	});
	var cache = new Cache({
		auto_save: true,
		filename: 'data.json'
	});

	var isWin = /^win/.test(process.platform);
	var user_folder = process.env[isWin ? 'USERPROFILE' : 'HOME'];
	var options = {
		version: gui.App.manifest.version.toString(),
		minecraft_folder: isWin ? user_folder + "/AppData/Roaming/.minecraft" : user_folder + "/.minecraft",
		minecraft_launcher: isWin ? user_folder + "/desktop/Minecraft.exe" : user_folder + "/desktop/Minecraft.jar"
	};

	t.add(); // Initialisation des langues

	process.on('uncaughtException', function (err) {
	  console.log(err);
	})

	/*==========  Au démarrage du launcher  ==========*/
	
	disableInterface();
	console.log('Démarrage du launcher | version : ' + options.version);
	$('#main-background').animate({opacity: 1}, 1700); // Animation du background
	printInfo(t.get('info.versions'));

	setInputFile(options.minecraft_folder, 'installation-folder');
	setInputFile(options.minecraft_launcher, 'minecraft-launcher');

	printInfo(t.get('info.load_cache'));

	var dwn = new Downloader({
		minecraft_folder: options.minecraft_folder
	});

	try {
		async.series([
			function(callback) {
				if(gui.App.argv.indexOf("--reset") > -1) {
					printInfo("Nettoyage du cache de l'application...");
					console.log("Nettoyage de l'application");
					cache.clear();
					gui.App.clearCache();
					rmdirAsync('tmp', function() {
						callback();
					});
				}
				else callback();
			},
			function(callback) {
				printInfo("Chargement des versions...");
				cache.set('launcher_version', options.version);
				dwn.getVersions(function(versions) {
					$('#version option').remove();
					for(var version in versions.versions) {
						if (versions.latest == version) {
							$('#version').append('<option value="' + version + '" selected>' + version + '</option>');
						}
						else {
							$('#version').append('<option value="' + version + '">' + version + '</option>');
						}
					}
					callback();						
				});
			},
			function(callback) {
				printInfo("Vérification de la version du launcher...");
				dwn.isUpToDate(options.version, callback);
			}
		], function(err, results) {
			clearPrint();
			ready();
			enableInterface();
		});
	} catch(err) {
		console.error(err);
		printError('Erreur: ' + err.message);
	}


	/*==========  Démarrage du téléchargement  ==========*/

	$('#main-version').submit(function(event) {
		cache.load();
		event.preventDefault();
		var install_folder = $('#installation-folder').val();
		var minecraft_launcher = $('#minecraft-launcher').val();
		var selected_version = $('#version').val();
		var force_update = $('#force-update').prop('checked');
		var reset_profile = $('#reset-profile').prop('checked');
		cache.set('selected_version', selected_version);
		cache.set('minecraft_folder', install_folder);
		cache.set('minecraft_launcher', minecraft_launcher);
		printInfo("Préparation du téléchargement...");
		disableInterface();
		
		try {
			async.series([
				function(callback) {
					printInfo("Récupération des MD5 locaux...");
					dwn.getLocalHashes(callback);
				},
				function(callback) {
					printInfo("Récupération des MD5 distants...");
					dwn.getRemoteHashes(callback);
				},
				function(callback) {
					printInfo("Calcul des différences entre les fichiers locaux et distants...");
					dwn.getDifference(callback);
				},
				function(callback) {
					if (force_update) {
						printInfo("Suppression des mods pour le force udpate...");
						dwn.deleteFolders(callback);
					}
					else callback();
				},
				function(callback) {
					printInfo("Suppression des vieux mods...");
					dwn.deleteOldFiles(callback);
				},
				function(callback) {
					cache.load();
					if (cache.get('difference').length > 0 || force_update) {
						printInfo('Téléchargement des mods en cours...');
						dwn.downloadFiles(force_update, callback);
					}
					else callback();
				},
				function(callback) {
					cache.load();
					if (cache.get('refresh_configs') == true || force_update) {
						printInfo("Téléchargement des configurations...");
						dwn.downloadConfigs(callback);	
					}
					else callback();
				},
				function(callback) {
					if (reset_profile) {
						console.log("Remise à zéro du profil dans le launcher...");
						var profiles_file = cache.get('minecraft_folder') + "/launcher_profiles.json";
						fs.readJson(profiles_file, function(err, data) {
							if (err) {
								console.log(err);
								printError(err);
								callback();
							}
							else {
								data.profiles.Usinacraft = {
									"name": "Usinacraft",
									"lastVersionId": selected_version,
									"javaArgs": "-Xmx3G -Xms2G -XX:MaxPermSize\u003d2G -XX:+UseConcMarkSweepGC -XX:+CMSIncrementalMode -XX:-UseAdaptiveSizePolicy",
									"useHopperCrashService": false,
									"launcherVisibilityOnGameClose": "keep the launcher open"
								}
								data.selectedProfile = "Usinacraft";

								fs.writeJson(profiles_file, data, function(err) {
									if (err) console.log(err);
									console.log("Remise à zéro du profil terminée.");
									callback();
								});
							}
						});
					}
					else callback();
				}
			], function(err, results) {
				if (err) {
					console.log(err);
					enableInterface();
				}
				printInfo("Téléchargement terminé!");
				console.log('Terminé!');
				launchMinecraft();
			});
		} catch(err) {
			console.error(err);
			printError('Erreur: ' + err.message);
		}
	});

	$('.fake-file').on('click', function(event) {
		event.preventDefault();
		$(this).next().click();
	});

	$('input[type=file]').on('change', function(event) {
		event.preventDefault();
		$(this).prev().attr('data-tooltip', $(this).val());
	});

	$('body').on('click', '.external-link', function(event) {
		event.preventDefault();
		gui.Shell.openExternal($(this).attr('href'));
	});

	function launchMinecraft() {
		cache.load();
		printInfo("Lancement du launcher en cours...");
		console.log("Lancement du launcher Minecraft!");
		setTimeout(function() {
			require('child_process').exec(cache.get('minecraft_launcher')).unref();
			setTimeout(function() {
				gui.App.quit();
			}, 2000);
		}, 1000);
	}

	function disableInterface() {
		$('.basic-form input').prop('disabled', true);
		$('.basic-form select').prop('disabled', true);
		$('.basic-form button').prop('disabled', true);
	}

	function enableInterface() {
		$('.basic-form input').prop('disabled', false);
		$('.basic-form select').prop('disabled', false);
		if(ready()) $('.basic-form button').prop('disabled', false);
	}

	function printInfo(text) {
		$('#loadbar-info').removeClass('label-error').html(text);
	}

	function printError(text) {
		$('#loadbar-info').addClass('label-error').html(text);
	}

	function clearPrint() {
		$('#loadbar-info').html('');
	}

	function setInputFile(folder, id) {
		if (fs.existsSync(folder)) {
			var f = new File(folder, '');
			var files = new FileList();
			files.append(f);
			document.getElementById(id).files = files;
			if(files[0].path) $("#" + id).prev().attr('data-tooltip', files[0].path);
		}
	}

	function ready() {
		if($("#installation-folder").val() == "" || $('#minecraft-launcher').val() == "") {
			$('#connection').attr('disabled', 'disabled');
			return false;
		}
		else {
			$('#connection').removeAttr('disabled');
			return true;
		}
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
	}

	window.printInfo = printInfo;
	window.printError = printError;
	window.clearPrint = clearPrint;
});