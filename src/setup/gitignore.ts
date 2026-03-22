import path from "node:path";

import { HARNESS_PATH } from "./constants";
import { readTextIfExists } from "./fs";

export async function ensureGitignoreEntry(targetRoot: string, dryRun: boolean): Promise<boolean> {
  const gitignorePath = path.join(targetRoot, ".gitignore");
  const content = await readTextIfExists(gitignorePath);
  const lines = content === "" ? [] : content.split(/\r?\n/);
  const ignoredPath = `${HARNESS_PATH}/`;
  const rootedIgnoredPath = `/${ignoredPath}`;

  if (lines.includes(ignoredPath) || lines.includes(rootedIgnoredPath)) {
    return false;
  }

  if (dryRun) {
    console.log(`Would update .gitignore: add ${ignoredPath}`);
    return true;
  }

  const nextContent = content.endsWith("\n") || content === "" ? `${content}${ignoredPath}\n` : `${content}\n${ignoredPath}\n`;
  await Bun.write(gitignorePath, nextContent);
  console.log(`Updated .gitignore: added ${ignoredPath}`);
  return true;
}
