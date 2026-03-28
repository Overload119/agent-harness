import { expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { ensureAgentsMdEntry } from "../../src/setup/agents";

async function createTargetRepo(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test("ensureAgentsMdEntry removes duplicate agent-harness-memory section when fixing malformed AGENTS.md", async () => {
  const targetRoot = await createTargetRepo("ah-agents-dup-");

  try {
    const malformedContent = `## Skill Sources And Installs

\`\`\`agent-harness-memory
## Agent Harness Memory

Old fenced content
\`\`\`

agent-harness-memory
## Agent Harness Memory

Old plain text content

## Build And Visualizer Rules

- Rules here.
`;

    const agentsPath = path.join(targetRoot, "AGENTS.md");
    await writeFile(agentsPath, malformedContent, "utf8");

    await ensureAgentsMdEntry(targetRoot, false);

    const finalContent = await readFile(agentsPath, "utf8");

    expect(finalContent).toContain("<agent-harness>");
    expect(finalContent).not.toContain("Old fenced content");
    expect(finalContent).not.toContain("Old plain text content");
    expect(finalContent).not.toContain("```agent-harness-memory");
    const count = (finalContent.match(/agent-harness-memory/g) || []).length;
    expect(count).toBe(0);
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry replaces properly formatted existing section", async () => {
  const targetRoot = await createTargetRepo("ah-agents-proper-");

  try {
    const properlyFormatted = `## Skill Sources And Installs

<agent-harness>
## Agent Harness Memory

Old content
</agent-harness>

## Build And Visualizer Rules

- Rules here.
`;

    const agentsPath = path.join(targetRoot, "AGENTS.md");
    await writeFile(agentsPath, properlyFormatted, "utf8");

    await ensureAgentsMdEntry(targetRoot, false);

    const finalContent = await readFile(agentsPath, "utf8");

    expect(finalContent).toContain("<agent-harness>");
    expect(finalContent).toContain("Agent Harness Memory");
    expect(finalContent).toContain("Memory entries are auto-consolidated");
    expect(finalContent).not.toContain("Old content");
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry adds section when missing", async () => {
  const targetRoot = await createTargetRepo("ah-agents-add-");

  try {
    const withoutMemorySection = `## Skill Sources And Installs

## Build And Visualizer Rules

- Rules here.
`;

    const agentsPath = path.join(targetRoot, "AGENTS.md");
    await writeFile(agentsPath, withoutMemorySection, "utf8");

    await ensureAgentsMdEntry(targetRoot, false);

    const finalContent = await readFile(agentsPath, "utf8");

    expect(finalContent).toContain("<agent-harness>");
    expect(finalContent).toContain("## Agent Harness Memory");
    expect(finalContent).toContain("## Build And Visualizer Rules");
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry is idempotent when section already correct", async () => {
  const targetRoot = await createTargetRepo("ah-agents-idempotent-");

  try {
    const correctContent = `## Skill Sources And Installs

<agent-harness>
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
</agent-harness>

## Build And Visualizer Rules

- Rules here.
`;

    const agentsPath = path.join(targetRoot, "AGENTS.md");
    await writeFile(agentsPath, correctContent, "utf8");

    const result = await ensureAgentsMdEntry(targetRoot, false);

    expect(result).toBe(false);

    const finalContent = await readFile(agentsPath, "utf8");
    expect(finalContent).toContain("<agent-harness>");
    expect(finalContent).toContain("## Agent Harness Memory");
  } finally {
    await rm(targetRoot, { force: true, recursive: true });
  }
});
