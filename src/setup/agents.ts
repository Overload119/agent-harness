import path from "node:path";

import { readTextIfExists } from "./fs";

const MEMORY_SECTION = `\`\`\`agent-harness-memory
## Agent Harness Memory

The agent harness uses plain Markdown files for memory storage under \`.agent-harness/memory/\`.

### Memory Categories

| Category | Description |
|----------|-------------|
| BACKEND | Backend architecture, APIs, and server-side patterns |
| FRONTEND | UI components, frontend architecture, and rendering |
| ARCHITECTURE | System design, infrastructure, and cross-cutting concerns |
| PRODUCT | Product requirements, specs, and feature documentation |
| BUSINESS | Business logic, rules, and domain knowledge |
| USER_PREFERENCES | User settings, configuration, and personalization |

### File Structure

- \`.agent-harness/memory/\` - Contains 6 category Markdown files
- Each file stores entries as Markdown sections separated by \`---\`
- 500-line soft cap per file; exceeding triggers consolidation

### Commands

- \`ah-memory search <query>\` - Search memory entries across categories
- \`ah-memory consolidate\` - Validate and compact memory files
- \`ah-memory consolidate --dry\` - Preview consolidation without writing

### Notes

- Memory entries are auto-consolidated every 10 tool executions
- Use \`ah-compound\` to add new entries to the appropriate category
\`\`\`

`;

export async function ensureAgentsMdEntry(targetRoot: string, dryRun: boolean): Promise<boolean> {
  const agentsPath = path.join(targetRoot, "AGENTS.md");
  const content = await readTextIfExists(agentsPath);

  const startMarker = "```agent-harness-memory";
  const endMarker = "```";

  const startIdx = content.indexOf(startMarker);
  const endIdx = startIdx !== -1 ? content.indexOf(endMarker, startIdx) : -1;

  if (startIdx !== -1 && endIdx !== -1) {
    const existingSection = content.substring(startIdx, endIdx + endMarker.length);
    if (existingSection === MEMORY_SECTION) {
      return false;
    }
    const nextContent = content.substring(0, startIdx) + MEMORY_SECTION + content.substring(endIdx + endMarker.length);
    if (dryRun) {
      console.log(`Would update AGENTS.md: replace agent-harness section`);
      return true;
    }
    await Bun.write(agentsPath, nextContent);
    console.log(`Updated AGENTS.md: replaced agent-harness section`);
    return true;
  }

  const insertBefore = "## Build And Visualizer Rules";
  const insertBeforeIdx = content.indexOf(insertBefore);
  let insertAt;
  if (insertBeforeIdx !== -1) {
    insertAt = insertBeforeIdx;
  } else {
    insertAt = content.length;
    if (insertAt > 0 && !content.endsWith("\n")) {
      insertAt = content.lastIndexOf("\n") + 1;
    }
  }

  const nextContent = content.substring(0, insertAt) + MEMORY_SECTION + content.substring(insertAt);

  if (dryRun) {
    console.log(`Would update AGENTS.md: add agent-harness section`);
    return true;
  }
  await Bun.write(agentsPath, nextContent);
  console.log(`Updated AGENTS.md: added agent-harness section`);
  return true;
}
