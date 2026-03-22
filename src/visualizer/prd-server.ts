import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { cardFromDocument, invalidCard, type PrdCard, type PrdDocument } from "./cards";

export async function loadPrdCardsFromDirectory(rootDir: string): Promise<PrdCard[]> {
  const prdDir = path.join(rootDir, ".agent-harness", "prds");

  try {
    const entries = await readdir(prdDir, { withFileTypes: true });
    const cards = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const filePath = path.join(prdDir, entry.name);
          const text = await readFile(filePath, "utf8");
          const stats = await Bun.file(filePath).stat();

          try {
            return cardFromDocument(entry.name, stats.mtimeMs, JSON.parse(text) as PrdDocument);
          } catch (error) {
            return invalidCard(entry.name, stats.mtimeMs, error);
          }
        }),
    );

    return cards.sort((left, right) => right.lastModified - left.lastModified);
  } catch {
    return [];
  }
}
