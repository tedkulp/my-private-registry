export type DockerDetailsConfig = {
  Hostname: string;
  Domainname: string;
  User: string;
  AttachStdin: boolean;
  AttachStdout: boolean;
  AttachStderr: boolean;
  ExposedPorts: Record<string, unknown>;
  Tty: boolean;
  OpenStdin: boolean;
  StdinOnce: boolean;
  Env: string[];
  Cmd: string[];
  Image: string;
  Volumes: Record<string, unknown>;
  WorkingDir: string;
  Entrypoint: string[];
  OnBuild: unknown | null;
  Labels: unknown | null;
};

export type DockerDetailsContainerConfig = {
  Hostname: string;
  Domainname: string;
  User: string;
  AttachStdin: boolean;
  AttachStdout: boolean;
  AttachStderr: boolean;
  ExposedPorts: Record<string, unknown>;
  Tty: boolean;
  OpenStdin: boolean;
  StdinOnce: boolean;
  Env: string[];
  Cmd: string[];
  Image: string;
  Volumes: Record<string, unknown>;
  WorkingDir: string;
  Entrypoint: string[];
  OnBuild: unknown | null;
  Labels: unknown | null;
};

export type DockerDetailsHistoryEntry = {
  craeted: string;
  created_by: string;
  empty_layer?: boolean;
};

export type DockerDetails = {
  architecture: string;
  config: DockerDetailsConfig;
  container: string;
  container_config: DockerDetailsContainerConfig;
  created: string;
  docker_version: string;
  history: DockerDetailsHistoryEntry[];
  author: string | null;
  os: string;
  rootfs: {
    type: string;
    diff_ids: string[];
  };
};
