// src/visualizer/main.tsx
import { createRoot } from "react-dom/client";

// src/visualizer/visualizer.tsx
import * as React from "react";

// src/visualizer/cards.ts
function formatIterationProgress(run) {
  if (typeof run.maxIterations === "number") {
    return `${run.iteration}/${run.maxIterations}`;
  }
  return run.iteration > 0 ? String(run.iteration) : "-";
}

// src/visualizer/dashboard.ts
var DEFAULT_VISIBILITY_FILTERS = {
  showDemo: false,
  showTestFixture: false
};
function emptySummary() {
  return { done: 0, in_progress: 0, invalid: 0, planned: 0, tasksDone: 0, tasksTotal: 0, total: 0 };
}
function summarizeCards(cards) {
  return cards.reduce((accumulator, card) => {
    accumulator.total += 1;
    accumulator.tasksDone += card.tasksDone;
    accumulator.tasksTotal += card.tasksTotal;
    accumulator[card.status] += 1;
    return accumulator;
  }, emptySummary());
}
function countWorkspaces(runs, cards) {
  return new Set([...runs, ...cards].map((entry) => entry.workspacePath).filter((workspacePath) => workspacePath.length > 0)).size;
}
function filterEntries(entries, filters) {
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
function groupLabel(run) {
  return run.project || run.workspacePath || "Unknown project";
}
function groupRunsByWorkspace(runs, cards) {
  const groups = new Map;
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
      workspacePath: run.workspacePath
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
  return Array.from(groups.values()).map((group) => ({
    ...group,
    runs: [...group.runs].sort((left, right) => right.lastTouchedAt - left.lastTouchedAt || left.fileName.localeCompare(right.fileName)),
    summary: summarizeCards(group.cards)
  })).sort((left, right) => left.label.localeCompare(right.label) || left.workspacePath.localeCompare(right.workspacePath));
}

// node:path
function assertPath(path) {
  if (typeof path !== "string")
    throw TypeError("Path must be a string. Received " + JSON.stringify(path));
}
function normalizeStringPosix(path, allowAboveRoot) {
  var res = "", lastSegmentLength = 0, lastSlash = -1, dots = 0, code;
  for (var i = 0;i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47)
      break;
    else
      code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1)
        ;
      else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1)
                res = "", lastSegmentLength = 0;
              else
                res = res.slice(0, lastSlashIndex), lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              lastSlash = i, dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "", lastSegmentLength = 0, lastSlash = i, dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += "/..";
          else
            res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i, dots = 0;
    } else if (code === 46 && dots !== -1)
      ++dots;
    else
      dots = -1;
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root, base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir)
    return base;
  if (dir === pathObject.root)
    return dir + base;
  return dir + sep + base;
}
function resolve() {
  var resolvedPath = "", resolvedAbsolute = false, cwd;
  for (var i = arguments.length - 1;i >= -1 && !resolvedAbsolute; i--) {
    var path;
    if (i >= 0)
      path = arguments[i];
    else {
      if (cwd === undefined)
        cwd = process.cwd();
      path = cwd;
    }
    if (assertPath(path), path.length === 0)
      continue;
    resolvedPath = path + "/" + resolvedPath, resolvedAbsolute = path.charCodeAt(0) === 47;
  }
  if (resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute), resolvedAbsolute)
    if (resolvedPath.length > 0)
      return "/" + resolvedPath;
    else
      return "/";
  else if (resolvedPath.length > 0)
    return resolvedPath;
  else
    return ".";
}
function normalize(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var isAbsolute = path.charCodeAt(0) === 47, trailingSeparator = path.charCodeAt(path.length - 1) === 47;
  if (path = normalizeStringPosix(path, !isAbsolute), path.length === 0 && !isAbsolute)
    path = ".";
  if (path.length > 0 && trailingSeparator)
    path += "/";
  if (isAbsolute)
    return "/" + path;
  return path;
}
function isAbsolute(path) {
  return assertPath(path), path.length > 0 && path.charCodeAt(0) === 47;
}
function join() {
  if (arguments.length === 0)
    return ".";
  var joined;
  for (var i = 0;i < arguments.length; ++i) {
    var arg = arguments[i];
    if (assertPath(arg), arg.length > 0)
      if (joined === undefined)
        joined = arg;
      else
        joined += "/" + arg;
  }
  if (joined === undefined)
    return ".";
  return normalize(joined);
}
function relative(from, to) {
  if (assertPath(from), assertPath(to), from === to)
    return "";
  if (from = resolve(from), to = resolve(to), from === to)
    return "";
  var fromStart = 1;
  for (;fromStart < from.length; ++fromStart)
    if (from.charCodeAt(fromStart) !== 47)
      break;
  var fromEnd = from.length, fromLen = fromEnd - fromStart, toStart = 1;
  for (;toStart < to.length; ++toStart)
    if (to.charCodeAt(toStart) !== 47)
      break;
  var toEnd = to.length, toLen = toEnd - toStart, length = fromLen < toLen ? fromLen : toLen, lastCommonSep = -1, i = 0;
  for (;i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === 47)
          return to.slice(toStart + i + 1);
        else if (i === 0)
          return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === 47)
          lastCommonSep = i;
        else if (i === 0)
          lastCommonSep = 0;
      }
      break;
    }
    var fromCode = from.charCodeAt(fromStart + i), toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode)
      break;
    else if (fromCode === 47)
      lastCommonSep = i;
  }
  var out = "";
  for (i = fromStart + lastCommonSep + 1;i <= fromEnd; ++i)
    if (i === fromEnd || from.charCodeAt(i) === 47)
      if (out.length === 0)
        out += "..";
      else
        out += "/..";
  if (out.length > 0)
    return out + to.slice(toStart + lastCommonSep);
  else {
    if (toStart += lastCommonSep, to.charCodeAt(toStart) === 47)
      ++toStart;
    return to.slice(toStart);
  }
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var code = path.charCodeAt(0), hasRoot = code === 47, end = -1, matchedSlash = true;
  for (var i = path.length - 1;i >= 1; --i)
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else
      matchedSlash = false;
  if (end === -1)
    return hasRoot ? "/" : ".";
  if (hasRoot && end === 1)
    return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== undefined && typeof ext !== "string")
    throw TypeError('"ext" argument must be a string');
  assertPath(path);
  var start = 0, end = -1, matchedSlash = true, i;
  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path)
      return "";
    var extIdx = ext.length - 1, firstNonSlashEnd = -1;
    for (i = path.length - 1;i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1)
          matchedSlash = false, firstNonSlashEnd = i + 1;
        if (extIdx >= 0)
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1)
              end = i;
          } else
            extIdx = -1, end = firstNonSlashEnd;
      }
    }
    if (start === end)
      end = firstNonSlashEnd;
    else if (end === -1)
      end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1;i >= 0; --i)
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1)
        matchedSlash = false, end = i + 1;
    if (end === -1)
      return "";
    return path.slice(start, end);
  }
}
function extname(path) {
  assertPath(path);
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, preDotState = 0;
  for (var i = path.length - 1;i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    return "";
  return path.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object")
    throw TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
  return _format("/", pathObject);
}
function parse(path) {
  assertPath(path);
  var ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0)
    return ret;
  var code = path.charCodeAt(0), isAbsolute2 = code === 47, start;
  if (isAbsolute2)
    ret.root = "/", start = 1;
  else
    start = 0;
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, i = path.length - 1, preDotState = 0;
  for (;i >= start; --i) {
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1)
      if (startPart === 0 && isAbsolute2)
        ret.base = ret.name = path.slice(1, end);
      else
        ret.base = ret.name = path.slice(startPart, end);
  } else {
    if (startPart === 0 && isAbsolute2)
      ret.name = path.slice(1, startDot), ret.base = path.slice(1, end);
    else
      ret.name = path.slice(startPart, startDot), ret.base = path.slice(startPart, end);
    ret.ext = path.slice(startDot, end);
  }
  if (startPart > 0)
    ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute2)
    ret.dir = "/";
  return ret;
}
var sep = "/";
var delimiter = ":";
var posix = ((p) => (p.posix = p, p))({ resolve, normalize, isAbsolute, join, relative, _makeLong, dirname, basename, extname, format, parse, sep, delimiter, win32: null, posix: null });
var path_default = posix;

// src/visualizer/detail.ts
var FILE_ROUTE = "/__ah_vis__/file";
function normalizeFileName(filePath) {
  return filePath ? path_default.basename(filePath) : "";
}
function matchPrdCard(run, cards) {
  const cardsInWorkspace = cards.filter((card) => card.workspacePath === run.workspacePath);
  if (cardsInWorkspace.length === 0) {
    return null;
  }
  const prdFileName = normalizeFileName(run.prdPath);
  if (prdFileName) {
    const exactMatch = cardsInWorkspace.find((card) => card.fileName === prdFileName);
    if (exactMatch) {
      return exactMatch;
    }
  }
  return cardsInWorkspace[0] || null;
}
function fileProxyUrl(filePath) {
  if (!filePath) {
    return "";
  }
  return `${FILE_ROUTE}?path=${encodeURI(filePath)}`;
}

// src/visualizer/run-presentation.ts
var RUN_STATUS_STYLES = {
  completed: { bg: "#d6f5df", fg: "#146c2e", label: "Completed", tone: "success" },
  failed: { bg: "#f8d7da", fg: "#8a1c2b", label: "Failed", tone: "danger" },
  running: { bg: "#fde7c6", fg: "#9a5314", label: "Running", tone: "running" },
  stale: { bg: "#f8d7da", fg: "#8a1c2b", label: "Stale", tone: "danger" },
  unknown: { bg: "#d8e7ff", fg: "#1d4d8f", label: "Unknown", tone: "neutral" }
};
function isFailedRun(run) {
  if (run.status === "failed") {
    return true;
  }
  if (typeof run.exitCode === "number" && run.exitCode !== 0) {
    return true;
  }
  return run.error.trim().length > 0;
}
function runStatusDisplay(run) {
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
function countRunsByStatus(runs) {
  return runs.reduce((counts, run) => {
    counts[runStatusDisplay(run).key] += 1;
    return counts;
  }, { completed: 0, failed: 0, running: 0, stale: 0, unknown: 0 });
}
function formatDuration(ms) {
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
function formatRelativeTime(value, now = Date.now()) {
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
function formatDurationBetween(start, end) {
  if (!start || !end || end < start) {
    return "Unknown";
  }
  return formatDuration(end - start);
}
function formatRunDuration(run, now = Date.now()) {
  if (!run.startedAt) {
    return "Unknown";
  }
  return formatDurationBetween(run.startedAt, run.completedAt || now);
}

// src/visualizer/visualizer.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var CLOCK_MS = 1000;
var POLL_MS = 2000;
var API_PRDS_ROUTE = "/__ah_vis__/api/prds";
var API_RUNS_ROUTE = "/__ah_vis__/api/runs";
var SHUTDOWN_ROUTE = "/__ah_vis__/shutdown";
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
var closeButtonStyle = {
  ...buttonStyle,
  background: "#8a1c2b"
};
var clockCardStyle = {
  ...panelStyle,
  padding: "18px 20px",
  minWidth: "260px",
  justifySelf: "end"
};
var mutedTextStyle = {
  color: "#52606d"
};
var eyebrowStyle = {
  letterSpacing: "0.08em",
  fontSize: "12px",
  textTransform: "uppercase",
  color: "#7c6752"
};
var statBlockStyle = {
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(31, 41, 51, 0.04)"
};
var errorNoticeStyle = {
  color: "#8a1c2b",
  background: "#fff2f2",
  borderRadius: "14px",
  padding: "12px 14px"
};
function Surface({ as: Component = "div", children, style }) {
  return /* @__PURE__ */ jsxDEV(Component, {
    style: { ...panelStyle, ...style },
    children
  }, undefined, false, undefined, this);
}
function Stack({ children, gap = "12px", style }) {
  return /* @__PURE__ */ jsxDEV("div", {
    style: { display: "grid", gap, ...style },
    children
  }, undefined, false, undefined, this);
}
function Cluster({ children, gap = "12px", style }) {
  return /* @__PURE__ */ jsxDEV("div", {
    style: { display: "flex", gap, flexWrap: "wrap", alignItems: "center", ...style },
    children
  }, undefined, false, undefined, this);
}
function Eyebrow({ children }) {
  return /* @__PURE__ */ jsxDEV("div", {
    style: eyebrowStyle,
    children
  }, undefined, false, undefined, this);
}
function StatBlock({ label, value, detail, style }) {
  return /* @__PURE__ */ jsxDEV("div", {
    style: { ...statBlockStyle, ...style },
    children: [
      /* @__PURE__ */ jsxDEV(Eyebrow, {
        children: label
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("strong", {
        children: value
      }, undefined, false, undefined, this),
      detail ? /* @__PURE__ */ jsxDEV("div", {
        style: { ...mutedTextStyle, fontSize: "12px", marginTop: "4px" },
        children: detail
      }, undefined, false, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}
function StatusBadge({ label, background, color }) {
  return /* @__PURE__ */ jsxDEV("span", {
    style: {
      background,
      color,
      padding: "8px 12px",
      borderRadius: "999px",
      fontWeight: 700,
      fontSize: "13px"
    },
    children: label
  }, undefined, false, undefined, this);
}
function Notice({ children, style }) {
  return /* @__PURE__ */ jsxDEV("div", {
    style,
    children
  }, undefined, false, undefined, this);
}
var fileLinkStyle = {
  color: "#1d4d8f",
  textDecoration: "underline"
};
async function loadPrdCardsFromApi() {
  const response = await fetch(API_PRDS_ROUTE, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load PRDs: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
async function deleteRunFromApi(fileName) {
  const response = await fetch(`${API_RUNS_ROUTE}?file=${encodeURIComponent(fileName)}`, {
    method: "DELETE",
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Could not delete run file: ${response.status} ${response.statusText}`);
  }
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
function formatLiveDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "medium"
  }).format(new Date(value));
}
function dominantStatus(summary) {
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
function statusSignal(status) {
  if (status === "invalid") {
    return { emoji: "\uD83D\uDEA8", label: "invalid" };
  }
  if (status === "in_progress") {
    return { emoji: "⏳", label: "active" };
  }
  if (status === "planned") {
    return { emoji: "\uD83D\uDCDD", label: "planned" };
  }
  if (status === "done") {
    return { emoji: "✅", label: "done" };
  }
  return { emoji: "\uD83D\uDC40", label: "idle" };
}
function browserTitle(summary) {
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
    `${summary.tasksDone}/${summary.tasksTotal} tasks`
  ].join(" · ");
}
function faviconHref(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="52">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function updateFavicon(emoji) {
  const existing = document.head.querySelector('link[rel="icon"]');
  const link = existing || document.createElement("link");
  link.rel = "icon";
  link.href = faviconHref(emoji);
  if (!existing) {
    document.head.append(link);
  }
}
function Visualizer() {
  const [cards, setCards] = React.useState([]);
  const [closeMessage, setCloseMessage] = React.useState("");
  const [closePending, setClosePending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [harnessRoot, setHarnessRoot] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(0);
  const [runs, setRuns] = React.useState([]);
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
  const requestRunDelete = React.useCallback(async (fileName) => {
    setPendingDelete(fileName);
    try {
      await deleteRunFromApi(fileName);
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete run file.");
    } finally {
      setPendingDelete("");
    }
  }, [refresh]);
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);
  React.useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      refresh();
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
          accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`Could not close visualizer: ${response.status} ${response.statusText}`);
      }
      setCloseMessage("Shutdown requested. You can close this tab.");
    } catch (nextError) {
      setCloseMessage(nextError instanceof TypeError ? "Shutdown requested. If this page stops responding, the server has already exited." : nextError instanceof Error ? nextError.message : "Could not close the visualizer.");
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
  return /* @__PURE__ */ jsxDEV("div", {
    style: pageStyle,
    children: /* @__PURE__ */ jsxDEV("div", {
      style: shellStyle,
      children: [
        /* @__PURE__ */ jsxDEV("section", {
          style: heroStyle,
          children: [
            /* @__PURE__ */ jsxDEV("div", {
              style: { display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" },
              children: [
                /* @__PURE__ */ jsxDEV(Stack, {
                  gap: "8px",
                  children: [
                    /* @__PURE__ */ jsxDEV("span", {
                      style: { ...eyebrowStyle, letterSpacing: "0.14em" },
                      children: "Agent Harness Run Monitor"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV("h1", {
                      style: { margin: 0, fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, fontFamily: '"IBM Plex Serif", Georgia, serif' },
                      children: "Grouped run activity at a glance"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV("div", {
                      style: { ...mutedTextStyle, fontSize: "14px", fontWeight: 600 },
                      children: browserTitle(summary)
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("div", {
                  style: clockCardStyle,
                  children: [
                    /* @__PURE__ */ jsxDEV("div", {
                      style: { ...eyebrowStyle, marginBottom: "8px" },
                      children: "Local time"
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV("div", {
                      style: { fontSize: "22px", fontWeight: 700, lineHeight: 1.3 },
                      children: formatLiveDateTime(now)
                    }, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV(Cluster, {
              children: [
                /* @__PURE__ */ jsxDEV(Surface, {
                  style: { padding: "10px 16px", fontSize: "14px", color: "#364152" },
                  children: [
                    "Watching ",
                    harnessRoot || "~/.agent-harness"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV(Surface, {
                  style: { padding: "10px 16px", fontSize: "14px", color: "#364152" },
                  children: [
                    "Tracking ",
                    visibleWorkspaceCount,
                    "/",
                    workspaceCount,
                    " worktree",
                    workspaceCount === 1 ? "" : "s"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("button", {
                  disabled: isLoading,
                  style: quietButtonStyle,
                  onClick: () => void refresh(),
                  type: "button",
                  children: isLoading ? "Refreshing..." : "Refresh now"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("button", {
                  disabled: closePending,
                  style: closeButtonStyle,
                  onClick: () => void requestClose(),
                  type: "button",
                  children: closePending ? "Closing..." : "Close"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  style: { ...mutedTextStyle, fontSize: "14px" },
                  children: harnessRoot ? `Polling ${harnessRoot}/runs and referenced worktree PRDs` : "Polling ~/.agent-harness"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            closeMessage ? /* @__PURE__ */ jsxDEV(Notice, {
              style: { color: "#7a3411", background: "#fff7ed", borderRadius: "16px", padding: "12px 14px" },
              children: closeMessage
            }, undefined, false, undefined, this) : null,
            error ? /* @__PURE__ */ jsxDEV(Notice, {
              style: errorNoticeStyle,
              children: error
            }, undefined, false, undefined, this) : null,
            /* @__PURE__ */ jsxDEV(Cluster, {
              style: { ...mutedTextStyle, fontSize: "14px" },
              children: [
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    visibleRuns.length,
                    " visible runs"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    groupedRuns.length,
                    " project sections"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    runStatusCounts.running,
                    " running"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    runStatusCounts.completed,
                    " completed"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    runStatusCounts.failed,
                    " failed"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    visibleStaleRunCount,
                    " stale"
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  children: [
                    visibleSummary.tasksDone,
                    "/",
                    visibleSummary.tasksTotal,
                    " tasks done"
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV("section", {
          style: { display: "grid", gap: "18px" },
          children: [
            /* @__PURE__ */ jsxDEV("div", {
              style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" },
              children: /* @__PURE__ */ jsxDEV("div", {
                children: [
                  /* @__PURE__ */ jsxDEV("h2", {
                    style: { margin: 0, fontSize: "24px", fontFamily: '"IBM Plex Serif", Georgia, serif' },
                    children: "Agent runs"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV("div", {
                    style: { ...mutedTextStyle, fontSize: "14px", marginTop: "6px" },
                    children: [
                      "Run files come from `~/.agent-harness/runs`. Showing ",
                      visibleRuns.length,
                      " of ",
                      runs.length,
                      " runs across ",
                      groupedRuns.length,
                      " grouped section",
                      groupedRuns.length === 1 ? "" : "s",
                      "; entries older than a week are flagged as stale and can be removed with one click."
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this)
            }, undefined, false, undefined, this),
            runs.length === 0 ? /* @__PURE__ */ jsxDEV(Surface, {
              style: { padding: "24px" },
              children: "No run state files found in `~/.agent-harness/runs`."
            }, undefined, false, undefined, this) : visibleRuns.length === 0 ? /* @__PURE__ */ jsxDEV(Surface, {
              style: { padding: "24px" },
              children: "No non-demo agent runs are visible right now."
            }, undefined, false, undefined, this) : groupedRuns.map((group) => /* @__PURE__ */ jsxDEV(Surface, {
              as: "section",
              style: { padding: "22px", display: "grid", gap: "18px" },
              children: [
                /* @__PURE__ */ jsxDEV("div", {
                  style: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" },
                  children: [
                    /* @__PURE__ */ jsxDEV(Stack, {
                      gap: "6px",
                      children: [
                        /* @__PURE__ */ jsxDEV(Eyebrow, {
                          children: "Project section"
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("h3", {
                          style: { margin: 0, fontSize: "26px", fontFamily: '"IBM Plex Serif", Georgia, serif' },
                          children: group.label
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("div", {
                          style: { ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" },
                          children: group.workspacePath
                        }, undefined, false, undefined, this)
                      ]
                    }, undefined, true, undefined, this),
                    /* @__PURE__ */ jsxDEV("div", {
                      style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", minWidth: "min(100%, 420px)" },
                      children: [
                        /* @__PURE__ */ jsxDEV(StatBlock, {
                          label: "Runs",
                          value: group.runs.length
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV(StatBlock, {
                          label: "PRD progress",
                          value: group.summary.tasksTotal > 0 ? `${group.summary.tasksDone}/${group.summary.tasksTotal}` : "No PRD"
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV(StatBlock, {
                          label: "Stale runs",
                          value: group.runs.filter((run) => run.isStale).length
                        }, undefined, false, undefined, this)
                      ]
                    }, undefined, true, undefined, this)
                  ]
                }, undefined, true, undefined, this),
                /* @__PURE__ */ jsxDEV(Stack, {
                  gap: "14px",
                  children: group.runs.map((run) => {
                    const palette = runStatusDisplay(run);
                    const linkedCard = matchPrdCard(run, visibleCards);
                    const prdUrl = fileProxyUrl(run.prdPath);
                    const logUrl = fileProxyUrl(run.logPath);
                    const canRemove = run.status !== "running" || run.isStale;
                    const iterationMax = run.maxIterations ?? linkedCard?.tasksTotal ?? null;
                    return /* @__PURE__ */ jsxDEV("article", {
                      style: { borderRadius: "20px", border: "1px solid rgba(31, 41, 51, 0.08)", padding: "20px", display: "grid", gap: "14px", background: "rgba(255, 255, 255, 0.42)" },
                      children: [
                        /* @__PURE__ */ jsxDEV("div", {
                          style: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start" },
                          children: [
                            /* @__PURE__ */ jsxDEV(Stack, {
                              gap: "6px",
                              children: [
                                /* @__PURE__ */ jsxDEV("div", {
                                  style: { ...eyebrowStyle, fontSize: "13px", letterSpacing: "0" },
                                  children: run.fileName
                                }, undefined, false, undefined, this),
                                /* @__PURE__ */ jsxDEV("div", {
                                  style: { fontSize: "22px", fontWeight: 700, lineHeight: 1.2 },
                                  children: run.project
                                }, undefined, false, undefined, this)
                              ]
                            }, undefined, true, undefined, this),
                            /* @__PURE__ */ jsxDEV("div", {
                              style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
                              children: [
                                /* @__PURE__ */ jsxDEV(StatusBadge, {
                                  background: palette.bg,
                                  color: palette.fg,
                                  label: palette.label
                                }, undefined, false, undefined, this),
                                canRemove ? /* @__PURE__ */ jsxDEV("button", {
                                  disabled: pendingDelete === run.fileName,
                                  style: closeButtonStyle,
                                  onClick: () => void requestRunDelete(run.fileName),
                                  type: "button",
                                  children: pendingDelete === run.fileName ? "Removing..." : "Remove"
                                }, undefined, false, undefined, this) : null,
                                prdUrl ? /* @__PURE__ */ jsxDEV("a", {
                                  href: prdUrl,
                                  style: { ...quietButtonStyle, textDecoration: "none", display: "inline-flex" },
                                  target: "_blank",
                                  rel: "noreferrer",
                                  children: "View"
                                }, undefined, false, undefined, this) : null
                              ]
                            }, undefined, true, undefined, this)
                          ]
                        }, undefined, true, undefined, this),
                        /* @__PURE__ */ jsxDEV("div", {
                          style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
                          children: [
                            /* @__PURE__ */ jsxDEV(StatBlock, {
                              label: "Status",
                              value: palette.label,
                              detail: run.phase || "Unknown phase"
                            }, undefined, false, undefined, this),
                            /* @__PURE__ */ jsxDEV(StatBlock, {
                              label: "Iteration",
                              value: formatIterationProgress({ iteration: run.iteration, maxIterations: iterationMax })
                            }, undefined, false, undefined, this),
                            /* @__PURE__ */ jsxDEV(StatBlock, {
                              label: "Heartbeat",
                              value: formatRelativeTime(run.lastHeartbeatAt, now),
                              detail: formatTimestamp(run.lastHeartbeatAt)
                            }, undefined, false, undefined, this),
                            /* @__PURE__ */ jsxDEV(StatBlock, {
                              label: "Duration",
                              value: formatRunDuration(run, now),
                              detail: run.completedAt ? `Completed ${formatTimestamp(run.completedAt)}` : run.startedAt ? `Started ${formatTimestamp(run.startedAt)}` : "Start time unavailable"
                            }, undefined, false, undefined, this)
                          ]
                        }, undefined, true, undefined, this),
                        run.currentTaskId ? /* @__PURE__ */ jsxDEV("div", {
                          style: { color: "#364152", lineHeight: 1.5 },
                          children: [
                            /* @__PURE__ */ jsxDEV("strong", {
                              children: "Current task:"
                            }, undefined, false, undefined, this),
                            " ",
                            run.currentTaskId
                          ]
                        }, undefined, true, undefined, this) : null,
                        run.lastMessage ? /* @__PURE__ */ jsxDEV("div", {
                          style: { color: "#364152", lineHeight: 1.5 },
                          children: [
                            /* @__PURE__ */ jsxDEV("strong", {
                              children: "Last message:"
                            }, undefined, false, undefined, this),
                            " ",
                            run.lastMessage
                          ]
                        }, undefined, true, undefined, this) : null,
                        run.command ? /* @__PURE__ */ jsxDEV("div", {
                          style: { ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" },
                          children: [
                            /* @__PURE__ */ jsxDEV("strong", {
                              children: "Command:"
                            }, undefined, false, undefined, this),
                            " ",
                            run.command
                          ]
                        }, undefined, true, undefined, this) : null,
                        run.logPath ? /* @__PURE__ */ jsxDEV("div", {
                          style: { ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" },
                          children: [
                            /* @__PURE__ */ jsxDEV("strong", {
                              children: "Log:"
                            }, undefined, false, undefined, this),
                            " ",
                            /* @__PURE__ */ jsxDEV("a", {
                              href: logUrl,
                              target: "_blank",
                              rel: "noreferrer",
                              style: fileLinkStyle,
                              children: run.logPath
                            }, undefined, false, undefined, this)
                          ]
                        }, undefined, true, undefined, this) : null,
                        run.prdPath ? /* @__PURE__ */ jsxDEV("div", {
                          style: { ...mutedTextStyle, fontSize: "13px", wordBreak: "break-all" },
                          children: [
                            /* @__PURE__ */ jsxDEV("strong", {
                              children: "PRD:"
                            }, undefined, false, undefined, this),
                            " ",
                            /* @__PURE__ */ jsxDEV("a", {
                              href: prdUrl,
                              target: "_blank",
                              rel: "noreferrer",
                              style: fileLinkStyle,
                              children: run.prdPath
                            }, undefined, false, undefined, this)
                          ]
                        }, undefined, true, undefined, this) : null,
                        run.error ? /* @__PURE__ */ jsxDEV(Notice, {
                          style: errorNoticeStyle,
                          children: run.error
                        }, undefined, false, undefined, this) : null
                      ]
                    }, run.fileName, true, undefined, this);
                  })
                }, undefined, false, undefined, this)
              ]
            }, group.id, true, undefined, this))
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV("div", {
          style: { color: "#52606d", fontSize: "13px" },
          children: lastUpdated ? `Last poll: ${formatTimestamp(lastUpdated)}` : "No data loaded yet"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
var visualizer_default = Visualizer;

// src/visualizer/main.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
var root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app mount node.");
}
createRoot(root).render(/* @__PURE__ */ jsxDEV2(visualizer_default, {}, undefined, false, undefined, this));
