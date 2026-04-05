import path from "node:path";
import process from "node:process";

import { homeHarnessRoot, repoHarnessSubdir } from "../harness/paths";
import type { SetupPaths } from "./types";

export function resolveSetupPaths(argv: string[], globalInstall = false): SetupPaths {
  const scriptPath = path.resolve(argv[1]);
  const scriptDir = path.dirname(scriptPath);
  let repoRoot = path.resolve(scriptDir, "..");
  if (path.basename(repoRoot) === ".agent-harness") {
    repoRoot = path.resolve(repoRoot, "..");
  }
  const sourceDir = path.join(repoRoot, "skills");
  const targetRoot = globalInstall ? homeHarnessRoot() : path.resolve(process.cwd());
  const targetAgentsDir = path.join(targetRoot, ".agents");
  const targetBinDir = globalInstall ? path.join(targetRoot, "bin") : repoHarnessSubdir(targetRoot, "bin");
  const targetDiagramsDir = globalInstall ? path.join(targetRoot, "diagrams") : repoHarnessSubdir(targetRoot, "diagrams");
  const targetDir = path.join(targetAgentsDir, "skills");
  const targetLogsDir = globalInstall ? path.join(targetRoot, "logs") : repoHarnessSubdir(targetRoot, "logs");
  const targetMemoryDir = globalInstall ? path.join(targetRoot, "memory") : repoHarnessSubdir(targetRoot, "memory");
  const metadataPath = path.join(targetAgentsDir, "agent-harness-install.json");

  return {
    metadataPath,
    repoRoot,
    sourceDir,
    targetAgentsDir,
    targetBinDir,
    targetDiagramsDir,
    targetDir,
    targetLogsDir,
    targetMemoryDir,
    targetRoot,
  };
}

export function currentCommit(repoRoot: string): string {
  const result = Bun.spawnSync({
    cmd: ["git", "-C", repoRoot, "rev-parse", "HEAD"],
    stdout: "pipe",
    stderr: "ignore",
  });

  if (result.exitCode !== 0) {
    return "";
  }

  return Buffer.from(result.stdout).toString("utf8").trim();
}

export function managedSkillTargetPath(skillName: string): string {
  return `.agents/skills/${skillName}`;
}
