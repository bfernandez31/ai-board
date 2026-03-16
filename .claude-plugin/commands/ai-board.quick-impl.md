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
   - `$ARGUMENTS` contains a JSON payload with ticket info:
     ```json
     {
       "ticketKey": "ABC-123",    // required: ticket identifier for branch naming
       "title": "...",            // required: ticket title
       "description": "..."       // optional: ticket description
     }
     ```
   - Parse JSON: extract `TICKET_KEY`, `TITLE`, and `DESCRIPTION`
   - Combine `TITLE` and `DESCRIPTION` into `FEATURE_DESCRIPTION` for spec content
   - Run `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/scripts/bash/create-new-feature.sh --json --mode=quick-impl --ticket-key="$TICKET_KEY" "$TITLE"` from repo root
   - Script generates branch name: `{ticketKey}-{3-words}` (e.g., `ABC-123-fix-login-bug`)
   - Script creates: branch, specs/{branch}/ directory, and spec.md with feature description
   - Parse JSON output for BRANCH_NAME and SPEC_FILE (absolute paths)
   - Verify branch was created and spec.md exists

2. **Load ticket context from spec.md**:
   - Read `spec.md` from SPEC_FILE path to extract:
     - Ticket title (from header)
     - Ticket description (from Description section)
     - Any implementation hints or requirements

3. **Understand project context**:
   - Read project CLAUDE.md for tech stack, conventions, and architecture
   - Read `.ai-board/memory/constitution.md` for non-negotiable rules and principles
   - Identify relevant source files based on ticket description
   - Review existing patterns and code style

4. **Test-Driven Development (TDD) approach**:
   - **ALWAYS write tests first** before implementation if the feature changes behavior
   - **Search existing tests FIRST** — extend, don't duplicate
   - Use this decision tree to select test type:
     1. Pure function? → **Unit test** (`tests/unit/`)
     2. React component with interactions? → **Component test** (`tests/unit/components/`)
     3. API endpoint or DB operation? → **Integration test** (`tests/integration/[domain]/`)
     4. REQUIRES browser (OAuth, drag-drop, keyboard nav)? → **E2E** (`tests/e2e/`)
     5. Unsure? → **Integration test** (default)
   - API tests use Vitest, NOT Playwright (10-20x faster)
   - Ensure tests FAIL initially (red phase)

5. **Implement the change**:
   - Make minimal changes to achieve ticket goals
   - Follow existing code patterns and conventions
   - Maintain consistency with project architecture
   - Add inline comments for non-obvious logic

6. **Validate implementation**:
   - Run relevant tests and verify they PASS (green phase)
   - Perform type checking
   - Run linter
   - Fix any type errors or lint warnings

7. **Refactor if needed**:
   - Clean up code for readability (refactor phase)
   - Remove any duplication
   - Ensure code meets project quality standards
   - Re-run tests to ensure changes still pass

8. **Document changes**:
   - Update inline documentation if public APIs changed
   - Add JSDoc comments for new functions
   - Update README.md ONLY if user-facing behavior changed
   - **DO NOT** update specs/specifications documentation (handled by workflow)
   - **DO NOT** update CLAUDE.md (handled by workflow)
   - **DO NOT** create separate feature documentation (this is quick-impl)

9. **Completion checklist**:

- ✓ Tests written and passing
- ✓ Type check passes
- ✓ Linter passes
- ✓ Code follows project conventions
- ✓ No breaking changes to existing functionality
- ✓ Implementation matches ticket requirements
- ✓ Documentation updated (functional & technical specs if behavior changed)

10. **Report completion**:
    - Summarize changes made (files modified, tests added)
    - Confirm all validation checks passed
    - Note any deviations from ticket description

## Important Notes

- **No formal spec generation**: Quick-impl works directly from ticket title + description
- **Minimal planning**: Focus on immediate implementation, not long-term architecture
- **Fast iteration**: Prioritize speed while maintaining quality (tests + type safety)
- **TDD mandatory**: Tests must be written before implementation code if new behavior

## Error Handling

- If ticket context is insufficient: Request clarification from user
- If dependencies are missing: Install and document in package.json
- If tests fail: Debug and fix before proceeding
- If type errors occur: Resolve before completion

## Success Criteria

Implementation is complete when:

1. All new/modified tests pass
2. Type checking passes with no errors
3. Linting passes with no warnings
4. Code quality meets project standards
5. Ticket requirements are fully met
6. No regressions in existing functionality
