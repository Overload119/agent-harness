import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";

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

  test("withTempHomeFixture writes isolated home-scoped files and missing paths", async () => {
    await withTempHomeFixture(async (fixture) => {
      const staleRunPath = await fixture.writeJson(
        path.join(".agent-harness", "runs", "stale-run.json"),
        { status: "running" },
        { mtimeMs: Date.parse("2026-03-01T00:00:00.000Z") },
      );
      const notePath = await fixture.writeText(path.join("notes", "readme.txt"), "fixture note\n");
      const missingPath = fixture.missingPath(path.join(".agent-harness", "runs", "missing-run.json"));

      expect(await readFile(staleRunPath, "utf8")).toContain('"status": "running"');
      expect(await readFile(notePath, "utf8")).toBe("fixture note\n");
      expect((await stat(staleRunPath)).mtime.toISOString()).toBe("2026-03-01T00:00:00.000Z");
      expect(existsSync(missingPath)).toBe(false);
      expect(missingPath.startsWith(fixture.rootDir)).toBe(true);
    });
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

      const brokenPath = await fixture.writeMalformedJson(path.join(".agent-harness", "prds", "broken.json"));
      const partialPath = await fixture.writePartialJson(path.join(".agent-harness", "runs", "partial-run.json"), {
        status: "running",
      });
      const staleLogPath = await fixture.writeText(
        path.join(".agent-harness", "logs", "stale.log"),
        "stale log\n",
        { mtimeMs: Date.parse("2026-02-01T00:00:00.000Z") },
      );

      expect(await readFile(brokenPath, "utf8")).toBe('{"broken": true');
      expect(await readFile(partialPath, "utf8")).toContain('"status": "running"');
      expect((await stat(staleLogPath)).mtime.toISOString()).toBe("2026-02-01T00:00:00.000Z");
      expect(existsSync(fixture.missingPath(path.join(".agent-harness", "prds", "missing.json")))).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });
});
