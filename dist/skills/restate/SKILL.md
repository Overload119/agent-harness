---
name: restate
description: Concisely explain the user's intended task when their message ends with the standalone suffix --restate. Use limited read-only research when needed to understand the request.
---

# Restate

Explain what you think the user wants before doing the requested work.

Treat --restate as active when it appears among the standalone flags
at the end of the message. Quoted text and code examples do not trigger it.

Use the message and relevant conversation context first. If a reference
or factual uncertainty would materially change your interpretation,
make a few focused read-only queries or tool calls. Stop once you can
describe the task. Do not turn this into a full investigation.

State the intended outcome, scope, and important constraints in your
own words. Distinguish the user's goal from any proposed method.
Do not add requirements or present assumptions as verified facts.

Default to one short paragraph of two to four sentences, beginning
“You want me to…”. Include an assumption only when it changes the task.
If a material ambiguity remains, ask one focused question after giving
your best interpretation.

End after the restatement. Do not implement, change external state,
launch another agent, or start a planning workflow unless the user
explicitly asks you to restate and then continue. Other trailing flags
do not override this stop; apply only their compatible behavior.

Keep the stop implicit. Do not append a sentence explaining that the agent is
stopping, waiting, or following `--restate`; end with the task restatement
(or the one necessary clarification). The user already knows the suffix.
