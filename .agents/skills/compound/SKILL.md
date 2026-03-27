---
name: ah-compound
description: Distill reusable lessons from completed work into durable memory entries in `.agent-harness/memory/` category files. Use when a task, review, or verification pass produced durable insights worth preserving for future agent runs.
---

Turn completed work into a compact reusable lesson stored in the appropriate memory category file.

Your job is to capture only the high-value lessons that are likely to help future agent passes avoid repeating discovery work.

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

## Behavior

1. **Determine the source material:**
   - a completed task or PRD item
   - a review or verification result
   - a sequence of agent notes or implementation passes

2. **Extract reusable knowledge, not a diary:**
   - conventions learned from the repo
   - pitfalls encountered and how they were resolved
   - commands or verification flows that proved reliable
   - constraints that future work must preserve

3. **Ignore low-value noise:**
   - temporary debugging details
   - one-off errors with no future relevance
   - information that is already obvious from the code

4. **Decide the category autonomously:**
   - Read the category descriptions above
   - Choose the category that best matches the lesson topic
   - NEVER ask the user to choose

5. **Scan existing entries in the target category:**
   ```bash
   rg -n "topic keyword" .agent-harness/memory/CATEGORY.md
   ```
   - If a related entry exists, offer to update it or create a new one
   - If no match, create a new entry

6. **Write the entry to the category file:**
   - Entries are Markdown sections separated by `---`
   - Append new entry at end of file
   - Format follows the entry template below

7. **Enforce 500-line soft cap per category file:**
   - Count lines before writing: `wc -l .agent-harness/memory/CATEGORY.md`
   - If file exceeds 500 lines after new entry, trigger consolidation
   - Notify user: "Category file approaching limit. Run ah-memory consolidate to compact entries."

8. Return the saved content in the response as well.

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

## Compounding Rules

- Keep the entry short and skimmable
- Prefer bullets over prose paragraphs
- Focus on lessons that change future execution decisions
- Include file paths or commands only when they materially improve reuse
- If there is not enough durable insight yet, say so and do not force an artifact
- New entries are always appended with `---` as separator

## Consolidation Trigger

After writing, if the target file exceeds 500 lines, tell the user to run:
```
ah-memory consolidate
```
