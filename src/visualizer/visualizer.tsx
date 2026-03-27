import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { formatIterationProgress, type PrdCard, type RunCard } from "./cards";
import { DEFAULT_VISIBILITY_FILTERS, countWorkspaces, filterEntries, groupRunsByWorkspace, summarizeCards, type CardSummary } from "./dashboard";
import { fileProxyUrl, matchPrdCard } from "./detail";
import { countRunsByStatus, formatRelativeTime, formatRunDuration, runStatusDisplay } from "./run-presentation";

const CLOCK_MS = 1000;
const POLL_MS = 2000;
const API_PRDS_ROUTE = "/__ah_vis__/api/prds";
const API_RUNS_ROUTE = "/__ah_vis__/api/runs";
const API_RUNS_VIEW_ROUTE = "/__ah_vis__/api/runs/view";

function Surface({ as: Component = "div", children, className, ...props }: React.ComponentProps<"div"> & { as?: React.ElementType }): React.ReactElement {
  return (
    <Component
      className={cn(
        "bg-[rgba(255,252,246,0.82)] border border-[rgba(31,41,51,0.12)] rounded-3xl shadow-[0_20px_60px_rgba(62,51,39,0.12)] backdrop-blur-2xl",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

function Stack({ children, gap = "12px", className, style, ...props }: React.ComponentProps<"div"> & { gap?: string }) {
  return (
    <div
      className={cn("grid", className)}
      style={{ gap, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

function Cluster({ children, gap = "12px", className, style, ...props }: React.ComponentProps<"div"> & { gap?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-3", className)}
      style={{ gap, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, className, ...props }: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("text-[12px] uppercase tracking-[0.08em] text-[#7c6752]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function StatBlock({ label, value, detail, className, style }: { label: string; value: React.ReactNode; detail?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("p-3.5 rounded-2xl bg-[rgba(31,41,51,0.04)]", className)}
      style={style}
    >
      <Eyebrow>{label}</Eyebrow>
      <strong>{value}</strong>
      {detail ? <div className="text-[#52606d] text-xs mt-1">{detail}</div> : null}
    </div>
  );
}

function StatusBadge({ label, background, color }: { label: string; background: string; color: string }): React.ReactElement {
  return (
    <Badge
      style={{ background, color }}
      className="px-3 py-1 rounded-full font-bold text-[13px] font-semibold"
    >
      {label}
    </Badge>
  );
}

function Notice({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div className={cn("px-3.5 py-3 rounded-2xl", className)} style={style}>
      {children}
    </div>
  );
}

const fileLinkStyle = "text-[#1d4d8f] underline";

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

  const requestPrdDelete = React.useCallback(
    async (fileName: string, workspacePath: string) => {
      const deleteKey = `${workspacePath}:${fileName}`;
      setPendingDelete(deleteKey);

      try {
        await deletePrdFromApi(fileName, workspacePath);
        await refresh();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Could not delete PRD artifacts.");
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
    <div className="min-h-screen p-8 bg-gradient-to-br from-[#f7f3ea] via-[#efe7d8] to-[#e4ddd2] text-[#1f2933] font-sans">
      <div className="max-w-[1100px] mx-auto grid gap-6">
        <section className="bg-[rgba(255,252,246,0.82)] border border-[rgba(31,41,51,0.12)] rounded-3xl shadow-[0_20px_60px_rgba(62,51,39,0.12)] backdrop-blur-2xl p-7 grid gap-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
            <Stack gap="8px">
              <h1 className="m-0 text-4xl lg:text-5xl leading-tight font-serif">
                Agent Harness Visualizer
              </h1>
            </Stack>
          </div>

          <Cluster>
            <Surface className="p-2.5 px-4 text-sm text-[#364152]">
              Watching {harnessRoot || "~/.agent-harness"}
            </Surface>

            <Surface className="p-2.5 px-4 text-sm text-[#364152]">
              Tracking {visibleWorkspaceCount}/{workspaceCount} worktree{workspaceCount === 1 ? "" : "s"}
            </Surface>

            <span className="text-[#52606d] text-sm">
              {harnessRoot ? `Polling ${harnessRoot}/runs and referenced worktree PRDs` : "Polling ~/.agent-harness"}
            </span>
          </Cluster>

          {error ? (
            <Notice className="bg-[#fff2f2] text-[#8a1c2b]">{error}</Notice>
          ) : null}

          <Cluster className="text-[#52606d] text-sm">
            <span>{visibleRuns.length} visible runs</span>
            <span>{groupedRuns.length} project sections</span>
            <span>{runStatusCounts.running} running</span>
            <span>{runStatusCounts.completed} completed</span>
            <span>{runStatusCounts.failed} failed</span>
            <span>{visibleStaleRunCount} stale</span>
          </Cluster>
        </section>

        <section className="grid gap-4">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <div>
              <h2 className="m-0 text-2xl font-serif">Agent runs</h2>
              <div className="text-[#52606d] text-sm mt-1.5">
                Run files come from `~/.agent-harness/runs`. Showing {visibleRuns.length} of {runs.length} runs across {groupedRuns.length} grouped section{groupedRuns.length === 1 ? "" : "s"}; entries older than a week are flagged as stale and can be removed with one click.
              </div>
            </div>
          </div>

          {runs.length === 0 ? (
            <Surface className="p-6">No run state files found in `~/.agent-harness/runs`.</Surface>
          ) : visibleRuns.length === 0 ? (
            <Surface className="p-6">No non-demo agent runs are visible right now.</Surface>
          ) : (
            groupedRuns.map((group) => (
              <Surface key={group.label} className="p-5 grid gap-3">
                <Stack gap="6px">
                  <Eyebrow>Project section</Eyebrow>
                  <h3 className="m-0 text-[26px] font-serif">{group.label}</h3>
                  <div className="text-[#52606d] text-[13px] break-all">{group.workspacePath}</div>
                </Stack>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-w-0">
                  <StatBlock label="Runs" value={group.runs.length} />
                  <StatBlock label="PRD progress" value={group.summary.tasksTotal > 0 ? `${group.summary.tasksDone}/${group.summary.tasksTotal}` : "No PRD"} />
                  <StatBlock label="Stale runs" value={group.runs.filter((run) => run.isStale).length} />
                </div>

                <Stack gap="3.5">
                  {group.runs.map((run) => {
                    const palette = runStatusDisplay(run);
                    const linkedCard = matchPrdCard(run, visibleCards);
                    const prdUrl = fileProxyUrl(run.prdPath);
                    const logUrl = fileProxyUrl(run.logPath);
                    const canRemove = run.status !== "running" || run.isStale;
                    const iterationMax = run.maxIterations ?? linkedCard?.tasksTotal ?? null;

                    return (
                      <Card key={run.fileName} className="rounded-2xl border border-[rgba(31,41,51,0.08)] p-5 grid gap-3.5 bg-[rgba(255,255,255,0.42)]">
                        <div className="flex justify-between gap-3 flex-wrap items-start">
                          <Stack gap="1.5">
                            <div className="text-[13px] text-[#7c6752] tracking-normal normal-case">{run.fileName}</div>
                            <div className="text-[#52606d] text-sm">{run.branchName}</div>
                          </Stack>

                          <div className="flex gap-2.5 items-center flex-wrap justify-end">
                            <StatusBadge background={palette.bg} color={palette.fg} label={palette.label} />

                            {canRemove ? (
                              <Button
                                disabled={pendingDelete === run.fileName}
                                onClick={() => void requestRunDelete(run.fileName)}
                                type="button"
                                size="sm"
                                className="rounded-full bg-[#8a1c2b] text-white hover:bg-[#6d1622]"
                              >
                                {pendingDelete === run.fileName ? "Removing..." : "Remove"}
                              </Button>
                            ) : null}

                            {prdUrl ? (
                              <a
                                href={prdUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full px-4 py-2 text-sm bg-[rgba(31,41,51,0.08)] text-[#1f2933] no-underline inline-flex items-center hover:bg-[rgba(31,41,51,0.12)]"
                              >
                                View
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                          <div className="text-[#364152] leading-relaxed">
                            <strong>Current task:</strong> {run.currentTaskId}
                          </div>
                        ) : null}

                        {run.lastMessage ? (
                          <div className="text-[#364152] leading-relaxed">
                            <strong>Last message:</strong> {run.lastMessage}
                          </div>
                        ) : null}

                        {run.command ? (
                          <div className="text-[#52606d] text-[13px] break-all">
                            <strong>Command:</strong> {run.command}
                          </div>
                        ) : null}

                        {run.logPath ? (
                          <div className="text-[#52606d] text-[13px] break-all">
                            <strong>Log:</strong>{" "}
                            <a href={logUrl} target="_blank" rel="noreferrer" className={fileLinkStyle}>
                              {run.logPath}
                            </a>
                          </div>
                        ) : null}

                        {run.prdPath ? (
                          <div className="text-[#52606d] text-[13px] break-all">
                            <strong>PRD:</strong>{" "}
                            <a href={prdUrl} target="_blank" rel="noreferrer" className={fileLinkStyle}>
                              {run.prdPath}
                            </a>
                          </div>
                        ) : null}

                        {run.error ? <Notice className="bg-[#fff2f2] text-[#8a1c2b]">{run.error}</Notice> : null}
                      </Card>
                    );
                  })}
                </Stack>
              </Surface>
            ))
          )}
        </section>

        <div className="text-[#52606d] text-[13px]">{lastUpdated ? `Last poll: ${formatTimestamp(lastUpdated)}` : "No data loaded yet"}</div>
      </div>
    </div>
  );
}

export default Visualizer;
