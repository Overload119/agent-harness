---
name: memory
description: Use when you need to recall past work, previous decisions, error solutions, or project history. Activates the 3-layer memory search workflow for token-efficient retrieval.
---

# ah-memory Skill

## When to Activate

Use this skill when:
- User asks about past work, previous sessions, or what was done before
- User references a decision, pattern, or error you don't have context for
- You need project history, conventions, or architectural decisions
- User asks "what did we do about X?" or "how did we handle Y?"
- You're missing context that should exist from earlier sessions
- Starting work on a feature that may have prior decisions recorded

## Memory Categories

**NEVER ask the user which category to use.** Read the category descriptions below and determine the correct category autonomously based on the topic.

### ARCHITECTURE.md - System Infrastructure
Store lessons about **system-level infrastructure and design decisions**:
- Plugins, hooks, and OpenCode extensions
- Agent harness structure and configuration
- Build system, CI/CD, and deployment
- Database schema design
- Authentication/authorization architecture
- Cross-cutting concerns spanning backend/frontend

### BACKEND.md - Server-Side Code
Store lessons about **server-side conventions and API design**:
- RESTful API patterns and conventions
- Database queries, ORMs, and query builders
- Authentication implementation (JWT, sessions, OAuth)
- Caching strategies (Redis, in-memory)
- Error handling for APIs
- Background job processing
- Server-side validation

### FRONTEND.md - UI and Browser Code
Store lessons about **UI development and browser-side patterns**:
- React, Vue, Angular, Svelte component patterns
- State management (Redux, MobX, Zustand)
- CSS/SCSS/Tailwind styling
- Animation and transitions
- Form handling and validation
- Responsive design
- Browser APIs (localStorage, IndexedDB)
- Build tool configuration (Webpack, Vite)

### PRODUCT.md - Features and Requirements
Store lessons about **what the product should do and user needs**:
- User stories and requirements
- Feature specifications
- Roadmap priorities
- User feedback and pain points
- Accessibility requirements

### BUSINESS.md - Business Logic and Rules
Store lessons about **business constraints and domain rules**:
- Domain-specific validation rules
- Pricing, billing, subscription logic
- Regulatory compliance (GDPR, SOC2)
- Multi-tenant data isolation
- Payment processing constraints
- Audit logging requirements

### USER_PREFERENCES.md - User Taste
Store lessons about **the user's coding style, taste, and preferences**:
- Coding style preferences (e.g., "prefers controller-based APIs", "dislikes over-commenting")
- Architectural preferences (e.g., "follows clean architecture", "prefers one type per file")
- Trade-off priorities (e.g., "readability over brevity", "explicit over clever")
- Preferences stated directly by the user vs. inferred from behavior

## Memory File Locations

All memory files are under `.agent-harness/memory/`:
```
.agent-harness/memory/ARCHITECTURE.md
.agent-harness/memory/BACKEND.md
.agent-harness/memory/FRONTEND.md
.agent-harness/memory/PRODUCT.md
.agent-harness/memory/BUSINESS.md
.agent-harness/memory/USER_PREFERENCES.md
```

Entries within files are separated by lines containing only `---`.

## 3-Layer Search Workflow

### Layer 1: rg Search (lightweight)

Use `rg` (ripgrep) for fast searching:

```bash
rg -n "search term" .agent-harness/memory/
```

Returns file paths and line numbers. Always start with rg before reading files.

**Tips:**
- Use `-i` for case-insensitive: `rg -in "search term" .agent-harness/memory/`
- Limit to specific category: `rg -n "term" .agent-harness/memory/BACKEND.md`
- Get just filenames: `rg -l "term" .agent-harness/memory/`

### Layer 2: Read Context

Once rg identifies a file:line, read surrounding context:

```bash
rg -n -A5 -B5 "search term" .agent-harness/memory/FILE.md
```

This shows 5 lines after (-A) and before (-B) the match.

### Layer 3: Read Full Entry

Memory entries are delimited by `---` lines. To read a complete entry:

```bash
awk '/^---$/ && !done { start=NR+1; done=1 } NR>=start' .agent-harness/memory/FILE.md
```

## Quick Search Examples

Search all categories:
```bash
rg -n "JWT" .agent-harness/memory/
```

Search specific category:
```bash
rg -n "React" .agent-harness/memory/FRONTEND.md
```

Case-insensitive:
```bash
rg -in "error handling" .agent-harness/memory/
```

## Workflow Summary

1. **Start with rg** - Never read files without first using rg to locate relevant entries
2. **Filter by category** - Use `rg .agent-harness/memory/CATEGORY.md` to narrow search
3. **Read context first** - Get lines around match before loading full entry
4. **Load full entry only when needed** - Parse between `---` delimiters

## Entry Format

```markdown
---

## <Topic>
Date: YYYY-MM-DD

### Why it matters
- ...

### Learned constraints
- ...

### Recommended patterns
- ...

### Avoid next time
- ...

### References
- `path/to/file`
- `command --flag`
```

## Token Efficiency Rules

1. ALWAYS start with `rg` (Layer 1), never read files blindly
2. Filter by specific category files when you know the domain
3. Use context reads before loading full entries
4. Load full entries only for selected matches
5. This workflow saves tokens by never loading more than needed

## Consolidation

When entries grow beyond 500 lines in any category file, entries are consolidated to remove duplicates and stale content. The `ah-compound` skill handles this automatically every 10 tool executions.
