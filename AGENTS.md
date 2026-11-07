## Distribution sources

- This is a distribution repository. Maintaining it does not require installing
  its skills, standing preferences, or plugin into the source checkout.
- The primary product is the root BB plugin: `package.json`, `server.ts`,
  `app.tsx`, and `plugin/`. Install with `bb plugin install`; do not activate it
  in the user's BB merely to verify a source change.
- Maintain skills in `skills/ah-<name>/SKILL.md.liquid`. Never edit generated
  `.agents/skills`, `dist/skills`, or `dist/plugin-skills` copies directly.
- `bun run export:skills` renders the portable selection to `dist/skills` and
  all plugin skills to `dist/plugin-skills`. It bundles the Mermaid renderer's
  dependency and compiles `instructions/AGENTS.md` into
  `src/plugin/instructions.ts`. Commit these generated distribution resources
  with their sources. `AGENTS.example.md` is the optional manual trigger block
  for consumers who install only skills.
- Keep reusable guidance free of personal paths and organization-specific dependencies. Label
  harness-specific adapters and report unsupported capabilities rather than
  silently changing relationships, permissions, or notification behavior.
- `instructions/AGENTS.md` contains shipped preferences, not instructions that
  this source repository must consume. Keep it within BB's 4096-character
  contribution limit. The root plugin exposes a setting to disable it.
- Keep native Side chats behavior separate from task delegation. Do not equate
  a context fork, child conversation, and sibling conversation. Preserve the
  source-thread identity, existing history, and lifecycle ownership.
- Install maintained local plugins only from permanent checkouts. Verify the
  registered source and running status when an installation is requested.

## Build and verification

- Use Bun/TypeScript for scripts. Use `rg` for searches; do not assume `timeout`
  is available on every machine.
- `bun run build:plugin` exports resources and builds the root BB plugin.
- `bun run test:plugin` runs backend/component/distribution tests and typechecks
  production plugin entrypoints. `bb plugin types --check .` verifies the SDK pin.
- Run `bun test test/setup/ test/harness/ test/support/` for retained installer
  and shared-helper changes. Keep test fixtures isolated from user configuration.
- Test production-dependency packaging in a clean copy, without installing or
  activating that temporary copy. The Git installer builds with dev dependencies
  omitted and lifecycle scripts disabled. Runtime dependencies must be declared;
  host-shimmed packages belong in devDependencies for types and local tests.
- The loop runner, run-state helper, visualizer, and memory counter are removed.
  Do not reintroduce their source, build targets, tests, or dependencies.

## Legacy bootstrap

- `bin/setup`, `install.sh`, and `src/setup/` retain the older project bootstrap
  flow. They are not the primary BB install path and are not run by the plugin.
- Rebuild installer changes with `bun run build:legacy`. Verify with the source
  checkout's `bin/setup --yes --overwrite` from an isolated destination project.
  Do not run setup here as a required maintenance step.
- Setup strips the `ah-` directory prefix when installing templates, for example
  `skills/ah-r-plan` becomes `.agents/skills/r-plan` in the destination. The BB
  plugin export uses each skill's frontmatter name.
- User-facing OpenCode commands live in `src/opencode/commands/`; setup copies
  them to the destination `.opencode/commands/`. Internal commands live in
  `src/harness/commands/` and are managed only for a harness-repo setup.

## Goals workflow

- `plugin/goals/` owns setup, calendar/goal state, and the public automation CLI adapter.
- Keep setup inert until explicit apply. Never import the separate personal Goals database.
- Preserve revision checks, exact text, saved confirmations, schedule ownership, and
  recovery after uncertain creation. Test with fake services, not live schedules.
- Maintain the generalized briefing skill in `skills/ah-weekly-goals-brief/`.
  No organization-specific commands, source identifiers or personal paths belong there.
