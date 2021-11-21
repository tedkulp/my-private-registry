import { DockerManifest } from '@my-private-registry/shared-types';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Bluebird from 'bluebird';
import { promises } from 'fs';
import * as globby from 'globby';
import { difference, uniq } from 'lodash';

import { LockfileService } from '../lockfile/lockfile.service';
import { RegistryService } from '../registry/registry.service';

@Injectable()
export class GarbageCollectionService {
  private readonly logger = new Logger(GarbageCollectionService.name);
  private usedDigests: string[] = [];

  constructor(
    private registryService: RegistryService,
    private lockfileService: LockfileService,
  ) {}

  //TODO: Does this work with v1?
  setDigests(manifest: DockerManifest) {
    let digests = manifest.layers.map((layer) => layer.digest);
    digests = [...digests, manifest.config.digest];
    digests.forEach((digest) => {
      this.usedDigests.push(digest);
    });
  }

  getUsedDigests() {
    return globby(
      this.registryService.getManifestsDirectory() + '/*/v?-*',
    ).then((files) => {
      return Bluebird.map(files, (manifest) => {
        // Do this in memory... there should no ridiculously
        // large manifests given layer depth limits
        return promises
          .readFile(manifest)
          .then((data) => JSON.parse(data.toString()) as DockerManifest)
          .then((data) => {
            // Need a v1 manifest to test
            // if (data.schemaVersion && data.schemaVersion == 2) {
            this.setDigests(data);
            // }
          });
      }).then(() => uniq(this.usedDigests));
    });
  }

  calculateCruft(details: { usedDigests: string[]; blobs: string[] }) {
    this.logger.verbose(details);
    return difference<string>(details.blobs, details.usedDigests);
  }

  removeBlobs(blobsToDelete: string[]) {
    return Bluebird.map(blobsToDelete, (blob) => {
      promises.unlink(this.registryService.getBlobFilename(blob));
      return blob;
    }).then((removedFiles) => removedFiles.length);
  }

  async getAllBlobs() {
    const pattern = this.registryService.getBlobsDirectory() + '/*/sha256:*';
    const filenames = await globby(pattern);
    return filenames.map((filename) =>
      filename.replace(/.*?(sha256:.*)/, '$1'),
    );
  }

  @Cron('0 0 * * * *') // Top of the hour
  run() {
    if (this.lockfileService.hasLocks()) {
      this.logger.log('There is a lockfile.  Skipping garbage collection.');
      return;
    }

    Bluebird.join(
      this.getUsedDigests(),
      this.getAllBlobs(),
      (usedDigests, blobs) => {
        this.logger.verbose(usedDigests, 'usedDigests');
        this.logger.verbose(blobs, 'blobs');
        return {
          usedDigests,
          blobs,
        };
      },
    )
      .then((details) => this.calculateCruft(details))
      .then((blobsToDelete) => this.removeBlobs(blobsToDelete))
      .then((removedCount) => {
        if (removedCount) this.logger.log('Removed ' + removedCount + ' blobs');
        else this.logger.log('Nothing to remove');
      })
      .catch((err) => {
        this.logger.error(err);
      });
  }
}
