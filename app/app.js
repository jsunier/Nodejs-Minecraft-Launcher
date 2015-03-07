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
		loadbar: null,
		minecraft_folder: isWin ? user_folder + "/AppData/Roaming/.minecraft" : user_folder + "/.minecraft",
		minecraft_launcher: isWin ? user_folder + "/desktop/Minecraft.exe" : user_folder + "/desktop/Minecraft.jar"
	};

	t.add(); // Initialisation des langues

	/*==========  Au démarrage du launcher  ==========*/
	
	disableInterface();
	console.log('Démarrage du launcher | version : ' + gui.App.manifest.version);
	$('#main-background').animate({opacity: 1}, 1700);
	printInfo(t.get('info.versions'));

	setInputFile(options.minecraft_folder, 'installation-folder');
	setInputFile(options.minecraft_launcher, 'minecraft-launcher');

	printInfo(t.get('info.load_cache'));

	cache.load();

	var dwn = new Downloader({
		version: gui.App.manifest.version,
		minecraft_folder: options.minecraft_folder
	});

	try {
		async.series([
			function(callback) {
				printInfo("Chargement des versions...");
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
				dwn.isUpToDate(gui.App.manifest.version, callback);
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
		event.preventDefault();
		var install_folder = $('#installation-folder').val();
		var minecraft_launcher = $('#minecraft-launcher').val();
		var selected_version = $('#version').val();
		var force_update = $('#force-update').prop('checked');
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
					else
						callback();
				},
				function(callback) {
					cache.load();
					if (cache.get('difference').length > 0 || force_update) {
						printInfo('Téléchargement des mods en cours...');
						dwn.downloadFiles(force_update, callback);
					}
					else 
						callback();
				},
				function(callback) {
					cache.load();
					if (cache.get('refresh_configs') || force_update) {
						printInfo("Téléchargement des configurations...");
						dwn.downloadConfigs(callback);	
					}
					else
						callback();
				}
			], function(err, results) {
				printInfo("Téléchargement terminé!");
				console.log('Terminé!');
				enableInterface();
			});
		} catch(err) {
			console.error(err);
			printError('Erreur: ' + err.message);
		}

		//clearInterval(options.loadbar);
		//simulateLoadbar();
	});

	$('body').on('click', '.external-link', function(event) {
		event.preventDefault();
		gui.Shell.openExternal($(this).attr('href'));
	});

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

	function simulateLoadbar() {
		var i = 0;
		options.loadbar = setInterval(function() {
			if(i <= 100) {
				$('#loadbar .loader').css('width', i + '%');
				i++;
			}
			else {
				clearInterval(options.loadbar);
				printInfo("Téléchargement terminé!");
				enableInterface();
			}
		}, 100);
	}

	window.printInfo = printInfo;
	window.printError = printError;
	window.clearPrint = clearPrint;
});