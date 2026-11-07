# Goals and setup

Agent Harness includes one optional Goals workflow per BB installation. Configure
it through Settings → Agent Harness → Setup, or run `bb agent-harness setup`
inside a BB thread. From an ordinary terminal, pass `--thread <id>` or use the
settings page. The command opens the same review/apply form; it does not apply
settings without submission. Installation does not create a thread or schedule.

## Configuration

Select the features, project, ready environment, existing Goals thread or new
idle thread, timezone, and evidence sources. Weeks start Monday. Scheduling is
optional: presets are weekdays or every day at 9 AM/1 PM, with a five-field cron
input for other times. Leave provider/model empty to resolve the destination's
current defaults during review; otherwise supply the desired execution settings.
Resolved settings are saved, not continuously inherited from future defaults.

Only selected BB projects are evidence sources. GitLab accepts a host and
repository paths; Slack accepts a workspace and optional channel scope. Existing
agent integrations own authentication. The first brief checks actual access;
setup validates configuration and BB identities but does not authenticate external
sources, read credentials or copy personal goals. Additional evidence guidance
can describe a local analytics procedure without embedding it in the distribution.

Review shows the destination, calendar, execution, sources and feature changes.
Apply saves configuration and updates only the schedule identified as belonging
to this workflow. The setup revision rejects stale forms. Goal text is separate
and remains intact when configuration changes. Re-running setup does not create
a new thread unless an explicit new-thread destination is chosen.

## Goals

The Goals pane is visible on the configured thread. Save explicitly with the
button or Cmd+Enter; Tab/Shift+Tab indent/outdent. Unsaved drafts do not appear in
briefs. Exact text (up to 12000 characters), week, timezone, revision and update
time are stored per thread in BB-managed plugin KV, backed by SQLite. This is
one latest record per thread, not a revision archive. No old plugin database is
imported. Retargeting leaves the old record intact under its previous thread ID.

Saves check the revision, current week and timezone. New weeks and timezone
changes require review and a new save. Conflicts preserve the draft and show the
saved version for comparison. The bundled `weekly-goals-brief` skill honors
explicit completion confirmations and makes minimal edits only when requested.
Briefs and their comparison history remain in the destination conversation.

## CLI and RPC

```sh
bb agent-harness setup --help
bb agent-harness status --json
bb agent-harness goals get --json
bb agent-harness goals set --help
bb plugin rpc inspect agent-harness
```

For agent/script access, `setup --configuration <JSON> --expected-revision <n>`
validates and previews; add `--apply` to save after review. Get the configuration
shape and revision from `status`. Pass JSON or multiline goals using an argument
array; do not interpolate them into shell code. No file-path argument crosses
machines. `setupRead`, `setupOptions`, `setupPreview`, `setupApply`, `goalsRead`
and `goalsSave` are the corresponding typed RPCs.

`goals set` requires `--thread`, `--text`, `--expected-revision`, `--expected-week`
and `--expected-timezone`. The revision is the goal revision from `goals get`,
not the setup revision. A successful save confirms the whole text for that week.

## Scheduling and recovery

The built-in BB Automations plugin owns scheduling. This plugin calls its public
CLI from the BB server, with argument arrays and an explicit project. The BB
CLI must be available through `BB_CLI` or PATH. Re-prompting a target thread uses
that thread's environment; it is not combined with an environment selector.
A schedule stores a generic prompt that resolves the bundled skill by name and
reads fresh configuration. No personal skill path is embedded in it.

New schedules start paused. Setup persists the owned schedule identity before
updating/enabling it, then verifies the enabled target. Changes pause the current
owned schedule first. Pausing prevents future runs; it does not stop an already
running brief. Briefs reread both goal and setup revisions before finishing. Disabling Goals or choosing manual briefs pauses it.
Changing projects leaves the former schedule paused; returning to that project
can reuse it. Setup never deletes schedules or changes an unrelated automation.
Do not rename or replace the managed automation's ownership marker/name outside
setup. A mismatch stops further writes.

Partial setup is visible through `status` and the form. Reload before retrying.
A lost create response is reconciled against the uniquely named schedule; an
uncertain thread creation requires selecting the resulting existing thread.
If an uncertain creation has no discoverable result, setup refuses to create
another automatically. Resolve the operation in BB before continuing. Ordinary
CLI validation failures permit correcting the configuration and retrying.
Goals reads/edits refuse incomplete setup so a brief cannot run with partial
configuration. No automatic retry creates new workflows in the background.

BB must be available to run schedules. Disabling/uninstalling Agent Harness does
not disable BB Automations: pause the workflow through setup first. Do not delete
plugin storage during recovery. The existing separate Weekly Goals deployment
is neither read nor migrated by this feature.

## Verification

`bun run test:plugin` covers setup and goal state, calendar boundaries, instruction
scope, CLI/RPC parity, lost responses, schedule ownership and component behavior.
`bun run build:plugin` and a clean production-only build verify distribution.
These tests use fake services and isolated state; no live schedule is activated.
External-source availability and live provider runs depend on destination setup.
