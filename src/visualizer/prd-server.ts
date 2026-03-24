import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { homeHarnessRoot, homeHarnessSubdir, repoHarnessSubdir } from "../harness/paths";
import { cardFromDocument, invalidCard, runCardFromDocument, type PrdCard, type PrdDocument, type RunCard, type RunDocument } from "./cards";

const STALE_RUN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type VisualizerSnapshot = {
  cards: PrdCard[];
  harnessRoot: string;
  runs: RunCard[];
  staleRunCount: number;
  workspaceCount: number;
};

export type VisualizerSnapshotOptions = {
  scopeRoot?: string;
};

async function loadPrdCardsFromWorkspace(workspacePath: string): Promise<PrdCard[]> {
  const prdDir = repoHarnessSubdir(workspacePath, "prds");

  try {
    const entries = await readdir(prdDir, { withFileTypes: true });
    const cards = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const filePath = path.join(prdDir, entry.name);
          let lastModified = 0;

          try {
            const stats = await Bun.file(filePath).stat();
            lastModified = stats.mtimeMs;
          } catch {
            lastModified = 0;
          }

          try {
            const text = await readFile(filePath, "utf8");
            return cardFromDocument(entry.name, lastModified, JSON.parse(text) as PrdDocument, workspacePath);
          } catch (error) {
            return invalidCard(entry.name, lastModified, error, workspacePath);
          }
        }),
    );

    return cards.sort((left, right) => right.lastModified - left.lastModified);
  } catch {
    return [];
  }
}

function workspacePathFromRun(document: RunDocument): string {
  const candidate = document.worktreePath || document.workspacePath || document.repoPath || document.rootPath || "";
  return typeof candidate === "string" ? candidate.trim() : "";
}

async function loadRunCards(_options: VisualizerSnapshotOptions): Promise<RunCard[]> {
  const runsDir = homeHarnessSubdir("runs");
  const staleCutoff = Date.now() - STALE_RUN_AGE_MS;

  try {
    const entries = await readdir(runsDir, { withFileTypes: true });
    const cards: RunCard[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      try {
        const filePath = path.join(runsDir, entry.name);
        const document = JSON.parse(await readFile(filePath, "utf8")) as RunDocument;
        const stats = await Bun.file(filePath).stat();
        const workspacePath = workspacePathFromRun(document);
        if (workspacePath) {
          cards.push(runCardFromDocument(entry.name, stats.mtimeMs, document, workspacePath, staleCutoff));
        }
      } catch {
        continue;
      }
    }

    return cards.sort((left, right) => right.lastTouchedAt - left.lastTouchedAt);
  } catch {
    return [];
  }
}

export async function loadVisualizerSnapshot(options: VisualizerSnapshotOptions): Promise<VisualizerSnapshot> {
  const harnessRoot = homeHarnessRoot();
  const runs = await loadRunCards(options);
  const workspaces = Array.from(new Set(runs.map((run) => run.workspacePath))).sort((left, right) => left.localeCompare(right));
  const cards = (await Promise.all(workspaces.map((workspacePath) => loadPrdCardsFromWorkspace(workspacePath)))).flat();

  return {
    cards: cards.sort((left, right) => right.lastModified - left.lastModified),
    harnessRoot,
    runs,
    staleRunCount: runs.filter((run) => run.isStale).length,
    workspaceCount: workspaces.length,
  };
}

export type DeleteRunStateResult =
  | { deleted: true; fileName: string }
  | { deleted: false; error: string };

export async function deleteRunState(fileName: string): Promise<DeleteRunStateResult> {
  if (!fileName || fileName.includes(path.posix.sep) || fileName.includes(path.win32.sep) || fileName.includes("..") || !fileName.endsWith(".json")) {
    return { deleted: false, error: "Invalid run file name." };
  }

  const filePath = path.join(homeHarnessSubdir("runs"), fileName);

  if (!(await Bun.file(filePath).exists())) {
    return { deleted: false, error: "Run file not found." };
  }

  try {
    await rm(filePath);
    return { deleted: true, fileName };
  } catch {
    return { deleted: false, error: "Could not delete run file." };
  }
}
