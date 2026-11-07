# BB adapter

Use this only inside BB with its CLI available. Read current help before acting;
command availability and execution defaults can change. Examples below are
command shapes with placeholders, not literal commands to execute unchanged.

## Resolve origin and capabilities

1. Capture `BB_THREAD_ID`; if absent, resolve the current thread with
   `bb status --json`. Keep that exact ID through the handoff.
2. Read `bb thread show <origin-id> --json` for project, environment, provider,
   and `parentThreadId`. No resolved origin means no spawn.
3. Read `bb guide threads`, `bb thread spawn --help`, and
   `bb provider list --environment <environment-id> --json`.
4. Use the origin's project/environment unless explicitly told otherwise.
   An environment ID selects its machine; do not also pass `--machine`.
   Do not request `--new-environment` or `--new-machine` merely for routing.

## Child

```sh
bb thread spawn --project <project-id> --parent-thread <origin-id> \
  --environment <environment-id> --parent-notifications <mode> \
  --prompt-file <prompt-path> --json
```

With no provider override, omit execution overrides so BB can inherit the live
parent's settings. An explicit `codex` maps to `--provider codex`; `claude` maps
to `--provider claude-code`. When changing provider, use its default model unless
the user selected one. Do not copy an incompatible model or reasoning level.

## Sibling

Use `--parent-thread <origin-parent-id>`, not the origin. If `parentThreadId` is
null, omit both `--parent-thread` and `--parent-self`. Do not spawn first and
then change its parent.

Always pass the resolved provider explicitly for a sibling. Without a provider
switch, use the origin's known execution settings, even when a shared parent
exists. Read `bb thread options <origin-id> --json` and available live session
context. Use current supported flags:

```text
--provider <providerId>
--model <model>
--reasoning-level <level>
--service-tier <tier>
--permission-mode <mode>
--option <option=value>        (repeat for supported provider options)
```

Read provider model metadata when necessary to map settings accurately. Do not
guess a permission mode or let omission silently widen permissions. If a required
setting cannot be preserved safely, explain the limitation before spawning.
Do not claim exact inheritance when a setting cannot be resolved.

Both child and sibling commands must pass `--parent-notifications auto|stuck|off`.
For a sibling with no parent the value has no recipient; state that in the prompt
and the handoff response. Do not replace suppressed completion reports with
`bb thread tell`. Explicit user instructions about notification suppression
take precedence over generic guidance to report results to a parent.

## Prompt and receipt

Store the prompt under the active project's working-artifact directory or pass
quoted stdin with `--prompt-file -`. Include `@thread:<origin-id>` as a reference
plus the actual context the worker needs. This is a fresh conversation, not a
fork of the history. Preserve relevant attachments through supported file/image
arguments where needed; do not assume a text prompt reproduces them.

After creation, run `bb thread show <new-id> --json` and verify `id`,
`parentThreadId`, `projectId`, `environmentId`, `providerId`, and
`parentNotifications`. Compare the model and other execution fields when exposed.
Link the result as `@thread:<new-id>`; do not construct thread URLs manually.

If the spawn result is uncertain, inspect `bb thread list --project <project-id>
--environment <environment-id> --include-hidden --json`, filtering by the exact
expected parent (including null) and matching request. Use supported pagination
or focused searches if the list is bounded; an absent entry on one page is not
proof that creation failed. Retry only after resolving the uncertain result.

Do not wait, resend the task, or send completion acknowledgements after a
verified handoff. If the user explicitly requests results here, use BB's supported
wait/inspection commands while respecting the chosen notification mode.

## Optional child-thread composer UI

When the full Agent Harness BB plugin is installed, **New Child Thread…** is also
available in thread actions and from Cmd+Shift+Enter (macOS) or Ctrl+Shift+Enter
(Windows/Linux) in an existing thread composer. Its native composer keeps rich
mentions, attachments and selected execution options. The action creates a fresh
child in the selected parent's existing project/workspace, with configurable
parent notifications and a stay-on-page choice. It does not copy conversation
history or create a sibling. Importing this skill alone does not add that UI.

Agents can use the public CLI workflow above. Plugin RPC methods
`childThreadPreferences` and `saveChildThreadPreferences` expose its saved provider,
notification mode and stay-on-page preference; inspect their contract with
`bb plugin rpc inspect agent-harness`. These preferences belong to the manual UI;
do not silently apply them instead of explicit routing instructions in this skill.
