import path from "node:path";

import { describe, expect, test } from "bun:test";

import { homeHarnessRoot, homeHarnessSubdir, repoHarnessRoot, repoHarnessSubdir } from "../../src/harness/paths";
import { withTempHomeFixture } from "../support/fixtures";

describe("harness paths", () => {
  test("builds home-scoped harness paths from the current HOME", async () => {
    await withTempHomeFixture(async (fixture) => {
      expect(homeHarnessRoot()).toBe(path.join(fixture.homeDir, ".agent-harness"));
      expect(homeHarnessSubdir("runs", "active.json")).toBe(path.join(fixture.homeDir, ".agent-harness", "runs", "active.json"));
    });
  });

  test("builds repo-local harness paths from the repo root", () => {
    const repoRoot = "/tmp/agent-harness-worktree";

    expect(repoHarnessRoot(repoRoot)).toBe(path.join(repoRoot, ".agent-harness"));
    expect(repoHarnessSubdir(repoRoot, "prds", "sample.json")).toBe(
      path.join(repoRoot, ".agent-harness", "prds", "sample.json"),
    );
  });
});
