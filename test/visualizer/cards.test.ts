import { describe, expect, test } from "bun:test";

import { classifyWorkspacePath, runCardFromDocument } from "../../src/visualizer/cards";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-03-24T12:00:00.000Z");
const STALE_CUTOFF = NOW - 7 * DAY_MS;

function isoAt(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

describe("visualizer run cards", () => {
  test("classifies demo and test fixture workspaces from path segments", () => {
    expect(classifyWorkspacePath("/Users/example/.agent-harness/demo-worktrees/agent-4")).toEqual({
      isDemo: true,
      isTestFixture: false,
    });

    expect(classifyWorkspacePath("/tmp/ah-test-visualizer-outside-123")).toEqual({
      isDemo: false,
      isTestFixture: true,
    });

    expect(classifyWorkspacePath("/Users/example/projects/real-repo")).toEqual({
      isDemo: false,
      isTestFixture: false,
    });
  });

  test("prefers the newest explicit timestamp over file mtime", () => {
    const staleFileMtime = NOW - 30 * DAY_MS;
    const heartbeatAt = isoAt(-2 * DAY_MS);
    const card = runCardFromDocument(
      "run.json",
      staleFileMtime,
      {
        completedAt: isoAt(-10 * DAY_MS),
        lastHeartbeatAt: heartbeatAt,
        startedAt: isoAt(-12 * DAY_MS),
      },
      "/tmp/worktree",
      STALE_CUTOFF,
    );

    expect(card.lastHeartbeatAt).toBe(Date.parse(heartbeatAt));
    expect(card.lastTouchedAt).toBe(Date.parse(heartbeatAt));
    expect(card.isStale).toBe(false);
    expect(card.isTestFixture).toBe(false);
  });

  test("treats completed runs as fresh when completedAt is the newest timestamp", () => {
    const completedAt = isoAt(-1 * DAY_MS);
    const card = runCardFromDocument(
      "run.json",
      NOW - 20 * DAY_MS,
      {
        completedAt,
        lastHeartbeatAt: isoAt(-9 * DAY_MS),
        startedAt: isoAt(-10 * DAY_MS),
        status: "completed",
      },
      "/tmp/worktree",
      STALE_CUTOFF,
    );

    expect(card.lastTouchedAt).toBe(Date.parse(completedAt));
    expect(card.isStale).toBe(false);
  });

  test("flags runs stale from explicit timestamps even when file mtime is fresh", () => {
    const card = runCardFromDocument(
      "run.json",
      NOW - 1 * DAY_MS,
      {
        completedAt: isoAt(-10 * DAY_MS),
        lastHeartbeatAt: isoAt(-9 * DAY_MS),
        startedAt: isoAt(-12 * DAY_MS),
      },
      "/tmp/worktree",
      STALE_CUTOFF,
    );

    expect(card.lastTouchedAt).toBe(Date.parse(isoAt(-9 * DAY_MS)));
    expect(card.isStale).toBe(true);
  });

  test("falls back to file mtime when timestamps are invalid", () => {
    const freshFileMtime = NOW - 2 * DAY_MS;
    const card = runCardFromDocument(
      "run.json",
      freshFileMtime,
      {
        completedAt: "not-a-date",
        lastHeartbeatAt: "still-not-a-date",
        startedAt: "",
      },
      "/tmp/worktree",
      STALE_CUTOFF,
    );

    expect(card.lastHeartbeatAt).toBe(0);
    expect(card.startedAt).toBe(0);
    expect(card.lastTouchedAt).toBe(freshFileMtime);
    expect(card.isStale).toBe(false);
  });
});
