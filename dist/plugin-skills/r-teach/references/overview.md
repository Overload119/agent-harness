# The overview page

Start with a visual overview before asking questions. The user should see the
parts, their relationships, and one case moving through them. Size the overview
to the subject and keep the read under ten minutes. Deliver it before finishing
all answer keys; do not make the user wait for the whole evaluation setup.

## Build from evidence

Load `explain-inline` and use its embedded components and extraction recipe.
Write the JSON and HTML in the session directory. Do not call an external
generation service. If explain-inline is unavailable, use
self-contained HTML or a Markdown overview with exact source excerpts. Say which
visual capability is unavailable without blocking the teaching session.

Use this order, omitting parts that add no understanding:

1. The model in two to four sentences and the concrete understanding task.
2. A CodeMap, Lifecycle, or Pele-powered Mermaid diagram of the key parts.
3. One real case from start to end, using a Lifecycle or CodeTour.
4. What changed, where the failure happens, or which rules govern the behavior.
   When exact changes matter, show them in a `diff` fenced block in chat or
   point to the host's own diff view; explain-inline has no Diff component.
5. A short glossary for unfamiliar terms.

Cite inspected paths and commits beside claims; preserve source excerpts exactly.
The overview teaches each subskill, but uses different cases from the questions.
Do not hide essential facts to make a test harder. Do not include a quiz, hidden
answer, or an answer form. The questions and answers belong in chat.

## Verify and show

Verify the rendered page and interactions before sharing it. Give the user a
link to the local HTML so it can stay open beside the questions. In BB, prefer
thread-storage previews when a remote file cannot be opened locally. Use the
host's inline-vis instructions and split large overviews into smaller pages if
needed. On another host, use its supported local artifact viewer or a Markdown
fallback. Never claim the browser opened unless an open action succeeded.

Do not upload or publish the page without an explicit request. Missing local
preview support is not permission to use an external publishing service.
After giving the overview, wait for `ready` before the placement questions.
