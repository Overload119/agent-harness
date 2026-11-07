---
name: r-plan
description: Turn a request or existing plan into one executable Markdown plan with researched scope, acceptance criteria, implementation units, checkpoints when needed, and verification. Use when the user asks for a plan, says "figure out," asks why something is happening, or wants a bug or task planned. Perform requested investigation as prerequisite work now; write the plan from the resolved findings and make it cover what happens next.
---

# r-plan

Produce one executable plan that also records implementation progress. No separate PRD conversion is needed.

Reduce ambiguity, challenge unnecessary scope, and produce something that is easy to execute.

## Select the workflow

Classify the request before deciding whether to create a plan:

- **Direct planning:** The outcome and relevant context are already established.
- **Investigation then planning:** The request combines investigation with planning. Complete the investigation first, then plan the work implied by its findings.
- **Investigation only:** The user wants findings without a plan or implementation.
- **Autonomous implementation:** The user explicitly says to implement, not stop at a plan, or continue through verification.

The evidence gate applies in every mode. Autonomy changes whether to pause for
plan approval; it never skips prerequisite research.

For autonomous implementation:

- Resolve the minimum useful context, then make the first in-scope edit when no material user decision remains.
- Keep planning state lightweight and continue without offering the plan-only choice menu.
- Stop when research exposes a material product or scope decision that cannot be inferred safely.
- If the user says a `PLAN.md` is only an evidence log, preserve the original prompt and append observed implementation and verification results instead of treating it as an execution gate.
- Re-open persisted Markdown before reporting completion. Confirm it has normal line breaks and that every linked evidence file exists.

## Run the resolver before planning

When the request includes investigation language such as "investigate," "figure
out," "trace," "understand," or "why," run a resolver pass before drafting any
plan. The resolver is present work, not a future plan phase: use the available
tools and evidence to answer the investigation now. Start the plan from those
resolved findings and make it describe the implementation, remediation,
decision, or verification that should happen next.

- Treat factual questions and investigation language as prerequisite research, not as future plan steps.
- Do not stop at naming files, commands, or questions that someone should inspect. Perform the inspection and report what it establishes.
- Inspect the relevant source code, tests, history, documentation, existing plans, and runtime behavior that are safely available. For repo-specific work, first look for nearby `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` guidance.
- Use the project's canonical language and call out any meaningful conflict between the user's wording and the documented terminology.
- Resolve repository-answerable questions directly. Do not ask the user to supply facts that can be discovered from the available context.
- Gather enough evidence to identify the current behavior, likely cause or implementation surface, existing conventions, public interfaces, and test seams.
- Do not write or persist a speculative plan while its central cause, scope, or target is still an investigation task.
- Treat a request as plan-ready only when the root cause or target boundary is established, material decisions are resolved, and a concrete verification seam is known.

A plan action must implement or verify an established change. It must not defer
discovery needed to decide the root cause, target, scope, or product behavior.
Do not include actions such as "investigate the cause," "determine which code is
responsible," or "research the right approach." Creating a failing regression
proof and verifying the completed change remain valid implementation actions.

After resolving context:

- For investigation-only work, report the evidence-backed findings and stop without creating a plan artifact.
- When findings materially define or change a normal planning request, return the findings and a concise plan-ready objective, then ask the user to confirm or revise it before creating or persisting the plan.
- When findings only fill in implementation details and the requested outcome remains unambiguous, continue directly to the plan.
- For autonomous implementation, continue without plan approval when the findings leave no material user decision unresolved.

If required evidence is inaccessible, state what was checked and surface the missing access or decision as a blocker instead of inventing a plan.

## Narrow intent and scope

- Restate the goal in plain language.
- Name the narrowest useful outcome that satisfies the request.
- Classify the scope as small, medium, or large, honoring an explicit user-provided size or making a best judgment otherwise.
- Identify assumptions, constraints, genuine external dependencies, risks, and decisions that materially change the implementation or verification strategy.
- Remove unnecessary work and separate required work from optional enhancements.
- Infer safe defaults from the request and researched repository context.
- Ask a question only when a missing user decision would materially change the outcome and cannot be resolved through research.
- Ask one targeted question at a time and include a recommended default.
- Stop before writing or persisting the plan when the missing decision is blocking. Otherwise, record the recommended default as an explicit assumption.

## Classify dependencies narrowly

Treat the optional `Dependencies` section as a list of exceptional external
preconditions, not everything the implementation or delivery process needs. A
dependency qualifies only when all of these are true:

- The plan does not create or satisfy it as part of its normal execution.
- Another change, owner, or external system must supply it.
- Its absence would block a plan action or materially change scope or sequencing.

Examples include a prerequisite MR or upstream release that must land first, an
access grant controlled by another owner, or an external service or dataset that
is not yet available.

Do not list repository instructions, prescribed generators or test workflows,
implementation steps, generated artifacts, verification setup the executor can
create, or routine commit/push/MR mechanics. Put rules in `Assumptions and
constraints`, executable work in `Implementation Units`, and test environments, fixtures, or
automated scenarios in the final verification unit. Authentication is a
dependency only when access is actually unavailable and requires external
resolution, not merely because a delivery command will eventually require it.

Express dependencies between the plan's own actions through their ordering in
`Implementation Units`, not by repeating them in `Dependencies`. If no qualifying external
dependency exists, omit the section entirely; never add `None` or filler. Resolve
a blocking unknown or product decision before finalizing the plan instead of
relabeling it as a dependency.

## Draft the plan

- Make the plan specific, dependency-aware, minimal but complete, and easy to verify.
- Put implementation units in dependency order with stable task IDs.
- For a bug or regression, include the fastest repeatable command, browser flow, fixture, or script that should fail before the fix and pass after it. State whether that proof loop exists or must be created and what exact symptom it proves.
- Prefer the smallest plan that satisfies the goal.
- Match plan depth to scope: keep small plans lean, cover key execution details for medium plans, and include research-backed architecture and risk reduction for large plans.
- Treat repository instructions, `AGENTS.md`, language guidance, style guides, and codebase principles as internal planning inputs rather than user-facing work. Use them to choose the right files, boundaries, sequencing, and verification, but do not add steps whose only purpose is to read or follow those instructions.
- Make genuine external dependencies, real blockers, and missing information explicit.
- Include concrete verification and a clear definition of done.
- Prefer behavior-first verification through a public interface or seam.
- Avoid vague work such as "test it" or "clean things up."
- Keep architectural suggestions grounded in leverage and locality rather than aesthetic refactoring.
- Use the smallest set of implementation units that makes the work executable. Keep independent slices explicit without requiring parallel execution.

## Execution contract

A completed plan must be ready to execute without discovering core requirements
later. Separate desired behavior and scope from the current file map. Resolve
material product decisions before finalizing; record non-blocking risks and safe
assumptions explicitly. Reading local instructions is a planning input, not an
implementation unit.

- Use one unit per meaningful behavior change, with stable `AH-###` IDs, files,
  concrete acceptance criteria, verification, status, and evidence notes.
- End with an automated verification unit. Name repeatable checks and expected
  results; do not substitute a request for the user to test the work.
- For requested stacks or branch boundaries, read [references/checkpoints.md](references/checkpoints.md).
- Preserve completed unit IDs, status, and evidence when revising an existing
  plan. Reopen units whose requirements changed and affected downstream checks.
- The plan defines what and why; fresh source inspection determines how.
  Update the file map when implementation changes, without silently widening scope.

## Visuals

Include Mermaid diagrams only when they clarify behavior, architecture, or
sequencing. There is no required diagram count. For UI changes, include a target
sketch when layout, hierarchy, responsive behavior, or interaction states would
otherwise remain ambiguous. Read [references/ui-visual-contract.md](references/ui-visual-contract.md)
when a sketch is useful. Skip it for an obvious copy-only or isolated token change.

## Format and persistence

Before writing a completed plan, read [references/format.md](references/format.md).
Keep one authoritative working document under `.agent-harness/` in the active
checkout. Do not create a separate PRD or mirrored working copy.

Honor an explicit destination, but do not create extra copies or write to an
external notes service merely because it supplied context.
