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
