/*==============================
=            Logger            =
==============================*/

function Logger(options) {
	this.file = options.file || "usinacraft.log";
}

/**
 * Affiche le texte en dessous de la barre de chargement
 * @param  {String} text Texte à afficher
 */
Logger.prototype.info = function(text) {
	console.log(text);
	window.printInfo(text);	
}

/**
 * Affiche le texte et l'erreur en dessous de la barre de chargement
 * @param  {String} text  Texte à affiché
 * @param  {Object} error Erreur
 */
Logger.prototype.error = function(text, error) {
	if (error) console.log(text, error);
	else console.log(text);
	window.printError(text);	
}

module.exports = Logger;
