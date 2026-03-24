import { renderMermaidSVG } from "beautiful-mermaid";

const MERMAID_FENCE_PATTERN = /```mermaid\s*([\s\S]*?)```/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function extractMermaidSource(input: string): string {
  const match = MERMAID_FENCE_PATTERN.exec(input);
  const source = (match?.[1] ?? input).trim();

  if (!source) {
    throw new Error("Mermaid source cannot be empty.");
  }

  return source;
}

export function renderMermaidArtifactHtml(input: string): string {
  const source = extractMermaidSource(input);
  const svg = renderMermaidSVG(source, {
    bg: "#f8fafc",
    fg: "#0f172a",
    line: "#475569",
    accent: "#0f766e",
    muted: "#64748b",
    surface: "#e2e8f0",
    border: "#94a3b8",
    font: "Iowan Old Style, Georgia, serif",
    padding: 32,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mermaid Diagram</title>
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        padding: 24px;
        font-family: "Iowan Old Style", Georgia, serif;
        background:
          radial-gradient(circle at top, rgba(15, 118, 110, 0.12), transparent 32%),
          linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
        color: #0f172a;
      }

      main {
        width: min(100%, 1200px);
        margin: 0 auto;
        padding: 20px;
        border: 1px solid rgba(148, 163, 184, 0.6);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      }

      .diagram svg {
        display: block;
        width: 100%;
        height: auto;
      }

      details {
        margin-top: 16px;
      }

      pre {
        overflow-x: auto;
        padding: 16px;
        border-radius: 16px;
        background: #e2e8f0;
        color: #0f172a;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="diagram">${svg}</section>
      <details>
        <summary>Mermaid source</summary>
        <pre>${escapeHtml(source)}</pre>
      </details>
    </main>
  </body>
</html>`;
}
