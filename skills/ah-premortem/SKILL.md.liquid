---
name: premortem
description: Write a premortem for a pull request, merge request, branch, production script, feature launch, or plan. Assume it shipped and failed, find the failures this change introduces, verify the top ones, and give each a detection signal that runs today, a recovery step, and a code-change decision. Give one consistent verdict. Use for "premortem", "pre-mortem", "what could go wrong if we ship this", or a request for a launch monitoring plan.
---

# Premortem

A premortem serves one decision: ship as is, ship with a named change, or hold.
Assume the change shipped and failed, then explain why. Use the failure assumption to look for specific causes, then test them.

Keep the review short, evidence-based, and focused on risks introduced or
worsened by this change. Avoid padding and unverified claims. Every failure must answer three questions: how we
know it is happening, how we recover, and whether to send more code.

## Scope

- Identify the subject and the decision it serves. For a pull or merge request, use the
  repository's available GitHub/GitLab integration to read its diff, description,
  discussions, CI results, and linked conversations. For a local branch, use
  local Git evidence. Missing remote access is a stated limit, not permission
  to invent review or CI results. For a script or plan, read the script or
  plan and the code it calls.
- The premortem is read-only. Do not change the merge request, push code,
  post comments, or mutate production. Reproductions run on a devbox, a local
  checkout, or with read-only production queries. A request for a premortem
  does not authorize fixes; recommend changes without applying them.
- Read the review history first. Mark a failure that review already fixed as
  fixed; do not raise it again as new.

## Find failures

1. Read the changed code and the code it calls. Trace the paths the change
   adds or alters: inputs, error handling, caches, jobs, external API calls,
   flags, migrations, permissions, and deploy order.
2. Write candidate failures as mechanisms, not categories. "The service might be
   slow" is a category. "Six expired cache entries make six concurrent requests
   from `app/services/catalog_client.rb:147`" is a mechanism. These names and
   numbers are illustrative; use verified values for the actual review.
   Each mechanism names verified `file:line` locations and trigger conditions.
   If only prose or pseudocode was supplied, quote that evidence and state that
   source locations are unavailable. A synthetic model cannot prove omitted
   implementation details. Never invent paths, measurements, or controls.
3. Keep only failures this change introduces or makes worse. A failure that
   existed before goes under "Checked and ruled out" with one line saying it
   is pre-existing, unless this change measurably raises its likelihood.
4. Look up real limits (API quotas, timeouts, queue settings, rate limits,
   request limits) in the code, config, or vendor documentation. Do not guess
   a limit that can be checked.

## Verify

- Reproduce the top two candidates where possible: on a devbox, in a local
  test, or with a read-only production query. Report what was measured, with
  numbers and units.
- Remove or correct any candidate that a measurement disproves. A claim that
  could not be tested stays only if it is labeled with what was not tested
  and why.
- Check every detection signal before listing it. Run a safe, authorized query or command
  and confirm that it works today. Do not contact production without existing
  authorization; mark unavailable signals as unverified. "Monitor error rates" is not a
  signal.
- Check every recovery lever in the code: whether the feature flag actually
  gates the new path, and what a revert leaves behind (database rows, cache
  keys, queued jobs, sent messages). If source or access is unavailable, label
  recovery steps as proposals and state what could not be verified.
- Keep the reproduction scripts, raw output, and notes under
  `.agent-harness/` in the active checkout. Remove temporary application test files before finishing, while retaining
  deliberate evidence under `.agent-harness/`.

## Each failure

Rank failures by likelihood times damage. Report at most 7, including zero when none survive. Do not pad the list;
say how many candidates were tested and how many survived.

For each failure:

- **Scores:** severity, likelihood, and difficulty of detection, each 1 to 5.
- **Mechanism:** verified lines (or the supplied prose) and trigger conditions.
- **Measured** or **Evidence:** what the verification showed. Say plainly when
  a part is traced in code but not reproduced.
- **How we know it is happening:** the exact query, log line, metric, or
  command that runs today. If no signal exists, say so. A missing signal is
  itself a finding, and usually a reason to send a small code change (a log
  line or counter).
- **Recovery:** the exact step: flag off, revert, re-run a job, a data fix, or
  "none needed." State what the step leaves behind.
- **Code change:** send now, follow up only if the signal fires, or none.
  Give the reason and a rough size.
- **Limit:** anything not checked that could change the entry.

## Output

Lead with the verdict and its one-sentence reason. Then use these sections,
omitting empty ones:

1. **Fix before merge:** failures whose code change should ship now.
2. **Accept and watch:** failures to monitor, with the trigger that would
   start a follow-up.
3. **Expect at deploy:** harmless transitional effects, such as open pages
   showing old content until reload.
4. **Checked and ruled out:** one line each, including pre-existing failures
   and fixed review issues.
5. **Not checked:** open questions that could change the verdict.
6. **One command to watch it:** only when a deploy signal was verified, give
   its exact command with window and cost limits. Otherwise state that no
   production watch command was verified; never invent one.

Use one consistent verdict: ship as is, ship with a named change, or hold. Keep the
whole premortem short enough to read in a few minutes; detail belongs in the
`.agent-harness/` notes. When the user has not already declined fixes, offer to add the "fix before
merge" changes. Do not make them unless the user asks.
