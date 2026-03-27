import path from "node:path";

import { HARNESS_PATH } from "./constants";
import { readTextIfExists } from "./fs";

export async function ensureGitignoreEntry(targetRoot: string, dryRun: boolean): Promise<boolean> {
  const gitignorePath = path.join(targetRoot, ".gitignore");
  const content = await readTextIfExists(gitignorePath);
  const lines = content === "" ? [] : content.split(/\r?\n/);
  const ignoredPath = `${HARNESS_PATH}/`;
  const rootedIgnoredPath = `/${ignoredPath}`;
  const negationPath = `!/${HARNESS_PATH}/memory/`;

  if (lines.includes(ignoredPath) || lines.includes(rootedIgnoredPath)) {
    if (lines.includes(negationPath) || lines.includes(`/${negationPath}`)) {
      return false;
    }
    if (dryRun) {
      console.log(`Would update .gitignore: add ${negationPath}`);
      return true;
    }
    const nextContent = content.endsWith("\n") || content === "" ? `${content}${negationPath}\n` : `${content}\n${negationPath}\n`;
    await Bun.write(gitignorePath, nextContent);
    console.log(`Updated .gitignore: added ${negationPath}`);
    return true;
  }

  if (dryRun) {
    console.log(`Would update .gitignore: add ${ignoredPath} and ${negationPath}`);
    return true;
  }

  const entry = `${ignoredPath}\n${negationPath}`;
  const nextContent = content.endsWith("\n") || content === "" ? `${content}${entry}\n` : `${content}\n${entry}\n`;
  await Bun.write(gitignorePath, nextContent);
  console.log(`Updated .gitignore: added ${ignoredPath} and ${negationPath}`);
  return true;
}
