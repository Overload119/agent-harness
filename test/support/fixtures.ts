import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import { HARNESS_DIR_NAME, homeHarnessRoot, repoHarnessRoot } from "../../src/harness/paths";

const HOME_ENV_KEYS = ["HOME", "USERPROFILE"] as const;

export type TempHomeFixture = {
  rootDir: string;
  homeDir: string;
  harnessDir: string;
  runsDir: string;
  logsDir: string;
  cleanup(): Promise<void>;
};

export type RepoFixture = {
  rootDir: string;
  harnessDir: string;
  prdsDir: string;
  diagramsDir: string;
  logsDir: string;
  filePath(...segments: string[]): string;
  writeJson(relativePath: string, value: unknown): Promise<string>;
  cleanup(): Promise<void>;
};

export type CreateRepoFixtureOptions = {
  parentDir?: string;
};

/**
 * Creates an isolated HOME tree for tests that exercise `~/.agent-harness`
 * behavior. Use `withTempHomeFixture()` when the code under test calls
 * `os.homedir()` so HOME is restored automatically after each assertion.
 */
export async function createTempHomeFixture(prefix = "ah-test-home-"): Promise<TempHomeFixture> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const homeDir = path.join(rootDir, "home");
  const harnessDir = path.join(homeDir, HARNESS_DIR_NAME);
  const runsDir = path.join(harnessDir, "runs");
  const logsDir = path.join(harnessDir, "logs");

  await mkdir(runsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  return {
    rootDir,
    homeDir,
    harnessDir,
    runsDir,
    logsDir,
    cleanup: async () => {
      await rm(rootDir, { force: true, recursive: true });
    },
  };
}

/**
 * Runs a callback with HOME redirected to an isolated temp directory so tests
 * never read from or write to the real user-scoped harness state.
 */
export async function withTempHomeFixture<T>(run: (fixture: TempHomeFixture) => Promise<T> | T): Promise<T> {
  const fixture = await createTempHomeFixture();
  const previousEnv = new Map<string, string | undefined>();
  const originalHomedir = os.homedir;

  for (const key of HOME_ENV_KEYS) {
    previousEnv.set(key, process.env[key]);
    process.env[key] = fixture.homeDir;
  }

  os.homedir = () => fixture.homeDir;

  try {
    return await run(fixture);
  } finally {
    os.homedir = originalHomedir;

    for (const key of HOME_ENV_KEYS) {
      const previousValue = previousEnv.get(key);

      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }

    await fixture.cleanup();
  }
}

/**
 * Creates a temp repo root with a repo-local `.agent-harness` tree that later
 * tests can populate with PRDs, diagrams, logs, or other fixture files.
 */
export async function createRepoFixture(prefix = "ah-test-repo-", options: CreateRepoFixtureOptions = {}): Promise<RepoFixture> {
  const baseDir = options.parentDir || os.tmpdir();
  await mkdir(baseDir, { recursive: true });
  const rootDir = await mkdtemp(path.join(baseDir, prefix));
  const harnessDir = repoHarnessRoot(rootDir);
  const prdsDir = path.join(harnessDir, "prds");
  const diagramsDir = path.join(harnessDir, "diagrams");
  const logsDir = path.join(harnessDir, "logs");

  await mkdir(prdsDir, { recursive: true });
  await mkdir(diagramsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  return {
    rootDir,
    harnessDir,
    prdsDir,
    diagramsDir,
    logsDir,
    filePath: (...segments: string[]) => path.join(rootDir, ...segments),
    writeJson: async (relativePath: string, value: unknown) => {
      const targetPath = path.join(rootDir, relativePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      return targetPath;
    },
    cleanup: async () => {
      await rm(rootDir, { force: true, recursive: true });
    },
  };
}

export function usesFixtureHome(expectedHomeDir: string): boolean {
  return homeHarnessRoot().startsWith(expectedHomeDir);
}

export function usesFixtureRepo(rootDir: string): boolean {
  return repoHarnessRoot(rootDir).startsWith(rootDir);
}
