import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { Command } from "commander";

import {
  acquireWorktreeLock,
  appendRunLog,
  ensureSharedStateDirs,
  logsDir,
  nowIso,
  runFileName,
  runsDir,
  type RunDocument,
  updateRunState,
  writeRunState,
} from "./state";

const DEFAULT_HEARTBEAT_MS = 5000;

type LoopOptions = {
  heartbeatMs?: string;
  runId?: string;
  worktreePath?: string;
};

type PrdTask = {
  id?: string;
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  priority?: number;
  passes?: boolean;
  notes?: string;
  parallel?: boolean;
};

type PrdDocument = {
  branchName?: string;
  description?: string;
  project?: string;
  tasks?: PrdTask[];
};

function createProgram(): Command {
  const program = new Command();

  program
    .name("ah-loop")
    .description("Run a PRD loop and persist status for the visualizer.")
    .argument("<prd-path>", "Path to the PRD JSON file")
    .option("--heartbeat-ms <number>", "Heartbeat interval in milliseconds", String(DEFAULT_HEARTBEAT_MS))
    .option("--run-id <value>", "Reuse or set a specific run id")
    .option("--worktree-path <path>", "Override the workspace/worktree path recorded in run state")
    .helpOption("-h, --help");

  return program;
}

function parsePositiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return parsed;
}

function taskLabel(task: PrdTask, index: number): string {
  return task.id || task.title || `task-${index + 1}`;
}

async function readPrd(prdPath: string): Promise<PrdDocument> {
  const text = await readFile(prdPath, "utf8");
  const document = JSON.parse(text) as PrdDocument;

  if (!document || typeof document !== "object") {
    throw new Error(`Invalid PRD document: ${prdPath}`);
  }

  if (!Array.isArray(document.tasks)) {
    document.tasks = [];
  }

  return document;
}

async function writePrd(prdPath: string, document: PrdDocument): Promise<void> {
  await writeFile(prdPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function nextIncompleteTask(document: PrdDocument): PrdTask | undefined {
  return (document.tasks || []).find((task) => task?.passes !== true);
}

function updateTaskNotes(task: PrdTask, note: string): void {
  const current = task.notes?.trim();
  task.notes = current ? `${current}\n${note}` : note;
}

function executorPrompt(input: { prdPath: string; runPath: string; taskId: string; worktreePath: string }): string {
  return [
    "/executor",
    "Use the ah-executor skill for this task.",
    "",
    "Context:",
    `- PRD path: ${input.prdPath}`,
    `- Current task id: ${input.taskId}`,
    `- Run state file: ${input.runPath}`,
    `- Worktree path: ${input.worktreePath}`,
    "",
    "Requirements:",
    "- Work on exactly the assigned task.",
    "- Stay inside this repo checkout.",
    "- Never edit ~/.agent-harness directly.",
    "- Use bin/ah-run-state update to persist shared run progress when useful.",
    "- Update the assigned task in the PRD in this repo when complete.",
    "- End with exactly one sentinel line: AH_EXECUTOR_RESULT: PASS or AH_EXECUTOR_RESULT: FAIL.",
  ].join("\n");
}

function executorPassed(output: string): boolean {
  return /AH_EXECUTOR_RESULT:\s*PASS\b/.test(output);
}

async function runExecutor(input: {
  prdPath: string;
  runPath: string;
  taskId: string;
  worktreePath: string;
}): Promise<{ exitCode: number; output: string }> {
  const subprocess = Bun.spawn({
    cmd: [
      "opencode",
      "run",
      "--dir",
      input.worktreePath,
      executorPrompt(input),
    ],
    cwd: input.worktreePath,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      AH_PRD_PATH: input.prdPath,
      AH_RUN_FILE: input.runPath,
      AH_TASK_ID: input.taskId,
      AH_WORKTREE_PATH: input.worktreePath,
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    subprocess.stdout ? new Response(subprocess.stdout).text() : Promise.resolve(""),
    subprocess.stderr ? new Response(subprocess.stderr).text() : Promise.resolve(""),
    subprocess.exited,
  ]);

  return {
    exitCode,
    output: [stdout.trim(), stderr.trim()].filter(Boolean).join("\n"),
  };
}

export async function runLoopCli(argv: string[]): Promise<void> {
  const program = createProgram();
  program.parse(argv);

  const options = program.opts<LoopOptions>();
  const [prdArg] = program.processedArgs as [string];
  const heartbeatMs = parsePositiveInteger(options.heartbeatMs, DEFAULT_HEARTBEAT_MS, "heartbeat-ms");
  const prdPath = path.resolve(prdArg);
  const worktreePath = path.resolve(options.worktreePath || process.cwd());
  const document = await readPrd(prdPath);
  const project = document.project || path.basename(prdPath, ".json");
  const runId = options.runId || randomUUID().slice(0, 8);
  await ensureSharedStateDirs();
  const actualRunPath = path.join(runsDir(), runFileName(project, runId));
  const logPath = path.join(logsDir(), `${runId}.log`);
  const command = ["bin/ah-loop", prdPath, `--run-id ${runId}`].join(" ");
  const startedAt = nowIso();

  const state: RunDocument = {
    branchName: document.branchName || "No branch name",
    command,
    completedAt: "",
    currentTaskId: "",
    error: "",
    exitCode: null,
    iteration: 0,
    lastHeartbeatAt: startedAt,
    lastMessage: "Initializing loop",
    logPath,
    phase: "initializing",
    pid: process.pid,
    prdPath,
    project,
    startedAt,
    status: "running",
    worktreePath,
  };

  let stopping = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  const releaseLock = await acquireWorktreeLock({
    pid: process.pid,
    prdPath,
    runFile: path.basename(actualRunPath),
    runId,
    worktreePath,
  });

  const persist = async (message?: string) => {
    state.lastHeartbeatAt = nowIso();
    if (message) {
      state.lastMessage = message;
    }
    await writeRunState(actualRunPath, state);
  };

  const log = async (...args: unknown[]) => {
    console.log(...args);
    await appendRunLog(logPath, args);
  };

  const stop = async (status: string, exitCode: number, message: string, error = "") => {
    if (stopping) {
      return;
    }

    stopping = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    state.status = status;
    state.phase = status === "completed" ? "completed" : status;
    state.completedAt = nowIso();
    state.exitCode = exitCode;
    state.error = error;
    state.currentTaskId = status === "completed" ? "" : state.currentTaskId;
    await persist(message);
    await log(message);
    await releaseLock();
  };

  process.once("SIGINT", () => {
    void stop("stopped", 130, "Loop interrupted by SIGINT.");
  });
  process.once("SIGTERM", () => {
    void stop("stopped", 143, "Loop interrupted by SIGTERM.");
  });

  await writeRunState(actualRunPath, state);
  await log(`Starting ah-loop for ${project}`);
  await log(`Tracking PRD at ${prdPath}`);
  await log(`Writing run state to ${actualRunPath}`);
  await log(`Acquired worktree lock for ${worktreePath}`);

  heartbeatTimer = setInterval(() => {
    if (stopping) {
      return;
    }

    void updateRunState(actualRunPath, {});
  }, heartbeatMs);

  try {
    while (!stopping) {
      const current = await readPrd(prdPath);
      const task = nextIncompleteTask(current);

      if (!task) {
        await stop("completed", 0, "All PRD tasks completed.");
        return;
      }

      state.iteration += 1;
      state.phase = "executing";
      state.currentTaskId = taskLabel(task, state.iteration - 1);
      await persist(`Starting ${state.currentTaskId}`);
      await log(`Iteration ${state.iteration}: starting ${state.currentTaskId}`);

      const result = await runExecutor({
        prdPath,
        runPath: actualRunPath,
        taskId: state.currentTaskId,
        worktreePath,
      });

      await log(result.output || "Executor produced no output.");

      const updated = await readPrd(prdPath);
      const updatedTask = (updated.tasks || []).find((candidate) => taskLabel(candidate, 0) === state.currentTaskId);
      const passed = updatedTask?.passes === true;

      if (result.exitCode !== 0 || !executorPassed(result.output) || !passed) {
        if (updatedTask) {
          updateTaskNotes(updatedTask, `[${nowIso()}] ah-loop observed executor failure for run ${runId}.`);
          await writePrd(prdPath, updated);
        }

        await stop(
          "failed",
          result.exitCode || 1,
          `Task ${state.currentTaskId} failed during executor run.`,
          result.output || `Executor exited with code ${result.exitCode}.`,
        );
        return;
      }

      state.phase = "verified";
      await persist(`Verified ${state.currentTaskId}`);
      await log(`Verified ${state.currentTaskId}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await stop("failed", 1, `Loop failed: ${message}`, message);
    throw error;
  }
}
