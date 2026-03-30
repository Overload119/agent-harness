import path from "node:path";

import type { PrdCard, RunCard } from "./cards";

const FILE_ROUTE = "/__ah_vis__/file";

function normalizeFileName(filePath: string): string {
  return filePath ? path.basename(filePath) : "";
}

export function matchPrdCard(run: RunCard, cards: PrdCard[]): PrdCard | null {
  const cardsInWorkspace = cards.filter((card) => card.workspacePath === run.workspacePath);
  if (cardsInWorkspace.length === 0) {
    return null;
  }

  const prdFileName = normalizeFileName(run.prdPath);
  if (prdFileName) {
    const exactMatch = cardsInWorkspace.find((card) => card.fileName === prdFileName);
    if (exactMatch) {
      return exactMatch;
    }
  }

  return cardsInWorkspace[0] || null;
}

export function fileProxyUrl(filePath: string): string {
  if (!filePath) {
    return "";
  }
  return `${FILE_ROUTE}?path=${encodeURI(filePath)}`;
}

export function fileUrlFromAbsolutePath(filePath: string): string {
  return filePath ? `file://${encodeURI(filePath)}` : "";
}
