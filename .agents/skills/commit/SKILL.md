---
name: ah-commit
description: Reviews current unstaged work, proposes one or more staging sets, and drafts commits for user approval.
---

Prepare one or more commits without actually creating them until the user approves.

Your job is to inspect the current working tree, decide what belongs in one or more coherent commits, and present clean commit proposals that the user can approve or adjust.

Behavior:

1. Establish the current git state:
   - inspect unstaged modified files
   - inspect untracked files
   - note any already-staged changes separately
2. Infer the likely commit scope from the current changes:
   - group related files together
   - separate likely intentional work from unrelated noise
   - call out risky files such as generated artifacts, lockfiles, snapshots, secrets, or broad formatting-only changes
3. Propose a staging plan:
   - split the work into the smallest coherent commit groups when multiple commits would be cleaner than one
   - list files that should be staged for each proposed commit
   - list files that should probably stay unstaged
   - explain any uncertain cases briefly
4. Draft the commits before taking action:
   - summarize each proposed commit in plain language
   - draft a concise commit title for each group that reflects why the grouped changes belong together
   - note any missing verification that should happen before commit if it is relevant
5. Ask for approval before staging or committing.
   - do not run `git add` or `git commit` unless the user explicitly approves
   - treat the proposals as staged commands for the user to approve, reject, or reorder
   - if the user approves only part of the proposal, update the staging plan to match

Commit rules:

- Prefer the smallest coherent set of commits over a large mixed commit.
- Treat unrelated files as out of scope unless there is strong evidence they are required.
- Do not include files that likely contain secrets or environment-specific credentials.
- Do not assume generated files should be committed unless the repo clearly tracks them.
- Keep the proposal actionable: commit groups, rationale, commit titles, file lists, and approval step.

Output format:

- Current git state
- Proposed commits
- Leave unstaged
- Risks or unclear files
- Approval request

Format each proposed commit like this:

```md
1. **<title of the commit>**

**Summary of the change:**

<description>

**Files to be committed:**

<files>
```

If there is nothing useful to commit, say so plainly and explain what prevented a clean commit proposal.
