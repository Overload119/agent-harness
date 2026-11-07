---
name: working-artifacts
description: Choose where to save agent plans, reviews, handoffs, sketches, and verification evidence when the user requests an artifact or project instructions enable this convention. Keep working documents in the active project and respect explicit destinations. Does not trigger creation of unsolicited artifacts.
---

# Working artifacts

Keep useful working state close to the project it describes. This skill chooses
storage for already-requested or necessary work; it does not create a planning
or documentation requirement for every task.

- Honor an explicit destination first, then the active project's documented
  convention. Otherwise store working plans, reviews, sketches, handoffs, and
  verification evidence under `.agent-harness/` in the active checkout.
- Unless an explicit destination or project convention overrides it, use one authoritative
  `.agent-harness/tasks/<task-name>/PLAN.md`. Keep its progress and evidence
  current. Reuse an existing plan; do not add a separate PRD or mirror merely
  to satisfy a second workflow. Follow the project's plan format if one exists.
- Put supporting assets and evidence beside the plan when useful. Use short,
  sanitized names and relative links inside the artifact. Do not include secrets
  or unnecessary personal data in filenames, text, screenshots, or logs.
- A request for a plan, document, diagram, file link, or durable artifact does
  not authorize a write to an external notes service. Reading
  that context does not authorize writing there. Use those destinations only
  when requested, and label any requested export as a snapshot when appropriate.
- If no writable project exists, keep a short artifact in chat or ask for a
  destination when a file is required. Do not silently switch to an external service.
- Before reporting completion, reopen written Markdown, check its line breaks,
  and verify that referenced evidence files exist. Do not claim tests passed
  because an old plan says so.
- Link useful files and exact verified preview/test URLs in chat using the
  harness's supported link format. Label routes inferred from code separately
  from pages actually checked. Keep secrets out of URLs and avoid links inside
  code spans, where they may not be clickable.

Do not commit, publish, or share artifacts merely because they were written.
Preserve the user's requested scope and the workspace's existing permissions.
