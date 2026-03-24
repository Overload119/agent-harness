import { afterEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { access, writeFile } from "node:fs/promises";

import { readVisualizerServerState, writeVisualizerServerState } from "../../src/visualizer/server-state";
import { createVisualizerApp, runVisualizerCli } from "../../src/visualizer/run";
import { createRepoFixture, withTempHomeFixture } from "../support/fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-03-24T12:00:00.000Z");
const API_PRDS_ROUTE = "/__ah_vis__/api/prds";
const API_RUNS_ROUTE = "/__ah_vis__/api/runs";

const originalDateNow = Date.now;

function isoAt(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

afterEach(() => {
  Date.now = originalDateNow;
});

describe("visualizer run deletion route", () => {
  test("reports a lightweight health response", async () => {
    await withTempHomeFixture(async ({ rootDir }) => {
      const app = createVisualizerApp(rootDir, () => {}, rootDir);
      const response = await app.request("/__ah_vis__/health");

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ ok: true });
    });
  });

  test("rejects invalid file names and path traversal attempts", async () => {
    await withTempHomeFixture(async ({ rootDir }) => {
      const app = createVisualizerApp(rootDir, () => {}, rootDir);

      for (const fileName of ["", "../stale-run.json", "..\\stale-run.json", "nested/stale-run.json", "stale-run.txt"]) {
        const response = await app.request(`${API_RUNS_ROUTE}?file=${encodeURIComponent(fileName)}`, {
          method: "DELETE",
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          deleted: false,
          error: "Invalid run file name.",
        });
      }
    });
  });

  test("deletes one stale run file and the snapshot immediately drops its workspace", async () => {
    Date.now = () => NOW;

    await withTempHomeFixture(async ({ rootDir, runsDir }) => {
      const scopeRoot = path.join(rootDir, "workspace-root");
      const repoA = await createRepoFixture("ah-test-run-delete-a-", { parentDir: scopeRoot });
      const repoB = await createRepoFixture("ah-test-run-delete-b-", { parentDir: scopeRoot });

      try {
        await repoA.writeJson(path.join(".agent-harness", "prds", "alpha.json"), {
          project: "Alpha Project",
          tasks: [{ id: "A-1", passes: false }],
        });

        await repoB.writeJson(path.join(".agent-harness", "prds", "beta.json"), {
          project: "Beta Project",
          tasks: [{ id: "B-1", passes: true }],
        });

        await writeFile(
          path.join(runsDir, "stale-run.json"),
          `${JSON.stringify({
            currentTaskId: "US-004",
            lastHeartbeatAt: isoAt(-10 * DAY_MS),
            project: "Stale Alpha Run",
            status: "running",
            worktreePath: repoA.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "fresh-run.json"),
          `${JSON.stringify({
            currentTaskId: "US-004",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Fresh Beta Run",
            status: "running",
            worktreePath: repoB.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        const app = createVisualizerApp(rootDir, () => {}, scopeRoot);
        const deleteResponse = await app.request(`${API_RUNS_ROUTE}?file=stale-run.json`, {
          method: "DELETE",
        });

        expect(deleteResponse.status).toBe(200);
        expect(await deleteResponse.json()).toEqual({
          deleted: true,
          fileName: "stale-run.json",
        });

        await expect(access(path.join(runsDir, "stale-run.json"))).rejects.toThrow();
        await expect(access(path.join(runsDir, "fresh-run.json"))).resolves.toBeNull();

        const snapshotResponse = await app.request(API_PRDS_ROUTE);
        expect(snapshotResponse.status).toBe(200);

        const snapshot = await snapshotResponse.json();
        expect(snapshot.runs).toHaveLength(1);
        expect(snapshot.runs[0]?.fileName).toBe("fresh-run.json");
        expect(snapshot.workspaceCount).toBe(1);
        expect(snapshot.staleRunCount).toBe(0);
        expect(snapshot.cards).toHaveLength(1);
        expect(snapshot.cards[0]?.fileName).toBe("beta.json");
        expect(snapshot.cards[0]?.workspacePath).toBe(repoB.rootDir);
      } finally {
        await repoA.cleanup();
        await repoB.cleanup();
      }
    });
  });

  test("returns a clear not-found response for missing run files", async () => {
    await withTempHomeFixture(async ({ rootDir }) => {
      const app = createVisualizerApp(rootDir, () => {}, rootDir);
      const response = await app.request(`${API_RUNS_ROUTE}?file=missing-run.json`, {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        deleted: false,
        error: "Run file not found.",
      });
    });
  });

  test("api snapshot includes shared runs and PRDs outside the launch directory", async () => {
    Date.now = () => NOW;

    await withTempHomeFixture(async ({ rootDir, runsDir }) => {
      const scopeRoot = path.join(rootDir, "workspace-root");
      const inScopeRepo = await createRepoFixture("ah-test-run-scope-in-", { parentDir: scopeRoot });
      const outOfScopeRepo = await createRepoFixture("ah-test-run-scope-out-");
      const demoWorktreePath = path.join(rootDir, "home", ".agent-harness", "demo-worktrees", "agent-4");

      try {
        await inScopeRepo.writeJson(path.join(".agent-harness", "prds", "inside.json"), {
          project: "Inside Project",
          tasks: [{ id: "I-1", passes: false }],
        });

        await outOfScopeRepo.writeJson(path.join(".agent-harness", "prds", "outside.json"), {
          project: "Outside Project",
          tasks: [{ id: "O-1", passes: false }],
        });

        await writeFile(
          path.join(runsDir, "inside-run.json"),
          `${JSON.stringify({
            currentTaskId: "US-101",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Inside Run",
            status: "running",
            worktreePath: inScopeRepo.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "outside-run.json"),
          `${JSON.stringify({
            currentTaskId: "US-102",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Outside Run",
            status: "running",
            worktreePath: outOfScopeRepo.rootDir,
          }, null, 2)}\n`,
          "utf8",
        );

        await writeFile(
          path.join(runsDir, "demo-run.json"),
          `${JSON.stringify({
            currentTaskId: "US-103",
            lastHeartbeatAt: isoAt(-1 * DAY_MS),
            project: "Demo Run",
            status: "running",
            worktreePath: demoWorktreePath,
          }, null, 2)}\n`,
          "utf8",
        );

        const app = createVisualizerApp(rootDir, () => {}, scopeRoot);
        const snapshotResponse = await app.request(API_PRDS_ROUTE);

        expect(snapshotResponse.status).toBe(200);

        const snapshot = await snapshotResponse.json();
        expect(snapshot.runs).toHaveLength(3);
        expect(snapshot.runs.map((run: { fileName: string }) => run.fileName).sort()).toEqual([
          "demo-run.json",
          "inside-run.json",
          "outside-run.json",
        ]);
        expect(snapshot.workspaceCount).toBe(3);
        expect(snapshot.staleRunCount).toBe(0);
        expect(snapshot.cards).toHaveLength(2);
        expect(snapshot.cards.map((card: { fileName: string }) => card.fileName).sort()).toEqual([
          "inside.json",
          "outside.json",
        ]);
      } finally {
        await inScopeRepo.cleanup();
        await outOfScopeRepo.cleanup();
      }
    });
  });

  test("reopens an existing healthy visualizer without rebuilding or starting a new server", async () => {
    await withTempHomeFixture(async ({ rootDir }) => {
      const existingUrl = "http://127.0.0.1:4311/__ah_vis__/";
      const calls = {
        build: 0,
        installLogs: 0,
        open: [] as string[],
        serve: 0,
      };

      await writeVisualizerServerState({
        pid: 9001,
        port: 4311,
        recordedAt: isoAt(0),
        url: existingUrl,
      });

      await runVisualizerCli([process.execPath, path.join(rootDir, "bin", "ah-vis")], {
        buildVisualizer: async () => {
          calls.build += 1;
        },
        fetch: async (input) => {
          expect(String(input)).toBe("http://127.0.0.1:4311/__ah_vis__/health");
          return Response.json({ ok: true });
        },
        installVisualizerConsoleMirroring: async () => {
          calls.installLogs += 1;
          return path.join(rootDir, "ah-vis.log");
        },
        openUrl: async (url) => {
          calls.open.push(url);
        },
        serve: () => {
          calls.serve += 1;
          return {
            port: 0,
            stop: () => {},
          };
        },
      });

      expect(calls).toEqual({
        build: 0,
        installLogs: 0,
        open: [existingUrl],
        serve: 0,
      });
      expect(await readVisualizerServerState()).toEqual({
        pid: 9001,
        port: 4311,
        recordedAt: isoAt(0),
        url: existingUrl,
      });
    });
  });

  test("replaces stale server metadata when the recorded visualizer is unreachable", async () => {
    await withTempHomeFixture(async ({ rootDir }) => {
      const staleUrl = "http://127.0.0.1:4311/__ah_vis__/";
      const freshUrl = "http://127.0.0.1:4322/__ah_vis__/";
      const calls = {
        build: 0,
        installLogs: 0,
        open: [] as string[],
        serve: 0,
      };
      let servedFetch: ((request: Request) => Response | Promise<Response>) | null = null;
      let stateSeenDuringOpen: Awaited<ReturnType<typeof readVisualizerServerState>> = null;

      await writeVisualizerServerState({
        pid: 9001,
        port: 4311,
        recordedAt: isoAt(-DAY_MS),
        url: staleUrl,
      });

      await runVisualizerCli([process.execPath, path.join(rootDir, "bin", "ah-vis")], {
        buildVisualizer: async (harnessRoot, buildDir) => {
          calls.build += 1;
          expect(harnessRoot).toBe(rootDir);
          expect(buildDir).toBe(path.join(rootDir, ".generated", "visualizer"));
        },
        fetch: async () => {
          throw new Error("connection refused");
        },
        installVisualizerConsoleMirroring: async () => {
          calls.installLogs += 1;
          return path.join(rootDir, "ah-vis.log");
        },
        openUrl: async (url) => {
          calls.open.push(url);
          stateSeenDuringOpen = await readVisualizerServerState();
          expect(url).toBe(freshUrl);
          expect(servedFetch).not.toBeNull();
          await servedFetch?.(new Request(`${freshUrl}shutdown`, { method: "POST" }));
        },
        serve: (options) => {
          calls.serve += 1;
          servedFetch = options.fetch;
          return {
            port: 4322,
            stop: () => {},
          };
        },
      });

      expect(calls).toEqual({
        build: 1,
        installLogs: 1,
        open: [freshUrl],
        serve: 1,
      });
      expect(stateSeenDuringOpen).toEqual({
        pid: process.pid,
        port: 4322,
        recordedAt: expect.any(String),
        url: freshUrl,
      });
      expect(await readVisualizerServerState()).toBeNull();
    });
  });
});
