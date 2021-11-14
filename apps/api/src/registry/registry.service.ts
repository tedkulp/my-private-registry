import { Injectable, Logger } from '@nestjs/common';
import * as Bluebird from 'bluebird';
import { createHash } from 'crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  promises,
} from 'fs';
import { reject, startsWith, uniq } from 'lodash';
import { basename, dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { RegistryError } from './errors';

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  getManifestsDirectory = (repository?: string): string => {
    if (repository)
      return join(__dirname, '..', '..', '..', 'manifests', repository);
    else return join(__dirname, '..', '..', '..', 'manifests');
  };

  async getTagsInRepository(repository: string) {
    const result = await this.checkRepositoryExists(repository).catch((err) => {
      throw err;
    });

    if (result) {
      const dir = await promises.readdir(
        this.getManifestsDirectory(repository),
      );
      return uniq(dir.map((file) => file.substring(3)));
    }
  }

  async checkRepositoryExists(repository: string) {
    return new Promise((resolve, reject) => {
      return existsSync(this.getManifestsDirectory(repository))
        ? resolve(true)
        : reject(
            new RegistryError(
              'NAME_UNKNOWN',
              'repository name not known to registry',
            ),
          );
    });
  }

  getUploadsDirectory(): string {
    return join(__dirname, '..', '..', '..', 'uploads');
  }

  async findReferenceBySha(repository: string, reference: string) {
    const dir = this.getManifestsDirectory(repository);
    const files = await promises.readdir(dir);
    return files.find(async (filename) => {
      this.logger.debug(`finding: ${filename}`);
      const digest = await this.getFileDigest(filename).catch((err) =>
        this.logger.error(err),
      );
      return digest && digest === reference.split(':')[1];
    });
  }

  async getManifestFilename(
    repository: string,
    reference: string,
    version = '2',
  ) {
    if (reference.startsWith('sha256:')) {
      reference = await this.findReferenceBySha(repository, reference);
      const tmp = join(this.getManifestsDirectory(repository), reference);
      return tmp;
    }

    return join(
      this.getManifestsDirectory(repository),
      'v' + version + '-' + reference,
    );
  }

  async getRepositories(): Promise<string[]> {
    const files = await promises.readdir(this.getManifestsDirectory());
    return reject(files, (file) => startsWith(file, '.'));
  }

  generateUploadId() {
    return uuidv4();
  }

  async getManifestDetails(
    repository: string,
    reference: string,
    version = '2',
  ) {
    let type = 'application/vnd.docker.distribution.manifest.v1+prettyjws';
    let filename = await this.getManifestFilename(repository, reference, '1');

    if (version === '2') {
      type = 'application/vnd.docker.distribution.manifest.v2+json';
      filename = await this.getManifestFilename(repository, reference, '2');
    } else {
      if (!existsSync(filename)) {
        type = 'application/vnd.docker.distribution.manifest.v2+json';
        filename = await this.getManifestFilename(repository, reference, '2');
      }
    }

    const digest = await this.getFileDigest(filename);
    const stats = await promises.stat(filename);

    return {
      type,
      digest,
      filename,
      stats,
    };
  }

  async createUploadManifestStream(
    repository: string,
    reference: string,
    version: string,
  ) {
    if (!existsSync(this.getManifestsDirectory(repository)))
      mkdirSync(this.getManifestsDirectory(repository));

    const filename = await this.getManifestFilename(
      repository,
      reference,
      version,
    );
    return createWriteStream(filename);
  }

  createUploadFileStream(uuid: string) {
    const filename = join(this.getUploadsDirectory(), uuid);
    this.logger.debug(filename);
    return createWriteStream(filename);
  }

  async finalizeUpload(
    repository: string,
    uuid: string,
    digest: string,
  ): Promise<{ repository: string; digest: string; filename: string }> {
    const filename = join(this.getUploadsDirectory(), uuid);
    const calculatedDigest = await this.getFileDigest(filename);
    const blobFilename = this.getBlobFilename(digest);

    if (`sha256:${calculatedDigest}` !== digest) {
      throw 'Hash does not match';
    }

    await promises.rename(filename, blobFilename).catch((err) => {
      this.logger.error(err);
      throw 'Could not rename file';
    });

    return {
      repository,
      digest: calculatedDigest,
      filename: blobFilename,
    };
  }

  getBlobFilename(digest: string): string {
    const match = digest.match(/(.*:)?([0-9a-f]+)/);
    const blobsDirectory = this.getBlobsDirectory(match[2].substr(0, 2));

    if (!existsSync(blobsDirectory)) mkdirSync(blobsDirectory);

    return join(blobsDirectory, match[0]);
  }

  async getBlobDetails(digest: string) {
    const filename = this.getBlobFilename(digest);
    const stats = await promises.stat(filename);

    return {
      filename,
      stats,
    };
  }

  getBlobsDirectory(prefix?: string): string {
    if (prefix) return join(__dirname, '..', '..', '..', 'blobs', prefix);
    else return join(__dirname, '..', '..', '..', 'blobs');
  }

  getFileDigest(filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!existsSync(filename)) {
        reject('Manifest file is not found');
      }

      const input = createReadStream(filename);
      const hash = createHash('sha256');

      input.on('readable', () => {
        const data = input.read();
        if (data) {
          hash.update(data);
        } else {
          resolve(hash.digest('hex'));
        }
      });

      input.on('error', (err) => {
        reject('Manifest file cound not be opened/read: ' + err.toString());
      });
    });
  }

  async getManifestByDigest(repository: string, digest: string) {
    const filenames = await promises.readdir(
      this.getManifestsDirectory(repository),
    );

    const fileDetails = await Promise.all(
      filenames.map(async (filename) => {
        const digest = await this.getFileDigest(
          join(this.getManifestsDirectory(repository), filename),
        );

        return {
          reference: filename.substring(3),
          digest,
        };
      }),
    );

    const foundFile = fileDetails.find(
      (detail) => `sha256:${detail.digest}` === digest,
    );

    if (!foundFile) {
      throw new RegistryError('MANIFEST_UNKNOWN', 'manifest unknown');
    }

    return foundFile;
  }

  async deleteManifest(
    repository: string,
    reference: string,
  ): Promise<unknown> {
    const filesToDelete = await this.getManifestFilenames(
      repository,
      reference,
    );

    if (filesToDelete.length > 0) {
      return Promise.all(
        filesToDelete.map(async (filename) => {
          return promises.unlink(filename);
        }),
      );
    }

    throw new RegistryError('MANIFEST_UNKNOWN', 'manifest unknown');
  }

  async getManifestFilenames(repository: string, reference: string) {
    return Bluebird.map(['1', '2'], async (version) => {
      return await this.getManifestFilename(repository, reference, version);
    }).filter((filename) => existsSync(filename));
  }

  async copyManifest(
    repository: string,
    reference: string,
    newReference: string,
  ) {
    const filesToCopy = await this.getManifestFilenames(repository, reference);

    if (filesToCopy.length > 0) {
      return Promise.all(
        filesToCopy.map(async (filename) => {
          const repositoryPath = dirname(filename);
          const newFilename = basename(filename).replace(
            reference,
            newReference,
          );

          return promises.copyFile(filename, join(repositoryPath, newFilename));
        }),
      );
    }

    throw new RegistryError('MANIFEST_UNKNOWN', 'manifest unknown');
  }
}
