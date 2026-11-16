# Held-out check, check mode, and re-test

The check shows whether the session worked without relying on the tutor's or
the user's opinion. Its questions come from an author that never saw the
session, and its answers are settled by the source.

## Held-out questions

**Author.** When the harness supports subagents and the current task permits delegation,
start a fresh one in the background during Prepare. Do not assume a BB child
thread and a provider subagent are interchangeable. Give it only:

- the subject and where its source is (the merge request reference, the paths
  and commit, or the error text);
- the understanding task from `plan.md`;
- this brief.

Do not give it the subskills, the overview page, the session's questions, or
the conversation.

**Brief for the author.** Read the source itself. Write 5 questions to
`<session directory>/heldout.md`. Each question tests the understanding task
on a concrete case: predict a result, explain why a rule decides it, or name
what breaks. Ask about behavior and reasons, not about where the code lives:
no "which file", "which method", or "which merge request" questions.
State each case in at most four lines, so reading it is quick. Each can be
answered in one to three sentences. No recall trivia and no
yes/no questions. For each question give the answer key and its evidence as
`path:line` at the commit inspected when source is available. For supplied
prose or pseudocode, quote that evidence and state that original lines and
commit are unavailable. Exclude questions whose answers depend on omitted
implementation details; never present an illustrative model as original code.
When code can settle the answer, run it
and include the command and its output. Do not change subject code or live services; write only the assigned
heldout.md and any explicitly assigned isolated evidence artifacts.

The tutor does not open `heldout.md` until the loop ends, so it cannot teach
to the test. Without subagents, write the 5 questions at wrap-up from the
source, avoid restating the loop's questions, and record
`check-author=same-agent`.

**Verify before asking.** Re-read each key's evidence and re-run its command.
Replace a question whose key fails, and count the replacements in the result
line.

**Ask.** One question per message, with no hints, no figure before the
answer, and no narrower follow-up. After each answer give the verdict and the
correct answer in one line with its evidence link. After a miss, also show
the deciding lines of code, following "The deciding lines" in
[visuals.md](visuals.md); a figure may follow them. Grade as strictly as in
the loop.

**Pass** is at least 4 of 5. On a fail, name the subskills missed and offer
once to continue the loop on them. Do not continue without a yes.

## Result line

End the session with this line, on its own line and outside a code block, so
results can be found across threads:

```text
teach-result subject="<short name>" arm=socratic minutes=<n> read=<n> questions=<n> check=<k>/5 check-author=<subagent|same-agent> replaced=<n>
```

- `minutes`: whole minutes from the start timestamp to the end of the loop,
  before the check. Agent preparation time and the reading phase count,
  because the user spends that time too.
- `read`: whole minutes from the first message to the user's `ready`.
- `questions`: placement plus loop questions.
- After a re-test, print the line again with `retest=<k>/<n>` appended.

## Check mode

`/r-teach check <subject>` measures a subject the user studied another way,
such as an explainer page alone. It gives the comparison arm for judging
whether the questions add anything to reading a page.

1. Ask what the user studied with and for how many minutes, including any
   wait for the material, when the request does not say.
2. Read the source and produce the 5 held-out questions as above.
3. Ask them and print the result line with `arm=<their method>`, for example
   `arm=static-explainer`, and `questions=0`.

Do not run the loop and do not schedule a re-test in this mode.

## Next-day re-test

Scheduling is optional and requires the user's explicit request for a reminder.
A teaching request alone does not authorize an automation. Use the host's
scheduling skill and current CLI help; select the originating thread, project,
and environment from actual session context. Preserve its execution settings
where supported. Review the requested time and timezone. After an uncertain
creation result, inspect existing automations before retrying. Never report a
reminder as scheduled without a confirmed ID and due time. Provide cancellation
instructions from that same host. No host scheduler: give a manual
`/r-teach retest` reminder instead of inventing a service.

**Retest mode.** Read `plan.md` in the session directory; with no slug, find the matching session under the recorded thread-storage or project
`.agent-harness/teach/` directory. If several subjects match, ask which one;
do not silently choose an unrelated session. Ask one question for each of up to five subskills, each from a new angle,
starting with the subskills that were shaky. Record any remaining subskill
as untested instead of implying full coverage. Give no hints and no figure before the answer: this measures
recall without a prompt. Verify each key against the source at the recorded
commit first. After a miss, show the deciding lines as in the check. Lower a
subskill that fails. Print the result line with
`retest=<k>/<n>`. The user may be away when the run fires; the first question
waits in the thread.
