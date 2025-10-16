# Implementation Tasks: Add Workflow Type Field

**Feature**: 032-add-workflow-type | **Branch**: `032-add-workflow-type` | **Created**: 2025-01-16

## Task Overview

**Total Tasks**: 18 | **P1**: 11 | **P2**: 3 | **P3**: 4

**Implementation Approach**: Test-Driven Development (TDD)
- Write tests first (extend existing test files)
- Implement minimum code to pass tests
- Verify all tests pass before moving to next task

**Dependency Order**:
1. Phase 1: Setup & Database Foundation (tasks T001-T003)
2. Phase 2: Type System & Backend Logic (tasks T004-T007)
3. Phase 3: Frontend Display (tasks T008-T010)
4. Phase 4: Testing & Validation (tasks T011-T016)
5. Phase 5: Polish & Documentation (tasks T017-T018)

---

## Phase 1: Setup & Database Foundation

**Goal**: Establish database schema and migration infrastructure

### Setup Tasks

- [ ] **[T001]** [P1] Verify development environment ready
  - Check Node.js 22.20.0 LTS installed
  - Check PostgreSQL 14+ running
  - Check Prisma CLI available (`npx prisma --version`)
  - Verify test database accessible
  - **Files**: N/A (environment check)
  - **Estimate**: 5 minutes
  - **Dependencies**: None

### Database Schema Tasks

- [X] **[T002]** [P1] [US3] Create Prisma migration for WorkflowType enum and Ticket.workflowType field
  - Add `enum WorkflowType { FULL QUICK }` to `prisma/schema.prisma`
  - Add `workflowType WorkflowType @default(FULL)` field to Ticket model
  - Add index `@@index([projectId, workflowType])` to Ticket model
  - Run `npx prisma migrate dev --name add_workflow_type`
  - Verify migration SQL creates enum, column, index correctly
  - **Files**: `prisma/schema.prisma`, `prisma/migrations/[timestamp]_add_workflow_type/migration.sql`
  - **Estimate**: 15 minutes
  - **Dependencies**: T001
  - **Success Criteria**: Migration runs without errors, all existing tickets have workflowType=FULL

- [X] **[T003]** [P2] [US3] Verify migration idempotency and rollback safety
  - Run migration again to verify no duplicate errors
  - Test rollback script (drop column, drop enum)
  - Re-run migration to verify recovery
  - **Files**: `prisma/migrations/[timestamp]_add_workflow_type/migration.sql`
  - **Estimate**: 10 minutes
  - **Dependencies**: T002
  - **Success Criteria**: Migration can be applied multiple times safely

---

## Phase 2: Type System & Backend Logic

**Goal**: Extend TypeScript types and implement atomic transaction logic

### Type Definition Tasks

- [X] **[T004]** [P1] [US1] Extend TicketWithVersion interface to include workflowType field
  - Import `WorkflowType` from `@prisma/client` in `lib/types.ts`
  - Add `workflowType: WorkflowType` field to TicketWithVersion interface
  - Export WorkflowType type: `export type { Stage, WorkflowType }`
  - Run `npx tsc --noEmit` to verify type correctness
  - **Files**: `lib/types.ts`
  - **Estimate**: 5 minutes
  - **Dependencies**: T002 (Prisma schema must generate WorkflowType type)
  - **Success Criteria**: TypeScript compilation succeeds, WorkflowType accessible

### Backend Logic Tasks

- [X] **[T005]** [P1] [US2] Update lib/workflows/transition.ts to set workflowType=QUICK in atomic transaction
  - Locate Job creation logic (around line 217)
  - Wrap Job creation in conditional transaction:
    - If `isQuickImpl === true`: Use `prisma.$transaction([jobCreate, ticketUpdate])`
    - Else: Use existing Job creation (no transaction)
  - Set `data: { workflowType: 'QUICK' }` in ticket update
  - **Files**: `lib/workflows/transition.ts`
  - **Estimate**: 20 minutes
  - **Dependencies**: T002, T004
  - **Success Criteria**: Quick-impl tickets atomically set workflowType=QUICK with Job creation

- [ ] **[T006]** [P1] [US2] Write API tests for workflowType setting during transitions
  - Extend `tests/api/ticket-transition.spec.ts` with 3 new tests:
    1. `INBOX → BUILD sets workflowType to QUICK`
    2. `INBOX → SPECIFY preserves workflowType FULL`
    3. `workflowType immutable after setting to QUICK`
  - Use existing `createTicket()` helper from `tests/helpers/db-setup.ts`
  - Verify database state after transition via Prisma query
  - **Files**: `tests/api/ticket-transition.spec.ts`
  - **Estimate**: 30 minutes
  - **Dependencies**: T005 (backend logic must exist to test)
  - **Success Criteria**: All 3 tests pass, coverage ≥80% for transition logic

- [X] **[T007]** [P1] [US1] Update board query to include workflowType field
  - Edit `app/projects/[id]/board/page.tsx`
  - Add `workflowType: true` to Prisma select clause in ticket query (around line 50-80)
  - Verify query returns workflowType in ticket objects
  - **Files**: `app/projects/[id]/board/page.tsx`
  - **Estimate**: 5 minutes
  - **Dependencies**: T004 (types must include workflowType)
  - **Success Criteria**: Board data includes workflowType for all tickets

---

## Phase 3: Frontend Display

**Goal**: Render ⚡ Quick badge on ticket cards conditionally

### UI Component Tasks

- [X] **[T008]** [P1] [US1] Add conditional badge rendering to TicketCard component
  - Import Badge component and WorkflowType in `components/board/ticket-card.tsx`
  - Add conditional rendering: `{ticket.workflowType === 'QUICK' && <Badge>⚡ Quick</Badge>}`
  - Apply amber styling: `bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200`
  - Place badge next to ticket title in card header
  - Add `gap-2` and `truncate` classes to title container for spacing
  - **Files**: `components/board/ticket-card.tsx`
  - **Estimate**: 15 minutes
  - **Dependencies**: T007 (board query must provide workflowType)
  - **Success Criteria**: Badge renders when workflowType=QUICK, not when FULL

- [ ] **[T009]** [P1] [US1] Write E2E tests for badge visibility
  - Extend `tests/e2e/quick-impl-visual-feedback.spec.ts` with 3 new tests:
    1. `shows ⚡ Quick badge for quick-impl tickets`
    2. `does NOT show badge for full workflow tickets`
    3. `badge persists through stage transitions`
  - Create test tickets with explicit `workflowType: 'QUICK'` in Prisma
  - Use Playwright locators to find badge element
  - Verify badge styling includes `bg-amber-100` class
  - **Files**: `tests/e2e/quick-impl-visual-feedback.spec.ts`
  - **Estimate**: 30 minutes
  - **Dependencies**: T008 (badge component must be implemented)
  - **Success Criteria**: All 3 E2E tests pass, badge visible in browser

- [ ] **[T010]** [P3] [US4] Verify badge contrast in light and dark themes
  - Toggle theme in browser (if theme switcher exists)
  - Verify badge text is readable in both themes
  - Check contrast ratio using browser DevTools (target: ≥4.5:1 for WCAG AA)
  - Adjust amber colors if contrast insufficient
  - **Files**: `components/board/ticket-card.tsx` (if adjustments needed)
  - **Estimate**: 10 minutes
  - **Dependencies**: T008
  - **Success Criteria**: Badge meets WCAG AA contrast ratio in both themes

---

## Phase 4: Testing & Validation

**Goal**: Comprehensive test coverage and quality assurance

### Test Extension Tasks

- [ ] **[T011]** [P1] Run full test suite and fix any regressions
  - Run `npm test` to execute all tests (API, E2E, unit)
  - Identify any failing tests caused by TicketWithVersion interface changes
  - Fix test data setup to include workflowType field where needed
  - **Files**: Various test files if regressions found
  - **Estimate**: 20 minutes
  - **Dependencies**: T006, T009
  - **Success Criteria**: All existing tests pass, no regressions introduced

- [ ] **[T012]** [P2] Add transaction rollback test for error scenarios
  - Extend `tests/api/ticket-transition.spec.ts`
  - Test case: Simulate GitHub workflow dispatch failure after DB transaction
  - Verify workflowType NOT set if Job creation fails
  - Mock GitHub API error response
  - **Files**: `tests/api/ticket-transition.spec.ts`
  - **Estimate**: 20 minutes
  - **Dependencies**: T006
  - **Success Criteria**: Transaction rollback prevents partial updates

### Validation Tasks

- [X] **[T013]** [P1] Run TypeScript type check and linter
  - Execute `npx tsc --noEmit` to verify no type errors
  - Execute `npm run lint` to verify code quality
  - Fix any linter warnings or errors
  - **Files**: N/A (validation only)
  - **Estimate**: 5 minutes
  - **Dependencies**: T005, T008 (all code changes complete)
  - **Success Criteria**: Zero TypeScript errors, zero linter errors

- [X] **[T014]** [P1] Verify Prisma client generation and types
  - Run `npx prisma generate` to regenerate Prisma client
  - Verify WorkflowType enum exported correctly
  - Check Ticket model includes workflowType field in generated types
  - **Files**: N/A (validation only)
  - **Estimate**: 5 minutes
  - **Dependencies**: T002
  - **Success Criteria**: Prisma client types match schema definition

### Manual Testing Tasks

- [ ] **[T015]** [P2] Manual test: Create quick-impl ticket and verify badge
  - Start dev server: `npm run dev`
  - Navigate to project board: `http://localhost:3000/projects/3/board`
  - Create new ticket in INBOX
  - Drag ticket to BUILD column (quick-impl path)
  - Confirm quick-impl modal
  - Wait for workflow completion
  - **Verify**: ⚡ Quick badge appears on ticket card
  - Move ticket to VERIFY, then SHIP
  - **Verify**: Badge persists through transitions
  - **Files**: N/A (manual testing)
  - **Estimate**: 10 minutes
  - **Dependencies**: T008, T005
  - **Success Criteria**: Badge visible and persistent in dev environment

- [ ] **[T016]** [P2] Manual test: Create full workflow ticket and verify NO badge
  - Create new ticket in INBOX
  - Drag ticket to SPECIFY column (normal workflow)
  - Move through PLAN → BUILD
  - **Verify**: NO badge appears (workflowType=FULL)
  - Check database via Prisma Studio: `npx prisma studio`
  - **Verify**: Ticket has workflowType=FULL
  - **Files**: N/A (manual testing)
  - **Estimate**: 10 minutes
  - **Dependencies**: T008
  - **Success Criteria**: Badge NOT visible for full workflow tickets

---

## Phase 5: Polish & Documentation

**Goal**: Finalize implementation and update documentation

### Data Migration Tasks

- [ ] **[T017]** [P2] [US3] Manually update 2 existing quick-impl tickets in database
  - Identify 2 existing tickets with `Job.command='quick-impl'`
  - Use SQL or Prisma Studio to update their workflowType to QUICK:
    ```sql
    UPDATE "Ticket"
    SET "workflowType" = 'QUICK'
    WHERE id IN (12, 45);  -- Replace with actual IDs
    ```
  - Verify badge appears for these tickets in dev environment
  - **Files**: N/A (database operation)
  - **Estimate**: 5 minutes
  - **Dependencies**: T008 (badge rendering must work)
  - **Success Criteria**: 2 existing quick-impl tickets show badge

### Documentation Tasks

- [X] **[T018]** [P3] Update CLAUDE.md with WorkflowType field notes
  - Add WorkflowType enum to "Active Technologies" section
  - Document workflowType field in "Data Model Notes" → "Ticket Model"
  - Note badge rendering pattern in UI conventions (if section exists)
  - **Files**: `CLAUDE.md`
  - **Estimate**: 10 minutes
  - **Dependencies**: T017 (all implementation complete)
  - **Success Criteria**: CLAUDE.md accurately reflects new field and behavior

---

## Task Dependency Graph

```
T001 (env setup)
  ↓
T002 (migration) ──→ T003 (migration safety)
  ↓
T004 (types) ──────→ T005 (backend logic) ──→ T006 (API tests)
  ↓                     ↓
T007 (board query)      ↓
  ↓                     ↓
T008 (badge UI) ────────┘
  ↓
T009 (E2E tests) ──→ T010 (theme contrast)
  ↓
T011 (test suite) ──→ T012 (rollback test)
  ↓
T013 (lint) ──→ T014 (Prisma types)
  ↓
T015 (manual quick-impl) ──→ T016 (manual full workflow)
  ↓
T017 (update 2 tickets)
  ↓
T018 (documentation)
```

---

## Completion Checklist

**Phase 1 Complete** (Tasks T001-T003):
- [ ] Migration runs without errors
- [ ] All existing tickets have workflowType=FULL
- [ ] Migration is idempotent and rollback-safe

**Phase 2 Complete** (Tasks T004-T007):
- [ ] TicketWithVersion includes workflowType field
- [ ] Quick-impl transactions set workflowType=QUICK atomically
- [ ] API tests verify workflowType behavior
- [ ] Board query returns workflowType

**Phase 3 Complete** (Tasks T008-T010):
- [ ] Badge renders conditionally on ticket cards
- [ ] E2E tests verify badge visibility
- [ ] Badge meets WCAG AA contrast in both themes

**Phase 4 Complete** (Tasks T011-T016):
- [ ] All tests pass (no regressions)
- [ ] Transaction rollback test passes
- [ ] TypeScript and linter checks pass
- [ ] Prisma client generates correctly
- [ ] Manual testing confirms badge works in dev

**Phase 5 Complete** (Tasks T017-T018):
- [ ] 2 existing tickets updated manually
- [ ] CLAUDE.md documentation updated

**Feature Complete**:
- [ ] All 18 tasks completed
- [ ] All success criteria from spec.md met
- [ ] Ready for PR review and staging deployment

---

## Implementation Notes

### Testing Philosophy
- **TDD Approach**: Write tests (T006, T009) before implementing features (T005, T008)
- **Existing Test Extension**: Extend `ticket-transition.spec.ts` and `quick-impl-visual-feedback.spec.ts` (DO NOT create new test files)
- **Test Data Pattern**: Use `[e2e]` prefix for test tickets, reuse helpers from `tests/helpers/`

### Database Safety
- **Migration**: Use Prisma migrations (T002), not manual SQL
- **Default Value**: FULL ensures backward compatibility
- **Manual Updates**: Only 2 tickets (T017), acceptable one-time operation

### Code Quality
- **TypeScript Strict**: All new code follows strict mode (T013)
- **Existing Patterns**: Reuse shadcn/ui Badge component (T008)
- **Atomic Operations**: Transaction ensures consistency (T005)

### Performance Targets
- Badge render: <100ms (verify in T015)
- Migration: <5s for 100 tickets (verify in T002)
- Atomic transaction: <50ms (verify in T006)

---

## Risk Mitigation

| Risk | Task | Mitigation Strategy |
|------|------|---------------------|
| Migration breaks tickets | T002 | Default value FULL, test on staging first |
| Transaction overhead | T005 | Single field update (~1ms), acceptable |
| Badge layout issues | T008 | Use existing Badge component (responsive) |
| Test regressions | T011 | Comprehensive test suite run, fix systematically |
| Manual update failure | T017 | Only 2 tickets, SQL script provided for safety |

---

## Next Steps After Task Completion

1. **Code Review**: Submit PR for team review
2. **Staging Deployment**: Test migration on staging database
3. **Production Deployment**:
   - Run migration: `npx prisma migrate deploy`
   - Deploy application code
   - Manually update 2 existing tickets
4. **Monitoring**: Watch for errors in first 24 hours
5. **Future Enhancements**: Consider board filtering by workflow type (out of scope for this feature)
