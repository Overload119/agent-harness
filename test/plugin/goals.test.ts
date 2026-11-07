import { afterEach, expect, test } from "bun:test";
import { createFakePluginHost, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import { registerAgentHarness } from "../../server";
import { defaultConfiguration, weekOf, type Configuration, type SetupState, type Snapshot } from "../../plugin/goals/contract";
import type { Automation, RunAutomation } from "../../plugin/goals/automation";

const disposals: (() => Promise<void>)[] = [];
afterEach(async () => { for (const dispose of disposals.splice(0)) await dispose(); });
const projectId = "proj_test", environmentId = "env_test", threadId = "thr_goals";
function config(patch: Partial<Configuration> = {}): Configuration {
  return { ...defaultConfiguration(), enabled: true, projectId, environmentId, targetThreadId: threadId,
    timezone: "America/New_York", execution: { providerId: "test", model: "model", reasoning: "medium", permissionMode: "auto" }, ...patch };
}
async function fixture() {
  const commands: string[][] = [];
  let failCreate = false, failSpawn = false, failResume = false;
  const automations = new Map<string, Automation>();
  const threads = new Map([[threadId, makeThreadResponse({ id: threadId, projectId, environmentId, providerId: "test" })]]);
  const host = createFakePluginHost({ pluginId: "agent-harness", sdk: {
    environments: { get: async ({ environmentId: id }) => ({ id, projectId: id === environmentId ? projectId : "proj_elsewhere", status: "ready" } as never) },
    projects: { get: async ({ projectId: id }) => ({ id, name: "Test project" } as never) },
    providers: { list: async () => [{ id: "test", available: true }] as never },
    threads: {
      get: async ({ threadId: id }) => { const thread = threads.get(id); if (!thread) throw new Error("Unknown thread"); return thread; },
      spawn: async () => { const thread = makeThreadResponse({ id: "thr_created", projectId, environmentId }); threads.set(thread.id, thread); if (failSpawn) throw new Error("Lost thread response"); return thread; },
      defaultExecutionOptions: async () => ({ model: "model", reasoningLevel: "medium", permissionMode: "auto", serviceTier: "default", source: "client/thread/start" }),
    },
  } });
  const run: RunAutomation = async args => {
    commands.push(args);
    const flag = (name: string) => args[args.indexOf(name) + 1];
    switch (args[0]) {
      case "list": return [...automations.values()].filter(a => a.projectId === flag("--project"));
      case "show": { const item = automations.get(args[1]); if (!item) throw new Error("Unknown automation"); return item; }
      case "create": {
        const item = { id: `auto_${automations.size + 1}`, projectId: flag("--project"), name: flag("--name"), enabled: false,
          execution: { mode: "agent", prompt: flag("--prompt"), targetThreadId: flag("--target-thread") } };
        automations.set(item.id, item);
        if (failCreate) throw new Error("Lost create response");
        return item;
      }
      case "update": {
        const item = automations.get(args[1])!;
        item.name = flag("--name"); item.execution.prompt = flag("--prompt"); item.execution.targetThreadId = flag("--target-thread"); return item;
      }
      case "pause": automations.get(args[1])!.enabled = false; return {};
      case "resume": if (failResume) throw new Error("Resume unavailable"); automations.get(args[1])!.enabled = true; return {};
      default: throw new Error(`Unexpected command ${args[0]}`);
    }
  };
  await registerAgentHarness(host.bb, run);
  disposals.push(() => host.harness.lifecycle.dispose());
  const read = () => host.harness.behavior.callRpc("setupRead", {}) as Promise<SetupState>;
  const apply = async (configuration: Configuration, revision?: number) => host.harness.behavior.callRpc("setupApply", { configuration, expectedRevision: revision ?? (await read()).revision }) as Promise<SetupState>;
  const goals = () => host.harness.behavior.callRpc("goalsRead", { threadId }) as Promise<Snapshot>;
  const save = async (text: string, revision?: number) => { const before = await goals(); return host.harness.behavior.callRpc("goalsSave", {
    threadId, text, expectedRevision: revision ?? before.goals.revision, expectedWeek: before.currentWeek, expectedTimezone: before.timezone,
  }) as Promise<Snapshot>; };
  return { ...host, commands, automations, threads, read, apply, goals, save, run,
    failures: (next: { create?: boolean; spawn?: boolean; resume?: boolean }) => { failCreate = next.create ?? false; failSpawn = next.spawn ?? false; failResume = next.resume ?? false; } };
}

test("load and preview do not create goals, threads or schedules; manual setup is reusable", async () => {
  const f = await fixture();
  expect(f.commands).toEqual([]); expect((await f.read()).configuration.enabled).toBe(false);
  await f.harness.behavior.callRpc("setupPreview", { configuration: config(), expectedRevision: 0 });
  expect(f.commands).toEqual([]); expect(f.harness.inspection.sdk.callsTo("threads.spawn")).toEqual([]);
  await f.apply(config());
  expect((await f.goals()).goals).toMatchObject({ text: "", revision: 0, weekOf: null });
  expect(f.commands).toEqual([]);
  await expect(f.apply(config(), 0)).rejects.toThrow("another window");
  await expect(f.apply(config({ environmentId: "env_other" }))).rejects.toThrow("selected project");
});

test("exact goal text and stale-write protection survive setup changes and reload", async () => {
  const f = await fixture(); await f.apply(config());
  const text = "Ship `literal` $text\n\nKeep trailing spaces.  ";
  const [one, two] = await Promise.allSettled([f.save(text, 0), f.save("stale", 0)]);
  expect(one.status).toBe("fulfilled"); expect(two.status).toBe("rejected");
  expect((await f.goals()).goals.text).toBe(text);
  await f.apply(config({ timezone: "Asia/Tokyo" }));
  expect((await f.goals()).stale).toBe(true);
  await expect(f.harness.behavior.callRpc("goalsSave", { threadId, text, expectedRevision: 1, expectedWeek: weekOf("Asia/Tokyo"), expectedTimezone: "America/New_York" })).rejects.toThrow("timezone changed");
  const before = await f.goals();
  const reloaded = await f.harness.lifecycle.reload(bb => registerAgentHarness(bb, f.run));
  disposals.push(() => reloaded.harness.lifecycle.dispose());
  expect(await reloaded.harness.behavior.callRpc("goalsRead", { threadId })).toEqual(before);
  await expect(reloaded.harness.behavior.callRpc("goalsRead", { threadId: "thr_other" })).rejects.toThrow("configured");
});

test("schedule setup creates paused then enables one owned schedule; repeated apply updates it; disable preserves goals", async () => {
  const f = await fixture(); const scheduled = config({ schedule: { enabled: true, cron: "0 9,13 * * 1-5" } });
  await f.apply(scheduled); await f.save("Keep me");
  expect(f.commands.find(a => a[0] === "create")).toContain("--disabled");
  expect(f.commands.find(a => a[0] === "create")).not.toContain("--environment");
  expect(f.automations.get("auto_1")?.enabled).toBe(true);
  await f.apply({ ...scheduled, schedule: { enabled: true, cron: "30 10 * * 1-5" } });
  expect(f.commands.filter(a => a[0] === "create")).toHaveLength(1);
  expect(f.commands.filter(a => a[0] === "update")).toHaveLength(2);
  await f.apply(config({ enabled: false }));
  expect(f.automations.get("auto_1")?.enabled).toBe(false);
  await f.apply(config()); expect((await f.goals()).goals.text).toBe("Keep me");
});

test("lost schedule creation response is recovered by ownership without duplicates", async () => {
  const f = await fixture(); const scheduled = config({ schedule: { enabled: true, cron: "0 9 * * *" } });
  f.failures({ create: true });
  await expect(f.apply(scheduled)).rejects.toThrow("incomplete");
  expect((await f.read()).pending).toBe(true);
  await expect(f.goals()).rejects.toThrow("repair");
  f.failures({}); await f.apply((await f.read()).configuration);
  expect(f.commands.filter(a => a[0] === "create")).toHaveLength(1);
  expect((await f.read()).pending).toBe(false);
});

test("foreign schedules cannot be adopted or mutated through a saved ID", async () => {
  const f = await fixture(); const scheduled = config({ schedule: { enabled: true, cron: "0 9 * * *" } });
  await f.apply(scheduled);
  f.automations.get("auto_1")!.execution.prompt = "Unrelated workflow";
  const before = f.commands.length;
  await expect(f.apply(config({ enabled: false }))).rejects.toThrow("no longer matches");
  expect(f.commands.slice(before).map(c => c[0])).toEqual(["show"]);
});

test("uncertain thread creation requires selecting the existing thread; retry never spawns another", async () => {
  const f = await fixture(); f.failures({ spawn: true });
  await expect(f.apply(config({ targetThreadId: "" }))).rejects.toThrow("Lost thread response");
  f.failures({});
  await expect(f.apply(config({ targetThreadId: "" }))).rejects.toThrow("uncertain result");
  expect(f.harness.inspection.sdk.callsTo("threads.spawn")).toHaveLength(1);
  await f.apply(config({ targetThreadId: "thr_created" }));
  expect((await f.read()).pending).toBe(false);
});

test("successful thread creation permits an intentional new destination, but repeated setup reuses it", async () => {
  const f = await fixture();
  await f.apply(config({ targetThreadId: "" }));
  await f.apply((await f.read()).configuration);
  expect(f.harness.inspection.sdk.callsTo("threads.spawn")).toHaveLength(1);
  await f.apply(config({ targetThreadId: "" }));
  expect(f.harness.inspection.sdk.callsTo("threads.spawn")).toHaveLength(2);
  expect((await f.read()).pending).toBe(false);
});

test("CLI preview/apply and goal writes share validation and scoped instruction delivery", async () => {
  const f = await fixture();
  const args = ["setup", "--configuration", JSON.stringify(config()), "--expected-revision", "0", "--json"];
  expect((await f.harness.behavior.runCli(args)).exitCode).toBe(0);
  expect((await f.read()).revision).toBe(0);
  expect((await f.harness.behavior.runCli([...args, "--apply"])).exitCode).toBe(0);
  const current = await f.goals();
  expect((await f.harness.behavior.runCli(["goals", "set", "--thread", threadId, "--text", "CLI goal", "--expected-revision", "0", "--expected-week", current.currentWeek, "--expected-timezone", current.timezone, "--json"])).exitCode).toBe(0);
  expect((await f.goals()).goals.text).toBe("CLI goal");
  expect(f.harness.registrations.instructionProvider!({ threadId, projectId })).toContain("configured Goals thread");
  expect(f.harness.registrations.instructionProvider!({ threadId: "thr_other", projectId })).not.toContain("configured Goals thread");
  expect((await f.harness.behavior.runCli(["setup", "--apply"])).exitCode).not.toBe(0);
});

test("calendar weeks follow the selected timezone including daylight-saving and year boundaries", () => {
  expect(weekOf("America/Los_Angeles", new Date("2026-11-02T07:59:59Z"))).toBe("2026-10-26");
  expect(weekOf("America/Los_Angeles", new Date("2026-11-02T08:00:00Z"))).toBe("2026-11-02");
  expect(weekOf("Asia/Tokyo", new Date("2026-11-02T07:59:59Z"))).toBe("2026-11-02");
  expect(weekOf("UTC", new Date("2027-01-01T12:00:00Z"))).toBe("2026-12-28");
});

test("destination execution defaults are resolved during review; invalid timezone and schedule make no changes", async () => {
  const f = await fixture();
  const configured = config({ schedule: { enabled: true, cron: "0 9 * * 1-5" }, execution: { providerId: "", model: "", reasoning: "", permissionMode: "auto" } });
  const preview = await f.harness.behavior.callRpc("setupPreview", { configuration: configured, expectedRevision: 0 }) as { configuration: Configuration };
  expect(preview.configuration.execution).toMatchObject({ providerId: "test", model: "model", reasoning: "medium" });
  expect(f.commands).toEqual([]);
  await expect(f.apply(config({ timezone: "Mars/Olympus" }))).rejects.toThrow();
  await expect(f.apply(config({ schedule: { enabled: true, cron: "not cron" } }))).rejects.toThrow();
  expect((await f.read()).revision).toBe(0);
});

test("resume failure is visible and retry reuses the paused schedule and saved goals", async () => {
  const f = await fixture(); await f.apply(config()); await f.save("Still here");
  const scheduled = config({ schedule: { enabled: true, cron: "0 9 * * *" } });
  f.failures({ resume: true });
  await expect(f.apply(scheduled)).rejects.toThrow("Resume unavailable");
  expect((await f.read()).pending).toBe(true);
  f.failures({}); await f.apply(scheduled);
  expect((await f.goals()).goals.text).toBe("Still here");
  expect(f.commands.filter(c => c[0] === "create")).toHaveLength(1);
});
