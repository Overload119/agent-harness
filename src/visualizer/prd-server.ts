import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { homeHarnessRoot, homeHarnessSubdir, repoHarnessRoot, repoHarnessSubdir } from "../harness/paths";
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

export type DeletePrdResult =
  | { deleted: true; deletedArtifactCount: number; fileName: string; workspacePath: string }
  | { deleted: false; error: string };

const ASSOCIATED_PRD_ARTIFACT_DIRS = ["compounds", "diagrams", "plans", "reviews", "verifications"];

function isValidJsonFileName(fileName: string): boolean {
  return !!fileName && !fileName.includes(path.posix.sep) && !fileName.includes(path.win32.sep) && !fileName.includes("..") && fileName.endsWith(".json");
}

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function existingFilePathsInDir(dirPath: string, stem: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && path.parse(entry.name).name === stem)
      .map((entry) => path.join(dirPath, entry.name));
  } catch {
    return [];
  }
}

async function collectAssociatedWorkspaceArtifacts(workspacePath: string, stem: string): Promise<string[]> {
  const workspaceArtifactDirs = [
    ...ASSOCIATED_PRD_ARTIFACT_DIRS.map((dirName) => repoHarnessSubdir(workspacePath, dirName)),
    path.join(workspacePath, ".generated", "diagrams"),
  ];

  const artifactGroups = await Promise.all(workspaceArtifactDirs.map((dirPath) => existingFilePathsInDir(dirPath, stem)));
  return artifactGroups.flat();
}

async function collectRunArtifactsForPrd(prdPath: string, workspacePath: string): Promise<string[]> {
  const runsDir = homeHarnessSubdir("runs");
  const allowedRoots = [homeHarnessRoot(), repoHarnessRoot(workspacePath), path.join(workspacePath, ".generated")];

  try {
    const entries = await readdir(runsDir, { withFileTypes: true });
    const artifactPaths: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const runPath = path.join(runsDir, entry.name);

      try {
        const document = JSON.parse(await readFile(runPath, "utf8")) as RunDocument;
        if (path.resolve(document.prdPath || "") !== prdPath) {
          continue;
        }

        artifactPaths.push(runPath);

        const logPath = document.logPath?.trim();
        if (logPath && allowedRoots.some((rootPath) => isPathWithinRoot(rootPath, logPath)) && (await Bun.file(logPath).exists())) {
          artifactPaths.push(path.resolve(logPath));
        }
      } catch {
        continue;
      }
    }

    return artifactPaths;
  } catch {
    return [];
  }
}

export async function deleteRunState(fileName: string): Promise<DeleteRunStateResult> {
  if (!isValidJsonFileName(fileName)) {
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

export async function deletePrd(fileName: string, workspacePath: string): Promise<DeletePrdResult> {
  if (!isValidJsonFileName(fileName)) {
    return { deleted: false, error: "Invalid PRD file name." };
  }

  if (!workspacePath || !path.isAbsolute(workspacePath)) {
    return { deleted: false, error: "Invalid workspace path." };
  }

  const prdPath = path.resolve(repoHarnessSubdir(workspacePath, "prds", fileName));
  const expectedPrdDir = path.resolve(repoHarnessSubdir(workspacePath, "prds"));
  if (!isPathWithinRoot(expectedPrdDir, prdPath)) {
    return { deleted: false, error: "Invalid PRD file path." };
  }

  if (!(await Bun.file(prdPath).exists())) {
    return { deleted: false, error: "PRD file not found." };
  }

  const stem = path.parse(fileName).name;
  const associatedWorkspaceArtifacts = await collectAssociatedWorkspaceArtifacts(workspacePath, stem);
  const runArtifacts = await collectRunArtifactsForPrd(prdPath, workspacePath);
  const artifactPaths = Array.from(new Set([prdPath, ...associatedWorkspaceArtifacts, ...runArtifacts]));

  try {
    for (const artifactPath of artifactPaths) {
      await rm(artifactPath, { force: true });
    }

    return {
      deleted: true,
      deletedArtifactCount: artifactPaths.length - 1,
      fileName,
      workspacePath,
    };
  } catch {
    return { deleted: false, error: "Could not delete PRD artifacts." };
  }
}
