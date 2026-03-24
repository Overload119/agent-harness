# agent harness

Everyone's got an agent harness. This is mine, built exactly how I want it to work and intended to be used with OpenCode.

It serves as a baseline setup for agent-driven development, giving me a consistent starting point that I can reuse and adapt as needed across my projects.

## Prerequisites

Install bun.

## Getting Started

Run this command in the repo you want to bootstrap with this harness.

```bash
mkdir -p /tmp/agent-harness && git clone https://github.com/garrytan/agent-harness.git /tmp/agent-harness && /tmp/agent-harness/bin/setup
```

By default, `bin/setup` reads skills from the cloned harness repo, installs them into the repo in your current working directory, and bootstraps AgentKits Memory for OpenCode.

Before it makes changes, `bin/setup` prompts for confirmation and shows the current repo path it will install into.

## Skills

Run `bin/setup` inside the repo you want to bootstrap to render the harness repo's `skills/**/SKILL.md.liquid` templates and install the result into `.agents/skills/`.

Current Ralph loop-oriented shipped skills:

- `/plan`: expand a rough request into an execution plan
- `/commit`: inspect the working tree and draft coherent commit proposals before staging anything
- `/prd`: convert a plan into deterministic PRD JSON under `.agent-harness/prds`
- `/review`: produce a structured implementation review
- `/verify`: choose and report the right verification strategy, including browser checks when appropriate
- `/compound`: persist reusable lessons under `.agent-harness/compounds`
- `/mermaid`: turn plans or systems into Mermaid diagrams and render browser-openable HTML artifacts
- `/executor`: execute one PRD task non-interactively for `ah-loop` inside a single repo checkout
- `/oneshot`: run the loop as a coordinated plan -> prd -> execute -> review -> verify flow
- `/ship`: prepare validated work for shipping using repo-local instructions when available
- `/memory`: recall prior decisions, patterns, errors, and session history through AgentKits Memory

The installer renders templates with shared variables such as `{ path: ".agent-harness" }`, writes `.agents/agent-harness-install.json` so upgrades can safely target harness-managed skill directories, adds `.agent-harness/` to the target repo's `.gitignore`, writes an `opencode.json` MCP entry for `@aitytech/agentkits-memory` using `bunx`, and installs a project-level OpenCode plugin at `.opencode/plugins/agentkits-memory.js` for memory capture hooks.

Mermaid diagrams are now a first-class harness artifact:

- source diagrams live in `.agent-harness/diagrams/`
- rendered browser artifacts live in `.generated/diagrams/`
- the shipped `/mermaid` skill is the default way to create both

This repo is intentionally recursive: `agent-harness` uses `agent-harness` to build `agent-harness`, so the generated `.agents/` install tree is checked in here as a real example of the shipped skills after rendering.

## Testing

This repo uses Bun's built-in test runner only; add new coverage with `bun test` instead of introducing a second test framework.

Test layers:

- Unit tests cover a single module or helper with lightweight fixtures and focused assertions. Place them beside the matching area under `test/<area>/` and name them `<subject>.test.ts`.
- Integration tests cover filesystem-heavy flows, CLI entrypoints, or multi-module behavior. Keep them in the same `test/<area>/` tree, but organize them around the top-level feature being exercised, such as `test/setup/` or `test/visualizer/`.
- Shared filesystem helpers belong in `test/support/fixtures.ts`; extend those helpers before copying temp-dir or temp-home setup into a new test file.

Current test layout mirrors the source areas it exercises so contributors can quickly place new file-focused coverage:

- `test/harness/` for harness path helpers
- `test/loop/` for loop coordination, locks, and PRD execution state
- `test/run-state/` for `ah-run-state` command parsing and persisted run updates
- `test/setup/` for setup and install flows
- `test/visualizer/` for visualizer routes, cards, and snapshot behavior
- `test/support/` for reusable fixtures and fixture self-tests

Common workflows:

- Full suite: `bun run test`
- Harness scope: `bun run test:harness`
- Loop scope: `bun run test:loop`
- Run-state scope: `bun run test:run-state`
- Setup scope: `bun run test:setup`
- Support scope: `bun run test:support`
- Visualizer scope: `bun run test:visualizer`
- Single file: `bun run test:file -- test/visualizer/prd-server.test.ts`

When a change touches a specific file, start with the closest matching test directory, add a unit test if the behavior is isolated, and prefer an integration test when the behavior depends on real filesystem state or multiple modules working together.

Run the full repo test suite with:

```bash
bun run test
```

`bun run test` is the primary test entrypoint for this repo and runs the harness, setup, visualizer, and support coverage added for the testing strategy.

## Visualizer

Build the local GUI launcher:

```bash
bun run build
```

Then run:

```bash
bin/ah-vis
```

`ah-vis` rebuilds the visualizer, starts a local server if one is not already running, waits for it to become healthy in a separate process, and opens the GUI in your browser. Keep the terminal session running while you use it.

The visualizer reads shared run state from `~/.agent-harness/runs/` and can show status across worktrees. The UI view is filtered using the command context that launched `bin/ah-vis`, rather than limiting results to repo or worktree paths under the current directory. Known test and fixture filesystem paths are always excluded.

## Loop Runner

Then run a PRD loop:

```bash
bin/ah-loop .agent-harness/prds/agent-harness-testing-strategy.json
```

`ah-loop` writes live run state to `~/.agent-harness/runs/`, logs to `~/.agent-harness/logs/`, updates the PRD as tasks complete, and emits heartbeats so `bin/ah-vis` can show status across worktrees.

`ah-loop` executes one assigned PRD task at a time by spawning a non-interactive OpenCode run inside the target worktree. The spawned agent is expected to use the shipped `ah-executor` skill and `bin/ah-run-state` for shared run persistence.

Execution model:

- one worktree or repo checkout should correspond to one `ah-loop` execution
- a single loop owns a single PRD and a single working tree while it runs
- parallel Ralph work should come from multiple worktrees or repo clones, not multiple loops mutating one checkout
- because run state lives in `~/.agent-harness/`, `ah-vis` can discover local run files from a shared location, reuse the same visualizer server across launches, and apply launch-context filtering without restricting visibility to a single parent directory

The visualizer's temporary runtime build output lives under `.generated/`, while `dist/visualizer/` can hold checked-in example assets and PRDs for the UI.

Preview changes without modifying files:

```bash
bin/setup --dry
```

Preview managed upgrades without modifying files:

```bash
bin/setup --dry --overwrite
```

Apply upgrades to harness-managed skills:

```bash
bin/setup --overwrite
```

If a skill directory already exists and is not managed by the harness installer, setup skips it instead of overwriting it. When a previously managed skill is no longer shipped by the harness, `--dry --overwrite` previews its removal and `--overwrite` removes it only if the target copy still matches the last installed manifest.
