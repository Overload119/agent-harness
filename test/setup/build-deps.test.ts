import { expect, test } from "bun:test";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { pathExists } from "../../src/setup/fs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

async function createTargetRepo(prefix: string): Promise<string> {
  const base = path.join(os.tmpdir(), ".agent-harness", REPO_ROOT.replace(/^\//, "").replace(/\//g, "-"));
  await mkdir(base, { recursive: true });
  return mkdtemp(path.join(base, prefix));
}

test("setup requires bun install before building harness CLIs", async () => {
  const targetRoot = await createTargetRepo("ah-setup-bun-install-");

  try {
    const installScriptPath = path.join(REPO_ROOT, "install.sh");
    expect(await pathExists(installScriptPath)).toBe(true);

    const binSetupPath = path.join(REPO_ROOT, "bin", "setup");
    expect(await pathExists(binSetupPath)).toBe(true);

    const scriptsBuildPath = path.join(REPO_ROOT, "scripts", "build.ts");
    expect(await pathExists(scriptsBuildPath)).toBe(true);

    const result = Bun.spawnSync({
      cmd: ["bash", "-c", `${binSetupPath} --yes`],
      cwd: targetRoot,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = Buffer.from(result.stderr).toString("utf8");
    const stdout = Buffer.from(result.stdout).toString("utf8");
    const combinedOutput = stdout + stderr;

    expect(result.exitCode).toBe(0), `Expected exit code 0 but got ${result.exitCode}. Output: ${combinedOutput}`;
    expect(combinedOutput).toContain("building harness CLIs");
    expect(combinedOutput).not.toContain("Could not resolve");
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});