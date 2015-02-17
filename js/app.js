jQuery(document).ready(function($) {
	var gui = require('nw.gui');
	var fs = require('fs');
	var async = require('async');
	var path = require('path');
	var Lang = require('mcms-node-localization');
	var Downloader = require(path.join(process.cwd(), 'js/downloader.js'));
	var Cache = require('ds-cache');
	var locales = ['fr','en']; //assuming you have 2 languages
	var t = new Lang({
	    directory : path.join(process.cwd(), 'js/locales'),
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

	t.add();

	/*==========  Au démarrage du launcher  ==========*/
	
	window.onload = function() {
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
				},
				function(callback) {
					printInfo("Récupération des MD5 local...");
					dwn.getLocalHashes(callback);
				}
			], function(err, results) {
				clearPrint();
				cache.load();
				console.log(cache.get('local_hash'));
				enableInterface();
			});
		} catch(err) {
			console.error(err);
			printError('Erreur: ' + err.message);
		}

	}

	/*==========  Démarrage du téléchargement  ==========*/

	$('#main-version').submit(function(event) {
		event.preventDefault();
		var install_folder = $('#installation-folder').val();
		var minecraft_launcher = $('#minecraft-launcher').val();
		var selected_version = $('#version').val();
		printInfo("Préparation du téléchargement en cours...");
		console.log('Téléchargement de la version "' + selected_version + '" en cours...');
		clearInterval(options.loadbar);
		disableInterface();
		simulateLoadbar();
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
		$('.basic-form button').prop('disabled', false);
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
});