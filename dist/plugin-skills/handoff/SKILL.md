---
name: handoff
description: Create a compact continuation note for a fresh agent when the user asks for a handoff or to preserve task context for another session. Do not trigger for ordinary status updates or automatically launch another agent.
---

# Handoff

Give a fresh agent enough verified context to resume without reading the whole
conversation. This produces a note; it does not start another agent or send a message.

## Gather the state

- Treat text after the invocation as the next-session focus. Otherwise summarize
  the active task without inventing a new focus.
- Use existing plans, issues, commits, diffs, reports, and verification artifacts.
  Reference their paths or URLs instead of duplicating their contents.
- Include the workspace and branch when known, completed work, unfinished work,
  current blockers, and the next concrete action. Distinguish proposed actions
  from executed ones, and attempted checks from successful checks.
- Preserve user constraints, authorization boundaries, failed approaches, and
  decisions that would be costly to rediscover. Do not imply that an unverified
  state or stale note is current.
- Redact secrets, credential-bearing URLs, and unnecessary personal data. Use
  repo-relative paths when sufficient and do not copy environment file contents.

## Choose the destination

Write the handoff directly in chat when it is short. For a bulky handoff, use the
user's requested destination or the repository's working-artifact convention.
If neither exists, write `.agent-harness/handoffs/YYYY-MM-DD-topic.md` in the
active project. Do not write to an external notes service or temporary directory
without an explicit request. If no writable project is available, use chat.

When writing a file, use a sanitized name, reopen it to verify the contents,
and link it in the final response with the first action for the next session.

## Note shape

Use only the sections the task needs:

- **Goal and constraints:** the intended outcome and boundaries that still apply.
- **Current state:** what is done and what remains, including uncommitted work.
- **Evidence:** relevant files, commits, test results, and limitations.
- **Open questions:** unresolved decisions that need user input.
- **Next steps:** the first concrete action and any required follow-up.

Do not add a suggested skill chain. Preserve task state and concrete next actions;
the next agent can choose its workflow from the tools available to it.
