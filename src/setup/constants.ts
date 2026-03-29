import { HARNESS_DIR_NAME } from "../harness/paths";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HARNESS_PATH = HARNESS_DIR_NAME;

function getRepoRoot(): string {
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  let repoRoot = path.resolve(scriptDir, "..");
  if (path.basename(repoRoot) === ".agent-harness") {
    repoRoot = path.resolve(repoRoot, "..");
  }
  return repoRoot;
}

async function getMemoryCategories(repoRoot: string): Promise<string> {
  const sourceDir = path.join(repoRoot, "skills", "ah-memory");
  const filePath = path.join(sourceDir, "_memory-categories.md.liquid");
  try {
    return await Bun.file(filePath).text();
  } catch {
    return "";
  }
}

export async function createTemplateVariables(repoRoot: string): Promise<{
  path: string;
  bin_path: string;
  memory_categories: string;
}> {
  return {
    path: HARNESS_PATH,
    bin_path: path.join(HARNESS_PATH, "bin"),
    memory_categories: await getMemoryCategories(repoRoot),
  };
}
