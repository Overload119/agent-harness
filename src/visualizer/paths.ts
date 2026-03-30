import path from "node:path";

export function harnessRootFromArgv(argv: string[]): string {
  const scriptPath = path.resolve(argv[1]);
  const scriptDir = path.dirname(scriptPath);
  let repoRoot = path.resolve(scriptDir, "..");
  if (path.basename(repoRoot) === ".agent-harness") {
    repoRoot = path.resolve(repoRoot, "..");
  }
  return repoRoot;
}
