---
command: "/compare"
category: "Ticket Comparison"
purpose: "Evaluate which ticket implementation best meets requirements and project standards"
---

# /compare - Ticket Comparison Command

**Purpose**: Compare multiple implementations of the same feature to identify which one:
1. Best aligns with the source ticket requirements
2. Best implements the solution (code quality, architecture)
3. Best respects the project's constitution/standards

**Key Insight**: When comparing tickets for the same feature, similarity is **expected and positive**. The goal is NOT to flag overlap as a problem, but to **identify the best implementation**.

## ⚠️ CRITICAL: OUTPUT DIRECTLY - NO INTRODUCTIONS!

**Your output will be posted DIRECTLY as a ticket comment.**

Start IMMEDIATELY with the mention. Do NOT add any introductory text.

**CHARACTER LIMIT**: Your ENTIRE output must be under **1500 characters** (database limit is 2000).

**REQUIRED**:
Start DIRECTLY with:
@[$USER_ID:$USER] ✅ **Comparison Complete**

## Inputs

**Environment Variables**:
- `TICKET_ID`: Current ticket ID
- `TICKET_TITLE`: Current ticket title
- `STAGE`: Current stage (any stage with a branch)
- `BRANCH`: Git branch name for this ticket
- `USER_ID`: User ID who requested comparison
- `USER`: Display name who requested comparison
- `PROJECT_ID`: Project ID

**Arguments**: `$ARGUMENTS` contains the ticket references (e.g., "#AIB-124 #AIB-125")

## Ticket Reference Format

References use `#TICKET-KEY` format:
- `#AIB-123` - Single ticket
- `#AIB-123 #AIB-124` - Multiple tickets
- Maximum 5 tickets per comparison (excluding source)

## Execution Process

### Step 1: Parse References

Extract ticket keys from $ARGUMENTS using regex `/#([A-Z0-9]{3,6}-\d+)/g`.

**Validation**:
- 1-5 references required (excluding source ticket)
- All tickets must be in same project
- Tickets must exist with accessible branches

### Step 2: Resolve Branches

For each referenced ticket, resolve the branch:

1. **Database lookup**: Check if ticket exists with a branch
2. **Pattern search**: `git branch -a | grep {ticketKey}` if branch missing
3. **Merge analysis**: `git log --merges --grep={ticketKey}` for merged tickets
4. **Unavailable**: Report if ticket cannot be resolved

### Step 3: Load Specifications

Read spec.md from each ticket's branch directory:
- Source: `specs/$BRANCH/spec.md`
- Targets: `specs/{target-branch}/spec.md`

Extract structured sections:
- Requirements (FR-XXX patterns)
- User Scenarios (US-XXX patterns)
- Entities (PascalCase words)
- Keywords (significant terms)

### Step 4: Calculate Requirements Coverage

**Objective**: Determine how well each compared ticket covers the source ticket's requirements.

For each compared ticket, calculate:
- **Requirements Coverage**: What % of source FR-XXX are addressed?
- **Scenario Coverage**: What % of source US-XXX are handled?
- **Entity Alignment**: Are the same domain concepts used?

**Note**: High similarity between tickets is POSITIVE when comparing implementations of the same feature. It indicates the tickets are solving the same problem.

### Step 5: Extract Implementation Metrics

For each ticket with a branch, run:
```bash
git diff --numstat main...{branch}
```

Calculate:
- Lines added/removed
- Files changed
- Test files changed
- Test coverage ratio

### Step 6: Aggregate Telemetry (if available)

Query job telemetry for each ticket:
- Total input/output tokens
- Cost in USD
- Duration in ms
- Models used
- Tools used

### Step 7: Evaluate Constitution Compliance (Dynamic)

**IMPORTANT**: Read the project's constitution dynamically. Do NOT use hardcoded principles.

1. **Read the constitution file**: `.specify/memory/constitution.md`
2. **Extract all principles** from the document (sections starting with "### I.", "### II.", etc. or similar headings)
3. **For each principle found**:
   - Understand what the principle requires (technology-agnostic)
   - Check if each ticket's implementation respects this principle
   - Note specific compliance or violations

**Constitution is project-specific**: It may define TypeScript rules, Python conventions, Go standards, or any other technology. Evaluate based on what the document actually says, not on assumptions.

Example evaluation approach:
- If constitution says "use TypeScript strict mode" → check for type annotations
- If constitution says "all functions must have docstrings" → check for docstrings
- If constitution says "follow REST conventions" → check API design
- If constitution says "test coverage > 80%" → check test file ratios

### Step 8: Analyze Implementation Choices

**This is the key differentiator**. Identify and compare the architectural and design decisions:

1. **Identify Key Decision Points**:
   - What are the main architectural choices each ticket made?
   - Examples: state management approach, data fetching strategy, component structure, API design, error handling patterns

2. **Compare Approaches Side-by-Side**:
   For each decision point, document:
   - What choice did each ticket make?
   - What are the trade-offs of each approach?
   - Which aligns better with the constitution?
   - Which is more appropriate for this specific app context?

3. **Evaluate Against Constitution & Best Practices**:
   - Read the constitution principles
   - For each implementation choice, explain WHY one is better based on:
     - Constitution rules (e.g., "use TanStack Query for server state" → ticket using useState for API data violates this)
     - App-specific context (e.g., existing patterns in codebase, scalability needs)
     - Industry best practices (e.g., separation of concerns, testability)

4. **Document the Reasoning**:
   - Don't just say "AIB-125 is better" - explain the logic
   - Example: "AIB-125 uses TanStack Query with optimistic updates per constitution III, while AIB-124 uses useState which breaks cache consistency"

### Step 9: Rank Implementations

**Weighted evaluation** for each compared ticket:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Requirements Coverage | 30% | How completely does it address source requirements? |
| Implementation Choices | 30% | Are architectural decisions aligned with constitution and best practices? |
| Constitution Compliance | 20% | Overall adherence to project standards |
| Test Coverage | 10% | Presence and quality of tests |
| Efficiency | 10% | Cost, duration, lines of code (less can be better) |

**Produce a ranking**: Best implementation first, with clear justification for each criterion.

### Step 10: Generate Comparison Report

Create markdown report at:
`specs/$BRANCH/comparisons/{timestamp}-vs-{keys}.md`

**IMPORTANT**: The timestamp MUST include both date AND time in format `YYYYMMDD-HHMMSS` (e.g., `20260102-143052`).
This prevents filename collisions when running multiple comparisons on the same day.

Example filename: `20260102-143052-vs-AIB-124-AIB-125.md`

**Report Structure**:

```markdown
# Implementation Comparison Report

## Executive Summary
- **Best Implementation**: [TICKET-KEY] with [score]%
- **Key Differentiator**: [Main reason this implementation wins]
- **Recommendation**: [Clear action - ship this ticket, merge aspects, etc.]

## Requirements Analysis
How each ticket addresses the source requirements:
| Ticket | Coverage | Missing Requirements |
| ... | ... | ... |

## Implementation Choices Analysis

### Decision Point 1: [e.g., State Management]
| Ticket | Approach | Constitution Alignment | Trade-offs |
|--------|----------|------------------------|------------|
| AIB-124 | useState for API data | ❌ Violates "TanStack Query for server state" | Simpler but no cache |
| AIB-125 | TanStack Query with optimistic updates | ✅ Follows constitution | More complex but proper cache |
| AIB-126 | Custom fetch wrapper | ⚠️ Partial - no caching | Lightweight but manual |

**Best Practice**: AIB-125 - Uses the project's standard state management pattern with optimistic updates for better UX.

### Decision Point 2: [e.g., Component Structure]
| Ticket | Approach | Constitution Alignment | Trade-offs |
|--------|----------|------------------------|------------|
| ... | ... | ... | ... |

**Best Practice**: [Explanation of why one approach is better]

### Decision Point 3: [e.g., Error Handling]
...

## Constitution Compliance
Based on `.specify/memory/constitution.md`:
| Ticket | [Principle I] | [Principle II] | [Principle III] | Overall |
| ... | ✅/❌ | ✅/❌ | ✅/❌ | X% |

Detailed analysis:
- **AIB-125**: Fully compliant - uses TypeScript strict, shadcn/ui components, TanStack Query
- **AIB-124**: 60% - Missing tests, uses any types in 2 places
- **AIB-126**: 80% - Good types but bypasses shadcn/ui for custom modal

## Metrics Comparison
| Ticket | Lines | Files | Tests | Cost | Duration |
| ... | ... | ... | ... | ... | ... |

## Ranking & Recommendation

### 🏆 1. **[TICKET-KEY]** - Best overall (score: X%)
**Why it wins**:
- [Specific implementation choice that's superior]
- [Constitution compliance detail]
- [Quality/test coverage advantage]

**Minor weaknesses**:
- [Any areas where other tickets did something better]

### 2. **[TICKET-KEY]** - Runner-up (score: X%)
**Good aspects worth considering**:
- [What this ticket did well that could be merged]

**Why it lost**:
- [Specific implementation choice that's inferior and why]

### 3. **[TICKET-KEY]** - (score: X%)
...

## Actionable Next Steps
- [ ] **Ship**: [TICKET-KEY] as the best implementation
- [ ] **Consider merging**: [specific feature/approach] from [OTHER-TICKET] because [reason]
- [ ] **Close**: [TICKET-KEYS] with reference to chosen implementation
- [ ] **Fix before shipping**: [any minor issues in winning ticket]
```

### Step 11: Create Result File

Write result file at `specs/$BRANCH/.ai-board-result.md`:

```markdown
# AI-BOARD Assist Result

## Status
SUCCESS

## Message
@{USER} Comparison report generated for {tickets}

## Files Modified
- specs/$BRANCH/comparisons/{filename}.md

## Summary
Generated comparison report comparing {source} with {targets}
Best implementation: {best-ticket} with {score}%
```

### Step 12: Output Summary

Output a concise comment (< 1500 chars) with:
- **Best implementation** clearly identified
- Key differentiator (main reason it wins)
- Link to full report

## Output Format

**Success Example**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ✅ **Comparison Complete**

Compared **AIB-123** with **AIB-124**, **AIB-125**, **AIB-126**

### 🏆 Best: **AIB-125** (92%)

**Why it wins**: Uses TanStack Query with optimistic updates (per constitution) vs useState in others. Proper error boundaries and complete test coverage.

### Ranking
| # | Ticket | Score | Differentiator |
|---|--------|-------|----------------|
| 1 | AIB-125 | 92% | TanStack Query, full tests |
| 2 | AIB-126 | 78% | Good structure, no cache |
| 3 | AIB-124 | 65% | useState, missing tests |

→ **Ship AIB-125**, close others

📄 Full analysis: `comparisons/20260102-143000-vs-AIB-124-AIB-125-AIB-126.md`
```

**Low Relevance Warning**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ⚠️ **Low Relevance Detected**

Compared **AIB-123** with **AIB-456**

These tickets address different features (only 15% overlap).
Comparison may not be meaningful for choosing a "best" implementation.

Consider comparing tickets that implement the same feature.

📄 Report generated: `comparisons/{filename}.md`
```

**Error Example**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ❌ **Comparison Failed**

Could not compare tickets:
- #XYZ-999: Ticket not found in project

Please verify ticket keys are correct and in the same project.
```

## Important Rules

1. **Purpose is EVALUATION**: Find the best implementation, not flag duplicates
2. **Similarity is POSITIVE**: For same-feature tickets, overlap means they're solving the same problem
3. **Constitution is DYNAMIC**: Read `.specify/memory/constitution.md`, don't use hardcoded rules
4. **Provide clear ranking**: Always identify the best implementation
5. **Actionable recommendations**: Tell the user what to do (ship X, close Y)
6. **Keep output brief**: Under 1500 characters
7. **Include link**: Point to full report

## Error Handling

- **No references**: "Please specify tickets to compare (e.g., #AIB-124)"
- **Too many references**: "Maximum 5 tickets per comparison"
- **Cross-project**: "All tickets must be in the same project"
- **Self-reference**: Exclude source ticket from count
- **Ticket not found**: List specific tickets that couldn't be resolved
