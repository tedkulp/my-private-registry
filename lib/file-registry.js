const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const crypto = require('crypto');
const _ = require('lodash');

module.exports = (function() {
    var getRepositories = () => {
        return fs.readdirAsync('./manifests')
            .then(files => _.reject(files, file =>  _.startsWith(file, '.')));
    };

    var getTagsInRepository = repository => {
        return fs.readdirAsync('./manifests/' + repository)
            .then(files => {
                return _.chain(files)
                    .map(file => file.substring(3))
                    .uniq()
                    .value();
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

    var getManifestDetails = (repository, reference) => {
        var type = 'application/vnd.docker.distribution.manifest.v1+prettyjws';
        var filename = getManifestFilename(repository, '1', reference);

        if (!fs.existsSync(filename)) {
            type = 'application/vnd.docker.distribution.manifest.v2+json';
            filename = getManifestFilename(repository, '2', reference);
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

    return {
        getRepositories: getRepositories,
        getTagsInRepository: getTagsInRepository,
        getBlobFilename: getBlobFilename,
        getBlobDetails: getBlobDetails,
        getManifestFilename: getManifestFilename,
        getManifestDetails: getManifestDetails
    };
})();
