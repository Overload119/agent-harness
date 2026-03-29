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
