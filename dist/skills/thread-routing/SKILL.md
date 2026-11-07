---
name: thread-routing
description: Delegate a request to one child or sibling conversation using trailing --child or --sibling flags, or an explicit request for that relationship. Preserve context, workspace, execution settings, notification choices, and a single owner. Quoted flags and requests to document or change the convention do not create threads. Includes a BB adapter; other harnesses require equivalent capabilities.
---

# Thread routing

Move the requested work to one conversation with an explicit relationship.
Creating a thread and waiting for its work are separate decisions. Complete the
handoff, then return its link unless the user asks for the result here.

## Recognize the request

Accept these standalone flags among the trailing flags of the user's message:

```text
--child [codex|claude] [auto|stuck|off]
--sibling [codex|claude] [auto|stuck|off]
```

Both selectors are optional: `--child off`, `--child claude stuck`, and
`--sibling codex` are valid. Parse selectors only immediately after the routing
flag. An explicit instruction such as "use Claude" also selects the provider;
a task about Claude does not. Ask only when selections conflict or the requested
relationship cannot be resolved. Do not silently interpret misspelled flags.
If both `--child` and `--sibling` are requested, ask which relationship the user
wants and do not spawn until that conflict is resolved.

Quoted flags, code examples, and requests to document or change this convention
do not activate routing. A valid routing request authorizes one new thread,
not a new workspace, machine, implementation scope, or permission escalation.

## Preserve the relationship

Capture the originating conversation's stable ID from the execution context at
the start. Never infer it from whichever window or thread is focused later.
Read its project, workspace, parent, and execution settings.

| Request | New conversation's parent | Default workspace and settings |
| --- | --- | --- |
| Child | Originating conversation | Originating conversation |
| Sibling | Originating conversation's parent | Originating conversation |
| Sibling of a top-level conversation | No parent | Originating conversation |

A missing origin is an error, not evidence that it is top-level. Never create a
child and then reparent it to simulate a sibling. Siblings inherit the origin's
execution choices, not the shared parent's. Preserve the provider, model,
reasoning level, service tier, permissions, and provider options where known.
Report unresolved settings rather than claiming exact inheritance.

If the user selects a different provider, check its availability in the target
workspace and use its default model unless the user chose a compatible model.
Do not carry incompatible model/reasoning options across providers or silently
substitute an unavailable provider. Keep the existing permission boundary.

## Preserve notification intent

Default to `auto` when no mode is selected:

| Mode | Automatic reports to the new thread's parent |
| --- | --- |
| `auto` | Every finished, failed, or interrupted turn and every blocker |
| `stuck` | Failures, interruptions, and approval/question blockers; no successful completions |
| `off` | None |

For siblings, reports go to the shared parent, if any, not the origin. A
top-level sibling has no parent to notify. In `stuck` and `off` prompts, explicitly
tell the worker to keep completed results in its own conversation and not send
completion messages unless the user requests them. Otherwise explicit messages
could bypass the selected suppression. Do not send acknowledgements or polling
messages just to keep the worker active.

## Build a complete handoff

- Forward the full substantive request, relevant context, constraints, existing
  work, and expected result. Preserve investigation-only limits. A new task
  conversation may not inherit any history; a link alone is not enough context.
- Reference the origin for further context. Remove the routing flag and its
  selectors so the worker does not recursively delegate the same request.
- State the relationship and notification mode. For a sibling, explicitly say
  that completion reports do not go to the origin unless requested.
- Preserve other task constraints, including `--unsure`. The worker owns the
  direction check and any authorized work. With `--restate`, perform the
  understanding check here and stop before spawning unless explicitly told
  to continue. Remove a satisfied `--restate` from the worker's prompt.
- Handle `--notify` in the origin after the handoff, and remove it from the
  forwarded prompt. Use the completion-focus skill when available.
- Use a structured argument, file, or quoted stdin for the prompt. Never
  interpolate user text into shell code.

The destination owns the delegated task. Do not execute it again in the origin.
If explicitly requested workspace setup uses a separate helper, preserve the
relationship, provider, settings, and notification mode; do not create a second
worker after a helper has already started one.

## Execute and verify

Use the harness's supported thread API. For BB, read [references/bb.md](references/bb.md).
Outside BB, verify that the tools support the requested parent relationship,
workspace, execution settings, and notification mode before creating anything.
Do not equate an ephemeral subagent with a durable conversation or a child-only
API with sibling support. If capabilities are missing, report the exact limit
and propose a concrete alternative; do not silently change the relationship.

Verify the created ID, parent (including null), workspace, provider, and
notification mode from the returned state. Check execution settings where the
API exposes them. Report its link, provider, and notification mode only after
verification. Do not change focus without an explicit request.

After an uncertain create result, inspect existing matching conversations before
retrying. For children, inspect the origin's children. For siblings, inspect the
shared parent's conversations in the same project/workspace, including top-level
conversations when the parent is null. Do not create duplicates or claim success
from an ambiguous response. Do not wait or poll unless the user requests results
in the origin.

## Side chats are a separate capability

A side question may need inherited conversation history, while a delegated task
needs a complete work prompt and a clear owner. A fork, child, and sibling are
different relationships. Do not silently substitute one for another.

This skill provides routing behavior, not a question-list UI, hidden forks,
archive/undo controls, or a "Send to main thread" button. Those require a harness
feature or plugin; installing this skill does not install that interface.
