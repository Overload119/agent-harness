import path from "node:path";
import process from "node:process";

import { repoHarnessSubdir } from "../harness/paths";
import type { SetupPaths } from "./types";

export function resolveSetupPaths(argv: string[]): SetupPaths {
  const scriptPath = path.resolve(argv[1]);
  const scriptDir = path.dirname(scriptPath);
  const repoRoot = path.resolve(scriptDir, "..");
  const sourceDir = path.join(repoRoot, "skills");
  const targetRoot = path.resolve(process.cwd());
  const targetAgentsDir = path.join(targetRoot, ".agents");
  const targetDiagramsDir = repoHarnessSubdir(targetRoot, "diagrams");
  const targetDir = path.join(targetAgentsDir, "skills");
  const targetLogsDir = repoHarnessSubdir(targetRoot, "logs");
  const metadataPath = path.join(targetAgentsDir, "agent-harness-install.json");

  return {
    metadataPath,
    repoRoot,
    sourceDir,
    targetAgentsDir,
    targetDiagramsDir,
    targetDir,
    targetLogsDir,
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
