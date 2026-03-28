---
name: ah-mermaid
description: Create Mermaid diagrams from plans, workflows, or architecture ideas, render them to a standalone HTML artifact with an inline SVG from `beautiful-mermaid`, and keep both source and rendered artifacts in the harness. Use when the user wants a visual diagram, flowchart, sequence, or architecture view captured as a harness artifact.
---

Turn a plan, workflow, or architecture idea into a durable Mermaid visualization.

Your job is to produce a diagram that is easy to scan, keep the Mermaid source in the harness, render it into a local HTML artifact that can be opened in a browser, and explain the essence without overcomplicating the graph.

Behavior:

1. Determine the diagram goal:
   - plan flow
   - runtime lifecycle
   - system architecture
   - sequence of interactions
2. Choose the simplest Mermaid format that matches the request:
   - `flowchart` for plans, state transitions, and control flow
   - `sequenceDiagram` for actor interactions
   - `stateDiagram-v2` for lifecycle/state machines
   - `graph LR` or `flowchart LR` for architecture overviews
3. Keep the source of truth in the harness:
   - write Mermaid source to `./.agent-harness/diagrams/<slug>.md`
   - prefer a fenced ```mermaid block so the source is readable in markdown
4. Create a browser-renderable artifact:
   - write HTML to `./.generated/diagrams/<slug>.html`
   - use the `render-mermaid.ts` script to render with beautiful-mermaid:
     ```
     bun skills/mermaid/scripts/render-mermaid.ts <source.md> <output.html> [title]
     ```
   - inline the generated `<svg>` into the HTML instead of relying on client-side Mermaid bootstrapping
   - keep the HTML standalone so it can be opened directly with the system browser
   - if the source came from a plan, preserve the plan order and milestone names in the rendered diagram
5. If the user asks to open or preview it:
   - open the generated HTML artifact locally
6. If the user wants a canvas-like editable diagram rather than Mermaid:
   - say Mermaid is the default harness-native path
   - mention that Excalidraw-style skills may be a better fit for freeform canvas editing

**beautiful-mermaid API notes:**

- Import: `import { renderMermaidSVG } from 'beautiful-mermaid'`
- Mermaid source uses `\n` newlines as line separators (not semicolons)
- Header line must be on its own line (e.g., `graph TD\n A --> B`, NOT `graph TD; A-->B;`)
- Use bun to run rendering scripts (not node)
- Options: `{ bg, fg, transparent, font }` for theming, e.g., `renderMermaidSVG(src, { bg: '#16213e', fg: '#a9b1d6' })`

Diagram rules:

- Optimize for essence, not exhaustiveness.
- For plans, prefer a left-to-right flow that matches execution order.
- Keep node labels short and concrete.
- Split major concerns into subgraphs when helpful.
- Avoid crossing lines and giant walls of text when a simpler structure works.
- Prefer one diagram per core idea rather than one massive omnibus graph.
- Keep both the markdown source and the rendered HTML artifact.

Output format:

- Diagram goal
- Mermaid type chosen
- Source path
- Rendered path
- Key takeaway

When relevant, note that the harness convention is:

- source diagrams in `./.agent-harness/diagrams/`
- rendered browser artifacts in `./.generated/diagrams/`
