import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { randomUUID } from "node:crypto";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";
import { defaultConfiguration, goalSchema, saveGoalSchema, setupInputSchema, weekOf, type Configuration, type SetupInput, type SetupState, type Snapshot } from "./contract";
import { assertOwned, automationName, AutomationCommandError, scheduleArgs, type RunAutomation } from "./automation";

type State = SetupState & { owner: string; threadCreationAttempted: boolean; scheduleCreationAttempted: boolean };
type Features = { sideChats: boolean; standingInstructions: boolean };
export function createGoalsService(bb: BbPluginApi, run: RunAutomation, features: { get(): Promise<Features>; set(value: Features): Promise<unknown> }) {
  // One queue covers setup and goal writes; all read/compare/write operations are
  // serialized in the plugin runtime. KV persists through plugin reloads in BB.
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work); tail = next.catch(() => undefined); return next;
  };
  let active: State | undefined;
  const persist = async (state: State) => { await bb.storage.kv.set("goals-setup", state); active = structuredClone(state); };
  async function load(): Promise<State> {
    const stored = await bb.storage.kv.get<State>("goals-setup");
    return stored ?? { revision: 0, configuration: defaultConfiguration(), automationId: null, automationProjectId: null,
      pending: false, error: null, owner: "", threadCreationAttempted: false, scheduleCreationAttempted: false };
  }
  async function readSetup(): Promise<SetupState> {
    const state = await load();
    return { revision: state.revision, configuration: { ...state.configuration, ...await features.get() },
      automationId: state.automationId, automationProjectId: state.automationProjectId, pending: state.pending, error: state.error };
  }
  async function validate(raw: SetupInput): Promise<Configuration> {
    const { expectedRevision, configuration } = setupInputSchema.parse(raw);
    const state = await load();
    if (expectedRevision !== state.revision) throw new Error("Setup changed in another window. Reload setup before applying.");
    const config = structuredClone(configuration);
    if (!config.enabled) return config;
    if (!config.projectId || !config.environmentId) throw new Error("Choose a project and environment for Goals.");
    const environment = await bb.sdk.environments.get({ environmentId: config.environmentId });
    if (environment.projectId !== config.projectId || environment.status !== "ready") throw new Error("Choose a ready environment in the selected project.");
    if (config.targetThreadId) {
      const thread = await bb.sdk.threads.get({ threadId: config.targetThreadId });
      if (thread.projectId !== config.projectId || thread.environmentId !== config.environmentId || thread.archivedAt !== null || thread.deletedAt !== null) {
        throw new Error("Choose an active, unarchived thread in the selected project and environment.");
      }
    }
    for (const projectId of config.sources.bbProjectIds) await bb.sdk.projects.get({ projectId });
    if (config.sources.gitlab) {
      if (!/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(config.sources.gitlab.host)) throw new Error("GitLab host must be a hostname without a URL or credentials.");
      if (!config.sources.gitlab.repositories.length || config.sources.gitlab.repositories.some(repo => !/^[\w.-]+(?:\/[\w.-]+)+$/.test(repo))) throw new Error("Enter GitLab repositories as group/project paths.");
    }
    if (config.schedule.enabled) {
      if (config.schedule.cron.trim().split(/\s+/).length !== 5) throw new Error("Use a five-field cron schedule.");
      CronExpressionParser.parse(config.schedule.cron, { tz: config.timezone });
      if (!config.execution.providerId && !config.execution.model) {
        if (config.targetThreadId) {
          const thread = await bb.sdk.threads.get({ threadId: config.targetThreadId });
          const defaults = await bb.sdk.threads.defaultExecutionOptions({ threadId: config.targetThreadId });
          if (defaults) config.execution = { providerId: thread.providerId, model: defaults.model, reasoning: defaults.reasoningLevel, permissionMode: defaults.permissionMode };
        } else {
          const defaults = await bb.sdk.projects.defaultExecutionOptions({ projectId: config.projectId });
          if (defaults) config.execution = { providerId: defaults.providerId, model: defaults.model, reasoning: defaults.reasoningLevel, permissionMode: defaults.permissionMode };
        }
      }
      if (!config.execution.providerId || !config.execution.model) throw new Error("Choose a provider and model before enabling scheduled briefs.");
      const providers = await bb.sdk.providers.list({ environmentId: config.environmentId });
      if (!providers.some(provider => provider.id === config.execution.providerId && provider.available)) throw new Error("The selected provider is unavailable in this environment.");
    }
    return config;
  }
  async function preview(input: SetupInput) {
    const configuration = await validate(input);
    const project = configuration.enabled ? await bb.sdk.projects.get({ projectId: configuration.projectId }) : null;
    const environment = configuration.enabled ? await bb.sdk.environments.get({ environmentId: configuration.environmentId }) : null;
    const thread = configuration.enabled && configuration.targetThreadId ? await bb.sdk.threads.get({ threadId: configuration.targetThreadId }) : null;
    const sourceProjects = configuration.enabled ? await Promise.all(configuration.sources.bbProjectIds.map(async projectId => (await bb.sdk.projects.get({ projectId })).name)) : [];
    return { configuration, summary: [
      configuration.enabled ? `Goals in ${project!.name}, environment ${environment!.name || environment!.path || environment!.id}; ${thread?.title || (thread ? thread.id : "create one dedicated idle thread")}.` : "Goals disabled; pause this workflow's schedule if one exists. Saved goals remain.",
      configuration.enabled && configuration.schedule.enabled ? `Schedule: ${configuration.schedule.cron} in ${configuration.timezone}, using ${configuration.execution.providerId} / ${configuration.execution.model}; permissions: ${configuration.execution.permissionMode}; reasoning: ${configuration.execution.reasoning || "provider default"}.` : "No scheduled briefs.",
      `Week starts Monday in ${configuration.timezone}.`,
      `BB evidence: ${sourceProjects.join(", ") || "disabled"}. GitLab: ${configuration.sources.gitlab ? configuration.sources.gitlab.host + "/" + configuration.sources.gitlab.repositories.join(", ") : "disabled"}. Slack: ${configuration.sources.slack ? configuration.sources.slack.workspace + " (" + (configuration.sources.slack.channels.join(", ") || "all accessible channels") + ")" : "disabled"}.`,
      ...(configuration.sources.guidance ? [`Additional evidence guidance: ${configuration.sources.guidance}`] : []),
      `Side chats ${configuration.sideChats ? "on" : "off"}; standing instructions ${configuration.standingInstructions ? "on" : "off"}.`,
      "External source access is checked by the first brief using that agent's connected tools. Setup does not read credentials or personal goals.",
    ] };
  }
  async function owned(state: State) {
    const item = assertOwned(await run(["show", state.automationId!, "--project", state.automationProjectId!]), state.owner);
    if (item.id !== state.automationId || item.projectId !== state.automationProjectId) throw new Error("Automation identity mismatch.");
    return item;
  }
  async function apply(input: SetupInput): Promise<SetupState> {
    return serial(async () => {
      const config = await validate(input);
      const state = await load();
      state.owner ||= randomUUID();
      // Disabling or retargeting always pauses the known owned schedule first.
      if (state.automationId) {
        await owned(state);
        await run(["pause", state.automationId, "--project", state.automationProjectId!]);
      }
      if (state.automationProjectId && state.automationProjectId !== config.projectId) {
        state.automationId = null; state.automationProjectId = null;
        state.scheduleCreationAttempted = false;
      }
      state.revision++;
      state.configuration = config; state.pending = true; state.error = null;
      if (config.enabled && config.targetThreadId) state.threadCreationAttempted = false;
      await persist(state);
      try {
        if (config.enabled && !config.targetThreadId) {
          if (state.threadCreationAttempted) throw new Error("A previous thread creation has an uncertain result. Select its existing thread before retrying; setup will not create a duplicate.");
          state.threadCreationAttempted = true; await persist(state);
          const thread = await bb.sdk.threads.spawn({ projectId: config.projectId, environment: { type: "reuse", environmentId: config.environmentId },
            input: [], title: "Weekly goals", ...(config.execution.providerId ? { providerId: config.execution.providerId } : {}),
            ...(config.execution.model ? { model: config.execution.model } : {}), pluginMetadata: { goalsWorkflow: state.owner } });
          config.targetThreadId = thread.id;
          state.threadCreationAttempted = false;
          await persist(state); // Save identity before any later operation can fail.
        }
        if (config.enabled && config.schedule.enabled) {
          if (!state.automationId) {
            const items = z.array(z.object({ id: z.string(), projectId: z.string(), name: z.string() }).passthrough()).parse(await run(["list", "--project", config.projectId]));
            const matches = items.filter(item => item.name === automationName(state.owner));
            if (matches.length > 1) throw new Error("More than one workflow schedule exists. Resolve duplicates in BB Automations before retrying.");
            if (matches[0]) {
              const item = assertOwned(await run(["show", matches[0].id, "--project", config.projectId]), state.owner);
              state.automationId = item.id; state.automationProjectId = config.projectId;
              await persist(state);
            } else {
              if (state.scheduleCreationAttempted) throw new Error(`A previous schedule creation has an uncertain result. Look for ${automationName(state.owner)} in BB Automations; setup will not create a duplicate.`);
              state.scheduleCreationAttempted = true; await persist(state);
              let created: unknown;
              try { created = await run(["create", "--project", config.projectId, "--disabled", ...scheduleArgs(config, state.owner)]); }
              catch (cause) {
                if (cause instanceof AutomationCommandError && !cause.uncertain) { state.scheduleCreationAttempted = false; await persist(state); }
                throw cause;
              }
              const item = assertOwned(created, state.owner);
              state.automationId = item.id; state.automationProjectId = config.projectId;
              await persist(state);
            }
          }
          await owned(state);
          await run(["pause", state.automationId!, "--project", config.projectId]);
          await run(["update", state.automationId!, "--project", config.projectId, ...scheduleArgs(config, state.owner)]);
        }
        await features.set({ sideChats: config.sideChats, standingInstructions: config.standingInstructions });
        // Publish the final configuration before the scheduler can submit a turn.
        state.pending = false; state.error = null; await persist(state);
        if (config.enabled && config.schedule.enabled && state.automationId) {
          await run(["resume", state.automationId, "--project", config.projectId]);
          const resumed = await owned(state);
          if (!resumed.enabled || resumed.execution.targetThreadId !== config.targetThreadId) throw new Error("Schedule verification failed. Inspect BB Automations before retrying.");
        }
        return readSetup();
      } catch (error) {
        state.pending = true; state.error = error instanceof Error ? error.message : String(error);
        await persist(state);
        throw new Error(`Setup is incomplete: ${state.error} Reload setup before retrying. Goals were preserved.`);
      }
    });
  }
  async function readGoals(threadId: string): Promise<Snapshot> {
    const state = await load(); const config = state.configuration;
    if (!config.enabled || config.targetThreadId !== threadId) throw new Error("Goals are available only in the configured Goals thread.");
    if (state.pending) throw new Error("Finish or repair Agent Harness setup before running a brief or editing goals.");
    const goals = goalSchema.parse(await bb.storage.kv.get(`goals:${threadId}`) ?? {
      threadId, text: "", weekOf: null, timezone: config.timezone, revision: 0, updatedAt: null,
    });
    const currentWeek = weekOf(config.timezone);
    return { setupRevision: state.revision, goals, currentWeek, timezone: config.timezone, stale: goals.weekOf !== null && (goals.weekOf !== currentWeek || goals.timezone !== config.timezone),
      schedule: config.schedule.enabled ? `${config.schedule.cron} (${config.timezone})` : "Manual briefs only", configuration: config };
  }
  const saveGoals = (raw: z.infer<typeof saveGoalSchema>) => serial(async () => {
    const input = saveGoalSchema.parse(raw); const current = await readGoals(input.threadId);
    if (current.goals.revision !== input.expectedRevision) throw new Error("Goals changed in another window. Reload saved goals; your draft is still here.");
    if (input.expectedWeek !== current.currentWeek || input.expectedTimezone !== current.timezone) throw new Error("The week or timezone changed. Reload and confirm the goals before saving.");
    await bb.storage.kv.set(`goals:${input.threadId}`, { threadId: input.threadId, text: input.text, weekOf: current.currentWeek,
      timezone: current.timezone, revision: current.goals.revision + 1, updatedAt: new Date().toISOString() });
    return readGoals(input.threadId);
  });
  async function options(projectId?: string) {
    const [projects, environments, threads, providers] = await Promise.all([
      bb.sdk.projects.list({ includePersonal: true }),
      projectId ? bb.sdk.environments.list({ projectId, status: "ready", limit: 200 }) : [],
      projectId ? bb.sdk.threads.list({ projectId, archived: false, limit: 200 }) : [],
      bb.sdk.providers.list(),
    ]);
    return { projects: projects.map(p => ({ id: p.id, label: p.name })),
      environments: environments.map(e => ({ id: e.id, label: e.name || e.path || e.id })),
      threads: threads.filter(t => t.deletedAt === null && t.archivedAt === null).map(t => ({ id: t.id, label: t.title || t.id, environmentId: t.environmentId })),
      providers: providers.filter(p => p.available).map(p => ({ id: p.id, label: p.displayName })),
      truncated: environments.length === 200 || threads.length === 200 };
  }
  return { readSetup, preview, apply, readGoals, saveGoals, options,
    initialize: async () => { active = await load(); },
    target: () => active?.configuration.enabled && !active.pending ? active.configuration.targetThreadId : "",
  };
}
export type GoalsService = ReturnType<typeof createGoalsService>;
