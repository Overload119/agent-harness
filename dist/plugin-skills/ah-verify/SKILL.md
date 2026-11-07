---
name: ah-verify
description: Choose and run the lightest credible verification path, using browser automation only when browser-based validation is actually relevant. Use when the user asks how to verify something, how to test whether it works, wants evidence that implemented work behaves correctly, or needs a concrete verification strategy with explicit gaps.
---

Decide how to verify work and, when possible, verify whether it behaves as intended.

Your job is to choose the lightest credible verification path, use browser automation only when it fits the project, and clearly report what was and was not verified.

This skill should activate for requests like:

- "how can I verify this?"
- "how should I test this?"
- "check whether this works"
- "verify this works"

Behavior:

1. Determine what is being verified:
   - a UI or browser-facing workflow
   - an API, CLI, library, or backend-only change
   - a plan or PRD task that still lacks implementation
2. Pick the verification strategy:
   - use browser-based verification only when the feature is meaningfully exercised in a browser
   - otherwise prefer repository-native checks such as tests, typecheck, build, linters, scripts, or manual reasoning
   - if the user is asking how to verify something before evidence exists, return the most credible verification approach instead of pretending the work is already verified
3. If browser verification is relevant and feasible:
   - use the `agent-browser` skill for navigation, interaction, screenshots, and observed behavior
   - capture concrete evidence such as pages visited, assertions made, and any failures encountered
   - when verification produces visual proof such as screenshots, saved HTML, or other browser-openable artifacts, include the exact local file path in the final answer so the user can open it immediately
4. If browser verification is not the right fit:
   - say why not
   - recommend the most appropriate non-browser checks
5. If the implementation or environment is incomplete:
   - fail clearly
   - list the exact blockers instead of pretending verification succeeded

Verification rules:

- Do not claim a pass without evidence.
- Distinguish between `verified`, `partially verified`, and `not verified`.
- Keep the opening summary brief. Assume the user is busy and wants a short explanation of what was actually verified before the detailed evidence.
- Prefer reproducible checks over vague statements like "looks good".
- If the user asks for browser verification but the repo does not expose a runnable browser target, explain that limitation plainly.
- If visual proof exists, surface it explicitly with a clickable file path instead of making the user ask where it is.
- Keep this skill scoped to verification strategy and verification evidence. Do not turn it into broad implementation planning.

Output format:

- Verified summary
- Scope
- Verification strategy
- Result
- Evidence
- Visual proof
- Blockers / gaps
- Recommended next checks

Result must be exactly one of:

- `verified`
- `partially verified`
- `not verified`
