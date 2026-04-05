import { readdir } from "node:fs/promises";
import path from "node:path";

import { pathExists } from "./fs";

export type CommandSource = {
  fileName: string;
  sourcePath: string;
};

const CODEX_FRONTMATTER_FIELDS = new Set(["description", "argument-hint"]);
const INTERNAL_CODEX_PROMPT_ALLOWLIST = new Set(["do-later"]);

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

export async function listCodexPromptSources(options: {
  userCommandsDir: string;
  internalCommandsDir: string;
  includeInternalCommands: boolean;
}): Promise<CommandSource[]> {
  const byName = new Map<string, CommandSource>();

  if (options.includeInternalCommands) {
    for (const source of await listTopLevelMarkdownFiles(options.internalCommandsDir)) {
      const commandName = source.fileName.replace(/\.md$/, "");
      if (!INTERNAL_CODEX_PROMPT_ALLOWLIST.has(commandName)) {
        continue;
      }
      byName.set(source.fileName, source);
    }
  }

  for (const source of await listTopLevelMarkdownFiles(options.userCommandsDir)) {
    byName.set(source.fileName, source);
  }

  return Array.from(byName.values()).sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export function renderCodexPromptFromCommand(content: string): string {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return content.trimStart();
  }

  const fullFrontmatter = frontmatterMatch[0];
  const frontmatterLines = frontmatterMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => {
      const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
      return keyMatch ? CODEX_FRONTMATTER_FIELDS.has(keyMatch[1]) : false;
    });
  const body = content.slice(fullFrontmatter.length).trimStart();

  if (frontmatterLines.length === 0) {
    return body;
  }

  return `---\n${frontmatterLines.join("\n")}\n---\n\n${body}`;
}
