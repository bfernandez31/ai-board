---
description: Fast-track implementation for simple tasks based on ticket title and description (bypasses formal spec/plan/tasks)
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Overview

This command implements simple features directly from ticket context without formal specifications. **Use ONLY for**:

- Bug fixes (typos, minor logic fixes)
- UI tweaks (button colors, spacing adjustments)
- Simple refactoring (renaming, file moves)
- Documentation updates

**WARNING**: For complex features or architectural changes, use the full spec-kit workflow (INBOX → SPECIFY → PLAN → BUILD) instead.

## Outline

1. **Create feature branch and minimal spec**:
   - `$ARGUMENTS` contains the full feature description: `#<ticket_id> <ticket_title>\n<ticket_description>`
   - Store the entire content as `FEATURE_DESCRIPTION` (do not parse or extract ticket ID separately)
   - Run `.specify/scripts/bash/create-new-feature.sh --json --mode=quick-impl "$FEATURE_DESCRIPTION"` from repo root
   - Script generates branch name from full feature description (e.g., `#123 Fix login bug` → `032-123-fix-login`)
   - Script creates: branch, specs/<num>-<slug>/ directory, and spec.md with feature description
   - Parse JSON output for BRANCH_NAME and SPEC_FILE (absolute paths)
   - Verify branch was created and spec.md exists

2. **Load ticket context from spec.md**:
   - Read `spec.md` from SPEC_FILE path to extract:
     - Ticket title (from header)
     - Ticket description (from Description section)
     - Any implementation hints or requirements

3. **Validate task simplicity**:
   - **If spec.md indicates complex requirements** (>200 words, multiple entities, API changes):
     - **STOP** and recommend: "This task appears complex. Consider using full workflow: /speckit.specify → /speckit.plan → /speckit.implement"
     - Exit without implementation
   - **If task is simple**: Continue to step 4

4. **Understand project context**:
   - Read project CLAUDE.md for tech stack, conventions, and architecture
   - Identify relevant source files based on ticket description
   - Review existing patterns and code style

5. **Test-Driven Development (TDD) approach**:
   - **ALWAYS write tests first** before implementation if the feature change the behavior
   - Create or update test files based on ticket requirements
   - Follow existing test patterns (Playwright for E2E, Vitest for unit tests)
   - Ensure tests FAIL initially (red phase)

6. **Implement the change**:
   - Make minimal changes to achieve ticket goals
   - Follow existing code patterns and conventions
   - Maintain consistency with project architecture
   - Add inline comments for non-obvious logic

7. **Validate implementation**:
   - Run relevant tests and verify they PASS (green phase)
   - Perform type checking
   - Run linter
   - Fix any type errors or lint warnings

8. **Refactor if needed**:
   - Clean up code for readability (refactor phase)
   - Remove any duplication
   - Ensure code meets project quality standards
   - Re-run tests to ensure changes still pass

9. **Document changes**:
   - Update inline documentation if public APIs changed
   - Add JSDoc comments for new functions
   - Update README.md ONLY if user-facing behavior changed
   - **DO NOT** update specs/specifications documentation (handled by workflow)
   - **DO NOT** update CLAUDE.md (handled by workflow)
   - **DO NOT** create separate feature documentation (this is quick-impl)

10. **Completion checklist**:

- ✓ Tests written and passing
- ✓ Type check passes
- ✓ Linter passes
- ✓ Code follows project conventions
- ✓ No breaking changes to existing functionality
- ✓ Implementation matches ticket requirements
- ✓ Documentation updated (functional & technical specs if behavior changed)

11. **Report completion**:
    - Summarize changes made (files modified, tests added)
    - Confirm all validation checks passed
    - Note any deviations from ticket description

## Important Notes

- **No formal spec generation**: Quick-impl works directly from ticket title + description
- **Minimal planning**: Focus on immediate implementation, not long-term architecture
- **Fast iteration**: Prioritize speed while maintaining quality (tests + type safety)
- **TDD mandatory**: Tests must be written before implementation code if new behavior
- **Simplicity threshold**: If task feels complex during implementation, STOP and recommend full workflow

## Error Handling

- If ticket context is insufficient: Request clarification from user
- If dependencies are missing: Install and document in package.json
- If tests fail: Debug and fix before proceeding
- If type errors occur: Resolve before completion
- If task exceeds simplicity threshold: Abort and recommend /speckit.specify

## Success Criteria

Implementation is complete when:

1. All new/modified tests pass
2. Type checking passes with no errors
3. Linting passes with no warnings
4. Code quality meets project standards
5. Ticket requirements are fully met
6. No regressions in existing functionality
