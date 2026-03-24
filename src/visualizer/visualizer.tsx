import * as React from "react";

import { type PrdCard, type RunCard } from "./cards";
import { DEFAULT_VISIBILITY_FILTERS, countWorkspaces, filterEntries, filterStatusMessage, summarizeCards, summarizeHiddenItems, type CardSummary, type VisibilityFilters } from "./dashboard";

const CLOCK_MS = 1000;
const POLL_MS = 2000;
const API_PRDS_ROUTE = "/__ah_vis__/api/prds";
const API_RUNS_ROUTE = "/__ah_vis__/api/runs";
const API_RUNS_VIEW_ROUTE = "/__ah_vis__/api/runs/view";
const SHUTDOWN_ROUTE = "/__ah_vis__/shutdown";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "32px",
  background: "linear-gradient(135deg, #f7f3ea 0%, #efe7d8 50%, #e4ddd2 100%)",
  color: "#1f2933",
  fontFamily: '"IBM Plex Sans", "Avenir Next", sans-serif',
};

const shellStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  display: "grid",
  gap: "24px",
};

const panelStyle: React.CSSProperties = {
  background: "rgba(255, 252, 246, 0.82)",
  border: "1px solid rgba(31, 41, 51, 0.12)",
  borderRadius: "24px",
  boxShadow: "0 20px 60px rgba(62, 51, 39, 0.12)",
  backdropFilter: "blur(16px)",
};

const heroStyle: React.CSSProperties = {
  ...panelStyle,
  padding: "28px",
  display: "grid",
  gap: "16px",
};

const cardsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "18px",
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "999px",
  padding: "12px 18px",
  background: "#1f2933",
  color: "#fffaf1",
  cursor: "pointer",
  fontWeight: 600,
};

const quietButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "rgba(31, 41, 51, 0.08)",
  color: "#1f2933",
};

const closeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#8a1c2b",
};

const filterChipStyle: React.CSSProperties = {
  borderRadius: "999px",
  border: "1px solid rgba(31, 41, 51, 0.14)",
  padding: "10px 14px",
  background: "rgba(255, 252, 246, 0.9)",
  color: "#1f2933",
  cursor: "pointer",
  fontWeight: 600,
};

const clockCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: "18px 20px",
  minWidth: "260px",
  justifySelf: "end",
};

async function loadPrdCardsFromApi(): Promise<{ cards: PrdCard[]; harnessRoot: string; runs: RunCard[]; staleRunCount: number; workspaceCount: number }> {
  const response = await fetch(API_PRDS_ROUTE, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load PRDs: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<{ cards: PrdCard[]; harnessRoot: string; runs: RunCard[]; staleRunCount: number; workspaceCount: number }>;
}

async function deletePrdFromApi(fileName: string, workspacePath: string): Promise<void> {
  const response = await fetch(`${API_PRDS_ROUTE}?file=${encodeURIComponent(fileName)}&workspace=${encodeURIComponent(workspacePath)}`, {
    method: "DELETE",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not delete PRD artifacts: ${response.status} ${response.statusText}`);
  }
}

async function deleteRunFromApi(fileName: string): Promise<void> {
  const response = await fetch(`${API_RUNS_ROUTE}?file=${encodeURIComponent(fileName)}`, {
    method: "DELETE",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not delete run file: ${response.status} ${response.statusText}`);
  }
}

function formatTimestamp(value: number) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAge(value: number) {
  if (!value) {
    return "Unknown";
  }

  const delta = Math.max(0, Date.now() - value);
  const minutes = Math.floor(delta / 60000);
  const hours = Math.floor(delta / 3600000);
  const days = Math.floor(delta / 86400000);

  if (days > 0) {
    return `${days}d ago`;
  }

  if (hours > 0) {
    return `${hours}h ago`;
  }

  return `${Math.max(1, minutes)}m ago`;
}

function formatLiveDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "medium",
  }).format(new Date(value));
}

function dominantStatus(summary: CardSummary): PrdCard["status"] | "empty" {
  if (summary.total === 0) {
    return "empty";
  }

  if (summary.invalid > 0) {
    return "invalid";
  }

  if (summary.in_progress > 0) {
    return "in_progress";
  }

  if (summary.planned > 0) {
    return "planned";
  }

  return "done";
}

function statusSignal(status: PrdCard["status"] | "empty") {
  if (status === "invalid") {
    return { emoji: "🚨", label: "invalid" };
  }

  if (status === "in_progress") {
    return { emoji: "⏳", label: "active" };
  }

  if (status === "planned") {
    return { emoji: "📝", label: "planned" };
  }

  if (status === "done") {
    return { emoji: "✅", label: "done" };
  }

  return { emoji: "👀", label: "idle" };
}

function browserTitle(summary: CardSummary): string {
  const signal = statusSignal(dominantStatus(summary));

  if (summary.total === 0) {
    return `${signal.emoji} No PRDs loaded`;
  }

  return [
    `${signal.emoji} ${summary.total} project${summary.total === 1 ? "" : "s"}`,
    `${summary.in_progress} active`,
    `${summary.planned} planned`,
    `${summary.done} done`,
    `${summary.invalid} invalid`,
    `${summary.tasksDone}/${summary.tasksTotal} tasks`,
  ].join(" · ");
}

function faviconHref(emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="52">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function updateFavicon(emoji: string) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const link = existing || document.createElement("link");

  link.rel = "icon";
  link.href = faviconHref(emoji);

  if (!existing) {
    document.head.append(link);
  }
}

function statusPalette(status: PrdCard["status"]) {
  if (status === "done") {
    return { bg: "#d6f5df", fg: "#146c2e", label: "Done" };
  }

  if (status === "in_progress") {
    return { bg: "#fde7c6", fg: "#9a5314", label: "In progress" };
  }

  if (status === "invalid") {
    return { bg: "#f8d7da", fg: "#8a1c2b", label: "Invalid" };
  }

  return { bg: "#d8e7ff", fg: "#1d4d8f", label: "Planned" };
}

function runStatusPalette(run: RunCard) {
  if (run.isStale) {
    return { bg: "#f8d7da", fg: "#8a1c2b", label: "Stale" };
  }

  if (run.status === "running") {
    return { bg: "#fde7c6", fg: "#9a5314", label: "Running" };
  }

  if (run.status === "completed") {
    return { bg: "#d6f5df", fg: "#146c2e", label: "Completed" };
  }

  return { bg: "#d8e7ff", fg: "#1d4d8f", label: run.status || "Unknown" };
}

function canManageRun(run: RunCard): boolean {
  return run.status !== "running";
}

function viewRun(run: RunCard): void {
  const viewUrl = `${API_RUNS_VIEW_ROUTE}?file=${encodeURIComponent(run.fileName)}`;
  window.open(viewUrl, "_blank", "noopener,noreferrer");
}

export function Visualizer(): React.ReactElement {
  const [cards, setCards] = React.useState<PrdCard[]>([]);
  const [closeMessage, setCloseMessage] = React.useState("");
  const [closePending, setClosePending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [harnessRoot, setHarnessRoot] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(0);
  const [runs, setRuns] = React.useState<RunCard[]>([]);
  const [staleRunCount, setStaleRunCount] = React.useState(0);
  const [workspaceCount, setWorkspaceCount] = React.useState(0);
  const [pendingPrdDelete, setPendingPrdDelete] = React.useState("");
  const [pendingRunDelete, setPendingRunDelete] = React.useState("");
  const [filters, setFilters] = React.useState<VisibilityFilters>(DEFAULT_VISIBILITY_FILTERS);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const next = await loadPrdCardsFromApi();
      setCards(next.cards);
      setHarnessRoot(next.harnessRoot);
      setRuns(next.runs);
      setStaleRunCount(next.staleRunCount);
      setWorkspaceCount(next.workspaceCount);
      setError("");
      setLastUpdated(Date.now());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestRunDelete = React.useCallback(
    async (fileName: string) => {
      setPendingRunDelete(fileName);

      try {
        await deleteRunFromApi(fileName);
        await refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not delete run file.");
      } finally {
        setPendingRunDelete("");
      }
    },
    [refresh],
  );

  const requestPrdDelete = React.useCallback(
    async (fileName: string, workspacePath: string) => {
      const deleteKey = `${workspacePath}:${fileName}`;
      setPendingPrdDelete(deleteKey);

      try {
        await deletePrdFromApi(fileName, workspacePath);
        await refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not delete PRD artifacts.");
      } finally {
        setPendingPrdDelete("");
      }
    },
    [refresh],
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, CLOCK_MS);

    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [refresh]);

  const requestClose = React.useCallback(async () => {
    setClosePending(true);
    setCloseMessage("");

    try {
      const response = await fetch(SHUTDOWN_ROUTE, {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Could not close visualizer: ${response.status} ${response.statusText}`);
      }

      setCloseMessage("Shutdown requested. You can close this tab.");
    } catch (nextError) {
      setCloseMessage(
        nextError instanceof TypeError
          ? "Shutdown requested. If this page stops responding, the server has already exited."
          : nextError instanceof Error
            ? nextError.message
            : "Could not close the visualizer.",
      );
    } finally {
      setClosePending(false);
    }
  }, []);

  const summary = React.useMemo(() => summarizeCards(cards), [cards]);

  const visibleRuns = React.useMemo(() => filterEntries(runs, filters), [filters, runs]);
  const visibleCards = React.useMemo(() => filterEntries(cards, filters), [cards, filters]);
  const visibleSummary = React.useMemo(() => summarizeCards(visibleCards), [visibleCards]);
  const visibleWorkspaceCount = React.useMemo(() => countWorkspaces(visibleRuns, visibleCards), [visibleRuns, visibleCards]);
  const visibleStaleRunCount = React.useMemo(() => visibleRuns.filter((run) => run.isStale).length, [visibleRuns]);

  React.useEffect(() => {
    document.title = browserTitle(summary);
    updateFavicon(statusSignal(dominantStatus(summary)).emoji);
  }, [summary]);

  const statTiles = [
    {
      label: "PRDs",
      value: `${visibleSummary.total}/${summary.total}`,
      detail: summarizeHiddenItems(visibleSummary.total, summary.total, "PRDs"),
    },
    {
      label: "Tasks done",
      value: `${visibleSummary.tasksDone}/${visibleSummary.tasksTotal}`,
      detail:
        summary.tasksTotal > visibleSummary.tasksTotal
          ? `${summary.tasksDone}/${summary.tasksTotal} across all PRDs`
          : "Visible task totals match all PRDs",
    },
    {
      label: "In progress",
      value: `${visibleSummary.in_progress}/${summary.in_progress}`,
      detail: summarizeHiddenItems(visibleSummary.in_progress, summary.in_progress, "active PRDs"),
    },
    {
      label: "Worktrees",
      value: `${visibleWorkspaceCount}/${workspaceCount}`,
      detail: summarizeHiddenItems(visibleWorkspaceCount, workspaceCount, "worktrees"),
    },
    {
      label: "Runs",
      value: `${visibleRuns.length}/${runs.length}`,
      detail: summarizeHiddenItems(visibleRuns.length, runs.length, "runs"),
    },
    {
      label: "Stale runs",
      value: `${visibleStaleRunCount}/${staleRunCount}`,
      detail: summarizeHiddenItems(visibleStaleRunCount, staleRunCount, "stale runs"),
    },
  ];

  const defaultFiltersActive = !filters.showDemo || !filters.showTestFixture;
  const filtersMessage = filterStatusMessage(filters, {
    visibleRuns: visibleRuns.length,
    totalRuns: runs.length,
    visibleCards: visibleCards.length,
    totalCards: cards.length,
  });

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <section style={heroStyle}>
          <div
            style={{
              display: "grid",
              gap: "18px",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "8px" }}>
              <span style={{ letterSpacing: "0.14em", fontSize: "12px", textTransform: "uppercase", color: "#7c6752" }}>
                Agent Harness Visualizer
              </span>
              <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, fontFamily: '"IBM Plex Serif", Georgia, serif' }}>
                PRD status at a glance
              </h1>
              <p style={{ margin: 0, maxWidth: "700px", fontSize: "16px", color: "#52606d" }}>
                Watch the global harness state in `~/.agent-harness`, follow tracked worktrees, and turn distributed PRD JSON into a friendlier status board.
              </p>
              <div style={{ color: "#52606d", fontSize: "14px", fontWeight: 600 }}>{browserTitle(summary)}</div>
            </div>
            <div style={clockCardStyle}>
              <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Local time
              </div>
              <div style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.3 }}>{formatLiveDateTime(now)}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ ...panelStyle, padding: "10px 16px", fontSize: "14px", color: "#364152" }}>
              Watching {harnessRoot || "~/.agent-harness"}
            </div>

            <div style={{ ...panelStyle, padding: "10px 16px", fontSize: "14px", color: "#364152" }}>
              Tracking {visibleWorkspaceCount}/{workspaceCount} worktree{workspaceCount === 1 ? "" : "s"}
            </div>

            <button
              disabled={isLoading}
              style={quietButtonStyle}
              onClick={() => void refresh()}
              type="button"
            >
              {isLoading ? "Refreshing..." : "Refresh now"}
            </button>

            <button disabled={closePending} style={closeButtonStyle} onClick={() => void requestClose()} type="button">
              {closePending ? "Closing..." : "Close"}
            </button>

            <span style={{ color: "#52606d", fontSize: "14px" }}>
              {harnessRoot ? `Polling ${harnessRoot}/runs and referenced worktree PRDs` : "Polling ~/.agent-harness"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              aria-pressed={filters.showDemo}
              onClick={() => setFilters((current) => ({ ...current, showDemo: !current.showDemo }))}
              style={{
                ...filterChipStyle,
                background: filters.showDemo ? "#1f2933" : filterChipStyle.background,
                color: filters.showDemo ? "#fffaf1" : filterChipStyle.color,
              }}
              type="button"
            >
              {filters.showDemo ? "Showing demo worktrees" : "Hiding demo worktrees"}
            </button>

            <button
              aria-pressed={filters.showTestFixture}
              onClick={() => setFilters((current) => ({ ...current, showTestFixture: !current.showTestFixture }))}
              style={{
                ...filterChipStyle,
                background: filters.showTestFixture ? "#1f2933" : filterChipStyle.background,
                color: filters.showTestFixture ? "#fffaf1" : filterChipStyle.color,
              }}
              type="button"
            >
              {filters.showTestFixture ? "Showing test and fixture entries" : "Hiding test and fixture entries"}
            </button>

            <span style={{ color: "#52606d", fontSize: "14px" }}>
              {filtersMessage}
            </span>
          </div>

          {closeMessage ? <div style={{ color: "#7a3411", background: "#fff7ed", borderRadius: "16px", padding: "12px 14px" }}>{closeMessage}</div> : null}
          {error ? <div style={{ color: "#8a1c2b", background: "#fff2f2", borderRadius: "16px", padding: "12px 14px" }}>{error}</div> : null}

          <div style={cardsStyle}>
            {statTiles.map((tile) => (
              <div key={tile.label} style={{ ...panelStyle, padding: "18px" }}>
                <div style={{ fontSize: "13px", color: "#7c6752", marginBottom: "8px" }}>{tile.label}</div>
                <div style={{ fontSize: "30px", fontWeight: 700 }}>{tile.value}</div>
                <div style={{ fontSize: "13px", color: "#52606d", marginTop: "8px", lineHeight: 1.4 }}>{tile.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>Agent runs</h2>
              <div style={{ color: "#52606d", fontSize: "14px", marginTop: "6px" }}>
                Run files come from `~/.agent-harness/runs`. Showing {visibleRuns.length} of {runs.length} runs; any non-running entry can be viewed or deleted directly.
              </div>
            </div>
          </div>

          {runs.length === 0 ? (
            <div style={{ ...panelStyle, padding: "24px" }}>No run state files found in `~/.agent-harness/runs`.</div>
          ) : visibleRuns.length === 0 ? (
            <div style={{ ...panelStyle, padding: "24px" }}>No agent runs match the current filters. Use the filter chips above to reveal demo or test entries.</div>
          ) : (
            visibleRuns.map((run) => {
              const palette = runStatusPalette(run);

              return (
                <article key={run.fileName} style={{ ...panelStyle, padding: "22px", display: "grid", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" }}>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <div style={{ fontSize: "13px", color: "#7c6752" }}>{run.fileName}</div>
                      <h2 style={{ margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>{run.project}</h2>
                      <div style={{ color: "#52606d", fontSize: "14px" }}>{run.branchName}</div>
                      <div style={{ color: "#52606d", fontSize: "13px", wordBreak: "break-all" }}>{run.workspacePath}</div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span
                        style={{
                          background: palette.bg,
                          color: palette.fg,
                          padding: "8px 12px",
                          borderRadius: "999px",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
                        {palette.label}
                      </span>

                      {canManageRun(run) ? (
                        <>
                          <button style={quietButtonStyle} onClick={() => viewRun(run)} type="button">
                            View
                          </button>

                          <button
                            disabled={pendingRunDelete === run.fileName}
                            style={closeButtonStyle}
                            onClick={() => void requestRunDelete(run.fileName)}
                            type="button"
                          >
                            {pendingRunDelete === run.fileName ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>Phase</div>
                      <strong>{run.phase}</strong>
                    </div>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>Iteration</div>
                      <strong>{run.iteration || "-"}</strong>
                    </div>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>Heartbeat</div>
                      <strong>{formatTimestamp(run.lastHeartbeatAt)}</strong>
                      <div style={{ color: "#52606d", fontSize: "12px", marginTop: "4px" }}>{formatAge(run.lastHeartbeatAt)}</div>
                    </div>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>PID</div>
                      <strong>{run.pid ?? "-"}</strong>
                    </div>
                  </div>

                  {run.currentTaskId ? (
                    <div style={{ color: "#364152", lineHeight: 1.5 }}>
                      <strong>Current task:</strong> {run.currentTaskId}
                    </div>
                  ) : null}

                  {run.lastMessage ? (
                    <div style={{ color: "#364152", lineHeight: 1.5 }}>
                      <strong>Last message:</strong> {run.lastMessage}
                    </div>
                  ) : null}

                  {run.command ? (
                    <div style={{ color: "#52606d", fontSize: "13px", wordBreak: "break-all" }}>
                      <strong>Command:</strong> {run.command}
                    </div>
                  ) : null}

                  {run.logPath ? (
                    <div style={{ color: "#52606d", fontSize: "13px", wordBreak: "break-all" }}>
                      <strong>Log:</strong> {run.logPath}
                    </div>
                  ) : null}

                  {run.error ? (
                    <div style={{ color: "#8a1c2b", background: "#fff2f2", borderRadius: "14px", padding: "12px 14px" }}>{run.error}</div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>

        <section style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>PRD cards</h2>
              <div style={{ color: "#52606d", fontSize: "14px", marginTop: "6px" }}>
                Showing {visibleCards.length} of {cards.length} PRDs and {visibleSummary.tasksDone}/{visibleSummary.tasksTotal} visible tasks passed.
                {summary.tasksTotal > visibleSummary.tasksTotal ? ` Global total: ${summary.tasksDone}/${summary.tasksTotal}.` : ""}
                {" "}Completed PRDs can be removed along with their tracked artifacts.
              </div>
            </div>
            {defaultFiltersActive ? (
              <div style={{ ...panelStyle, padding: "10px 16px", fontSize: "14px", color: "#364152" }}>
                Default filters are on
              </div>
            ) : null}
          </div>

          {cards.length === 0 ? (
            <div style={{ ...panelStyle, padding: "24px" }}>
              No tracked PRD JSON files found. Add run state files under `~/.agent-harness/runs` that point at repo or worktree paths.
            </div>
          ) : visibleCards.length === 0 ? (
            <div style={{ ...panelStyle, padding: "24px" }}>
              No PRD cards match the current filters. Reveal demo or test entries to inspect the hidden projects.
            </div>
          ) : (
            visibleCards.map((card) => {
              const palette = statusPalette(card.status);
              const prdDeleteKey = `${card.workspacePath}:${card.fileName}`;

              return (
                <article key={prdDeleteKey} style={{ ...panelStyle, padding: "22px", display: "grid", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" }}>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <div style={{ fontSize: "13px", color: "#7c6752" }}>{card.fileName}</div>
                      <h2 style={{ margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>{card.project}</h2>
                      <div style={{ color: "#52606d", fontSize: "14px" }}>{card.branchName}</div>
                      <div style={{ color: "#52606d", fontSize: "13px", wordBreak: "break-all" }}>{card.workspacePath}</div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span
                        style={{
                          background: palette.bg,
                          color: palette.fg,
                          padding: "8px 12px",
                          borderRadius: "999px",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
                        {palette.label}
                      </span>

                      {card.status === "done" ? (
                        <button
                          disabled={pendingPrdDelete === prdDeleteKey}
                          style={closeButtonStyle}
                          onClick={() => void requestPrdDelete(card.fileName, card.workspacePath)}
                          type="button"
                        >
                          {pendingPrdDelete === prdDeleteKey ? "Removing..." : "Remove completed PRD"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p style={{ margin: 0, color: "#364152", lineHeight: 1.5 }}>{card.description}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>Progress</div>
                      <strong>{card.tasksDone}/{card.tasksTotal} tasks passed</strong>
                    </div>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>Next focus</div>
                      <strong>{card.nextTask}</strong>
                    </div>
                    <div style={{ padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" }}>
                      <div style={{ fontSize: "12px", color: "#7c6752", marginBottom: "6px" }}>Last updated</div>
                      <strong>{formatTimestamp(card.lastModified)}</strong>
                    </div>
                  </div>

                  {card.invalidReason ? (
                    <div style={{ color: "#8a1c2b", background: "#fff2f2", borderRadius: "14px", padding: "12px 14px" }}>{card.invalidReason}</div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>

        <div style={{ color: "#52606d", fontSize: "13px" }}>{lastUpdated ? `Last poll: ${formatTimestamp(lastUpdated)}` : "No data loaded yet"}</div>
      </div>
    </div>
  );
}

export default Visualizer;
