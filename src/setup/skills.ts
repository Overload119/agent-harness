import { mkdir, readlink, readdir, symlink } from "node:fs/promises";
import path from "node:path";

import { pathExists } from "./fs";
import { renderTemplateFile } from "./template";

export function skillNameFromSource(directoryName: string): string {
  return directoryName.startsWith("ah-") ? directoryName.slice(3) : directoryName;
}

export async function listSkillDirectories(sourceDir: string): Promise<string[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const skills: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(sourceDir, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    const skillTemplateFile = path.join(skillDir, "SKILL.md.liquid");
    if ((await pathExists(skillFile)) || (await pathExists(skillTemplateFile))) {
      skills.push(skillDir);
    }
  }

  return skills;
}

export async function writeSkillDirectory(
  sourceDir: string,
  targetDir: string,
  variables: Record<string, string>,
): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  async function walk(currentSourceDir: string, currentTargetDir: string): Promise<void> {
    const entries = await readdir(currentSourceDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const sourcePath = path.join(currentSourceDir, entry.name);
      const targetName = entry.name.endsWith(".liquid")
        ? entry.name.slice(0, -".liquid".length)
        : entry.name;
      const targetPath = path.join(currentTargetDir, targetName);

      if (entry.isDirectory()) {
        await mkdir(targetPath, { recursive: true });
        await walk(sourcePath, targetPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        await symlink(await readlink(sourcePath), targetPath);
        continue;
      }

      if (entry.name.startsWith("_")) {
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name.endsWith(".liquid")) {
        await Bun.write(targetPath, await renderTemplateFile(sourcePath, variables));
        continue;
      }

      await Bun.write(targetPath, Bun.file(sourcePath));
    }
  }

  await walk(sourceDir, targetDir);
}
