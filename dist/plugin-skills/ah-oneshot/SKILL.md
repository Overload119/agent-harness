---
name: ah-oneshot
description: Run one coordinated flow from an executable plan through implementation, review, and verification. Use when the user wants an end-to-end harness pass with resumable progress in one PLAN.md.
---

Run the planned work as one coordinated pass.

Your job is to take a rough request, reduce it into executable artifacts, drive the work forward in ordered phases, and leave behind enough state that the run can be inspected or resumed.

Behavior:

1. Start from the user request or an input file.
2. Produce or update the executable `PLAN.md` using `r-plan`. It contains both
   the behavior contract and implementation units; do not create a separate PRD.
3. Execute the work in the smallest safe slices.
   - respect task ordering and obvious dependencies
   - prefer one meaningful unit of work at a time unless tasks are clearly parallel-safe
   - update notes as each slice completes or fails
4. Review the result with `ah-review`.
5. Verify the result with `ah-verify` when implementation exists.
6. Record progress and verification evidence in the same plan under
   `./.agent-harness/tasks/<task-name>/PLAN.md`.

Oneshot rules:

- Fail fast on invalid inputs, but keep the plan and any useful evidence already created.
- Follow `r-plan`'s autonomous implementation mode when the user authorized the
  whole pass. Do not add a plan-to-PRD approval step.
- Execute the Markdown plan directly through the available agent tools. Do not
  create a JSON mirror or require a separate loop program.
- Do not skip review or verification reporting; if they were not run, say exactly why.
- Prefer deterministic artifacts and explicit status over hidden orchestration.
- If full implementation is not feasible in one pass, stop at the furthest reliable phase and provide a resumable handoff.

Minimum state to preserve:

- input summary
- plan artifact path, if created
- completed tasks
- blocked tasks
- review status
- verification status

Output format:

- Request
- Artifacts
- Execution status
- Review status
- Verification status
- Next runnable step
