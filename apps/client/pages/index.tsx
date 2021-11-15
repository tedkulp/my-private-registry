import axios from 'axios';
import { NextPageContext } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import styles from './index.module.scss';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IndexProps {
  url: string;
  repositories: string[];
}

const getRepositories = async (url: string) => {
  const result = axios
    .get(url)
    .then((resp) => resp?.data?.repositories)
    .catch((err) => console.error(err));

  return result || null;
};

export function Index(props: IndexProps) {
  const [repositories, _setRepositories] = useState<string[]>(
    props.repositories,
  );

  return (
    <>
      <h2>Repositories</h2>
      <div>
        {repositories &&
          repositories.map((r) => (
            <div key={r}>
              <Link href={`/repositories/${r}`}>{r}</Link>
            </div>
          ))}
      </div>
    </>
  );
}

export async function getServerSideProps(context: NextPageContext) {
  const url = `http://localhost:3333/v2/_catalog`;
  const repositories = await getRepositories(url);
  return {
    props: {
      url,
      repositories,
    },
  };
}

export default Index;
