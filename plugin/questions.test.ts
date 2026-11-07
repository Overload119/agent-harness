import { expect, test } from "bun:test";
import { createFakePluginHost, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import plugin from "../server";
import { questionText } from "./questions";

type Event = Awaited<ReturnType<BbPluginApi["sdk"]["threads"]["events"]["list"]>>[number];
const input = (text: string) => [{ type: "text" as const, text, mentions: [] }];
function request(threadId: string, seq: number, text: string, initiator = "user"): Event {
  return { id: `event-${seq}`, scope: { kind: "thread" }, threadId, seq, createdAt: seq,
    type: "client/turn/requested", data: { direction: "outbound", requestId: `request-${seq}`,
      source: "send", initiator, senderThreadId: null, input: input(text), target: { kind: "new-turn" },
      request: { method: "turn/start", params: {} }, execution: {} } } as Event;
}
function sideChat(id: string, overrides = {}) {
  return makeThreadResponse({ id, sourceThreadId: "main", lifecycleOwnerThreadId: "main", originKind: "fork",
    originPluginId: "agent-harness", visibility: "hidden", ...overrides });
}

test("archive and undo target only related side chats and preserve archived parent state", async () => {
  let chat = sideChat("question");
  let source = makeThreadResponse({ id: "main" });
  let failArchive = false;
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness", sdk: { threads: {
    get: async ({ threadId }) => threadId === "main" ? source : chat,
    archive: async ({ threadId }) => {
      if (failArchive) throw new Error("Archive failed");
      chat = sideChat(threadId, { archivedAt: 1 });
      return { ok: true };
    },
    unarchive: async ({ threadId }) => { chat = sideChat(threadId); return { ok: true }; },
  } } });
  const target = { sourceThreadId: "main", threadId: "question" };
  try {
    await plugin(bb);
    expect(await harness.behavior.callRpc("archiveQuestion", target)).toEqual({ changed: true });
    await harness.behavior.callRpc("archiveQuestion", target);
    expect(harness.inspection.sdk.callsTo("threads.archive")).toEqual([[{ threadId: "question" }]]);
    expect(await harness.behavior.callRpc("restoreQuestion", target)).toEqual({ changed: true });
    await harness.behavior.callRpc("restoreQuestion", target);
    expect(harness.inspection.sdk.callsTo("threads.unarchive")).toEqual([[{ threadId: "question" }]]);
    for (const override of [{ sourceThreadId: "other" }, { visibility: "visible" },
      { originPluginId: "other" }, { originKind: null }, { deletedAt: 1 }]) {
      chat = sideChat("question", override);
      for (const method of ["archiveQuestion", "restoreQuestion"]) {
        await expect(harness.behavior.callRpc(method, target)).rejects.toThrow("does not belong");
      }
    }
    chat = sideChat("question", { archivedAt: 1, originPluginId: "side-chat" });
    source = makeThreadResponse({ id: "main", archivedAt: 1 });
    await expect(harness.behavior.callRpc("restoreQuestion", target)).rejects.toThrow("Restore the main thread");
    source = makeThreadResponse({ id: "main" });
    await harness.behavior.callRpc("restoreQuestion", target);
    expect(chat.archivedAt).toBeNull();
    failArchive = true;
    await expect(harness.behavior.callRpc("archiveQuestion", target)).rejects.toThrow("Archive failed");
    expect(chat.archivedAt).toBeNull();
    await expect(harness.behavior.callRpc("archiveQuestion", { sourceThreadId: "main", threadId: "main" })).rejects.toThrow("does not belong");
    await expect(harness.behavior.callRpc("archiveQuestion", { ...target, threadId: "" })).rejects.toThrow();
  } finally { await harness.lifecycle.dispose(); }
});

test("question RPC preserves fork context and lifecycle; invalid sources do not fork", async () => {
  let source = makeThreadResponse({ id: "main", environmentId: "workspace" });
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness", sdk: { threads: {
    get: async () => source, fork: async () => sideChat("question"),
  } } });
  try {
    await plugin(bb);
    expect(await harness.behavior.callRpc("newQuestion", { sourceThreadId: "main" })).toMatchObject({ threadId: "question", question: null });
    expect(harness.inspection.sdk.callsTo("threads.fork")[0]).toEqual([{
      sourceThreadId: "main", lifecycleOwnerThreadId: "main", visibility: "hidden", title: "New chat",
      origin: "plugin", originPluginId: "agent-harness",
    }]);
    for (const change of [{ archivedAt: 1 }, { deletedAt: 1 }, { environmentId: null }]) {
      source = makeThreadResponse({ id: "main", environmentId: "workspace", ...change });
      await expect(harness.behavior.callRpc("newQuestion", { sourceThreadId: "main" })).rejects.toThrow("Restore this thread");
    }
    expect(harness.inspection.sdk.callsTo("threads.fork")).toHaveLength(1);
    await expect(harness.behavior.callRpc("newQuestion", { sourceThreadId: "" })).rejects.toThrow();
  } finally { await harness.lifecycle.dispose(); }
});

test("lists old and new side chats by original local question; isolates unrelated threads and read failures", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness", sdk: { threads: {
    list: async () => [sideChat("question"), sideChat("old", { originPluginId: "side-chat" }),
      sideChat("extracted", { originPluginId: "brain-shortcut" }), sideChat("broken"),
      sideChat("other-source", { sourceThreadId: "elsewhere" }), sideChat("visible", { visibility: "visible" }),
      sideChat("other-plugin", { originPluginId: "unrelated" }), sideChat("archived", { archivedAt: 1 })],
    events: { list: async ({ threadId }) => {
      if (threadId === "broken") throw new Error("Read failed");
      return [request("main", 1, "Inherited source text"), request(threadId, 2, "Agent seed", "agent"),
        request(threadId, 3, `Original ${threadId}?`), request(threadId, 4, "Later follow-up")];
    } },
  } } });
  try {
    await plugin(bb);
    expect(await harness.behavior.callRpc("questions", { sourceThreadId: "main" })).toMatchObject({ items: [
      { threadId: "question", question: "Original question?", error: null },
      { threadId: "old", question: "Original old?", error: null },
      { threadId: "extracted", question: "Original extracted?", error: null },
      { threadId: "broken", question: null, error: "Could not load this question." },
    ], nextOffset: null });
    expect(harness.inspection.sdk.callsTo("threads.list")[0]).toEqual([{
      sourceThreadId: "main", originKind: "fork", includeHidden: true, archived: false, limit: 21, offset: 0,
    }]);
    expect(harness.inspection.sdk.callsTo("threads.events.list")).toHaveLength(4);
  } finally { await harness.lifecycle.dispose(); }
});

test("paginates requests and thread rows without replacing the original question", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness", sdk: { threads: {
    list: async () => Array.from({ length: 21 }, (_, i) => sideChat(`question-${i}`)),
    events: { list: async ({ threadId, afterSeq }) => afterSeq === "0"
      ? Array.from({ length: 20 }, (_, i) => request(threadId, i + 1, "Agent context", "agent"))
      : [request(threadId, 21, "First actual question?")] },
  } } });
  try {
    await plugin(bb);
    const result = await harness.behavior.callRpc("questions", { sourceThreadId: "main", offset: 20 }) as { items: { question: string }[]; nextOffset: number };
    expect(result.items).toHaveLength(20);
    expect(result.items.every(item => item.question === "First actual question?")).toBe(true);
    expect(result.nextOffset).toBe(40);
    await expect(harness.behavior.callRpc("questions", { sourceThreadId: "main", offset: -1 })).rejects.toThrow();
  } finally { await harness.lifecycle.dispose(); }
});

test("drafts have no label; queued questions and attachments are visible without agent-only content", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "agent-harness", sdk: { threads: {
    list: async () => [sideChat("draft"), sideChat("queued")], events: { list: async () => [] },
    queuedMessages: { list: async ({ threadId }) => threadId === "draft" ? [] : [{
      createdAt: 1, initiator: "user", content: input("Waiting question?"),
    }] },
  } } });
  try {
    await plugin(bb);
    expect(await harness.behavior.callRpc("questions", { sourceThreadId: "main" })).toMatchObject({ items: [
      { threadId: "draft", question: null }, { threadId: "queued", question: "Waiting question?" },
    ] });
    expect(questionText([{ type: "text", text: "Secret seed", mentions: [], visibility: "agent-only" }])).toBeNull();
    expect(questionText([{ type: "image", url: "data:image/png;base64,AA==" }])).toBe("Question with attachment");
    expect(questionText(input("Question\n\nwith details?"))).toBe("Question\n\nwith details?");
  } finally { await harness.lifecycle.dispose(); }
});
