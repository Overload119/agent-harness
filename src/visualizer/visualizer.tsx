import * as React from "react";

import { type PrdCard } from "./cards";

type CardSummary = {
  done: number;
  in_progress: number;
  invalid: number;
  planned: number;
  tasksDone: number;
  tasksTotal: number;
  total: number;
};

const CLOCK_MS = 1000;
const POLL_MS = 2000;
const API_PRDS_ROUTE = "/__ah_vis__/api/prds";
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

const clockCardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: "18px 20px",
  minWidth: "260px",
  justifySelf: "end",
};

function emptySummary(): CardSummary {
  return { done: 0, in_progress: 0, invalid: 0, planned: 0, tasksDone: 0, tasksTotal: 0, total: 0 };
}

async function loadPrdCardsFromApi(): Promise<{ cards: PrdCard[]; cwd: string }> {
  const response = await fetch(API_PRDS_ROUTE, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load PRDs: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<{ cards: PrdCard[]; cwd: string }>;
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

export function Visualizer(): React.ReactElement {
  const [cards, setCards] = React.useState<PrdCard[]>([]);
  const [closeMessage, setCloseMessage] = React.useState("");
  const [closePending, setClosePending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [repoName, setRepoName] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(0);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const next = await loadPrdCardsFromApi();
      setCards(next.cards);
      setRepoName(next.cwd);
      setError("");
      setLastUpdated(Date.now());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const summary = React.useMemo(() => {
    return cards.reduce<CardSummary>((accumulator, card) => {
      accumulator.total += 1;
      accumulator.tasksDone += card.tasksDone;
      accumulator.tasksTotal += card.tasksTotal;
      accumulator[card.status] += 1;
      return accumulator;
    }, emptySummary());
  }, [cards]);

  React.useEffect(() => {
    document.title = browserTitle(summary);
    updateFavicon(statusSignal(dominantStatus(summary)).emoji);
  }, [summary]);

  const statTiles = [
    { label: "PRDs", value: String(summary.total) },
    { label: "Tasks done", value: `${summary.tasksDone}/${summary.tasksTotal}` },
    { label: "In progress", value: String(summary.in_progress) },
    { label: "Done", value: String(summary.done) },
  ];

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
                Watch the current folder, poll `.agent-harness/prds`, and turn raw PRD JSON into a friendlier status board.
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
            <div style={{ ...panelStyle, padding: "10px 16px", fontSize: "14px", color: "#364152" }}>Watching {repoName || "current folder"}</div>

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

            <span style={{ color: "#52606d", fontSize: "14px" }}>{repoName ? `Polling ${repoName}/.agent-harness/prds` : "Polling current folder"}</span>
          </div>

          {closeMessage ? <div style={{ color: "#7a3411", background: "#fff7ed", borderRadius: "16px", padding: "12px 14px" }}>{closeMessage}</div> : null}
          {error ? <div style={{ color: "#8a1c2b", background: "#fff2f2", borderRadius: "16px", padding: "12px 14px" }}>{error}</div> : null}

          <div style={cardsStyle}>
            {statTiles.map((tile) => (
              <div key={tile.label} style={{ ...panelStyle, padding: "18px" }}>
                <div style={{ fontSize: "13px", color: "#7c6752", marginBottom: "8px" }}>{tile.label}</div>
                <div style={{ fontSize: "30px", fontWeight: 700 }}>{tile.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: "18px" }}>
          {cards.length === 0 ? (
            <div style={{ ...panelStyle, padding: "24px" }}>
              No PRD JSON files found in `.agent-harness/prds` for the current folder.
            </div>
          ) : (
            cards.map((card) => {
              const palette = statusPalette(card.status);

              return (
                <article key={card.fileName} style={{ ...panelStyle, padding: "22px", display: "grid", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" }}>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <div style={{ fontSize: "13px", color: "#7c6752" }}>{card.fileName}</div>
                      <h2 style={{ margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' }}>{card.project}</h2>
                      <div style={{ color: "#52606d", fontSize: "14px" }}>{card.branchName}</div>
                    </div>
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
