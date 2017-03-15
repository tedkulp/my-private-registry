const express = require('express');
const fs = require('fs');
const path = require('path');

const http = require('http');
const https = require('https');
const app = express();
const errors = require('./errors');

// Needs to be imported after we know the base directory
var registry;

// TODO: Refactor this a little more. It's a mess.
module.exports = (() => {

  var handleError = (e, res) => {
    switch (e.code) {
    case "NAME_UNKNOWN":
    case "MANIFEST_UNKNOWN":
      res.status(404).json(e.toJSON());
      break;
    default:
      throw e;
    }
  };

  var run = args => {
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

    registry = require('./file-registry')(args.data);

    app.set('views', './web/views');
    app.set('view engine', 'jade');

    app.get('/views/:name', function (req, res) {
      var name = req.params.name;
      res.render(name);
    });

    app.use(express.static('./web'))

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
        .catch(errors.RegistryError, e => handleError(e, res))
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
            .status(200).sendFile(details.filename);
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

      stream.on('open', () => {
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

      stream.on('error', e => {
        console.log(err);
        res.status(500).send("Error: See logs");
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
        })
        .catch(e => {
          console.log(e);
          res.send(500).send("Error: See logs");
        });
    });

    app.get('/v2/:repository/manifests/:reference', (req, res) => {
      console.log(req.url, req.method, req.headers, req.query);

      registry.getManifestDetails(req.params['repository'], req.params['reference'])
        .then(details => {
          return res
            .append('Content-Type', details.type)
            .append('Docker-Content-Digest', 'sha256:' + details.digest)
            .status(200).sendFile(details.filename);
        })
        .catch(err => {
          console.log(err);
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

      stream.on('open', () => {
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
            })
            .catch(e => {
              console.log(e);
              res.send(500).send("Error: See logs");
            });
        });
      });

      stream.on('error', e => {
        console.log(err);
        res.status(500).send("Error: See logs");
      });
    });

    app.delete('/v2/:repository/manifests/:reference', (req, res) => {
      console.log(req.url, req.method, req.headers);

      registry.getManifestByDigest(req.params['repository'], req.params['reference'])
        .then(details => registry.deleteManifest(req.params['repository'], details.reference))
        .then(() => res.status(202).end())
        .catch(errors.RegistryError, e => handleError(e, res));
    });

    app.all('*', (req, res) => {
      console.log(req.url, req.method);
      res.render('main');
      return res.status(200).end();
    });
  };

  return {
    run: run
  };
})();
