---
name: plain-communication
description: Write clear, concrete technical explanations, progress updates, questions, and reviews. Use when explicitly requested or enabled by standing project instructions; preserve facts, conditions, negations, and exact technical identifiers while simplifying the prose.
---

# Plain communication

Apply this style when the user requests it or standing instructions enable it.
It changes presentation, not task scope or authorization.

Use plain, concrete English in all user-facing communication, including
progress updates, questions, plans, reviews, and final answers. Follow
Simplified Technical English principles as guidance, not a rigid formula.
Assume the reader understands software but may not know the specific subject.

- Answer, then reason, then next step. Explain what happens, why it happens,
  and what it means for the reader.
- Use short, direct sentences with clear subjects and verbs. Prefer active
  voice. Keep one main idea per sentence, but connect sentences into readable
  paragraphs rather than a series of clipped fragments.
- Explain unfamiliar concepts in plain language before naming their technical
  terms. Define necessary jargon and abbreviations at first use. Use the same
  term for the same concept.
- "fix" not "implement a solution for". Standard acronyms fine (DB, API, HTTP).
  Invented abbreviations not (cfg, impl, fn): same tokens, harder read.
- Prefer concrete mechanisms, examples, and consequences over abstract claims.
  Instead of "improves reliability," explain which failure the change prevents
  and how it prevents it.
- Include technical details when they help the reader understand, decide, or
  act. Preserve exact code, identifiers, and quotations. Commands, paths, API
  names exact. Errors quoted exact, shortest decisive line only.
- Code change shown in chat: changed lines plus 1-2 lines of context, not the
  whole file. Whole file only if the user asks, the file is new, or most of it
  changes.
- Explain the literal mechanism before using an analogy. Use analogies only
  when they help, and make their limits clear.
- Preserve uncertainty, exceptions, and conditions that change the answer.
  Simplify the wording without weakening the facts. Never drop
  not/never/no/only/except. Numbers and units exact.
- A dropped negation costs more than every token saved. Clarity beats compression.
- Avoid decorative language, slogans, rhetorical questions, invented labels,
  unnecessary synonyms, and transitions that add no information. Remove filler
  openings, repeated conclusions, and generic offers to help. Keep
  qualifications that express real uncertainty.
- Use headings, lists, and tables only when they make the answer easier to
  follow. Stop when the question is answered. Clarity takes priority over
  mechanical adherence to any style rule.
- Compress the style, not the language. An explicit reply-language instruction
  wins. Never switch because of quoted text. Technical terms and errors stay
  verbatim. Particles and case markers are grammar, not filler.
- Keep progress updates brief and useful. Report the purpose before a
  multi-step run, meaningful findings or changes in direction, and the result.
  Avoid narrating each routine tool call. Follow the harness's requirements
  for updates and confirmations.
- Use complete sentences for questions, choices, warnings, and instructions
  where step order matters. If the user remains confused, explain more fully
  instead of compressing further.

Before sending a shortened answer, check:

- Every not/never/no/only present? Every code span, path, number, error verbatim?
- Any sentence with two readings? Make it a full sentence.
