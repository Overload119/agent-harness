---
name: completion-focus
description: Return focus to the originating conversation when a request ends with a standalone --notify flag or explicitly asks to return there after completion. Capture the origin before work starts. Quoted flags and requests to document the convention do not activate it. Requires a harness with stable conversation IDs and a focus/open action.
---

# Completion focus

Treat `--notify` among the trailing flags as a request to return to the originating
conversation after the work. Normal end-of-turn notifications remain the harness's
responsibility; do not send another message or create a notification task.

1. At the start, capture the stable originating conversation ID from the execution
   context. Never infer it later from the focused UI. In BB, use `BB_THREAD_ID`,
   falling back to `bb status --json` if missing.
2. Complete the authorized work. For a delegated request, completion here means
   the verified handoff unless the user explicitly asked to wait for its result.
   Handle focus in the origin and strip `--notify` from the forwarded prompt.
3. Immediately before the final response, use the harness's supported open/focus
   action on the captured ID. In BB, run `bb thread open <captured-id>`.
4. Send the final response so the harness handles normal completion notification.

If the origin cannot be resolved, the harness lacks a focus action, or opening
fails, continue the requested work and report the focus limitation briefly.
Do not claim an exact OS window or browser tab was restored. Never focus another
conversation just because it is currently selected. No separate capture file,
completion command, or new thread is needed.

Only return focus when the user requests it. Quoted examples, code, and requests
to document this convention are not activation. With `--restate`, the work is
the understanding check unless the user explicitly says to continue.
