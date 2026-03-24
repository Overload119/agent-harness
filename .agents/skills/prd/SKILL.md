---
name: ah-prd
description: Convert an expanded plan into a deterministic PRD-style JSON artifact for one-agent-per-task execution. Use when the user has a plan that should be normalized into ordered, testable tasks for agent execution.
---

Turn an expanded plan into an executable PRD-style task spec for a subagent loop.

Your job is to take a concrete plan and convert it into a deterministic JSON artifact that can be operated on by one-agent-per-task execution.

Behavior:

1. First determine the input source:
   - a plan pasted directly in the prompt
   - a file containing a plan
   - an existing PRD JSON that needs normalization or improvement
2. Identify the project from the plan:
   - extract the project or feature name
   - derive a short kebab-case branch name
   - summarize the feature in one sentence
3. Normalize the work into task units:
   - each task should be executable by one agent
   - each task should have a clear title and description
   - each task should include concrete acceptance criteria
   - mark whether the task can run in parallel
   - keep dependencies implicit through ordering unless the plan clearly requires otherwise
4. Create `./.agent-harness/prds` if it does not exist.
5. Produce a JSON artifact that is stable and easy to diff.
6. Do not ask repeated questions by default.
   - Infer what you can from the plan and repository context.
   - Only ask a question if a missing decision would materially change task breakdown or ordering.
   - If you ask, ask exactly one targeted question and include a recommended default.

PRD rules:

- Prefer the smallest set of tasks that still makes the work executable.
- Use one task per meaningful unit of implementation or verification.
- Keep task descriptions outcome-focused, not vague activity lists.
- Acceptance criteria must be concrete and testable.
- Include repo-level verification where appropriate, such as tests, typecheck, build, or manual checks.
- Mark `parallel` as `true` only when the task can be done independently without blocking downstream work.
- Default `passes` to `false` until the task has been completed and verified.
- Use empty strings for optional freeform fields like `notes` when there is nothing to add.
- Do not invent deploy steps, credentials, or environment-specific behavior that is not present in the input.

Output format:

- Write JSON to `./.agent-harness/prds/<feature-name-kebab-case>.json`
- Return the JSON in the response as well

Use this schema:

```json
{
  "project": "[Project Name]",
  "branchName": "ralph/[feature-name-kebab-case]",
  "description": "[Feature description from the plan objective]",
  "tasks": [
    {
      "id": "US-001",
      "title": "[Story title]",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Criterion 1",
        "Criterion 2",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": "",
      "parallel": false
    }
  ]
}
```

Task construction guidance:

- Use sequential IDs like `US-001`, `US-002`, `US-003`.
- Set `priority` to execution order, where `1` is the first task to run.
- If the plan includes required verification work, represent it in acceptance criteria or as a dedicated task when substantial.
- If the input is already well structured, preserve the user's intent and only normalize wording and shape.
- If the input is under-specified, produce the most reasonable minimal executable breakdown rather than expanding scope.

If the input is a file, read the file and convert it into this JSON format.

If the input is already JSON, validate it against the schema above, fix obvious structural issues, and return the normalized result.
