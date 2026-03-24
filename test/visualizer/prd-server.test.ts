import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { chmod, writeFile } from "node:fs/promises";

import { loadVisualizerSnapshot } from "../../src/visualizer/prd-server";
import { createRepoFixture, withTempHomeFixture } from "../support/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-03-24T12:00:00.000Z");

function isoAt(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

afterEach(() => {
  Date.now = originalDateNow;
});

const originalDateNow = Date.now;

describe("loadVisualizerSnapshot", () => {
  test("returns all valid runs and referenced PRDs from the shared harness snapshot", async () => {
    Date.now = () => NOW;

    await withTempHomeFixture(async ({ rootDir, runsDir }) => {
      const scopeRoot = path.join(rootDir, "workspace-root");
      const repoA = await createRepoFixture("ah-test-visualizer-a-", { parentDir: scopeRoot });
      const repoB = await createRepoFixture("ah-test-visualizer-b-", { parentDir: scopeRoot });
      const outsideRepo = await createRepoFixture("ah-test-visualizer-outside-");
      const demoWorktreePath = path.join(rootDir, "home", ".agent-harness", "demo-worktrees", "agent-4");
      const unreadablePath = path.join(repoB.prdsDir, "unreadable.json");

      try {
        await repoA.writeJson(path.join(".agent-harness", "prds", "alpha.json"), {
          branchName: "feature/alpha",
          project: "Alpha Project",
          tasks: [{ id: "A-1", passes: true }, { id: "A-2", passes: false, title: "Ship alpha" }],
        });

        await repoB.writeJson(path.join(".agent-harness", "prds", "beta.json"), {
          branchName: "feature/beta",
          project: "Beta Project",
          tasks: [{ id: "B-1", passes: false, title: "Finish beta" }],
        });

        await writeFile(path.join(repoB.prdsDir, "broken.json"), '{"project": "Broken JSON"', "utf8");
        await writeFile(unreadablePath, '{"project": "Unreadable JSON"}\n', "utf8");
        await chmod(unreadablePath, 0);
        await outsideRepo.writeJson(path.join(".agent-harness", "prds", "outside.json"), {
          branchName: "feature/outside",
          project: "Outside Project",
          tasks: [{ id: "O-1", passes: false, title: "Outside task" }],
        });

        await writeFile(
          path.join(runsDir, "run-a.json"),
          `${JSON.stringify({
            currentTaskId: "US-003",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Alpha Run",
            status: "running",
            worktreePath: repoA.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "run-b.json"),
          `${JSON.stringify({
            currentTaskId: "US-003",
            project: "Beta Run",
            startedAt: isoAt(-10 * DAY_MS),
            status: "running",
            workspacePath: repoB.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "run-c.json"),
          `${JSON.stringify({
            completedAt: isoAt(-2 * DAY_MS),
            project: "Alpha Completed Run",
            repoPath: repoA.rootDir,
            status: "completed",
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "run-demo.json"),
          `${JSON.stringify({
            currentTaskId: "US-999",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Demo Worktree Run",
            status: "running",
            worktreePath: demoWorktreePath,
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "run-outside.json"),
          `${JSON.stringify({
            currentTaskId: "US-998",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Outside Fixture Run",
            status: "running",
            worktreePath: outsideRepo.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        const snapshot = await loadVisualizerSnapshot({ scopeRoot });

        expect(snapshot.harnessRoot).toContain(".agent-harness");
        expect(snapshot.runs).toHaveLength(5);
        expect(snapshot.workspaceCount).toBe(4);
        expect(snapshot.staleRunCount).toBe(1);
        expect(snapshot.cards).toHaveLength(5);
        expect(snapshot.cards.map((card) => card.fileName).sort()).toEqual([
          "alpha.json",
          "beta.json",
          "broken.json",
          "outside.json",
          "unreadable.json",
        ]);

        const invalidCards = snapshot.cards.filter((card) => card.status === "invalid");
        expect(invalidCards).toHaveLength(2);
        expect(invalidCards.map((card) => card.fileName).sort()).toEqual(["broken.json", "unreadable.json"]);
        expect(invalidCards.every((card) => card.workspacePath === repoB.rootDir)).toBe(true);
        expect(snapshot.runs.some((run) => run.workspacePath === outsideRepo.rootDir)).toBe(true);
        expect(snapshot.runs.some((run) => run.workspacePath === demoWorktreePath)).toBe(true);
        expect(snapshot.cards.some((card) => card.fileName === "outside.json")).toBe(true);
      } finally {
        await chmod(unreadablePath, 0o644).catch(() => {});
        await repoA.cleanup();
        await repoB.cleanup();
        await outsideRepo.cleanup();
      }
    });
  });
});
