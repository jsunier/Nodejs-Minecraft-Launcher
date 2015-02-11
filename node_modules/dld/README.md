# DLD

File downloader with partially-downloading support

## Setup

    npm install dld

## Usage

```javascript
var dld = require('dld');

var uri = 'http://nodejs.org/dist/v0.10.12/node-v0.10.12.pkg',
    output_folder = "Downloads/",
    chunk_size = 1000000; //bytes

dld(uri, output_folder, chunk_size).on('data', function (position, size) {
  console.log(position + '/' + size);
}).on('end', function () {
  console.log('done!');
});
```
**dld** will create  temporary file `node-v0.10.12.pkg.dld` in `Downloads\` folder and after downloading rename it to `node-v0.10.12.pkg`

## Notes

* HTTP/HTTPS server must support `Accept-Ranges` header
* download file must return `Content-Length` header (not `Transfer-Encoding: chunked`)
