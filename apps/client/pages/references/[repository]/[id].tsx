import axios from 'axios';
import { NextPageContext } from 'next';
// import Link from 'next/link';
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
}

const getData = async (url: string) => {
  const result = axios
    .get(url)
    .then((resp) => resp.data)
    .catch((err) => console.error(err));

  return result || null;
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
            <strong>Author</strong>
          </p>
        </div>
        <div className="col-10">
          <p>{details['author'] || 'n/a'}</p>
        </div>
      </div>
      <div className="row">
        <div className="col-2">
          <p className="text-right">
            <strong>Created</strong>
          </p>
        </div>
        <div className="col-10">
          <p>{details['created'] || 'n/a'}</p>
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
  const manifest = await getData(manifestUrl);
  const detailsUrl = `http://localhost:3333/v2/${context.query.repository}/blobs/${manifest.config.digest}`;
  const details = await getData(detailsUrl);
  return {
    props: {
      repository: context.query.repository,
      reference: context.query.id,
      manifestUrl,
      manifest,
      detailsUrl,
      details,
    },
  };
}

export default ReferenceDetails;
