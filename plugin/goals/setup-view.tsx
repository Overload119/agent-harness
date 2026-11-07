import { useEffect, useMemo, useRef, useState } from "react";
import { useRpc, useSdk, useBbContext, type PluginPendingInteractionProps } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../../server";
import { defaultConfiguration, type Configuration, type SetupInput, type SetupOptions, type SetupState } from "./contract";

export interface SetupApi {
  read(): Promise<SetupState>;
  options(projectId?: string): Promise<SetupOptions>;
  preview(input: SetupInput): Promise<{ summary: string[]; configuration: Configuration }>;
  apply(input: SetupInput): Promise<SetupState>;
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const lines = (value: string) => value.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

export function SetupForm({ api, onComplete, onCancel }: { api: SetupApi; onComplete?: (state: SetupState) => Promise<void>; onCancel?: () => Promise<void> }) {
  const [state, setState] = useState<SetupState | null>(null);
  const [draft, setDraft] = useState<Configuration>(defaultConfiguration);
  const [options, setOptions] = useState<SetupOptions>({ projects: [], environments: [], threads: [], providers: [], truncated: false });
  const [review, setReview] = useState<{ summary: string[]; input: SetupInput } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    api.read().then(value => { if (active) {
      setState(value); setDraft(value.revision ? value.configuration : { ...value.configuration, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (value.error) setError(value.error);
    } }, cause => { if (active) setError(message(cause)); });
    return () => { active = false; generation.current++; };
  }, [api]);
  useEffect(() => {
    let active = true;
    api.options(draft.projectId || undefined).then(value => { if (active) setOptions(value); }, cause => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [api, draft.projectId]);
  function change(next: Configuration) { setDraft(next); setReview(null); setNotice(""); }
  async function run(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    const current = generation.current;
    try { await work(); } catch (cause) { if (current === generation.current) setError(message(cause)); }
    finally { busy.current = false; if (current === generation.current) setPending(false); }
  }
  const choose = (entries: { id: string; label: string }[], current: string) => <>
    {current && !entries.some(e => e.id === current) && <option value={current}>{current}</option>}
    {entries.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
  </>;
  return <section className="ah-setup" aria-label="Agent Harness setup">
    <p>Choose the features you want. Goals and scheduled briefs start only after you review and apply setup.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!state ? <button disabled={pending} onClick={() => void run(async () => { const value = await api.read(); setState(value); setDraft(value.configuration); })}>Reload setup</button> : <>
      <fieldset disabled={pending}><legend>Features</legend>
        <label><input type="checkbox" checked={draft.sideChats} onChange={e => change({ ...draft, sideChats: e.target.checked })} />Side chats</label>
        <label><input type="checkbox" checked={draft.standingInstructions} onChange={e => change({ ...draft, standingInstructions: e.target.checked })} />Standing instructions</label>
        <label><input type="checkbox" checked={draft.enabled} onChange={e => change({ ...draft, enabled: e.target.checked })} />Weekly goals</label>
      </fieldset>
      {draft.enabled && <fieldset disabled={pending}><legend>Goals and briefing</legend>
        <label>Project<select value={draft.projectId} onChange={e => change({ ...draft, projectId: e.target.value, environmentId: "", targetThreadId: "" })}><option value="">Choose project</option>{choose(options.projects, draft.projectId)}</select></label>
        <label>Environment<select value={draft.environmentId} onChange={e => change({ ...draft, environmentId: e.target.value, targetThreadId: "" })}><option value="">Choose environment</option>{choose(options.environments, draft.environmentId)}</select></label>
        <label>Goals thread<select value={draft.targetThreadId} onChange={e => change({ ...draft, targetThreadId: e.target.value })}><option value="">Create a dedicated thread</option>{choose(options.threads.filter(thread => thread.environmentId === draft.environmentId), draft.targetThreadId)}</select></label>
        {options.truncated && <p>Showing the first 200 environments/threads. For another destination, use the CLI JSON setup with its exact ID.</p>}
        <label>Timezone<input value={draft.timezone} onChange={e => change({ ...draft, timezone: e.target.value })} placeholder="Europe/London" /></label>
        <p>Weeks start Monday. Changing timezone requires you to review saved goals again.</p>
        <label><input type="checkbox" checked={draft.schedule.enabled} onChange={e => change({ ...draft, schedule: { ...draft.schedule, enabled: e.target.checked } })} />Schedule briefs</label>
        {draft.schedule.enabled && <>
          <label>Schedule<select value={["0 9,13 * * 1-5", "0 9,13 * * *"].includes(draft.schedule.cron) ? draft.schedule.cron : "custom"} onChange={e => change({ ...draft, schedule: { ...draft.schedule, cron: e.target.value === "custom" ? "0 9 * * 1-5" : e.target.value } })}><option value="0 9,13 * * 1-5">Weekdays at 9 AM and 1 PM</option><option value="0 9,13 * * *">Every day at 9 AM and 1 PM</option><option value="custom">Custom schedule</option></select></label>
          {!["0 9,13 * * 1-5", "0 9,13 * * *"].includes(draft.schedule.cron) && <label>Custom schedule (five-field cron)<input value={draft.schedule.cron} onChange={e => change({ ...draft, schedule: { ...draft.schedule, cron: e.target.value } })} /></label>}
          <details><summary>Agent settings (destination defaults unless changed)</summary>
          <label>Provider<select value={draft.execution.providerId} onChange={e => change({ ...draft, execution: { ...draft.execution, providerId: e.target.value, model: "", reasoning: "" } })}><option value="">Use destination defaults</option>{choose(options.providers, draft.execution.providerId)}</select></label>
          <p>Leave provider and model empty to resolve the destination’s current defaults during review.</p>
          <label>Model<input value={draft.execution.model} onChange={e => change({ ...draft, execution: { ...draft.execution, model: e.target.value } })} /></label>
          <label>Reasoning level (optional)<input value={draft.execution.reasoning} onChange={e => change({ ...draft, execution: { ...draft.execution, reasoning: e.target.value } })} /></label>
          <label>Permissions<select value={draft.execution.permissionMode} onChange={e => change({ ...draft, execution: { ...draft.execution, permissionMode: e.target.value as Configuration["execution"]["permissionMode"] } })}><option value="auto">Automatic approval</option><option value="accept-edits">Approve edits</option><option value="full">Full access</option></select></label></details>
        </>}
        <fieldset><legend>Evidence sources</legend>
          <p>Select only the projects and sources you want briefs to read. Unselected sources are excluded.</p>
          <div className="ah-projects">{options.projects.map(project => <label key={project.id}><input type="checkbox" checked={draft.sources.bbProjectIds.includes(project.id)} onChange={e => change({ ...draft, sources: { ...draft.sources, bbProjectIds: e.target.checked ? [...draft.sources.bbProjectIds, project.id] : draft.sources.bbProjectIds.filter(id => id !== project.id) } })} />{project.label}</label>)}</div>
          <label><input type="checkbox" checked={draft.sources.gitlab !== null} onChange={e => change({ ...draft, sources: { ...draft.sources, gitlab: e.target.checked ? { host: "gitlab.com", repositories: [] } : null } })} />GitLab</label>
          {draft.sources.gitlab && <>
            <label>GitLab host<input value={draft.sources.gitlab.host} onChange={e => change({ ...draft, sources: { ...draft.sources, gitlab: { ...draft.sources.gitlab!, host: e.target.value } } })} /></label>
            <label>Repositories (group/project, one per line)<textarea defaultValue={draft.sources.gitlab.repositories.join("\n")} onBlur={e => change({ ...draft, sources: { ...draft.sources, gitlab: { ...draft.sources.gitlab!, repositories: lines(e.target.value) } } })} /></label>
          </>}
          <label><input type="checkbox" checked={draft.sources.slack !== null} onChange={e => change({ ...draft, sources: { ...draft.sources, slack: e.target.checked ? { workspace: "", channels: [] } : null } })} />Slack</label>
          {draft.sources.slack && <>
            <label>Slack workspace name or ID<input value={draft.sources.slack.workspace} onChange={e => change({ ...draft, sources: { ...draft.sources, slack: { ...draft.sources.slack!, workspace: e.target.value } } })} /></label>
            <label>Channels (optional, one per line)<textarea defaultValue={draft.sources.slack.channels.join("\n")} onBlur={e => change({ ...draft, sources: { ...draft.sources, slack: { ...draft.sources.slack!, channels: lines(e.target.value) } } })} /></label>
          </>}
          <label>Additional evidence guidance (optional)<textarea value={draft.sources.guidance} maxLength={4000} onChange={e => change({ ...draft, sources: { ...draft.sources, guidance: e.target.value } })} /></label>
          <p>Connections stay with the agent's existing integrations. The first brief reports access gaps; setup does not copy credentials.</p>
        </fieldset>
      </fieldset>}
      <div className="ah-setup-actions">
        <button disabled={pending} onClick={() => void run(async () => { const input = { expectedRevision: state.revision, configuration: draft }; const result = await api.preview(input); setReview({ summary: result.summary, input: { ...input, configuration: result.configuration } }); })}>Review setup</button>
        <button disabled={pending} onClick={() => void run(async () => { const value = await api.read(); setState(value); setReview(null); setNotice("Current revision loaded. Your draft is preserved; review it before applying."); if (value.pending && value.configuration.targetThreadId && !draft.targetThreadId) setDraft({ ...draft, targetThreadId: value.configuration.targetThreadId }); })}>Reload saved setup</button>
        {onCancel && <button disabled={pending} onClick={() => void onCancel()}>Cancel</button>}
      </div>
      {review && <section aria-label="Review setup"><h3>Review setup</h3><ul>{review.summary.map(line => <li key={line}>{line}</li>)}</ul>
        <button disabled={pending} onClick={() => void run(async () => { const saved = await api.apply(review.input); setState(saved); setDraft(saved.configuration); setReview(null); setNotice("Setup saved. Existing goal text was preserved."); await onComplete?.(saved); })}>Apply setup</button>
      </section>}
    </>}
  </section>;
}
export function SetupSection({ onComplete, onCancel, originThreadId }: { onComplete?: (state: SetupState) => Promise<void>; onCancel?: () => Promise<void>; originThreadId?: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const sdk = useSdk();
  const context = useBbContext();
  const origin = originThreadId || context.threadId;
  const api = useMemo<SetupApi>(() => ({
    read: async () => {
      const state = await rpc.call("setupRead", {});
      if (!state.revision && origin) {
        const thread = await sdk.threads.get({ threadId: origin });
        state.configuration = { ...state.configuration, projectId: thread.projectId, environmentId: thread.environmentId || "" };
      }
      return state;
    },
    options: projectId => rpc.call("setupOptions", { projectId }),
    preview: input => rpc.call("setupPreview", input), apply: input => rpc.call("setupApply", input),
  }), [rpc, sdk, origin]);
  return <SetupForm api={api} onComplete={onComplete} onCancel={onCancel} />;
}
export function SetupInteraction({ interaction, submit, cancel }: PluginPendingInteractionProps) {
  return <SetupSection originThreadId={interaction.threadId} onComplete={async state => { await submit({ revision: state.revision }); }} onCancel={cancel} />;
}
