---
name: ah-ship
description: Prepare completed work for shipping by checking local instructions, validating repo state, and defaulting to a safe commit-oriented flow. Use when the user wants to ship, release, or wrap up finished work without guessing at repo-specific deploy steps.
---

Prepare completed work to ship without using destructive git behavior.

Your job is to follow repository-local shipping instructions when they exist and otherwise fall back to the safest reasonable release preparation flow.

Behavior:

1. Inspect the nearest relevant `AGENTS.md` files for ship or deploy instructions.
2. Determine the current shipping mode:
   - repo-specific deploy flow is documented
   - no deploy flow is documented, so default to commit preparation
   - work is not ready to ship because verification or review failed
3. Validate repo state before shipping:
   - identify uncommitted changes
   - identify the current branch
   - note whether there are changes to ship at all
4. Apply the safest matching action:
   - if explicit repo instructions exist, follow them without inventing extra deploy steps
   - if no instructions exist, prepare a concise commit plan and commit only when the user explicitly asked for it
   - if the branch is not `main` or `master`, call out any merge or PR decision as a separate choice instead of assuming it
5. Never use destructive git operations unless the user explicitly requests them.

Shipping rules:

- Do not invent credentials, environments, deploy commands, or branch policies.
- Do not create an empty commit.
- Do not hide blockers such as failing verification, missing release notes, or absent deploy instructions.
- Normalize `main` and `master` as equivalent default branches unless the repo documents something else.

Output format:

- Shipping mode
- Repo state
- Blockers
- Recommended action
- Commands or steps to run

If shipping is blocked, say so explicitly before listing follow-up actions.
