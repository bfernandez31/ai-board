# Quickstart: Code Simplifier and PR Code Review

**Feature**: AIB-167-add-code-simplifier
**Date**: 2026-01-21

## Implementation Overview

This feature adds two new steps to the verify workflow:

1. **Code Simplifier** - Runs after test fixes, before documentation sync
2. **Code Review** - Runs after PR creation, posts findings as PR comment

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `.claude/commands/code-simplifier.md` | Claude Code command spec for code simplification |
| `.claude/commands/code-review.md` | Claude Code command spec for PR code review |

### Files to Modify

| File | Changes |
|------|---------|
| `.github/workflows/verify.yml` | Add code simplifier step (Phase 4.5) and code review step (Phase 6.5) |

## Implementation Steps

### Step 1: Create Code Simplifier Command

Create `.claude/commands/code-simplifier.md` following the existing `/verify` command pattern.

**Key sections**:
- YAML frontmatter with command metadata
- Phase 1: Discovery (get modified files via git diff)
- Phase 2: Analysis (identify simplification patterns)
- Phase 3: Implementation (apply changes via Edit tool)
- Phase 4: Validation (run affected tests)
- Phase 5: Commit (if changes made)

**Simplification patterns** (from spec):
- Nested ternaries → if/else or switch
- Redundant abstractions → inline
- Verbose conditionals → simplified boolean
- Complex expressions → named constants

### Step 2: Create Code Review Command

Create `.claude/commands/code-review.md` with parallel agent architecture.

**Key sections**:
- YAML frontmatter with command metadata
- Context loading (CLAUDE.md + constitution)
- Parallel agent execution (5 dimensions)
- Confidence scoring and filtering (threshold 80)
- Markdown output formatting
- GitHub CLI comment posting

**Review dimensions** (FR-008):
1. CLAUDE.md compliance
2. Constitution compliance
3. Bug detection
4. Git history context
5. Code comment compliance

### Step 3: Modify verify.yml Workflow

Add two new steps to the workflow:

**Phase 4.5: Code Simplifier** (after test fixes commit, before documentation update)
```yaml
- name: Execute Code Simplifier
  if: ${{ success() && env.SKIP_EXECUTION != 'true' }}
  env:
    FEATURE_BRANCH: ${{ inputs.branch }}
  run: |
    echo "🧹 Running code simplifier..."
    claude --dangerously-skip-permissions "/code-simplify"

- name: Commit Simplifications
  if: ${{ success() && env.SKIP_EXECUTION != 'true' }}
  run: |
    git add .
    if ! git diff --staged --quiet; then
      git commit -m "refactor(ticket-${{ inputs.ticket_id }}): simplify code for clarity"
      git push origin "${{ inputs.branch }}"
    fi
```

**Phase 6.5: Code Review** (after PR creation)
```yaml
- name: Execute Code Review
  if: ${{ success() && env.SKIP_EXECUTION != 'true' }}
  continue-on-error: true  # Non-blocking
  env:
    FEATURE_BRANCH: ${{ inputs.branch }}
    PR_NUMBER: ${{ steps.create-pr.outputs.pr_number }}
  run: |
    echo "🔍 Running automated code review..."
    claude --dangerously-skip-permissions "/code-review"
```

## Testing Strategy

### Integration Tests (Vitest)

Test the command execution patterns:
- Verify code simplifier processes TypeScript files correctly
- Verify code review loads context files
- Verify confidence filtering logic
- Verify markdown output formatting

Location: `tests/integration/workflows/`

### No E2E Tests Required

Code review and simplification are workflow steps, not browser features. All testing via integration tests.

## Dependencies

**Existing** (no new dependencies):
- Claude Code CLI (@anthropic-ai/claude-code)
- GitHub CLI (gh)
- Git

## Success Criteria

1. Code simplifier executes without errors in verify workflow
2. Code simplifier reduces verbose patterns while tests remain green
3. Code review executes after PR creation
4. Code review posts formatted markdown comment on PR
5. Issues below 80 confidence are filtered out
6. Workflow completes even if code review fails (non-blocking)

## Commit Guidelines

**Code Simplifier commits**:
```
refactor(ticket-{ID}): simplify code for clarity

Applied automated code simplification:
- Flattened nested ternaries
- Removed redundant abstractions
- Simplified verbose conditionals
```

**Implementation commits**:
```
feat(ticket-{ID}): add code simplifier to verify workflow

- Create /code-simplify command
- Add workflow step after test fixes
- Commit simplifications automatically
```

```
feat(ticket-{ID}): add PR code review to verify workflow

- Create /code-review command with 5 parallel agents
- Add workflow step after PR creation
- Post formatted findings as PR comment
```
