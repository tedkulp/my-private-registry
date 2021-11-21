import {
  All,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { bind } from 'lodash';

import { LockfileInterceptor } from '../lockfile/lockfile.interceptor';
import { RegistryService } from './registry.service';

@Controller('')
export class RegistryController {
  private readonly logger = new Logger(RegistryController.name);
  private uuids: Record<string, number> = {};

  constructor(private readonly registryService: RegistryService) {}

  private endpointDebug(req: Request) {
    this.logger.debug(
      {
        url: req.url,
        method: req.method,
        headers: req.headers,
        query: req.query,
      },
      'Incoming Request',
    );
  }

  @All('/v1/*')
  @HttpCode(404)
  getV1(@Req() req: Request) {
    this.endpointDebug(req);

    return 'v1 is not supported';
  }

  @Get('/v2/')
  @HttpCode(200)
  getV2Root(@Req() req: Request) {
    this.endpointDebug(req);

    return '';
  }

  @Get('/v2/_catalog')
  @HttpCode(200)
  async getV2Catalog(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const repositories = await this.registryService
      .getRepositories()
      .catch((err) => {
        this.logger.error(err);
        throw new HttpException(
          'Error getting repository list',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });

    return res.status(200).json({
      repositories: repositories,
    });
  }

  @Get('/v2/:repository/tags/list')
  @HttpCode(200)
  async getTags(@Req() req: Request) {
    this.endpointDebug(req);

    const tags = await this.registryService
      .getTagsInRepository(req.params['repository'])
      .catch((err) => {
        this.logger.error(err);
        throw new HttpException(`Repository not found`, HttpStatus.NOT_FOUND);
      });

    return {
      name: req.params['repository'],
      tags,
    };
  }

  @Head('/v2/:repository/blobs/:digest')
  async headDigest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const details = await this.registryService
      .getBlobDetails(req.params['digest'])
      .catch((_err) => {
        throw new HttpException(`Digest not found`, HttpStatus.NOT_FOUND);
      });

    return res
      .header('Content-Length', details.stats.size.toString())
      .header('Docker-Content-Digest', req.params['digest'])
      .status(200)
      .end();
  }

  @Get('/v2/:repository/blobs/:digest')
  async getDigest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const details = await this.registryService
      .getBlobDetails(req.params['digest'])
      .catch((_err) => {
        throw new HttpException(`Digest not found`, HttpStatus.NOT_FOUND);
      });

    return res
      .header('Content-Length', details.stats.size.toString())
      .header('Docker-Content-Digest', req.params['digest'])
      .status(200)
      .sendFile(details.filename);
  }

  @Head('/v2/:repository/manifests/:reference')
  async headManifest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const details = await this.registryService
      .getManifestDetails(req.params['repository'], req.params['reference'])
      .catch((err) => {
        this.logger.error(err);
        throw new HttpException(`Reference not found`, HttpStatus.NOT_FOUND);
      });

    return res
      .header('Content-Type', details.type)
      .header('Content-Length', details.stats.size.toString())
      .header('Docker-Content-Digest', `sha256:${details.digest}`)
      .status(200)
      .end();
  }

  @Get('/v2/:repository/manifests/:reference')
  async getManifest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const details = await this.registryService
      .getManifestDetails(req.params['repository'], req.params['reference'])
      .catch((err) => {
        this.logger.error(err);
        throw new HttpException(`Reference not found`, HttpStatus.NOT_FOUND);
      });

    this.logger.debug(details, 'details -->');

    return res
      .header('Content-Type', details.type)
      .header('Docker-Content-Digest', `sha256:${details.digest}`)
      .status(200)
      .sendFile(details.filename);
  }

  @Put('/v2/:repository/manifests/:reference')
  @UseInterceptors(LockfileInterceptor)
  async setManifest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    // TODO: This version switching could use some more love
    let version = '1';

    switch (req.headers['content-type']) {
      case 'application/vnd.docker.distribution.manifest.v2+json':
        version = '2';
        break;
      case 'application/vnd.docker.distribution.manifest.v1+prettyjws':
      default:
        break;
    }

    // Event handlers mess up "this". This makes sure the registryService
    // is bound correctly.
    // TODO: Fix the type from "any"
    const getManifestDetails = bind(
      this.registryService.getManifestDetails,
      this.registryService,
    );
    const stream = await this.registryService.createUploadManifestStream(
      req.params['repository'],
      req.params['reference'],
      version,
    );

    stream.on('open', () => {
      req.on('data', function (data) {
        stream.write(data);
      });

      req.on('end', function () {
        stream.end();

        getManifestDetails(
          req.params['repository'],
          req.params['reference'],
          version,
        )
          .then((details) => {
            return res
              .append(
                'Location',
                '/v2/' +
                  req.params['repository'] +
                  '/manifests/' +
                  req.params['reference'],
              )
              .append('Content-Length', '0')
              .append('Docker-Content-Digest', 'sha256:' + details.digest)
              .status(201)
              .end();
          })
          .catch((e) => {
            this.logger.error(e);
            res.send(500).send('Error: See logs');
          });
      });
    });

    stream.on('error', (err) => {
      this.logger.error(err);
      res.status(500).send('Error: See logs');
    });

    return {};
  }

  @Post('/v2/:repository/blobs/uploads/')
  @UseInterceptors(LockfileInterceptor)
  generateUploadId(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const uuid = this.registryService.generateUploadId();
    this.uuids[uuid] = 0;

    return res
      .header(
        'Location',
        `/v2/${req.params['repository']}/blobs/uploads/${uuid}`,
      )
      .header('Docker-Upload-UUID', uuid)
      .header('Range', '0-0')
      .header('Content-Length', '0')
      .status(202)
      .end();
  }

  @Patch('/v2/:repository/blobs/uploads/:uuid')
  @UseInterceptors(LockfileInterceptor)
  sendUpload(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const repository = req.params['repository'];
    const uuid = req.params['uuid'];
    const startPoint = this.uuids[uuid] || 0;
    let length = 0;

    const fileStream = this.registryService.createUploadFileStream(
      req.params['uuid'],
    );

    // TODO: Move this to the service
    fileStream.on('open', () => {
      req.on('data', (data) => {
        length += data.length;
        fileStream.write(data);
      });

      req.on('end', () => {
        fileStream.end();
        this.uuids[req.params['uuid']] += length;

        return res
          .header('Location', `/v2/${repository}/blobs/uploads/${uuid}`)
          .header('Docker-Upload-UUID', uuid)
          .header('Range', `${startPoint}-${this.uuids[uuid]}`)
          .header('Content-Length', '0')
          .status(202)
          .end();
      });
    });

    fileStream.on('error', (err) => {
      this.logger.error(err);
      throw new HttpException(
        `Error: ${err}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  }

  @Put('/v2/:repository/blobs/uploads/:uuid')
  @UseInterceptors(LockfileInterceptor)
  finallizeUpload(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const repository = req.params['repository'];
    const uuid = req.params['uuid'];
    const digest = req.query['digest'];

    return this.registryService
      .finalizeUpload(repository, uuid, digest.toString())
      .then((details) => {
        res
          .header('Location', `/v2/${repository}/blobs/${details.digest}`)
          .header('Content-Length', '0')
          .header('Docker-Content-Digest', details.digest)
          .status(201)
          .end();
      })
      .catch((err) => {
        this.logger.error(err);
        throw new HttpException(
          `Error: ${err}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
  }

  // NOTE: This is non-standard, with a fallback to the standard version. In the regular docker repo,
  // you can only delete by giving the digest id. It was because of race conditions, but it's incredibly
  // problematic when you have multiple tags pointing to the same image.
  //
  // In this version, we try to delete the tag first, then fallback to the manifest SHA.
  @Delete('/v2/:repository/manifests/:reference')
  @UseInterceptors(LockfileInterceptor)
  async deleteManifest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const { repository, reference } = req.params;
    let deleteResult: unknown;

    const details = await this.registryService.getManifestDetails(
      repository,
      reference,
    );

    if (details) {
      deleteResult = await this.registryService.deleteManifest(
        repository,
        reference,
      );

      if (!deleteResult) {
        const digestDetails = await this.registryService.getManifestByDigest(
          repository,
          reference,
        );

        if (digestDetails) {
          deleteResult = await this.registryService.deleteManifest(
            repository,
            digestDetails.reference,
          );
        }
      }
    }

    if (deleteResult) {
      return res.status(202).end();
    }

    throw new HttpException(`Error`, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  // NOTE: This is not a documented API call. This is an optimization that I wish existed in the
  //       real API spec
  @Post('/v2/:repository/manifests/copy')
  @UseInterceptors(LockfileInterceptor)
  async copyManifest(@Req() req: Request, @Res() res: Response) {
    this.endpointDebug(req);

    const repository = req.params['repository'];
    const reference = req.body['reference'] || req.query['reference'];
    const newReference = req.body['newReference'] || req.query['newReference'];

    const details = this.registryService.getManifestDetails(
      repository,
      reference,
    );

    if (details) {
      await this.registryService.copyManifest(
        repository,
        reference,
        newReference,
      );

      const newDetails = await this.registryService.getManifestDetails(
        repository,
        newReference,
      );

      if (newDetails) {
        return res
          .header('Location', `/v2/${repository}/manifests/${newReference}`)
          .header('Content-Length', '0')
          .header('Docker-Content-Digest', newDetails.digest)
          .status(201)
          .end();
      }
    }
  }
}
