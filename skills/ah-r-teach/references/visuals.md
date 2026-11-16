# Figures in chat during the questions

This file covers the small figures shown in chat during the question loop.
The lay-of-the-land page that opens the session is a separate, full page; see
[overview.md](overview.md). Do not redraw in chat what that page already
shows: name its section, and draw only what the question adds, such as where
the user's prediction diverged.

## What a page in chat can and cannot do

In BB, use the host's installed `inline-vis` guidance for its current preview contract:

- The page runs in a sandboxed frame. The only messages it can send to bb are
  its height and a request to open a link. It **cannot** put text in the
  composer or send the user's answer to the thread. The user answers in chat.
  Do not build an answer form or a submit button that implies otherwise.
- Inside the page, scripts work. Steppers, toggles, sliders, and hover states
  are available, so the user can step through the figure.
- The reader can reveal a page's HTML source. A figure attached to a question
  must not hold the answer anywhere in its source.

## When to show one

- **Reveal:** when the answer has shape: a flow, an order, a before and
  after, a state change, or a data shape. Mark where the user's prediction
  diverged from what happens. A single fact needs no figure. After a right
  answer, cite its `path:line`. After a miss, show the deciding lines; see
  the next section.
- **Question:** optional. Show the figure with the asked-for part blank or
  marked `?`, or a real code excerpt to reason about.
- One figure per message. The chat message carries the words; do not repeat
  the figure in prose.

Use real names from the source in every label: function names, file paths,
queue names, column names.

## The deciding lines

The deciding lines are the exact lines of code that produce the answer. Show
them every time the user misses and the message gives the answer: a second
miss, `just tell me`, a reveal at the cap, and a miss in the held-out check
or the re-test. A sentence that describes the code, with line numbers beside
it, makes the user trust the description. The lines let them see what the
code does.

- Copy the lines from the source at the commit inspected. Read them again
  for this message; do not write them from memory, and do not paraphrase or
  shorten a line. Keep the comments that the source has.
- Put `path:first-last` on its own line above each block, as a link when the
  harness can link it.
- Use a fenced block in the source's language. When the merge request under
  study changed these lines, use a `diff` block with the removed and added
  lines, so the user sees what the change did.
- Keep it short: at most two blocks and about 15 lines in total. Two blocks
  suit an answer made by a check in one place and the rule it calls in
  another. For more, use the embedded `explain-inline` CodeTour component (Form 2).
- Below the blocks, run the user's case through the lines with its real
  values, in at most 3 sentences. Quote the expression that decides, not
  only its line number.
- A text flow diagram or a figure may accompany the lines. It does not
  replace them.
- When no code decides the answer (a product decision in a discussion, a
  line in a log), quote the deciding sentence or log line the same way.

A fenced code block is not a figure, so it does not count against "one
figure per message".

Example, after a miss on "what happens to a job that times out on its third
attempt?":

````text
**Not yet.** The job is dropped after the third attempt, and the error goes to the error tracker.

`app/jobs/sync_job.rb:4-7`
```ruby
retry_on Net::ReadTimeout, wait: 30.seconds, attempts: 3 do |job, error|
  # Give up quietly: the next hourly sync covers this account.
  ErrorTracker.capture(error, extra: { account_id: job.arguments.first })
end
```
`attempts: 3` counts the first run, so the third timeout is the last one. The block runs instead of raising, so the job never reaches the dead queue: `ErrorTracker.capture` is its only trace.
````

When the merge request changed the lines:

````text
`app/jobs/sync_job.rb:4`
```diff
-retry_on Net::ReadTimeout, wait: 30.seconds, attempts: 5
+retry_on Net::ReadTimeout, wait: 30.seconds, attempts: 3 do |job, error|
```
````

## Form 1: a small figure written in the reply

Use an `inline-vis` fenced block for a figure of up to about 12 labels: a
before/after pair, a marked code excerpt, a state table, or a short step
strip. Follow the `inline-vis` skill: theme variables instead of fixed
colours, no outer background or card, fluid width, fixed pixel heights for
charts. It follows the user's light or dark theme and needs no tool call.

A step strip that marks the user's prediction, tested in light and dark at
chat width:

````text
```inline-vis
<style>
  .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .box{padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);opacity:.45}
  .box.on{opacity:1;border-color:var(--brand)}
  .box.guess{opacity:1;border-color:var(--destructive);border-style:dashed}
  .arrow,.tag{color:var(--muted-foreground)}
  .cap{margin:12px 0;min-height:3em}
  button{font:inherit;padding:4px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--secondary);color:var(--secondary-foreground);cursor:pointer}
</style>
<div class="row" id="row"></div>
<p class="cap" id="cap"></p>
<button id="prev">←</button> <button id="next">→</button> <span class="tag" id="pos"></span>
<script>
  const parts = ["perform_later", "Sidekiq queue", "SyncJob#perform", "retry_on Timeout"];
  const guess = 1; // index of the part the user predicted
  const steps = [
    { on: [0, 1], text: "The controller enqueues the job. Nothing runs yet." },
    { on: [1, 2], text: "A worker takes the job and calls perform." },
    { on: [2, 3], text: "The timeout is raised inside perform, so retry_on handles it. You predicted the queue would drop the job (dashed box)." }
  ];
  const row = document.getElementById("row");
  parts.forEach((name, i) => {
    if (i) row.insertAdjacentHTML("beforeend", '<span class="arrow">→</span>');
    const box = document.createElement("span");
    box.className = "box"; box.textContent = name; row.append(box);
  });
  const boxes = [...row.querySelectorAll(".box")];
  let at = 0;
  function show() {
    boxes.forEach((box, i) => {
      box.classList.toggle("on", steps[at].on.includes(i));
      box.classList.toggle("guess", at === steps.length - 1 && i === guess);
    });
    document.getElementById("cap").textContent = steps[at].text;
    document.getElementById("pos").textContent = (at + 1) + " of " + steps.length;
  }
  document.getElementById("prev").onclick = () => { at = Math.max(0, at - 1); show(); };
  document.getElementById("next").onclick = () => { at = Math.min(steps.length - 1, at + 1); show(); };
  show();
</script>
```
````

Set text with `textContent`, as above, so names from the source are never
parsed as HTML.

## Form 2: embedded explanation components

Load the distributed `explain-inline` skill. Use its JSON catalog and extraction
recipe to write a local HTML file in this session directory. Use a
CodeTour for deciding code (changed lines stay in a `diff` fenced block in chat), a Lifecycle for an ordered flow, a CodeMap for
relationships, or Mermaid (rendered by the embedded Pele runtime).

Verify that the page renders, then emit its thread-storage or workspace-relative
inline preview directive as that skill specifies. The components inherit the
host theme. Do not put an answer in a question's component data, even collapsed.
Without inline previews, link the local HTML and keep code excerpts in chat.
Without explain-inline, use Form 1 or plain code and text diagrams; report the
limit instead of installing a renderer or publishing a page automatically.
