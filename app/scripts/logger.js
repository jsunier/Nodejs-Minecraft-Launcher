/*=======================================
=            Launcher Logger            =
=======================================*/

/*==========  Variables  ==========*/

var PragmaLogger = require('pragma-logger');
var Log = new PragmaLogger({
    logger: {
      charset: 'utf8',
      levels: {
        debug: './logs/debug.log',
        error: './logs/error.log',
        warn: './logs/warn.log',
        trace: './logs/trace.log',
        info: './logs/info.log'
      },
      messageFormat: '%t \t| %name :: %lvl \t| PID: %pid - %msg'
    }
}, 'Usinacraft - Launcher');

/*==========  Class  ==========*/

/**
 * Logging informations to file and window
 * @param {Object} output Need to have (info, error and warn) as function
 */
function Logger(output) {
	this.printInfo = output.info;
	this.printError = output.error;
	this.printWarn = output.warn;
	this.clearPrint = output.clear;
}

Logger.prototype.info = function(text, show_only) {
	if (typeof show_only == "undefined" || show_only != true) Log.info(text);
	this.printInfo(text);
}

Logger.prototype.error = function(text, show_only) {
	if (typeof show_only == "undefined" || show_only != true) Log.error(text);
	this.printError(text);
}

Logger.prototype.debug = function(text) {
	Log.debug(text);
}

Logger.prototype.warn = function(text, show_only) {
	if (typeof show_only == "undefined" || show_only != true) Log.warn(text);
	this.printWarn(text);
}

Logger.prototype.clear = function() {
	this.clearPrint();
}

module.exports = Logger;