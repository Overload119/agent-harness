import path from "node:path";
import { access, readFile, readdir } from "node:fs/promises";

import { describe, expect, test } from "bun:test";

import {
  appendRunLog,
  acquireWorktreeLock,
  ensureSharedStateDirs,
  locksDir,
  nowIso,
  readRunState,
  updateRunState,
  writeRunState,
  type RunDocument,
} from "../../src/loop/state";
import { withTempHomeFixture } from "../support/fixtures";

function createRunState(overrides: Partial<RunDocument> = {}): RunDocument {
  return {
    branchName: "ralph/testing",
    command: "bin/ah-loop .agent-harness/prds/testing.json",
    completedAt: "",
    currentTaskId: "US-001",
    error: "",
    exitCode: null,
    iteration: 1,
    lastHeartbeatAt: "2026-03-24T12:00:00.000Z",
    lastMessage: "Starting task",
    logPath: "/tmp/run.log",
    phase: "executing",
    pid: process.pid,
    prdPath: "/tmp/testing.json",
    project: "Testing Project",
    startedAt: "2026-03-24T11:59:00.000Z",
    status: "running",
    worktreePath: "/tmp/testing",
    ...overrides,
  };
}

describe("loop state helpers", () => {
  test("writes, reads, updates, and logs run state inside an isolated home harness", async () => {
    await withTempHomeFixture(async (fixture) => {
      await ensureSharedStateDirs();

      const runPath = path.join(fixture.runsDir, "state.json");
      const logPath = path.join(fixture.logsDir, "state.log");
      const state = createRunState({ logPath, worktreePath: fixture.rootDir });

      await writeRunState(runPath, state);
      expect(await readRunState(runPath)).toEqual(state);

      const updated = await updateRunState(
        runPath,
        {
          lastMessage: "Completed task",
          phase: "verified",
          status: "completed",
        },
        false,
      );

      expect(updated.lastHeartbeatAt).toBe(state.lastHeartbeatAt);
      expect(updated.phase).toBe("verified");
      expect(updated.status).toBe("completed");

      await appendRunLog(logPath, ["Processed %s", "state"]);
      expect(await readFile(logPath, "utf8")).toContain("Processed state");
      expect(await readdir(locksDir())).toEqual([]);
    });
  });

  test("rejects active locks and recovers when the existing run becomes stale", async () => {
    await withTempHomeFixture(async (fixture) => {
      const worktreePath = path.join(fixture.rootDir, "repo");
      const runAPath = path.join(fixture.runsDir, "run-a.json");

      const releaseRecovered = await (async () => {
        await acquireWorktreeLock({
          pid: process.pid,
          prdPath: "/tmp/a.json",
          runFile: "run-a.json",
          runId: "run-a",
          worktreePath,
        });

        await writeRunState(
          runAPath,
          createRunState({
            lastHeartbeatAt: nowIso(),
            prdPath: "/tmp/a.json",
            worktreePath,
          }),
        );

        await expect(
          acquireWorktreeLock({
            pid: process.pid,
            prdPath: "/tmp/b.json",
            runFile: "run-b.json",
            runId: "run-b",
            worktreePath,
          }),
        ).rejects.toThrow("already locked");

        await updateRunState(
          runAPath,
          {
            completedAt: nowIso(),
            status: "completed",
          },
          false,
        );

        return acquireWorktreeLock({
          pid: process.pid,
          prdPath: "/tmp/b.json",
          runFile: "run-b.json",
          runId: "run-b",
          worktreePath,
        });
      })();

      await releaseRecovered();
      await expect(access(path.join(locksDir(), "missing.lock.json"))).rejects.toThrow();
      expect(await readdir(locksDir())).toEqual([]);
    });
  });
});
