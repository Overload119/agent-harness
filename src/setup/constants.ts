import { HARNESS_DIR_NAME } from "../harness/paths";
import path from "node:path";

export const HARNESS_PATH = HARNESS_DIR_NAME;

async function getMemoryCategories(): Promise<string> {
  const sourceDir = path.resolve(import.meta.dir, "..", "skills", "ah-memory");
  const filePath = path.join(sourceDir, "_memory-categories.md.liquid");
  return await Bun.file(filePath).text();
}

export const TEMPLATE_VARIABLES = {
  path: HARNESS_PATH,
  memory_categories: await getMemoryCategories(),
};
