# Scoped evidence for a goals brief

## BB work

For each selected project, list unarchived, nondeleted, nonhidden threads using
`bb thread list --project <id> --json`. Include idle/error work as well as running
work. Reconcile with `bb thread count --project <id> --json` and use supported
pagination where needed. Mark an incomplete inventory rather than claiming full
coverage. Exclude the Goals thread itself from progress evidence.

Read recent requests and completed answers for up to 15 relevant conversations.
Inspect linked children read-only when necessary to substantiate a result, but
respect the selected project scope. Titles/status badges are not proof. Link
`@thread:<id>` or `@thread:<id>#msg=<seq>`. Queued or running work is not done.

## GitLab, when enabled

Use the connected GitLab tools or `glab` with the configured host. Resolve the
authenticated identity using a read-only user query; never reuse another user's
numeric author ID. Limit projects to the configured group/project paths.

Read merged MRs authored by that identity, updated since Monday midnight in the
configured timezone converted to UTC. Filter by actual `merged_at` for weekly
results: later updates to old MRs do not make them this week's merges. Cap lists
at five pages per repository and detailed reads at ten goal-relevant MRs total.
Report truncation. Use older evidence only when needed and date it. Review
linked deployment/outcome evidence before claiming more than a merge.

## Slack, when enabled

Discover available read/search tools and verify the configured workspace before
searching. Use only the selected channels when provided. Resolve the current
user; start with recent authored messages, mentions and short goal-specific
terms. Read original discussions for commitments, deadlines and blockers.
Cap collection at ten search pages and ten relevant threads. Retain only the
private context needed to explain these goals. Report missing access; do not
scrape credentials or substitute stale notes as fresh Slack evidence.

## Product engagement and optional evidence guidance

Use the user's configured guidance to locate authorized read-only sources.
Do not assume a particular product, analytics provider, database schema or
production access command. Follow each source's own documented access procedure.
If required mappings or access are absent, report the gap without expanding
permissions or inventing a query.

Prefer evidence attributable to the real actor and the exact feature/version.
Separate access eligibility, page delivery, substantive actions and repeat use.
Exclude impersonation, agent checks and test traffic when the source permits.
Deduplicate event/request IDs; retries and repeated saves are not independent
visits. Date the observation window and report collection delays. Say “not
observed in this window,” not “did not use it.” Consider whether the person's
next real opportunity to use the feature has occurred. Never generate activity
just to test adoption or change instrumentation during the brief.
