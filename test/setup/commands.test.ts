import { expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import { listCodexPromptSources, renderCodexPromptFromCommand } from "../../src/setup/commands";

test("renderCodexPromptFromCommand strips OpenCode-only frontmatter and keeps Codex fields", () => {
  const rendered = renderCodexPromptFromCommand(`---
name: deploy
description: Deploy the application
argument-hint: ENV=<environment>
---

Deploy workflow here.

$ARGUMENTS
`);

  expect(rendered).toContain("description: Deploy the application");
  expect(rendered).toContain("argument-hint: ENV=<environment>");
  expect(rendered).toContain("$ARGUMENTS");
  expect(rendered).not.toContain("name: deploy");
});

test("listCodexPromptSources includes allowlisted internal commands only when requested", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ah-codex-sources-"));
  const userDir = path.join(root, "user");
  const internalDir = path.join(root, "internal");

  try {
    await mkdir(userDir, { recursive: true });
    await mkdir(internalDir, { recursive: true });
    await writeFile(path.join(userDir, "deploy.md"), "deploy", "utf8");
    await writeFile(path.join(internalDir, "do-later.md"), "do later", "utf8");
    await writeFile(path.join(internalDir, "ignore-me.md"), "ignore", "utf8");

    const projectSources = await listCodexPromptSources({
      userCommandsDir: userDir,
      internalCommandsDir: internalDir,
      includeInternalCommands: false,
    });
    const harnessSources = await listCodexPromptSources({
      userCommandsDir: userDir,
      internalCommandsDir: internalDir,
      includeInternalCommands: true,
    });

    expect(projectSources.map((source) => source.fileName)).toEqual(["deploy.md"]);
    expect(harnessSources.map((source) => source.fileName)).toEqual(["deploy.md", "do-later.md"]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
