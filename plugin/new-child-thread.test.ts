import type { NewThreadRequest } from "@get-bb/plugin-sdk/app";
import { expect, test } from "bun:test";
import { createFakeSdk, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import { spawnChildThread, type ChildThreadOptions } from "./new-child-thread";

const defaults: ChildThreadOptions = { providerId: "claude-code", parentNotifications: "auto", stayOnCurrentPage: false };
const parent = makeThreadResponse({ id: "selected-parent", projectId: "selected-project", providerId: "claude-code", environmentId: "selected-environment", canSpawnChild: true });

const request = (text = "task", overrides: Partial<NewThreadRequest> = {}): NewThreadRequest => ({
  projectId: parent.projectId,
  environment: { type: "reuse", environmentId: parent.environmentId! },
  providerId: "claude-code", model: "chosen-model", reasoningLevel: "high",
  permissionMode: "auto", serviceTier: "default",
  sessionOptions: { customOption: true },
  executionInputSources: { providerId: "explicit", model: "explicit" },
  input: [{ type: "text", text, mentions: [] }],
  ...overrides,
});

test("forwards native composer selections and rich input under the selected parent", async () => {
  const { sdk, harness } = createFakeSdk({ pluginId: "agent-harness", overrides: { threads: {
    get: async () => parent,
    spawn: async () => makeThreadResponse({ id: "new-child", parentThreadId: parent.id }),
  } } });
  const prompt = "Preserve `code`, $values, and\n  indentation. ";
  const composed = request(prompt, { input: [
    { type: "text", text: "/review " + prompt, mentions: [{ start: 0, end: 7, resource: {
      kind: "command", source: "skill", name: "review", label: "review", origin: "user", trigger: "/", argumentHint: null,
    } }] },
    { type: "localFile", path: "/attachment.txt", name: "attachment.txt" },
  ] });
  expect((await spawnChildThread(sdk, parent, composed, defaults)).id).toBe("new-child");
  expect(harness.callsTo("threads.get")).toEqual([[{ threadId: parent.id }]]);
  expect(harness.callsTo("threads.spawn")).toEqual([[{
    ...composed, parentThreadId: parent.id, parentNotifications: "auto",
    origin: "plugin", originPluginId: "agent-harness",
  }]]);
});

test("empty prompts, unavailable parents, and changed destinations never create a child", async () => {
  for (const changes of [{ canSpawnChild: false }, { archivedAt: 1 }, { deletedAt: 1 }, { environmentId: null }, { environmentId: "moved" }, { providerId: "codex" }, { projectId: "moved" }]) {
    const { sdk, harness } = createFakeSdk({ pluginId: "agent-harness", overrides: { threads: { get: async () => ({ ...parent, ...changes }) } } });
    await expect(spawnChildThread(sdk, parent, request(), defaults)).rejects.toThrow();
    expect(harness.callsTo("threads.spawn")).toHaveLength(0);
  }
  const { sdk, harness } = createFakeSdk({ pluginId: "agent-harness" });
  await expect(spawnChildThread(sdk, parent, request(" \n "), defaults)).rejects.toThrow("Enter a prompt");
  expect(harness.calls).toHaveLength(0);
});

test("creation errors propagate without automatic retries", async () => {
  const { sdk, harness } = createFakeSdk({ pluginId: "agent-harness", overrides: { threads: {
    get: async () => parent, spawn: async () => { throw new Error("Host disconnected"); },
  } } });
  await expect(spawnChildThread(sdk, parent, request(), defaults)).rejects.toThrow("Host disconnected");
  expect(harness.callsTo("threads.spawn")).toHaveLength(1);
});


test("passes every notification mode and the composer-selected execution settings", async () => {
  for (const parentNotifications of ["auto", "stuck", "off"] as const) {
    const { sdk, harness } = createFakeSdk({ pluginId: "agent-harness", overrides: { threads: {
      get: async () => parent, spawn: async () => makeThreadResponse(),
    } } });
    await spawnChildThread(sdk, parent, request("task", { providerId: "codex" }), { parentNotifications });
    const submitted = harness.callsTo("threads.spawn")[0][0];
    expect(submitted).toMatchObject({ providerId: "codex", parentNotifications, parentThreadId: parent.id });
    expect(submitted).toMatchObject({ model: "chosen-model", reasoningLevel: "high", serviceTier: "default" });
  }
});


test("rejects different project and workspace selections before spawning", async () => {
  for (const override of [
    { projectId: "other-project" },
    { environment: { type: "reuse", environmentId: "other-workspace" } },
    { environment: { type: "project-default" } },
  ] satisfies Partial<NewThreadRequest>[]) {
    const { sdk, harness } = createFakeSdk({ pluginId: "agent-harness" });
    await expect(spawnChildThread(sdk, parent, request("task", override), defaults)).rejects.toThrow("parent's project and workspace");
    expect(harness.calls).toHaveLength(0);
  }
});
