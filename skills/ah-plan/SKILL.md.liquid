---
name: ah-plan
description: Turn a short task, TODO, rough request, or draft plan into a concrete execution plan with assumptions, dependencies, risks, and verification steps. Use when the user mentions "plan", "figure out", asks "why" something is happening, or has any bug, issue, or task that would benefit from a structured approach with clear steps and verification.
---

Turn a short task, TODO, rough request, or draft plan into a concrete execution plan.

Your job is to reduce ambiguity, challenge unnecessary scope, and produce something that is easy to execute.

Behavior:

1. First determine what the input is:
   - a short TODO that needs expansion
   - an existing plan that needs improvement
   - a file containing a prompt, TODO, or draft plan

2. Before expanding, do a quick scope check:
   - restate the goal in plain language
   - identify assumptions and constraints
   - remove unnecessary work
   - note what is missing

3. Pre-flight code exploration:
   - Launch a general-purpose explore agent to quickly identify relevant code paths, files, and patterns that may be touched by this task
   - The agent should search for relevant files, understand the architecture, and report back key findings
   - This happens BEFORE constraint discovery and before presenting the plan
   - Pass the user's original request as context so the agent knows what to explore

4. Constraint Discovery phase:
   - If the goal, assumptions, or implementation details are unclear, enter the constraint discovery phase
   - Ask probing questions to clarify constraints, edge cases, dependencies, and anything that would materially affect the plan
   - Number questions #q1, #q2, etc. up to a maximum of 10 questions
   - Stop asking when the task is completely clear and can be implemented correctly
   - Present questions in a format that allows the user to respond with #q1, #q2, etc.

5. Do not ask repeated questions by default.
   - Infer what you can from the user's message and repository context.
   - Only ask a question if a missing decision would materially change the plan.
   - If you ask, ask exactly one targeted question and include a recommended default.

6. Produce a plan that is:
   - specific
   - dependency-aware
   - minimal but complete
   - easy to verify

Planning rules:

- Prefer the smallest plan that satisfies the goal.
- Separate required work from optional enhancements.
- Make dependencies explicit.
- Call out tasks that can happen in parallel.
- Include risks, blockers, and missing information.
- Include concrete verification steps and a clear definition of done.
- Do not leave vague steps like "test it" or "clean things up".

Output format uses shorthand headers for easy reference. Sections are prefixed with #o (Objective), #a (Assumptions), #d (Dependencies), #p (Plan), #l (Parallel), #r (Risks), #v (Verification). Items within sections are numbered for shorthand reference (e.g., #a1, #a2, #p1, #r1).

If the input is a file, rewrite the file in this format:

```md
Original Prompt

<original>

Expanded Plan

#o Objective
<objective>

#a Assumptions / Constraints
<numbered assumptions and constraints>

#d Dependencies
<numbered dependencies>

#p Plan
<numbered ordered execution steps>

#l Parallelizable work
<numbered work that can happen at the same time>

#r Risks / Open questions
<numbered risks, blockers, unknowns>

#v Verification / Definition of done
<numbered concrete checks>
```

If the input is not a file, return the same structure directly in the response.

## Persisting the Plan

After producing the plan, write it to `.agent-harness/plans/<feature-name-kebab-case>.md`:

1. Create `.agent-harness/plans/` if it does not exist.
2. Derive the filename from the objective — use kebab-case, e.g. "add dark mode toggle" → `add-dark-mode-toggle.md`.
3. Write the full plan to that file, preserving the `#o #a #d #p #l #r #v` markdown structure.
4. Return the file path in your response so the user knows where the plan is stored.
5. When presenting next-step options, "implement the plan" means the plan is already persisted and can be referenced by path.

Example interaction:

```
User: I want to add dark mode to the settings page.

Assistant: #o Objective
<1. Add dark mode toggle to the settings page>

#a Assumptions / Constraints
<#a1 User is using the existing settings infrastructure
#a2 Theme system uses CSS variables>

#d Dependencies
<#d1 Settings component already exists>

#p Plan
<#p1 Add theme context provider
#p2 Create DarkModeToggle component
#p3 Wire toggle into settings page>

#l Parallelizable work
<#l1 Design dark mode tokens while #p1 is implemented>

#r Risks / Open questions
<#r1 Could conflict with existing theme picker?>

#v Verification / Definition of done
<#v1 Dark mode persists across page reloads
#v2 Toggle switches theme immediately>

User: #r1 - yes there's a theme picker, I want to replace it.
#a1 - actually settings infrastructure is being rewritten next month.
#a2 - correct, we use CSS variables.

Assistant: #o Objective
<1. Add dark mode toggle to the settings page, replacing existing theme picker>

#a Assumptions / Constraints
<#a1 Settings infrastructure is being rewritten next month - do minimal changes
#a2 Theme system uses CSS variables
#a3 Existing theme picker will be removed and replaced>

...
```

Users can respond with shorthand codes (#q1, #r2, #a3, etc.) to quickly clarify specific items. The executor will incorporate the clarification into an updated plan.

Always end the response by asking what the user wants to do next, and present numbered options. Include these choices at a minimum:

1. Create a PRD from this plan
2. Make changes to this plan
3. Improve this plan

Always include the plan file path in your response, e.g. "Plan saved to `.agent-harness/plans/add-dark-mode-toggle.md`."

You can also respond with shorthand codes to clarify items:
- Use #q1, #q2, etc. to answer constraint discovery questions
- Use #a1, #a2, etc. to clarify assumptions
- Use #r1, #r2, etc. to clarify risks
- Use #p1, #p2, etc. to clarify plan steps
