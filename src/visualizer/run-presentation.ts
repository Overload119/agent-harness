import type { RunCard } from "./cards";

export type RunStatusTone = "danger" | "neutral" | "running" | "success";
export type RunStatusKey = "completed" | "failed" | "running" | "stale" | "unknown";

export type RunStatusDisplay = {
  bg: string;
  fg: string;
  key: RunStatusKey;
  label: string;
  tone: RunStatusTone;
};

const RUN_STATUS_STYLES: Record<RunStatusKey, { bg: string; fg: string; label: string; tone: RunStatusTone }> = {
  completed: { bg: "#d6f5df", fg: "#146c2e", label: "Completed", tone: "success" },
  failed: { bg: "#f8d7da", fg: "#8a1c2b", label: "Failed", tone: "danger" },
  running: { bg: "#fde7c6", fg: "#9a5314", label: "Running", tone: "running" },
  stale: { bg: "#f8d7da", fg: "#8a1c2b", label: "Stale", tone: "danger" },
  unknown: { bg: "#d8e7ff", fg: "#1d4d8f", label: "Unknown", tone: "neutral" },
};

function isFailedRun(run: Pick<RunCard, "error" | "exitCode" | "status">): boolean {
  if (run.status === "failed") {
    return true;
  }

  if (typeof run.exitCode === "number" && run.exitCode !== 0) {
    return true;
  }

  return run.error.trim().length > 0;
}

export function runStatusDisplay(run: Pick<RunCard, "error" | "exitCode" | "isStale" | "status">): RunStatusDisplay {
  if (run.isStale) {
    return { key: "stale", ...RUN_STATUS_STYLES.stale };
  }

  if (isFailedRun(run)) {
    return { key: "failed", ...RUN_STATUS_STYLES.failed };
  }

  if (run.status === "running") {
    return { key: "running", ...RUN_STATUS_STYLES.running };
  }

  if (run.status === "completed") {
    return { key: "completed", ...RUN_STATUS_STYLES.completed };
  }

  return { key: "unknown", ...RUN_STATUS_STYLES.unknown };
}

export function countRunsByStatus(runs: RunCard[]): Record<RunStatusKey, number> {
  return runs.reduce<Record<RunStatusKey, number>>(
    (counts, run) => {
      counts[runStatusDisplay(run).key] += 1;
      return counts;
    },
    { completed: 0, failed: 0, running: 0, stale: 0, unknown: 0 },
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function formatRelativeTime(value: number, now = Date.now()): string {
  if (!value) {
    return "Unknown";
  }

  const diffMs = now - value;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }

  return new Date(value).toLocaleDateString();
}

export function formatDurationBetween(start: number, end: number): string {
  if (!start || !end || end < start) {
    return "Unknown";
  }

  return formatDuration(end - start);
}

export function formatRunDuration(run: Pick<RunCard, "completedAt" | "startedAt">, now = Date.now()): string {
  if (!run.startedAt) {
    return "Unknown";
  }

  return formatDurationBetween(run.startedAt, run.completedAt || now);
}
