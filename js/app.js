jQuery(document).ready(function($) {
	var gui = require('nw.gui');
	var fs = require('fs');
	var cache = require('memory-cache');
	var path = require('path');
	var Downloader = require(path.join(process.cwd(), 'js/downloader.js'));

	var isWin = /^win/.test(process.platform);
	var user_folder = process.env[isWin ? 'USERPROFILE' : 'HOME'];
	var options = {
		loadbar: null,
		minecraft_folder: isWin ? user_folder + "/AppData/Roaming/.minecraft" : user_folder + "/.minecraft",
		minecraft_launcher: isWin ? user_folder + "/desktop/Minecraft.exe" : user_folder + "/desktop/Minecraft.jar"
	};

	/*==========  Au démarrage du launcher  ==========*/
	
	window.onload = function() {
		disableInterface();
		$('#main-background').animate({opacity: 1}, 1700);
		printInfo("Chargement des dossiers d'installation...");

		setInputFile(options.minecraft_folder, 'installation-folder');
		setInputFile(options.minecraft_launcher, 'minecraft-launcher');

		printInfo("Chargement des versions...");

		var dwn = new Downloader({
			gui: gui, 
			cache: cache,
			minecraft_folder: options.minecraft_folder
		});

		var remote_versions = dwn.getVersions(function(versions) {
			$('#version option').remove();
			for(var version in versions.versions) {
				if (versions.latest == version) {
					$('#version').append('<option value="' + version + '" selected>' + version + '</option>');
				}
				else {
					$('#version').append('<option value="' + version + '">' + version + '</option>');
				}
			}
			printInfo("Vérification de la version du launcher...");
			if(dwn.isUpToDate(versions)) {
				printInfo('<a href="http://usinacraft.ch/serveur/launchers" class="external-link">Une nouvelle mise à jour du launcher est disponible!</a>');
				/*var go_page = confirm('Une nouvelle version du launcher est disponible!\nCliquez sur "Ok" pour accèder à la page des téléchargements');
				if (go_page) {
					gui.Shell.openExternal('http://usinacraft.ch/serveur/launchers');
				}*/
			}
			else {
				printInfo("Le launcher est à jour");
			}
			enableInterface();
			return versions;
		});
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
		$('#loadbar-info').html(text);
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