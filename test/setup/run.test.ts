import { expect, mock, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { access, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import type { SetupSourceOverrides } from "../../src/setup/types";

mock.module("../../src/setup/prompt", () => ({
  confirmInstall: async () => {},
  confirmGlobalInstall: async () => {},
}));

const { runSetup } = await import("../../src/setup/run");

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");
const SETUP_SCRIPT = path.join(REPO_ROOT, "bin/setup");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function createTargetRepo(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function shippedSkillNames(): Promise<string[]> {
  const sourceDir = path.join(REPO_ROOT, "skills");
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const names: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(sourceDir, entry.name);
    const hasSkillFile =
      (await pathExists(path.join(skillDir, "SKILL.md"))) ||
      (await pathExists(path.join(skillDir, "SKILL.md.liquid")));

    if (!hasSkillFile) {
      continue;
    }

    names.push(entry.name.startsWith("ah-") ? entry.name.slice(3) : entry.name);
  }

  return names.sort((left, right) => left.localeCompare(right));
}

async function createCommandSourceDir(
  prefix: string,
  files: Record<string, string>,
): Promise<{ root: string; dir: string; names: string[] }> {
  const root = await createTargetRepo(prefix);
  const dir = path.join(root, "commands");
  await mkdir(dir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, name), content, "utf8");
  }

  return {
    root,
    dir,
    names: Object.keys(files).sort((left, right) => left.localeCompare(right)),
  };
}

async function withWorkingDirectory<T>(cwd: string, run: () => Promise<T>): Promise<T> {
  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    return await run();
  } finally {
    process.chdir(previousCwd);
  }
}

async function runSetupAndCapture(
  targetRoot: string,
  options: { dry?: boolean; global?: boolean; overwrite?: boolean; yes?: boolean },
  sourceOverrides: SetupSourceOverrides = {},
): Promise<string> {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };

  try {
    await withWorkingDirectory(targetRoot, async () => {
      await runSetup(options, ["bun", SETUP_SCRIPT], sourceOverrides);
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return lines.join("\n");
}

async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const previous: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("setup installs shipped skills, writes managed metadata, creates harness directories, and restores managed skills with overwrite", async () => {
  const expectedSkills = await shippedSkillNames();
  const dryRunRoot = await createTargetRepo("ah-setup-dry-");
  const installRoot = await createTargetRepo("ah-setup-install-");

  try {
    const dryRunOutput = await runSetupAndCapture(dryRunRoot, { dry: true });

    expect(dryRunOutput).toContain("Would update .gitignore: add .agent-harness/");
    expect(dryRunOutput).toContain("Would update .gitignore: add /.agents/agent-harness-install.json");
    expect(dryRunOutput).toContain("Would update .gitignore: add !.agent-harness/memory/");
    expect(dryRunOutput).toContain("Would update .gitignore: add !.agent-harness/memory/*.md");
    expect(dryRunOutput).toContain("Would install: r-plan");
    expect(await pathExists(path.join(dryRunRoot, ".gitignore"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".agents", "agent-harness-install.json"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".agent-harness", "diagrams"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".agent-harness", "logs"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, "opencode.json"))).toBe(false);

    const installOutput = await runSetupAndCapture(installRoot, {});
    const installedSkillsDir = path.join(installRoot, ".agents", "skills");
    const metadataPath = path.join(installRoot, ".agents", "agent-harness-install.json");
    const gitignorePath = path.join(installRoot, ".gitignore");
    const installedSkillNames = (await readdir(installedSkillsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
      formatVersion: number;
      skills: Record<string, { managed?: boolean; targetPath?: string }>;
      source?: { repoRoot: string; commit: string };
      targetRoot?: string;
    };
    const gitignoreLines = (await readFile(gitignorePath, "utf8")).trim().split(/\r?\n/);
    const mermaidSkill = await readFile(path.join(installedSkillsDir, "mermaid", "SKILL.md"), "utf8");
    const verifySkill = await readFile(path.join(installedSkillsDir, "verify", "SKILL.md"), "utf8");

    expect(installOutput).toContain("Updated .gitignore: added .agent-harness/");
    expect(installOutput).toContain("Updated .gitignore: added !.agent-harness/memory/");
    expect(installOutput).toContain("Updated .gitignore: added !.agent-harness/memory/*.md");
    expect(installOutput).toContain("install: r-plan");
    expect(installedSkillNames).toEqual(expectedSkills);
    expect(installedSkillNames).not.toContain("plan");
    expect(installedSkillNames).not.toContain("prd");
    expect(installedSkillNames).toContain("r-plan");
    for (const name of ["user-scenarios", "restate", "adhd", "unsure", "handoff", "be-ambitious"]) {
      expect(installedSkillNames).toContain(name);
      const installed = await readFile(path.join(installedSkillsDir, name, "SKILL.md"), "utf8");
      expect(installed).toBe(await readFile(path.join(REPO_ROOT, "dist", "skills", name, "SKILL.md"), "utf8"));
    }
    for (const name of ["ah-memory"]) {
      expect(await pathExists(path.join(installRoot, ".agent-harness", "bin", name))).toBe(true);
    }
    for (const name of ["ah-loop", "ah-run-state", "ah-vis"]) {
      expect(await pathExists(path.join(installRoot, ".agent-harness", "bin", name))).toBe(false);
    }
    expect(await pathExists(path.join(installRoot, "tui.json"))).toBe(true);
    expect(await pathExists(path.join(installRoot, ".opencode", "plugins"))).toBe(false);
    expect(installOutput).not.toContain("turn-counter");
    expect(gitignoreLines.some((line) => line.includes("turn_count"))).toBe(false);
    expect(metadata.formatVersion).toBe(1);
    expect(Object.keys(metadata.skills).sort((left, right) => left.localeCompare(right))).toEqual(expectedSkills);
    expect(metadata.source?.repoRoot).toBe(REPO_ROOT);
    expect(metadata.source?.commit).not.toBe("");
    expect(metadata.targetRoot).toBe(await realpath(installRoot));
    expect(metadata.skills["r-plan"]).toMatchObject({
      managed: true,
      targetPath: ".agents/skills/r-plan",
    });
    expect(gitignoreLines.filter((line) => line === ".agent-harness/")).toHaveLength(1);
    expect(await pathExists(path.join(installRoot, ".agent-harness", "diagrams"))).toBe(true);
    expect(await pathExists(path.join(installRoot, ".agent-harness", "logs"))).toBe(true);
    expect(await pathExists(path.join(installRoot, ".agent-harness", "memory"))).toBe(true);
    expect(mermaidSkill).toContain(".agent-harness/diagrams/");
    expect(mermaidSkill).toContain("beautiful-mermaid");
    expect(mermaidSkill).toContain("renderMermaidSVG");
    expect(mermaidSkill).toContain("plan flow");
    expect(verifySkill).toContain("how can I verify this?");
    expect(verifySkill).toContain("how should I test this?");
    expect(verifySkill).toContain("Verified summary");
    expect(verifySkill).toContain("Visual proof");
    expect(verifySkill).toContain("exact local file path");

    const managedSkillPath = path.join(installedSkillsDir, "r-plan", "SKILL.md");
    const originalManagedSkill = await readFile(managedSkillPath, "utf8");
    await writeFile(managedSkillPath, `${originalManagedSkill}\nLOCAL CHANGE\n`, "utf8");

    const skipOutput = await runSetupAndCapture(installRoot, {});
    const skippedManagedSkill = await readFile(managedSkillPath, "utf8");

    expect(skipOutput).toContain("skip: r-plan (managed skill has local changes; re-run with --overwrite to restore harness files)");
    expect(skippedManagedSkill).toContain("LOCAL CHANGE");

    const overwriteOutput = await runSetupAndCapture(installRoot, { overwrite: true });
    const restoredManagedSkill = await readFile(managedSkillPath, "utf8");
    const rewrittenGitignoreLines = (await readFile(gitignorePath, "utf8")).trim().split(/\r?\n/);

    expect(overwriteOutput).toContain("update: r-plan (overwriting local changes with harness files)");
    expect(restoredManagedSkill).toBe(originalManagedSkill);
    expect(rewrittenGitignoreLines.filter((line) => line === ".agent-harness/")).toHaveLength(1);
    expect(rewrittenGitignoreLines.filter((line) => line === "/.agents/agent-harness-install.json")).toHaveLength(1);

    // Provenance paths may refer to another machine; upgrade ownership uses hashes.
    const movedMetadata = JSON.parse(await readFile(metadataPath, "utf8"));
    movedMetadata.source.repoRoot = "/previous-machine/harness";
    movedMetadata.targetRoot = "/previous-machine/project";
    movedMetadata.skills["r-plan"].sourcePath = "/previous-machine/harness/skills/ah-r-plan";
    await writeFile(metadataPath, JSON.stringify(movedMetadata));
    await writeFile(managedSkillPath, `${originalManagedSkill}\nLOCAL CHANGE\n`);
    expect(await runSetupAndCapture(installRoot, {})).toContain("managed skill has local changes");
    await runSetupAndCapture(installRoot, { overwrite: true });
    expect(await readFile(managedSkillPath, "utf8")).toBe(originalManagedSkill);

    // A missing local manifest must never authorize overwriting existing files.
    await rm(metadataPath);
    await writeFile(managedSkillPath, "UNMANAGED CUSTOM SKILL\n");
    expect(await runSetupAndCapture(installRoot, { overwrite: true })).toContain("existing directory is not managed by agent-harness");
    expect(await readFile(managedSkillPath, "utf8")).toBe("UNMANAGED CUSTOM SKILL\n");
  } finally {
    await rm(dryRunRoot, { force: true, recursive: true });
    await rm(installRoot, { force: true, recursive: true });
  }
});

test("AGENTS.md: adds memory section on first run, is idempotent on subsequent runs", async () => {
  const targetRoot = await createTargetRepo("ah-setup-agents-");

  try {
    const agentsPath = path.join(targetRoot, "AGENTS.md");
    const initialContent = `## Skill Sources And Installs

- Some existing content

## Build And Visualizer Rules

- Some other content
`;
    await writeFile(agentsPath, initialContent, "utf8");

    const firstRun = await runSetupAndCapture(targetRoot, {});
    expect(firstRun).toContain("Updated AGENTS.md: added agent-harness section");

    const afterFirstRun = await readFile(agentsPath, "utf8");
    expect(afterFirstRun).toContain("<!-- agent-harness-memory -->");
    expect(afterFirstRun).toContain("<!-- /agent-harness-memory -->");
    expect(afterFirstRun.match(/<!-- agent-harness-memory -->/g) || []).toHaveLength(1);

    const secondRun = await runSetupAndCapture(targetRoot, {});
    expect(secondRun).toContain("skip: agents (agent-harness section unchanged)");
    expect(secondRun).not.toContain("Updated AGENTS.md");

    const afterSecondRun = await readFile(agentsPath, "utf8");
    expect(afterSecondRun.match(/<!-- agent-harness-memory -->/g) || []).toHaveLength(1);

    const thirdRun = await runSetupAndCapture(targetRoot, {});
    expect(thirdRun).toContain("skip: agents (agent-harness section unchanged)");

    const afterThirdRun = await readFile(agentsPath, "utf8");
    expect(afterThirdRun.match(/<!-- agent-harness-memory -->/g) || []).toHaveLength(1);
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("setup creates .agent-harness/memory directory and recreates it after deletion", async () => {
  const targetRoot = await createTargetRepo("ah-setup-memory-");

  try {
    await runSetupAndCapture(targetRoot, {});
    expect(await pathExists(path.join(targetRoot, ".agent-harness", "memory"))).toBe(true);

    await rm(path.join(targetRoot, ".agent-harness", "memory"), { force: true, recursive: true });
    expect(await pathExists(path.join(targetRoot, ".agent-harness", "memory"))).toBe(false);

    await runSetupAndCapture(targetRoot, { overwrite: true });
    expect(await pathExists(path.join(targetRoot, ".agent-harness", "memory"))).toBe(true);
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("setup installs skills into a separate destination project", async () => {
  const harnessRoot = await createTargetRepo("ah-setup-harness-");

  try {
    await withWorkingDirectory(harnessRoot, async () => {
      await runSetup({}, ["bun", SETUP_SCRIPT]);
    });

    expect(await pathExists(path.join(harnessRoot, ".agent-harness", "memory"))).toBe(true);
    expect(await pathExists(path.join(harnessRoot, ".agents", "skills", "r-plan", "SKILL.md"))).toBe(true);
  } finally {
    await rm(harnessRoot, { force: true, recursive: true });
  }
});

test("setup works when run from any directory (not just the harness repo)", async () => {
  const unrelatedDir = await createTargetRepo("ah-setup-any-dir-");

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", SETUP_SCRIPT, "--yes"],
      cwd: unrelatedDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = Buffer.from(result.stderr).toString("utf8");
    const stdout = Buffer.from(result.stdout).toString("utf8");

    expect(result.exitCode).toBe(0);
    expect(stdout + stderr).toContain("Installed");
    expect(await pathExists(path.join(unrelatedDir, ".agent-harness", "memory"))).toBe(true);
    expect(await pathExists(path.join(unrelatedDir, ".agents", "skills", "r-plan", "SKILL.md"))).toBe(true);
  } finally {
    await rm(unrelatedDir, { force: true, recursive: true });
  }
});

test("setup copies user-facing commands from src/opencode/commands", async () => {
  const targetRoot = await createTargetRepo("ah-commands-filter-");
  const commandSource = await createCommandSourceDir("ah-command-source-", {
    "deploy.md": `---
name: deploy
description: Deploy the application
---

Deploy workflow here.
`,
  });

  try {
    const installOutput = await runSetupAndCapture(targetRoot, {}, { commandsSourceDir: commandSource.dir });

    const targetCommandsDir = path.join(targetRoot, ".opencode", "commands");
    expect(await pathExists(targetCommandsDir)).toBe(true);

    const files = await readdir(targetCommandsDir, { withFileTypes: true });
    const fileNames = files.filter((f) => f.isFile()).map((f) => f.name).sort((left, right) => left.localeCompare(right));

    expect(fileNames).toEqual(commandSource.names);
    expect(installOutput).toContain(`installing ${commandSource.names.length} command(s)`);
    expect(installOutput).toContain("copied:");
    expect(installOutput).toContain(".opencode/commands/deploy.md");

    const dryOutput = await runSetupAndCapture(targetRoot, { dry: true }, { commandsSourceDir: commandSource.dir });
    expect(dryOutput).toContain(`Would copy commands: ${commandSource.names.join(", ")}`);
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
    await rm(commandSource.root, { force: true, recursive: true });
  }
});

test("setup --global installs shared assets into ~/.agent-harness and skills into ~/.agents without touching the current repo", async () => {
  const fakeHome = await createTargetRepo("ah-setup-home-");
  const cwd = await createTargetRepo("ah-setup-cwd-");
  const commandSource = await createCommandSourceDir("ah-global-command-source-", {
    "deploy.md": `---
name: deploy
description: Deploy the application
---

Deploy workflow here.
`,
  });

  try {
    const output = await withEnv({ HOME: fakeHome }, async () => {
      return withWorkingDirectory(cwd, async () => {
        return runSetupAndCapture(cwd, { global: true, yes: true }, { commandsSourceDir: commandSource.dir });
      });
    });

    const harnessRoot = path.join(fakeHome, ".agent-harness");
    const agentsRoot = path.join(fakeHome, ".agents");
    expect(output).toContain(harnessRoot);
    expect(await pathExists(path.join(agentsRoot, "agent-harness-install.json"))).toBe(true);
    expect(await pathExists(path.join(agentsRoot, "skills", "r-plan", "SKILL.md"))).toBe(true);
    for (const name of ["user-scenarios", "restate", "adhd", "unsure", "handoff", "be-ambitious"]) {
      expect(await pathExists(path.join(agentsRoot, "skills", name, "SKILL.md"))).toBe(true);
    }
    expect(await pathExists(path.join(harnessRoot, ".opencode", "plugins"))).toBe(false);
    expect(await pathExists(path.join(harnessRoot, "bin"))).toBe(true);
    expect(await pathExists(path.join(harnessRoot, "memory"))).toBe(true);
    expect(await pathExists(path.join(harnessRoot, ".agents"))).toBe(false);
    expect(await pathExists(path.join(fakeHome, ".codex"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".agents"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".agent-harness"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".codex"))).toBe(false);
  } finally {
    await rm(fakeHome, { force: true, recursive: true });
    await rm(cwd, { force: true, recursive: true });
    await rm(commandSource.root, { force: true, recursive: true });
  }
});

test("setup --global migrates legacy ~/.agent-harness/.agents skills and metadata into ~/.agents", async () => {
  const fakeHome = await createTargetRepo("ah-setup-legacy-home-");
  const cwd = await createTargetRepo("ah-setup-legacy-cwd-");

  try {
    await withEnv({ HOME: fakeHome }, async () => {
      const { createTemplateVariables } = await import("../../src/setup/constants");
      const { renderedManifestFor } = await import("../../src/setup/manifest");
      const { writeSkillDirectory } = await import("../../src/setup/skills");

      const templateVariables = await createTemplateVariables(REPO_ROOT);
      const sourceSkillDir = path.join(REPO_ROOT, "skills", "ah-r-plan");
      const legacyAgentsDir = path.join(fakeHome, ".agent-harness", ".agents");
      const legacySkillDir = path.join(legacyAgentsDir, "skills", "r-plan");
      const legacyMetadataPath = path.join(legacyAgentsDir, "agent-harness-install.json");
      const installedFiles = await renderedManifestFor(sourceSkillDir, templateVariables);

      await writeSkillDirectory(sourceSkillDir, legacySkillDir, templateVariables);
      await writeFile(
        legacyMetadataPath,
        `${JSON.stringify(
          {
            formatVersion: 1,
            skills: {
              "r-plan": {
                managed: true,
                sourceSkill: "ah-r-plan",
                sourcePath: sourceSkillDir,
                targetPath: ".agents/skills/r-plan",
                installedFiles,
              },
            },
            targetRoot: path.join(fakeHome, ".agent-harness"),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      const output = await withWorkingDirectory(cwd, async () => {
        return runSetupAndCapture(cwd, { global: true, yes: true });
      });

      expect(output).toContain("migrate: legacy global metadata");
      expect(output).toContain("migrate: legacy global skill r-plan");
      expect(await pathExists(path.join(fakeHome, ".agents", "agent-harness-install.json"))).toBe(true);
      expect(await pathExists(path.join(fakeHome, ".agents", "skills", "r-plan", "SKILL.md"))).toBe(true);
      expect(await pathExists(legacyMetadataPath)).toBe(false);
      expect(await pathExists(legacySkillDir)).toBe(false);
      expect(await pathExists(legacyAgentsDir)).toBe(false);
    });
  } finally {
    await rm(fakeHome, { force: true, recursive: true });
    await rm(cwd, { force: true, recursive: true });
  }
});

for (const modified of [false, true]) {
  test(`combined r-plan upgrade ${modified ? 'preserves locally edited' : 'removes unchanged'} managed plan/prd`, async () => {
    const targetRoot = await createTargetRepo('ah-combined-plan-');
    const { manifestFor } = await import('../../src/setup/manifest');
    try {
      const metadata = { formatVersion: 1, skills: {} as Record<string, unknown>, commands: {} };
      for (const name of ['plan', 'prd']) {
        const dir = path.join(targetRoot, '.agents', 'skills', name);
        await mkdir(dir, { recursive: true });
        const skillPath = path.join(dir, 'SKILL.md');
        await writeFile(skillPath, `---\nname: ah-${name}\ndescription: Old planning skill\n---\nOld content\n`);
        metadata.skills[name] = { managed: true, targetPath: `.agents/skills/${name}`, installedFiles: await manifestFor(dir) };
        if (modified) await writeFile(skillPath, 'LOCAL CUSTOMIZATION\n');
      }
      const metadataPath = path.join(targetRoot, '.agents/agent-harness-install.json');
      await writeFile(metadataPath, JSON.stringify(metadata));
      const preview = await runSetupAndCapture(targetRoot, { dry: true, overwrite: true });
      expect(preview).toContain(modified ? 'skip stale managed skill: plan' : 'Would remove: plan');
      expect(await pathExists(path.join(targetRoot, '.agents/skills/plan/SKILL.md'))).toBe(true);
      await runSetupAndCapture(targetRoot, { overwrite: true });
      const installedMetadata = JSON.parse(await readFile(metadataPath, 'utf8'));
      for (const name of ['plan', 'prd']) {
        const file = path.join(targetRoot, '.agents/skills', name, 'SKILL.md');
        expect(await pathExists(file)).toBe(modified);
        if (modified) expect(await readFile(file, 'utf8')).toBe('LOCAL CUSTOMIZATION\n');
        else expect(installedMetadata.skills[name]).toBeUndefined();
      }
      expect(await pathExists(path.join(targetRoot, '.agents/skills/r-plan/references/format.md'))).toBe(true);
    } finally { await rm(targetRoot, { recursive: true, force: true }); }
  });
}
