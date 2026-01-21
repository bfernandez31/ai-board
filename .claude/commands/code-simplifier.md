---
command: '/code-simplify'
category: 'Code Quality'
purpose: 'Automated code simplification maintaining functionality'
wave-enabled: false
performance-profile: 'complex'
---

# /code-simplify - Code Simplification Command

Automatically refine recently modified code for clarity, consistency, and maintainability.

## Overview

This command analyzes files changed on the feature branch and applies simplification patterns to improve code readability without altering functionality.

## Execution Phases

### Phase 1: Discovery

**Identify files changed on the feature branch**:

```bash
# Get TypeScript/JavaScript files changed vs main
git diff --name-only main...HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx'
```

**Scope limitations**:
- Only process files modified on the current feature branch
- Focus on TypeScript/JavaScript source files
- Skip test files, generated files, and configuration

### Phase 2: Analysis

**For each modified file, identify simplification opportunities**:

**Simplification Patterns** (from contract):

1. **NESTED_TERNARY** - Flatten nested ternary operators
   ```typescript
   // Before
   const result = a ? (b ? 'x' : 'y') : 'z';

   // After
   if (a && b) return 'x';
   if (a) return 'y';
   return 'z';
   ```

2. **REDUNDANT_ABSTRACTION** - Remove single-use abstractions
   ```typescript
   // Before
   function getUser(id: string) { return fetchUser(id); }

   // After (direct call where used)
   fetchUser(id);
   ```

3. **VERBOSE_CONDITIONAL** - Simplify boolean expressions
   ```typescript
   // Before
   if (value === true) { return true; } else { return false; }

   // After
   return value === true;
   ```

4. **COMPLEX_EXPRESSION** - Extract complex expressions to named constants
   ```typescript
   // Before
   if (user.role === 'admin' && user.status === 'active' && user.permissions.includes('write')) {}

   // After
   const canWrite = user.role === 'admin' && user.status === 'active' && user.permissions.includes('write');
   if (canWrite) {}
   ```

5. **DEAD_CODE** - Remove unreachable code
   - Code after unconditional return/throw
   - Conditions that are always true/false
   - Unused variables and imports

6. **DUPLICATE_LOGIC** - Consolidate repeated patterns
   - Extract repeated code into functions
   - Use common abstractions for similar patterns

### Phase 3: Implementation

**Apply changes using the Edit tool**:

1. **Read the file** to understand full context
2. **Identify specific simplification** to apply
3. **Apply change via Edit tool** with precise old_string/new_string
4. **Verify change** is syntactically correct

**Constraints** (MUST follow):
- MUST NOT change public API signatures (function names, parameters, return types)
- MUST NOT change exported interfaces or types
- MUST NOT modify test behavior or test assertions
- MUST NOT modify files outside git diff scope
- MUST preserve all comments and documentation
- MUST follow CLAUDE.md coding conventions
- MUST NOT introduce any new `any` types

### Phase 4: Validation

**Run affected tests to verify functionality preserved**:

```bash
# Run only tests that cover modified files
bun run test:unit --testPathPattern="[modified-file-name]"
```

**Quality gates**:
- All modified tests must pass
- No TypeScript errors introduced (implicit via bun run)
- No lint errors introduced

**If tests fail after simplification**:
1. Revert the problematic change
2. Log which simplification caused the failure
3. Continue with other simplifications

### Phase 5: Commit

**If changes were made**:

```bash
# Stage simplified files
git add [modified-files]

# Check if there are changes to commit
if ! git diff --staged --quiet; then
  git commit -m "refactor(ticket-${TICKET_ID}): simplify code for clarity"
  echo "Committed code simplifications"
else
  echo "No simplifications needed"
fi
```

## Context Loading

**Load coding standards**:
- CLAUDE.md (project root) - Project coding conventions
- .specify/memory/constitution.md - Non-negotiable rules

**Do NOT load**:
- Test result files
- Generated files
- Package dependencies

## Constraints

**CRITICAL - Do NOT**:
- Change public API signatures
- Modify test behavior
- Touch files not in git diff
- Remove meaningful comments
- Introduce `any` types
- Make changes that could break consumers

**ALWAYS**:
- Preserve functionality exactly
- Run affected tests after changes
- Follow existing code patterns
- Keep changes minimal and focused

## Error Handling

**If simplification causes test failure**:
1. Revert the specific change
2. Log: "Simplification [pattern] in [file] caused test failure, reverted"
3. Continue with remaining files

**If no simplifications found**:
1. Log: "No simplification opportunities found in modified files"
2. Exit successfully (no changes to commit)

## Performance

- Process files in parallel when possible (no dependencies)
- Run tests incrementally (only affected tests)
- Timeout: 10 minutes total

## Example Workflow

```
User: /code-simplify

Phase 1: Discovery
   Found 5 modified files: src/api/tickets.ts, src/components/Board.tsx, ...

Phase 2: Analysis
   src/api/tickets.ts: 2 VERBOSE_CONDITIONAL, 1 COMPLEX_EXPRESSION
   src/components/Board.tsx: 1 NESTED_TERNARY

Phase 3: Implementation
   Applying simplifications...
   - src/api/tickets.ts:42 - Simplified verbose conditional
   - src/api/tickets.ts:78 - Simplified verbose conditional
   - src/api/tickets.ts:105 - Extracted complex expression
   - src/components/Board.tsx:23 - Flattened nested ternary

Phase 4: Validation
   Running affected tests...
   All tests pass

Phase 5: Commit
   Committed: "refactor(ticket-AIB-167): simplify code for clarity"

Done. 4 simplifications applied across 2 files.
```
