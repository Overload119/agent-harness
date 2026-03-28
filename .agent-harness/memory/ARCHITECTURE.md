---

## AGENTS.md Marker Collision Bug
Date: 2026-03-27

### Why it matters
When using markers to identify sections that need programmatic replacement, the marker must be unique and not appear anywhere inside the content being inserted. Using a marker like ` ```agent-harness-memory ` (fenced code block syntax) which appears in the content itself causes the insertion logic to find and re-replace the marker on subsequent runs, duplicating content.

### Learned constraints
- Marker strings must not appear inside the content they delimit
- HTML comment markers (`<!-- marker -->`) are good choices because they won't appear in normal markdown content
- String comparison for idempotency checks must account for trailing whitespace differences

### Recommended patterns
- Use unique delimiters that cannot collide with content: `<!-- marker -->` instead of markdown fence syntax
- After finding the start marker, search for the END marker starting AFTER the start marker position
- Verify idempotency by running the insertion logic multiple times in a row and checking the output is unchanged after the first run
- When comparing strings for equality (like in skip-if-unchanged logic), ensure both have identical trailing newlines

### Avoid next time
- Don't use fence syntax (```) as markers since they commonly appear in content
- Don't assume the file content has a specific trailing newline - always verify
- Don't use `indexOf(marker)` without specifying a start position when the marker could appear multiple times

### References
- `src/setup/agents.ts` - Fixed implementation with unique `<!-- agent-harness-memory -->` markers
- `test/setup/agents.test.ts` - Tests that verify idempotency by running multiple times
