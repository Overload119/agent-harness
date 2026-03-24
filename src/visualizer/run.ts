import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { Hono } from "hono";

import { installVisualizerConsoleMirroring } from "./logging";
import { deleteRunState, loadVisualizerSnapshot } from "./prd-server";
import { buildVisualizer } from "./build";
import { clearVisualizerServerState, readVisualizerServerState, writeVisualizerServerState } from "./server-state";

const VISUALIZER_ROUTE = "/__ah_vis__";
const API_PRDS_ROUTE = `${VISUALIZER_ROUTE}/api/prds`;
const API_RUNS_ROUTE = `${VISUALIZER_ROUTE}/api/runs`;
const HEALTH_ROUTE = `${VISUALIZER_ROUTE}/health`;
const SHUTDOWN_ROUTE = `${VISUALIZER_ROUTE}/shutdown`;

type VisualizerOptions = {
  port?: string;
};

type VisualizerServer = {
  port: number;
  stop(closeActiveConnections?: boolean): void;
};

type VisualizerCliDeps = {
  buildVisualizer(harnessRoot: string, buildDir: string): Promise<void>;
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
  installVisualizerConsoleMirroring(): Promise<string>;
  openUrl(url: string): Promise<void>;
  serve(options: Parameters<typeof Bun.serve>[0]): VisualizerServer;
};

const defaultCliDeps: VisualizerCliDeps = {
  buildVisualizer,
  fetch: (input, init) => fetch(input, init),
  installVisualizerConsoleMirroring,
  openUrl: async (url) => {
    const openResult = Bun.spawn({
      cmd: ["open", url],
      stderr: "inherit",
      stdout: "ignore",
    });
    await openResult.exited;
  },
  serve: (options) => Bun.serve(options),
};

function createProgram(): Command {
  const program = new Command();

  program
    .name("ah-vis")
    .description("Build, serve, and open the agent harness visualizer GUI.")
    .option("-p, --port <number>", "Port to serve on. Defaults to a random open port.")
    .helpOption("-h, --help");

  return program;
}

function harnessRootFromArgv(argv: string[]): string {
  const scriptPath = path.resolve(argv[1]);
  const scriptDir = path.dirname(scriptPath);
  return path.resolve(scriptDir, "..");
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

function responseForNotFound(): Response {
  return new Response("Not found", { status: 404 });
}

async function fileResponse(filePath: string): Promise<Response> {
  try {
    const content = await readFile(filePath);
    return new Response(content, {
      headers: {
        "cache-control": "no-store",
        "content-type": contentTypeFor(filePath),
      },
    });
  } catch {
    return responseForNotFound();
  }
}

export function createVisualizerApp(buildDir: string, shutdown: () => void, scopeRoot: string): Hono {
  const app = new Hono();

  app.get(HEALTH_ROUTE, (context) => {
    context.header("cache-control", "no-store");
    return context.json({ ok: true });
  });

  app.post(SHUTDOWN_ROUTE, (context) => {
    console.log("Visualizer shutdown requested from browser.");
    setTimeout(shutdown, 50);
    return context.json({ ok: true });
  });

  app.get(API_PRDS_ROUTE, async (context) => {
    const snapshot = await loadVisualizerSnapshot({ scopeRoot });
    context.header("cache-control", "no-store");
    return context.json(snapshot);
  });

  app.delete(API_RUNS_ROUTE, async (context) => {
    const fileName = context.req.query("file") || "";
    const result = await deleteRunState(fileName);

    if (result.deleted) {
      return context.json(result, 200);
    }

    const status = result.error === "Run file not found." ? 404 : 400;
    return context.json(result, status);
  });

  app.get(`${VISUALIZER_ROUTE}/`, async () => fileResponse(path.join(buildDir, "index.html")));
  app.get(VISUALIZER_ROUTE, async () => fileResponse(path.join(buildDir, "index.html")));
  app.get(`${VISUALIZER_ROUTE}/*`, async (context) => {
    const routePath = decodeURIComponent(new URL(context.req.url).pathname);
    const assetPath = routePath.slice(`${VISUALIZER_ROUTE}/`.length);
    return fileResponse(path.join(buildDir, assetPath));
  });

  app.notFound(() => responseForNotFound());

  return app;
}

function parseRequestedPort(value: string | undefined): number {
  const requestedPort = value ? Number(value) : 0;
  if (Number.isNaN(requestedPort) || requestedPort < 0) {
    throw new Error(`Invalid port: ${value}`);
  }

  return requestedPort;
}

function visualizerHealthUrl(baseUrl: string): string {
  return new URL(HEALTH_ROUTE, baseUrl).toString();
}

async function reuseExistingVisualizerIfHealthy(requestedPort: number, deps: VisualizerCliDeps): Promise<string | null> {
  const state = await readVisualizerServerState();
  if (!state) {
    return null;
  }

  if (requestedPort > 0 && state.port !== requestedPort) {
    return null;
  }

  try {
    const response = await deps.fetch(visualizerHealthUrl(state.url), {
      headers: { "cache-control": "no-store" },
    });

    if (!response.ok) {
      throw new Error(`Unexpected health status ${response.status}`);
    }

    const payload = (await response.json()) as { ok?: boolean };
    if (payload.ok !== true) {
      throw new Error("Invalid health payload");
    }

    return state.url;
  } catch {
    await clearVisualizerServerState({ port: state.port, url: state.url });
    return null;
  }
}

export async function runVisualizerCli(argv: string[], deps: VisualizerCliDeps = defaultCliDeps): Promise<void> {
  const program = createProgram();
  program.parse(argv);

  const options = program.opts<VisualizerOptions>();
  const requestedPort = parseRequestedPort(options.port);
  const harnessRoot = harnessRootFromArgv(argv);
  const buildDir = path.join(harnessRoot, ".generated", "visualizer");
  const scopeRoot = path.resolve(process.cwd());

  const existingUrl = await reuseExistingVisualizerIfHealthy(requestedPort, deps);
  if (existingUrl) {
    await deps.openUrl(existingUrl);
    console.log(`Visualizer already running at ${existingUrl}`);
    return;
  }

  const logPath = await deps.installVisualizerConsoleMirroring();
  await deps.buildVisualizer(harnessRoot, buildDir);

  let serverStopped = false;
  let resolveShutdown!: () => void;
  const shutdownComplete = new Promise<void>((resolve) => {
    resolveShutdown = resolve;
  });

  const shutdown = () => {
    if (serverStopped) {
      return;
    }

    serverStopped = true;
    server.stop(true);
    resolveShutdown();
  };

  const app = createVisualizerApp(buildDir, shutdown, scopeRoot);

  const server = deps.serve({
    port: requestedPort,
    development: false,
    fetch: app.fetch,
  });

  const visualizerUrl = `http://127.0.0.1:${server.port}${VISUALIZER_ROUTE}/`;

  await writeVisualizerServerState({
    pid: process.pid,
    port: server.port,
    recordedAt: new Date().toISOString(),
    url: visualizerUrl,
  });

  await deps.openUrl(visualizerUrl);

  console.log(`Visualizer running at ${visualizerUrl}`);
  console.log(`Writing logs to ${logPath}`);
  console.log("Press Ctrl+C to stop the server.");

  const keepAlive = setInterval(() => {}, 1 << 30);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await shutdownComplete;
  clearInterval(keepAlive);
  await clearVisualizerServerState({ pid: process.pid, port: server.port, url: visualizerUrl });
  console.log("Visualizer stopped.");
}
