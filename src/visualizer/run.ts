import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";

import { installVisualizerConsoleMirroring } from "./logging";
import { loadPrdCardsFromDirectory } from "./prd-server";
import { buildVisualizer } from "./build";

const VISUALIZER_ROUTE = "/__ah_vis__";
const API_PRDS_ROUTE = `${VISUALIZER_ROUTE}/api/prds`;
const SHUTDOWN_ROUTE = `${VISUALIZER_ROUTE}/shutdown`;

type VisualizerOptions = {
  port?: string;
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

function pathIsInside(root: string, targetPath: string): boolean {
  const relativePath = path.relative(root, targetPath);
  return relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
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

export async function runVisualizerCli(argv: string[]): Promise<void> {
  const logPath = await installVisualizerConsoleMirroring();
  const program = createProgram();
  program.parse(argv);

  const options = program.opts<VisualizerOptions>();
  const harnessRoot = harnessRootFromArgv(argv);
  const workingRoot = process.cwd();
  const buildDir = path.join(harnessRoot, ".generated", "visualizer");

  await buildVisualizer(harnessRoot, buildDir);

  const requestedPort = options.port ? Number(options.port) : 0;
  if (Number.isNaN(requestedPort) || requestedPort < 0) {
    throw new Error(`Invalid port: ${options.port}`);
  }

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

  const server = Bun.serve({
    port: requestedPort,
    development: false,
    async fetch(request) {
      const url = new URL(request.url);
      const routePath = decodeURIComponent(url.pathname);

      if (routePath === SHUTDOWN_ROUTE && request.method === "POST") {
        console.log("Visualizer shutdown requested from browser.");
        setTimeout(shutdown, 50);
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
          },
        });
      }

      if (routePath === API_PRDS_ROUTE && request.method === "GET") {
        const cards = await loadPrdCardsFromDirectory(workingRoot);
        return new Response(JSON.stringify({ cards, cwd: workingRoot }), {
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json; charset=utf-8",
          },
        });
      }

      if (routePath === VISUALIZER_ROUTE || routePath === `${VISUALIZER_ROUTE}/`) {
        return fileResponse(path.join(buildDir, "index.html"));
      }

      if (routePath.startsWith(`${VISUALIZER_ROUTE}/`)) {
        const assetPath = routePath.slice(`${VISUALIZER_ROUTE}/`.length);
        return fileResponse(path.join(buildDir, assetPath));
      }

      const repoPath = path.join(workingRoot, routePath.replace(/^\//, ""));
      if (!pathIsInside(workingRoot, repoPath)) {
        return responseForNotFound();
      }

      return fileResponse(repoPath);
    },
  });

  const visualizerUrl = `http://127.0.0.1:${server.port}${VISUALIZER_ROUTE}/`;

  const openResult = Bun.spawn({
    cmd: ["open", visualizerUrl],
    stderr: "inherit",
    stdout: "ignore",
  });
  await openResult.exited;

  console.log(`Visualizer running at ${visualizerUrl}`);
  console.log(`Writing logs to ${logPath}`);
  console.log("Press Ctrl+C to stop the server.");

  const keepAlive = setInterval(() => {}, 1 << 30);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await shutdownComplete;
  clearInterval(keepAlive);
  console.log("Visualizer stopped.");
}
