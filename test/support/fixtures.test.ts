import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";

import { describe, expect, test } from "bun:test";

import { homeHarnessRoot, homeHarnessSubdir, repoHarnessRoot, repoHarnessSubdir } from "../../src/harness/paths";
import { createRepoFixture, usesFixtureHome, usesFixtureRepo, withTempHomeFixture } from "./fixtures";

describe("test fixtures", () => {
  test("withTempHomeFixture redirects home-scoped harness paths", async () => {
    const realHome = os.homedir();

    await withTempHomeFixture(async (fixture) => {
      expect(homeHarnessRoot()).toBe(path.join(fixture.homeDir, ".agent-harness"));
      expect(homeHarnessSubdir("runs")).toBe(fixture.runsDir);
      expect(usesFixtureHome(fixture.homeDir)).toBe(true);
      expect(existsSync(fixture.runsDir)).toBe(true);
      expect(existsSync(fixture.logsDir)).toBe(true);
      expect(homeHarnessRoot()).not.toBe(path.join(realHome, ".agent-harness"));
    });

    expect(os.homedir()).toBe(realHome);
  });

  test("createRepoFixture builds repo-local harness directories for PRD fixtures", async () => {
    const fixture = await createRepoFixture();

    try {
      expect(repoHarnessRoot(fixture.rootDir)).toBe(fixture.harnessDir);
      expect(repoHarnessSubdir(fixture.rootDir, "prds")).toBe(fixture.prdsDir);
      expect(usesFixtureRepo(fixture.rootDir)).toBe(true);
      expect(existsSync(fixture.prdsDir)).toBe(true);
      expect(existsSync(fixture.diagramsDir)).toBe(true);
      expect(existsSync(fixture.logsDir)).toBe(true);

      const prdPath = await fixture.writeJson(path.join(".agent-harness", "prds", "sample.json"), {
        project: "Fixture PRD",
        tasks: [],
      });

      expect(prdPath).toBe(path.join(fixture.prdsDir, "sample.json"));
      expect(existsSync(prdPath)).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });
});
