# Agent Harness

Reusable agent skills, standing instructions, a child-thread composer, Side chats, and optional weekly
goals with scheduled briefs, shipped as one BB plugin. This is a distribution repository: maintaining it does not require
installing its skills or preferences into this checkout.

## Install

Install the published version from `main`:

```sh
bb plugin install git:https://github.com/Overload119/agent-harness.git@main
```

For a new installation that follows tagged patches in the current release line:

```sh
bb plugin install 'git:https://github.com/Overload119/agent-harness.git@^0.2.0'
```

This range accepts `0.2.x` releases; `@main` follows the latest commits, including
unreleased work. An exact `@v0.2.0` install stays pinned. Existing `@main` users
can keep their current source. See [CHANGELOG.md](CHANGELOG.md) for release and
upgrade notes, and [RELEASING.md](RELEASING.md) for the publication process.

A private repository works when the machine running BB has Git access. No public
marketplace listing is required. BB installs dependencies, builds the plugin,
and makes its skills available to agent sessions. Requires BB >=0.47 and Plugin
SDK >=0.6.75.

For an existing permanent local checkout, run this from the repository root:

```sh
bun run install:plugin
```

The helper installs dependencies, refreshes exports, builds, invokes BB's plugin
installer, then verifies that `agent-harness` is running from that exact checkout.
It needs Bun, npm, and BB. BB registers the path in place, so keep the checkout on
disk. If dependencies and exports are already current, the direct equivalent is:

```sh
bb plugin install /path/to/agent-harness
```

Plugins are installed once per BB installation, not separately in each project.
Existing sessions may need a restart to discover new skills and instructions.
Source changes do not activate the plugin automatically. The Git command reads
the published branch; unpushed changes are available only through a local install.

## Upgrade a Git installation

If installed from the Git URL above with `@main`, run:

```sh
bb plugin outdated
bb plugin update agent-harness
```

Review and confirm the proposed update. BB follows the installed branch, builds
and reloads a compatible version. Use `bb plugin source agent-harness` to check
its resolved commit afterward. Git tags or exact commit installs are pinned;
the same update command also works for Git release-range installs such as `@^0.2.0`.

Updates keep the same plugin ID and BB-managed settings/storage. This release
preserves Goals configuration, saved goal text, schedule identities and feature
preferences. It does not rerun setup or change the existing automation. New
child-composer preferences start with defaults until the first successful child
creation; preferences from a separate plugin are not imported. Start a new agent
session if it still lists old skills.

Use update without uninstalling first. `bb plugin remove` deletes plugin settings,
secrets and schedules; reinstalling an already-installed managed source is refused.
There is no need to rerun `bb agent-harness setup` unless you want to change its
configuration. A failed activation restores the previous version and reports the
failure; inspect `bb plugin update-jobs` or `bb plugin logs agent-harness`.

## Configure after installation

Run this inside a BB thread to open the setup form:

```sh
bb agent-harness setup
```

The same form is available in **Settings → Agent Harness → Setup**. From an
ordinary terminal, pass `--thread <id>` or use settings. Choose features, a Goals
destination, timezone, evidence sources, and an optional schedule. Review the
summary, then apply. Installation itself creates no Goals thread or automation.

The optional Goals pane saves exact goal text with revision/week/timezone checks.
Scheduled briefs use BB Automations and the generalized `weekly-goals-brief`
skill. Re-running setup updates its owned schedule and preserves goals. External
GitLab/Slack access is checked by the first brief through existing agent tools;
setup does not copy credentials or existing personal goal data.

See [Goals setup and recovery](plugin/goals/README.md) for manual-only mode,
CLI JSON configuration, calendar behavior, and incomplete-operation recovery.

## What it includes

| Skill | Purpose |
| --- | --- |
| `user-scenarios` | Explain behavior through verified user steps, conditions, and before/after results. |
| `r-plan` | Keep researched scope, acceptance criteria, implementation units, progress, and verification in one `PLAN.md`. |
| `restate` | Check the intended task with `--restate` before doing work. |
| `adhd` | Rewrite an answer with `/adhd`, or append summaries when standing instructions enable them. |
| `unsure` | Examine whether a proposed solution addresses the right problem. |
| `handoff` | Preserve the goal, constraints, evidence, and next action for a fresh session. |
| `be-ambitious` | Improve a prompt's sources, methods, and verification without expanding its scope. |
| `plain-communication` | Write clear technical explanations without losing conditions, negations, or exact identifiers. |
| `working-artifacts` | Keep working plans and evidence in the active project. |
| `thread-routing` | Handle child/sibling relationships, execution settings, and notification modes. |
| `completion-focus` | Return focus to the captured origin for `--notify`. |
| `sync-harness` | Manually generalize personal harness improvements with install checks and resumable review checkpoints. |
| `weekly-goals-brief` | Assess configured goals from scoped evidence and save explicit user updates. |
| `side-chats` | Use the panel for context-preserving questions and selected-answer handoffs. |

The full plugin also ships the retained commit, review, verification, shipping,
implementation-research, Mermaid, memory, and oneshot skills. `r-plan` replaces
the old plan/PRD pair. The loop runner, run-state helper, visualizer, and memory
turn counter are removed.

`handoff` and `be-ambitious` are useful additions to the original four: they
preserve context between sessions and improve a task's evidence and verification.
The skills do not require organization-specific services. The retained `ah-inspire`
workflow requires external `gh`, DeepWiki, and Exa capabilities; installing the
plugin does not install those commands or services. Mermaid rendering requires
Bun; its rendering dependency is bundled. Thread routing and focus require
a harness with the corresponding capabilities; the skills include BB instructions
and report unsupported capabilities instead of silently changing the request.

### Standing instructions

The plugin contributes [instructions/AGENTS.md](instructions/AGENTS.md) to agent
sessions. It does not write to your project's or user's `AGENTS.md`. The block
activates the communication style, summaries, artifact conventions, request
modifiers, browser preference, and BB title icons. Detailed behavior stays in skills.

Turn this instruction contribution off in the plugin's settings using **Use
communication, request-modifier, and artifact preferences**. Skills and the panel
remain available. Changes apply when BB next constructs the provider session.

Examples:

```text
Investigate this bug without changing code. --child claude stuck
Review this diff in the same workspace. --sibling codex off
Check that you understand this task. --restate --child
Run these checks and return here afterward. --notify
```

A child belongs to the origin. A sibling shares the origin's parent, or remains
top-level when the origin has no parent. Siblings use the origin's execution
settings. `auto` reports all outcomes to the new thread's parent; `stuck` omits
successful completions; `off` suppresses all automatic parent reports. A top-level
sibling has no parent to notify. `--restate` prevents spawning unless the user
explicitly asks to continue. Quoted flags and requests to document them do not
activate routing.

### Child-thread composer

Choose **New Child Thread…** from a thread's actions menu, or press
**Cmd+Shift+Enter** (macOS) / **Ctrl+Shift+Enter** (Windows/Linux) while its
composer is focused. You can also add it as a row quick action through
**Customize actions**.

The dialog uses BB's native composer, including mentions, attachments, voice,
and execution controls. It starts a fresh child in the parent's project and
workspace. Choose parent notifications and whether to stay on the current page;
successful creation remembers those choices and the selected provider.

The UI ships with the BB plugin; importing only skills does not add it. If another
plugin provides the same action/shortcut, keep one shortcut binding enabled and
remove the duplicate action registration when migrating. This installation does
not modify another plugin. See [composer details](plugin/child-thread-composer.md)
for draft handling, agent access, and verification limits.

### Side chats panel

Open **Side chats** in a thread's panel and choose **+ New chat**. Enter a question
in the native composer. Each chat inherits the source conversation and keeps its
first local user question as its list label. Reopen a question to continue it;
use **Send to main thread** on an assistant answer to queue only that answer back.
Archive with **×** and use **Undo** within ten seconds.

Native BB chat owns drafts and execution controls. Failed refreshes keep the open
chat and previous rows. New chats are lifecycle-owned by their source, so source
archival/deletion applies to them. Existing built-in and Brain Shortcut side-chat
history remains recognizable through its persisted source metadata.

If Brain Shortcut already supplies this custom panel, enabling Agent Harness adds
another panel until that existing registration is removed. This distribution does
not disable or edit Brain Shortcut. See [plugin/README.md](plugin/README.md) for
RPCs, ownership, and verification boundaries.

## Optional skills-only import

For other agents, or when you only want the portable skill files, run this inside
the destination project:

```sh
npx skills add https://github.com/Overload119/agent-harness/tree/main/dist/skills
```

The [skills CLI](https://github.com/vercel-labs/skills) lets you choose skills and
agents. For example:

```sh
npx skills add https://github.com/Overload119/agent-harness/tree/main/dist/skills \
  --skill user-scenarios restate adhd unsure --agent claude-code codex --yes
```

Use `--list` to preview, `--global` for user-level installation, or repeat the
command to import updates. To try unpushed changes from another project:

```sh
npx skills add /path/to/agent-harness/dist/skills
```

This installs skill files only. It does not install the panel, activate standing
rules, run setup, or edit `AGENTS.md`. Copy the desired sections from
[AGENTS.example.md](AGENTS.example.md) into the destination's always-loaded
instructions if you want automatic summaries and reliable suffix routing.

## Maintain and verify

Edit `skills/ah-<name>/SKILL.md.liquid`, not generated copies. The export script
renders the portable selection to `dist/skills/` and all plugin skills to
`dist/plugin-skills/`. It also compiles the standing instructions into
`src/plugin/instructions.ts` and bundles the Mermaid renderer's dependency so
that helper can run outside this checkout. Bun is required to run the renderer.

```sh
npm ci --include=dev
bun run export:skills
bun run build:plugin
bun run test:plugin
bun test test/setup/ test/harness/ test/support/
```

Commit the templates, rendered skill directories, generated instruction module,
and lockfiles together. BB rebuilds the app/server bundles during Git installation;
those bundles are not maintained source. `bb plugin types --check .` checks the SDK
pin. After rebuilding an installed local copy, use `bb plugin reload agent-harness`.

Tests cover instruction delivery, source isolation, native fork attribution,
question labels, pagination, archive/undo, repeated clicks, failed refreshes,
stale responses, selected-answer queuing, and skill/resource distribution. A
fake-host test does not prove live layout or multi-plugin tab behavior. Build and
test the distribution without installing or activating it in this source checkout.

### Sync improvements from a personal harness

Invoke **“Sync my harness improvements into agent-harness”** (or `$sync-harness`)
with the source and distribution repositories available. This manual workflow is
included in the BB plugin, skills-only export, and legacy project bootstrap. It
requires Git and Bun; it does not create a schedule or copy changes automatically.

Keep machine paths and review state in an ignored local directory, normally
`.agent-harness/sync-harness/`. Configure the source scopes, destination mappings,
and intentional exclusions using the skill's
[configuration and recovery reference](skills/ah-sync-harness/references/workflow.md).
The initial scan lists current files as unreviewed. Subsequent scans compare exact
reviewed content, including dirty work, and retain unresolved items. The agent
classifies and adapts useful changes, updates their installation paths, and tests
fresh installation and upgrade in disposable destinations before checkpointing.
Failed checks leave checkpoints unchanged; omitted files remain unreviewed.
Maintaining this distribution never requires applying its preferences to itself.

### Legacy project bootstrap

`install.sh`, `bin/setup`, and `src/setup/` remain available for the older project
bootstrap flow. They are separate from the primary BB installation and are not
run by `bb plugin install` or `npx skills add`. They render skills into a destination
project and retain the old OpenCode commands and optional memory CLI. They do not
install the removed loop, run-state, visualizer, or memory counter.

Use `bun run build:legacy` after editing that installer. Verify it from an isolated
destination with the source checkout's `bin/setup --yes --overwrite`; do not run
setup here just to maintain distribution sources. Locally edited managed skills
are preserved when retired sources are removed. Existing `.agents/` copies in
this checkout are installation artifacts, not distribution source.

Keep `.agents/agent-harness-install.json` locally between legacy setup runs, but
do not commit it. It records absolute source/destination paths and installed file
hashes so upgrades can identify managed skills and preserve local edits. Setup
adds an ignore rule for this file; it does not untrack files already committed
by a destination project. For a previously tracked manifest, run
`git rm --cached -- .agents/agent-harness-install.json` to keep the local file
while removing it from Git. Deleting it loses the ownership record: existing
skill directories then remain unmanaged, even with `--overwrite`.

This source repository also ignores installed `.agents/skills/` copies. Consumer
projects can choose to track their installed skills; setup does not ignore those
directories. The maintained sources are `skills/`, and the distributable exports
are `dist/skills/` and `dist/plugin-skills/`.
