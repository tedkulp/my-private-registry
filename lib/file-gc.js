const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const _ = require('lodash');
const globAsync = Promise.promisify(require('glob'))
const registry = require('./file-registry');

module.exports = (() => {
  var usedDigests = [];

  // Need to figure out how to do this as a stream
  var setDigests = (o) => {
    for (i in o) {
      if (!!o[i] && typeof(o[i]) == 'object') {
        if (o[i]['digest']) {
          usedDigests.push(o[i]['digest']);
        }
        setDigests(o[i]);
      }
    }
  };

  var getUsedDigests = () => {
    return globAsync('./manifests/*/v?-*').then((files) => {
      return Promise.map(files, (manifest) => {
        // Do this in memory... there should no ridiculously
        // large manifests given layer depth limits
        return fs.readFileAsync(manifest)
          .then(data => JSON.parse(data.toString()))
          .then((data) => {
            // Need a v1 manifest to test
            // if (data.schemaVersion && data.schemaVersion == 2) {
            setDigests(data);
            // }
          })
      }).then(() => _.uniq(usedDigests));
    });
  };

  var calculateCruft = (details) => {
    return _.difference(details.blobs, details.usedDigests);
  };

  var removeBlobs = (blobsToDelete) => {
    return Promise.map(blobsToDelete,
                       blob => fs.unlinkAsync('./blobs/' + blob))
      .then(removedFiles => removedFiles.length);
  };

  var getAllBlobs = (usedDigests) => {
    return globAsync('./blobs/sha256:*')
      .map(blob => blob.replace(/.*?(sha256:.*)/, '$1'));
  };

  var run = args => {
    Promise.join(getUsedDigests(), getAllBlobs(), (usedDigests, blobs) => {
      return {
        usedDigests: usedDigests,
        blobs: blobs
      };
    })
      .then(details => calculateCruft(details))
      .then(blobsToDelete => removeBlobs(blobsToDelete))
      .then(removedCount => {
        if (removedCount)
          console.log('Removed ' + removedCount + ' blobs');
        else
          console.log('Nothing to remove');
        process.exit(0);
      }).catch(err => {
        console.log(err);
        process.exit(1);
      });
  };

  return {
    run: run
  };
})();
