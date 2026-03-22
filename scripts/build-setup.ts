import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

const SHEBANG = "#!/usr/bin/env bun";
const rootDir = path.resolve(import.meta.dir, "..");
const entrypoint = path.join(rootDir, "src", "cli.ts");
const targetPath = path.join(rootDir, "bin", "setup");

const result = await Bun.build({
  entrypoints: [entrypoint],
  format: "esm",
  minify: false,
  sourcemap: "none",
  target: "bun",
  write: false,
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

const artifact = result.outputs.find((output) => output.path.endsWith("cli.js"));

if (!artifact) {
  throw new Error("Build succeeded but cli.js was not emitted.");
}

const builtSource = await artifact.text();
const scriptBody = builtSource.startsWith(SHEBANG)
  ? builtSource.slice(SHEBANG.length).replace(/^\r?\n/, "")
  : builtSource;

await writeFile(targetPath, `${SHEBANG}\n\n${scriptBody}`, "utf8");
await chmod(targetPath, 0o755);

console.log(`Built ${path.relative(rootDir, targetPath)} from ${path.relative(rootDir, entrypoint)}.`);
