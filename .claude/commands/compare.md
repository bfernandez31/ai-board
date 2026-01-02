---
command: "/compare"
category: "Ticket Comparison"
purpose: "Compare ticket implementations to analyze feature alignment, costs, and compliance"
---

# /compare - Ticket Comparison Command

Compare 1-5 tickets against the current ticket to analyze:
- Feature alignment (spec overlap)
- Implementation metrics (code changes)
- Constitution compliance
- Cost/telemetry data

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

### Step 4: Calculate Feature Alignment

Compare specs using weighted dimensions:
- Requirements: 40%
- Scenarios: 30%
- Entities: 20%
- Keywords: 10%

If alignment < 30%, include warning about low relevance.

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

### Step 7: Score Constitution Compliance (if applicable)

Check each ticket against constitution principles:
1. TypeScript-First Development
2. Component-Driven Architecture
3. Test-Driven Development
4. Security-First Design
5. Database Integrity
6. AI-First Development Model

### Step 8: Generate Comparison Report

Create markdown report at:
`specs/$BRANCH/comparisons/{timestamp}-vs-{keys}.md`

Report sections:
1. Executive Summary
2. Feature Alignment Analysis
3. Implementation Metrics
4. Cost & Telemetry
5. Constitution Compliance
6. Recommendation

### Step 9: Create Result File

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
```

### Step 10: Output Summary

Output a concise comment (< 1500 chars) with:
- Overall alignment score
- Key findings (metrics, costs)
- Link to full report

## Output Format

**Success Example**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ✅ **Comparison Complete**

Compared **AIB-123** with **AIB-124**, **AIB-125**

### Feature Alignment: 68% (Medium)
Matching: FR-002, FR-003 | Entities: Ticket, Project

### Implementation Metrics
| Ticket | Lines | Files | Tests |
|--------|-------|-------|-------|
| AIB-124 | +450/-120 | 12 | 3 |
| AIB-125 | +280/-85 | 8 | 2 |

### Cost Summary
| Ticket | Tokens | Cost | Duration |
|--------|--------|------|----------|
| AIB-124 | 45K | $0.12 | 3m 20s |
| AIB-125 | 38K | $0.09 | 2m 45s |

📄 Full report: `comparisons/20260102-143000-vs-AIB-124-AIB-125.md`
```

**Low Alignment Warning**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ⚠️ **Low Alignment Detected**

Compared **AIB-123** with **AIB-456**

### Feature Alignment: 15%
These tickets appear unrelated. Comparison results may not be meaningful.

Consider comparing tickets with similar features.

📄 Report generated with cost-only analysis: `comparisons/{filename}.md`
```

**Error Example**:
```markdown
@[cm47j3m31817281:Benoît Fernandez] ❌ **Comparison Failed**

Could not compare tickets:
- #XYZ-999: Ticket not found in project

Please verify ticket keys are correct and in the same project.
```

## Important Rules

1. **Validate references**: 1-5 tickets, same project
2. **Handle missing branches**: Use fallback resolution
3. **Generate report**: Always create markdown file
4. **Create result file**: For workflow status tracking
5. **Keep output brief**: Under 1500 characters
6. **Include link**: Point to full report
7. **Warn on low alignment**: < 30% threshold

## Error Handling

- **No references**: "Please specify tickets to compare (e.g., #AIB-124)"
- **Too many references**: "Maximum 5 tickets per comparison"
- **Cross-project**: "All tickets must be in the same project"
- **Self-reference**: Exclude source ticket from count
- **Ticket not found**: List specific tickets that couldn't be resolved
