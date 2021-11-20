import {
  DockerDetails,
  DockerManifest,
} from '@my-private-registry/shared-types';
import axios from 'axios';
import { sum } from 'lodash';
import moment from 'moment';
import { NextPageContext } from 'next';
import { useState } from 'react';

import styles from '../../index.module.scss';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ReferenceDetailsProps {
  manifestUrl: string;
  manifest: unknown;
  detailsUrl: string;
  details: unknown;
  repository: string;
  reference: string;
  totalSize: number;
}

const getData = <T extends unknown>(url: string) => {
  return axios
    .get<T>(url)
    .then((resp) => resp?.data || null)
    .catch((err) => console.error(err));
};

export function ReferenceDetails(props: ReferenceDetailsProps) {
  const [manifest, _setManifest] = useState<unknown>(props.manifest);
  const [details, _setDetails] = useState<unknown>(props.details);

  return (
    <>
      <h1>Image Details</h1>
      <div className="row">
        <div className="col-2">
          <p className="text-right">
            <strong>Size</strong>
          </p>
        </div>
        <div className="col-10">
          <p>{props.totalSize || '0'}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-2">
          <p className="text-right">
            <strong>Created</strong>
          </p>
        </div>
        <div className="col-10">
          <p>
            {details['created']
              ? moment(details['created']).format('YYYY-MM-DD HH:mm:ss')
              : 'n/a'}
          </p>
        </div>
      </div>
      <div className="row">
        <div className="col-2">
          <p className="text-right">
            <strong>Digest</strong>
          </p>
        </div>
        <div className="col-10">
          <p>{`${manifest['config']['digest']}`}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-2">
          <p className="text-right">
            <strong>Docker Version</strong>
          </p>
        </div>
        <div className="col-10">
          <p>{details['docker_version'] || 'n/a'}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-2">
          <p className="text-right">
            <strong>OS/Arch</strong>
          </p>
        </div>
        <div className="col-10">
          <p>{`${details['os']}/${details['architecture']}`}</p>
        </div>
      </div>

      <h2>Manifest</h2>
      <pre style={{ overflowX: 'auto' }}>
        {JSON.stringify(manifest, undefined, 2)}
      </pre>
      <h2>Details</h2>
      <pre style={{ overflowX: 'auto' }}>
        {JSON.stringify(details, undefined, 2)}
      </pre>
    </>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const manifestUrl = `http://localhost:3333/v2/${context.query.repository}/manifests/${context.query.id}`;
  const manifest = await getData<DockerManifest>(manifestUrl);
  const detailsUrl = `http://localhost:3333/v2/${
    context.query.repository
  }/blobs/${manifest && manifest.config.digest}`;
  const details = await getData<DockerDetails>(detailsUrl);
  return {
    props: {
      repository: context.query.repository,
      reference: context.query.id,
      manifestUrl,
      manifest,
      detailsUrl,
      details,
      totalSize: manifest && sum(manifest.layers.map((layer) => layer.size)),
    },
  };
}

export default ReferenceDetails;
