/*==============================
=            Logger            =
==============================*/

var moment = require('moment');
var fs = require('fs-extra');

function Logger() {
	this.file = "usinacraft.log";
	fs.ensureFileSync(this.file);
}

/**
 * Affiche le texte en dessous de la barre de chargement
 * @param  {String} text Texte à afficher
 */
Logger.prototype.info = function(text) {
	console.log(text);
	window.printInfo(text);
	var text = "[INFO][" + moment().format('DD-MM-YYYY') + "][" + moment().format('HH:mm:ss') + "] " + text + "\r\n";
	fs.appendFileSync(this.file, text, {encoding: 'utf8'});
}

/**
 * Affiche le texte et l'erreur en dessous de la barre de chargement
 * @param  {String} text  Texte à affiché
 * @param  {Object} error Erreur
 */
Logger.prototype.error = function(text, error) {
	if (error) {
		console.log(text, error);
	}
	else {
		console.log(text);
	}
	if (typeof text === 'object') {
		var text = "[ERROR][" + moment().format('DD-MM-YYYY') + "][" + moment().format('HH:mm:ss') + "] " + text.toSource() + "\r\n";
		window.printError(text.toSource());	
	}
	else {
		var text = "[ERROR][" + moment().format('DD-MM-YYYY') + "][" + moment().format('HH:mm:ss') + "] " + text + "\r\n";
		window.printError(text);	
	}
	fs.appendFileSync(this.file, text, {encoding: 'utf8'});
}

module.exports = Logger;
