import os from "node:os";
import path from "node:path";

export const HARNESS_DIR_NAME = ".agent-harness";

function resolveHomeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
}

export function homeHarnessRoot(): string {
  return path.join(resolveHomeDir(), HARNESS_DIR_NAME);
}

export function repoHarnessRoot(rootDir: string): string {
  return path.join(rootDir, HARNESS_DIR_NAME);
}

export function repoHarnessSubdir(rootDir: string, ...segments: string[]): string {
  return path.join(repoHarnessRoot(rootDir), ...segments);
}

export function homeHarnessSubdir(...segments: string[]): string {
  return path.join(homeHarnessRoot(), ...segments);
}
