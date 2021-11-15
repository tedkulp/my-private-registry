import axios from 'axios';
import { NextPageContext } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import styles from '../index.module.scss';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RepositoryDetailsProps {
  url: string;
  repository: string;
  references: string[];
}

const getReferences = async (url: string) => {
  const result = axios
    .get(url)
    .then((resp) => resp?.data?.tags)
    .catch((err) => console.error(err));

  return result || null;
};

export function RepositoryDetails(props: RepositoryDetailsProps) {
  const [references, _setReferences] = useState<string[]>(props.references);

  return (
    <div className={styles.page}>
      <h2>References</h2>
      <div>
        {references &&
          references.map((r) => (
            <div key={r}>
              <Link href={`/references/${props.repository}/${r}`}>{r}</Link>
            </div>
          ))}
      </div>
    </div>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const url = `http://localhost:3333/v2/${context.query.id}/tags/list`;
  const references = await getReferences(url);
  return {
    props: {
      url,
      repository: context.query.id,
      references,
    },
  };
}

export default RepositoryDetails;
