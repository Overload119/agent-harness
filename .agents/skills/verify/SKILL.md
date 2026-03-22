---
name: ah-verify
description: Verifies completed work, using browser automation only when browser-based validation is actually relevant.
---

Verify whether completed work behaves as intended.

Your job is to choose the lightest credible verification path, use browser automation only when it fits the project, and clearly report what was and was not verified.

Behavior:

1. Determine what is being verified:
   - a UI or browser-facing workflow
   - an API, CLI, library, or backend-only change
   - a plan or PRD task that still lacks implementation
2. Pick the verification strategy:
   - use browser-based verification only when the feature is meaningfully exercised in a browser
   - otherwise prefer repository-native checks such as tests, typecheck, build, linters, scripts, or manual reasoning
3. If browser verification is relevant and feasible:
   - use the `agent-browser` skill for navigation, interaction, screenshots, and observed behavior
   - capture concrete evidence such as pages visited, assertions made, and any failures encountered
4. If browser verification is not the right fit:
   - say why not
   - recommend the most appropriate non-browser checks
5. If the implementation or environment is incomplete:
   - fail clearly
   - list the exact blockers instead of pretending verification succeeded

Verification rules:

- Do not claim a pass without evidence.
- Distinguish between `verified`, `partially verified`, and `not verified`.
- Prefer reproducible checks over vague statements like "looks good".
- If the user asks for browser verification but the repo does not expose a runnable browser target, explain that limitation plainly.

Output format:

- Scope
- Verification strategy
- Result
- Evidence
- Blockers / gaps
- Recommended next checks

Result must be exactly one of:

- `verified`
- `partially verified`
- `not verified`
