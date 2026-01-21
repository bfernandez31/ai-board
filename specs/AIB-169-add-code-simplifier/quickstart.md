# Implementation Guide: Code Simplifier and PR Review

**Branch**: `AIB-169-add-code-simplifier` | **Date**: 2026-01-21

## Implementation Overview

This feature adds two new Claude Code commands and integrates them into the verify workflow.

## File Creation Order

### Step 1: Create Code Simplifier Command

**File**: `.claude/commands/code-simplifier.md`

**Structure**:
```yaml
---
command: "/code-simplifier"
description: "Simplify recently modified code while preserving functionality"
model: "opus"
allowed-tools: ["Read", "Edit", "Glob", "Grep", "Bash", "TodoWrite"]
---

# /code-simplifier - Code Simplification Command

## Context Discovery
1. CLAUDE.md (auto-loaded) → Project conventions
2. Read `.specify/memory/constitution.md` → Project principles
3. Get changed files: `git diff --name-only main...HEAD`

## Workflow

### Phase 1: Identify Targets
- List changed TypeScript files (excluding tests)
- Filter to files with simplification opportunities

### Phase 2: Analyze & Simplify
For each file:
1. Read current content
2. Identify simplification patterns
3. Apply changes preserving functionality
4. Run impacted tests only

### Phase 3: Commit
- Commit with message: `refactor(ticket-{id}): simplify code`

## Safety Rules
- NEVER change behavior
- ALWAYS run impacted tests after changes
- Revert if tests fail
```

### Step 2: Create Code Review Command

**File**: `.claude/commands/code-review.md`

**Structure**:
```yaml
---
command: "/code-review"
description: "Review PR changes against CLAUDE.md and constitution guidelines"
model: "opus"
allowed-tools: ["Read", "Glob", "Grep", "Bash", "WebFetch"]
---

# /code-review - PR Code Review Command

## Context Discovery
1. CLAUDE.md (auto-loaded) → Project conventions
2. Read `.specify/memory/constitution.md` → Project principles (reference only)
3. Get PR changes: `gh pr diff {PR_NUMBER}`

## Workflow

### Phase 1: Gather Context
- Read changed files from PR
- Load constitution principles
- Understand review criteria

### Phase 2: Review
For each changed file:
1. Check against CLAUDE.md conventions
2. Check against constitution principles
3. Assign confidence score (0-100) to each issue

### Phase 3: Report
- Filter to issues with confidence ≥ 80
- Post comment to PR via `gh pr comment`

## Scoring
| Score | Classification |
|-------|---------------|
| 90-100 | Critical |
| 80-89 | High (report) |
| <80 | Do not report |
```

### Step 3: Modify Verify Workflow

**File**: `.github/workflows/verify.yml`

**Changes**:

1. Add step after "Commit Test Fixes" (line ~370):
```yaml
- name: Execute /code-simplifier Command
  if: ${{ success() && env.SKIP_EXECUTION != 'true' }}
  env:
    FEATURE_BRANCH: ${{ inputs.branch }}
  run: |
    echo "🔧 Executing code simplifier..."
    claude --dangerously-skip-permissions "/code-simplifier --branch ${FEATURE_BRANCH}"
```

2. Add commit step for simplification changes:
```yaml
- name: Commit Simplification Changes
  if: ${{ success() && env.SKIP_EXECUTION != 'true' }}
  run: |
    git add .
    if ! git diff --staged --quiet; then
      git commit -m "refactor(ticket-${{ inputs.ticket_id }}): simplify code"
      git push origin "${{ inputs.branch }}"
    fi
```

3. Add step after PR creation (line ~438):
```yaml
- name: Execute /code-review Command
  if: ${{ success() && env.SKIP_EXECUTION != 'true' && env.PR_URL != '' }}
  env:
    PR_NUMBER: ${{ env.PR_NUMBER }}
    PR_URL: ${{ env.PR_URL }}
  run: |
    echo "🔍 Executing code review..."
    claude --dangerously-skip-permissions "/code-review --pr-number ${PR_NUMBER}"
```

## Verification Steps

After implementation:

1. **Unit Test**: Create test for command file parsing (if applicable)
2. **Integration Test**: Verify workflow executes new steps
3. **Manual Test**: Run verify workflow on test branch and confirm:
   - Code simplifier runs and commits changes (if any)
   - Code review posts comment to PR

## Environment Variables

| Variable | Source | Used By |
|----------|--------|---------|
| `FEATURE_BRANCH` | Workflow input | Code simplifier |
| `PR_NUMBER` | create-pr-only.sh output | Code review |
| `PR_URL` | create-pr-only.sh output | Code review |
| `GH_TOKEN` | Secrets | GitHub CLI operations |

## Error Handling

- If code simplifier fails, continue to documentation update (non-blocking)
- If code review fails, log warning but don't fail workflow (PR already created)
- Both commands should handle missing files gracefully
