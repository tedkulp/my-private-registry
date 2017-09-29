const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const crypto = require('crypto');
const uuid = require('uuid');
const _ = require('lodash');
const errors = require('./errors');

module.exports = (function(dirname) {
  var getManifestsDirectory = (repository) => {
    if (repository)
      return path.join(dirname, 'manifests', repository);
    else
      return path.join(dirname, 'manifests');
  };

  var getBlobsDirectory = (prefix) => {
    if (prefix)
      return path.join(dirname, 'blobs', prefix);
    else
      return path.join(dirname, 'blobs');
  };

  var getUploadsDirectory = () => {
    return path.join(dirname, 'uploads');
  };

  var createDirectoriesIfNeeded = () => {
    if (!fs.existsSync(getManifestsDirectory()))
      fs.mkdirSync(getManifestsDirectory());

    if (!fs.existsSync(getBlobsDirectory()))
      fs.mkdirSync(getBlobsDirectory());

    if (!fs.existsSync(getUploadsDirectory()))
      fs.mkdirSync(getUploadsDirectory());
  };

  var getRepositories = () => {
    return fs.readdirAsync(getManifestsDirectory())
      .then(files => _.reject(files, file =>  _.startsWith(file, '.')));
  };

  var getTagsInRepository = repository => {
    return checkRepositoryExists(repository)
      .then(() => {
        return fs.readdirAsync(getManifestsDirectory(repository))
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
      return fs.existsSync(getManifestsDirectory(repository)) ? resolve() : reject(new errors.RegistryError("NAME_UNKNOWN", "repository name not known to registry"));
    });
  };

  var getBlobFilename = digest => {
    var match = digest.match(/(.*:)?([0-9a-f]+)/);

    if (!fs.existsSync(getBlobsDirectory(match[2].substr(0,2))))
      fs.mkdirSync(getBlobsDirectory(match[2].substr(0,2)));

    return path.join(getBlobsDirectory(match[2].substr(0,2)), match[0]);
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
    return path.join(getManifestsDirectory(repository), 'v' + version + '-' + reference);
  };

  var getUploadManifestStream = (repository, version, reference) => {
    if (!fs.existsSync(getManifestsDirectory(repository)))
      fs.mkdirSync(getManifestsDirectory(repository));

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
      input.on('error', (err) => {
        reject('Manifest file is not found: ' + err.toString());
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
    return fs.readdirAsync(getManifestsDirectory(repository))
      .map(filename => {
        return getFileDigest(path.join(getManifestsDirectory(repository), filename))
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

  var getManifestFilenames = (repository, reference) => {
    return  _(['1', '2']).chain()
      .map(version => getManifestFilename(repository, version, reference))
      .filter(filename => fs.existsSync(filename))
      .value();
  };

  var copyManifest = (repository, reference, newReference) => {
    const filesToCopy = getManifestFilenames(repository, reference);

    if (filesToCopy.length > 0) {
      return Promise.map(filesToCopy, filename => {
        const repositoryPath = path.dirname(filename);
        const newFilename = path.basename(filename).replace(reference, newReference);
        return new Promise((resolve, reject) => {
          return fs.copyFile(filename, path.join(repositoryPath, newFilename), err => {
            if (err) reject(err);
            resolve();
          });
        });
      });
    }

    return Promise.reject(new errors.RegistryError("MANIFEST_UNKNOWN", "manifest unknown"));
  };

  var deleteManifest = (repository, reference) => {
    const filesToDelete = getManifestFilenames(repository, reference);

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
    const filename = path.join(getUploadsDirectory(), uuid);
    return fs.createWriteStream(filename);
  };

  var finalizeUpload = (repository, uuid, digest) => {
    const filename = path.join(getUploadsDirectory(), uuid);

    return getFileDigest(filename)
      .then(calculatedDigest => {
        return {
          repository: repository,
          digest: calculatedDigest,
          filename: getBlobFilename(digest)
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

  var initRegistry = () => {
    createDirectoriesIfNeeded();
  };

  // This will run when the registry is loaded
  initRegistry();

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
    deleteManifest: deleteManifest,
    getManifestsDirectory: getManifestsDirectory,
    getBlobsDirectory: getBlobsDirectory,
    getUploadsDirectory: getUploadsDirectory,
    checkRepositoryExists: checkRepositoryExists,
    copyManifest: copyManifest,
  };
});
