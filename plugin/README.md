# Side chats inside Agent Harness

The root `bb-plugin-agent-harness` package supplies this panel. Install from the
repository root; there is no separately installed Side chats package.

## Files and behavior

- `../app.tsx` registers one fixed **Side chats** panel per thread.
- `questions-view.tsx` keeps the question list, selection, refreshes, archive/undo,
  and native `ThreadChat` UI. It queues a selected assistant answer to the exact
  source through BB's native queue API.
- `questions.ts` defines and implements the four source-scoped RPC methods.
- `../server.ts` registers those methods and the optional standing-instruction
  contribution. `../instructions/AGENTS.md` is the instruction source.

New chats are idle hidden forks with the source's conversation context. The native
composer sends the question. Labels use the first local user question, not
inherited history, an agent-only seed, a generated title, or a later follow-up.
The list refreshes every five seconds while mounted and on window focus. It pages
through **Show more**, retains current state on failures, and discards responses
from a previous source. Create and archive operations guard repeated clicks.

**Send to main thread** queues only the selected assistant answer's text. It does
not forward all answers automatically. Archival preserves history; the toast offers
**Undo** for ten seconds. The source lifecycle owns new chats: archiving/deleting
the source archives/deletes them. Restore the source before restoring a dependent.

## Agent and CLI access

Inspect current contracts with:

```sh
bb plugin rpc inspect agent-harness
bb plugin rpc call agent-harness <method> --input-file <json-file> --json
```

| Method | Input | Output |
| --- | --- | --- |
| `questions` | `sourceThreadId`, optional `offset` | `items`, `nextOffset` |
| `newQuestion` | `sourceThreadId` | Idle fork metadata, including `threadId` |
| `archiveQuestion` | `sourceThreadId`, `threadId` | `{ "changed": true }` |
| `restoreQuestion` | `sourceThreadId`, `threadId` | `{ "changed": true }` |

Follow `nextOffset` until null. Archive/restore reject unrelated threads. All
mutations require a request from the user; merely reading the bundled skill does
not authorize creating chats or sending messages. The CLI equivalent for an
explicitly selected answer is `bb thread tell <source-id> --mode queue
--message-file <file>`. The native panel action also records the sender thread.

The skill template is `../skills/ah-side-chats/SKILL.md.liquid`. Run
`bun run export:skills` from the repo root after editing it.

## Existing history and recovery

The panel recognizes its own `agent-harness` forks, built-in `side-chat` forks,
and persisted forks from the former `side-chats` or Brain Shortcut registrations.
This preserves access to thread history without depending on those plugins.
Only chats whose source, origin kind, visibility, and ownership match are eligible.

Do not enable two custom question-list panels unless you intend to see both.
This package does not remove Brain Shortcut's registration or migrate/delete BB
thread data. Unloading Agent Harness removes its UI and instruction contribution;
thread history remains in BB's storage. No plugin-owned database or host service
is required.

## Verification

From the repository root, use `bun run test:plugin`, `bb plugin types --check .`,
and `bun run build:plugin`. Tests exercise the public BB fake host and component
harness. They cover source boundaries, labels, pagination, archive/undo, stale and
failed refreshes, repeated clicks, instruction toggling, and selected-answer
queuing. Production entrypoints are typechecked; Bun executes test files.

The test harness does not prove live CSS/layout, native session persistence, or
multi-plugin tab arbitration. A clean production-dependency build checks the Git
installation's bundling path without installing into a user's running BB.
