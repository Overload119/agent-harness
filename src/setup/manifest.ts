import { readlink, readdir } from "node:fs/promises";
import path from "node:path";

import { hashContent, hashFile, pathExists } from "./fs";
import { renderTemplateFile } from "./template";
import type { Manifest } from "./types";

export function manifestsEqual(left: Manifest, right: Manifest): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function targetPathForSourceFile(relativePath: string): string {
  return relativePath.endsWith(".liquid") ? relativePath.slice(0, -".liquid".length) : relativePath;
}

export async function manifestFor(directory: string): Promise<Manifest> {
  const manifest: Manifest = {};

  if (!(await pathExists(directory))) {
    return manifest;
  }

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        const linkTarget = await readlink(entryPath);
        manifest[path.relative(directory, entryPath).replaceAll(path.sep, "/")] = `symlink:${linkTarget}`;
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      manifest[path.relative(directory, entryPath).replaceAll(path.sep, "/")] = await hashFile(entryPath);
    }
  }

  await walk(directory);
  return manifest;
}

export async function renderedManifestFor(
  directory: string,
  variables: Record<string, string>,
): Promise<Manifest> {
  const manifest: Manifest = {};

  if (!(await pathExists(directory))) {
    return manifest;
  }

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(directory, entryPath).replaceAll(path.sep, "/");
      const targetRelativePath = targetPathForSourceFile(relativePath);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        const linkTarget = await readlink(entryPath);
        manifest[targetRelativePath] = `symlink:${linkTarget}`;
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (relativePath.endsWith(".liquid")) {
        manifest[targetRelativePath] = hashContent(await renderTemplateFile(entryPath, variables));
        continue;
      }

      manifest[targetRelativePath] = await hashFile(entryPath);
    }
  }

  await walk(directory);
  return manifest;
}
