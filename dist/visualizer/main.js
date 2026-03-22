// src/visualizer/main.ts
import * as React2 from "react";
import { createRoot } from "react-dom/client";

// src/visualizer/visualizer.ts
import * as React from "react";
var h = React.createElement;
var POLL_MS = 2000;
var pageStyle = {
  minHeight: "100vh",
  padding: "32px",
  background: "linear-gradient(135deg, #f7f3ea 0%, #efe7d8 50%, #e4ddd2 100%)",
  color: "#1f2933",
  fontFamily: '"IBM Plex Sans", "Avenir Next", sans-serif'
};
var shellStyle = {
  maxWidth: "1100px",
  margin: "0 auto",
  display: "grid",
  gap: "24px"
};
var panelStyle = {
  background: "rgba(255, 252, 246, 0.82)",
  border: "1px solid rgba(31, 41, 51, 0.12)",
  borderRadius: "24px",
  boxShadow: "0 20px 60px rgba(62, 51, 39, 0.12)",
  backdropFilter: "blur(16px)"
};
var heroStyle = {
  ...panelStyle,
  padding: "28px",
  display: "grid",
  gap: "16px"
};
var cardsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "18px"
};
var buttonStyle = {
  border: 0,
  borderRadius: "999px",
  padding: "12px 18px",
  background: "#1f2933",
  color: "#fffaf1",
  cursor: "pointer",
  fontWeight: 600
};
var quietButtonStyle = {
  ...buttonStyle,
  background: "rgba(31, 41, 51, 0.08)",
  color: "#1f2933"
};
async function getDirectoryHandle(parent, name) {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return null;
  }
}
function cardFromDocument(fileName, lastModified, document2) {
  const tasks = Array.isArray(document2.tasks) ? document2.tasks : [];
  const tasksDone = tasks.filter((task) => task?.passes === true).length;
  const nextTask = tasks.find((task) => task?.passes !== true)?.title || "All tasks complete";
  const status = tasks.length === 0 ? "planned" : tasksDone === tasks.length ? "done" : tasksDone > 0 ? "in_progress" : "planned";
  return {
    branchName: document2.branchName || "No branch name",
    description: document2.description || "No description",
    fileName,
    invalidReason: "",
    lastModified,
    nextTask,
    project: document2.project || "Unknown project",
    status,
    tasksDone,
    tasksTotal: tasks.length
  };
}
async function loadPrdCardsFromUrl(prdUrl) {
  const response = await fetch(prdUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load PRD: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  try {
    const document2 = JSON.parse(text);
    const fileName = prdUrl.split("/").pop() || "PRD preview";
    return [cardFromDocument(fileName, Date.now(), document2)];
  } catch (error) {
    return [{
      branchName: "Invalid JSON",
      description: "This file could not be parsed as a PRD document.",
      fileName: prdUrl,
      invalidReason: error instanceof Error ? error.message : "Unknown parse error",
      lastModified: Date.now(),
      nextTask: "Fix JSON format",
      project: "Unknown project",
      status: "invalid",
      tasksDone: 0,
      tasksTotal: 0
    }];
  }
}
async function loadPrdCards(rootHandle) {
  const harnessHandle = await getDirectoryHandle(rootHandle, ".agent-harness");
  if (!harnessHandle) {
    return [];
  }
  const prdHandle = await getDirectoryHandle(harnessHandle, "prds");
  if (!prdHandle) {
    return [];
  }
  const cards = [];
  for await (const entry of prdHandle.values()) {
    if (entry.kind !== "file" || !entry.name.endsWith(".json")) {
      continue;
    }
    const file = await entry.getFile();
    const text = await file.text();
    try {
      const document2 = JSON.parse(text);
      cards.push(cardFromDocument(entry.name, file.lastModified, document2));
    } catch (error) {
      cards.push({
        branchName: "Invalid JSON",
        description: "This file could not be parsed as a PRD document.",
        fileName: entry.name,
        invalidReason: error instanceof Error ? error.message : "Unknown parse error",
        lastModified: file.lastModified,
        nextTask: "Fix JSON format",
        project: "Unknown project",
        status: "invalid",
        tasksDone: 0,
        tasksTotal: 0
      });
    }
  }
  return cards.sort((left, right) => right.lastModified - left.lastModified);
}
function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
function statusPalette(status) {
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
function Visualizer() {
  const [cards, setCards] = React.useState([]);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [repoHandle, setRepoHandle] = React.useState(null);
  const [repoName, setRepoName] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(0);
  const directPrdUrl = React.useMemo(() => new URLSearchParams(window.location.search).get("prd") || "", []);
  const refresh = React.useCallback(async (handle) => {
    setIsLoading(true);
    try {
      const nextCards = await loadPrdCards(handle);
      setCards(nextCards);
      setError("");
      setLastUpdated(Date.now());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (directPrdUrl) {
      setIsLoading(true);
      loadPrdCardsFromUrl(directPrdUrl).then((nextCards) => {
        setCards(nextCards);
        setRepoName(directPrdUrl);
        setError("");
        setLastUpdated(Date.now());
      }).catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Unknown error");
      }).finally(() => {
        setIsLoading(false);
      });
      return;
    }
    if (!repoHandle) {
      return;
    }
    refresh(repoHandle);
    const timer = window.setInterval(() => {
      refresh(repoHandle);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [directPrdUrl, refresh, repoHandle]);
  const chooseRepo = React.useCallback(async () => {
    const browserWindow = window;
    if (!browserWindow.showDirectoryPicker) {
      setError("This browser does not support the File System Access API.");
      return;
    }
    try {
      const handle = await browserWindow.showDirectoryPicker();
      setRepoHandle(handle);
      setRepoName(handle.name);
      await refresh(handle);
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") {
        return;
      }
      setError(nextError instanceof Error ? nextError.message : "Could not open repository.");
    }
  }, [refresh]);
  const summary = React.useMemo(() => {
    return cards.reduce((accumulator, card) => {
      accumulator.total += 1;
      accumulator.tasksDone += card.tasksDone;
      accumulator.tasksTotal += card.tasksTotal;
      accumulator[card.status] += 1;
      return accumulator;
    }, { done: 0, in_progress: 0, invalid: 0, planned: 0, tasksDone: 0, tasksTotal: 0, total: 0 });
  }, [cards]);
  const statTiles = [
    { label: "PRDs", value: String(summary.total) },
    { label: "Tasks done", value: `${summary.tasksDone}/${summary.tasksTotal}` },
    { label: "In progress", value: String(summary.in_progress) },
    { label: "Done", value: String(summary.done) }
  ];
  return h("div", { style: pageStyle }, h("div", { style: shellStyle }, h("section", { style: heroStyle }, h("div", { style: { display: "grid", gap: "8px" } }, h("span", { style: { letterSpacing: "0.14em", fontSize: "12px", textTransform: "uppercase", color: "#7c6752" } }, "Agent Harness Visualizer"), h("h1", { style: { margin: 0, fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, fontFamily: '"IBM Plex Serif", Georgia, serif' } }, "PRD status at a glance"), h("p", { style: { margin: 0, maxWidth: "700px", fontSize: "16px", color: "#52606d" } }, "Pick a repo, poll `.agent-harness/prds`, and turn raw PRD JSON into a friendlier status board.")), h("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" } }, directPrdUrl ? h("div", { style: { color: "#52606d", fontSize: "14px" } }, `Previewing ${repoName}`) : h("button", { style: buttonStyle, onClick: () => void chooseRepo(), type: "button" }, repoHandle ? "Change repository" : "Choose repository"), directPrdUrl ? h("button", { disabled: isLoading, style: quietButtonStyle, onClick: () => window.location.reload(), type: "button" }, isLoading ? "Refreshing..." : "Refresh preview") : h("button", { disabled: !repoHandle || isLoading, style: quietButtonStyle, onClick: () => repoHandle && void refresh(repoHandle), type: "button" }, isLoading ? "Refreshing..." : "Refresh now"), directPrdUrl ? null : h("span", { style: { color: "#52606d", fontSize: "14px" } }, repoName ? `Watching ${repoName}/.agent-harness/prds` : "No repository selected")), error ? h("div", { style: { color: "#8a1c2b", background: "#fff2f2", borderRadius: "16px", padding: "12px 14px" } }, error) : null, h("div", { style: cardsStyle }, ...statTiles.map((tile) => h("div", { key: tile.label, style: { ...panelStyle, padding: "18px" } }, h("div", { style: { fontSize: "13px", color: "#7c6752", marginBottom: "8px" } }, tile.label), h("div", { style: { fontSize: "30px", fontWeight: 700 } }, tile.value))))), h("section", { style: { display: "grid", gap: "18px" } }, cards.length === 0 ? h("div", { style: { ...panelStyle, padding: "24px" } }, repoHandle ? "No PRD JSON files found in `.agent-harness/prds`." : "Choose a repository to load PRD files.") : cards.map((card) => {
    const palette = statusPalette(card.status);
    return h("article", { key: card.fileName, style: { ...panelStyle, padding: "22px", display: "grid", gap: "14px" } }, h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" } }, h("div", { style: { display: "grid", gap: "6px" } }, h("div", { style: { fontSize: "13px", color: "#7c6752" } }, card.fileName), h("h2", { style: { margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' } }, card.project), h("div", { style: { color: "#52606d", fontSize: "14px" } }, card.branchName)), h("span", { style: { background: palette.bg, color: palette.fg, padding: "8px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "13px" } }, palette.label)), h("p", { style: { margin: 0, color: "#364152", lineHeight: 1.5 } }, card.description), h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" } }, h("div", { style: { padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" } }, h("div", { style: { fontSize: "12px", color: "#7c6752", marginBottom: "6px" } }, "Progress"), h("strong", null, `${card.tasksDone}/${card.tasksTotal} tasks passed`)), h("div", { style: { padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" } }, h("div", { style: { fontSize: "12px", color: "#7c6752", marginBottom: "6px" } }, "Next focus"), h("strong", null, card.nextTask)), h("div", { style: { padding: "14px", borderRadius: "16px", background: "rgba(31, 41, 51, 0.04)" } }, h("div", { style: { fontSize: "12px", color: "#7c6752", marginBottom: "6px" } }, "Last updated"), h("strong", null, formatTimestamp(card.lastModified)))), card.invalidReason ? h("div", { style: { color: "#8a1c2b", background: "#fff2f2", borderRadius: "14px", padding: "12px 14px" } }, card.invalidReason) : null);
  })), h("div", { style: { color: "#52606d", fontSize: "13px" } }, lastUpdated ? `Last poll: ${formatTimestamp(lastUpdated)}` : "No data loaded yet")));
}
var visualizer_default = Visualizer;

// src/visualizer/main.ts
var root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app mount node.");
}
createRoot(root).render(React2.createElement(visualizer_default));
