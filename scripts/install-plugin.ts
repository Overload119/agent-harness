import path from "node:path";

const rootDir = path.resolve(import.meta.dir, "..");
if (!Bun.which("bb") || !Bun.which("npm")) {
  throw new Error("Install BB and npm before running install:plugin.");
}

for (const command of [
  ["npm", "ci", "--include=dev"],
  [process.execPath, "scripts/export-skills.ts"],
  ["bb", "plugin", "build", rootDir],
  ["bb", "plugin", "install", rootDir],
]) {
  const child = Bun.spawn(command, { cwd: rootDir, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exit(exitCode);
}

const check = Bun.spawn(["bb", "plugin", "list", "--json"], { stdout: "pipe", stderr: "inherit" });
const output = await new Response(check.stdout).text();
const exitCode = await check.exited;
if (exitCode !== 0) process.exit(exitCode);
const inventory = JSON.parse(output) as {
  plugins: Array<{ id: string; status: string; rootDir: string; source: string }>;
};
const installed = inventory.plugins.find(plugin => plugin.id === "agent-harness");
if (installed?.status !== "running" || installed.rootDir !== rootDir || installed.source !== `path:${rootDir}`) {
  throw new Error("Agent Harness is not running from this checkout. Inspect bb plugin list --json before retrying.");
}
console.log(`Agent Harness is running from ${rootDir}`);

console.log("Configure optional Goals in Settings → Agent Harness → Setup, or run bb agent-harness setup inside a BB thread.");
