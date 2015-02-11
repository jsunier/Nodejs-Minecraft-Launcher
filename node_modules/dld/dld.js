var request = require('request'),
    async = require('async'),
    fs = require('fs'),
    url = require('url'),
    events = require('events');

var dld = function(uri, output_path, chunk_size) {
  var ee = new events.EventEmitter();
  var _getHeaders = function (uri, cb) {
    request({
      uri: uri,
      method: 'HEAD'
    }, function (err, res) {
      cb(res.headers);
    });
  };    

  var _getChunk = function (uri, from, size, cb) {
    request({
      uri: uri,
      headers: {
        'Range': 'bytes=' + from + '-' + parseInt(from + size - 1)
      },
      encoding: null
    }, function (err, res, body) {
      cb(body);
    });
  };

  var _getPosition = function (filename, cb) {
    fs.exists(filename + '.dld', function (exists) {
      if(exists) {
        fs.stat(filename + '.dld', function (err, stat) {
          cb(stat.size);
        });
      } else {
        cb(0);
      }
    });
  }
  _getHeaders(uri, function (headers) {
    if(!headers['accept-ranges']) {
      throw new Error('Server not accept ranges');
    }
    var file_size = headers['content-length'];
    var output_filename = url.parse(uri).path.split('/').slice(-1)[0];
    if(output_path) {
      output_filename = output_path + output_filename;
    }
    var output_file = fs.createWriteStream(output_filename + '.dld', { flags: 'a' });
    _getPosition(output_filename, function (position) {
      async.whilst(
        function () { 
          return position <  file_size-1; 
        },
        function (cb) {
          _getChunk(uri, position, chunk_size, function(chunk) {
            position += chunk.length;
            output_file.write(chunk);
            ee.emit('data', position, file_size);
            cb();
          });
        },
        function (err) {
          fs.rename(output_filename + '.dld', output_filename, function () {
            ee.emit('end');
          })
        }
      );
    });
  });

  return ee;
};
module.exports = dld;