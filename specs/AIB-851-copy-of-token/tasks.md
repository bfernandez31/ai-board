# Tasks: Token Saving via RTK + Unified Per-Ticket Run Settings

**Input**: Design documents from `/specs/AIB-851-copy-of-token/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included by default (constitution).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Migration + Schema)

**Purpose**: Add token saving fields to the database and regenerate the Prisma client so all downstream code can reference the new columns.

- [x] T001 Add `tokenSaving` Boolean (default false) to Project, `tokenSaving` Boolean? to Ticket, and `tokenSavingStatus` String? @db.VarChar(20) to Job in prisma/schema.prisma
- [x] T002 Run `bunx prisma migrate dev` to create the migration, then run `bunx prisma generate` to regenerate the Prisma client

**Checkpoint**: `tokenSaving` and `tokenSavingStatus` columns exist in DB. Prisma client types are updated.

---

## Phase 2: Foundational (Validation Schemas + Resolution Logic)

**Purpose**: Extend validation schemas and add resolution function so all API and workflow code can handle token saving fields.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 [P] Add `tokenSaving: z.boolean().optional()` to `projectUpdateSchema` in app/lib/schemas/clarification-policy.ts
- [x] T004 [P] Add `tokenSaving: z.boolean().nullable().optional()` to `patchTicketSchema` and `tokenSaving: z.boolean().nullable().optional()` to `ticketResponseSchema` in lib/validations/ticket.ts
- [x] T005 [P] Add `resolveEffectiveTokenSaving(ticket): boolean` function to lib/workflows/transition.ts following the `resolveEffectiveAgent` pattern (ticket.tokenSaving ?? project.tokenSaving ?? false)
- [x] T006 [P] Add `tokenSavingStatus: z.enum(["active", "inactive", "fallback", "n/a"]).optional()` to the job status PATCH validation in app/api/jobs/[id]/status/route.ts and persist the field on update

**Checkpoint**: All validation schemas accept token saving fields. Resolution function is available for dispatch logic.

---

## Phase 3: User Story 1 — Enable Token Saving for a Project (Priority: P1) 🎯 MVP

**Goal**: Project owners can toggle a "Token Saving" setting in project settings that defaults to OFF.

**Independent Test**: Toggle the setting in project settings, reload, and verify the value persists.

### Tests for User Story 1

- [x] T007 [P] [US1] Extend tests/integration/projects/settings.test.ts with token saving tests: PATCH project with `tokenSaving: true` persists and returns the value; non-owner cannot modify tokenSaving; default is false for new projects
- [x] T008 [P] [US1] Extend tests/unit/workflows/model-resolution.test.ts with `resolveEffectiveTokenSaving` tests: returns ticket override when set, falls back to project default when ticket is null, falls back to false when both are null

### Implementation for User Story 1

- [x] T009 [US1] Extend PATCH handler in app/api/projects/[projectId]/route.ts to accept and persist the `tokenSaving` field from the validated body
- [x] T010 [US1] Create components/settings/token-saving-card.tsx — client component following ClarificationPolicyCard pattern: Switch toggle, description text, owner-only editability, saves via PATCH /api/projects/[projectId]
- [x] T011 [US1] Add TokenSavingCard to app/projects/[projectId]/settings/page.tsx after the existing settings cards

**Checkpoint**: Project-level token saving toggle works end-to-end. Story 1 is independently testable.

---

## Phase 4: User Story 2 — Override Token Saving at Ticket Level (Priority: P1)

**Goal**: Users can override the project default at the ticket level (force ON, force OFF, or inherit from project).

**Independent Test**: Set a ticket override via PATCH, reload, confirm the override value is returned with the project default for comparison.

### Tests for User Story 2

- [x] T012 [P] [US2] Extend tests/integration/tickets/duplicate.test.ts with token saving preservation tests: simple copy preserves tokenSaving override; full clone preserves tokenSaving override; tokenSaving null (inherit) is preserved as null

### Implementation for User Story 2

- [x] T013 [US2] Extend GET and PATCH handlers in app/api/projects/[projectId]/tickets/[id]/route.ts to accept `tokenSaving` in PATCH and return `tokenSaving` plus `project.tokenSaving` in GET response
- [x] T014 [US2] Extend `duplicateTicket()` and `fullCloneTicket()` in lib/db/tickets.ts to copy `tokenSaving` field from source ticket
- [x] T015 [US2] Extend `serializeTicket()` in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts to include the `tokenSaving` field in the response

**Checkpoint**: Ticket-level token saving override works via API. Clone/copy preserves the setting.

---

## Phase 5: User Story 3 — Unified Run Settings Dialog (Priority: P1)

**Goal**: Replace three separate kebab menu items and dialogs (Edit Policy, Edit Agent, Edit Models) with a single "Run settings" dialog containing all four setting sections.

**Independent Test**: Open the kebab menu and verify 3 items; open "Run settings" and confirm all four sections are present; verify stage-based editability (Agent/Policy read-only past INBOX).

### Tests for User Story 3

- [x] T016 [US3] Extend tests/unit/components/ticket-detail-modal.test.tsx with: kebab menu has exactly 3 items ("Run settings", "Simple copy", "Full clone" conditional); RunSettingsDialog opens on "Run settings" click; dialog contains Agent, Models, Policy, and Token Saving sections; Agent/Policy sections are read-only for non-INBOX tickets

### Implementation for User Story 3

- [x] T017 [US3] Create components/tickets/run-settings-dialog.tsx — unified dialog with tabs for Agent, Models (per stage), Clarification Policy, and Token Saving sections. Each section composes logic from the existing dialog components (policy-edit-dialog.tsx, agent-edit-dialog.tsx, model-override-dialog.tsx). Stage-aware editability: Agent and Policy tabs are read-only when ticket is not INBOX. Token Saving section uses a Select with "Use project default" / "Force ON" / "Force OFF" options. Each section shows "(override)" or "(project default)" labels.
- [x] T018 [US3] Modify components/board/ticket-detail-modal.tsx: replace `policyEditOpen`, `agentEditOpen`, `modelOverrideOpen` states with single `runSettingsOpen` state; replace 3 DropdownMenuItem items with single "Run settings" item; remove rendering of 3 separate dialogs and render RunSettingsDialog instead; keep "Simple copy" and "Full clone" menu items

**Checkpoint**: Kebab menu shows 3 items. Unified dialog works for all four override types. Existing override behavior unchanged.

---

## Phase 6: User Story 4 — Token Saving Active During Agent Runs (Priority: P2)

**Goal**: When effective token saving is ON for a Claude run, RTK is installed and activated. Graceful fallback if RTK fails.

**Independent Test**: Run a BUILD job on a ticket with token saving ON; verify job details show "Token saving: Active".

### Tests for User Story 4

- [x] T019 [US4] Extend tests/unit/workflows/model-resolution.test.ts with dispatch input tests: verify `token_saving: 'true'` is included in workflow inputs when effective token saving is ON; verify `token_saving` is omitted when effective is OFF

### Implementation for User Story 4

- [x] T020 [US4] Extend dispatch logic in lib/workflows/transition.ts to pass `token_saving: 'true'` in workflow inputs when `resolveEffectiveTokenSaving()` returns true, using the existing conditional spread pattern
- [x] T021 [P] [US4] Add `token_saving` input (string, required: false, default: 'false') to .github/workflows/speckit.yml and map to `TOKEN_SAVING` env var passed to run-agent.sh
- [x] T022 [P] [US4] Add `token_saving` input to .github/workflows/quick-impl.yml and map to `TOKEN_SAVING` env var
- [x] T023 [P] [US4] Add `token_saving` input to .github/workflows/verify.yml and map to `TOKEN_SAVING` env var
- [x] T024 [P] [US4] Add `token_saving` input to .github/workflows/iterate.yml and map to `TOKEN_SAVING` env var
- [x] T025 [US4] Extend .github/scripts/run-agent.sh: add RTK installation and activation block before Claude invocation, guarded by `TOKEN_SAVING=true && AGENT=CLAUDE`. On success, report `tokenSavingStatus: "active"` via PATCH callback. On failure, log warning, set status to `"fallback"`, and proceed without RTK. For non-Claude agents, set `"n/a"`. When setting is OFF, set `"inactive"`.

**Checkpoint**: Claude agent runs with token saving ON activate RTK. Fallback works on RTK failure. Job records correct tokenSavingStatus.

---

## Phase 7: User Story 5 — Compare Token Savings Between Cloned Tickets (Priority: P2)

**Goal**: Users can clone a ticket, set different token saving states, run jobs, and compare telemetry to quantify savings.

**Independent Test**: Clone a ticket, set one to ON and one to OFF, run BUILD on both, compare job telemetry showing token saving status.

### Implementation for User Story 5

- [x] T026 [US5] Extend job detail/telemetry display in components/board/ticket-detail-modal.tsx to show `tokenSavingStatus` with appropriate label and styling (Active = green badge, Inactive = muted, Fallback = amber with explanation tooltip, N/A = hidden)

**Checkpoint**: Job details clearly show token saving status alongside existing telemetry metrics for side-by-side comparison.

---

## Phase 8: User Story 6 — Token Saving Badge in Header Status Strip (Priority: P3)

**Goal**: A compact icon badge appears in the ticket header when token saving is effectively ON.

**Independent Test**: Enable token saving for a ticket and verify the badge appears in the header strip with correct tooltip.

### Tests for User Story 6

- [x] T027 [US6] Create tests/unit/components/token-saving-badge.test.tsx with tests: renders Zap icon when token saving is ON; does not render when OFF; tooltip shows "(override)" when ticket override is set; tooltip shows "(project default)" when inherited

### Implementation for User Story 6

- [x] T028 [US6] Create components/ui/token-saving-badge.tsx — small component following PolicyBadge pattern: Zap icon from lucide-react, tooltip showing source (override vs project default), only renders when effective token saving is ON
- [x] T029 [US6] Add TokenSavingBadge to ticket-detail-modal.tsx header status strip after the existing agent badge

**Checkpoint**: Token saving badge visible in header strip with correct tooltip for all override/inherit states.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final integration validation and cleanup across all stories.

- [x] T030 Run `bun run type-check` and `bun run lint` and fix any errors across all modified and new files
- [x] T031 Run `bun run test:unit` and `bun run test:integration` and fix any test failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (Prisma client must be regenerated)
- **Phases 3–4 (US1, US2)**: Depend on Phase 2. Can run in parallel with each other.
- **Phase 5 (US3)**: Depends on Phase 2. Can run in parallel with US1/US2 but benefits from US2 being complete (token saving section needs ticket-level override API).
- **Phase 6 (US4)**: Depends on Phase 2 (resolution function). Can run in parallel with US1–US3.
- **Phase 7 (US5)**: Depends on US2 (clone preserves tokenSaving) and US4 (RTK activation writes status). Minimal new code — mostly depends on prior phases existing.
- **Phase 8 (US6)**: Depends on Phase 2 (resolution function). Can run in parallel with US1–US5.
- **Phase 9 (Polish)**: Depends on all prior phases.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependencies on other stories
- **US2 (P1)**: After Phase 2 — independent of US1
- **US3 (P1)**: After Phase 2 — independent but benefits from US2 for token saving section data
- **US4 (P2)**: After Phase 2 — independent (uses resolution function directly)
- **US5 (P2)**: After US2 + US4 — needs clone + RTK status to exist
- **US6 (P3)**: After Phase 2 — independent

### Within Each User Story

- Tests written first and verified to fail before implementation
- Schema/validation before API logic
- API logic before UI components
- Core implementation before visual/display enhancements

### Parallel Opportunities

- T003, T004, T005, T006 (all Phase 2) can run in parallel
- T007, T008 (US1 tests) can run in parallel
- T021, T022, T023, T024 (workflow YAML files) can run in parallel
- US1 and US2 can run in parallel after Phase 2
- US4 and US6 can run in parallel after Phase 2

---

## Parallel Example: Phase 2

```
# All foundational tasks in parallel (different files):
Task T003: Add tokenSaving to projectUpdateSchema in app/lib/schemas/clarification-policy.ts
Task T004: Add tokenSaving to patchTicketSchema in lib/validations/ticket.ts
Task T005: Add resolveEffectiveTokenSaving in lib/workflows/transition.ts
Task T006: Add tokenSavingStatus to job status route in app/api/jobs/[id]/status/route.ts
```

## Parallel Example: User Story 4 Workflow Files

```
# All workflow YAML files in parallel (independent files):
Task T021: Add token_saving input to speckit.yml
Task T022: Add token_saving input to quick-impl.yml
Task T023: Add token_saving input to verify.yml
Task T024: Add token_saving input to iterate.yml
```

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Complete Phase 1: Setup (migration + Prisma generate)
2. Complete Phase 2: Foundational (schemas + resolution function)
3. Complete Phase 3: US1 — Project-level toggle
4. Complete Phase 4: US2 — Ticket-level override
5. Complete Phase 5: US3 — Unified Run settings dialog
6. **STOP and VALIDATE**: All three P1 stories testable independently

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Project settings toggle works → Demo
3. US2 → Ticket override + clone preservation → Demo
4. US3 → Unified dialog consolidation → Demo (MVP complete!)
5. US4 → RTK runtime integration → Demo
6. US5 → Telemetry comparison display → Demo
7. US6 → Header badge polish → Demo

### Parallel Execution Strategy

1. Complete Phase 1 + Phase 2 sequentially (Phase 2 depends on Phase 1)
2. Once Phase 2 is done, fan out:
   - Parallel track A: US1 + US2 (P1 — project + ticket settings)
   - Parallel track B: US3 (P1 — unified dialog)
   - Parallel track C: US4 (P2 — RTK integration)
   - Parallel track D: US6 (P3 — badge)
3. After US2 + US4 complete: US5 (P2 — telemetry display)
4. Polish phase after all stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All file paths verified against the repository — no invented paths
- 3 new component files, 0 new API route files, 1 Prisma migration
- No new E2E tests — all scenarios covered by integration + unit tests
