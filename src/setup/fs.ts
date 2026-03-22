import { createHash } from "node:crypto";
import { access } from "node:fs/promises";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "";
  }

  return Bun.file(filePath).text();
}

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(await Bun.file(filePath).bytes());
  return hash.digest("hex");
}

export function hashContent(content: string): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}
