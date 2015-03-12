/*==============================
=            Logger            =
==============================*/

function Logger() {

}

Logger.prototype.info = function(text) {
	console.log(text);
	window.printInfo(text);	
}

Logger.prototype.error = function(text, error) {
	if (error) console.log(text, error);
	else console.log(text);
	window.printError(text);	
}

module.exports = Logger;
