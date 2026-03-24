import path from "node:path";
import { readFile, readdir } from "node:fs/promises";

import { describe, expect, test } from "bun:test";

import { runLoopCli } from "../../src/loop/run";
import { locksDir, readRunState, runFileName } from "../../src/loop/state";
import { createRepoFixture, withTempHomeFixture } from "../support/fixtures";

describe("runLoopCli", () => {
  test("completes immediately when the PRD has no remaining tasks", async () => {
    await withTempHomeFixture(async (fixture) => {
      const repo = await createRepoFixture();

      try {
        const prdPath = await repo.writeJson(path.join(".agent-harness", "prds", "completed.json"), {
          branchName: "ralph/completed-loop",
          project: "Completed Loop",
          tasks: [{ id: "US-001", passes: true }],
        });

        await runLoopCli([
          "bun",
          "ah-loop",
          prdPath,
          "--run-id",
          "loopdone",
          "--worktree-path",
          repo.rootDir,
          "--heartbeat-ms",
          "50",
        ]);

        const runPath = path.join(fixture.runsDir, runFileName("Completed Loop", "loopdone"));
        const state = await readRunState(runPath);
        const logPath = path.join(fixture.logsDir, "loopdone.log");

        expect(state.status).toBe("completed");
        expect(state.phase).toBe("completed");
        expect(state.exitCode).toBe(0);
        expect(state.currentTaskId).toBe("");
        expect(state.worktreePath).toBe(repo.rootDir);
        expect(await readFile(logPath, "utf8")).toContain("All PRD tasks completed.");
        expect(await readdir(locksDir())).toEqual([]);
      } finally {
        await repo.cleanup();
      }
    });
  });

  test("fails cleanly when the PRD file is missing", async () => {
    await withTempHomeFixture(async (fixture) => {
      const missingPrdPath = fixture.missingPath(path.join("repo", ".agent-harness", "prds", "missing.json"));

      await expect(
        runLoopCli(["bun", "ah-loop", missingPrdPath, "--run-id", "missing", "--worktree-path", fixture.rootDir]),
      ).rejects.toThrow();

      expect(await readdir(fixture.runsDir)).toEqual([]);
    });
  });
});
