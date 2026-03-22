# agent harness

Everyone's got an agent harness. This is mine, built exactly how I want it to work and intended to be used with OpenCode.

It serves as a baseline setup for agent-driven development, giving me a consistent starting point that I can reuse and adapt as needed.

## Prerequisites

Install bun.

## Getting Started

Run this command in the repo you want to bootstrap with this harness.

```bash
mkdir -p /tmp/agent-harness && git clone https://github.com/garrytan/agent-harness.git /tmp/agent-harness && /tmp/agent-harness/bin/setup
```

By default, `bin/setup` reads skills from the cloned harness repo and installs them into the repo in your current working directory.

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
- `/oneshot`: run the loop as a coordinated plan -> prd -> execute -> review -> verify flow
- `/ship`: prepare validated work for shipping using repo-local instructions when available

The installer renders templates with shared variables such as `{ path: ".agent-harness" }`, writes `.agents/agent-harness-install.json` so upgrades can safely target harness-managed skill directories, and adds `.agent-harness/` to the target repo's `.gitignore`.

This repo is intentionally recursive: `agent-harness` uses `agent-harness` to build `agent-harness`, so the generated `.agents/` install tree is checked in here as a real example of the shipped skills after rendering.

## Visualizer

Build the local GUI launcher:

```bash
bun run build:visualizer
```

Then run:

```bash
bin/ah-vis
```

To open a specific PRD directly:

```bash
bin/ah-vis .agent-harness/prds/setup-upgrade-workflow.json
```

`ah-vis` rebuilds the visualizer, starts a local server, and opens the GUI in your browser. Keep the terminal session running while you use it.

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
