import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

const SHEBANG = "#!/usr/bin/env bun";
const rootDir = path.resolve(import.meta.dir, "..");

const targets = [
  { entrypoint: path.join(rootDir, "src", "cli.ts"), output: path.join(rootDir, "bin", "setup"), suffix: "cli.js" },
  { entrypoint: path.join(rootDir, "src", "visualizer-cli.ts"), output: path.join(rootDir, "bin", "ah-vis"), suffix: "visualizer-cli.js" },
  { entrypoint: path.join(rootDir, "src", "loop-cli.ts"), output: path.join(rootDir, "bin", "ah-loop"), suffix: "loop-cli.js" },
  { entrypoint: path.join(rootDir, "src", "run-state-cli.ts"), output: path.join(rootDir, "bin", "ah-run-state"), suffix: "run-state-cli.js" },
];

const result = await Bun.build({
  entrypoints: targets.map((target) => target.entrypoint),
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

for (const target of targets) {
  const artifact = result.outputs.find((output) => output.path.endsWith(target.suffix));

  if (!artifact) {
    throw new Error(`Build succeeded but ${target.suffix} was not emitted.`);
  }

  const builtSource = await artifact.text();
  const scriptBody = builtSource.startsWith(SHEBANG)
    ? builtSource.slice(SHEBANG.length).replace(/^\r?\n/, "")
    : builtSource;

  await writeFile(target.output, `${SHEBANG}\n\n${scriptBody}`, "utf8");
  await chmod(target.output, 0o755);
  console.log(`Built ${path.relative(rootDir, target.output)} from ${path.relative(rootDir, target.entrypoint)}.`);
}
