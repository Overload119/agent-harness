import * as React from "react";

import { formatIterationProgress, type PrdCard, type RunCard } from "./cards";
import { DEFAULT_VISIBILITY_FILTERS, countWorkspaces, filterEntries, groupRunsByWorkspace, summarizeCards, type CardSummary } from "./dashboard";
import { fileProxyUrl, matchPrdCard } from "./detail";
import { countRunsByStatus, formatRelativeTime, formatRunDuration, runStatusDisplay } from "./run-presentation";

const CLOCK_MS = 1000;
const POLL_MS = 2000;
const API_PRDS_ROUTE = "/__ah_vis__/api/prds";
const API_RUNS_ROUTE = "/__ah_vis__/api/runs";
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

const clockCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: "18px 20px",
  minWidth: "260px",
  justifySelf: "end",
};

const mutedTextStyle: React.CSSProperties = {
  color: "#52606d",
};

const eyebrowStyle: React.CSSProperties = {
  letterSpacing: "0.08em",
  fontSize: "12px",
  textTransform: "uppercase",
  color: "#7c6752",
};

const statBlockStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(31, 41, 51, 0.04)",
};

const errorNoticeStyle: React.CSSProperties = {
  color: "#8a1c2b",
  background: "#fff2f2",
  borderRadius: "14px",
  padding: "12px 14px",
};

type SurfaceProps = {
  as?: React.ElementType;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

function Surface({ as: Component = "div", children, style }: SurfaceProps): React.ReactElement {
  return <Component style={{ ...panelStyle, ...style }}>{children}</Component>;
}

function Stack({ children, gap = "12px", style }: { children: React.ReactNode; gap?: React.CSSProperties["gap"]; style?: React.CSSProperties }) {
  return <div style={{ display: "grid", gap, ...style }}>{children}</div>;
}

function Cluster({ children, gap = "12px", style }: { children: React.ReactNode; gap?: React.CSSProperties["gap"]; style?: React.CSSProperties }) {
  return <div style={{ display: "flex", gap, flexWrap: "wrap", alignItems: "center", ...style }}>{children}</div>;
}

function Eyebrow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div style={eyebrowStyle}>{children}</div>;
}

function StatBlock({ label, value, detail, style }: { label: string; value: React.ReactNode; detail?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...statBlockStyle, ...style }}>
      <Eyebrow>{label}</Eyebrow>
      <strong>{value}</strong>
      {detail ? <div style={{ ...mutedTextStyle, fontSize: "12px", marginTop: "4px" }}>{detail}</div> : null}
    </div>
  );
}

function StatusBadge({ label, background, color }: { label: string; background: string; color: string }): React.ReactElement {
  return (
    <span
      style={{
        background,
        color,
        padding: "8px 12px",
        borderRadius: "999px",
        fontWeight: 700,
        fontSize: "13px",
      }}
    >
      {label}
    </span>
  );
}

function Notice({ children, style }: { children: React.ReactNode; style: React.CSSProperties }): React.ReactElement {
  return <div style={style}>{children}</div>;
}

const fileLinkStyle: React.CSSProperties = {
  color: "#1d4d8f",
  textDecoration: "underline",
};

async function loadPrdCardsFromApi(): Promise<{ cards: PrdCard[]; harnessRoot: string; workspaceCount: number }> {
  const response = await fetch(API_PRDS_ROUTE, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load PRDs: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<{ cards: PrdCard[]; harnessRoot: string; runs: RunCard[]; staleRunCount: number; workspaceCount: number }>;
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
  const [workspaceCount, setWorkspaceCount] = React.useState(0);
  const [pendingDelete, setPendingDelete] = React.useState("");
  const refresh = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const next = await loadPrdCardsFromApi();
      setCards(next.cards);
      setHarnessRoot(next.harnessRoot);
      setRuns(next.runs);
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
      setPendingDelete(fileName);

      try {
        await deleteRunFromApi(fileName);
        await refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not delete run file.");
      } finally {
        setPendingDelete("");
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

  const visibleRuns = React.useMemo(() => filterEntries(runs, DEFAULT_VISIBILITY_FILTERS), [runs]);
  const visibleCards = React.useMemo(() => filterEntries(cards, DEFAULT_VISIBILITY_FILTERS), [cards]);
  const visibleSummary = React.useMemo(() => summarizeCards(visibleCards), [visibleCards]);
  const visibleWorkspaceCount = React.useMemo(() => countWorkspaces(visibleRuns, visibleCards), [visibleRuns, visibleCards]);
  const visibleStaleRunCount = React.useMemo(() => visibleRuns.filter((run) => run.isStale).length, [visibleRuns]);
  const groupedRuns = React.useMemo(() => groupRunsByWorkspace(visibleRuns, visibleCards), [visibleCards, visibleRuns]);
  const runStatusCounts = React.useMemo(() => countRunsByStatus(visibleRuns), [visibleRuns]);

  React.useEffect(() => {
    document.title = browserTitle(summary);
    updateFavicon(statusSignal(dominantStatus(summary)).emoji);
  }, [summary]);

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <section style={heroStyle}>
          <div style={{ display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
            <Stack gap="8px">
              <span style={{ ...eyebrowStyle, letterSpacing: "0.14em" }}>Agent Harness Run Monitor</span>
              <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, fontFamily: '"IBM Plex Serif", Georgia, serif' }}>
                Grouped run activity at a glance
              </h1>
              <div style={{ ...mutedTextStyle, fontSize: "14px", fontWeight: 600 }}>{browserTitle(summary)}</div>
            </Stack>
            <div style={clockCardStyle}>
              <div style={{ ...eyebrowStyle, marginBottom: "8px" }}>Local time</div>
              <div style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.3 }}>{formatLiveDateTime(now)}</div>
            </div>
          </div>

          <Cluster>
            <Surface style={{ padding: "10px 16px", fontSize: "14px", color: "#364152" }}>
              Watching {harnessRoot || "~/.agent-harness"}
            </Surface>

            <Surface style={{ padding: "10px 16px", fontSize: "14px", color: "#364152" }}>
              Tracking {visibleWorkspaceCount}/{workspaceCount} worktree{workspaceCount === 1 ? "" : "s"}
            </Surface>

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

            <span style={{ ...mutedTextStyle, fontSize: "14px" }}>
              {harnessRoot ? `Polling ${harnessRoot}/runs and referenced worktree PRDs` : "Polling ~/.agent-harness"}
            </span>
          </Cluster>

          {closeMessage ? <Notice style={{ color: "#7a3411", background: "#fff7ed", borderRadius: "16px", padding: "12px 14px" }}>{closeMessage}</Notice> : null}
          {error ? <Notice style={errorNoticeStyle}>{error}</Notice> : null}

          <Cluster style={{ ...mutedTextStyle, fontSize: "14px" }}>
            <span>{visibleRuns.length} visible runs</span>
            <span>{groupedRuns.length} project sections</span>
            <span>{runStatusCounts.running} running</span>
            <span>{runStatusCounts.completed} completed</span>
            <span>{runStatusCounts.failed} failed</span>
            <span>{visibleStaleRunCount} stale</span>
            <span>{visibleSummary.tasksDone}/{visibleSummary.tasksTotal} tasks done</span>
          </Cluster>
        </section>

        <section style={{ display: "grid", gap: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>Agent runs</h2>
              <div style={{ ...mutedTextStyle, fontSize: "14px", marginTop: "6px" }}>
                Run files come from `~/.agent-harness/runs`. Showing {visibleRuns.length} of {runs.length} runs across {groupedRuns.length} grouped section{groupedRuns.length === 1 ? "" : "s"}; entries older than a week are flagged as stale and can be removed with one click.
              </div>
            </div>
          </div>

          {runs.length === 0 ? (
            <Surface style={{ padding: "24px" }}>No run state files found in `~/.agent-harness/runs`.</Surface>
          ) : visibleRuns.length === 0 ? (
            <Surface style={{ padding: "24px" }}>No non-demo agent runs are visible right now.</Surface>
          ) : (
            groupedRuns.map((group) => (
              <Surface as="section" key={group.id} style={{ padding: "22px", display: "grid", gap: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" }}>
                  <Stack gap="6px">
                    <Eyebrow>Project section</Eyebrow>
                    <h3 style={{ margin: 0, fontSize: "26px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>{group.label}</h3>
                    <div style={{ ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" }}>{group.workspacePath}</div>
                  </Stack>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", minWidth: "min(100%, 420px)" }}>
                    <StatBlock label="Runs" value={group.runs.length} />
                    <StatBlock label="PRD progress" value={group.summary.tasksTotal > 0 ? `${group.summary.tasksDone}/${group.summary.tasksTotal}` : "No PRD"} />
                    <StatBlock label="Stale runs" value={group.runs.filter((run) => run.isStale).length} />
                  </div>
                </div>

                <Stack gap="14px">
                  {group.runs.map((run) => {
                    const palette = runStatusDisplay(run);
                    const linkedCard = matchPrdCard(run, visibleCards);
                    const prdUrl = fileProxyUrl(run.prdPath);
                    const logUrl = fileProxyUrl(run.logPath);
                    const canRemove = run.status !== "running" || run.isStale;
                    const iterationMax = run.maxIterations ?? linkedCard?.tasksTotal ?? null;

                    return (
                      <article key={run.fileName} style={{ borderRadius: "20px", border: "1px solid rgba(31, 41, 51, 0.08)", padding: "20px", display: "grid", gap: "14px", background: "rgba(255, 255, 255, 0.42)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" }}>
                          <Stack gap="6px">
                            <div style={{ ...eyebrowStyle, fontSize: "13px", letterSpacing: "0" }}>{run.fileName}</div>
                            <div style={{ ...mutedTextStyle, fontSize: "14px" }}>{run.branchName}</div>
                          </Stack>

                          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <StatusBadge background={palette.bg} color={palette.fg} label={palette.label} />

                            {canRemove ? (
                              <button
                                disabled={pendingDelete === run.fileName}
                                style={closeButtonStyle}
                                onClick={() => void requestRunDelete(run.fileName)}
                                type="button"
                              >
                                {pendingDelete === run.fileName ? "Removing..." : "Remove"}
                              </button>
                            ) : null}

                            {prdUrl ? (
                              <a href={prdUrl} style={{ ...quietButtonStyle, textDecoration: "none", display: "inline-flex" }} target="_blank" rel="noreferrer">
                                View
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                          <StatBlock label="Status" value={palette.label} detail={run.phase || "Unknown phase"} />
                          <StatBlock label="Iteration" value={formatIterationProgress({ iteration: run.iteration, maxIterations: iterationMax })} />
                          <StatBlock label="Heartbeat" value={formatRelativeTime(run.lastHeartbeatAt, now)} detail={formatTimestamp(run.lastHeartbeatAt)} />
                          <StatBlock
                            label="Duration"
                            value={formatRunDuration(run, now)}
                            detail={run.completedAt ? `Completed ${formatTimestamp(run.completedAt)}` : run.startedAt ? `Started ${formatTimestamp(run.startedAt)}` : "Start time unavailable"}
                          />
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
                          <div style={{ ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" }}>
                            <strong>Command:</strong> {run.command}
                          </div>
                        ) : null}

                        {run.logPath ? (
                          <div style={{ ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" }}>
                            <strong>Log:</strong>{" "}
                            <a href={logUrl} target="_blank" rel="noreferrer" style={fileLinkStyle}>
                              {run.logPath}
                            </a>
                          </div>
                        ) : null}

                        {run.prdPath ? (
                          <div style={{ ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" }}>
                            <strong>PRD:</strong>{" "}
                            <a href={prdUrl} target="_blank" rel="noreferrer" style={fileLinkStyle}>
                              {run.prdPath}
                            </a>
                          </div>
                        ) : null}

                        {run.error ? <Notice style={errorNoticeStyle}>{run.error}</Notice> : null}
                      </article>
                    );
                  })}
                </Stack>
              </Surface>
            ))
          )}

        </section>

        <div style={{ color: "#52606d", fontSize: "13px" }}>{lastUpdated ? `Last poll: ${formatTimestamp(lastUpdated)}` : "No data loaded yet"}</div>
      </div>
    </div>
  );
}

export default Visualizer;
