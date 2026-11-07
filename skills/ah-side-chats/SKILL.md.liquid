---
name: side-chats
description: Use or explain the BB Agent Harness Side chats panel for context-preserving side questions, reopening conversations, archive/undo, and sending a selected answer back to the source. Requires the agent-harness BB plugin for its UI and RPCs. A skill import alone does not install the panel. Not a substitute for child/sibling task delegation.
---

# Side chats

Keep a side question separate from the main task while retaining the source
conversation's context. Use the installed BB `agent-harness` plugin. If it is not
installed, explain that limitation and point to its installation instructions;
do not pretend a skill file creates a panel or silently install software.

## User workflow

1. Open **Side chats** in the source thread's panel and choose **+ New chat**.
   This creates an idle hidden fork of that exact source with its conversation
   context. It does not start a task or send a prompt yet.
2. Enter the question in the native chat composer. The list uses the first
   local user question as its label and preserves it through follow-ups.
   Hover or focus a row to read the full question.
3. Select an existing question to reopen its conversation. Native chat owns
   drafts, model/permission controls, and messages. Switching questions must not
   replace the main task or reuse a different question's draft.
4. Choose **Send to main thread** on an assistant answer only when the user
   wants that answer sent back. This queues the selected answer's text to the
   captured source thread; it does not send the entire conversation or silently
   summarize it. Do not automatically promote every side-chat answer.
5. Use the row's **×** control to archive that chat. **Undo** is offered for ten
   seconds. Archival preserves history. The source owns newly created side chats:
   archiving/deleting the source archives/deletes them through BB's lifecycle.

A failed refresh keeps the current conversation and previous list available.
Use **Refresh** to retry. **Show more** loads additional rows. Report a creation
or send failure rather than repeating an uncertain operation and making duplicates.

## Agent access

Check `bb plugin list --json` for the `agent-harness` plugin, then inspect its
current RPCs with `bb plugin rpc inspect agent-harness`. Use
`bb plugin rpc call agent-harness <method> --input-file <json-file> --json`;
write JSON with a structured tool or literal file contents, never interpolate
user text into shell code.

| Method | Input | Result |
| --- | --- | --- |
| `questions` | `sourceThreadId`, optional nonnegative `offset` | `items`, `nextOffset`; follow pages until null |
| `newQuestion` | `sourceThreadId` | Idle fork's `threadId`; does not send a question |
| `archiveQuestion` | `sourceThreadId`, `threadId` | Archives only a related side chat |
| `restoreQuestion` | `sourceThreadId`, `threadId` | Restores only a related side chat whose source is active |

Resolve the source from the explicit request or stable execution context, not
the currently focused UI. Verify returned IDs and `sourceThreadId` before acting.
Create, archive, restore, or send only when requested. For a new question, prefer
the native composer so its first user message becomes the list label. Agent-only
seed text and inherited history are deliberately excluded from labels.

For an explicitly requested send outside the UI, resolve the exact source and
selected assistant message, then use the harness's supported queue operation.
With the BB CLI, `bb thread tell <source-id> --mode queue --message-file <file>`
queues that exact answer. Do not prepend an invented summary or resend an
uncertain result. The panel's native action also records its sender thread.

## Keep delegation distinct

`--child` and `--sibling` use the thread-routing skill: they create a task
conversation with explicit ownership, settings, and notification policy. Side
chats are context forks for questions. Do not substitute a fork for a requested
sibling, create a new worktree, or expand an explanation request into implementation.

The plugin can show its own chats and existing built-in Side chat
forks. It also recognizes persisted Brain Shortcut side chats so extracting the
panel does not hide existing history; this does not require that plugin to run.
