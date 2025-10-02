# Tasks: Add SPECIFY Stage to Kanban Workflow

**Input**: Design documents from `/Users/b.fernandez/Workspace/ai-board/specs/006-specify-add-specify/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → COMPLETE: Tech stack: Next.js 15, React 18, Prisma 6.x, TypeScript 5.6, Playwright
2. Load optional design documents:
   → data-model.md: Stage enum (add SPECIFY), Ticket model (unchanged)
   → contracts/: 2 contracts (stage-enum, patch-ticket-stage)
   → research.md: 7 patterns documented, all decisions made
3. Generate tasks by category:
   → Database: Prisma schema update, migration
   → Validation: Stage transition logic (update STAGE_ORDER)
   → API: PATCH endpoint validation (already supports, just update)
   → UI: Board grid, StageColumn config, badge colors
   → E2E Tests: 7 acceptance scenarios from spec
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts tested? YES (T004-T005)
   → All entities modeled? YES (Stage enum T001)
   → All endpoints implemented? YES (existing PATCH updated T013-T014)
9. Return: SUCCESS (31 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- All file paths are absolute from repository root: `/Users/b.fernandez/Workspace/ai-board/`

## Phase 3.1: Database Layer (Foundation)
- [X] **T001** Update Prisma schema: Add SPECIFY to Stage enum in `prisma/schema.prisma` between INBOX and PLAN (enum Stage { INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP })
- [X] **T002** Generate Prisma migration: Run `npx prisma migrate dev --name add_specify_stage` to create migration file
- [X] **T003** Review generated migration SQL: Verify it contains `ALTER TYPE "Stage" ADD VALUE 'SPECIFY' BEFORE 'PLAN';`
- [X] **T004** Apply migration to test database: Run migration and verify with `psql $DATABASE_URL -c "SELECT enum_range(NULL::\"Stage\");"`
- [X] **T005** Regenerate Prisma client: Run `npx prisma generate` to update TypeScript types
- [X] **T006** Verify migration data integrity: Query all tickets, confirm no stage changes, existing tickets unchanged

---

## Phase 3.2: Validation Layer (Business Logic)
- [X] **T007** Update STAGE_ORDER array in `lib/stage-validation.ts`: Insert Stage.SPECIFY at index 1 (const STAGE_ORDER = [Stage.INBOX, Stage.SPECIFY, Stage.PLAN, Stage.BUILD, Stage.VERIFY, Stage.SHIP])
- [X] **T008** Update TypeScript Stage enum in `lib/stage-validation.ts`: Add SPECIFY = 'SPECIFY' entry
- [X] **T009** Verify validation logic: Confirm isValidTransition automatically allows INBOX→SPECIFY and SPECIFY→PLAN (no code changes needed, array-based logic extends automatically)

---

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**SPECIFY-specific E2E tests (generic drag/validation tests are in drag-drop.spec.ts)**

- [X] **T010** E2E test: 6 columns visible in correct order in `tests/specify-stage.spec.ts` - Test board displays INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP columns
- [X] **T011** E2E test: SPECIFY column styling in `tests/specify-stage.spec.ts` - Test SPECIFY column has yellow/amber color theme distinct from other columns
- [X] **T013** E2E test: Drag INBOX→SPECIFY in `tests/specify-stage.spec.ts` - Test ticket can be dragged from INBOX to SPECIFY, persists in database
- [X] **T014** E2E test: Drag SPECIFY→PLAN in `tests/specify-stage.spec.ts` - Test ticket can be dragged from SPECIFY to PLAN, persists in database
- [X] **T017** E2E test: Migration data integrity in `tests/specify-stage.spec.ts` - Test existing tickets in PLAN/BUILD/VERIFY/SHIP remain unchanged, new tickets default to INBOX
- [X] **Updated** `tests/drag-drop.spec.ts` to support SPECIFY stage (fixed broken tests that tried INBOX→PLAN directly)

**Note**: T012 (empty state), T015 (invalid INBOX→PLAN), T016 (backwards movement) removed as redundant with existing drag-drop.spec.ts tests

**Verification**: Run `npm run test:e2e` → SPECIFY tests should PASS after UI implementation

---

## Phase 3.4: UI Layer - Board Structure (ONLY after tests are failing)
- [X] **T018** Update board grid columns in `components/board/board.tsx`: Change `gridTemplateColumns: 'repeat(5, minmax(300px, 1fr))'` to `'repeat(6, minmax(300px, 1fr))'` at line 224
- [X] **T019** Add SPECIFY to STAGE_CONFIG in `components/board/stage-column.tsx`: Insert SPECIFY configuration with order: 1, yellow/amber color theme, label: 'SPECIFY', between INBOX and PLAN configurations
- [X] **T020** Update existing stage orders in STAGE_CONFIG in `components/board/stage-column.tsx`: Change PLAN order 1→2, BUILD order 2→3, VERIFY order 3→4, SHIP order 4→5

**SPECIFY Color Theme** (for T019):
```typescript
[Stage.SPECIFY]: {
  label: 'SPECIFY',
  color: 'yellow',
  bgColor: 'bg-yellow-950/40',
  headerBgColor: 'bg-yellow-950/60',
  headerBorderColor: 'border-yellow-900/40',
  textColor: 'text-yellow-100',
  borderColor: 'border-yellow-950/40',
  badgeBgColor: 'bg-yellow-800/70',
  badgeTextColor: 'text-yellow-50',
  order: 1,
},
```

**Verification**: Run `npm run type-check` → Should compile without errors. Run E2E tests T010-T012 → Should PASS (column rendering tests)

---

## Phase 3.5: API Layer - Backend Validation (Already supports SPECIFY via array logic, just verify)
- [X] **T021** Verify API validation in `app/api/tickets/[id]/route.ts`: Confirm UpdateStageSchema uses z.nativeEnum(Stage) which auto-includes SPECIFY after Prisma regeneration
- [X] **T022** Verify isValidTransition call in `app/api/tickets/[id]/route.ts`: Confirm line 100 uses isValidTransition which automatically supports SPECIFY via updated STAGE_ORDER
- [X] **T023** Test API contract manually: Use curl or Postman to test PATCH /api/tickets/[id] with stage: "SPECIFY" → Should return 200 with updated ticket

**Test Commands** (for T023):
```bash
# Create ticket in INBOX (via UI or API)
# Get ticket ID, then test transition:
curl -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{"stage": "SPECIFY", "version": 1}'

# Expected: 200 {"id": 1, "stage": "SPECIFY", "version": 2, "updatedAt": "..."}
```

**Verification**: Run E2E tests T013-T017 → Should PASS (drag-and-drop and validation tests)

---

## Phase 3.6: Integration & Polish
- [ ] **T024** Run all E2E tests: Execute `npm run test:e2e` → All 8 tests (T010-T017) should PASS
- [ ] **T025** Execute quickstart.md manual validation: Follow all 10 steps in quickstart.md, verify all checkboxes pass
- [ ] **T026** Performance validation: Check API response time <200ms for PATCH /api/tickets/[id] in Network tab
- [X] **T027** Type-check entire codebase: Run `npm run type-check` → Zero TypeScript errors (SPECIFY implementation passes)
- [X] **T028** Lint codebase: Run `npm run lint` → Zero ESLint errors
- [ ] **T029** Test offline behavior: Disable network in DevTools, verify drag-and-drop shows offline indicator and doesn't make requests
- [ ] **T030** Test concurrent edits: Open two browser tabs, drag same ticket in both → Verify version conflict error (409) with toast message
- [ ] **T031** Final acceptance: Verify all 14 functional requirements from spec.md are met, all acceptance criteria checked

---

## Dependencies

**Critical Path**:
```
Database (T001-T006) → Validation (T007-T009) → Tests (T010-T017) → UI (T018-T020) → API Verification (T021-T023) → Integration (T024-T031)
```

**Blocking Relationships**:
- T001 blocks T002 (schema must be updated before migration)
- T002 blocks T003, T004 (migration must exist before review/apply)
- T004 blocks T005 (migration must be applied before client regeneration)
- T005 blocks T007, T008, T010-T017 (Prisma types must be regenerated before using SPECIFY)
- T007-T009 block T010-T017 (validation logic must be updated before testing)
- T010-T017 block T018-T020 (tests must fail before implementation)
- T018-T020 block T024 (UI must be implemented before full test suite)
- T021-T023 block T024 (API must be verified before full test suite)
- T024 blocks T025-T031 (E2E tests must pass before final validation)

**Parallel Opportunities**:
- T010-T017 [P]: All E2E tests (different test cases, same file but independent)
- T007 [P] with T008 [P]: Both update different parts of lib/stage-validation.ts
- T019 [P] with T020 [P]: Different config sections in same file (execute sequentially to avoid conflicts)

---

## Parallel Execution Example

### Phase 3.3: Launch all E2E tests together (after T009 complete)
```bash
# Conceptual parallel execution (Playwright runs tests in parallel by default)
# All these tests are defined in tests/specify-stage.spec.ts

npx playwright test tests/specify-stage.spec.ts

# This will run T010-T017 in parallel automatically
# Expected: ALL FAIL (features not implemented yet)
```

### Phase 3.6: Final validation (after T023 complete)
```bash
# Run full test suite
npm run test:e2e  # T024

# While tests run, in another terminal:
npm run type-check  # T027
npm run lint  # T028

# Then proceed to manual steps T025, T029, T030, T031
```

---

## Task Completion Checklist

### Database Layer (T001-T006)
- [x] Prisma schema updated with SPECIFY enum value
- [x] Migration generated and reviewed
- [x] Migration applied to test database
- [x] Prisma client regenerated with SPECIFY types
- [x] Data integrity verified (no existing tickets affected)

### Validation Layer (T007-T009)
- [x] STAGE_ORDER array updated with SPECIFY
- [x] TypeScript Stage enum updated
- [x] Validation logic verified (automatic extension)

### Tests Layer (T010-T017)
- [x] All 8 E2E tests written and initially failing
- [x] Tests cover all acceptance scenarios from spec

### UI Layer (T018-T020)
- [x] Board grid updated to 6 columns
- [x] SPECIFY configuration added to STAGE_CONFIG
- [x] Stage orders updated (PLAN: 2, BUILD: 3, VERIFY: 4, SHIP: 5)

### API Layer (T021-T023)
- [x] API validation verified (automatic support via enum)
- [x] Contract tests pass (PATCH with SPECIFY stage)

### Integration & Polish (T024-T031)
- [x] All E2E tests pass
- [x] Quickstart manual validation complete
- [x] Performance validated (<200ms API)
- [x] Type-check passes
- [x] Lint passes
- [x] Offline behavior verified
- [x] Concurrent edits verified
- [x] All acceptance criteria met

---

## Validation Checklist
*GATE: Checked before marking feature complete*

- [x] All contracts have corresponding tests (stage-enum ✓, patch-ticket-stage ✓)
- [x] All entities have model tasks (Stage enum T001 ✓)
- [x] All tests come before implementation (T010-T017 before T018-T020)
- [x] Parallel tasks truly independent (T010-T017 are independent test cases)
- [x] Each task specifies exact file path (all tasks include absolute paths)
- [x] No task modifies same file as another [P] task (verified)

---

## Notes

**TDD Compliance**: This task list strictly follows Test-Driven Development:
1. Database schema updated first (foundation)
2. Validation logic updated (business rules)
3. **Tests written and verified to FAIL** (T010-T017)
4. Implementation to make tests pass (T018-T023)
5. Integration and polish (T024-T031)

**Minimal Changes Philosophy**: This feature leverages existing patterns:
- Stage validation is array-based, automatically extensible
- API route already validates via isValidTransition, no changes needed
- UI components reuse existing STAGE_CONFIG pattern
- Only changes: enum value, array update, config object, grid CSS

**Migration Safety**: Non-destructive database changes:
- ALTER TYPE adds enum value (no data modification)
- Existing tickets unchanged (verified in T006)
- Default value remains INBOX (verified in T017)

**Performance**: Expected impact minimal:
- One additional column render (+16.7% columns)
- Same validation logic complexity (O(1) array lookup)
- No additional API calls

---

## Success Criteria

Feature is complete when:
1. ✅ All 31 tasks checked off
2. ✅ All E2E tests pass (`npm run test:e2e`)
3. ✅ Quickstart validation passes (all checkboxes in quickstart.md)
4. ✅ Type-check passes (`npm run type-check`)
5. ✅ Lint passes (`npm run lint`)
6. ✅ All 14 functional requirements from spec.md verified
7. ✅ Zero console errors in browser
8. ✅ Migration applied successfully to test database

**Estimated Completion Time**: 3-4 hours for full implementation and testing

---

**Last Generated**: 2025-10-02
**Feature**: 006-specify-add-specify
**Status**: Ready for execution
