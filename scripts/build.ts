import { chmod, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const SHEBANG = "#!/usr/bin/env bun";
const rootDir = path.resolve(import.meta.dir, "..");
const outputBase = path.join(rootDir, ".agent-harness", "bin");
const visualizerSrcDir = path.join(rootDir, "src", "visualizer");

await mkdir(outputBase, { recursive: true });

async function buildVisualizerFrontend(): Promise<void> {
  const builtMainJs = path.join(visualizerSrcDir, "main.js");
  await rm(builtMainJs, { force: true });

  const result = await Bun.build({
    entrypoints: [path.join(visualizerSrcDir, "main.tsx")],
    external: ["react", "react-dom", "react-dom/client"],
    format: "esm",
    minify: false,
    outdir: visualizerSrcDir,
    sourcemap: "none",
    target: "browser",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log("Built visualizer frontend");
}

async function compileVisualizerCli(): Promise<void> {
  const outputPath = path.join(outputBase, "ah-vis");

  const result = await Bun.build({
    entrypoints: [path.join(rootDir, "src", "visualizer-cli.ts")],
    compile: {
      outfile: outputPath,
    },
    format: "esm",
    minify: false,
    sourcemap: "none",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  await chmod(outputPath, 0o755);
  console.log(`Built ${path.relative(rootDir, outputPath)} (compiled)`);
}

async function buildTargets(targets, minify) {
  const result = await Bun.build({
    entrypoints: targets.map((t) => t.entrypoint),
    format: "esm",
    minify,
    sourcemap: "none",
    target: "bun",
    bundle: true,
    write: false,
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  for (const target of targets) {
    const artifact = result.outputs.find((o) => o.path.endsWith(target.suffix));
    if (!artifact) {
      throw new Error(`Build succeeded but ${target.suffix} was not emitted.`);
    }

    let builtSource = await artifact.text();
    if (builtSource.startsWith(SHEBANG)) {
      builtSource = builtSource.slice(SHEBANG.length).replace(/^\r?\n/, "");
    }

    await writeFile(target.output, `${SHEBANG}\n\n${builtSource}`, "utf8");
    await chmod(target.output, 0o755);
    console.log(`Built ${path.relative(rootDir, target.output)}${minify ? " (minified)" : ""}`);
  }
}

const nonMinifiedTargets = [
  { entrypoint: path.join(rootDir, "src", "loop-cli.ts"), output: path.join(outputBase, "ah-loop"), suffix: "loop-cli.js" },
  { entrypoint: path.join(rootDir, "src", "run-state-cli.ts"), output: path.join(outputBase, "ah-run-state"), suffix: "run-state-cli.js" },
  { entrypoint: path.join(rootDir, "src", "memory-cli.ts"), output: path.join(outputBase, "ah-memory"), suffix: "memory-cli.js" },
];

const minifiedTargets = [
  { entrypoint: path.join(rootDir, "src", "cli.ts"), output: path.join(rootDir, "bin", "setup"), suffix: "cli.js" },
];

await buildVisualizerFrontend();
await compileVisualizerCli();
await buildTargets(nonMinifiedTargets, false);
await buildTargets(minifiedTargets, true);
