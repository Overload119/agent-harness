import path from "node:path";

import { HARNESS_PATH } from "./constants";
import { readTextIfExists } from "./fs";

export async function ensureGitignoreEntry(targetRoot: string, dryRun: boolean): Promise<boolean> {
  const gitignorePath = path.join(targetRoot, ".gitignore");
  const content = await readTextIfExists(gitignorePath);
  const lines = content === "" ? [] : content.split(/\r?\n/);
  const ignoredPaths = [`${HARNESS_PATH}/`, ".agents/agent-harness-install.json"];
  const missingPaths = ignoredPaths.filter((ignoredPath) => {
    const rootedIgnoredPath = `/${ignoredPath}`;
    return !lines.includes(ignoredPath) && !lines.includes(rootedIgnoredPath);
  });

  if (missingPaths.length === 0) {
    return false;
  }

  if (dryRun) {
    for (const ignoredPath of missingPaths) {
      console.log(`Would update .gitignore: add ${ignoredPath}`);
    }
    return true;
  }

  const prefix = content.endsWith("\n") || content === "" ? content : `${content}\n`;
  const nextContent = `${prefix}${missingPaths.join("\n")}\n`;
  await Bun.write(gitignorePath, nextContent);
  for (const ignoredPath of missingPaths) {
    console.log(`Updated .gitignore: added ${ignoredPath}`);
  }
  return true;
}
