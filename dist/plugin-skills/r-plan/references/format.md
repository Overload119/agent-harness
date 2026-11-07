# Executable plan format

## Persistence

- Default to `.agent-harness/tasks/<task-name>/PLAN.md` in the active checkout.
- Reuse an existing working plan rather than creating a second source of truth.
  Preserve the original prompt, material follow-ups, stable unit IDs, and evidence.
- When input is outside the checkout, treat it as source context
  and write the working plan locally unless the user explicitly asks to edit it.
- Put supporting assets and verification evidence beside the plan in `assets/`
  and `verification/` only when needed. Use relative links.
- Do not write extra copies, JSON mirrors, or separate PRDs by default. If an
  export is explicitly requested, identify it as a snapshot; the working plan
  remains authoritative unless the user chooses another working destination.
- Investigation-only discussions need no saved plan. An explicitly requested
  evidence log preserves the prompt and appends observed results; it does not
  need to be converted into an execution contract.

## Document shape

Use the following structure for a completed executable plan. Keep small tasks
short; omit empty optional sections and unnecessary snippets. Do not omit the
behavior contract, implementation units, or final verification unit.

```markdown
---
status: active
---

# Task title

## Original request

Original prompt and material follow-ups.

## Summary

Objective and scope size.

## Findings

Resolved facts and relevant source references.

## Durable Contract

### Desired Behavior

Observable target behavior.

### Scope Boundaries

Included work and relevant exclusions.

### Assumptions and Constraints

Researched constraints and safe assumptions.

### Acceptance Criteria

- [ ] Observable success condition.

### Testing Intent

Proof strategy, including a repeatable regression proof for bug fixes.

## Execution Trajectory

Implementation approach and file touch map, using repo-relative paths.
Include short code context only when an interface or invariant requires it.

## Implementation Units

### AH-001 Implement the behavior

Status: pending
Depends on: none

Concrete behavior change.

Files:
- Update: `path/to/file`

Acceptance Criteria:
- [ ] Testable outcome.

Verification:
- [ ] Exact command or repeatable automated scenario and expected outcome.

Notes:

### AH-999 Automated Verification

Status: pending
Depends on: AH-001

Acceptance Criteria:
- [ ] The implemented behavior satisfies the plan's acceptance criteria.

Verification:
- [ ] Concrete final checks and expected outcomes.

Notes:
```

Add `Dependencies` only for an external prerequisite that execution cannot
satisfy. Add non-blocking `Risks` when useful. Material unanswered questions
prevent finalization; do not hide them in these sections. Add `Key Interfaces`,
`UI Contract`, or visuals only when useful. Stack plans include `Checkpoints`
before implementation units, following `checkpoints.md`.

## Execution and resume

Write acceptance criteria as observable behavior or a concrete verification result.
For example, in an application that manages purchase orders:

- `app/controllers/orders_controller.rb` sends the approval email only when
  the notification feature flag is enabled.
- `bundle exec rspec spec/services/orders/approval_mailer_spec.rb` passes,
  with the result recorded in the verification unit notes.
- The order details page shows the approved status after a successful response
  and preserves the existing error message when the request fails.
- A screenshot of the approved order is saved to
  `.agent-harness/tasks/order-approval/verification/approved-order.png`.

Use `pending`, `in-progress`, `passed`, or `blocked` for unit status. Update notes
with exact checks, outcomes, and evidence paths before advancing. Never infer
completion from a filename or stale status alone. A changed requirement or
implementation invalidates affected downstream proof. Mark the document
`completed` only after required implementation, verification, and review pass.

## Handoff

Summarize the intended change and key decisions, then give the working plan path.
Use a local file link when supported; do not manufacture a host link for a
remote-only file. Do not duplicate the whole plan in chat unless requested.
For planning-only requests, offer execution or revision. For already-authorized
implementation, continue without asking for plan approval again.
