import { expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import { listTopLevelMarkdownFiles } from "../../src/setup/commands";

test("listTopLevelMarkdownFiles returns only sorted top-level markdown files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ah-command-sources-"));
  const commandsDir = path.join(root, "commands");

  try {
    await mkdir(commandsDir, { recursive: true });
    await mkdir(path.join(commandsDir, "nested"), { recursive: true });
    await writeFile(path.join(commandsDir, "z-last.md"), "last", "utf8");
    await writeFile(path.join(commandsDir, "a-first.md"), "first", "utf8");
    await writeFile(path.join(commandsDir, "ignore.txt"), "ignore", "utf8");
    await writeFile(path.join(commandsDir, "nested", "ignore.md"), "ignore", "utf8");

    const sources = await listTopLevelMarkdownFiles(commandsDir);

    expect(sources.map((source) => source.fileName)).toEqual(["a-first.md", "z-last.md"]);
    expect(sources.map((source) => path.basename(source.sourcePath))).toEqual(["a-first.md", "z-last.md"]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
