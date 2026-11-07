# UI Visual Contract

Use this workflow when `r-plan` calls for a UI sketch.

## Build The Contract And Sketch Together

1. Save supporting HTML under the working plan's `assets/` directory.
2. Inspect the current product surface or its source, screenshots, and design
   language before drawing the target. Match the real typography, spacing,
   borders, density, and responsive conventions closely enough for approval.
3. Add `### UI Contract` to the Durable Contract immediately after `### Desired
   Behavior`. Explain in prose or a compact table what the user sees, the
   meaningful states, exact copy, actions, navigation, and intentional omissions.
   Mark sample names and data as illustrative; identify which hierarchy, states,
   labels, and copy are contractual.
4. Create a self-contained responsive HTML sketch and link it from the plan
   with a relative Markdown link. Keep the plan understandable without opening
   the sketch.
5. Use local interactions only when they clarify meaningful variants or states.
   Prefer a state switcher within one coherent mock over several decorative
   variants. Do not vary only colors or surface styling.

Treat sketch construction as a specification pass, not decoration. If it exposes
misleading inherited UI, contradictory copy, incomplete external data, or an
unhandled state, resolve that behavior in the Durable Contract before finalizing
the mock. Carry the resolution into the relevant implementation unit, acceptance
criteria, tests, and any target-state diagram.

## Quality Bar

- Match the source product rather than inventing a generic design system.
- Show the target hierarchy and enough surrounding page context to explain placement.
- Include the states that materially change what the user sees or can do.
- Make intentional omissions visible in the prose or sketch annotations.
- Use exact contractual copy and action labels when known.
- Keep example people, events, records, and URLs clearly illustrative.
- Use semantic HTML, visible focus states, sufficient contrast, and offline-safe assets.

## Verification

Verify the HTML directly in a browser at desktop and narrow widths. Exercise every
local control and confirm:

- no content is clipped and no normal state has a nested scrollbar;
- responsive stacking and text wrapping remain legible;
- state changes expose the intended content and hide the intended omissions;
- controls work without console errors;
- the relative asset link resolves from the plan.

The sketch supports the Markdown plan; it does not create a second execution contract.
