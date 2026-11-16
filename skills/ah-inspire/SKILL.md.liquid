---
name: ah-inspire
description: Analyze how other codebases solve problems using DeepWiki and GitHub so the user can study and adapt implementations. Uses DeepWiki for architecture/code understanding, GitHub CLI for cloning and deep exploration, and Exa for supplementary web search.
---

Analyze how other codebases solve problems using DeepWiki and GitHub.

Your job is to give the user instant knowledge of any public GitHub repo using DeepWiki, surface concrete implementations they can study, and optionally clone repos for deeper exploration.

## When to Activate

- User says things like "see how others do X", "analyze how Y works", "what's a good implementation of Z", "understand the architecture of X"
- User wants to understand how a specific project solves a problem
- User wants to learn patterns from real-world codebases
- User needs external knowledge to inform their implementation

## Tools

This workflow requires GitHub CLI, DeepWiki, and Exa access. Check available
commands and tool schemas before using them. If a capability is missing, report
the limitation; do not invent a tool call or claim that installing this skill
provides the service.

### DeepWiki (Primary)
Use DeepWiki to instantly query any public GitHub repo:

```
# Ask a specific question about a repo
deepwiki ask <owner>/<repo> "<question>"

# Get full wiki content for a repo
deepwiki wiki <owner>/<repo>

# Get table of contents (structure overview)
deepwiki toc <owner>/<repo>
```

Flags:
- `--json` - Output raw JSON for programmatic use
- `-q, --quiet` - Suppress non-essential output
- `--no-color` - Disable colors

### GitHub CLI (Deep Dive)
Use gh when you need to:
- Clone a repo for full code exploration
- Navigate and read files locally
- Compare different implementations

```
# Clone to temp location for deep exploration
gh repo clone <owner>/<repo> /tmp/.agent-harness/repos/<repo-name>

# List cloned repos
ls /tmp/.agent-harness/repos/
```

### GitHub Search (Code Discovery)
Use `gh search repos` to find concrete code implementations:
- Best for: specific repos, frameworks, libraries with source code
- Use 2-3 word phrases, not sentences: "agent orchestration" not "how do agents route tasks"
- If empty results, try synonyms or tool names directly

```
# Basic search
gh search repos <keywords> --limit 10

# Sort by stars
gh search repos <keywords> --sort stars --limit 10

# Language filter
gh search repos <keywords> language:<language> --limit 10
```

**When to use gh:**
- User mentions specific framework/tool (e.g., "langchain", "autogen")
- User wants to see actual code implementations
- User wants to clone and explore code

### Exa (Documentation & Patterns Discovery)
Use Exa to find public documentation, blog posts, articles, and discussions:
- Best for: tutorials, architecture guides, pattern explanations, recent implementations
- Complements gh by finding non-code resources

**When to use Exa:**
- User wants to understand concepts/patterns (not specific repo)
- Need recent implementations not yet well-indexed
- Blog posts, articles, or discussions about implementations
- General research phase before diving into code

## Core Workflow

### Step 1: Understand the Goal

Ask exactly one focused question if needed, otherwise infer:

- **The problem**: What problem is the user trying to solve?
- **The target repos**: Any specific repos they want to analyze? (e.g., "how does React handle X")
- **The language/ecosystem**: Python? TypeScript? Rust?
- **Depth needed**: High-level understanding? Detailed implementation? Copy-paste?

### Step 2: Discover Resources in Parallel

Skip discovery when the user already named the repository. Otherwise search
GitHub and Exa for the actual user problem through their available interfaces.
Independent searches can run in parallel. Use a subagent only when delegation
is authorized and the host provides a supported API.

**GitHub (gh)** → For concrete code implementations, specific framework examples
**Exa** → For documentation, tutorials, architecture discussions, pattern explanations

Validate GitHub repos exist before DeepWiki:
```
gh repo view <owner>/<repo> --json name,url
```

If gh search returns empty, Exa may still have useful results. Use both sources.

### Step 3: Query DeepWiki on Validated Repos

Only query DeepWiki for repos that have been validated (gh repo view succeeded):

```
# Ask a targeted question (most useful)
deepwiki ask <repo> "<specific question>"

# Or get the full wiki for architecture overview
deepwiki wiki <repo>
```

### Step 4: Present Findings

Format as a scannable summary:

```
## Analysis: <problem/question>

### DeepWiki Response
**Repo**: <owner>/<repo>
**Question**: <what was asked>

<key findings from deepwiki ask/wiki>

### Suggested Next Steps

1. **Explore deeper** - Clone <repo> to `/tmp/.agent-harness/repos/<repo-name>` for full code exploration
2. **Compare repos** - Analyze multiple repos side-by-side
3. **Get more details** - Ask a follow-up question about <specific aspect>
4. **Adapt to codebase** - Apply learnings to current project
```

## Cloning Repos

Clone to `/tmp/.agent-harness/repos/` for thorough analysis:
- Keeps workspace clean
- Allows full IDE/navigation experience
- Can compare multiple repos side-by-side

```
# Single repo
gh repo clone owner/repo /tmp/.agent-harness/repos/repo-name

# List all cloned repos
ls /tmp/.agent-harness/repos/
```

## Example Workflows

### Understand a specific implementation
```
deepwiki ask facebook/react "How does the fiber reconciler work?"
```

### Get architecture overview
```
deepwiki wiki oven-sh/bun
```

### Compare two implementations
```
deepwiki ask facebook/react "How does useEffect work?"
deepwiki ask vercel/next.js "How does useEffect work in the App Router?"
```

### Deep dive after initial findings
```
# Clone for exploration
gh repo clone facebook/react /tmp/.agent-harness/repos/react

# Find the specific file
gh search code "useEffect" --repo facebook/react --limit 5
```

## Rules

- **Use simple keywords for gh**: 2-3 word phrases work best; avoid full sentences
- **Validate repos before DeepWiki**: Always run `gh repo view` to confirm a repo exists before querying DeepWiki
- **Be practical**: 2-3 well-analyzed repos is better than 10 shallow results
- **No fabrication**: Never guess code or architecture. Use actual findings from DeepWiki/gh.
- **License awareness**: Flag if something is GPL or has other restrictions.

## Output Format

After analysis, return:

- Question/goal restatement
- Key findings from DeepWiki (quoted or summarized)
- Recommended next step
