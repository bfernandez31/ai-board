# Implementation Plan: Add Workflow Type Field

**Branch**: `032-add-workflow-type` | **Date**: 2025-01-16 | **Spec**: [spec.md](./spec.md)

## Summary

Add a `workflowType` enum field to the Ticket model to permanently track whether tickets were created via quick-implementation (INBOX → BUILD) or full workflow (INBOX → SPECIFY → PLAN → BUILD). Display a ⚡ Quick badge on ticket cards for quick-impl tickets. This field is immutable after initial BUILD transition and persists through all subsequent stage changes, rollbacks, and retries.

**Technical Approach**: Prisma migration adds WorkflowType enum and Ticket.workflowType field with FULL default. Backend uses atomic transaction to set workflowType=QUICK when creating quick-impl Job. Frontend loads workflowType in board queries and conditionally renders badge based on value.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, shadcn/ui, @dnd-kit
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright (E2E), existing test suite reuse and extension
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js monorepo structure)
**Performance Goals**: Badge render <100ms, migration <5s, atomic transaction <50ms
**Constraints**: Zero downtime migration, backward compatibility with existing tickets
**Scale/Scope**: ~100 existing tickets, <10 UI components affected, 5 test files to update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate (PASSED ✅)

- ✅ **TypeScript-First Development**: All code will use TypeScript strict mode with explicit types (WorkflowType enum, TicketWithVersion extension)
- ✅ **Component-Driven Architecture**: Badge uses existing shadcn/ui Badge component, no custom primitives
- ✅ **Test-Driven Development**: Will extend existing test files (`tests/api/ticket-transition.spec.ts`, `tests/e2e/quick-impl-visual-feedback.spec.ts`) before implementation
- ✅ **Security-First Design**: No user input validation required (enum enforced at DB level), Prisma parameterized queries
- ✅ **Database Integrity**: Migration via `prisma migrate dev`, atomic transaction for Job + Ticket update

### Post-Design Gate

*(Re-evaluated after Phase 1 design artifacts complete)*

- ✅ **Test Discovery**: Existing test files identified:
  - `tests/api/ticket-transition.spec.ts` (transition API tests)
  - `tests/e2e/quick-impl-visual-feedback.spec.ts` (visual feedback tests)
  - `tests/unit/stage-validation.spec.ts` (stage validation logic)
  - Will extend these files rather than creating duplicates
- ✅ **Database Migration**: Prisma migration will be idempotent and backward compatible
- ✅ **Type Safety**: TicketWithVersion interface extension maintains strict typing

## Project Structure

### Documentation (this feature)

```
specs/032-add-workflow-type/
├── plan.md              # This file
├── research.md          # Phase 0 output (technical decisions)
├── data-model.md        # Phase 1 output (schema changes)
├── quickstart.md        # Phase 1 output (implementation guide)
├── contracts/           # Phase 1 output (API contracts)
│   └── ticket-types.ts  # TicketWithVersion extension
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```
ai-board/
├── prisma/
│   ├── schema.prisma                    # Add WorkflowType enum, Ticket.workflowType field
│   └── migrations/
│       └── [timestamp]_add_workflow_type/ # New migration
├── lib/
│   ├── types.ts                         # Extend TicketWithVersion interface
│   └── workflows/
│       └── transition.ts                # Update to set workflowType in transaction
├── app/
│   └── projects/[id]/board/
│       └── page.tsx                     # Include workflowType in ticket query
├── components/
│   └── board/
│       ├── ticket-card.tsx              # Add conditional badge rendering
│       └── board.tsx                    # Pass workflowType to cards
└── tests/
    ├── api/
    │   └── ticket-transition.spec.ts    # Extend with workflowType validation tests
    ├── e2e/
    │   └── quick-impl-visual-feedback.spec.ts # Extend with badge visibility tests
    └── unit/
        └── stage-validation.spec.ts      # No changes needed (stage logic unchanged)
```

**Structure Decision**: Web application monorepo with Next.js App Router. All feature code in single repository with feature-based component folders. Tests organized by type (api, e2e, unit) following existing convention.

## Complexity Tracking

*No constitution violations - all changes align with established patterns.*

| Area | Complexity | Justification |
|------|-----------|---------------|
| **Database Schema** | Low | Single enum + single field addition with default value |
| **Backend Logic** | Medium | Atomic transaction for Job + Ticket update (existing pattern from feature 031) |
| **Frontend Display** | Low | Conditional badge rendering using existing shadcn/ui component |
| **Testing** | Low | Extend existing test files, reuse test helpers and patterns |

---

## Phase 0: Research & Technical Decisions

**Status**: Complete (no unknowns requiring research)

All technical decisions resolved in specification phase:

1. **Database Field Type**: WorkflowType enum (FULL, QUICK) - follows existing ClarificationPolicy enum pattern
2. **Transaction Strategy**: Use Prisma.$transaction() for atomic Job + Ticket update - same pattern as existing multi-table operations
3. **Badge Component**: shadcn/ui Badge component with amber color scheme - consistent with existing UI
4. **Index Strategy**: Composite index on (projectId, workflowType) - enables future filtering features

**Output**: See [research.md](./research.md) for detailed technical analysis

---

## Phase 1: Design & Contracts

### Data Model Changes

**Output**: See [data-model.md](./data-model.md)

**Summary**:
- Add WorkflowType enum (FULL, QUICK)
- Add Ticket.workflowType field (WorkflowType, NOT NULL, DEFAULT FULL)
- Add index on (Ticket.projectId, Ticket.workflowType)
- Migration is backward compatible (all existing tickets default to FULL)

### API Contracts

**Output**: See [contracts/ticket-types.ts](./contracts/ticket-types.ts)

**Changes**:
- Extend `TicketWithVersion` interface to include `workflowType: WorkflowType`
- No REST API changes (workflowType flows through existing ticket endpoints)
- Board query automatically includes workflowType via Prisma select

### Implementation Quickstart

**Output**: See [quickstart.md](./quickstart.md)

**Entry Points**:
1. **Migration**: `npx prisma migrate dev --name add_workflow_type`
2. **Backend**: Update `lib/workflows/transition.ts` line ~217 (Job creation)
3. **Types**: Extend `lib/types.ts` TicketWithVersion interface
4. **Frontend**: Update `components/board/ticket-card.tsx` (add badge)
5. **Tests**: Extend existing test files identified above

---

## Phase 2: Task Breakdown

**Blocked until**: `/speckit.tasks` command execution

**Expected Tasks**:
- [ ] Create Prisma migration for WorkflowType enum and Ticket.workflowType field
- [ ] Update lib/workflows/transition.ts to set workflowType in transaction
- [ ] Extend lib/types.ts TicketWithVersion interface
- [ ] Update board query in app/projects/[id]/board/page.tsx
- [ ] Add badge rendering in components/board/ticket-card.tsx
- [ ] Extend tests/api/ticket-transition.spec.ts with workflowType validation
- [ ] Extend tests/e2e/quick-impl-visual-feedback.spec.ts with badge tests
- [ ] Manual update of 2 existing quick-impl tickets via database tool
- [ ] Verify migration rollback safety (test on staging)

---

## Test Strategy

**Philosophy**: Reuse and extend existing tests rather than creating duplicates (per constitution Principle III)

### Existing Test Files to Extend

1. **tests/api/ticket-transition.spec.ts**
   - Current coverage: INBOX → BUILD transition, Job creation, error handling
   - Add: Verify workflowType=QUICK set correctly, atomic transaction validation
   - Add: Verify workflowType=FULL for normal workflow (INBOX → SPECIFY)
   - Add: Verify workflowType unchanged on subsequent jobs

2. **tests/e2e/quick-impl-visual-feedback.spec.ts**
   - Current coverage: Color-coded drop zones, drag visual feedback
   - Add: Verify ⚡ Quick badge appears for quick-impl tickets
   - Add: Verify badge does NOT appear for full workflow tickets
   - Add: Verify badge persists through stage transitions

3. **tests/unit/stage-validation.spec.ts**
   - Current coverage: Stage transition validation logic
   - No changes needed (workflowType doesn't affect validation rules)

### New Test Scenarios

**API Tests** (extend ticket-transition.spec.ts):
- Quick-impl sets workflowType=QUICK atomically with Job creation
- Normal workflow preserves workflowType=FULL default
- Transaction rollback on error doesn't update workflowType
- workflowType immutable after initial setting

**E2E Tests** (extend quick-impl-visual-feedback.spec.ts):
- Badge visible for quick-impl tickets in all stages (BUILD, VERIFY, SHIP)
- Badge color contrast meets WCAG AA in light/dark themes
- Badge position consistent on ticket cards

### Test Data Setup

Reuse existing test helpers from `tests/helpers/`:
- `db-setup.ts`: Create test tickets with workflowType
- `db-cleanup.ts`: Clean up test tickets (unchanged)
- Use `[e2e]` prefix convention for test ticket titles

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks existing tickets | High | Default value FULL ensures all tickets valid; test on staging first |
| Transaction performance overhead | Low | Single additional field update (~1ms); acceptable per spec |
| Badge layout breaks on small screens | Medium | Use existing Badge component (already responsive); E2E test on mobile viewport |
| Test file duplication | Low | Search existing tests first (Grep/Glob); extend rather than create |
| Manual ticket updates fail | Low | Only 2 tickets affected; provide SQL script for safety |

---

## Dependencies

### External Dependencies
- Prisma 6.x (migration system)
- shadcn/ui Badge component (already installed)
- @dnd-kit (already installed, no changes)

### Internal Dependencies
- Feature 031 (quick-impl workflow) must be deployed
- `lib/workflows/transition.ts` isQuickImpl detection logic (exists)
- Existing test infrastructure (Playwright, helpers)

### Deployment Order
1. Run migration (`prisma migrate deploy`)
2. Deploy application code (backward compatible)
3. Manually update 2 existing quick-impl tickets (SQL script provided)
4. Verify badge appears correctly in production

---

## Agent Context Update

**Action**: Run `.specify/scripts/bash/update-agent-context.sh claude` after Phase 1

**Updates**:
- Add WorkflowType enum to CLAUDE.md Active Technologies
- Document workflowType field in Ticket model notes
- Add badge pattern to UI component conventions

---

## Success Metrics

From spec success criteria:

- ✅ Migration completes without errors (SC-005)
- ✅ Atomic transaction verified (0 orphaned Jobs) (SC-006)
- ✅ Badge appears for quick-impl tickets (100% accuracy) (SC-001, SC-014)
- ✅ Badge persists through transitions (100% retention) (SC-004)
- ✅ workflowType immutable after setting (SC-007)
- ✅ Existing tickets default to FULL (SC-008)
- ✅ WCAG AA contrast ratio met (SC-009)
- ✅ Test coverage ≥80% (SC-013)
- ✅ Linter passes (SC-012)

---

## Next Steps

1. Review this plan for technical accuracy
2. Run `/speckit.tasks` to generate task breakdown (tasks.md)
3. Begin implementation following TDD workflow (tests first)
4. Use existing test files identified above (extend, don't duplicate)
5. Verify all constitution gates pass throughout implementation
