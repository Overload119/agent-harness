import path from "node:path";

import { describe, expect, test } from "bun:test";

import { readRunState, writeRunState, type RunDocument } from "../../src/loop/state";
import { runRunStateCli } from "../../src/run-state/run";
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

describe("runRunStateCli", () => {
  test("updates an existing run file from CLI options", async () => {
    await withTempHomeFixture(async (fixture) => {
      const runPath = path.join(fixture.runsDir, "run.json");
      await writeRunState(runPath, createRunState({ logPath: path.join(fixture.logsDir, "run.log") }));

      await runRunStateCli([
        "bun",
        "ah-run-state",
        "update",
        "--run-file",
        runPath,
        "--phase",
        "verified",
        "--status",
        "completed",
        "--last-message",
        "CLI update complete",
        "--current-task-id",
        "US-005",
        "--iteration",
        "2",
        "--exit-code",
        "0",
        "--completed",
      ]);

      const updated = await readRunState(runPath);
      expect(updated.phase).toBe("verified");
      expect(updated.status).toBe("completed");
      expect(updated.lastMessage).toBe("CLI update complete");
      expect(updated.currentTaskId).toBe("US-005");
      expect(updated.iteration).toBe(2);
      expect(updated.exitCode).toBe(0);
      expect(updated.completedAt).not.toBe("");
    });
  });

  test("rejects invalid numeric CLI options", async () => {
    await withTempHomeFixture(async (fixture) => {
      const runPath = path.join(fixture.runsDir, "run.json");
      await writeRunState(runPath, createRunState());

      await expect(
        runRunStateCli(["bun", "ah-run-state", "update", "--run-file", runPath, "--iteration", "nope"]),
      ).rejects.toThrow("Invalid iteration: nope");

      await expect(
        runRunStateCli(["bun", "ah-run-state", "update", "--run-file", runPath, "--exit-code", "bad"]),
      ).rejects.toThrow("Invalid exit-code: bad");
    });
  });
});
