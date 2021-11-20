import {
  DockerDetails,
  DockerManifest,
} from '@my-private-registry/shared-types';
import axios from 'axios';
import { sum } from 'lodash';
import moment from 'moment';
import { NextPageContext } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import styles from '../index.module.scss';

interface RepositoryDetails {
  tag: string;
  manifest: DockerManifest;
  details: DockerDetails;
  totalSize: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RepositoryDetailsProps {
  url: string;
  repository: string;
  references: RepositoryDetails[];
}

const getTags = async (url: string) => {
  const result = axios
    .get(url)
    .then((resp) => resp?.data?.tags)
    .catch((err) => console.error(err));

  return result || null;
};

const getData = <T extends unknown>(url: string) => {
  return axios
    .get<T>(url)
    .then((resp) => resp?.data || null)
    .catch((err) => console.error(err));
};

const formatDigest = (digest: string) => {
  return digest.replace('sha256:', '').substr(0, 12);
};

export function RepositoryDetails(props: RepositoryDetailsProps) {
  const [references, _setReferences] = useState<RepositoryDetails[]>(
    props.references,
  );

  return (
    <div className={styles.page}>
      <h2>References</h2>
      <table className="table table-hover table-sm">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Digest</th>
            <th scope="col">Created</th>
            <th scope="col">Docker Version</th>
            <th scope="col">Total Size</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {references &&
            references.map((r) => (
              <tr key={r.tag}>
                <td>
                  <Link href={`/references/${props.repository}/${r.tag}`}>
                    {r.tag}
                  </Link>
                </td>
                <td>{formatDigest(r.manifest.config.digest)}</td>
                <td>
                  {moment(r.details.created).format('YYYY-MM-DD HH:mm:ss')}
                </td>
                <td>{r.details.docker_version}</td>
                <td>{r.totalSize || 0}</td>
                <td>
                  <a href="#">Delete</a>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const url = `http://localhost:3333/v2/${context.query.id}/tags/list`;
  let references = await getTags(url);
  references = await Promise.all(
    references.map(async (ref: string) => {
      const manifest = await getData<DockerManifest>(
        `http://localhost:3333/v2/${context.query.id}/manifests/${ref}`,
      );

      const details =
        manifest &&
        (await getData<DockerDetails>(
          `http://localhost:3333/v2/${context.query.id}/blobs/${manifest?.config?.digest}`,
        ));

      return {
        tag: ref,
        manifest: manifest || null,
        details: details || null,
        totalSize: manifest && sum(manifest.layers.map((layer) => layer.size)),
      };
    }),
  );

  return {
    props: {
      url,
      repository: context.query.id,
      references,
    },
  };
}

export default RepositoryDetails;
