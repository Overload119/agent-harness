import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

export async function buildVisualizer(rootDir: string, outDir: string): Promise<void> {
  await rm(outDir, { force: true, recursive: true });
  await mkdir(outDir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [path.join(rootDir, "src", "visualizer", "main.tsx")],
    external: ["react", "react-dom/client"],
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

  await copyFile(path.join(rootDir, "src", "visualizer", "index.html"), path.join(outDir, "index.html"));
}
