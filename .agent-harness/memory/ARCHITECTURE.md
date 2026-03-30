---

## Plugin bug: Buffer.stdout.trim()
Date: 2026-03-29

### Why it matters
- `ah-memory-turn-counter.js` plugin used `content.stdout.trim()` on ShellOutput
- `ShellOutput.stdout` is a `Buffer`, not a string, so `.trim()` doesn't exist
- Error: `TypeError: content.stdout.trim is not a function`

### Fix
- Use `await content.text()` instead of `content.stdout.trim()`
- `ShellOutput.text()` returns a Promise that resolves to the stdout as a string

### References
- `.opencode/plugins/ah-memory-turn-counter.js`

---

## Fix: constants.ts process.cwd() bug
Date: 2026-03-29

### Why it matters
- `src/setup/constants.ts` used `process.cwd()` to resolve `skills/ah-memory` path
- This caused setup to fail when run from outside the harness repo (e.g., user's project directory)
- Error: `ENOENT: no such file or directory, open '/path/to/user/project/skills/ah-memory/_memory-categories.md.liquid'`

### Root cause
- `TEMPLATE_VARIABLES.memory_categories` was computed at **module import time** using `process.cwd()`
- When setup is run from a different directory, `process.cwd()` returns the wrong path

### Fix
- Changed `constants.ts` to use `import.meta.url` via `fileURLToPath()` to resolve relative to script location
- Refactored `TEMPLATE_VARIABLES` from a constant to a `createTemplateVariables(repoRoot)` function
- The `repoRoot` is determined from the script path in `resolveSetupPaths()`

### Pattern to avoid next time
- Never use `process.cwd()` to resolve paths in module-level code that depends on file location
- Use `import.meta.url` / `fileURLToPath()` for portable file resolution
- When a module-level constant depends on runtime context, make it a function instead

### References
- `src/setup/constants.ts` - where the bug was
- `src/setup/runtime.ts` - `resolveSetupPaths()` determines `repoRoot` from script location
- `src/setup/run.ts` - calls `createTemplateVariables(paths.repoRoot)` at runtime

---

## bin/setup --overwrite Workflow
Date: 2026-03-28

### Why it matters
- `bin/setup` is the compiler for harness skills: it transforms `skills/*.SKILL.md.liquid` templates into `.agents/skills/` output
- After editing any skill source under `skills/`, you must regenerate with `bin/setup --overwrite --yes`
- The `--yes` flag is required for non-interactive use (piping `y` doesn't work due to how the prompt is read)

### Learned constraints
- Source of truth is `skills/*.SKILL.md.liquid`, NOT `.agents/skills/` — never edit the generated output directly
- Skills not managed by harness (like `inspire`) are skipped during install even with `--overwrite`
- The `--overwrite` flag replaces harness-managed skills but leaves other files alone

### Recommended patterns
- After editing a skill template, always run: `bin/setup --overwrite --yes`
- Use `--dry` first to preview what would change without applying it
- Skills directory naming convention: `skills/ah-<name>/` installs to `.agents/skills/<name>/`

### Avoid next time
- Don't try to pipe confirmation via `echo "y" | bin/setup --overwrite` — it won't work
- Don't edit files in `.agents/skills/` directly — changes will be overwritten

### References
- `skills/ah-plan/SKILL.md.liquid`
- `.agents/skills/plan/` (generated output)
- `bin/setup --help`

---

## Fix: bin/setup requires bun install before build
Date: 2026-03-29

### Why it matters
- `bin/setup` runs `bun scripts/build.ts` to build harness CLIs
- The build imports source files that depend on `commander`, `hono`, etc.
- Without running `bun install` first, the build fails with "Could not resolve: commander"

### Root cause
- The install.sh clones the harness repo to a temp dir and runs bin/setup
- bin/setup spawns `bun scripts/build.ts` but never runs `bun install`
- Dependencies in package.json aren't installed before build is attempted

### Fix
- Added `bun install` call in `src/setup/run.ts` before building
- Changed `install.sh` to use `/tmp/.agent-harness` as TMP_ROOT (not system temp)
- On macOS, TMPDIR defaults to `/var/folders/...` which falls outside allowed `/tmp/.agent-harness/**`

### Key files changed
- `src/setup/run.ts:77-86` - added `bun install` before build
- `install.sh:7` - changed `TMP_ROOT` to `/tmp/.agent-harness`
- `install.sh:37` - added `mkdir -p "${TMP_ROOT}"` before mktemp

### References
- `src/setup/run.ts`
- `install.sh`
- `scripts/build.ts`
- `opencode.json` (external_directory permission)

---

## OpenCode commands architecture: internal vs shipped distinction
Date: 2026-03-30

### Why it matters
- OpenCode commands need different treatment: some are for harness internal use, others are shipped to end-user repos
- Using a prefix convention (like skills) was tried but caused confusion
- The harness itself needs its own `.opencode/commands/` that is NOT shipped to targets

### Solution: Separate source directories
- `src/opencode/commands/` - user-facing commands shipped to targets during setup
- `src/harness/commands/` - source of truth for internal harness commands (like do-later.md)
- `.opencode/commands/` in harness - NOT shipped; managed like skills, restored on setup --overwrite

### Key files
- `src/setup/run.ts:295-396` - handles both internal (managed) and shipped commands
- `src/setup/types.ts` - `CommandInstallRecord` type for managed commands
- `src/harness/commands/do-later.md` - internal command source
- `src/opencode/commands/deploy.md` - user-facing command

### Pattern for adding new internal command
1. Add to `src/harness/commands/<name>.md`
2. Add command name to `commandNames` array in `src/setup/run.ts`
3. Run `bin/setup --overwrite --yes` to restore

### Pattern for adding new shipped command
1. Add to `src/opencode/commands/<name>.md`
2. Automatically shipped to targets on setup

### Key insight
- User-facing commands: no prefix needed, shipped via `src/opencode/commands/`
- Internal commands: managed via `commandNames` array and `CommandInstallRecord` metadata

---

## PR workflow lessons
Date: 2026-03-30

### Why it matters
- Merging main into feature branch and force-pushing causes commit history rewrite
- bin/setup is auto-generated from source - always rebuild before merging

### Learned constraints
- When PR has merge conflicts, hard reset to origin/main and re-apply essential changes cleanly
- Always rebuild bin/setup after hard reset: `bun scripts/build.ts`
- After merging main, rebuild and run tests before force-pushing

### Avoid next time
- Don't try to keep multiple commits through a merge - just hard reset and do one clean commit
- Don't merge main into a feature branch if the feature is ready - just force push

### References
- `bin/setup` - minified, auto-generated
- `scripts/build.ts` - builds all harness CLIs
