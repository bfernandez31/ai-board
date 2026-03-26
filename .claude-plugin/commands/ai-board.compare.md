---
command: "/ai-board.compare"
category: "Ticket Comparison"
purpose: "Evaluate which ticket implementation has the best CODE quality"
---

# /ai-board.compare - Ticket Comparison Command

## MANDATORY: ALWAYS REGENERATE - NO EXCEPTIONS

**YOU MUST ALWAYS CREATE A NEW COMPARISON. NEVER SKIP.**

Before doing ANYTHING else, understand these rules:
1. **NEVER** check if a comparison already exists
2. **NEVER** read or list the `comparisons/` directory to see existing reports
3. **NEVER** read `.ai-board-result.md` files
4. **NEVER** say "Comparison Already Available" or similar
5. **ALWAYS** do a fresh analysis from scratch
6. **ALWAYS** create a new report file with a new timestamp

If you find yourself thinking "this comparison was already done", STOP and do it anyway. The user explicitly requested a new comparison.

---

## Core Philosophy

**THIS COMMAND COMPARES CODE, NOT SPECIFICATIONS.**

Key principles:
1. **Code-Only Analysis**: Only evaluate actual source code (`.ts`, `.tsx`, `.js`, etc.)
2. **Workflow-Agnostic**: Quick-impl vs full workflow is NOT a quality criteria
3. **No Spec Penalty**: Missing specs doesn't affect score - specs are process, not quality
4. **Constitution Compliance**: Check code against constitution, not spec completeness
5. **Consolidated Specs Freshness**: Verify `specs/specifications/` is updated if needed

**What we DON'T care about**:
- Whether the ticket has a `spec.md`, `plan.md`, or `tasks.md`
- Whether it went through full workflow or quick-impl
- Lines of documentation in ticket-specific `specs/{branch}/` folder

**What we DO care about**:
- Code quality, architecture, patterns
- Constitution compliance in actual code
- Test coverage for the feature
- Whether consolidated specs (`specs/specifications/`) need updates for new features

## CRITICAL: OUTPUT DIRECTLY - NO INTRODUCTIONS!

**Your output will be posted DIRECTLY as a ticket comment.**

Start IMMEDIATELY with the mention. Do NOT add any introductory text.

**CHARACTER LIMIT**: Your ENTIRE output must be under **1500 characters** (database limit is 2000).

**REQUIRED**:
Start DIRECTLY with:
@[$USER_ID:$USER] **Comparison Complete**

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

### Step 2: Resolve Ticket Branches

For each referenced ticket, find its branch:

```bash
# Find branch for each ticket
git branch -a | grep {ticketKey}
# Example: git branch -a | grep AIB-124
# Output: remotes/origin/AIB-124-some-description
```

**Validation Gate**: Each ticket MUST have a branch. If no branch exists, report error.

### Step 3: Extract CODE Metrics (Excluding specs/)

**CRITICAL**: Only count actual source code changes, NOT specification files.

#### 3a: Extract SOURCE ticket key from $BRANCH

The source ticket key is the prefix of the branch name before the description:
```bash
# Extract ticket key from branch name
# Example: AIB-137-fix-notifications-test -> AIB-137
SOURCE_KEY=$(echo "$BRANCH" | grep -oE '^[A-Z0-9]+-[0-9]+')
```

#### 3b: Analyze SOURCE ticket FIRST

**YOU MUST analyze the source ticket using the current branch ($BRANCH)**:

```bash
# Get diff stats for SOURCE ticket (current branch)
git diff --numstat main...origin/$BRANCH -- . ':!specs/'
```

This will show all code changes on the source ticket. **DO NOT skip this step or report 0 for source.**

#### 3c: Analyze COMPARED tickets

For each referenced ticket, run the same command with their branch:

```bash
# Get diff stats EXCLUDING specs/ folder
git diff --numstat main...{branch} -- . ':!specs/'
```

#### 3d: Calculate metrics for ALL tickets

For **EACH ticket** (source AND compared), calculate:
- **Code lines added/removed** (excluding specs/)
- **Source files changed** (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, etc.)
- **Test files changed** (`*.test.ts`, `*.spec.ts`)
- **Test coverage ratio**: test files / source files

**DO NOT COUNT**:
- `specs/**/*` (spec.md, plan.md, tasks.md, research/, etc.)
- `.md` files in specs/
- Any documentation artifacts

**VALIDATION**: If source ticket shows 0 code changes, re-run the git diff command. The source ticket MUST have code changes if it's in VERIFY stage.

### Step 4: Read Telemetry Data (if available)

**Read the telemetry context file generated by the workflow**:

```bash
cat specs/$BRANCH/.telemetry-context.json
```

This JSON file contains pre-aggregated telemetry for all referenced tickets.

**Parse the telemetry data**:
- `tickets[ticketKey].costUsd`: Total cost in USD
- `tickets[ticketKey].durationMs`: Total duration in milliseconds
- `tickets[ticketKey].inputTokens` / `outputTokens`: Tokens consumed
- `tickets[ticketKey].jobCount`: Number of completed jobs
- `tickets[ticketKey].model`: Primary model used (e.g., opus, sonnet) — display "N/A" if null

**If file doesn't exist or `hasData: false`**: Display "N/A" in metrics.

### Step 5: Analyze Code Implementation

#### 5a: Analyze SOURCE ticket code

**Run this command for the source ticket (current branch)**:
```bash
# View SOURCE ticket code changes
git diff main...origin/$BRANCH -- . ':!specs/' | head -500
```

#### 5b: Analyze COMPARED tickets code

For each referenced ticket:
```bash
# View actual code changes (excluding specs)
git diff main...{branch} -- . ':!specs/' | head -500
```

#### 5c: Evaluate ALL tickets (including source)

For **EACH ticket**, evaluate:
1. **Code Architecture**: How is the feature structured?
2. **Pattern Usage**: Does it follow existing codebase patterns?
3. **Error Handling**: Are errors properly caught and handled?
4. **Type Safety**: Are TypeScript types properly used?

**IMPORTANT**: The source ticket is a COMPETITOR. Analyze it with the same rigor as compared tickets.

### Step 6: Evaluate Constitution Compliance (Code Only)

Read `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md` and evaluate **ACTUAL CODE** against principles:

| Principle | What to Check in CODE |
|-----------|----------------------|
| I. TypeScript-First | Type annotations, no `any`, strict compliance |
| II. Component-Driven | shadcn/ui usage, feature folders, Server/Client split |
| III. Test-Driven | Presence of tests, test type appropriateness |
| IV. Security-First | Input validation (Zod), no raw SQL, no exposed secrets |
| V. Database Integrity | Prisma migrations, transactions, soft deletes |
| VI. AI-First | N/A for code comparison |

**IMPORTANT**: Do NOT penalize for missing specs. Principle VI is about not creating human docs, not about having specs.

### Step 7: Analyze Implementation Choices

**This is the key differentiator**. Compare architectural decisions in CODE:

1. **Identify Decision Points**:
   - State management approach (TanStack Query vs useState)
   - Component structure (server vs client)
   - API design (route structure, error responses)
   - Data fetching strategy

2. **Compare Approaches**:
   For each decision, document:
   - What choice did each ticket make?
   - Which aligns better with constitution?
   - Which is more maintainable?

3. **Evaluate Trade-offs**:
   - Simplicity vs completeness
   - Performance vs readability
   - Code reuse vs isolation

### Step 8: Check Consolidated Specs Freshness

If the feature introduces new behaviors, APIs, or patterns, check if `specs/specifications/` needs updating.

**Note**: Consolidated specs are updated during VERIFY stage. For comparison, just note if the feature warrants spec updates.

### Step 9: Rank Implementations

**Weighted evaluation** (CODE-focused):

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Code Quality | 35% | Clean code, readability, maintainability |
| Constitution Compliance | 30% | Adherence to project standards in actual code |
| Implementation Choices | 20% | Architectural decisions, patterns |
| Test Coverage | 15% | Presence and quality of tests |

**NOT EVALUATED** (never use these as ranking criteria or differentiators):
- Spec completeness (0%)
- Workflow type (0%)
- Documentation in specs/ (0%)
- Cost / telemetry (0%) — cost data is displayed for information only, never as a quality signal

### Step 10: Generate Comparison Report

Create markdown report at:
`specs/$BRANCH/comparisons/{timestamp}-vs-{keys}.md`

**IMPORTANT**: Timestamp format `YYYYMMDD-HHMMSS` (e.g., `20260102-143052`).

**Report Structure**:

```markdown
# Code Implementation Comparison

## Executive Summary
- **Tickets Evaluated**: [SOURCE-KEY] (source), [KEY-1], [KEY-2], ...
- **Best Implementation**: [TICKET-KEY] with [score]%
- **Key Differentiator**: [Main code quality reason]
- **Recommendation**: [Ship/merge action]

## Code Metrics (specs/ excluded)

| Ticket | Code Lines | Source Files | Test Files | Test Ratio |
|--------|------------|--------------|------------|------------|
| AIB-128 (source) | +150 | 5 | 1 | 20% |
| AIB-124 | +180 | 6 | 2 | 33% |

## Telemetry (if available)

| Ticket | Cost | Duration | Tokens | Jobs | Model |
|--------|------|----------|--------|------|-------|
| AIB-128 (source) | $0.15 | 45s | 12K | 3 | opus |
| AIB-124 | $0.22 | 62s | 18K | 4 | sonnet |

## Implementation Choices Analysis

### Decision Point 1: [e.g., State Management]
| Ticket | Approach | Constitution | Trade-offs |
|--------|----------|--------------|------------|
| AIB-128 | TanStack Query | Yes | Proper caching |
| AIB-124 | useState | No | No cache |

**Best**: AIB-128 - Uses proper server state management per constitution.

### Decision Point 2: [e.g., Error Handling]
...

## Constitution Compliance (Code Only)

| Ticket | I. TypeScript | II. Components | III. Tests | IV. Security | V. Database | Overall |
|--------|--------------|----------------|------------|--------------|-------------|---------|
| AIB-128 | Yes | Yes | Yes | Yes | Yes | 95% |
| AIB-124 | Warning 1 any | Yes | No tests | Yes | Yes | 70% |

## Consolidated Specs Status
- [ ] Feature warrants `specs/specifications/` update
- [x] No spec updates needed

## Ranking & Recommendation

### 1. **[TICKET-KEY]** - Best code (score: X%)
**Why it wins**:
- [Code quality reason]
- [Constitution compliance]
- [Better patterns]

### 2. **[TICKET-KEY]** - (score: X%)
**Why it lost**:
- [Specific code issue]

## Next Steps
- [ ] **Ship**: [TICKET-KEY]
- [ ] **Close**: [other tickets]
- [ ] **Update specs/specifications/**: [if needed - will be done in VERIFY stage]
```

### Step 10.5: Write Comparison Data JSON

After writing the markdown report, write a JSON data file for workflow persistence. This enables automated database persistence via the workflow.

**IMPORTANT**: Wrap this entire step in a try-catch. If JSON writing fails, log a warning and continue to Step 11. The markdown report is the primary artifact — JSON is secondary.

**What to write**: A JSON file containing the comparison persistence payload. **Every field shown below is required** — copy this structure exactly, replacing placeholders with actual values:

```json
{
  "projectId": 3,
  "sourceTicketKey": "AIB-123",
  "participantTicketKeys": ["AIB-123", "AIB-124", "AIB-125"],
  "compareRunKey": "cmp_20260321T143000000Z_AIB-123_AIB-124-AIB-125",
  "markdownPath": "specs/AIB-123-feature/comparisons/20260321-143000-vs-AIB-124-AIB-125.md",
  "report": {
    "metadata": {
      "generatedAt": "2026-03-21T14:30:00.000Z",
      "sourceTicket": "AIB-123",
      "comparedTickets": ["AIB-123", "AIB-124", "AIB-125"],
      "filePath": "specs/AIB-123-feature/comparisons/20260321-143000-vs-AIB-124-AIB-125.md"
    },
    "summary": "Executive summary text here",
    "alignment": {
      "overall": 75,
      "dimensions": {
        "requirements": 80,
        "scenarios": 70,
        "entities": 60,
        "keywords": 50
      },
      "isAligned": true,
      "matchingRequirements": ["API endpoints", "Data model"],
      "matchingEntities": ["Ticket", "Project"]
    },
    "implementation": {
      "AIB-123": {
        "ticketKey": "AIB-123",
        "linesAdded": 150,
        "linesRemoved": 20,
        "linesChanged": 170,
        "filesChanged": 5,
        "changedFiles": ["app/api/route.ts", "lib/utils.ts"],
        "testFilesChanged": 1,
        "hasData": true
      }
    },
    "compliance": {
      "AIB-123": {
        "overall": 85,
        "totalPrinciples": 5,
        "passedPrinciples": 4,
        "principles": [
          {
            "name": "TypeScript-First Development",
            "section": "I",
            "passed": true,
            "notes": "All types properly annotated"
          }
        ]
      }
    },
    "decisionPoints": [
      {
        "title": "Telemetry Aggregation Strategy",
        "verdictTicketKey": "AIB-124",
        "verdictSummary": "AIB-124 keeps telemetry aggregation isolated while preserving explicit pending states",
        "rationale": "Its approach is easier to audit and keeps comparison-specific telemetry logic cohesive",
        "participantApproaches": [
          {
            "ticketKey": "AIB-123",
            "summary": "Uses aggregateJobTelemetry() with a separate in-progress query"
          },
          {
            "ticketKey": "AIB-124",
            "summary": "Moves parsing into a telemetry-extractor module with explicit state handling"
          },
          {
            "ticketKey": "AIB-125",
            "summary": "Collapses missing telemetry into generic zero-value metrics"
          }
        ]
      }
    ],
    "recommendation": "Ship AIB-124",
    "warnings": []
  }
}
```

**Field rules**:
- `projectId`: Use `PROJECT_ID` env var, cast to number (not string)
- `generatedAt`: Must be ISO 8601 with timezone (e.g., `"2026-03-21T14:30:00.000Z"`)
- `filePath` in metadata: Must equal `markdownPath`
- `comparedTickets` and `participantTicketKeys`: Must include source ticket, same order
- `ticketKey` inside each `implementation` entry: Must match the record key
- `passed` in principles: Must be a boolean (`true`/`false`), NOT a string
- `decisionPoints`: Include 3-7 distinct feature-specific decision points whenever the markdown analysis identifies them
- `decisionPoints[].title`: Must be the exact decision topic heading used in the markdown analysis
- `decisionPoints[].verdictTicketKey`: Must be one of the compared ticket keys when there is a clear winner, otherwise `null`
- `decisionPoints[].verdictSummary` and `decisionPoints[].rationale`: Must be specific to that decision point, not copied from the global summary/recommendation
- `decisionPoints[].participantApproaches`: Include one entry per compared ticket, preserving the same ticket ordering as `comparedTickets`
- **Do NOT include `telemetry`** in the JSON — telemetry data is already in the database and is enriched server-side at read time

**Note**: The API resolves ticket database IDs from keys automatically. No database IDs are needed in this payload.

**File naming**: Same timestamp and keys as the markdown report, but with `.json` extension.
- Example: `specs/$BRANCH/comparisons/20260102-143052-vs-AIB-124-AIB-125.json`

**File location**: Same directory as the markdown report: `specs/$BRANCH/comparisons/`

**On failure**: Log `"⚠️ Failed to write comparison JSON: <error>"` and continue to Step 11. Do NOT throw or exit.

### Step 11: Create Result File

Write result file at `specs/$BRANCH/.ai-board-result.md`:

```markdown
# AI-BOARD Assist Result

## Status
SUCCESS

## Message
@{USER} Code comparison generated for {tickets}

## Files Modified
- specs/$BRANCH/comparisons/{filename}.md

## Summary
Best code implementation: {best-ticket} with {score}%
Compared on: code quality, constitution compliance, tests
```

### Step 12: Output Summary

Output a concise comment (< 1500 chars) with:
- **Best implementation** clearly identified
- Key code quality differentiator
- Link to full report

## Output Format

**Success Example**:
```markdown
@[cm47j3m31817281:Benoit Fernandez] **Comparison Complete**

Compared CODE quality: **AIB-128** (source), **AIB-124**, **AIB-125**

### Best: **AIB-125** (92%)

**Why**: TanStack Query (not useState), complete error handling, 2 test files covering happy + edge cases.

### Code Ranking
| # | Ticket | Score | Key Differentiator |
|---|--------|-------|-------------------|
| 1 | AIB-125 | 92% | Proper state mgmt, tests |
| 2 | AIB-128 | 78% | Good types, no tests |
| 3 | AIB-124 | 65% | Uses `any`, no tests |

*Specs/workflow type NOT evaluated - code only*

-> **Ship AIB-125**

Full analysis: `comparisons/20260102-143000-vs-AIB-124-AIB-125.md`
```

**Error Example**:
```markdown
@[cm47j3m31817281:Benoit Fernandez] **Comparison Failed**

Could not find branches:
- #XYZ-999: No branch found

Please verify tickets have branches.
```

## Important Rules

1. **CODE ONLY**: Never evaluate spec completeness or workflow type
2. **Exclude specs/**: All metrics exclude `specs/**/*` folder (both ticket specs and consolidated)
3. **Constitution = Code**: Evaluate constitution compliance in actual code, not docs
4. **Quick-impl is valid**: A quick-impl with great code beats full-workflow with bad code
5. **Consolidated specs awareness**: Note if `specs/specifications/` needs updating
6. **Source competes**: Source ticket may win or lose based on code quality
7. **Keep output brief**: Under 1500 characters
8. **Include disclaimer**: "Specs/workflow type NOT evaluated"

## Error Handling

- **No references**: "Please specify tickets to compare (e.g., #AIB-124)"
- **Too many references**: "Maximum 5 tickets per comparison"
- **No branch found**: List specific tickets without branches
- **Same ticket**: Exclude source from comparison list
