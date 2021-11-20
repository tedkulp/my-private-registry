type DockerManifestLayer = {
  mediaType: string;
  size: number;
  digest: string;
};

export type DockerManifest = {
  schemaVersion: number;
  mediaType: string;
  config: DockerManifestLayer;
  layers: DockerManifestLayer[];
};
