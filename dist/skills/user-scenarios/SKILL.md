---
name: user-scenarios
description: Explain software behavior through concise, evidence-backed user or operator scenarios. Use when asked how to reproduce an issue, what actions cause it, whether a failure can happen in normal use, how likely a reported or proposed failure is, or for concrete examples or reference scenarios that explain a pull request or merge request or proposed change. Also use for an explicit user-scenarios request. Do not trigger for fictional scenarios, generic user personas, or conceptual explanations without a reproduction or practical-risk question.
---

# User scenarios

Give the real user workflow in the first answer. Do not make the user ask again
for plain English, actual URLs, exact buttons, or the conditions that make the
scenario possible. Research enough to be concrete; keep the answer short.

## Establish the workflow

- Start from the person's task and role: what they are trying to do, where they
  start, and what they observe. Trace the actual current implementation through
  the entry point, controls, save action, and any later automatic action.
- Inspect relevant routes, interface labels, permissions, settings, callers,
  and regression tests. Use existing evidence before requesting more context.
  A backend method or test fixture alone does not establish a reachable user
  workflow. Check that the interface and permissions allow the described steps.
- Include only prerequisites that change the outcome: an enabled setting,
  specific role, existing data state, unfinished background work, or a required
  order of actions. State these before the steps. Do not bury a narrow timing
  requirement inside a claim that an ordinary edit causes the failure.
- For a web interface, give a verified starting URL and the exact visible
  button, menu, tab, field, and confirmation labels needed to reach the outcome.
  Include the destination URL when navigation matters. A route checked in
  source is not a page verified in a browser or proof of deployment.
- Use a real record URL only when available and appropriate to disclose.
  Otherwise link the verified list or entry page and clearly label the record
  URL pattern. Never invent a working record ID, hostname, or button label.
- For command-line or automatic workflows, use the actual command, trigger,
  or operator action instead of inventing a screen. Separate what the person
  does from what runs automatically. Distinguish manual approval from automatic
  action when that changes the result.

## Establish what the evidence supports

- Distinguish an observed incident, an executed reproduction, a sequence
  supported by current code, and a possibility that remains unverified. Do not
  turn a plausible example into a claim that it happened to a real person.
- Explain the human-visible consequence, then the mechanism in one plain
  sentence. Avoid replacing the workflow with jargon such as stale state or
  race condition. For concurrent work, show the relevant order of actions.
- When assessing likelihood, separate reachability from frequency. Tests can
  prove behavior under stated conditions; they do not show how often people
  encounter those conditions. Use logs, counts, or other available evidence for
  frequency claims. Without those, state the required circumstances and that
  frequency is unknown. Do not manufacture percentages or call it common/rare.
- A controlled reproduction that pauses background work can establish a bug,
  but does not establish ordinary-user frequency. Identify any such test-only
  setup separately from the natural workflow.
- If a guard blocks the proposed sequence, say so. Do not force a scary example
  or quietly change assumptions to make it work. For proposed removals or fixes,
  distinguish current behavior from behavior under the proposed change.
- Link the few sources that substantiate the controls and decisive behavior.
  Prefer direct source lines, relevant tests, or retained execution evidence.
  Do not expose private content to make an example feel real.

## Compare changes in context

When a pull request, merge request, branch, fix, or proposed change is the
subject, interpret a request for an example or reference scenario in that context. Prefer a before/after
flow so the reader can see what the change means for the person using the system.

- Inspect both the relevant base and changed implementation, plus the diff and
  tests. Identify which revisions you compared. Do not infer the old behavior
  solely from the new code, change description, or a test's title.
- Use the same person, task, inputs, and prerequisites on both sides where they
  still apply. Show the common steps once, then **Before this change** and
  **After this change** at the point where behavior differs. If the interface
  or required steps change, give the actual route and controls for each version.
- Explain what the person sees, can do, or no longer needs to do. A feature need
  not be framed as a bug; a behavior-preserving change may have no visible
  difference. Say so instead of inventing one.
- Keep the comparison aligned with the question. Removing a safeguard from a
  change is a different comparison from the change against its base. Label the versions
  explicitly, and do not describe unmerged or undeployed behavior as live.
- Link evidence for both sides. If one side cannot be inspected or reproduced,
  state that limit rather than presenting an inferred difference as verified.

## Write the answer

Choose as many scenarios as needed to explain materially different user paths,
conditions, or outcomes. One may be enough; multiple scenarios are appropriate
when they help answer the question. Do not force a single example or pad the
answer with variations that demonstrate the same thing.

Keep each scenario concise. Aim for roughly 120–220 words overall for a simple
answer; expand when several distinct scenarios or before/after steps require
it. Share common setup and use a small comparison table when that avoids
repetition. Preserve the evidence and decisive conditions rather than meeting
a rigid word or scenario count.

1. Lead with the concrete action and consequence, or state that the proposed
   failure is blocked or not yet established.
2. State the decisive prerequisites in a short sentence.
3. Give a short numbered sequence: where to go, what to click or run, and what
   happens. Preserve exact labels and useful links. Include the automatic step.
4. Show the outcome. In change-related questions, include the before/after
   difference by default; for likelihood questions, assess the evidence for
   occurrence. Add a short evidence limitation if needed.

Do not append a technical essay, generic warnings, or an offer to investigate
the actual interface later. Ask a focused question only if missing information
materially prevents an accurate scenario; continue independent investigation.

Explaining a reproduction does not authorize executing its production actions,
changing code, or sharing data. Preserve the task's existing scope and authority;
when execution is authorized, use an appropriate test environment and report
what was actually reproduced.
