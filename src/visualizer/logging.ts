import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { format } from "node:util";

const HARNESS_LOGS_DIR = path.join(".agent-harness", "logs");
const VISUALIZER_LOG_FILE = "ah-vis.log";

function timestamp(): string {
  return new Date().toISOString();
}

function formatLogLine(args: unknown[]): string {
  return `[${timestamp()}] ${format(...args)}\n`;
}

export async function ensureVisualizerLogPath(cwd = process.cwd()): Promise<string> {
  const logDir = path.join(cwd, HARNESS_LOGS_DIR);
  await mkdir(logDir, { recursive: true });
  return path.join(logDir, VISUALIZER_LOG_FILE);
}

export async function appendVisualizerLog(args: unknown[], cwd = process.cwd()): Promise<void> {
  const logPath = await ensureVisualizerLogPath(cwd);
  await appendFile(logPath, formatLogLine(args), "utf8");
}

export async function installVisualizerConsoleMirroring(cwd = process.cwd()): Promise<string> {
  const logPath = await ensureVisualizerLogPath(cwd);
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  const mirror = (writer: (...args: unknown[]) => void, args: unknown[]) => {
    writer(...args);
    void appendFile(logPath, formatLogLine(args), "utf8");
  };

  console.log = (...args: unknown[]) => {
    mirror(originalLog, args);
  };

  console.error = (...args: unknown[]) => {
    mirror(originalError, args);
  };

  console.warn = (...args: unknown[]) => {
    mirror(originalWarn, args);
  };

  return logPath;
}
