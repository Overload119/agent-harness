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

### Exa (Supplementary)
Use only when DeepWiki doesn't have the answer:
- For very recent implementations not yet indexed
- For blog posts, articles, discussions about implementations
- For finding specific patterns across multiple repos

```
exa_web_search_exa(
  query="<problem> implementation in <language> site:github.com",
  numResults=5,
  freshness="year"
)
```

## Core Workflow

### Step 1: Understand the Goal

Ask exactly one focused question if needed, otherwise infer:

- **The problem**: What problem is the user trying to solve?
- **The target repos**: Any specific repos they want to analyze? (e.g., "how does React handle X")
- **The language/ecosystem**: Python? TypeScript? Rust?
- **Depth needed**: High-level understanding? Detailed implementation? Copy-paste?

### Step 2: Query DeepWiki

Start with DeepWiki to quickly understand how repos handle the problem:

```
# Ask a targeted question (most useful)
deepwiki ask <repo> "<specific question>"

# Or get the full wiki for architecture overview
deepwiki wiki <repo>
```

### Step 3: Present Findings

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

### Step 4: Offer Deep Dive (always)

After presenting DeepWiki findings, always offer to:

1. **Clone for deep exploration**: `gh repo clone owner/repo /tmp/.agent-harness/repos/<repo-name>`
2. **Navigate the code**: Use gh to explore specific files
3. **Extract relevant code**: Copy sections to `.agent-harness/inspirations/`

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

- **Start with DeepWiki**: It's faster and more focused than web search
- **Use Exa sparingly**: Only when DeepWiki doesn't have the answer
- **Be practical**: 2-3 well-analyzed repos is better than 10 shallow results
- **Offer cloning**: When an implementation looks promising, offer to clone for deeper analysis
- **No fabrication**: Never guess code or architecture. Use actual findings from DeepWiki/gh.
- **License awareness**: Flag if something is GPL or has other restrictions.

## Output Format

After analysis, return:

- Question/goal restatement
- Key findings from DeepWiki (quoted or summarized)
- Recommended next step
- "What next?" choices:
  1. Clone option # for deep exploration
  2. Compare with another repo
  3. Ask a follow-up question
  4. Extract relevant code to harness
  5. Adapt to current codebase
