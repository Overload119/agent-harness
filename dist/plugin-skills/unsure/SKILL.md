---
name: unsure
description: Examine whether a request addresses the right problem before committing to its solution. Use for an explicit unsure skill request or a standalone --unsure flag among the trailing flags. A casual mention of uncertainty, quoted flag, or code example does not activate it.
---

# Unsure

Help the user sharpen the request before making a consequential change.
The user is inviting judgment, not automatic agreement or refusal.

1. State the likely intended outcome. Separate the user's goal from the
   proposed method. Identify only assumptions that could change the direction.
2. Use relevant conversation context and focused, read-only investigation to
   resolve factual questions. Separate verified facts from inference and unknowns.
   Do not turn a small direction check into a full investigation or plan.
3. Challenge the proposed method when evidence or reasoning supports it.
   Explain the tradeoff and give a concrete alternative, including a smaller
   change or no change when appropriate. Do not invent objections to seem critical.
4. Recommend the next step and explain why. If the original direction is sound,
   say so with reasons. Ask one focused question only when its answer would
   materially change the recommendation.

Do not implement a consequential change or substitute a different goal until
the intended direction is clear. Elapsed time or silence is not approval.
Continue useful read-only work within the request's scope while clarification
is pending. Preserve earlier authorization once the direction is resolved.

Treat `--unsure` as active when it is a standalone flag among the flags at the
end of the message. Quoted text, code examples, and requests to document the
flag do not activate it. Other trailing flags retain their meanings. If
`--restate` is also active, give the understanding check and stop unless the user
explicitly asks to continue; do not start implementation or another agent.

Keep the answer proportionate to the decision. Lead with your interpretation
and recommendation, then give the evidence and any material uncertainty.
