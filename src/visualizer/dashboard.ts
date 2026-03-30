import type { PrdCard, RunCard } from "./cards";

export type CardSummary = {
  done: number;
  in_progress: number;
  invalid: number;
  planned: number;
  tasksDone: number;
  tasksTotal: number;
  total: number;
};

export type VisibilityFilters = {
  showDemo: boolean;
  showTestFixture: boolean;
};

export const DEFAULT_VISIBILITY_FILTERS: VisibilityFilters = {
  showDemo: false,
  showTestFixture: false,
};

type WorkspaceEntry = {
  workspacePath: string;
};

export type RunGroup = {
  cards: PrdCard[];
  id: string;
  label: string;
  runs: RunCard[];
  summary: CardSummary;
  workspacePath: string;
};

function emptySummary(): CardSummary {
  return { done: 0, in_progress: 0, invalid: 0, planned: 0, tasksDone: 0, tasksTotal: 0, total: 0 };
}

export function summarizeCards(cards: PrdCard[]): CardSummary {
  return cards.reduce<CardSummary>((accumulator, card) => {
    accumulator.total += 1;
    accumulator.tasksDone += card.tasksDone;
    accumulator.tasksTotal += card.tasksTotal;
    accumulator[card.status] += 1;
    return accumulator;
  }, emptySummary());
}

export function countWorkspaces(runs: WorkspaceEntry[], cards: WorkspaceEntry[]): number {
  return new Set([...runs, ...cards].map((entry) => entry.workspacePath).filter((workspacePath) => workspacePath.length > 0)).size;
}

export function filterEntries<T extends { isDemo: boolean; isTestFixture: boolean }>(entries: T[], filters: VisibilityFilters): T[] {
  return entries.filter((entry) => {
    if (!filters.showDemo && entry.isDemo) {
      return false;
    }

    if (!filters.showTestFixture && entry.isTestFixture) {
      return false;
    }

    return true;
  });
}

export function summarizeHiddenItems(visibleCount: number, totalCount: number, label: string): string {
  if (totalCount <= visibleCount) {
    return `All ${label} visible`;
  }

  const hiddenCount = totalCount - visibleCount;
  return `${hiddenCount} hidden by filters`;
}

export function filterStatusMessage(filters: VisibilityFilters, counts: { visibleRuns: number; totalRuns: number; visibleCards: number; totalCards: number }): string {
  const defaultFiltersActive = !filters.showDemo || !filters.showTestFixture;

  if (!defaultFiltersActive) {
    return "All run and PRD categories are visible.";
  }

  const hiddenRuns = Math.max(0, counts.totalRuns - counts.visibleRuns);
  const hiddenCards = Math.max(0, counts.totalCards - counts.visibleCards);

  return `Default filters active: showing ${counts.visibleRuns}/${counts.totalRuns} runs and ${counts.visibleCards}/${counts.totalCards} PRDs with ${hiddenRuns} hidden run${hiddenRuns === 1 ? "" : "s"} and ${hiddenCards} hidden PRD${hiddenCards === 1 ? "" : "s"}.`;
}

function groupLabel(run: RunCard): string {
  return run.project || run.workspacePath || "Unknown project";
}

export function groupRunsByWorkspace(runs: RunCard[], cards: PrdCard[]): RunGroup[] {
  const groups = new Map<string, RunGroup>();

  for (const run of runs) {
    const groupId = run.workspacePath || `run:${run.fileName}`;
    const existing = groups.get(groupId);

    if (existing) {
      existing.runs.push(run);
      continue;
    }

    groups.set(groupId, {
      cards: [],
      id: groupId,
      label: groupLabel(run),
      runs: [run],
      summary: emptySummary(),
      workspacePath: run.workspacePath,
    });
  }

  for (const card of cards) {
    const groupId = card.workspacePath;
    const existing = groups.get(groupId);

    if (!existing) {
      continue;
    }

    existing.cards.push(card);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      runs: [...group.runs].sort((left, right) => right.lastTouchedAt - left.lastTouchedAt || left.fileName.localeCompare(right.fileName)),
      summary: summarizeCards(group.cards),
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.workspacePath.localeCompare(right.workspacePath));
}
