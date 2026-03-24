import { expect, test } from "bun:test";

import { extractMermaidSource, renderMermaidArtifactHtml } from "../../src/harness/mermaid";

test("extractMermaidSource pulls Mermaid from fenced markdown", () => {
  const source = extractMermaidSource([
    "# Release plan",
    "",
    "```mermaid",
    "flowchart LR",
    "  plan[Plan] --> build[Build]",
    "  build --> verify[Verify]",
    "  verify --> ship[Ship]",
    "```",
  ].join("\n"));

  expect(source).toContain("flowchart LR");
  expect(source).toContain("plan[Plan] --> build[Build]");
});

test("renderMermaidArtifactHtml renders a plan flow as inline svg", () => {
  const html = renderMermaidArtifactHtml([
    "```mermaid",
    "flowchart LR",
    "  backlog[Backlog] --> plan[Plan]",
    "  plan --> implement[Implement]",
    "  implement --> verify[Verify]",
    "  verify --> ship[Ship]",
    "```",
  ].join("\n"));

  expect(html).toContain("<!doctype html>");
  expect(html).toContain("<svg");
  expect(html).toContain("Mermaid source");
  expect(html).toContain("Backlog");
  expect(html).toContain("Plan");
});
