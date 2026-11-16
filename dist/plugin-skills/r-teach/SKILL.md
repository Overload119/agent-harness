---
name: r-teach
description: Teach the user one subject fast, for one merge request, one error, or one area of a codebase. First open a visual overview page of the whole subject in the browser, then ask questions and reveal interactive figures in chat. Use for "teach me", "quiz me on", "help me understand X by asking me questions", `/r-teach <subject>`, `/r-teach check <subject>`, and `/r-teach retest`. Use explain-inline for a visual explanation without a quiz, and answer a one-off "what is X" question directly.
---

# Teach

Bring the user to the point where they can do a real task with the subject on
their own, in the fewest questions. A session has two phases. First the user
reads the **lay of the land**: one visual overview page that
explains the whole subject visually. Then the questions start: the user
predicts, sees the result, and explains the gap.

Teaching is read-only. It does not authorize changes to the subject's code,
comments on a merge request, or production commands. Run only read-only commands or isolated tests that do not mutate live services.
Creating session artifacts is allowed. Publishing, scheduling, or changing
settings requires an explicit request; loading this skill does not authorize it.

## Guard

A one-off question ("explain X", "what does this do") gets a normal answer, not
a session. When the intent is unclear, ask one short question: "Quick answer,
or should I teach it with questions?"

## Modes

- `<subject>`: the full session below.
- `check <subject>`: only the held-out check, for a subject the user studied
  another way. Read [references/check.md](references/check.md).
- `retest`: the next-day re-test. Read [references/check.md](references/check.md).

## Prepare

Do all of this before the first question. Keep it fast: the user is waiting.
The overview page is the first thing the user gets, so deliver it as soon as
it is rendered and finish the rest while they read.

1. Record the start with `date +%s`. Create the session directory
   `$BB_THREAD_STORAGE/teach/<slug>/` when the host supplies thread storage;
   otherwise use `.agent-harness/teach/<slug>/` in the active checkout.
   Record its absolute path, subject, and inspected commit for later resumption.
2. Read the subject itself, not a summary of it. If the user supplied only
   prose or pseudocode, name that as the source. Do not invent original code,
   commits, or source lines. Label any executable model as illustrative and
   exclude questions whose answers depend on missing implementation details.

   | Subject | Read | Example understanding task |
   | --- | --- | --- |
   | Merge request | Description, diff, and discussions (follow the local GitLab or GitHub skill); the changed files at base and head; callers of changed symbols; tests | "Say what breaks if this hunk is reverted, and name one case the change does not cover." |
   | Error | The exact error and stack; the code at each frame the user owns; recent changes to those lines; a reproduction when it is cheap and safe | "Name the cause and the condition that triggers it, and predict what the fix changes." |
   | Codebase area | Entry points, callers, data model, tests, and `git log` for the files | "Take <a realistic case> and say what the code does with it, which rule decides that, and what else that rule affects." |

3. Start `plan.md` in the session directory with:
   - The **understanding task**: one concrete thing the user must be able to do
     when the session ends. It is a task, not "understands X".
   - 3 to 6 **subskills** the task needs. Fewer for a narrow subject.

   The task and the subskills are about the logic, as defined in
   [Test the logic](#test-the-logic). Do not make "knows which merge request
   or file owns a rule" a subskill.
4. Prepare independent held-out questions when authorized delegation is available, following
   [references/check.md](references/check.md). Do not read its output until
   the loop ends.
5. Build and show the lay-of-the-land page, following
   [references/overview.md](references/overview.md). When the harness shows
   messages before a turn ends, post the page link as soon as the page
   exists, then continue with step 6.
6. Add one primary question per subskill to `plan.md`, each with its **answer
   key** and **evidence**: `path:line` at the commit inspected, or a
   discussion link. When code can settle the answer (a test, a short script,
   a console call), run it and store the command and its output in the key.
7. Send the first message and stop:

   ```text
   **<subject>: lay of the land** · [Open the overview](<link>)
   After this session you can: <the understanding task>.
   Read it, then reply `ready`. Ask about anything on the page first; the questions start after.
   ```

## Reading phase

Until the user says `ready`, this is explanation, not quizzing. Answer
questions about the page directly and briefly, with evidence. When an answer
shows that the page is wrong or unclear, fix the page and say what changed.
Record the time of `ready`: the reading minutes go in the result line. Then
say in one line that three placement questions come first, and ask placement
question 1.

## Session messages

Ask ONE question per message, in chat, as free text. End the message
immediately after the question. Add no hints, no example answers, no summary
or tl;dr section, and no offers after it. A session message is an exact
format; summary rules for ordinary replies do not apply to it. Do not use a
multiple-choice tool: choosing an option is easier than producing the answer,
and it hides the reasoning.

After the user answers, one message holds the verdict on the last answer and
the next question:

```text
**Right.** | **Partly.** | **Not yet.**  <one line: what was right or wrong>
<the deciding lines of code, when revealing an answer after a miss>
<reveal visual, when the rules below call for a reveal>
<at most 3 sentences: only what the code and the visual do not show>

**Q5 of about 8 · <subskill>**
<the next question>
```

## Test the logic

Every question, in placement, the loop, and the held-out check, tests the
logic of the subject: what happens in a concrete case, which rule decides it,
why the rule is that way, and what it costs or breaks. The user answers in
terms of behavior and reasons.

Do not ask where the code lives. "Which merge request owns this?", "Which
file would you open first?", and "Which method decides this?" test
navigation, and the user can look those up in seconds. Names and paths
belong in the answer key, the evidence, and the reveal, not in what the user
must produce.

- BAD: "You need to change when the daily release runs. Which MR's code owns
  it, and which file would you open first?"
- GOOD: "A job writes the order, then its email request times out. The job
  retries. Does it create another order or send another email, and why?"

The one exception is a session where the user asked to learn where things
live ("teach me where X is handled").

## Placement

Placement finds what the page already taught, so the loop spends time only
on what did not stick. Ask 3 placement questions that run from easy to hard
and cover different subskills. Do not teach during placement: acknowledge the answer in a few
words and ask the next one. Then show the map and say where the session
starts. Skip every subskill the user already has.

```text
<subject>                      understanding task: <one line>
✓ how the job is enqueued      solid
~ retry and failure path       shaky   ← next
· what the migration changes   not tested
```

`✓` solid means correct, with correct reasoning, on the first attempt, or
correct on a later re-test after a miss. `~` shaky is everything in between.

## Loop

Work through the subskills that are not solid.

- Ask about cases the overview page does not walk through. A question the
  user can answer by finding a sentence on the page tests reading, not
  understanding.
- Prefer questions that make the user predict the outcome of a concrete input
  or change, explain why a rule exists, find the flaw in a plausible but
  wrong claim, apply the idea to a new case, or connect two parts. Avoid
  recall trivia (names, counts, file paths) and yes/no questions.
- **Right:** reveal, then move on. Now and then, when a right answer could be a
  lucky guess, challenge it first ("what about <edge case>?").
- **First miss:** do not give the answer. Ask a narrower question that exposes
  the contradiction. Evidence may accompany it (a real code excerpt, or the
  figure with the disputed part blank), but never the answer.
- **Second miss:** reveal with the deciding lines of code, and explain in at
  most 3 sentences. Re-test the same
  idea later from a different angle, after another subskill when one remains.
- A vague or partly correct answer is not correct. Probe ("what condition changes the
  result?") until it is clear whether the user understands. Do not credit an
  insight the user did not express.
- Do not flatter. "Not yet. If that were true, why does the retry run twice?"
  is better than "Great try!".
- Give a short explanation only to introduce material the user could not
  derive, then return to questions.

**Cap:** about 10 questions in total, counting placement and narrower
follow-ups. Stop earlier when every subskill is solid. When the cap arrives
with shaky subskills left, reveal each one directly with its visual, mark it
shaky, and go to the wrap-up.

## Grade from evidence

Write the answer key and its evidence into `plan.md` before sending the
question, including for questions invented during the session. Between
questions, write to `plan.md` only for a question that is new; keep the
running log in the conversation and append it once at wrap-up, so each turn
stays fast. Never grade from memory. When an answer is surprising, re-read the evidence before
judging: the user may be right and the key wrong. When the key was wrong, say
so, correct it, and credit the answer.

## Visuals

The reveal is the "observe" step, so it shows the real thing: real names,
real paths, the actual order of events, and where the user's prediction
diverged from what happens. Read [references/visuals.md](references/visuals.md)
before the first reveal. In short:

- Every time the user misses and the message gives the answer, show the
  **deciding lines**: the exact lines of code that produce the answer, as a
  diff when the merge request changed them. A `path:line` citation alone is
  not enough after a miss, because the user cannot read the lines from a
  number. This applies in the loop, the held-out check, and the re-test.
- Show a figure when the answer has shape: a flow, an order, a before and
  after, a state change, or a data shape. A single fact needs no figure.
- A page in chat cannot send the user's answer to the thread. The user
  answers in chat, and the figure is what they look at and step through.
- A question may carry a figure with the asked-for part blank. That figure
  must not contain the answer, including in its HTML source.

## Wrap up

1. Record the loop end time before starting the held-out check in
   [references/check.md](references/check.md). The check is not part of loop minutes.
2. Append the session log to `plan.md`: each question, its subskill, and the
   verdict. Record check time separately if useful.
3. Show the final map and the one to three weakest points, each with its
   evidence link.
4. Offer a next-day re-test. Schedule it only if the user explicitly requests
   a reminder and the host supports it; otherwise explain `/r-teach retest`.
5. Print the result line from [references/check.md](references/check.md).

## What the user can say at any time

- `just tell me`: reveal the current answer, mark the subskill shaky, and
  re-test it later. Open that message with `**Answer.**` instead of a verdict.
- `skip`: leave this subskill; the held-out check still covers it.
- `page`: give the overview link again.
- `map`: show the map.
- `harder` / `easier`: change the difficulty.
- `wrap up`: go to the held-out check now.
- `no retest`: do not schedule the next-day re-test.
