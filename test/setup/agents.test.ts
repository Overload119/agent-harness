import { expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

test("ensureAgentsMdEntry: adds memory section when markers are absent", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ah-agents-test-"));
  try {
    const agentsPath = path.join(tmpDir, "AGENTS.md");
    const initialContent = `## Skill Sources And Installs

- Some existing content

## Build And Visualizer Rules

- Some other content
`;
    await writeFile(agentsPath, initialContent, "utf8");

    const { ensureAgentsMdEntry } = await import("../../src/setup/agents");
    const result = await ensureAgentsMdEntry(tmpDir, false);

    expect(result).toBe("added");

    const afterRun = await readFile(agentsPath, "utf8");
    expect(afterRun).toContain("<!-- agent-harness-memory -->");
    expect(afterRun).toContain("<!-- /agent-harness-memory -->");
    expect(afterRun.match(/<!-- agent-harness-memory -->/g) || []).toHaveLength(1);
    expect(afterRun).toContain("## Agent Harness Memory");
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry: returns skipped when section is unchanged", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ah-agents-test-"));
  try {
    const agentsPath = path.join(tmpDir, "AGENTS.md");
    const { ensureAgentsMdEntry } = await import("../../src/setup/agents");

    const initialContent = `## Skill Sources And Installs

## Build And Visualizer Rules

- Some other content
`;

    await writeFile(agentsPath, initialContent, "utf8");
    await ensureAgentsMdEntry(tmpDir, false);

    const afterFirstRun = await readFile(agentsPath, "utf8");
    expect(afterFirstRun).toContain("<!-- agent-harness-memory -->");
    expect(afterFirstRun).toContain("<!-- /agent-harness-memory -->");

    const result = await ensureAgentsMdEntry(tmpDir, false);
    expect(result).toBe("skipped");
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry: replaces section when content differs", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ah-agents-test-"));
  try {
    const agentsPath = path.join(tmpDir, "AGENTS.md");

    const initialContent = `## Skill Sources And Installs

<!-- agent-harness-memory -->
\`\`\`agent-harness-memory
## Agent Harness Memory
OLD CONTENT
\`\`\`
<!-- /agent-harness-memory -->

## Build And Visualizer Rules

- Some other content
`;
    await writeFile(agentsPath, initialContent, "utf8");

    const { ensureAgentsMdEntry } = await import("../../src/setup/agents");
    const result = await ensureAgentsMdEntry(tmpDir, false);

    expect(result).toBe("updated");

    const afterRun = await readFile(agentsPath, "utf8");
    expect(afterRun).not.toContain("OLD CONTENT");
    expect(afterRun).toContain("## Agent Harness Memory");
    expect(afterRun.match(/<!-- agent-harness-memory -->/g) || []).toHaveLength(1);
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry: dry run does not modify file", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ah-agents-test-"));
  try {
    const agentsPath = path.join(tmpDir, "AGENTS.md");
    const initialContent = `## Skill Sources And Installs

- Some existing content

## Build And Visualizer Rules

- Some other content
`;
    await writeFile(agentsPath, initialContent, "utf8");

    const { ensureAgentsMdEntry } = await import("../../src/setup/agents");
    const result = await ensureAgentsMdEntry(tmpDir, true);

    expect(result).toBe("added");

    const afterRun = await readFile(agentsPath, "utf8");
    expect(afterRun).toBe(initialContent);
    expect(afterRun).not.toContain("<!-- agent-harness-memory -->");
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});

test("ensureAgentsMdEntry: is idempotent - multiple runs produce same result", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ah-agents-test-"));
  try {
    const agentsPath = path.join(tmpDir, "AGENTS.md");
    const initialContent = `## Skill Sources And Installs

- Some existing content

## Build And Visualizer Rules

- Some other content
`;
    await writeFile(agentsPath, initialContent, "utf8");

    const { ensureAgentsMdEntry } = await import("../../src/setup/agents");

    const r1 = await ensureAgentsMdEntry(tmpDir, false);
    expect(r1).toBe("added");

    const r2 = await ensureAgentsMdEntry(tmpDir, false);
    expect(r2).toBe("skipped");

    const r3 = await ensureAgentsMdEntry(tmpDir, false);
    expect(r3).toBe("skipped");

    const finalContent = await readFile(agentsPath, "utf8");
    expect(finalContent.match(/<!-- agent-harness-memory -->/g) || []).toHaveLength(1);
  } finally {
    await rm(tmpDir, { force: true, recursive: true });
  }
});
