jQuery(document).ready(function($) {
	/*===========================================
	=            Usinacraft Launcher            =
	===========================================*/

	/*==========  Initialisation des modules  ==========*/
	
	var gui = require('nw.gui');
	var fs = require('fs-extra');
	var async = require('async');
	var path = require('path');
	var Lang = require('mcms-node-localization');
	var DownloaderClass = require('./app/scripts/downloader.js');
	var Downloader = new DownloaderClass();
	var JsonDB = require('node-json-db');
	var db = new JsonDB("launcher", true, false);
	var LoggerClass = require('./app/scripts/logger.js');
	var Log = new LoggerClass({
		info: printInfo,
		error: printError,
		warn: printWarn,
		clear: clearPrint
	});
	var SystemClass = require('./app/scripts/system.js');
	var System = new SystemClass();
	var locales = ['fr', 'en']; //assuming you have 2 languages
	// Définition des langues
	var t = new Lang({
	    directory : './app/locales',
	    locales : locales
	});
	t.add(); // Initialisation des langues
	t.setLocale('fr');

	Log.info(t.get('info.launching', gui.App.manifest.version.toString()));

	/*==========  Ajout des fonctions principales à "window"  ==========*/
	
	Log.debug("Définition des variables...");
	
	window.printInfo = printInfo;
	window.printError = printError;
	window.clearPrint = clearPrint;
	window.lockInterface = lockInterface;
	window.unlockInterface = unlockInterface;
	window.setLoad = setLoad;
	window.doUpdate = doUpdate;
		
	/*==========  Variables globales  ==========*/
	

	global.db = db;
	global.t = t;
	global.Log = Log;
	global.$ = $;

	var default_msg = {
		folder: $('#installation-folder').prev().find('.tooltip').text(),
		launcher: $('#minecraft-launcher').prev().find('.tooltip').text(),
	}

	/*==========  Protection contre les "gros" crash  ==========*/

	process.on('uncaughtException', function (err) {
		Log.error(err);
	});

	/*==========  Au démarrage du launcher  ==========*/
	
	System.setup(function() { // Application des versions
		$('#version option').remove();
		db.reload();
		var latest = db.getData('/minecraft/versions').latest;
		for(var version in db.getData('/minecraft/versions').all) {
			if (latest == version) {
				$('#version').append('<option value="' + version + '" selected>' + version + '</option>');
			}
			else {
				$('#version').append('<option value="' + version + '">' + version + '</option>');
			}
		}
		setInputFile(db.getData('/system/configurations').minecraft_folder, path.dirname(db.getData('/system/configurations').minecraft_folder), 'installation-folder');
		setInputFile(db.getData('/system/configurations').minecraft_launcher, path.basename(db.getData('/system/configurations').minecraft_launcher), 'minecraft-launcher');
		Downloader.setMainDir(db.getData('/system/configurations').minecraft_folder);
	});
	$('title').append(System.title);
	var random_background = Math.floor(Math.random() * 4) + 1; // Nombre aléatoire pour choisir en les différent background disponibles
	$('#main-background').css("background-image", 'url("./app/css/images/background_' + random_background + '.png")').animate({opacity: 1}, 1700); // Animation du background

	/*==========  Définition du système de téléchargement  ==========*/


	/*==========  Démarrage du téléchargement  ==========*/

	$('#main-version').submit(function(event) {
		db.reload();
		event.preventDefault();
		lockInterface();
		var install_folder = $('#installation-folder').val();
		var minecraft_launcher = $('#minecraft-launcher').val();
		var selected_version = $('#version').val();
		var force_update = $('#force-update').prop('checked');
		var reset_profile = $('#reset-profile').prop('checked');
		db.push('/launcher/selected_version', selected_version);
		Log.info(t.get('info.prepare_download'));
		console.log(install_folder);

		/*==========  Définition du système de téléchargement  ==========*/

		Downloader.setMainDir(install_folder);
		Downloader.setLauncher(System);

		/*==========  Démarrage des tâches  ==========*/

		try {
			async.series([
				function(callback) {
					Log.info(t.get('downloader.get_local_hashes'));
					Downloader.getLocalHashes(callback);
				},
				function(callback) {
					Log.info(t.get('downloader.get_remote_hashes'));
					Downloader.getRemoteHashes(callback);
				},
				function(callback) {
					Log.info(t.get('downloader.get_difference'));
					Downloader.getDifference(callback);
				},
				function(callback) {
					if (force_update) {
						Log.info(t.get('downloader.delete_folders'));
						Downloader.deleteFolders(callback);
					}
					else callback();
				},
				function(callback) {
					Log.info(t.get('downloader.delete_files'));
					Downloader.deleteOldFiles(callback);
				},
				function(callback) {
					Log.info(t.get('downloader.base'));
					Downloader.downloadBase(callback);
				},
				function(callback) {
					db.reload();
					if (db.getData('/system/difference/missing').length > 0 || force_update) {
						Log.info(t.get('downloader.files'));
						Downloader.downloadFiles(force_update, callback);
					}
					else callback();
				},
				function(callback) {
					System.isModsUpToDate(function(need_update) {
						if (need_update == true) {
							Log.info(t.get('downloader.libraries'));
							Downloader.downloadLibraries(callback);	
						}
						else {
							callback();
						}
					});
				},
				function(callback) {
					if (reset_profile) { // Configuration du profile (si l'utilisateur à coché la case "Réinitialiser le profil")
						Log.info(t.get('downloader.reset_profile'));
						var profiles_file = db.getData('/system/configurations').minecraft_folder + "/launcher_profiles.json";
						fs.readJson(profiles_file, function(err, data) {
							if (err) {
								Log.error(t.get('error.reset_profile'), err);
								callback();
							}
							else {
								data.profiles.Usinacraft = {
									"name": "Usinacraft",
									"lastVersionId": selected_version,
									"javaArgs": "-Xmx3G -Xmn1G -XX:MaxPermSize=3G -XX:+UseConcMarkSweepGC -XX:+CMSIncrementalMode -XX:-UseAdaptiveSizePolicy",
									"useHopperCrashService": false,
									"launcherVisibilityOnGameClose": "keep the launcher open"
								}
								data.selectedProfile = "Usinacraft";

								fs.writeJson(profiles_file, data, function(err) {
									if (err) Log.error(err);
									Log.info(t.get('downloader.reset_profile_done'));
									callback();
								});
							}
						});
					}
					else {
						Log.info(t.get('downloader.apply_profiles_changes'));
						var profiles_file = db.getData('/system/configurations').minecraft_folder + "/launcher_profiles.json";
						fs.readJson(profiles_file, function(err, data) {
							if (err) {
								Log.error(t.get('error.reset_profile'), err);
								callback();
							}
							else {
								if(typeof data.profiles.Usinacraft.javaArgs != "undefined") {
									data.profiles.Usinacraft.javaArgs = "-Xmx3G -Xmn1G -XX:MaxPermSize=3G -XX:+UseConcMarkSweepGC -XX:+CMSIncrementalMode -XX:-UseAdaptiveSizePolicy";
								}
								data.selectedProfile = "Usinacraft";

								fs.writeJson(profiles_file, data, function(err) {
									if (err) Log.error(err);
									Log.info(t.get('downloader.reset_profile_done'));
									callback();
								});
							}
						});
					}
				}
			], function(err, results) {
				if (err) {
					Log.error(err);
					unlockInterface();
				}
				Log.info(t.get('downloader.done'));
				launchMinecraft();
			});
		} catch(err) {
			Log.error(t.get('error.error', {err: err.message}));
		}
	});

	/*==========  Actions sur la page  ==========*/

	$('.fake-file').on('click', function(event) {
		event.preventDefault();
		$(this).next().click();
	});

	$('.installs input[type=file]').on('change', function(event) {
		event.preventDefault();
		if ($(this).val() == "") {
			$(this).prev().addClass('error-state');
			$(this).prev().html($(this).prev().html().replace(t.get('info.edit'), t.get('info.choose')));
			$(this).prev().find('.tooltip').text($(this).attr('id') == "installation-folder" ? default_msg.folder : default_msg.launcher);
		}
		else {
			$(this).prev().html($(this).prev().html().replace(t.get('info.choose'), t.get('info.edit')));
			$(this).prev().find('.tooltip').text($(this).attr('id') == "installation-folder" ? t.get('info.actual_folder') + $(this).val() : t.get('info.actual_launcher') + $(this).val());
			$(this).prev().removeClass('error-state');
		}
		unlockInterface();
	});

	$('body').on('click', '.external-link', function(event) {
		event.preventDefault();
		gui.Shell.openExternal($(this).attr('href'));
	});

	/*==========  Main functions  ==========*/

	function launchMinecraft() {
		db.reload();
		if(System.launch_minecraft_on_finish) {
			Log.info(t.get("info.starting_minecraft"));
			setTimeout(function() {
				require('child_process').exec(db.getData('/system/configurations').minecraft_launcher).unref();
				setTimeout(function() {
					gui.App.quit();
				}, 2000);
			}, 500);
		}
	}

	/**
	 * Vérifie si le launcher est prêt pour le téléchargement
	 * @return {Boolean} true : si le launcher est prêt, false : si le launcher n'est pas prêt
	 */
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

	/**
	 * Désactive tout les boutons de l'interface
	 */
	function lockInterface() {
		$('.basic-form input').prop('disabled', true);
		$('.basic-form select').prop('disabled', true);
		$('.basic-form button').prop('disabled', true);
		$("#download-percent").removeClass('idle');
	}

	/**
	 * Active tout les boutons de l'interface
	 */
	function unlockInterface() {
		$('.basic-form input').prop('disabled', false);
		$('.basic-form select').prop('disabled', false);
		$('.basic-form button').not('#connection').prop('disabled', false);
		$("#download-percent").addClass('idle');
		if(ready()) $('.basic-form #connection').prop('disabled', false);
	}

	/*===================================================
	=            Fonctions intégrés à Logger            =
	===================================================*/
	
	function printInfo(text) {
		$('#loadbar-info').removeClass('label-error label-warning').html(text);
	}

	function printError(text) {
		$('#loadbar-info').removeClass("label-warning").addClass('label-error').html(text);
	}

	function printWarn(text) {
		$('#loadbar-info').removeClass("label-error").addClass('label-warning').html(text);
	}

	function setLoad(percent) {
		$("#download-percent").text(percent);
	}

	function clearPrint() {
		$('#loadbar-info').html('');
	}

	/*-----  End of Fonctions intégrés à Logger  ------*/

	function setInputFile(file, name, id) {
		var f = new File(file, name);
		var files = new FileList();
		files.append(f);
		document.getElementById(id).files = files;
	}

	function doUpdate() {
		var confirmation = confirm(t.get('info.update_available'));
		if (confirmation) {
			Log.info(t.get('info.open_link'));
			gui.Shell.openExternal(System.update_url);
		}
	}

	/**
	 * Vérifie si le launcher est prêt pour le téléchargement
	 * @return {Boolean} true : si le launcher est prêt, false : si le launcher n'est pas prêt
	 */
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

	/**
	 * Supprimer un dossier de manière "recursive", tout les fichiers/sous-dossiers sont supprimés
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
});