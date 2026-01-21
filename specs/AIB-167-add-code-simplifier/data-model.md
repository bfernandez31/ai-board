# Data Model: Code Simplifier and PR Code Review

**Feature**: AIB-167-add-code-simplifier
**Date**: 2026-01-21

## Overview

This feature adds workflow steps without database changes. The data model describes the logical entities and data structures used by the code simplifier and code review commands.

## Entities

### CodeSimplifierStep

Workflow step entity (not persisted to database).

| Field | Type | Description |
|-------|------|-------------|
| featureBranch | string | Git branch being processed |
| modifiedFiles | string[] | Files changed vs main branch (from `git diff --name-only main...HEAD`) |
| simplificationChanges | SimplificationChange[] | Applied changes |

**Constraints**:
- Must not alter functionality (tests must pass after changes)
- Focus on recently modified files only (FR-003)

### SimplificationChange

Individual code simplification applied.

| Field | Type | Description |
|-------|------|-------------|
| filePath | string | Absolute path to modified file |
| originalCode | string | Code before simplification |
| simplifiedCode | string | Code after simplification |
| rationale | string | Why the change improves clarity |
| patternType | SimplificationPattern | Type of simplification applied |

**Validation**:
- `filePath` must be within repository root
- `rationale` required for each change

### SimplificationPattern (enum)

Types of code simplification:
- `NESTED_TERNARY` - Flatten nested ternary operators
- `REDUNDANT_ABSTRACTION` - Remove unnecessary abstractions
- `VERBOSE_CONDITIONAL` - Simplify complex conditionals
- `DEAD_CODE` - Remove unreachable code
- `DUPLICATE_LOGIC` - Consolidate repeated patterns
- `COMPLEX_EXPRESSION` - Break down complex expressions

---

### CodeReviewStep

Workflow step entity (not persisted to database).

| Field | Type | Description |
|-------|------|-------------|
| prNumber | number | GitHub PR number |
| prUrl | string | Full GitHub PR URL |
| reviewAgents | ReviewAgent[] | Parallel agents used |
| findings | ReviewFinding[] | All identified issues |
| filteredFindings | ReviewFinding[] | Issues with confidence >= 80 |

**Constraints**:
- Must execute after successful PR creation (FR-005)
- Must not run build/typecheck (FR-013)

### ReviewAgent

Parallel review agent configuration.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Agent identifier |
| dimension | ReviewDimension | What the agent checks |
| contextFiles | string[] | Files loaded as context |
| status | 'pending' \| 'running' \| 'completed' \| 'failed' | Execution status |

### ReviewDimension (enum)

Review dimensions per FR-008:
- `CLAUDE_MD_COMPLIANCE` - CLAUDE.md guidelines adherence
- `CONSTITUTION_COMPLIANCE` - Constitution non-negotiable rules
- `BUG_DETECTION` - Obvious bugs and issues
- `GIT_HISTORY_CONTEXT` - Changes in context of git history
- `CODE_COMMENT_COMPLIANCE` - Appropriate comments and documentation

### ReviewFinding

Individual issue identified during code review (FR-009, FR-010, FR-011, FR-012).

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique finding identifier |
| description | string | Human-readable issue description |
| filePath | string | Path to file containing issue |
| lineNumber | number | Line number in file |
| confidence | number | Confidence score 0-100 (FR-009) |
| source | 'CLAUDE_MD' \| 'CONSTITUTION' | Which guideline violated (FR-011) |
| dimension | ReviewDimension | Which agent found this |
| gitShaLink | string | Full Git SHA reference URL (FR-012) |

**Validation**:
- `confidence` must be integer 0-100
- Only findings with `confidence >= 80` are reported (FR-010)
- `gitShaLink` format: `https://github.com/{owner}/{repo}/blob/{SHA}/{filePath}#L{lineNumber}`

---

## Data Flow

### Code Simplifier Flow

```
Input: feature branch, main branch
  ↓
git diff --name-only main...HEAD → modifiedFiles[]
  ↓
For each file in modifiedFiles:
  ├── Read file content
  ├── Analyze for simplification patterns
  ├── Generate SimplificationChange[]
  └── Apply changes via Edit tool
  ↓
Run affected tests (verify functionality preserved)
  ↓
git commit if changes made
  ↓
Output: commit with simplified code
```

### Code Review Flow

```
Input: PR number, PR URL, branch
  ↓
Read context files:
  ├── .specify/memory/constitution.md
  ├── CLAUDE.md (root)
  └── CLAUDE.md (modified directories)
  ↓
Get PR diff: gh pr diff ${PR_NUMBER}
  ↓
Parallel agent execution (5 agents):
  ├── CLAUDE_MD_COMPLIANCE agent
  ├── CONSTITUTION_COMPLIANCE agent
  ├── BUG_DETECTION agent
  ├── GIT_HISTORY_CONTEXT agent
  └── CODE_COMMENT_COMPLIANCE agent
  ↓
Collect findings from all agents
  ↓
Filter: findings.filter(f => f.confidence >= 80)
  ↓
Format as markdown table with Git SHA links
  ↓
gh pr comment ${PR_NUMBER} --body "${COMMENT}"
  ↓
Output: PR comment posted (or graceful failure)
```

## State Transitions

### Code Simplifier States

```
PENDING → ANALYZING → SIMPLIFYING → TESTING → COMMITTING → COMPLETED
                                       ↓
                                    FAILED (tests broke)
```

### Code Review States

```
PENDING → READING_CONTEXT → REVIEWING → FILTERING → POSTING → COMPLETED
                              ↓                        ↓
                           FAILED (timeout)      COMPLETED (post failed - non-blocking)
```

## Relationships

```
CodeSimplifierStep
  └── has many SimplificationChange

CodeReviewStep
  ├── has many ReviewAgent
  └── has many ReviewFinding

ReviewFinding
  └── belongs to ReviewAgent (via dimension)
```

## No Database Changes Required

This feature operates entirely within GitHub Actions workflow execution. All data structures are transient and exist only during workflow run. No Prisma schema changes or migrations needed.
