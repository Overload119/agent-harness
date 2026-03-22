import { pathExists } from "./fs";
import type { InstallMetadata } from "./types";

export async function loadMetadata(metadataPath: string): Promise<InstallMetadata> {
  if (!(await pathExists(metadataPath))) {
    return { formatVersion: 1, skills: {} };
  }

  const data = (await Bun.file(metadataPath).json()) as InstallMetadata;

  if (!data.skills || typeof data.skills !== "object") {
    data.skills = {};
  }

  if (!data.formatVersion) {
    data.formatVersion = 1;
  }

  return data;
}
