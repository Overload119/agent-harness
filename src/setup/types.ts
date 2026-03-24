export type Manifest = Record<string, string>;

export type SkillInstallRecord = {
  managed?: boolean;
  sourceSkill?: string;
  sourcePath?: string;
  targetPath?: string;
  installedFiles?: Manifest;
};

export type InstallMetadata = {
  formatVersion: number;
  skills: Record<string, SkillInstallRecord>;
  source?: {
    repoRoot: string;
    commit: string;
  };
  targetRoot?: string;
};

export type SetupOptions = {
  dry?: boolean;
  overwrite?: boolean;
};

export type SetupPaths = {
  metadataPath: string;
  repoRoot: string;
  sourceDir: string;
  targetAgentsDir: string;
  targetDiagramsDir: string;
  targetDir: string;
  targetLogsDir: string;
  targetRoot: string;
};
