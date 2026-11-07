import { readdir } from "node:fs/promises";
import path from "node:path";

import { pathExists } from "./fs";

export type CommandSource = {
  fileName: string;
  sourcePath: string;
};

export async function listTopLevelMarkdownFiles(directory: string): Promise<CommandSource[]> {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      fileName: entry.name,
      sourcePath: path.join(directory, entry.name),
    }));
}
