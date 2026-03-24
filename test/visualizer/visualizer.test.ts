import { describe, expect, test } from "bun:test";

import type { PrdCard, RunCard } from "../../src/visualizer/cards";
import { DEFAULT_VISIBILITY_FILTERS, countWorkspaces, filterEntries, filterStatusMessage, summarizeCards, summarizeHiddenItems } from "../../src/visualizer/dashboard";

function createCard(overrides: Partial<PrdCard> = {}): PrdCard {
  return {
    branchName: "feature/example",
    description: "Example card",
    fileName: "example.json",
    invalidReason: "",
    isDemo: false,
    isTestFixture: false,
    lastModified: Date.now(),
    nextTask: "Ship it",
    project: "Example",
    status: "planned",
    tasksDone: 0,
    tasksTotal: 1,
    workspacePath: "/tmp/example",
    ...overrides,
  };
}

function createRun(overrides: Partial<RunCard> = {}): RunCard {
  return {
    branchName: "feature/example",
    command: "bun test",
    currentTaskId: "US-001",
    error: "",
    fileName: "run.json",
    isDemo: false,
    isStale: false,
    isTestFixture: false,
    iteration: 1,
    lastHeartbeatAt: 0,
    lastMessage: "",
    lastTouchedAt: 0,
    logPath: "",
    phase: "executing",
    pid: 123,
    prdPath: "/tmp/example/.agent-harness/prds/example.json",
    project: "Example",
    startedAt: 0,
    status: "running",
    workspacePath: "/tmp/example",
    ...overrides,
  };
}

describe("visualizer dashboard helpers", () => {
  test("summarizes visible PRD status and task totals", () => {
    const summary = summarizeCards([
      createCard({ status: "done", tasksDone: 3, tasksTotal: 3 }),
      createCard({ fileName: "active.json", status: "in_progress", tasksDone: 1, tasksTotal: 4 }),
      createCard({ fileName: "invalid.json", status: "invalid", tasksDone: 0, tasksTotal: 0 }),
    ]);

    expect(summary).toEqual({
      done: 1,
      in_progress: 1,
      invalid: 1,
      planned: 0,
      tasksDone: 4,
      tasksTotal: 7,
      total: 3,
    });
  });

  test("counts visible workspaces across runs and cards without duplicates", () => {
    const workspaces = countWorkspaces(
      [createRun({ workspacePath: "/tmp/a" }), createRun({ fileName: "run-b.json", workspacePath: "/tmp/b" })],
      [createCard({ workspacePath: "/tmp/b" }), createCard({ fileName: "card-c.json", workspacePath: "/tmp/c" })],
    );

    expect(workspaces).toBe(3);
  });

  test("reports hidden item counts when filters remove entries", () => {
    expect(summarizeHiddenItems(3, 5, "runs")).toBe("2 hidden by filters");
    expect(summarizeHiddenItems(5, 5, "runs")).toBe("All runs visible");
  });

  test("describes when default filters hide runs and PRDs", () => {
    expect(
      filterStatusMessage(
        { showDemo: false, showTestFixture: true },
        { visibleRuns: 2, totalRuns: 5, visibleCards: 3, totalCards: 4 },
      ),
    ).toBe("Default filters active: showing 2/5 runs and 3/4 PRDs with 3 hidden runs and 1 hidden PRD.");

    expect(
      filterStatusMessage(
        { showDemo: true, showTestFixture: true },
        { visibleRuns: 5, totalRuns: 5, visibleCards: 4, totalCards: 4 },
      ),
    ).toBe("All run and PRD categories are visible.");
  });

  test("hides demo and fixture entries by default without changing underlying totals", () => {
    const runs = [
      createRun({ fileName: "run-demo.json", isDemo: true }),
      createRun({ fileName: "run-fixture.json", isTestFixture: true }),
      createRun({ fileName: "run-real.json" }),
    ];
    const cards = [
      createCard({ fileName: "card-demo.json", isDemo: true, tasksDone: 1, tasksTotal: 1 }),
      createCard({ fileName: "card-fixture.json", isTestFixture: true, tasksDone: 2, tasksTotal: 3 }),
      createCard({ fileName: "card-real.json", tasksDone: 3, tasksTotal: 5 }),
    ];

    const visibleRuns = filterEntries(runs, DEFAULT_VISIBILITY_FILTERS);
    const visibleCards = filterEntries(cards, DEFAULT_VISIBILITY_FILTERS);

    expect(runs).toHaveLength(3);
    expect(cards).toHaveLength(3);
    expect(visibleRuns.map((run) => run.fileName)).toEqual(["run-real.json"]);
    expect(visibleCards.map((card) => card.fileName)).toEqual(["card-real.json"]);
    expect(summarizeCards(cards).tasksTotal).toBe(9);
    expect(summarizeCards(visibleCards).tasksTotal).toBe(5);
  });

  test("reveals hidden entries when filter chips are toggled on", () => {
    const entries = [
      createRun({ fileName: "run-demo.json", isDemo: true }),
      createRun({ fileName: "run-fixture.json", isTestFixture: true }),
      createRun({ fileName: "run-real.json" }),
    ];

    expect(filterEntries(entries, DEFAULT_VISIBILITY_FILTERS).map((entry) => entry.fileName)).toEqual(["run-real.json"]);
    expect(filterEntries(entries, { showDemo: true, showTestFixture: false }).map((entry) => entry.fileName)).toEqual([
      "run-demo.json",
      "run-real.json",
    ]);
    expect(filterEntries(entries, { showDemo: false, showTestFixture: true }).map((entry) => entry.fileName)).toEqual([
      "run-fixture.json",
      "run-real.json",
    ]);
    expect(filterEntries(entries, { showDemo: true, showTestFixture: true }).map((entry) => entry.fileName)).toEqual([
      "run-demo.json",
      "run-fixture.json",
      "run-real.json",
    ]);
  });
});
