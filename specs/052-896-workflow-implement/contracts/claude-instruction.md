# Contract: Claude Code Instruction for Selective Testing

**Purpose**: Define the exact instruction passed to Claude Code during `/speckit.implement` command
**Date**: 2025-10-25
**Target**: Claude Code CLI execution in GitHub Actions workflow

---

## Enhanced Command Instruction

### Full Command

```bash
claude --dangerously-skip-permissions "/speckit.implement IMPORTANT: never prompt me; you must do the full implementation, never run the full test suite, only impacted tests"
```

### Instruction Breakdown

**Base Command**: `/speckit.implement`
- Existing slash command from `.claude/commands/implement.md`
- Triggers implementation workflow based on tasks.md

**Directive 1**: `never prompt me`
- **Purpose**: Ensure 100% autonomous execution
- **Behavior**: Claude must not ask user for clarifications during implementation
- **Rationale**: Workflow runs unattended in GitHub Actions, no user available

**Directive 2**: `you must do the full implementation`
- **Purpose**: Complete all implementation tasks without stopping
- **Behavior**: Implement all features from tasks.md, handle errors autonomously
- **Rationale**: Partial implementations leave feature incomplete

**Directive 3**: `never run the full test suite`
- **Purpose**: Prevent executing `bun run test` (all tests)
- **Behavior**: Claude must not run full Vitest + Playwright test suite
- **Rationale**: Full test suite takes 10+ minutes, violates 50% reduction requirement

**Directive 4**: `only impacted tests`
- **Purpose**: Run selective tests based on code changes
- **Behavior**: Claude identifies and executes only tests affected by implementation
- **Rationale**: Reduces test execution time by 50%+ while maintaining quality

---

## Test Selection Heuristics

### Claude's Decision Framework

Claude must follow these heuristics to identify impacted tests:

#### 1. API Route Changes

**Pattern**: Modifications to `app/api/[resource]/route.ts`

**Test Selection**:
```bash
# Changed file: app/api/tickets/route.ts
# Run: Contract tests for tickets API
bun run test:e2e tests/api/tickets.spec.ts
```

**Rationale**: API contract tests validate endpoint behavior without UI dependencies

---

#### 2. UI Component Changes

**Pattern**: Modifications to `components/[feature]/[component].tsx`

**Test Selection**:
```bash
# Changed file: components/board/board.tsx
# Run: E2E tests that interact with board component
bun run test:e2e tests/e2e/board-drag-drop.spec.ts
```

**Rationale**: E2E tests validate user interactions with modified components

---

#### 3. Utility Function Changes

**Pattern**: Modifications to `lib/[utility].ts`

**Test Selection**:
```bash
# Changed file: lib/utils/date-format.ts
# Run: Unit tests for utility (Vitest)
bun run test:unit tests/unit/date-format.test.ts

# Also run: Integration tests that depend on utility
bun run test:e2e tests/integration/ticket-display.spec.ts
```

**Rationale**: Hybrid testing strategy - unit tests for pure functions, integration tests for usage

---

#### 4. Database Schema Changes

**Pattern**: Modifications to `prisma/schema.prisma` or new migrations

**Test Selection**:
```bash
# Changed file: prisma/schema.prisma
# Run: All database-dependent tests (API + E2E)
bun run test:e2e tests/api/
bun run test:e2e tests/e2e/
```

**Rationale**: Schema changes affect all database interactions, require comprehensive testing

---

#### 5. Hook Changes

**Pattern**: Modifications to `lib/hooks/[hook].ts`

**Test Selection**:
```bash
# Changed file: lib/hooks/useJobPolling.ts
# Run: Unit tests for hook logic
bun run test:unit tests/unit/useJobPolling.test.ts

# Also run: E2E tests for components using hook
bun run test:e2e tests/e2e/real-time/job-polling.spec.ts
```

**Rationale**: Validate hook logic in isolation + integration with components

---

#### 6. State Management Changes

**Pattern**: Modifications to `lib/hooks/queries/` or `lib/hooks/mutations/`

**Test Selection**:
```bash
# Changed file: lib/hooks/mutations/useUpdateTicket.ts
# Run: E2E tests for ticket update workflows
bun run test:e2e tests/e2e/ticket-update.spec.ts
bun run test:e2e tests/api/tickets.spec.ts
```

**Rationale**: TanStack Query mutations require both API and integration testing

---

### Fallback Strategy

**When Uncertain About Test Impact**:

1. **Identify Module**: Determine which top-level directory was modified
   - `app/api/*` → Run all tests in `tests/api/`
   - `components/*` → Run all tests in `tests/e2e/`
   - `lib/*` → Run all tests in `tests/unit/` + affected integration tests

2. **Err on Comprehensive Side**:
   ```bash
   # If unsure which specific E2E tests to run, run all E2E tests for module
   bun run test:e2e tests/e2e/
   ```

3. **Never Skip Critical Tests**:
   - Security-related changes → Run full test suite (exception to selective testing)
   - Authentication changes → Run full test suite
   - Database migration changes → Run full test suite

---

## Command Execution Examples

### Example 1: API Route Implementation

**Feature**: Add PATCH endpoint for ticket priority

**Files Changed**:
- `app/api/projects/[projectId]/tickets/[id]/route.ts` (modified)
- `lib/schemas/ticket.ts` (modified - add priority validation)

**Test Execution**:
```bash
# API contract tests for ticket endpoints
bun run test:e2e tests/api/tickets.spec.ts
```

**Rationale**: API change only affects contract tests, no UI changes

---

### Example 2: UI Component Implementation

**Feature**: Add priority badge to ticket card

**Files Changed**:
- `components/board/ticket-card.tsx` (modified)
- `lib/utils/priority-colors.ts` (new - utility for badge colors)

**Test Execution**:
```bash
# Unit test for priority color utility
bun run test:unit tests/unit/priority-colors.test.ts

# E2E test for ticket card rendering
bun run test:e2e tests/e2e/board-ticket-display.spec.ts
```

**Rationale**: Hybrid testing - unit test for utility, E2E for component integration

---

### Example 3: Database Schema Change

**Feature**: Add `priority` field to Ticket model

**Files Changed**:
- `prisma/schema.prisma` (modified)
- `prisma/migrations/20251025_add_ticket_priority/migration.sql` (new)

**Test Execution**:
```bash
# All database-dependent tests (comprehensive)
bun run test:e2e tests/api/
bun run test:e2e tests/e2e/
```

**Rationale**: Schema changes affect all database interactions, full coverage required

---

### Example 4: Multi-Layer Feature

**Feature**: Add ticket filtering by priority

**Files Changed**:
- `app/api/projects/[projectId]/tickets/route.ts` (modified - add filter param)
- `components/board/filters.tsx` (modified - add priority dropdown)
- `lib/hooks/queries/useTickets.ts` (modified - add filter param)
- `lib/utils/priority-filter.ts` (new - filter logic)

**Test Execution**:
```bash
# Unit test for filter utility
bun run test:unit tests/unit/priority-filter.test.ts

# API contract test for filter parameter
bun run test:e2e tests/api/tickets.spec.ts

# E2E test for filter UI interaction
bun run test:e2e tests/e2e/board-filtering.spec.ts
```

**Rationale**: Multi-layer change requires testing each layer independently

---

## Test Execution Output Requirements

### Expected Log Format

Claude must log which tests are being executed and why:

```
🧪 Test Selection Summary:
   Changed Files:
   - app/api/tickets/route.ts (API route)
   - lib/schemas/ticket.ts (validation schema)

   Selected Tests:
   - tests/api/tickets.spec.ts (API contract tests)

   Rationale: API route changes require contract validation only

🏃 Executing Tests:
   $ bun run test:e2e tests/api/tickets.spec.ts

   ✅ 12 tests passed (1.2s)
```

**Requirements**:
- ✅ List all changed files with file type annotation
- ✅ List all selected test files with test type annotation
- ✅ Explain rationale for test selection
- ✅ Show test execution command
- ✅ Report test results (pass/fail count, duration)

---

## Failure Handling

### Test Failure Response

**If Selective Tests Fail**:
1. **Analyze Failure**: Read test error messages and stack traces
2. **Fix Implementation**: Modify code to resolve test failure
3. **Re-run Failed Tests**: Only re-run the tests that failed (not full suite)
4. **Iterate**: Repeat until tests pass

**If Unable to Fix**:
- Claude must commit partial implementation with clear TODO comments
- Claude must report failure in commit message
- Workflow status set to FAILED (via job status API)

**Never Prompt User**: Even on test failure, Claude must handle autonomously

---

## Success Criteria

### Instruction Effectiveness Metrics

**Quantitative**:
- ✅ Test execution time reduced by 50%+ vs full test suite
- ✅ 100% of implementation runs complete without prompting user
- ✅ 80%+ of runs execute only selective tests (not full suite)

**Qualitative**:
- ✅ Test selection rationale is clear and traceable in logs
- ✅ Selected tests provide adequate coverage for changes
- ✅ No critical regressions escape selective testing

---

## Edge Cases

### No Existing Tests for Changed Code

**Scenario**: Implement new feature in `lib/utils/new-feature.ts`, no tests exist

**Claude Behavior**:
1. **Create Tests First** (TDD): Write unit tests for new utility
   ```bash
   # New file: tests/unit/new-feature.test.ts
   bun run test:unit tests/unit/new-feature.test.ts
   ```

2. **Implement Feature**: Write code to make tests pass

3. **Run Tests**: Execute new tests to validate implementation

**Rationale**: TDD workflow ensures new code has test coverage

---

### Refactoring Without Behavior Change

**Scenario**: Refactor `lib/utils/date-format.ts` (rename variables, improve readability)

**Claude Behavior**:
```bash
# Run existing tests for refactored utility
bun run test:unit tests/unit/date-format.test.ts
```

**Rationale**: Refactoring should not change behavior, existing tests validate correctness

---

### Dependency Update

**Scenario**: Update `@playwright/test` version in package.json

**Claude Behavior**:
```bash
# Run subset of E2E tests to validate Playwright still works
bun run test:e2e tests/e2e/smoke-test.spec.ts
```

**Rationale**: Dependency updates may affect test framework, smoke tests validate compatibility

---

## Contract Compliance

### Validation Checklist

**Before Implementation**:
- ✅ Read instruction from workflow input
- ✅ Understand all four directives
- ✅ Review test selection heuristics

**During Implementation**:
- ✅ Track all modified files
- ✅ Identify test impact for each file
- ✅ Build test selection plan

**After Implementation**:
- ✅ Execute selected tests only
- ✅ Log test selection rationale
- ✅ Report results in commit message
- ✅ Never prompt user for clarifications

---

**Contract Version**: 1.0
**Compatibility**: Claude Code CLI, GitHub Actions workflow
**Breaking Changes**: ❌ None (additive enhancement to existing command)
