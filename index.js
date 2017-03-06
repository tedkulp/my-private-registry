const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const _ = require('lodash');
const app = express();
const registry = require('./lib/file-registry');

const args = require('yargs')
  .usage('Usage: $0 [options]')
  .version('Version 0.1')
  .describe('http', 'Use http instead of https')
  .boolean('http')
  .default('http', false)
  .describe('https', 'Use https')
  .boolean('https')

  .default('https', true)
  .describe('cert', 'Filename of cert for SSL server')
  .default('cert', 'cert.pem')
  .alias('c', 'cert')
  .describe('key', 'Filename of key for SSL server')
  .default('key', 'key.pem')
  .alias('k', 'key')
  .describe('passphrase', 'Passphrase for the SSL cert')
  .alias('P', 'passphrase')
  .describe('port', 'Port to serve on')
  .number('port')
  .default('port', 3000)
  .alias('p', 'port')
  .alias('?', 'help')
  .argv;

if (args.http) {
  http.createServer(app).listen(args.port);
  console.log('Started http server on port ' + args.port);
} else if (args.https) {
  var serverArgs = {
    key: fs.readFileSync(args.key),
    cert: fs.readFileSync(args.cert)
  };

  if (args.passphrase) {
    serverArgs.passphrase = args.passphrase;
  };

  https.createServer(serverArgs, app).listen(args.port);
  console.log('Started https server on port ' + args.port);
} else {
  console.log('Both http and https are disabled. Exiting.');
  process.exit(1);
}

var jsonParser = bodyParser.json()

app.use((req, res, next) => {
  res.set('Docker-Distribution-API-Version', 'registry/2.0');
  next();
});

app.all('/v1/*', (req, res) => {
  console.log(req.url, req.method);
  return res.status(404).end();
});

app.get('/v2/', (req, res) => {
  console.log(req.url, req.method);
  return res.status(200).end();
});

app.get('/v2/_catalog', (req, res) => {
  console.log(req.url, req.method, req.headers);

  registry.getRepositories()
    .then(files => {
      res.status(200).json({
        'repositories': files
      });
    })
    .catch(err => {
      res.status(404).end();
    });
});

app.get('/v2/:repository/tags/list', (req, res) => {
  console.log(req.url, req.method, req.headers);

  registry.getTagsInRepository(req.params['repository'])
    .then(tags => {
      res.status(200).json({
        'name': req.params['repository'],
        'tags': tags
      });
    })
    .catch(err => {
      res.status(404).end();
    });
});

app.head('/v2/:repository/blobs/:digest', (req, res) => {
  console.log(req.url, req.method, req.headers);

  registry.getBlobDetails(req.params['digest'])
    .then(details => {
      res
        .append('Content-Length', details.stats.size)
        .append('Docker-Content-Digest', req.params['digest'])
        .status(200).end();
    })
    .catch(err => {
      res.status(404).end();
    });
});

app.get('/v2/:repository/blobs/:digest', (req, res) => {
  console.log(req.url, req.method, req.headers);

  registry.getBlobDetails(req.params['digest'])
    .then(details => {
      res
        .append('Content-Length', details.stats.size)
        .append('Docker-Content-Digest', req.params['digest'])
        .status(200).sendFile(details.filename, { root: __dirname });
    })
    .catch(err => {
      res.status(404).end();
    });
});

var uuids = {};
app.post('/v2/:repository/blobs/uploads/', (req, res) => {
  console.log(req.url, req.method, req.headers);

  var newUuid = registry.getNewUploadId();
  uuids[newUuid] = 0; // Current endpoint in bytes
  return res
    .append('Location', '/v2/' + req.params['repository'] + '/blobs/uploads/' + newUuid)
    .append('Docker-Upload-UUID', newUuid)
    .append('Range', '0-0')
    .append('Content-Length', 0)
    .status(202).end();
});

app.patch('/v2/:repository/blobs/uploads/:uuid', (req, res) => {
  console.log(req.url, req.method, req.headers);

  const startPoint = uuids[req.params['uuid']] || 0;
  var length = 0;

  // TODO: Some way to make this more promise based? Streams to promises or something?
  // TODO: Error handling?
  // TODO: Haven't actually seen this use multiple chunks yet. It *should* be written
  //       to handle it, but it's untested thus far.
  const stream = registry.getUploadFileStream(req.params['repository'], req.params['uuid']);

  req.on('data', function (data) {
    length += data.length;
    stream.write(data);
  });

  req.on('end', function () {
    stream.end();
    uuids[req.params['uuid']] += length;
    return res
      .append('Location', '/v2/' + req.params['repository'] + '/blobs/uploads/' + req.params['uuid'])
      .append('Range', startPoint + '-' + uuids[req.params['uuid']])
      .append('Content-Length', 0)
      .append('Docker-Upload-UUID', req.params['uuid'])
      .status(202).end();
  });
});

app.put('/v2/:repository/blobs/uploads/:uuid', (req, res) => {
  console.log(req.url, req.method, req.headers, req.query);

  registry.finalizeUpload(req.params['repository'], req.params['uuid'], req.query['digest'])
    .then(details => {
      res
        .append('Location', '/v2/' + details.repository + '/blobs/' + details.digest)
        .append('Content-Length', 0)
        .append('Docker-Content-Digest', details.digest)
        .status(201).end();
    });
});

app.get('/v2/:repository/manifests/:reference', (req, res) => {
  console.log(req.url, req.method, req.headers, req.query);

  registry.getManifestDetails(req.params['repository'], req.params['reference'])
    .then(details => {
      return res
        .append('Content-Type', details.type)
        .append('Docker-Content-Digest', 'sha256:' + details.digest)
        .status(200).sendFile(details.filename, { root: __dirname });
    })
    .catch(err => {
      res.status(404).end();
    });
});

app.put('/v2/:repository/manifests/:reference', (req, res) => {
  console.log(req.url, req.method, req.headers, req.query);

  // TODO: This version switching could use some more love
  var version = '1';

  switch (req.headers['content-type']) {
  case 'application/vnd.docker.distribution.manifest.v2+json':
    version = '2';
    break;
  case 'application/vnd.docker.distribution.manifest.v1+prettyjws':
  default:
    break;
  }

  var stream = registry.getUploadManifestStream(req.params['repository'], version, req.params['reference']);

  req.on('data', function (data) {
    stream.write(data);
  });

  req.on('end', function () {
    stream.end();
    registry.getManifestDetails(req.params['repository'], version, req.params['reference'])
      .then(details => {
        return res
          .append('Location', '/v2/' + req.params['repository'] + '/manifests/' + req.params['reference'])
          .append('Content-Length', 0)
          .append('Docker-Content-Digest', 'sha256:' + details.digest)
          .status(201).end();
      });
  });
});

app.all('*', (req, res) => {
  console.log(req.url, req.method);
  return res.status(200).end();
});
