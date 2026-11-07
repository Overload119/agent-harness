# Child-thread composer

The root Agent Harness BB plugin provides **New Child Thread…** in thread actions
and as a configurable row quick action. In an existing thread composer,
Cmd+Shift+Enter on macOS or Ctrl+Shift+Enter on Windows/Linux opens the same dialog.
The shortcut does nothing in a new-thread composer. Opening or cancelling the
dialog starts no work; submission creates one fresh child conversation.

## Behavior

The parent is the thread whose action/shortcut was invoked. Its project, existing
workspace and provider seed BB's native composer. After a successful creation,
the selected provider becomes the default for future dialogs in this installation.
BB owns provider availability and model reconciliation. The composer controls the
model, reasoning, service tier, permissions and other supported agent options;
these are forwarded unchanged along with structured mentions and attachments.
This does not promise to copy all execution settings from the parent.

The composer permits changing project/workspace, but this action rejects sending
to any destination other than the parent's existing project/workspace. It rechecks
the parent immediately before creation and rejects archival, deletion, unavailable
workspace, or project/workspace/provider changes while the dialog was open.
Reopen the dialog if those parent settings change.

**Notify parent** offers All updates (`auto`), Only when stuck (`stuck`: failures,
interruptions or help needed), and Off (`off`). **Stay on current page** defaults
to unchecked; when checked, creation closes the dialog without navigating away.
Successful creation remembers both choices and the provider in Agent Harness's
own BB-managed KV storage, shared across projects/windows in that installation.
No personal settings are imported from other plugins.

Draft keys are scoped to the parent and this plugin, separate from the parent's
chat draft. BB keeps the draft on cancel or failed submission and clears it on
successful submission. The dialog guards repeated submissions, prevents closing
while submitting and reports errors. A preference-save failure does not retry
creation: it reports that the child exists but preferences were not saved.
A failed spawn is never retried automatically. If a connection fails after a
request may have reached BB, inspect the parent's children before resubmitting.

Children have a parent relationship, but no lifecycle owner is assigned here.
They do not inherit the parent's transcript. This differs from the Side chats
panel, which creates hidden forks with conversation context and source ownership.
The routing skill remains useful for agent-directed child/sibling delegation;
importing that skill alone does not install this UI.

## Agent access

Agents can create the same relationship through the public BB CLI:
`bb thread spawn --project <project-id> --environment <environment-id>
--parent-thread <parent-id> --parent-notifications auto --prompt-file <file>`.
Use explicit provider/execution flags for the intended selections and verify the
parent's current project/workspace before spawning. Follow the installed CLI's
help for supported arguments. A user request authorizes creation; simply reading
this documentation does not.

The plugin exposes `childThreadPreferences` (empty input) and
`saveChildThreadPreferences` (`providerId`, `parentNotifications`,
`stayOnCurrentPage`) through its public typed RPC contract. Preference changes
create no threads. Inspect with `bb plugin rpc inspect agent-harness`.

## Installation and coexistence

The composer ships in the root plugin, without a new package, host service,
external account or organization-specific configuration. Events, draft keys and
CSS are namespaced to Agent Harness. Existing preference records and drafts in
other plugins are left intact. Running two plugins with this feature can show
duplicate actions and conflict on the default shortcut. Use BB's shortcut settings
to retain one binding; remove the old registration when migrating its source.
Unloading Agent Harness removes this UI but does not delete created threads.

## Verification

`bun run test:plugin` covers native request forwarding, parent validation,
notification modes, preference persistence, cancellation and navigation (including
failed preference saves). Typechecks and a clean production-dependency build check
SDK compatibility and bundled imports. Tests use fake hosts and synthetic composer
controls, creating no live threads. They do not prove native draft persistence,
voice/attachment uploads, live layout, or shortcut conflicts with other plugins.
