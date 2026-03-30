import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

export async function buildVisualizerToSource(): Promise<void> {
  const srcDir = path.join(import.meta.dir, "..", "visualizer");
  const outDir = srcDir;

  const result = await Bun.build({
    entrypoints: [path.join(srcDir, "main.tsx")],
    external: ["react", "react-dom", "react-dom/client"],
    format: "esm",
    minify: false,
    outdir: outDir,
    sourcemap: "none",
    target: "browser",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Failed to build visualizer.");
  }
}

export async function buildVisualizer(rootDir: string, outDir: string): Promise<void> {
  await rm(outDir, { force: true, recursive: true });
  await mkdir(outDir, { recursive: true });

  const srcHtml = path.join(rootDir, "src", "visualizer", "index.html");

  const result = await Bun.build({
    entrypoints: [path.join(rootDir, "src", "visualizer", "main.tsx")],
    external: ["react", "react-dom", "react-dom/client"],
    format: "esm",
    minify: false,
    outdir: outDir,
    sourcemap: "none",
    target: "browser",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error("Failed to build visualizer.");
  }

  await copyFile(srcHtml, path.join(outDir, "index.html"));
}
