import { chmod, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { exportHarnessSkills, exportStandingInstructions, exportPortableSkills } from "./export-skills";

const SHEBANG = "#!/usr/bin/env bun";
const rootDir = path.resolve(import.meta.dir, "..");
const outputBase = path.join(rootDir, ".agent-harness", "bin");

await mkdir(outputBase, { recursive: true });

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
  { entrypoint: path.join(rootDir, "src", "memory-cli.ts"), output: path.join(outputBase, "ah-memory"), suffix: "memory-cli.js" },
];

const minifiedTargets = [
  { entrypoint: path.join(rootDir, "src", "cli.ts"), output: path.join(rootDir, "bin", "setup"), suffix: "cli.js" },
];

await exportHarnessSkills();
await exportPortableSkills();
await exportStandingInstructions();
await buildTargets(nonMinifiedTargets, false);
await buildTargets(minifiedTargets, true);
