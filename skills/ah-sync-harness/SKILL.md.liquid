---
name: sync-harness
description: Manually review personal harness improvements and port reusable changes into a configured harness distribution, with explicit exclusions, install verification, and resumable checkpoints. Use when asked to sync harness improvements; do not run on a schedule or for ordinary project edits.
---

# Sync harness improvements

Review source changes, adapt reusable behavior, and deliver it through the target
distribution's supported installation paths. Generalization is an agent review
step. The helper inventories files and records decisions; it never copies code.
This skill does not authorize a broad initial port, publication, or a recurring
automation. Preserve the user's requested scope.

## Locate sources and checkpoints

Use the user-specified config or `SYNC_HARNESS_CONFIG`; otherwise look for
`.agent-harness/sync-harness/config.json` in the active project. If none exists,
identify the personal source repositories and distribution from context, then
create local configuration using [references/workflow.md](references/workflow.md).
Ask only when the repository or intended scope cannot be resolved. Never guess a
machine-specific path. Requirements: Git and Bun; no additional packages.

Read that reference before using the helper. Keep config, reports, review files,
and checkpoints in ignored local storage, outside installed skill directories.
Resolve maintained sources rather than editing generated runtime skill copies.
Read the distribution's instructions, README, installer/export code, and relevant
tests before choosing delivery changes. A distribution need not install or use
its own preferences or skills. Test in separate destinations.

Run `bun <skill-directory>/scripts/sync-harness.ts scan <config>` and save the JSON
report. This is read-only. No checkpoint means every current in-scope file is
unreviewed; it does not mean every file should be ported. Review only authorized
work and leave the remainder unreviewed. Never initialize the checkpoint to HEAD
just to suppress a large first scan. Inspect Git diffs and current files; the
report records net content changes, not an archive of every intermediate commit.
Dirty source revisions are provenance, not proof that committed content was
reviewed. Check staged and unstaged diffs; do not commit unrelated work.

## Review and adapt

Classify each reviewed item as **as-is**, **adapt**, or **personal**. Use
**unresolved** when the classification itself needs more evidence. Record a
reason, actual destination paths, and the outcome **ported**, **excluded**, or
**pending**. Omitted items stay unreviewed; pending items stay visible even if
their source is later removed from the configured scope.

- For reusable behavior, inspect its callers, dependencies, failure modes, and
  tests. Preserve the useful mechanism rather than blindly copying the file.
- Replace personal paths, account IDs, organizations, schedules, and integrations
  with configuration only when those capabilities belong in the distribution.
  Do not introduce a general framework to preserve a personal convenience.
- Exclude credentials, internal data, live goals, schedules, runtime state, and
  generated installation copies. Do not turn a one-off goal into shipped data.
  Check helper files, fixtures, screenshots, and documentation as well as prose.
- Check upstream deletions and renames against destination ownership. Do not
  delete a destination solely because an upstream file disappeared.
- Review plugins, instructions, skills, and setup changes as delivery units when
  they depend on each other. Update the relevant installer/export, declared
  dependencies, references, and tests so consumers receive the useful component.
  Do not port unrelated existing plugins merely because the scan finds them.

Preserve unrelated edits in both repositories. Keep one working `PLAN.md` under
`.agent-harness/` when the work needs a plan. A small sync can use its report and
review decisions as the evidence without inventing a larger workflow.

## Verify and checkpoint

Run focused behavior checks plus a fresh installation and an upgrade in disposable
destination projects or homes. Exercise the installed resources, not only the
source template. Include all supported delivery paths affected by the changes.
Never activate source-checkout preferences, modify the real home, or register a
temporary plugin merely to test distribution code.

Write the review JSON described in the reference. `checkpoint` runs its explicit
verification commands before saving any decisions. Every ported batch needs
`fresh-install` and `upgrade` checks. Choose checks that assert the actual changed
behavior; a label or a successful no-op is not evidence. The helper validates
command success, not the adequacy of the test. Exclusions and pending-only reviews
need reasons but no installation commands. If a relevant check fails, keep the
review file and source edits, fix the failure, and retry; do not advance a revision
manually. Do not relabel a failed ported batch as pending-only just to bypass its
failed checks; preserve the pending work in the review file instead. A stale report requires a new scan and reconciliation of decisions.

Report what was ported unchanged, adapted, intentionally excluded, still pending,
and left unreviewed. Include destination paths, test results and limitations,
checkpoint location, and remaining decisions. Do not claim an entire upstream
revision was synced when only some files were reviewed. Publishing, scheduling,
and deploying remain separate actions unless the user requested them.
