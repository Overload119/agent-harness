import { expect, test } from "bun:test";
import { createFakePluginHost, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import plugin from "../../server";
import { STANDING_INSTRUCTIONS } from "../../src/plugin/instructions";

test("plugin supplies standing instructions without editing files or starting work", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness" });
  try {
    await plugin(bb);
    const instructions = harness.registrations.instructionProvider!({threadId: "origin", projectId: "project"});
    expect(instructions).toContain(STANDING_INSTRUCTIONS);
    expect(STANDING_INSTRUCTIONS.length).toBeLessThanOrEqual(4096);
    for (const skill of ["restate", "unsure", "adhd", "thread-routing", "completion-focus"]) {
      expect(instructions).toContain(skill);
    }
    expect(harness.inspection.sdk.calls).toEqual([]);
    await harness.behavior.setSettings({ standingInstructions: false });
    expect(harness.registrations.instructionProvider!({threadId: "origin", projectId: "project"})).toBeNull();
    await harness.behavior.setSettings({ standingInstructions: true });
    expect(harness.registrations.instructionProvider!({threadId: "origin", projectId: "project"})).toBe(instructions);
  } finally { await harness.lifecycle.dispose(); }
});

test("the all-in-one plugin can create, list, archive and restore its own side chats", async () => {
  const source = makeThreadResponse({ id: "main", environmentId: "workspace" });
  let child = makeThreadResponse({ id: "question", sourceThreadId: "main", lifecycleOwnerThreadId: "main",
    originKind: "fork", originPluginId: "agent-harness", visibility: "hidden" });
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness", sdk: { threads: {
    get: async ({ threadId }) => threadId === "main" ? source : child,
    fork: async () => child,
    list: async () => [child],
    events: { list: async () => [] },
    queuedMessages: { list: async () => [] },
    archive: async () => { child = { ...child, archivedAt: 1 }; return { ok: true }; },
    unarchive: async () => { child = { ...child, archivedAt: null }; return { ok: true }; },
  } } });
  try {
    await plugin(bb);
    expect(await harness.behavior.callRpc("newQuestion", { sourceThreadId: "main" })).toMatchObject({ threadId: "question" });
    expect(harness.inspection.sdk.callsTo("threads.fork")[0]).toEqual([{
      sourceThreadId: "main", lifecycleOwnerThreadId: "main", visibility: "hidden", title: "New chat",
      origin: "plugin", originPluginId: "agent-harness",
    }]);
    expect(await harness.behavior.callRpc("questions", { sourceThreadId: "main" })).toMatchObject({ items: [{ threadId: "question" }] });
    await harness.behavior.callRpc("archiveQuestion", { sourceThreadId: "main", threadId: "question" });
    expect(child.archivedAt).toBe(1);
    await harness.behavior.callRpc("restoreQuestion", { sourceThreadId: "main", threadId: "question" });
    expect(child.archivedAt).toBeNull();
  } finally { await harness.lifecycle.dispose(); }
});
