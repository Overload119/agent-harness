import { expect, test } from "bun:test";
import { ensureGitignoreEntry } from "../../src/setup/gitignore";
import { createRepoFixture } from "../support/fixtures";

test("setup ignores only its local manifest, preserves consumer rules, and is idempotent", async () => {
  const fixture = await createRepoFixture("ah-manifest-ignore-");
  try {
    const original = "# Consumer rules\nprivate-output/\n";
    await fixture.writeText(".gitignore", original);
    const manifest = await fixture.writeText(".agents/agent-harness-install.json", "{}");
    await fixture.writeText(".agents/skills/custom/SKILL.md", "Consumer skill");
    await fixture.writeText(".agents/settings.json", "{}");
    const git = (...args: string[]) => Bun.spawnSync(["git", ...args], {
      cwd: fixture.rootDir, stdout: "pipe", stderr: "pipe",
    });
    expect(git("init").exitCode).toBe(0);
    expect(git("add", ".agents/agent-harness-install.json").exitCode).toBe(0);
    expect(await ensureGitignoreEntry(fixture.rootDir, true)).toBe(true);
    expect(await Bun.file(fixture.filePath(".gitignore")).text()).toBe(original);
    expect(await ensureGitignoreEntry(fixture.rootDir, false)).toBe(true);
    expect(await ensureGitignoreEntry(fixture.rootDir, false)).toBe(false);
    expect(await Bun.file(fixture.filePath(".gitignore")).text()).toStartWith(original);
    expect(git("check-ignore", "--no-index", ".agents/agent-harness-install.json").exitCode).toBe(0);
    for (const file of [".agents/skills/custom/SKILL.md", ".agents/settings.json"]) {
      expect(git("check-ignore", "--no-index", file).exitCode).toBe(1);
    }
    // Ignore rules do not silently remove previously tracked consumer state.
    expect(git("ls-files", "--error-unmatch", ".agents/agent-harness-install.json").exitCode).toBe(0);
    expect(await Bun.file(manifest).text()).toBe("{}");
  } finally { await fixture.cleanup(); }
});
