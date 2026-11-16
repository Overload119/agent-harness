# Changelog

User-visible changes and upgrade notes for tagged releases. Commits on `main`
can include unreleased work; pushing a commit does not automatically make a release.

## [0.3.0](https://github.com/Overload119/agent-harness/releases/tag/v0.3.0) — 2026-11-15

### Added

- Self-contained `explain-inline` skill: a reusable explanation component
  library (Lifecycle, CodeMap, CodeTour, Mermaid, Chart, Grid/Stat, Steps,
  Callout) with guidance on when to use each, and an embedded offline Pele
  1.13.0 Mermaid renderer. Lifecycle and CodeMap draw directed arrows between
  parts; Lifecycle animates a marker along each active step. Pages follow BB's
  live theme. Changed lines use BB's Diff tab or a `diff` code fence; the library
  has no Diff component.
- Portable `premortem` and `r-teach` skills, including source-verified questions,
  visual answer reveals, and optional reminders requiring an explicit request.

### Fixed

- Remove development history and assumed tools from reusable skill instructions.
- Correct memory lookup commands, default-branch handling, and GitHub CLI guidance.
  Preserve unrelated changes when committing, use available browser tools for
  verification, and keep teaching answers hidden until the reveal step.

### Upgrade

- Existing `@main` installs: run `bb plugin update agent-harness`. The plugin ID,
  settings and storage formats are unchanged. No setup rerun is required.
- BB >=0.47 and Plugin SDK >=0.6.75 remain required. The explanation extraction
  recipe uses Bun; generated pages work offline in a modern browser with
  `DecompressionStream`. Mermaid rendering is embedded in the skill.
- Exact tags remain pinned; `@^0.2.0` does not include this minor release.

### Verification

All 75 tests (892 assertions), plugin typechecking, the plugin build and an
isolated production-only build passed. Offline browser checks covered playback,
responsive layouts and reduced motion. `bb plugin types --check .` still reports
the existing SDK pin drift (repository 0.6.75; validating host 0.6.132); SDK and
host-shim dependency pins were not changed in this release. No live plugin
activation or live schedule changes were performed.

## [0.2.0](https://github.com/Overload119/agent-harness/releases/tag/v0.2.0) — 2026-11-07

First tagged release of the combined Agent Harness BB plugin.

### Added

- One BB plugin with reusable skills, optional standing instructions, Side chats,
  and configurable weekly Goals with scheduled briefs.
- Native child-thread composer in thread actions and through Cmd/Ctrl+Shift+Enter,
  with rich input, execution controls, parent notifications and stay-on-page preferences.
- Reviewed Goals setup, timezone-aware weeks, protected goal saves, scoped evidence
  sources, and recovery after interrupted setup.
- Portable skills-only exports and a sync-harness workflow for reviewing reusable
  improvements from other projects.

### Changed

- Use `bb plugin install` as the primary installation path. The legacy bootstrap
  remains available separately.
- Replace the old plan/PRD pair with `r-plan` and one executable plan.
- Generalize examples and remove personal service dependencies from shipped guidance.
- Keep destination install manifests and source-checkout skill copies out of Git.

### Removed

- Retired loop runner, run-state helper, visualizer and memory turn counter.

### Upgrade

- Requires BB >=0.47 and Plugin SDK >=0.6.75.
- Existing `@main` installs: run `bb plugin update agent-harness`. The plugin ID and
  storage keys are unchanged; existing setup, saved goals and preferences remain.
  No setup rerun or automation replacement is required. New composer preferences
  begin with defaults; settings from a different plugin are not imported.
- Do not uninstall first: removal deletes saved plugin configuration. If another
  plugin provides the same child-thread action, keep only one shortcut binding enabled.
- New users can track patches in this release line with `@^0.2.0`, or use `@main`
  for the latest commits. An exact `@v0.2.0` install is pinned and does not track updates.
- Legacy bootstrap users and separate Goals/Side chats plugins are not automatically
  migrated. Existing personal goal databases are not imported.

### Verification

The code passed 67 tests, typechecking, SDK compatibility checks, plugin builds,
and an isolated production-dependency build. No live plugin activation or live
schedule changes were performed as part of release verification.
