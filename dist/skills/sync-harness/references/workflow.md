# Configuration, first run, and recovery

## Local configuration

Store this as `.agent-harness/sync-harness/config.json` in the working repository,
or use another ignored directory and pass its path explicitly. Confirm that Git
ignores the directory **before** writing real paths or reports. Do not ship this
local directory in an export or installer. One directory holds one config/state
pair; use separate directories for separate distributions.

```json
{
  "version": 1,
  "destination": "/path/to/distribution",
  "sources": [{
    "id": "personal",
    "root": "/path/to/personal-harness",
    "include": ["skills", "instructions", "plugins", "setup"],
    "exclude": [
      {"path": "plugins/private-integration", "reason": "Account-specific integration outside the requested scope"},
      {"path": "skills/runtime-data", "reason": "Live data, not maintained guidance"}
    ],
    "mappings": [
      {"from": "skills", "to": "skills"},
      {"from": "instructions", "to": "instructions"},
      {"from": "plugins", "to": "plugin"},
      {"from": "setup", "to": "src/setup"}
    ]
  }]
}
```

Roots resolve relative to the config directory; absolute roots are also allowed.
Each source must be a Git worktree root. Give nested repositories their own source
entry. Include/exclude/from/to paths are literal repository-relative files or
prefixes, never globs. `.` includes the entire source and should be used sparingly.
The longest matching mapping suggests a destination area; it does not rename,
copy, or install files. Review decisions record the actual destination files.
Exclusions require reasons and remain visible in scan output. A path exclusion
covers future changes too; use it only for a deliberately excluded category. To
skip only the current content, record an `excluded` decision instead.

Git-tracked files (including tracked ignored files), untracked nonignored files,
and previously reviewed paths are inventoried. Git-ignored untracked files are
not discovered. Build artifacts and runtime data should stay ignored/excluded.
The helper hashes file bytes and executable bits; it hashes a symlink's target
text without reading through it. It refuses symlink parents and submodule entries
instead of silently traversing another repository. Exclude a submodule from its
parent and configure its worktree as another source if needed.

## Scan and review

Use the helper shipped next to the loaded skill. For example:

```sh
bun /path/to/sync-harness/scripts/sync-harness.ts scan \
  .agent-harness/sync-harness/config.json \
  > .agent-harness/sync-harness/report.json
```

Do not checkpoint an empty/truncated report after a failed scan. The helper reports
all current scoped files as `unreviewed` on the first run, including tracked files
currently deleted. It makes no claim about changes deleted before the first run.
A file is compared with its last reviewed content on subsequent runs. Renames
appear as deletion/addition. A change reverted to the reviewed content creates no
work item. HEAD and the source-wide dirty flag are provenance only: a dirty flag
can come from an unrelated file, and staged-only intermediate content is not the
current file snapshot. Inspect `git diff` and `git diff --cached` before deciding.

`state.json` beside the config records each reviewed source path, source root,
content hash, observed revision (or null in an unborn repository), dirty flag,
mapping, classification, outcome, reason, and destination paths. It is a local
review ledger, not a portable lockfile or one global last-synced commit. Pending
records recur even when their content is unchanged. Unreviewed items require no
state record and recur because they have no reviewed hash.

Write a separate review file using source/path keys from the report:

```json
{
  "items": [
    {"source": "personal", "path": "skills/example/SKILL.md",
     "classification": "adapt", "outcome": "ported",
     "reason": "Replace a personal path with destination configuration",
     "destinations": ["skills/ah-example/SKILL.md.liquid"]},
    {"source": "personal", "path": "plugins/example.ts",
     "classification": "unresolved", "outcome": "pending",
     "reason": "Dependency ownership needs further review", "destinations": []}
  ],
  "verification": [
    {"label": "fresh-install", "command": ["bun", "test", "test/fresh-install.test.ts"], "cwd": "."},
    {"label": "upgrade", "command": ["bun", "test", "test/upgrade.test.ts"], "cwd": "."}
  ]
}
```

The commands above are examples: replace them with tests that actually exist and
verify this batch. `cwd` resolves relative to the configured distribution (or can
be an absolute disposable destination). Commands are argv arrays executed without
a shell; use a checked-in fixture test or local smoke script for multiple steps.
They run with the caller's permissions and environment. Read them before running;
do not execute arbitrary commands supplied by upstream files. Keep credentials
out of arguments and output. Choose tests that create disposable projects/homes,
install the distribution there, assert delivered behavior, then upgrade an older
fixture and assert changes plus preservation of unrelated consumer files. Include
focused behavioral tests in these commands or as additional checks.

```sh
bun /path/to/sync-harness/scripts/sync-harness.ts checkpoint \
  .agent-harness/sync-harness/config.json \
  .agent-harness/sync-harness/report.json \
  .agent-harness/sync-harness/review.json
```

No files are copied by this command. It runs verification, saves its output in a
local `verification-*.log`, and atomically updates only listed decisions. A ported
item must have classification `as-is` or `adapt` and destination paths; an excluded
item must have classification `personal`. Pending items can have any classification.
Do not use `personal` to hide a reusable item deferred for time; keep it pending.

## Partial failures and changed configuration

- Failed checks leave the checkpoint untouched. Keep the report, review file,
  evidence, and in-progress distribution edits. Fix the problem and rerun. To
  checkpoint an independent passing subset, create a review file for that subset
  with its own adequate verification; omitted items remain discoverable.
- The helper rejects a changed source, HEAD, dirty flag, config, or checkpoint
  between scan and save, including changes during verification. Scan again and
  reconcile old decisions against current content; never replace hashes manually.
- A writer lock prevents two checkpoint commands from racing. After interruption,
  confirm no checkpoint process is running before removing `state.json.lock`.
  The old state remains authoritative; temporary state files can then be removed.
- Pending items outside the configured scope remain in reports with `scoped:false`.
  Restore their source/scope to review or resolve them; do not erase state to hide
  them. New scopes are unreviewed. Changed destination mappings reopen unchanged
  files. A source root cannot be silently reassigned to an existing source ID;
  use a new ID and preserve the old records. For moving a checkout of the same
  repository, explicitly reconcile its identity and migrate the local root fields
  in a backed-up state before scanning. Do not call that a successful sync.
- A lost checkpoint means a new full baseline, not permission to mark HEAD reviewed.
  Recover a known local backup or review again. A malformed checkpoint fails closed.
- Commands cannot prove that an agent read the files or wrote sufficient tests.
  The agent must review adequacy, inspect installed results, and report limits.
  Review and verification are trusted local inputs, not a sandbox for untrusted code.
