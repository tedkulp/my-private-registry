const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const crypto = require('crypto');
const uuid = require('uuid');
const _ = require('lodash');
const errors = require('./errors');

module.exports = (function() {
  var getRepositories = () => {
    return fs.readdirAsync('./manifests')
      .then(files => _.reject(files, file =>  _.startsWith(file, '.')));
  };

  var getTagsInRepository = repository => {
    return checkRepositoryExists(repository)
      .then(() => {
        return fs.readdirAsync('./manifests/' + repository)
          .then(files => {
            return _.chain(files)
              .map(file => file.substring(3))
              .uniq()
              .value();
          });
      });
  };

  var checkRepositoryExists = repository => {
    return new Promise((resolve, reject) => {
      return fs.existsSync('./manifests/' + repository) ? resolve() : reject(new errors.RegistryError("NAME_UNKNOWN", "repository name not known to registry"));
    });
  };

  var getBlobFilename = digest => {
    return './blobs/' + digest;
  };

  var getBlobDetails = digest => {
    const filename = getBlobFilename(digest);
    return fs.statAsync(filename)
      .then(stats => {
        return {
          filename: filename,
          stats: stats
        };
      });
  };

  var getManifestFilename = (repository, version, reference) => {
    return './manifests/' + repository + '/v' + version + '-' + reference;
  };

  var getUploadManifestStream = (repository, version, reference) => {
    if (!fs.existsSync('./manifests/' + repository))
      fs.mkdirSync('./manifests/' + repository);

    const filename = getManifestFilename(repository, version, reference);
    return fs.createWriteStream(filename);
  };

  var getFileDigest = filename => {
    return new Promise((resolve, reject) => {
      const input = fs.createReadStream(filename);
      const hash = crypto.createHash('sha256');
      input.on('readable', () => {
        const data = input.read();
        if (data) {
          hash.update(data);
        } else {
          resolve(hash.digest('hex'));
        }
      });
    });
  };

  // Version is optional
  var getManifestDetails = (repository, version, reference) => {
    if (_.isUndefined(reference) && !_.isUndefined(version)) {
      reference = version;
      version = undefined;
    }

    var type = 'application/vnd.docker.distribution.manifest.v1+prettyjws';
    var filename = getManifestFilename(repository, '1', reference);

    if (!_.isUndefined(version) && version == '2') {
      type = 'application/vnd.docker.distribution.manifest.v2+json';
      filename = getManifestFilename(repository, '2', reference);
    } else {
      if (!fs.existsSync(filename)) {
        type = 'application/vnd.docker.distribution.manifest.v2+json';
        filename = getManifestFilename(repository, '2', reference);
      }
    }

    return Promise.join(getFileDigest(filename), fs.statAsync(filename), (digest, stats) => {
      return {
        type: type,
        digest: digest,
        filename: filename,
        stats: stats
      };
    });
  };

  var getManifestByDigest = (repository, digest) => {
    // There has to be a better way to do this...
    return fs.readdirAsync('./manifests/' + repository)
      .map(filename => {
        return getFileDigest('./manifests/' + repository + '/' + filename)
          .then((digest) => {
            return {
              reference: filename.substring(3),
              digest: digest
            };
          });
      })
      .then(details => {
        return new Promise((resolve, reject) => {
          var found = _(details).find(detail => 'sha256:' + detail.digest === digest);
          if (found)
            resolve(found);
          else
            reject(new errors.RegistryError("MANIFEST_UNKNOWN", "manifest unknown"));
        });
      });
  };

  var deleteManifest = (repository, reference) => {
    console.log('deleting...', repository, reference);
    var filesToDelete = _(['v1', 'v2']).chain()
        .map(version => './manifests/' + repository + '/' + version + '-' + reference)
        .filter(filename => fs.existsSync(filename))
        .value();

    if (filesToDelete.length > 0) {
      return Promise.map(filesToDelete, filename => {
        return fs.unlinkAsync(filename);
      });
    }

    return Promise.reject(new errors.RegistryError("MANIFEST_UNKNOWN", "manifest unknown"));
  };

  var getNewUploadId = (repository) => {
    return uuid.v4();
  };

  var getUploadFileStream = (repository, uuid) => {
    const filename = './uploads/' + uuid;
    return fs.createWriteStream(filename);
  };

  var finalizeUpload = (repository, uuid, digest) => {
    const filename = './uploads/' + uuid;

    return getFileDigest(filename)
      .then(calculatedDigest => {
        return {
          repository: repository,
          digest: calculatedDigest,
          filename: './blobs/' + digest
        };
      })
      .then(details => {
        if ('sha256:' + details.digest !== digest) {
          throw "Hash does not match";
        }
        return details;
      })
      .then(details => {
        return fs.renameAsync(filename, details.filename)
          .then(() => details);
      });
  };

  return {
    getRepositories: getRepositories,
    getTagsInRepository: getTagsInRepository,
    getBlobFilename: getBlobFilename,
    getBlobDetails: getBlobDetails,
    getManifestFilename: getManifestFilename,
    getManifestDetails: getManifestDetails,
    getUploadManifestStream: getUploadManifestStream,
    getNewUploadId: getNewUploadId,
    getUploadFileStream: getUploadFileStream,
    finalizeUpload: finalizeUpload,
    getFileDigest: getFileDigest,
    getManifestByDigest: getManifestByDigest,
    deleteManifest: deleteManifest
  };
})();
