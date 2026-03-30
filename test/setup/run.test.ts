import { expect, mock, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { access, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";

mock.module("../../src/setup/prompt", () => ({
  confirmInstall: async () => {},
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

async function withWorkingDirectory<T>(cwd: string, run: () => Promise<T>): Promise<T> {
  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    return await run();
  } finally {
    process.chdir(previousCwd);
  }
}

async function runSetupAndCapture(targetRoot: string, options: { dry?: boolean; overwrite?: boolean }): Promise<string> {
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
      await runSetup(options, ["bun", SETUP_SCRIPT]);
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return lines.join("\n");
}

test("setup installs shipped skills, writes managed metadata, creates harness directories, and restores managed skills with overwrite", async () => {
  const expectedSkills = await shippedSkillNames();
  const dryRunRoot = await createTargetRepo("ah-setup-dry-");
  const installRoot = await createTargetRepo("ah-setup-install-");

  try {
    const dryRunOutput = await runSetupAndCapture(dryRunRoot, { dry: true });

    expect(dryRunOutput).toContain("Would update .gitignore: add .agent-harness/");
    expect(dryRunOutput).toContain("Would update .gitignore: add !.agent-harness/memory/");
    expect(dryRunOutput).toContain("Would update .gitignore: add !.agent-harness/memory/*.md");
    expect(dryRunOutput).toContain("Would update .gitignore: add .agent-harness/memory/.turn_count*");
    expect(dryRunOutput).toContain("Would update .gitignore: add .agent-harness/memory/.turn_count_default*");
    expect(dryRunOutput).toContain("Would install: plan");
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
    expect(installOutput).toContain("Updated .gitignore: added .agent-harness/memory/.turn_count*");
    expect(installOutput).toContain("Updated .gitignore: added .agent-harness/memory/.turn_count_default*");
    expect(installOutput).toContain("install: plan");
    expect(installedSkillNames).toEqual(expectedSkills);
    expect(metadata.formatVersion).toBe(1);
    expect(Object.keys(metadata.skills).sort((left, right) => left.localeCompare(right))).toEqual(expectedSkills);
    expect(metadata.source?.repoRoot).toBe(REPO_ROOT);
    expect(metadata.source?.commit).not.toBe("");
    expect(metadata.targetRoot).toBe(await realpath(installRoot));
    expect(metadata.skills.plan).toMatchObject({
      managed: true,
      targetPath: ".agents/skills/plan",
    });
    expect(gitignoreLines.filter((line) => line === ".agent-harness/")).toHaveLength(1);
    expect(await pathExists(path.join(installRoot, ".agent-harness", "diagrams"))).toBe(true);
    expect(await pathExists(path.join(installRoot, ".agent-harness", "logs"))).toBe(true);
    expect(await pathExists(path.join(installRoot, ".agent-harness", "memory"))).toBe(true);
    expect(mermaidSkill).toContain(".agent-harness/diagrams/");
    expect(mermaidSkill).toContain("beautiful-mermaid");
    expect(mermaidSkill).toContain("renderMermaidSVG");
    expect(mermaidSkill).toContain("plan flow");
    expect(verifySkill).toContain("Visual proof");
    expect(verifySkill).toContain("exact local file path");

    const managedSkillPath = path.join(installedSkillsDir, "plan", "SKILL.md");
    const originalManagedSkill = await readFile(managedSkillPath, "utf8");
    await writeFile(managedSkillPath, `${originalManagedSkill}\nLOCAL CHANGE\n`, "utf8");

    const skipOutput = await runSetupAndCapture(installRoot, {});
    const skippedManagedSkill = await readFile(managedSkillPath, "utf8");

    expect(skipOutput).toContain("skip: plan (managed skill has local changes; re-run with --overwrite to restore harness files)");
    expect(skippedManagedSkill).toContain("LOCAL CHANGE");

    const overwriteOutput = await runSetupAndCapture(installRoot, { overwrite: true });
    const restoredManagedSkill = await readFile(managedSkillPath, "utf8");
    const rewrittenGitignoreLines = (await readFile(gitignorePath, "utf8")).trim().split(/\r?\n/);

    expect(overwriteOutput).toContain("update: plan (overwriting local changes with harness files)");
    expect(restoredManagedSkill).toBe(originalManagedSkill);
    expect(rewrittenGitignoreLines.filter((line) => line === ".agent-harness/")).toHaveLength(1);
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

test("setup renders bin_path template variable in installed skills", async () => {
  const targetRoot = await createTargetRepo("ah-setup-binpath-");

  try {
    await runSetupAndCapture(targetRoot, {});

    const executorSkillPath = path.join(targetRoot, ".agents", "skills", "executor", "SKILL.md");
    const executorSkill = await readFile(executorSkillPath, "utf8");

    expect(executorSkill).not.toContain("{{ bin_path }}");
    expect(executorSkill).toContain(".agent-harness/bin/ah-run-state");
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

test("memory-turn-counter plugin gracefully handles missing turn count file", async () => {
  const targetRoot = await createTargetRepo("ah-turn-counter-");

  try {
    const installOutput = await runSetupAndCapture(targetRoot, {});

    const tuiTarget = path.join(targetRoot, "tui.json");
    const pluginTarget = path.join(targetRoot, ".opencode", "plugins", "ah-memory-turn-counter.js");
    expect(await pathExists(tuiTarget)).toBe(true);
    expect(await pathExists(pluginTarget)).toBe(true);
    expect(installOutput).toContain("copied:");
    expect(installOutput).toContain("tui.json");

    const memoryDir = path.join(targetRoot, ".agent-harness", "memory");
    expect(await pathExists(memoryDir)).toBe(true);

    const { MemoryTurnCounter } = await import(path.join(targetRoot, ".opencode", "plugins", "ah-memory-turn-counter.js"));

    const logs: unknown[] = [];
    const mockClient = {
      app: {
        log: async ({ body }: { body: unknown }) => {
          logs.push(body);
        },
      },
    };

    const { $ } = await import("bun");
    const plugin = await MemoryTurnCounter({
      client: mockClient as any,
      $,
      directory: targetRoot,
      worktree: undefined,
    });

    const newSessionId = "nonexistent-session-12345";
    const turnCountFile = path.join(memoryDir, `.turn_count_${newSessionId}`);
    expect(await pathExists(turnCountFile)).toBe(false);

    await plugin.event({
      event: { type: "session.created", properties: { sessionID: newSessionId } },
    });

    const sessionLog = logs.find(
      (l: any) => l.service === "memory-turn-counter" && l.message?.includes("started with turn count")
    );
    expect(sessionLog).toBeDefined();
    expect((sessionLog as any).message).toContain("started with turn count 0");
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("setup installs skills successfully when run from harness repo directory", async () => {
  const harnessRoot = await createTargetRepo("ah-setup-harness-");

  try {
    await withWorkingDirectory(harnessRoot, async () => {
      await runSetup({}, ["bun", SETUP_SCRIPT]);
    });

    expect(await pathExists(path.join(harnessRoot, ".agent-harness", "memory"))).toBe(true);
    expect(await pathExists(path.join(harnessRoot, ".agents", "skills", "plan", "SKILL.md"))).toBe(true);
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
    expect(await pathExists(path.join(unrelatedDir, ".agents", "skills", "plan", "SKILL.md"))).toBe(true);
  } finally {
    await rm(unrelatedDir, { force: true, recursive: true });
  }
});

test("memory-turn-counter plugin creates memory directory if missing", async () => {
  const targetRoot = await createTargetRepo("ah-turn-counter-missing-dir-");

  try {
    await runSetupAndCapture(targetRoot, {});

    const pluginTarget = path.join(targetRoot, ".opencode", "plugins", "ah-memory-turn-counter.js");
    const { MemoryTurnCounter } = await import(pluginTarget);

    const logs: unknown[] = [];
    const mockClient = {
      app: {
        log: async ({ body }: { body: unknown }) => {
          logs.push(body);
        },
      },
    };

    const { $ } = await import("bun");
    const plugin = await MemoryTurnCounter({
      client: mockClient as any,
      $,
      directory: targetRoot,
      worktree: undefined,
    });

    const memoryDir = path.join(targetRoot, ".agent-harness", "memory");
    await rm(memoryDir, { force: true, recursive: true });
    expect(await pathExists(memoryDir)).toBe(false);

    const newSessionId = "test-session-67890";
    await plugin.event({
      event: { type: "session.created", properties: { sessionID: newSessionId } },
    });

    expect(await pathExists(memoryDir)).toBe(false);

    await plugin["chat.message"]({
      sessionID: newSessionId,
      message: { role: "user", content: "hello" },
    });

    expect(await pathExists(memoryDir)).toBe(true);

    const sessionLog = logs.find(
      (l: any) => l.service === "memory-turn-counter" && l.message?.includes("started with turn count")
    );
    expect(sessionLog).toBeDefined();
    expect((sessionLog as any).message).toContain("started with turn count 0");
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("setup copies user-facing commands from src/opencode/commands", async () => {
  const targetRoot = await createTargetRepo("ah-commands-filter-");

  const commandsSourceDir = path.join(REPO_ROOT, "src", "opencode", "commands");
  const deployPath = path.join(commandsSourceDir, "deploy.md");

  const deployContent = `---
name: deploy
description: Deploy the application
---

Deploy workflow here.
`;

  try {
    await mkdir(commandsSourceDir, { recursive: true });
    await writeFile(deployPath, deployContent);

    const installOutput = await runSetupAndCapture(targetRoot, {});

    const targetCommandsDir = path.join(targetRoot, ".opencode", "commands");
    expect(await pathExists(targetCommandsDir)).toBe(true);

    const files = await readdir(targetCommandsDir, { withFileTypes: true });
    const fileNames = files.filter((f) => f.isFile()).map((f) => f.name);

    expect(fileNames).toContain("deploy.md");
    expect(installOutput).toContain("installing 1 command(s)");
    expect(installOutput).toContain("copied:");
    expect(installOutput).toContain(".opencode/commands/deploy.md");

    const dryOutput = await runSetupAndCapture(targetRoot, { dry: true });
    expect(dryOutput).toContain("Would copy commands: deploy.md");
  } finally {
    await rm(deployPath, { force: true });
    await rm(targetRoot, { force: true, recursive: true });
  }
});
