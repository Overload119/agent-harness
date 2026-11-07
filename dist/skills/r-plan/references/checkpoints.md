# Branch checkpoints

Use checkpoints when the request calls for separate branches, Git Spice stacks,
or explicit MR ordering. Do not introduce a stack merely to match task IDs.

Each checkpoint maps to exactly one branch and records:

- Stable ID (`CP-001`), goal, and contained task IDs.
- `Git Spice Branch:`, `Base:`, and `Stack Position:`.
- Concrete exit criteria, verification, and expected commit/MR state.

Assign every implementation unit to exactly one checkpoint with
`Checkpoint: CP-001`. Put final verification in the topmost implementation
checkpoint unless a separate verification branch is explicitly needed. Preserve
supplied branch names; otherwise derive names from task goals. Describe the
sequential delta when multiple checkpoints touch the same file.

Before editing a checkpoint, create or switch to its branch and verify its
base. Complete only its assigned units, run its checks, record the new commit
and evidence, then advance. Do not collapse a requested stack into one branch.
End the plan with a brief branch summary. A resumed handoff names the next
incomplete checkpoint, branch, base, task IDs, and verification expectations.
