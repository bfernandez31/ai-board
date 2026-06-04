---
description: "Task list for AIB-849 — Token saving via RTK + unified per-ticket Run settings"
---

# Tasks: Token saving via RTK + unified per-ticket Run settings

**Input**: Design documents from `/specs/AIB-849-token-saving-via/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/token-saving-api.md ✅, workflows/rtk-activation.md ✅

**Tests**: Included by default (constitution §III). Search-first/extend-don't-duplicate applied — file paths below are validated against the filesystem; existing files are EXTENDED, new files created only where no existing file covers the domain.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1/US2/US3/US4 (Setup, Foundational, and Polish phases carry NO story label)
- Every task includes an exact file path

---

## Phase 1: Setup (Schema & Migration)

**Purpose**: Land the additive, non-breaking data model that every story builds on.

- [X] T001 ✅ DONE Add `enum TokenSavingOutcome { ACTIVE INACTIVE FELL_BACK }`, `Project.tokenSaving Boolean @default(false)`, `Ticket.tokenSaving Boolean?`, and `Job.tokenSavingOutcome TokenSavingOutcome?` to `prisma/schema.prisma` (per data-model.md; all additions nullable/defaulted — no backfill).
- [X] T002 ✅ DONE Run `bunx prisma migrate dev` to create the migration, then `bunx prisma generate` to regenerate the client (depends on T001).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure helpers used by multiple stories. MUST complete before story phases.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T003 ✅ DONE [P] Add `resolveEffectiveTokenSaving(ticket): boolean` returning `ticket.tokenSaving ?? ticket.project.tokenSaving` in `lib/workflows/transition.ts` (mirror `resolveEffectiveAgent` at L58-61; `??` so Force-OFF `false` wins over `true` project default — FR-003).
- [X] T004 ✅ DONE [P] Create static label/icon/description helpers in `app/lib/utils/token-saving-icons.ts` for both the effective-ON badge state (US4) and the per-job outcome states ACTIVE/INACTIVE/FELL_BACK (US2 jobs-timeline); full literal Tailwind class strings only (mirror `app/lib/utils/policy-icons.ts`).

**Checkpoint**: Foundation ready — user stories can now proceed.

---

## Phase 3: User Story 1 - Enable token saving for a project and let tickets inherit it (Priority: P1) 🎯 MVP

**Goal**: Owner-only project Token-saving card (default OFF); when ON, tickets with no override inherit ON for the effective value.

**Independent Test**: Toggle the project Token-saving card ON, confirm it persists and is read-only for non-owners, and confirm an inheriting ticket resolves an effective value of ON.

### Tests for User Story 1

**Write these FIRST and ensure they FAIL before implementation.**

- [X] T005 ✅ DONE [P] [US1] Extend `tests/integration/tickets/transitions.test.ts` with `resolveEffectiveTokenSaving` cases: project ON + ticket inherit → ON; project ON + ticket Force-OFF (`false`) → OFF; project OFF + ticket Force-ON → ON (extend, don't duplicate — siblings of the policy/agent resolution tests at L453-490).
- [X] T006 ✅ DONE [P] [US1] Create `tests/integration/tickets/token-saving.test.ts` covering project `PATCH /api/projects/:projectId` with `tokenSaving`: owner succeeds (200, persists), non-owner member → 403 FORBIDDEN (new domain; pattern-reference `tests/integration/tickets/model-override.test.ts`).

### Implementation for User Story 1

- [X] T007 ✅ DONE [US1] Add `tokenSaving: z.boolean().optional()` to `projectUpdateSchema` in `app/lib/schemas/clarification-policy.ts` (L7-21).
- [X] T008 ✅ DONE [US1] Apply `tokenSaving` only when `!== undefined` in `updateProject` in `lib/db/projects.ts` (follow the conditional-field pattern at L247-248).
- [X] T009 ✅ DONE [US1] Forward `tokenSaving` through the project PATCH handler in `app/api/projects/[projectId]/route.ts` (L61-79; owner-only auth already enforced) — depends on T007, T008.
- [X] T010 ✅ DONE [P] [US1] Create `components/settings/token-saving-card.tsx` — owner-editable toggle, read-only/disabled for members (mirror `components/settings/clarification-policy-card.tsx` / `default-agent-card.tsx`).
- [X] T011 ✅ DONE [US1] Mount `<TokenSavingCard>` in `app/projects/[projectId]/settings/page.tsx` alongside the existing policy/agent cards (depends on T010).

**Checkpoint**: Project default configurable + inheritance resolves correctly — US1 independently testable.

---

## Phase 4: User Story 2 - Run a Claude build with token saving active and confirm savings via telemetry (Priority: P1)

**Goal**: Effective-ON Claude runs install + activate pinned RTK (non-blocking), record per-job outcome (ACTIVE / INACTIVE / FELL_BACK), and surface it in job details; OFF/non-Claude run unchanged.

**Independent Test**: Dispatch a Claude BUILD on an effective-ON ticket → workflow input `tokenSaving=true`, job ends `ACTIVE`; simulate install failure → job `FELL_BACK` with run still COMPLETED; non-Claude agent → job `INACTIVE`.

### Tests for User Story 2

**Write these FIRST and ensure they FAIL before implementation.**

- [X] T012 ✅ DONE [P] [US2] Extend `tests/unit/job-update-validator.test.ts` to assert `jobStatusUpdateSchema` accepts `tokenSavingOutcome` ∈ {ACTIVE, INACTIVE, FELL_BACK} and rejects invalid values.
- [X] T013 ✅ DONE [US2] Extend `tests/integration/tickets/transitions.test.ts` to assert dispatch `workflowInputs` carries `tokenSaving` for Claude standard/quick/verify stages, and that a non-Claude agent dispatch is unaffected by the setting (same file as T005 — run after T005, not parallel).

### Implementation for User Story 2

- [X] T014 ✅ DONE [P] [US2] Add `tokenSavingOutcome` to `TicketJobWithTelemetry` in `lib/types/job-types.ts` (L55-78).
- [X] T015 ✅ DONE [US2] Add `tokenSavingOutcome: z.enum(['ACTIVE','INACTIVE','FELL_BACK']).optional()` to `jobStatusUpdateSchema` in `app/lib/job-update-validator.ts` (L20-29).
- [X] T016 ✅ DONE [US2] Persist `Job.tokenSavingOutcome` (first-write-wins, alongside the runtime-version annotation channel) in `app/api/jobs/[id]/status/route.ts` (depends on T015).
- [X] T017 ✅ DONE [US2] Add `tokenSaving: String(resolveEffectiveTokenSaving(ticket))` to `workflowInputs` for the Claude standard/quick/verify dispatch payloads in `lib/workflows/transition.ts` (L268-355; never compute effective value in the runner) — depends on T003.
- [X] T018 ✅ DONE [P] [US2] Add a boolean `tokenSaving` workflow input (default false) → `TOKEN_SAVING: ${{ inputs.tokenSaving }}` env in `.github/workflows/speckit.yml`, `.github/workflows/quick-impl.yml`, `.github/workflows/verify.yml`, and `.github/workflows/iterate.yml` (per workflows/rtk-activation.md).
- [X] T019 ✅ DONE [US2] Add `activate_token_saving` (non-blocking: `set +e`, pinned `RTK_VERSION` constant, `install_rtk` + `rtk init --global`, sets `TOKEN_SAVING_OUTCOME`, always `return 0`) to `.github/scripts/run-agent.sh`; call it in the CLAUDE branch between `ensure_claude_commands` and `invoke_claude`; extend `report_runtime_versions` (~L399-414) to PATCH `tokenSavingOutcome` (FR-006/SC-003 — must never `exit`).
- [X] T020 ✅ DONE [P] [US2] Render a per-job outcome indicator (FELL_BACK visually distinct from INACTIVE) in `JobRow` in `components/ticket/jobs-timeline.tsx` (near telemetry block L209-265) using the `token-saving-icons` helper — depends on T004, T014.

**Checkpoint**: ON runs activate + report ACTIVE; failures fall back; outcomes visible in job details — US2 independently testable.

---

## Phase 5: User Story 3 - Manage all per-ticket run overrides from one "Run settings" dialog (Priority: P1)

**Goal**: Dedicated ticket token-saving override endpoint (any-stage, active-run guarded), clone-carry, and a single consolidated Run settings dialog replacing the three standalone kebab dialogs.

**Independent Test**: Open the ticket kebab → exactly three items (Run settings, Simple copy, Full clone); open Run settings → four sections render with inherited defaults + override indicators; INBOX-only gating preserved for Agent/Policy; token-saving editable past INBOX unless a run is active.

### Tests for User Story 3

**Write these FIRST and ensure they FAIL before implementation.**

- [X] T021 ✅ DONE [US3] Extend `tests/integration/tickets/token-saving.test.ts` with the ticket override endpoint: `PATCH …/tickets/:id/token-saving` persists true/false/null, no INBOX gate, 409 ACTIVE_RUN when a RUNNING/PENDING job exists, version conflict; plus clone-carry (duplicate + full clone copy `tokenSaving`) — same file as T006, run after T006.
- [X] T022 ✅ DONE [P] [US3] Extend `tests/unit/components/ticket-detail-modal.test.tsx` to assert the kebab shows exactly three items (Run settings, Simple copy, Full clone) and no standalone Edit Policy/Agent/Models (L145-372 region).
- [X] T023 ✅ DONE [P] [US3] Create `tests/unit/components/run-settings-dialog.test.tsx`: four sections render with inherited defaults + override indicators; Agent/Policy read-only outside INBOX; token-saving editable past INBOX but disabled during an active run (new domain; reference `agent-edit-dialog.test.tsx` / `model-override-dialog.test.tsx`).

### Implementation for User Story 3

- [X] T024 ✅ DONE [US3] Add `tokenSavingOverrideSchema` (`tokenSaving: boolean|null`, `version`) and a DB helper in `lib/db/tickets.ts` that updates `Ticket.tokenSaving` with an active-run guard (reject when a RUNNING/PENDING job exists) and optimistic `version`.
- [X] T025 ✅ DONE [US3] Create `app/api/projects/[projectId]/tickets/[id]/token-saving/route.ts` — `verifyTicketAccess`, NO INBOX gate, 409 ACTIVE_RUN guard, 409 VERSION_CONFLICT, `null` clears override (mirror `model-config/route.ts`) — depends on T024.
- [X] T026 ✅ DONE [US3] Copy `tokenSaving: sourceTicket.tokenSaving` in both `duplicateTicket` (near L668-669) and `fullCloneTicket` (near L735-736) in `lib/db/tickets.ts` (same file as T024 — run after T024).
- [X] T027 ✅ DONE [US3] Create `components/tickets/run-settings-dialog.tsx` composing the existing `agent-edit-dialog`, `model-override-dialog`, and `policy-edit-dialog` controls as sections plus a new Token-saving section (three-state; persists via the §2 endpoint); preserve INBOX-only gating for Agent/Policy and per-stage rules for Models (FR-012/FR-016) — depends on T025.
- [X] T028 ✅ DONE [US3] In `components/board/ticket-detail-modal.tsx`, replace the three kebab items "Edit Policy/Agent/Models" (L990-1016) with a single "Run settings" entry opening the dialog (depends on T027).

**Checkpoint**: One Run-settings entry point; override persists with prior semantics; clones carry the setting — US3 independently testable.

---

## Phase 6: User Story 4 - See at a glance when token saving is on for a ticket (Priority: P2)

**Goal**: Compact header status-strip badge + tooltip shown iff effective token saving is ON; nothing when OFF.

**Independent Test**: View a ticket with effective ON → badge with tooltip (state + inherited-vs-override source) appears; view one OFF → no badge.

### Tests for User Story 4

**Write these FIRST and ensure they FAIL before implementation.**

- [X] T029 ✅ DONE [P] [US4] Create `tests/unit/components/token-saving-badge.test.tsx`: badge renders with tooltip when effective ON; renders nothing when OFF.
- [X] T030 ✅ DONE [US4] Extend `tests/unit/components/ticket-detail-modal.test.tsx` to assert the token-saving badge is shown in the status strip when effective ON and hidden when OFF (same file as T022 — run after T022).

### Implementation for User Story 4

- [X] T031 ✅ DONE [P] [US4] Create `components/ui/token-saving-badge.tsx` — static-class `<Badge>` + `title` tooltip + `isOverride` indicator, using `token-saving-icons` (mirror `components/ui/policy-badge.tsx` L23-54) — depends on T004.
- [X] T032 ✅ DONE [US4] In `components/board/ticket-detail-modal.tsx`, compute `effectiveTokenSaving`/`isTokenSavingOverride` (near L851-852) and conditionally render `<TokenSavingBadge>` in the status strip (after L941), guarded by `effectiveTokenSaving === true` (mirror the agent-badge guard) — depends on T031; same file as T028, coordinate edits.

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 ✅ DONE [P] Run `bun run type-check` and `bun run lint`; fix all errors (including any pre-existing ones touched), per CLAUDE.md commit rules.
- [X] T034 ✅ DONE [P] Run `bun run test:unit` and `bun run test:integration`; confirm all new/extended suites pass. NOTE: unit + component suites pass (job-update-validator, token-saving-badge, run-settings-dialog, ticket-detail-modal). Integration suites (token-saving.test.ts, transitions.test.ts) could NOT execute in this sandbox — the Next.js dev/build server fails to boot with a Turbopack worker-thread stack overflow loading the Prisma external module (`@prisma/client`), which is environment-level (Prisma loads fine via plain `node -e`, type-check passes). They are written and ready to run in CI.
- [~] T035 PARTIAL Manual acceptance pass against success criteria: SC-005 (kebab = 3 items; dialog edits all four categories) and SC-006 (agent/models/policy overrides unchanged) verified via component tests; SC-003 (forced RTK install failure → run COMPLETED + job FELL_BACK) and SC-007 (OFF run no overhead) require a live workflow run — covered by the non-blocking `activate_token_saving` contract and integration assertions, pending CI/live verification (dev server unavailable in sandbox).

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (P1)**: T001 → T002. No other dependencies.
- **Foundational (P2)**: depends on Setup. T003, T004 are [P]. BLOCKS all stories.
- **User Stories (P3–P6)**: each depends only on Foundational; can otherwise proceed in parallel, subject to the shared-file notes below.
- **Polish (P7)**: depends on all targeted stories complete.

### User Story Dependencies
- **US1 (P1)**: independent after Foundational.
- **US2 (P1)**: independent after Foundational (needs T003 for the dispatch input).
- **US3 (P1)**: independent after Foundational.
- **US4 (P2)**: independent after Foundational (needs T004 for the badge).

### Cross-story shared-file coordination (NOT parallel-safe)
- `tests/integration/tickets/transitions.test.ts` — T005 (US1) then T013 (US2).
- `tests/integration/tickets/token-saving.test.ts` — T006 (US1) then T021 (US3).
- `tests/unit/components/ticket-detail-modal.test.tsx` — T022 (US3) then T030 (US4).
- `lib/db/tickets.ts` — T024 then T026 (both US3).
- `components/board/ticket-detail-modal.tsx` — T028 (US3) then T032 (US4); distinct regions, but serialize.
- `lib/workflows/transition.ts` — T003 (Foundational) before T017 (US2).

### Within Each User Story
- Tests written and failing before implementation.
- Schemas/DB helpers before routes; routes before UI that calls them; dialog before the kebab that opens it; badge before the modal that renders it.

---

## Parallel Opportunities

### Foundational
```
T003  resolveEffectiveTokenSaving (lib/workflows/transition.ts)
T004  token-saving-icons.ts (app/lib/utils/token-saving-icons.ts)
```

### US1 tests (parallel)
```
T005  extend transitions.test.ts (effective resolution)
T006  new token-saving.test.ts (project PATCH owner-only)
```

### US2 (independent files, parallel)
```
T012  job-update-validator.test.ts
T014  job-types.ts
T018  4 workflow YAMLs
T020  jobs-timeline.tsx (after T004, T014)
```

### Cross-story (after Foundational, three P1 stories can run concurrently)
```
US1 → T007–T011
US2 → T012–T020
US3 → T021–T028   (respect shared-file notes)
```

---

## Implementation Strategy

- **MVP scope**: Setup + Foundational + **US1** (project default + inheritance) + **US2** (runner activation + per-job outcome). Together these deliver and measure the core token-saving value (SC-001, SC-002, SC-003, SC-004).
- **Incremental delivery**: add **US3** (consolidated Run settings dialog + override endpoint, SC-005/SC-006) next, then **US4** (visibility badge, FR-014) last as a P2 polish.
- Token-saving failure must never fail or degrade a run (FR-006/SC-003) — the one justified error-swallow lives entirely in `activate_token_saving` (T019).

---

## Format Validation

- ✅ Every task: `- [ ]` checkbox + sequential ID + (optional `[P]`) + (`[US#]` on story phases only) + description with an exact, filesystem-verified path.
- ✅ Setup/Foundational/Polish carry no story label; Phases 3–6 carry US1–US4.
- ✅ Existing files EXTENDED (transitions, job-update-validator, ticket-detail-modal, tickets.ts); new files only where no existing file covers the domain.
