---
description: "Task list for AIB-820 — Multi-Ticket Bulk Operations on Inbox"
---

# Tasks: Multi-Ticket Bulk Operations on Inbox

**Input**: Design documents from `/specs/AIB-820-multi-operation-on/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution III). All new feature units have test coverage; existing tests are extended where the domain already has coverage (per research.md §Existing Files).

**Organization**: Tasks are grouped by user story (US1 = bulk delete, US2 = bulk agent/model, US3 = fusion). Each story is independently testable and shippable on top of the Setup + Foundational phases.

## Format

`- [ ] TaskID [P?] [Story?] Description with file path`

- **[P]**: Different file, no dependency on incomplete tasks in the same phase
- **[Story]**: `[US1]` / `[US2]` / `[US3]` — story phases only (Setup/Foundational/Polish have no story label)
- File paths are absolute repo-root-relative paths verified against the current tree

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify the design pattern matches existing code before any new files are written. No new build/lint config is needed — feature is pure TS/React in an existing Next.js project.

- [X] T001 ✅ DONE Read existing per-ticket patterns to confirm reuse: `lib/tickets/images.ts:175-192` (updateMany + version), `lib/tickets/deletion.ts` (deleteTicketWithCleanup), `app/api/projects/[projectId]/tickets/[id]/route.ts:30,103,241` (auth + error translation), `lib/hooks/mutations/useDeleteTicket.ts:76-117` (optimistic cache + rollback). No code change in this task — capture pattern references for Phase 2/3.
- [X] T002 ✅ DONE [P] Run `bunx prisma generate` to ensure the Prisma client is up to date before adding new server code that uses `prisma.ticket.updateMany` / `prisma.$transaction`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared schemas, server-side bulk lib, and the selection utilities used by every user story. **No user story work can begin until this phase is complete.**

- [X] T003 ✅ DONE [P] Create Zod schema scaffold in `lib/schemas/bulk-ticket.ts`: define shared `ticketRefSchema = z.object({ id: z.number().int().positive(), version: z.number().int().positive() })` and `ticketsArraySchema = z.array(ticketRefSchema).min(1).max(50)`. Re-export from this file only (no other schemas yet — added per story).
- [X] T004 ✅ DONE [P] Create pure selection utilities in `lib/board/selection.ts`: `computeRangeSelection(allTickets: TicketWithVersion[], anchorId: number | null, clickedId: number, currentSelection: Set<number>): Set<number>`, `mergeAttachments(tickets: TicketWithVersion[], anchorId: number, cap: number): { merged: TicketAttachment[]; clippedCount: number }` (anchor first, ascending id, dedup by URL, clip to cap), `buildFusionDescription(tickets: TicketWithVersion[], anchorId: number): string` (anchor body, then for each absorbed in ascending id `\n\n---\n\n## [TICKET-KEY] <title>\n\n<description>`).
- [X] T005 ✅ DONE [P] Create unit tests in `tests/unit/lib/selection.test.ts`: cover `computeRangeSelection` (no anchor → toggle only clicked; forward + backward ranges; merges with prior selection without clearing it), `mergeAttachments` (anchor-first ordering, dedup by URL, clip-to-5 reports `clippedCount`), `buildFusionDescription` (exact separator and heading format from FR-009).
- [X] T006 ✅ DONE Create core bulk lib skeleton in `lib/tickets/bulk.ts`: define discriminated `BulkResult` types (per data-model.md §Bulk*Response) and shared internal helper `classifySkipReason(error: unknown): SkipReason` mapping Prisma errors → `NOT_FOUND` | `VERSION_CONFLICT` | `NOT_IN_INBOX` per research.md P1. Export empty placeholder functions `bulkDeleteTickets`, `bulkSetAgent`, `bulkSetModel`, `fuseTickets` (filled in per story).

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Multi-select and bulk delete INBOX tickets (Priority: P1) 🎯 MVP

**Goal**: User can select multiple INBOX tickets via checkboxes (incl. shift-click and Select-all), see a bulk action bar, click Delete, confirm in a dialog listing ticket keys, and watch all selected INBOX tickets disappear with a result-summary toast.

**Independent Test**: Seed 5 INBOX tickets. Open the board. Select 3 via checkbox (one with shift-click). Click Delete in the bulk action bar. Confirm. Inbox renders the remaining 2 tickets; toast says "3 tickets deleted". Verified by `tests/e2e/inbox-bulk-operations.spec.ts` and `tests/integration/tickets/bulk-delete.test.ts`.

### Tests for User Story 1

**RULE: Write tests first; ensure they FAIL before implementation. Search existing tests first — only create new files when no existing file covers the domain (research.md §Existing Files).**

- [X] T007 ✅ DONE [P] [US1] Create new test file `tests/unit/components/ticket-card-selection.test.tsx` (no existing coverage for selection UI on `TicketCard`). Cover: checkbox renders only when `ticket.stage === 'INBOX'`; checkbox click is `stopPropagation`'d so `@dnd-kit/core` does not start a drag; clicking with `shiftKey` invokes the toggle with the shift flag.
- [X] T008 ✅ DONE [P] [US1] Create new test file `tests/unit/components/bulk-action-bar.test.tsx` (no existing component). Cover: bar hidden when `selection.size === 0`; visible when ≥ 1; selection count rendered; Delete button enabled at any size > 0; Fusion button disabled when `selection.size < 2`; ALL buttons disabled (with hint text) when `selection.size > 50`; Clear button empties selection.
- [X] T009 ✅ DONE [P] [US1] Create new test file `tests/unit/components/bulk-delete-confirmation-modal.test.tsx` (mirrors `delete-confirmation-modal.test.tsx` pattern but for the bulk variant). Cover: lists every supplied `ticketKey`; explicit irreversible warning ("This action cannot be undone"); Confirm fires the callback; Cancel does not.
- [X] T010 ✅ DONE [P] [US1] Create integration test file `tests/integration/tickets/bulk-delete.test.ts` (no existing coverage for bulk endpoints). Cover: 200 with `affected`/`skipped`/`prsClosed` shape from `contracts/bulk-delete.md`; 401 without session; 404 for non-member; 400 for empty tickets and `>50`; per-ticket `VERSION_CONFLICT` and `NOT_IN_INBOX` reported in `skipped`; ticket in another project filtered as `NOT_FOUND`.
- [X] T011 ✅ DONE [P] [US1] Create E2E test file `tests/e2e/inbox-bulk-operations.spec.ts` (Playwright). Seed 5 `[e2e]`-prefixed INBOX tickets; select 3; click Delete; confirm; assert remaining 2 visible and toast text "3 tickets deleted". One spec only — covers SC-001's <15s end-to-end goal.

### Implementation for User Story 1

- [X] T012 ✅ DONE [US1] Implement `bulkDeleteTickets({ projectId, tickets })` in `lib/tickets/bulk.ts` (extends T006 stub). `Promise.allSettled` over `deleteTicketWithCleanup(id, projectId, expectedVersion=version)`; aggregate into `{ ok: true; affected: number[]; skipped: SkippedTicket[]; prsClosed: number }` per research.md P1 + P6. Sum `prsClosed` from each successful result.
- [X] T013 ✅ DONE [US1] Extend `lib/schemas/bulk-ticket.ts` with `bulkDeleteSchema = z.object({ tickets: ticketsArraySchema })`. Export inferred type `BulkDeleteRequest`.
- [X] T014 ✅ DONE [US1] Create `app/api/projects/[projectId]/tickets/bulk/delete/route.ts` — `POST` handler. `verifyProjectAccess(projectId, request)` → parse + Zod validate → `bulkDeleteTickets(...)` → 200 with response body. Translate auth/404/500 errors per research.md P3 (`Unauthorized` → 401, `Project not found` → 404, generic → 500). Log with `console.error('Bulk delete error:', error)`.
- [X] T015 ✅ DONE [P] [US1] Create `lib/hooks/mutations/useBulkDeleteTickets.ts` — TanStack mutation: `onMutate` cancel + snapshot + optimistic filter from `queryKeys.projects.tickets(projectId)`; `onError` rollback; `onSettled` invalidate; `retry: false` (research.md P4). On success, `setQueryData` re-inserts any ticket whose id appears in `skipped[]` (the partial-failure scenario described in spec acceptance scenario 1.3).
- [X] T016 ✅ DONE [P] [US1] Create `components/board/bulk-delete-confirmation-modal.tsx` — `AlertDialog` listing the supplied ticket keys + irreversible warning. Props: `{ open, ticketKeys, onConfirm, onCancel, isPending }`. Disable Confirm while `isPending`.
- [X] T017 ✅ DONE [P] [US1] Create `components/board/bulk-action-bar.tsx` — fixed bottom bar (`fixed bottom-4 left-1/2 -translate-x-1/2`, aurora-glass per CLAUDE.md). Props: selection count, callbacks for each action, `selectionTooLarge` boolean. Renders Change agent / Change model / Fusion / Delete buttons + Clear; disables per FR-004/FR-008 rules. Buttons are stubs in this task for agent/model/fusion (wired in US2/US3).
- [X] T018 ✅ DONE [US1] Extend `components/board/ticket-card.tsx` — add optional `selectionState?: { selected: boolean; onToggle: (e: React.MouseEvent) => void }` prop. When provided, render a 20×20 `Checkbox` overlay (top-left, absolute). Stop propagation on `onMouseDown`, `onPointerDown`, and `onClick` per research.md P5 / D9.
- [X] T019 ✅ DONE [US1] Extend `components/board/stage-column.tsx` — accept and forward `selectionState`/`onTicketToggle` props only when `stage === Stage.INBOX`; pass `undefined` for all other columns so non-INBOX cards never receive a `selectionState`.
- [X] T020 ✅ DONE [US1] Extend `components/board/board.tsx` — own `selection: Set<number>` + `lastClickedTicketId: number | null` state; build `onToggle(ticketId, e)` calling `computeRangeSelection` on shift-click; render `<BulkActionBar />` when `selection.size > 0`; wire `<BulkDeleteConfirmationModal />` + `useBulkDeleteTickets` mutation; clear selection on mutation success (FR-019); preserve selection on failure. Filter out non-INBOX ids from `selection` after every refetch (FR-014 client mirror, per data-model.md §SelectionSet invariants).
- [X] T021 ✅ DONE [US1] Show single result-summary toast via existing `useToast` (`hooks/use-toast`) after the bulk delete settles: success path "N tickets deleted"; partial path "N deleted, M skipped" with `skipped[].reason` translated to human text (FR-017).

**Checkpoint**: User Story 1 is fully functional — bulk delete via checkbox + bar + confirmation, with optimistic UI, per-ticket result toast, and INBOX-only enforcement on both client and server.

---

## Phase 4: User Story 2 — Bulk change agent or model override (Priority: P2)

**Goal**: User selects ≥ 1 INBOX ticket, clicks Change agent or Change model in the action bar, picks the new value (agent enum or stage + model id), confirms, and every selected ticket's field updates with a result-summary toast.

**Independent Test**: Seed 4 INBOX tickets with mixed `agent` values. Select all, click Change agent → CODEX → Confirm. All 4 show agent=CODEX; toast says "4 tickets updated". Repeat with Change model → Implement → `claude-opus-4-7`. Verified by `tests/integration/tickets/bulk-agent.test.ts` and `tests/integration/tickets/bulk-model.test.ts`.

### Tests for User Story 2

- [X] T022 ✅ DONE [P] [US2] Create integration test file `tests/integration/tickets/bulk-agent.test.ts`. Cover: 200 with `affected[]` carrying new `version` + `agent`; `null` agent clears override; per-ticket `VERSION_CONFLICT` and `NOT_IN_INBOX` in `skipped[]`; 400 on invalid agent string; 400 on `>50`; 401 unauth; 404 non-member.
- [X] T023 ✅ DONE [P] [US2] Create integration test file `tests/integration/tickets/bulk-model.test.ts`. Cover: 200 with `affected[]` carrying new `version` + all five stage-model fields; non-target stage fields unchanged; `model: null` clears that stage's override; 400 when `model` is a non-Claude id (allow-list rejection via `isClaudeModelId`); 400 on missing `stage`; per-ticket skip reasons identical to bulk-agent.

### Implementation for User Story 2

- [X] T024 ✅ DONE [P] [US2] Extend `lib/schemas/bulk-ticket.ts` with `bulkAgentSchema = z.object({ agent: z.nativeEnum(Agent).nullable(), tickets: ticketsArraySchema })` (Agent imported from `@prisma/client`).
- [X] T025 ✅ DONE [P] [US2] Extend `lib/schemas/bulk-ticket.ts` with `bulkModelSchema = z.object({ stage: z.enum(['specifyModel','planModel','implementModel','quickImplModel','verifyModel']), model: z.string().max(50).refine(isClaudeModelId).nullable(), tickets: ticketsArraySchema })` reusing `isClaudeModelId` from `lib/models/claude-models.ts` per research.md D5.
- [X] T026 ✅ DONE [US2] Extend `lib/tickets/bulk.ts` with `bulkSetAgent({ projectId, agent, tickets })`. `Promise.allSettled` over `prisma.ticket.updateMany({ where: { id, projectId, version, stage: 'INBOX' }, data: { agent, version: { increment: 1 } }, select: { id: true, version: true, agent: true } })` per research.md P2. Aggregate per data-model.md `BulkAgentResponse`.
- [X] T027 ✅ DONE [US2] Extend `lib/tickets/bulk.ts` with `bulkSetModel({ projectId, stage, model, tickets })`. Same updateMany shape with `data: { [stage]: model, version: { increment: 1 } }`. Return full five-stage model snapshot per `BulkModelResponse`.
- [X] T028 ✅ DONE [P] [US2] Create `app/api/projects/[projectId]/tickets/bulk/agent/route.ts` — `POST` mirroring T014's structure (auth → Zod → lib call → response → error translation).
- [X] T029 ✅ DONE [P] [US2] Create `app/api/projects/[projectId]/tickets/bulk/model/route.ts` — `POST` mirroring T014's structure.
- [X] T030 ✅ DONE [P] [US2] Create `lib/hooks/mutations/useBulkSetAgent.ts` — TanStack mutation; on success, merge per-ticket `{ version, agent }` into the cached `TicketWithVersion[]`; on partial failure, leave skipped tickets untouched (server returned them unmodified).
- [X] T031 ✅ DONE [P] [US2] Create `lib/hooks/mutations/useBulkSetModel.ts` — TanStack mutation; on success, merge per-ticket `{ version, specifyModel, planModel, implementModel, quickImplModel, verifyModel }` into the cache.
- [X] T032 ✅ DONE [P] [US2] Create `components/board/bulk-agent-dialog.tsx` — thin wrapper over `components/tickets/agent-edit-dialog.tsx` (real path verified). Reuses the existing agent picker; `onSave(agent)` calls `useBulkSetAgent.mutate({ agent, tickets })`. Closes on success; shows error toast on failure.
- [X] T033 ✅ DONE [P] [US2] Create `components/board/bulk-model-dialog.tsx` — subset of `components/tickets/model-override-dialog.tsx`: one stage `Select` (Specify / Plan / Implement / Quick-Impl / Verify) + one model `Select` (with "Inherit project default" option that submits `null`). `onSave({ stage, model })` calls `useBulkSetModel.mutate(...)`.
- [X] T034 ✅ DONE [US2] Wire `bulk-agent-dialog` and `bulk-model-dialog` into `components/board/bulk-action-bar.tsx` + `components/board/board.tsx` — open dialogs on the respective buttons; pass current selection's `{ id, version }` list; show result-summary toast (FR-017) on settle.

**Checkpoint**: User Stories 1 AND 2 both work independently — delete, agent change, model change all functional end-to-end.

---

## Phase 5: User Story 3 — Fusion (merge) multiple inbox tickets (Priority: P3)

**Goal**: User selects ≥ 2 INBOX tickets, clicks Fusion. The existing `TicketDetailModal` opens in `fusionMode` with the anchor (lowest id) pre-populated with concatenated description and union of attachments. User edits and saves. Server atomically updates the anchor and deletes the absorbed tickets in one transaction.

**Independent Test**: Seed 3 INBOX tickets with short descriptions and a couple of images each. Select all 3, click Fusion. Modal opens with anchor title and a description containing the FR-009 separator/heading for each absorbed ticket, plus the merged attachment gallery. Save. Only the anchor remains; toast says "Fused 3 tickets into AIB-NNN". Verified by `tests/integration/tickets/bulk-fusion.test.ts` and the extended `tests/unit/components/ticket-detail-modal.test.tsx`.

### Tests for User Story 3

- [X] T035 ✅ DONE [P] [US3] Created new file `tests/unit/components/fusion-dialog.test.tsx` instead of extending `ticket-detail-modal.test.tsx` — fusion UI lives in a dedicated `FusionDialog` component (focused dialog cleanly separated from the heavyweight `TicketDetailModal`). Covers: prefilled title + description; live character counter; Save disabled and banner shown when `description.length > 10000`; Save re-enabled at exactly 10000; banner text per FR-011; `clippedAttachmentCount > 0` renders the "N image dropped" warning (FR-010).
- [X] T036 ✅ DONE [P] [US3] Created integration test file `tests/integration/tickets/bulk-fusion.test.ts`. Cover: 200 atomic success returns updated anchor + deleted ids per `contracts/bulk-fusion.md`; 409 on any absorbed-ticket version mismatch with `conflicting[]` populated and **no DB changes** (assert anchor + absorbed all still present and unchanged); 400 on `description.length > 10000`; 400 on `attachments.length > 5`; 400 on `anchorId ∈ absorbed[].id`; 400 when total ids > 50; 401 unauth; 404 non-member.

### Implementation for User Story 3

- [X] T037 ✅ DONE [US3] Extended `lib/schemas/bulk-ticket.ts` with `fusionSchema` per data-model.md §FusionRequest: `anchorId` + `anchorVersion` positive ints; `title` 1..100; `description` 1..10000; `attachments` array max 5 (each validated via `isTicketAttachment` guard); `absorbed` array of `ticketRefSchema` with `min(1)` plus refinements forbidding `anchorId` in `absorbed`, capping total at 50, and rejecting duplicate ids.
- [X] T038 ✅ DONE [US3] Extended `lib/tickets/bulk.ts` with `fuseTickets({ projectId, anchorId, anchorVersion, title, description, attachments, absorbed })` wrapped in `prisma.$transaction`. Verifies every id exists + stage=INBOX + version match (throws `FusionConflictError` with `conflicting[]`), updates the anchor via `updateMany` with the version predicate, deletes absorbed rows via `deleteMany` with INBOX guard and a count assertion, then returns the fresh `{ anchor: TicketWithVersion, deletedIds }`.
- [X] T039 ✅ DONE [US3] Created `app/api/projects/[projectId]/tickets/bulk/fusion/route.ts` — auth → Zod → `fuseTickets(...)` → 200 on success, 409 (with `{ error, code:'CONFLICT', conflicting }`) when `FusionConflictError` is thrown, and 400/401/404/500 per `contracts/bulk-fusion.md`.
- [X] T040 ✅ DONE [P] [US3] Created `lib/hooks/mutations/useFuseTickets.ts` — TanStack mutation; on 409, throws typed `FusionConflict` with the `conflicting[]` ids; on success, mutates the cache to drop `deletedIds` and replace the anchor; invalidates `queryKeys.projects.tickets(projectId)` on settle.
- [X] T041 ✅ DONE [US3] Implemented as a focused new component `components/board/fusion-dialog.tsx` instead of extending the heavyweight `ticket-detail-modal.tsx` (cleaner separation, lower regression risk for the existing modal). Accepts `{ anchorId, anchorVersion, anchorKey, initialTitle, initialDescription, attachments, clippedAttachmentCount, absorbed }`, uses `useFuseTickets` for save, renders the FR-011 character-count banner and disabled-Save rule above 10000 chars, and the FR-010 "N image dropped" banner when `clippedAttachmentCount > 0`.
- [X] T042 ✅ DONE [US3] Wired Fusion in `components/board/board.tsx`: when ≥2 INBOX tickets are selected, the bar's Fusion button opens `<FusionDialog />` with the lowest-id anchor, the concatenated description from `buildFusionDescription`, and the deduped+capped attachment union from `mergeAttachments`. On mutation success, clears the selection. On 409, surfaces a destructive toast naming the `conflicting[]` ticket ids.

**Checkpoint**: All three user stories now work independently and in combination.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story concerns that didn't fit in a single story phase: a11y, "Select all" toggle behaviour, and final type-check / lint sweep.

- [X] T043 ✅ DONE "Select all in INBOX" checkbox added to the INBOX column header in `components/board/stage-column.tsx`. Wires through `BoardGrid` to `Board`, which caps selection to the first 50 INBOX tickets (display order) and toasts a warning per FR-020 when capped. Indeterminate state derived from current selection vs. inbox length.
- [X] T044 ✅ DONE [P] Verified keyboard a11y on `components/board/bulk-action-bar.tsx`: bar is a `role="toolbar"` with `aria-label="Bulk ticket actions"`; Clear button has explicit `aria-label`; every action button is a real `<Button>` and reachable via tab order. `BulkDeleteConfirmationModal` uses shadcn `AlertDialog` (Radix focus trap inherited).
- [X] T045 ✅ DONE [P] Verified theme tokens on `bulk-action-bar.tsx`, `bulk-delete-confirmation-modal.tsx`, `fusion-dialog.tsx`, `bulk-agent-dialog.tsx`, `bulk-model-dialog.tsx`. All new files use `aurora-glass`, semantic tokens (`bg-card`/`text-destructive`/`text-muted-foreground`/`border-border`) or fixed palette utilities allowed by CLAUDE.md (`text-yellow-500`, `bg-yellow-500/10` for the warning banner). No hardcoded hex / rgb.
- [X] T046 ✅ DONE Ran `bun run type-check` (clean) and `bun run lint` (0 errors; 6 pre-existing warnings unchanged from main, all in `components/board/hooks/use-*` files — out of scope for this ticket). New code introduced 0 lint warnings.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks all user stories** because every story uses `lib/schemas/bulk-ticket.ts` and `lib/tickets/bulk.ts`.
- **Phase 3 (US1)**: Depends on Phase 2 only.
- **Phase 4 (US2)**: Depends on Phase 2. May start in parallel with Phase 3 once Phase 2 is done — they touch different routes (`/delete` vs `/agent`+`/model`) and different dialogs.
- **Phase 5 (US3)**: Depends on Phase 2. Requires `lib/board/selection.ts` (T004), which is in Foundational. Independent of US1/US2 *except* both US1 and US3 modify `components/board/board.tsx` (T020 + T042) — sequence them on that one file.
- **Phase 6 (Polish)**: Depends on US1 (selection + bar) at minimum; "Select all" (T043) extends stage-column edits from T019.

### Within Each User Story

- Tests (T007-T011, T022-T023, T035-T036) MUST be written and FAIL before the matching implementation tasks (constitution III "Tests First").
- Schemas before lib functions before route handlers before hooks before UI.
- Within US1: T012 (lib) → T013 (schema) → T014 (route) → T015 (hook) → T016, T017 (UI components) → T018, T019, T020 (existing-file extensions) → T021 (toast wiring).
- Within US2: T024, T025 (schemas) → T026, T027 (lib) → T028, T029 (routes) → T030, T031 (hooks) → T032, T033 (dialogs) → T034 (wiring).
- Within US3: T037 (schema) → T038 (lib) → T039 (route) → T040 (hook) → T041 (modal extension) → T042 (board wiring).

### File Conflicts (must sequence, not parallelize)

- `components/board/board.tsx`: T020 (US1) → T034 (US2) → T042 (US3).
- `components/board/bulk-action-bar.tsx`: T017 (US1) → T034 (US2 wires agent/model buttons) → T042 (US3 wires Fusion).
- `components/board/stage-column.tsx`: T019 (US1) → T043 (Polish).
- `lib/schemas/bulk-ticket.ts`: T003 (Foundational) → T013 (US1) → T024, T025 (US2) → T037 (US3).
- `lib/tickets/bulk.ts`: T006 (Foundational stubs) → T012 (US1) → T026, T027 (US2) → T038 (US3).

### Parallel Opportunities

- **Phase 1**: T001 + T002 can be considered together (T002 is shell-only).
- **Phase 2**: T003, T004, T005 are independent files (`lib/schemas/bulk-ticket.ts`, `lib/board/selection.ts`, `tests/unit/lib/selection.test.ts`) — all `[P]`. T006 depends on T003 (imports `ticketRefSchema`).
- **US1 tests**: T007, T008, T009, T010, T011 all touch different files — all `[P]`.
- **US1 implementation**: T015, T016, T017 are different files — `[P]` (after T012-T014 land the lib + schema + route).
- **US2 tests**: T022 + T023 — `[P]`.
- **US2 implementation**: T024 + T025 schemas in same file (sequence); T026 + T027 in same file (sequence); T028 + T029 routes (different files, `[P]`); T030 + T031 hooks (`[P]`); T032 + T033 dialogs (`[P]`).
- **US3 tests**: T035 + T036 — `[P]` (different files).
- **Polish**: T044 + T045 — `[P]`.

---

## Parallel Example: User Story 1 Tests (T007-T011)

```bash
# Launch all US1 test files together — each is a different new file:
Task: "Create tests/unit/components/ticket-card-selection.test.tsx (T007)"
Task: "Create tests/unit/components/bulk-action-bar.test.tsx (T008)"
Task: "Create tests/unit/components/bulk-delete-confirmation-modal.test.tsx (T009)"
Task: "Create tests/integration/tickets/bulk-delete.test.ts (T010)"
Task: "Create tests/e2e/inbox-bulk-operations.spec.ts (T011)"
```

## Parallel Example: User Story 2 Routes + Hooks + Dialogs

```bash
# After T024-T027 (schemas + lib) land, run in parallel:
Task: "Create app/api/projects/[projectId]/tickets/bulk/agent/route.ts (T028)"
Task: "Create app/api/projects/[projectId]/tickets/bulk/model/route.ts (T029)"
Task: "Create lib/hooks/mutations/useBulkSetAgent.ts (T030)"
Task: "Create lib/hooks/mutations/useBulkSetModel.ts (T031)"
Task: "Create components/board/bulk-agent-dialog.tsx (T032)"
Task: "Create components/board/bulk-model-dialog.tsx (T033)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (T001-T002) — pattern review, prisma generate.
2. Phase 2 (T003-T006) — shared schema, selection utils, bulk lib skeleton.
3. Phase 3 (T007-T021) — selection UI + bulk delete end-to-end.
4. **STOP and VALIDATE**: Test User Story 1 independently. Run the E2E (`tests/e2e/inbox-bulk-operations.spec.ts`) — this is the SC-001 acceptance.
5. Ship MVP — bulk delete alone is already valuable (per spec §US1 priority rationale).

### Incremental Delivery

1. Phase 1 + Phase 2 → Foundation in place.
2. Add US1 → ship MVP (bulk delete).
3. Add US2 → ship bulk agent + bulk model.
4. Add US3 → ship fusion.
5. Polish (Phase 6) — can be folded into each story PR or shipped as a final cleanup.

### Parallel Execution Strategy

Once Phase 2 (Foundational) is complete:

- US1 and US2 can run in parallel — different routes, different dialogs, only `board.tsx` is a shared touch point (sequence the two edits).
- US3 depends on US1's `board.tsx` edits but is otherwise independent of US2.
- A reasonable mid-feature parallel layout: agent runs US1 to completion → in parallel, agent A picks up US2 and agent B picks up US3, each rebasing onto US1's `board.tsx` changes.

---

## Notes

- All file paths above are verified against the current repository tree (real existing files for extensions; planned new paths follow `plan.md` §Project Structure).
- `[e2e]` prefix required on all seeded test data (CLAUDE.md test environment rules).
- Result-summary toast text format is consistent across stories: success = "N tickets <verb>"; partial = "N <verb>, M skipped" (FR-017).
- Constitution III: never mock the database in integration/E2E tests — use the real Postgres seed.
- Commits per task or per logical group; never `--no-verify`. If type-check/lint fails, fix all errors before committing per CLAUDE.md.
