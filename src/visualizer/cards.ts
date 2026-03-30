export type PrdTask = {
  id?: string;
  title?: string;
  passes?: boolean;
};

export type PrdDocument = {
  project?: string;
  branchName?: string;
  description?: string;
  tasks?: PrdTask[];
};

export type RunDocument = {
  branchName?: string;
  command?: string;
  completedAt?: string;
  currentTaskId?: string;
  error?: string;
  exitCode?: number | null;
  iteration?: number;
  maxIterations?: number;
  lastHeartbeatAt?: string;
  lastMessage?: string;
  logPath?: string;
  phase?: string;
  pid?: number;
  prdPath?: string;
  project?: string;
  repoPath?: string;
  rootPath?: string;
  startedAt?: string;
  status?: string;
  workspacePath?: string;
  worktreePath?: string;
};

export type PrdCard = {
  branchName: string;
  description: string;
  fileName: string;
  invalidReason: string;
  isDemo: boolean;
  isTestFixture: boolean;
  lastModified: number;
  nextTask: string;
  project: string;
  status: "done" | "in_progress" | "planned" | "invalid";
  tasksDone: number;
  tasksTotal: number;
  workspacePath: string;
};

export type RunCard = {
  branchName: string;
  command: string;
  completedAt: number;
  currentTaskId: string;
  error: string;
  exitCode: number | null;
  fileName: string;
  isDemo: boolean;
  isStale: boolean;
  isTestFixture: boolean;
  iteration: number;
  maxIterations: number | null;
  lastHeartbeatAt: number;
  lastMessage: string;
  lastTouchedAt: number;
  logPath: string;
  phase: string;
  pid: number | null;
  prdPath: string;
  project: string;
  startedAt: number;
  status: string;
  workspacePath: string;
};

function parseTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type WorkspacePathClassification = {
  isDemo: boolean;
  isTestFixture: boolean;
};

function normalizePathSegments(workspacePath: string): string[] {
  return workspacePath
    .split(/[\\/]+/)
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment.length > 0);
}

function segmentTokens(segment: string): string[] {
  return segment.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

export function classifyWorkspacePath(workspacePath: string): WorkspacePathClassification {
  const segments = normalizePathSegments(workspacePath);
  const rawDemoSegments = new Set(["demo", "demos", "demo-worktree", "demo-worktrees"]);
  const rawTestSegments = new Set(["test", "tests", "fixture", "fixtures", "__tests__", "__fixture__", "__fixtures__"]);

  let isDemo = false;
  let isTestFixture = false;

  for (const segment of segments) {
    const tokens = segmentTokens(segment);
    const tokenSet = new Set(tokens);

    if (rawDemoSegments.has(segment) || (tokenSet.has("demo") && (tokenSet.has("worktree") || tokenSet.has("worktrees")))) {
      isDemo = true;
    }

    if (
      rawTestSegments.has(segment) ||
      segment.startsWith("ah-test-") ||
      tokenSet.has("test") ||
      tokenSet.has("tests") ||
      tokenSet.has("fixture") ||
      tokenSet.has("fixtures")
    ) {
      isTestFixture = true;
    }
  }

  return { isDemo, isTestFixture };
}

export function cardFromDocument(fileName: string, lastModified: number, document: PrdDocument, workspacePath: string): PrdCard {
  const tasks = Array.isArray(document.tasks) ? document.tasks : [];
  const tasksDone = tasks.filter((task) => task?.passes === true).length;
  const nextTask = tasks.find((task) => task?.passes !== true)?.title || "All tasks complete";
  const classification = classifyWorkspacePath(workspacePath);
  const status =
    tasks.length === 0
      ? "planned"
      : tasksDone === tasks.length
        ? "done"
        : tasksDone > 0
          ? "in_progress"
          : "planned";

  return {
    branchName: document.branchName || "No branch name",
    description: document.description || "No description",
    fileName,
    invalidReason: "",
    isDemo: classification.isDemo,
    isTestFixture: classification.isTestFixture,
    lastModified,
    nextTask,
    project: document.project || "Unknown project",
    status,
    tasksDone,
    tasksTotal: tasks.length,
    workspacePath,
  };
}

export function invalidCard(fileName: string, lastModified: number, error: unknown, workspacePath: string): PrdCard {
  const classification = classifyWorkspacePath(workspacePath);

  return {
    branchName: "Invalid JSON",
    description: "This file could not be parsed as a PRD document.",
    fileName,
    invalidReason: error instanceof Error ? error.message : "Unknown parse error",
    isDemo: classification.isDemo,
    isTestFixture: classification.isTestFixture,
    lastModified,
    nextTask: "Fix JSON format",
    project: "Unknown project",
    status: "invalid",
    tasksDone: 0,
    tasksTotal: 0,
    workspacePath,
  };
}

export function runCardFromDocument(
  fileName: string,
  lastModified: number,
  document: RunDocument,
  workspacePath: string,
  staleCutoff: number,
): RunCard {
  const lastHeartbeatAt = parseTimestamp(document.lastHeartbeatAt);
  const startedAt = parseTimestamp(document.startedAt);
  const completedAt = parseTimestamp(document.completedAt);
  const explicitTouchedAt = Math.max(lastHeartbeatAt, completedAt, startedAt);
  const lastTouchedAt = explicitTouchedAt > 0 ? explicitTouchedAt : lastModified;
  const classification = classifyWorkspacePath(workspacePath);
  const maxIterations = typeof document.maxIterations === "number" && Number.isInteger(document.maxIterations) && document.maxIterations >= 0
    ? document.maxIterations
    : null;

  return {
    branchName: document.branchName || "No branch name",
    command: document.command || "",
    completedAt,
    currentTaskId: document.currentTaskId || "",
    error: document.error || "",
    exitCode: typeof document.exitCode === "number" ? document.exitCode : null,
    fileName,
    isDemo: classification.isDemo,
    isStale: lastTouchedAt > 0 && lastTouchedAt < staleCutoff,
    isTestFixture: classification.isTestFixture,
    iteration: typeof document.iteration === "number" ? document.iteration : 0,
    maxIterations,
    lastHeartbeatAt,
    lastMessage: document.lastMessage || "",
    lastTouchedAt,
    logPath: document.logPath || "",
    phase: document.phase || "unknown",
    pid: typeof document.pid === "number" ? document.pid : null,
    prdPath: document.prdPath || "",
    project: document.project || "Unknown project",
    startedAt,
    status: document.status || "unknown",
    workspacePath,
  };
}

export function formatIterationProgress(run: Pick<RunCard, "iteration" | "maxIterations">): string {
  if (typeof run.maxIterations === "number") {
    return `${run.iteration}/${run.maxIterations}`;
  }

  return run.iteration > 0 ? String(run.iteration) : "-";
}
