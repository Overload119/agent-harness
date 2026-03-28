import path from "node:path";

import { readTextIfExists } from "./fs";

const GITIGNORE_ENTRIES = [
  ".agent-harness/",
  "!.agent-harness/memory/",
  "!.agent-harness/memory/*.md",
  ".agent-harness/memory/.turn_count*",
  ".agent-harness/memory/.turn_count_default*",
];

export async function ensureGitignoreEntry(targetRoot: string, dryRun: boolean): Promise<boolean> {
  const gitignorePath = path.join(targetRoot, ".gitignore");
  const content = await readTextIfExists(gitignorePath);
  const lines = content === "" ? [] : content.split(/\r?\n/);

  const missingEntries = GITIGNORE_ENTRIES.filter((entry) => !lines.includes(entry));

  if (missingEntries.length === 0) {
    return false;
  }

  if (dryRun) {
    for (const entry of missingEntries) {
      console.log(`Would update .gitignore: add ${entry}`);
    }
    return true;
  }

  let nextContent = content;
  for (const entry of missingEntries) {
    nextContent = nextContent.endsWith("\n") || nextContent === "" ? `${nextContent}${entry}\n` : `${nextContent}\n${entry}\n`;
    console.log(`Updated .gitignore: added ${entry}`);
  }
  await Bun.write(gitignorePath, nextContent);
  return true;
}
