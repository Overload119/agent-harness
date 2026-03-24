import { mkdir, readFile, rm } from "node:fs/promises";

import { homeHarnessRoot, homeHarnessSubdir } from "../harness/paths";

const VISUALIZER_SERVER_STATE_FILE = "visualizer-server.json";

export type VisualizerServerState = {
  pid: number;
  port: number;
  recordedAt: string;
  url: string;
};

function visualizerServerStatePath(): string {
  return homeHarnessSubdir(VISUALIZER_SERVER_STATE_FILE);
}

function isValidServerState(value: unknown): value is VisualizerServerState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<VisualizerServerState>;
  return (
    Number.isInteger(candidate.pid) &&
    Number.isInteger(candidate.port) &&
    typeof candidate.recordedAt === "string" &&
    candidate.recordedAt.length > 0 &&
    typeof candidate.url === "string" &&
    candidate.url.length > 0
  );
}

export async function readVisualizerServerState(): Promise<VisualizerServerState | null> {
  try {
    const raw = JSON.parse(await readFile(visualizerServerStatePath(), "utf8")) as unknown;
    return isValidServerState(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function writeVisualizerServerState(state: VisualizerServerState): Promise<void> {
  await mkdir(homeHarnessRoot(), { recursive: true });
  await Bun.write(visualizerServerStatePath(), `${JSON.stringify(state, null, 2)}\n`);
}

export async function clearVisualizerServerState(match?: Partial<Pick<VisualizerServerState, "pid" | "port" | "url">>): Promise<void> {
  const filePath = visualizerServerStatePath();

  if (match) {
    const current = await readVisualizerServerState();
    if (!current) {
      return;
    }

    if (match.pid !== undefined && current.pid !== match.pid) {
      return;
    }

    if (match.port !== undefined && current.port !== match.port) {
      return;
    }

    if (match.url !== undefined && current.url !== match.url) {
      return;
    }
  }

  await rm(filePath, { force: true });
}
