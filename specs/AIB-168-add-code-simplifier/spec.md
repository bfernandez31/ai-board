# Quick Implementation: Add code simplifier and pr review to verify

**Feature Branch**: `AIB-168-add-code-simplifier`
**Created**: 2026-01-21
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Add code simplifier agent and PR code review command to the verify workflow.

- Code simplifier runs before documentation sync to refine recently modified code
- Code review runs after PR creation to provide automated review feedback

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

## Implementation Summary

### Files Created

1. **`.claude/agents/code-simplifier.md`** - Code simplifier agent definition
   - Focuses on recently modified code (git diff main...HEAD)
   - Applies CLAUDE.md and constitution standards
   - Preserves functionality while improving clarity
   - Handles: nested ternaries, redundant assertions, unused imports, complex conditionals

2. **`.claude/commands/code-review.md`** - Code review command definition
   - Performs 5 analysis passes:
     - CLAUDE.md compliance audit
     - Constitution compliance audit
     - Bug detection
     - Git history analysis
     - Code comment compliance
   - Uses confidence scoring (0-100) with threshold of 80
   - Posts results as PR comment via `gh pr comment`

### Files Modified

1. **`.github/workflows/verify.yml`** - Added two new steps:
   - **Phase 4.5: Run Code Simplifier** - Runs before documentation update
     - Invokes code-simplifier agent via Claude
     - Commits changes with `refactor(ticket-X): simplify code for clarity`
   - **Phase 7: Run Code Review** - Runs after PR creation
     - Invokes code-review command via Claude
     - Posts review comment to PR

### Workflow Order

1. Test execution (Phase 1)
2. Failure report generation (Phase 2)
3. Test fixes via /verify (Phase 3)
4. Commit test fixes (Phase 4)
5. **Code simplification (Phase 4.5)** - NEW
6. Documentation update (Phase 5)
7. PR creation (Phase 6)
8. **Code review (Phase 7)** - NEW
9. Job status updates
