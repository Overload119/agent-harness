import { appendFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { format } from "node:util";

import { homeHarnessSubdir } from "../harness/paths";

const LOCK_STALE_MS = 15 * 60 * 1000;

export type RunDocument = {
  branchName: string;
  command: string;
  completedAt: string;
  currentTaskId: string;
  error: string;
  exitCode: number | null;
  iteration: number;
  lastHeartbeatAt: string;
  lastMessage: string;
  logPath: string;
  phase: string;
  pid: number;
  prdPath: string;
  project: string;
  startedAt: string;
  status: string;
  worktreePath: string;
};

type LockDocument = {
  createdAt: string;
  pid: number;
  prdPath: string;
  runFile: string;
  runId: string;
  worktreePath: string;
};

function parseTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function runFileName(project: string, runId: string): string {
  const prefix = slugify(project) || "run";
  return `${prefix}-${runId}.json`;
}

export function runsDir(): string {
  return homeHarnessSubdir("runs");
}

export function logsDir(): string {
  return homeHarnessSubdir("logs");
}

export function locksDir(): string {
  return homeHarnessSubdir("locks");
}

export async function ensureSharedStateDirs(): Promise<void> {
  await mkdir(runsDir(), { recursive: true });
  await mkdir(logsDir(), { recursive: true });
  await mkdir(locksDir(), { recursive: true });
}

export async function writeRunState(runPath: string, state: RunDocument): Promise<void> {
  await writeFile(runPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function readRunState(runPath: string): Promise<RunDocument> {
  return JSON.parse(await readFile(runPath, "utf8")) as RunDocument;
}

export async function updateRunState(
  runPath: string,
  updates: Partial<RunDocument>,
  heartbeat = true,
): Promise<RunDocument> {
  const current = await readRunState(runPath);
  const definedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)) as Partial<RunDocument>;
  const next: RunDocument = {
    ...current,
    ...definedUpdates,
    lastHeartbeatAt: heartbeat ? nowIso() : (definedUpdates.lastHeartbeatAt ?? current.lastHeartbeatAt),
  };
  await writeRunState(runPath, next);
  return next;
}

export async function appendRunLog(logPath: string, args: unknown[]): Promise<void> {
  await appendFile(logPath, `[${nowIso()}] ${format(...args)}\n`, "utf8");
}

function lockFilePath(worktreePath: string): string {
  const hash = createHash("sha256").update(path.resolve(worktreePath)).digest("hex").slice(0, 16);
  return path.join(locksDir(), `${hash}.lock.json`);
}

function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isLockStale(lock: LockDocument): Promise<boolean> {
  const runPath = path.join(runsDir(), lock.runFile);

  try {
    const run = await readRunState(runPath);
    if (run.status !== "running") {
      return true;
    }

    const heartbeatAge = Date.now() - parseTimestamp(run.lastHeartbeatAt);
    if (heartbeatAge > LOCK_STALE_MS) {
      return true;
    }

    return !pidIsAlive(run.pid);
  } catch {
    return true;
  }
}

export async function acquireWorktreeLock(details: {
  pid: number;
  prdPath: string;
  runFile: string;
  runId: string;
  worktreePath: string;
}): Promise<() => Promise<void>> {
  await ensureSharedStateDirs();
  const filePath = lockFilePath(details.worktreePath);
  const payload: LockDocument = {
    createdAt: nowIso(),
    pid: details.pid,
    prdPath: details.prdPath,
    runFile: details.runFile,
    runId: details.runId,
    worktreePath: path.resolve(details.worktreePath),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(filePath, "wx");
      await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
      await handle.close();
      return async () => {
        await rm(filePath, { force: true });
      };
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }

      const existing = JSON.parse(await readFile(filePath, "utf8")) as LockDocument;
      if (!(await isLockStale(existing))) {
        throw new Error(
          `Worktree is already locked by run ${existing.runId} for ${existing.worktreePath}. One worktree can only have one ah-loop execution at a time.`,
        );
      }

      await rm(filePath, { force: true });
    }
  }

  throw new Error(`Could not acquire worktree lock for ${details.worktreePath}`);
}
