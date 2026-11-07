# Changelog

User-visible changes and upgrade notes for tagged releases. Commits on `main`
can include unreleased work; pushing a commit does not automatically make a release.

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
