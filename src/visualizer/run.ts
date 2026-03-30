import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { Hono } from "hono";
import { file } from "bun";

import { homeHarnessRoot, homeHarnessSubdir, repoHarnessRoot } from "../harness/paths";
import { installVisualizerConsoleMirroring } from "./logging";
import { deletePrd, deleteRunState, loadVisualizerSnapshot } from "./prd-server";
import { clearVisualizerServerState, readVisualizerServerState, writeVisualizerServerState } from "./server-state";

import builtMainJsPath from "./main.js" with { type: "file" };
import builtIndexHtmlPath from "./index.html" with { type: "file" };
import builtIndexCssPath from "./index.css" with { type: "file" };

const VISUALIZER_ROUTE = "/__ah_vis__";
const API_PRDS_ROUTE = `${VISUALIZER_ROUTE}/api/prds`;
const API_RUNS_ROUTE = `${VISUALIZER_ROUTE}/api/runs`;
const API_RUNS_VIEW_ROUTE = `${API_RUNS_ROUTE}/view`;
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
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
  installVisualizerConsoleMirroring(): Promise<string>;
  openUrl(url: string): Promise<void>;
  serve(options: Parameters<typeof Bun.serve>[0]): VisualizerServer;
};

const defaultCliDeps: VisualizerCliDeps = {
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

function isValidJsonFileName(fileName: string): boolean {
  return !!fileName && !fileName.includes(path.posix.sep) && !fileName.includes(path.win32.sep) && !fileName.includes("..") && fileName.endsWith(".json");
}

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function workspacePathFromRun(document: Record<string, unknown>): string {
  const candidate = document.worktreePath || document.workspacePath || document.repoPath || document.rootPath || "";
  return typeof candidate === "string" ? candidate.trim() : "";
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

async function runViewResponse(fileName: string): Promise<Response> {
  if (!isValidJsonFileName(fileName)) {
    return new Response("Invalid run file name.", { status: 400 });
  }

  const runPath = homeHarnessSubdir("runs", fileName);
  if (!(await Bun.file(runPath).exists())) {
    return new Response("Run file not found.", { status: 404 });
  }

  try {
    const document = JSON.parse(await readFile(runPath, "utf8")) as Record<string, unknown>;
    const workspacePath = workspacePathFromRun(document);
    const logPath = typeof document.logPath === "string" ? document.logPath.trim() : "";

    if (logPath) {
      const allowedRoots = [homeHarnessRoot()];

      if (workspacePath && path.isAbsolute(workspacePath)) {
        allowedRoots.push(repoHarnessRoot(workspacePath), path.join(workspacePath, ".generated"));
      }

      if (allowedRoots.some((rootPath) => isPathWithinRoot(rootPath, logPath)) && (await Bun.file(logPath).exists())) {
        return fileResponse(path.resolve(logPath));
      }
    }
  } catch {
    // Fall back to the raw run JSON so the user can still inspect it.
  }

  return fileResponse(runPath);
}

export function createVisualizerApp(shutdown: () => void, scopeRoot: string): Hono {
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

  app.delete(API_PRDS_ROUTE, async (context) => {
    const fileName = context.req.query("file") || "";
    const workspacePath = context.req.query("workspace") || "";
    const result = await deletePrd(fileName, workspacePath);

    if (result.deleted) {
      return context.json(result, 200);
    }

    const status = result.error === "PRD file not found." ? 404 : 400;
    return context.json(result, status);
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

  app.get(API_RUNS_VIEW_ROUTE, async (context) => {
    const fileName = context.req.query("file") || "";
    return runViewResponse(fileName);
  });

  app.get(`${VISUALIZER_ROUTE}/`, async () => new Response(file(builtIndexHtmlPath), { headers: { "Content-Type": "text/html; charset=utf-8" } }));
  app.get(`${VISUALIZER_ROUTE}/index.html`, async () => new Response(file(builtIndexHtmlPath), { headers: { "Content-Type": "text/html; charset=utf-8" } }));
  app.get(`${VISUALIZER_ROUTE}/main.js`, async () => new Response(file(builtMainJsPath), { headers: { "Content-Type": "text/javascript; charset=utf-8" } }));
  app.get(`${VISUALIZER_ROUTE}/index.css`, async () => new Response(file(builtIndexCssPath), { headers: { "Content-Type": "text/css; charset=utf-8" } }));

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
  const scopeRoot = path.resolve(process.cwd());

  const existingUrl = await reuseExistingVisualizerIfHealthy(requestedPort, deps);
  if (existingUrl) {
    await deps.openUrl(existingUrl);
    console.log(`Visualizer already running at ${existingUrl}`);
    return;
  }

  const logPath = await deps.installVisualizerConsoleMirroring();

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

  const app = createVisualizerApp(shutdown, scopeRoot);

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
