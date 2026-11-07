## Communication and working files

- Use `plain-communication` for user-facing explanations, questions, updates,
  and reviews. Preserve exact identifiers, negations, conditions, and uncertainty.
- Before sending a message with two or more prose paragraphs, use `adhd` to
  append one shorter plain-language version under `**tl;dr**`. Keep the full
  message. Count paragraphs before the summary; headings, lists, tables,
  quotes, and code blocks do not count. Do not reformat to evade the threshold.
  A direct `/adhd` request returns only the rewrite. Respect explicit requests
  for no summary and exact output formats that cannot include one.
- Use `working-artifacts` when saving working plans, reviews, handoffs, sketches,
  or verification evidence. This does not require creating artifacts for every task.

## Request modifiers

- For a standalone `--restate` among the trailing flags, load `restate` before
  acting. Give the understanding check and stop unless explicitly told to
  restate and continue. Other flags do not override this stop.
- For a standalone `--unsure` among the trailing flags, load `unsure`. Examine
  the direction before making a consequential change. When delegation is also
  requested, forward this constraint so the worker owns the direction check.
- For `--child [codex|claude] [auto|stuck|off]` or
  `--sibling [codex|claude] [auto|stuck|off]` among the trailing flags, load
  `thread-routing`. Both selectors are optional. Capture the origin, preserve
  the requested relationship, and verify the handoff. Do not duplicate the
  delegated work or wait unless the user asks for results here.
- For a standalone `--notify` among the trailing flags, load `completion-focus`
  at the start to capture the origin, then focus it immediately before the
  final response. For delegation, handle it here and remove it from the prompt.
- Quoted flags, code examples, and requests to document or change these
  conventions do not activate them. The exact supported routing flags are
  `--child` and `--sibling`; do not treat an unknown flag as permission to spawn.

## Browser preference

Use ordinary research and browser tools by default. Provide useful URLs as
labeled Markdown links. Do not open an embedded harness browser unless the user
requests it. In BB, use `bb browser` only when explicitly requested.

## BB title icons

Only in BB, read the originating thread's title using `BB_THREAD_ID` (or
`bb status --json`) and prefix it with one category icon: 🐛 for bug fixes,
🛠️ for cleanup/refactoring/performance, or ✨ for new features. Preserve its
text, respect explicit user choices, and leave other tasks unclassified.
Use `bb thread update` without changing focus or announcing the icon update.
