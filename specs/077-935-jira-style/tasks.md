# Tasks: Jira-Style Ticket Numbering System

**Input**: Design documents from `/specs/077-935-jira-style/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Per user request "DO NOT ADD NEW TESTS! YOU SHOULD ONLY FIX THE OLD ONE FOR NOW" - only fixing existing tests, no new test creation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router structure: `app/`, `components/`, `prisma/`
- API routes: `app/api/`
- Frontend components: `components/`
- Tests: `tests/`

---

## Phase 1: Setup (Database Schema)

**Purpose**: Database migration to add project keys and ticket numbering fields

**⚠️ CRITICAL**: This phase MUST complete before any other work. Migration includes data population for existing tickets.

- [X] T001 Update Prisma schema to add Project.key field (VARCHAR(6), unique, not null, indexed, 3-6 characters) in prisma/schema.prisma
- [X] T002 Update Prisma schema to add Ticket.ticketNumber field (INT, not null, unique per project) in prisma/schema.prisma
- [X] T003 Update Prisma schema to add Ticket.ticketKey field (VARCHAR(20), unique, not null, indexed) in prisma/schema.prisma
- [X] T004 Generate Prisma migration with --create-only flag using name "jira_style_numbering"
- [X] T005 Update migration SQL to include complete migration script with: schema changes, sequence function creation, project key population, ticket number/key population, constraints, indexes, and sequence initialization in prisma/migrations/YYYYMMDDHHMMSS_jira_style_numbering/migration.sql
- [X] T006 Test migration on local database (backup first, run migration, verify all projects have keys, all tickets have numbers/keys)
- [X] T007 Run Prisma generate to update TypeScript types for new fields

**Checkpoint**: Database schema complete with all existing data migrated - API and frontend work can now begin in parallel

---

## Phase 2: Foundational (Core Utilities)

**Purpose**: Core utilities and validation schemas needed by all user stories

**⚠️ CRITICAL**: These utilities are required for ticket creation and lookup. Must complete before user story implementation.

- [X] T008 [P] Create project key validation schema using Zod (3-6 uppercase alphanumeric chars, transform to uppercase) in app/lib/schemas/project.ts
- [X] T009 [P] Create ticket key validation schema using Zod (format: KEY-NUM regex) in app/lib/schemas/ticket.ts
- [X] T010 [P] Update ticket response schema to include ticketNumber and ticketKey fields in app/lib/schemas/ticket.ts
- [X] T011 [P] Update project create schema to accept optional key field in app/lib/schemas/project.ts
- [X] T012 Create getNextTicketNumber helper function that calls PostgreSQL sequence function via Prisma.$queryRaw in app/lib/db/ticket-sequence.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Tickets with Project-Scoped Numbers (Priority: P1) 🎯 MVP

**Goal**: Users can identify and reference tickets using project-specific numbering (e.g., "ABC-5") instead of global IDs

**Independent Test**: Users can view any ticket and see its project-scoped key (e.g., "ABC-123") displayed prominently. Can be tested by creating a project and viewing its tickets.

### Implementation for User Story 1

- [ ] T013 [P] [US1] Update ticket creation endpoint to fetch project key before creating ticket in app/api/projects/[projectId]/tickets/route.ts
- [ ] T014 [P] [US1] Update ticket creation endpoint to call getNextTicketNumber and generate ticketKey before insert in app/api/projects/[projectId]/tickets/route.ts
- [ ] T015 [P] [US1] Update ticket list endpoint (GET) to include ticketNumber and ticketKey in response in app/api/projects/[projectId]/tickets/route.ts
- [ ] T016 [P] [US1] Update ticket detail endpoint to include ticketNumber and ticketKey in response in app/api/projects/[projectId]/tickets/[id]/route.ts
- [ ] T017 [P] [US1] Update TicketCard component to display ticketKey instead of ID (use font-mono styling) in components/board/ticket-card.tsx
- [ ] T018 [P] [US1] Update TicketDetail component to display ticketKey prominently in header in components/board/ticket-detail.tsx

**Checkpoint**: User Story 1 complete - tickets now display with project-scoped keys in UI

---

## Phase 4: User Story 2 - Access Tickets via Clean URLs (Priority: P1) 🎯 MVP

**Goal**: Users can access tickets using memorable URLs like `/ticket/ABC-123` instead of numeric IDs

**Independent Test**: Users can navigate to `/ticket/ABC-123` and view the correct ticket. Can be tested by creating a ticket and accessing it via its key-based URL.

### Implementation for User Story 2

- [ ] T019 [US2] Create new API endpoint GET /api/ticket/[key]/route.ts with session validation, ticket key validation, ticket lookup by key with project include, and authorization check (owner or member)
- [ ] T020 [US2] Update existing ticket detail endpoint to support both numeric ID and ticket key lookup (detect format with regex, query accordingly) in app/api/projects/[projectId]/tickets/[id]/route.ts
- [ ] T021 [US2] Create new Next.js page at app/ticket/[key]/page.tsx that fetches ticket via /api/ticket/:key and renders TicketDetail component
- [ ] T022 [US2] Update ticket card links to use /ticket/:ticketKey format instead of /projects/:projectId/tickets/:id in components/board/ticket-card.tsx
- [ ] T023 [US2] Add redirect from old ticket URLs to new /ticket/:key URLs for backward compatibility (optional: implement as Next.js middleware or page redirect)

**Checkpoint**: User Story 2 complete - clean URLs now work for ticket access

---

## Phase 5: User Story 3 - Migrate Existing Tickets (Priority: P2)

**Goal**: Existing tickets are automatically migrated to the new numbering system with valid keys

**Independent Test**: After migration (already completed in Phase 1), verify all existing tickets have valid ticket keys and numbers

**Note**: Migration was completed in Phase 1 (T005-T006). This phase validates the migration.

### Implementation for User Story 3

- [ ] T024 [US3] Create migration verification script that checks: all projects have keys, all tickets have ticketNumber and ticketKey, no duplicate keys, all sequences exist, all foreign key relationships intact in scripts/verify-migration.ts
- [ ] T025 [US3] Run verification script on local database and document any issues found
- [ ] T026 [US3] If issues found, create migration rollback script per quickstart.md rollback plan in scripts/rollback-migration.sql

**Checkpoint**: Migration validated - all existing tickets have valid keys

---

## Phase 6: User Story 4 - Project Creation with Keys (Priority: P2)

**Goal**: New projects are created with auto-generated or custom keys (3-6 characters)

**Independent Test**: Create a new project and verify it receives a valid key of 3-6 characters (either auto-generated from name or custom-provided)

### Implementation for User Story 4

- [ ] T027 [P] [US4] Create project key generation function that derives key from project name (first 3-6 uppercase alphanumeric chars, min 3 chars padded if needed, collision handling) in app/lib/utils/generate-project-key.ts
- [ ] T028 [US4] Update project creation endpoint to validate optional key field, generate key if not provided, handle duplicate key errors (409 status) in app/api/projects/route.ts
- [ ] T029 [US4] Update project response to include key field in GET /api/projects/[projectId]/route.ts
- [ ] T030 [P] [US4] Update ProjectForm component to include optional project key input field with validation in components/projects/project-form.tsx

**Checkpoint**: Project creation now supports keys - new projects automatically get valid keys

---

## Phase 7: Test Fixes (Per User Request)

**Purpose**: Fix existing tests to work with new ticket numbering system (NO NEW TESTS)

**⚠️ User Directive**: "DO NOT ADD NEW TESTS! YOU SHOULD ONLY FIX THE OLD ONE FOR NOW"

- [ ] T031 [P] Update ticket creation test assertions to expect ticketNumber and ticketKey fields in response in tests/e2e/ticket-creation.spec.ts
- [ ] T032 [P] Update ticket lookup tests to work with both ID and key lookup patterns in tests/integration/ticket-lookup.spec.ts
- [ ] T033 [P] Update board component tests to expect ticketKey display instead of ID in tests/unit/ticket-card.test.ts
- [ ] T034 [P] Update API contract tests to include new fields in request/response validation in tests/api/tickets.spec.ts
- [ ] T035 [P] Update database seed/fixture data to include ticketNumber and ticketKey for test tickets in tests/helpers/db-setup.ts
- [ ] T036 Run full test suite (unit + E2E) and document any remaining failures

**Checkpoint**: All existing tests updated and passing

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation

- [ ] T037 [P] Update CLAUDE.md to document ticket key system (URL structure, API patterns, test data conventions) in CLAUDE.md
- [ ] T038 [P] Update API documentation with new endpoints and field changes (if separate API docs exist)
- [ ] T039 Run quickstart.md validation checklist: all projects have keys, new tickets get sequential numbers, /ticket/:key URLs work, no errors in logs
- [ ] T040 Performance validation: benchmark ticket creation (<100ms p95) and lookup by key (<50ms p95) using load testing tool
- [ ] T041 Code review: verify error handling, input validation, authorization checks on all new endpoints
- [ ] T042 Security audit: verify ticket key enumeration risks, authorization on /ticket endpoint, SQL injection prevention in sequence function

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - MUST complete first (migration is blocking)
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational (Phase 2) completion
  - User Story 1 (Phase 3): Can start after Foundational
  - User Story 2 (Phase 4): Depends on User Story 1 (needs ticket creation with keys)
  - User Story 3 (Phase 5): Migration verification, can run after Phase 1
  - User Story 4 (Phase 6): Can start after Foundational (independent of other stories)
- **Test Fixes (Phase 7)**: Should happen after US1 and US2 are complete (tests need working system)
- **Polish (Phase 8)**: Depends on all user stories and tests being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on User Story 1 - needs tickets to exist with keys for clean URLs to work
- **User Story 3 (P2)**: Migration validation only - can run early, no implementation dependencies
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent of other stories

### Within Each User Story

- **User Story 1**: API updates (T013-T016) can run in parallel with UI updates (T017-T018)
- **User Story 2**: API endpoint creation (T019-T020) must complete before page creation (T021), then UI link updates (T022-T023)
- **User Story 3**: Sequential verification steps
- **User Story 4**: Key generation utility (T027) must complete before API update (T028), UI update (T030) can run in parallel

### Parallel Opportunities

- **Phase 1**: Tasks are sequential (database migration)
- **Phase 2**: All tasks marked [P] can run in parallel (T008-T011)
- **Phase 3 (US1)**: API updates (T013-T016) parallel with UI updates (T017-T018)
- **Phase 6 (US4)**: Key generation (T027) + UI form (T030) can run in parallel after key generation exists
- **Phase 7**: All test fix tasks marked [P] can run in parallel (T031-T035)
- **Phase 8**: Documentation tasks (T037-T038) can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch User Story 1 work in parallel:

# Team Member A - API Updates:
Task T013: "Update ticket creation endpoint to fetch project key"
Task T014: "Update ticket creation endpoint to generate ticketKey"
Task T015: "Update ticket list endpoint to include new fields"
Task T016: "Update ticket detail endpoint to include new fields"

# Team Member B - UI Updates (can start at same time):
Task T017: "Update TicketCard to display ticketKey"
Task T018: "Update TicketDetail to display ticketKey"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (Database Migration) - **CRITICAL BLOCKER**
2. Complete Phase 2: Foundational (Utilities & Schemas)
3. Complete Phase 3: User Story 1 (Display ticket keys)
4. Complete Phase 4: User Story 2 (Clean URLs)
5. **STOP and VALIDATE**: Test ticket creation, viewing, and URL access
6. Fix critical tests (Phase 7, subset)
7. Deploy/demo if ready

**This is the MINIMUM VIABLE PRODUCT** - users can see and access tickets via keys

### Incremental Delivery

1. Setup + Foundational → Foundation ready (database migrated, utilities available)
2. Add User Story 1 → Test independently → Tickets display with keys
3. Add User Story 2 → Test independently → Clean URLs work
4. Add User Story 4 → Test independently → New projects get keys
5. Fix all tests (Phase 7) → Test suite passes
6. Polish (Phase 8) → Production ready

### Parallel Team Strategy

With 2-3 developers:

1. **Everyone**: Complete Setup (Phase 1) together (critical path)
2. **Everyone**: Complete Foundational (Phase 2) together (quick, ~1 hour)
3. Once Foundational is done:
   - **Developer A**: User Story 1 (API updates)
   - **Developer B**: User Story 1 (UI updates)
   - **Developer C**: User Story 4 (project key generation)
4. After US1 completes:
   - **Developer A**: User Story 2 (clean URLs)
   - **Developer B**: Test fixes (Phase 7)
   - **Developer C**: Continue User Story 4
5. Final validation and polish together

---

## Performance Targets

| Operation | Target (p95) | Validation Task |
|-----------|--------------|-----------------|
| Ticket creation with key generation | <100ms | T040 |
| Ticket lookup by key | <50ms | T040 |
| Project creation with key generation | <150ms | T040 |
| Migration execution (10k tickets) | <5 minutes | T006 |

---

## Success Metrics

- [ ] All existing tickets migrated with valid keys (T006, T024)
- [ ] New tickets receive sequential numbers per project (T013-T014)
- [ ] Zero race conditions in number generation (enforced by PostgreSQL sequences)
- [ ] All existing tests passing (T036)
- [ ] Clean URLs resolve correctly (T021)
- [ ] Performance targets met (T040)
- [ ] Zero critical bugs in staging deployment

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Migration is BLOCKING**: Phase 1 must complete before any other work
- **Test philosophy**: Per user request, only fix existing tests (no new test creation)
- **Backward compatibility**: Internal ticket IDs preserved, old APIs continue to work
- **Security**: All endpoints require authentication + project ownership validation
- **Commit strategy**: Commit after each task or logical group
- **Stop at checkpoints**: Validate each user story independently before proceeding

---

## Risk Mitigation

- **Migration failure**: Full transaction, staging test first, database backup before production (see quickstart.md)
- **Race conditions**: PostgreSQL sequences are atomic by design, no application-level locking needed
- **Performance**: Indexed lookups on ticketKey field, target <50ms p95
- **Data loss**: Internal IDs preserved, foreign keys unchanged, rollback script available (T026)
- **Test coverage gaps**: User accepted trade-off (fix existing only), document gaps for future backlog

---

## Estimated Effort

| Phase | Tasks | Estimated Time | Critical Path? |
|-------|-------|----------------|----------------|
| Phase 1: Setup | T001-T007 | 2-3 hours | YES (BLOCKER) |
| Phase 2: Foundational | T008-T012 | 1-2 hours | YES (BLOCKER) |
| Phase 3: User Story 1 | T013-T018 | 3-4 hours | YES (MVP) |
| Phase 4: User Story 2 | T019-T023 | 2-3 hours | YES (MVP) |
| Phase 5: User Story 3 | T024-T026 | 1 hour | NO |
| Phase 6: User Story 4 | T027-T030 | 2-3 hours | NO |
| Phase 7: Test Fixes | T031-T036 | 2-3 hours | YES (Validation) |
| Phase 8: Polish | T037-T042 | 2-3 hours | NO |
| **Total** | **42 tasks** | **15-22 hours** | **MVP: 8-12 hours** |

**MVP Path** (Phases 1, 2, 3, 4 only): 8-12 hours
**Full Feature** (All phases): 15-22 hours

---

## Next Steps After Implementation

1. Deploy to staging environment (see quickstart.md deployment section)
2. Run migration on staging database with downtime window
3. Validate all success criteria on staging
4. Monitor performance and error logs
5. Schedule production deployment with maintenance window
6. Gather user feedback on ticket key UX
7. Create backlog items for test coverage gaps (deferred per user directive)
