import { expect, mock, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { access, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";

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
    expect(dryRunOutput).toContain("Would update .gitignore: add .agents/agent-harness-install.json");
    expect(dryRunOutput).toContain("Would install: agent-memory mcp");
    expect(dryRunOutput).toContain("Would install: agent-memory opencode plugin");
    expect(dryRunOutput).toContain("Would install: plan");
    expect(await pathExists(path.join(dryRunRoot, ".gitignore"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".agents", "agent-harness-install.json"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".agent-harness", "diagrams"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".agent-harness", "logs"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, "opencode.json"))).toBe(false);
    expect(await pathExists(path.join(dryRunRoot, ".opencode", "plugins", "agentkits-memory.js"))).toBe(false);

    const installOutput = await runSetupAndCapture(installRoot, {});
    const installedSkillsDir = path.join(installRoot, ".agents", "skills");
     const metadataPath = path.join(installRoot, ".agents", "agent-harness-install.json");
     const gitignorePath = path.join(installRoot, ".gitignore");
     const opencodeConfigPath = path.join(installRoot, "opencode.json");
     const opencodePluginPath = path.join(installRoot, ".opencode", "plugins", "agentkits-memory.js");
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
     const opencodeConfig = JSON.parse(await readFile(opencodeConfigPath, "utf8")) as {
       $schema?: string;
       mcp?: Record<string, { command?: string[]; enabled?: boolean; type?: string }>;
     };
     const mermaidSkill = await readFile(path.join(installedSkillsDir, "mermaid", "SKILL.md"), "utf8");
     const memoryPlugin = await readFile(opencodePluginPath, "utf8");

     expect(installOutput).toContain("Updated .gitignore: added .agent-harness/");
     expect(installOutput).toContain("Updated .gitignore: added .agents/agent-harness-install.json");
     expect(installOutput).toContain("install: agent-memory mcp");
     expect(installOutput).toContain("install: agent-memory opencode plugin");
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
     expect(gitignoreLines.filter((line) => line === ".agents/agent-harness-install.json")).toHaveLength(1);
     expect(await pathExists(path.join(installRoot, ".agent-harness", "diagrams"))).toBe(true);
     expect(await pathExists(path.join(installRoot, ".agent-harness", "logs"))).toBe(true);
     expect(opencodeConfig.$schema).toBe("https://opencode.ai/config.json");
     expect(opencodeConfig.mcp?.memory).toEqual({
       type: "local",
       command: ["bunx", "--bun", "@aitytech/agentkits-memory", "server"],
       enabled: true,
     });
     expect(memoryPlugin).toContain("Managed by agent-harness setup.");
     expect(memoryPlugin).toContain("experimental.chat.system.transform");
     expect(mermaidSkill).toContain(".agent-harness/diagrams/");

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
     expect(rewrittenGitignoreLines.filter((line) => line === ".agents/agent-harness-install.json")).toHaveLength(1);
  } finally {
    await rm(dryRunRoot, { force: true, recursive: true });
    await rm(installRoot, { force: true, recursive: true });
  }
});
