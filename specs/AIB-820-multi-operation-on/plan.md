# Implementation Plan: Multi-Ticket Bulk Operations on Inbox

**Branch**: `AIB-820-multi-operation-on` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-820-multi-operation-on/spec.md`

## Summary

Add multi-select to the INBOX kanban column and four bulk operations: delete, change agent, change per-stage model override, and "fusion" (merge selected tickets into the lowest-id anchor with concatenated description and unioned attachments). Selection state lives in `Board`; a fixed bottom action bar appears when ≥1 ticket is selected. Server exposes four scoped endpoints under `/api/projects/[projectId]/tickets/bulk/{delete|agent|model|fusion}`. The first three use best-effort semantics with per-ticket result aggregation following the existing `updateMany`-with-version pattern from `lib/tickets/images.ts:175`. Fusion is atomic via `prisma.$transaction`. Reuses existing dialogs (`AgentEditDialog`, `ModelOverrideDialog`) and the existing ticket detail modal for the fusion edit step. No schema changes; all behavior derives from existing `Ticket` fields.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.95.2, shadcn/ui, @dnd-kit/core, Zod
**Storage**: PostgreSQL 14+ via Prisma (no schema changes)
**Testing**: Vitest (unit + integration), React Testing Library, Playwright (E2E)
**Target Platform**: Vercel-hosted web app (same runtime as the rest of ai-board)
**Project Type**: Web — Next.js App Router (single Next.js project; no separate frontend/backend split)
**Performance Goals**: Bulk action of ≤50 tickets completes and renders result in <3s p95 (SC-002).
**Constraints**:
- Bulk operation cap: 50 tickets per request (FR-004) — enforced both client-side and via Zod `.max(50)`.
- Description cap: 10,000 chars per Prisma schema (FR-011) — fusion modal blocks Save above this.
- Attachments per ticket cap: 5 (existing limit in `lib/tickets/images.ts:127`) — fusion clips union with a UI warning.
- INBOX-only (FR-014) — enforced via `WHERE stage = 'INBOX'` in every bulk handler.
**Scale/Scope**:
- Frontend: 1 selection state hook + 4 new dialog/bar components + modifications to 4 existing components.
- Backend: 4 new route handlers + 1 shared lib file + 1 shared Zod schema file.
- Tests: ~5 new test files + 1 extension to existing tests.

No NEEDS CLARIFICATION items remain — `research.md` documents all design decisions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Compliance |
|-----------|-----------|
| **I. TypeScript-First** | All new files in TS strict mode. Discriminated result types for bulk lib functions (P6) preserve `no any`. Public functions explicitly typed. ✅ |
| **II. Component-Driven** | New UI uses shadcn primitives (`Dialog`, `AlertDialog`, `Button`, `Checkbox`, `Badge`). Reuses `AgentEditDialog`/`ModelOverrideDialog`/`TicketDetailModal`. Files placed under `components/board/` (feature folder). Bulk action bar extracted as its own component (will exceed 40 lines & has its own state). ✅ |
| **III. TDD** | Plan creates 5 new test files + extends 1, covering selection utilities (unit), bulk dialogs (RTL), bulk endpoints (integration), and 1 E2E spec for the selection→action golden path. Existing tests are extended where the domain matches (research.md §Existing Files). RTL queries follow accessibility-first priority. ✅ |
| **IV. Security-First** | All Zod schemas mirror DB column constraints (data-model.md §Constraint Mirroring). Authorization via `verifyProjectAccess` (P3). Server-side `WHERE projectId = X AND stage = 'INBOX'` filter defeats id-tampering. No secrets in code. Re-uses existing `claudeModelIdSchema` allow-list (FR-023). ✅ |
| **V. Database Integrity** | No schema changes. Multi-row work uses `Promise.allSettled` of `updateMany` (per-row atomic) for best-effort ops, and `prisma.$transaction` for fusion (multi-table semantics). No raw SQL. Returned versions used for cache hydration (no stale in-memory reuse). ✅ |
| **V. Spec Clarification Guardrails** | Spec records 11 auto-resolved decisions; this plan adheres to all of them and does not introduce policy drift. ✅ |

**Result**: PASS. No deviations require entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```
specs/AIB-820-multi-operation-on/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions, existing files, patterns
├── data-model.md        # Phase 1 — entities + request/response shapes
├── contracts/           # Phase 1 — endpoint contracts
│   ├── bulk-delete.md
│   ├── bulk-agent.md
│   ├── bulk-model.md
│   └── bulk-fusion.md
├── spec.md              # Input feature spec
└── tasks.md             # Phase 2 — created by /ai-board.tasks (not by /ai-board.plan)
```

### Source Code (repository root)

Single Next.js project (`app/`, `components/`, `lib/`, `prisma/`, `tests/`). No backend/frontend split.

**Modified existing files**:
```
components/board/
├── board.tsx                      # own selection state, host bulk bar + fusion modal
├── stage-column.tsx               # pass selection props to INBOX cards only
├── ticket-card.tsx                # add optional checkbox overlay (INBOX cards)
└── ticket-detail-modal.tsx        # accept fusionMode prop; swap save handler
```

**New source files**:
```
app/api/projects/[projectId]/tickets/bulk/
├── delete/route.ts                # POST bulk delete
├── agent/route.ts                 # POST bulk agent
├── model/route.ts                 # POST bulk model
└── fusion/route.ts                # POST fusion

components/board/
├── bulk-action-bar.tsx            # fixed bottom action bar
├── bulk-delete-confirmation-modal.tsx
├── bulk-agent-dialog.tsx          # wraps AgentEditDialog + bulk submit
└── bulk-model-dialog.tsx          # single-stage select + model select

lib/tickets/
└── bulk.ts                        # bulkDeleteTickets, bulkSetAgent, bulkSetModel, fuseTickets

lib/schemas/
└── bulk-ticket.ts                 # bulkDeleteSchema, bulkAgentSchema, bulkModelSchema, fusionSchema

lib/hooks/mutations/
├── useBulkDeleteTickets.ts
├── useBulkSetAgent.ts
├── useBulkSetModel.ts
└── useFuseTickets.ts

lib/board/
└── selection.ts                   # computeRangeSelection, mergeAttachments, buildFusionDescription
```

**New test files** (full list in research.md §Existing Files):
```
tests/unit/components/
├── bulk-action-bar.test.tsx
├── bulk-delete-confirmation-modal.test.tsx
└── ticket-card-selection.test.tsx

tests/unit/lib/
└── selection.test.ts

tests/integration/tickets/
├── bulk-delete.test.ts
├── bulk-agent.test.ts
├── bulk-model.test.ts
└── bulk-fusion.test.ts

tests/e2e/
└── inbox-bulk-operations.spec.ts
```

**Structure Decision**: Single Next.js project layout (Option 1 of the template, but adapted to the App Router conventions already in use — `app/api/.../route.ts` for endpoints, `components/<feature>/` for UI, `lib/` for shared logic). All paths above are real, derived from the file inventory in `research.md`.

## Implementation Phases

### Phase A — Selection foundation (Priority P1 enabler)
1. `lib/board/selection.ts` — pure utilities (`computeRangeSelection`, `mergeAttachments`, `buildFusionDescription`).
2. `tests/unit/lib/selection.test.ts` — covers separator format, dedup-by-URL, range computation edge cases.
3. `components/board/ticket-card.tsx` — accept optional `selectionState?: { selected: boolean; onToggle: (e) => void }`; render checkbox overlay with pointer-event isolation per P5.
4. `components/board/stage-column.tsx` — pass selection props through only when `stage === Stage.INBOX`.
5. `components/board/board.tsx` — own `selection: Set<number>` + `lastClickedId: number | null`; wire toggle handlers; render `<BulkActionBar />` when `selection.size > 0`.
6. `components/board/bulk-action-bar.tsx` — fixed bottom bar; buttons disabled per spec rules (Fusion < 2, all > 50).
7. `tests/unit/components/ticket-card-selection.test.tsx` and `tests/unit/components/bulk-action-bar.test.tsx`.

### Phase B — Bulk delete (User Story 1, P1)
1. `lib/schemas/bulk-ticket.ts` — `bulkDeleteSchema` (Zod).
2. `lib/tickets/bulk.ts` — `bulkDeleteTickets({projectId, tickets})` — `Promise.allSettled` over `deleteTicketWithCleanup` (patterns P1 + P4 + P6 + P7 from research.md).
3. `app/api/projects/[projectId]/tickets/bulk/delete/route.ts` — POST handler (pattern P3 boilerplate).
4. `lib/hooks/mutations/useBulkDeleteTickets.ts` — TanStack mutation (pattern P4: cancelQueries → snapshot → optimistic filter → rollback → invalidate).
5. `components/board/bulk-delete-confirmation-modal.tsx` — `AlertDialog` listing ticket keys.
6. Wire delete button in `BulkActionBar` → modal → mutation → toast.
7. `tests/integration/tickets/bulk-delete.test.ts` and `tests/unit/components/bulk-delete-confirmation-modal.test.tsx`.

### Phase C — Bulk agent + bulk model (User Story 2, P2)
1. Extend `lib/schemas/bulk-ticket.ts` with `bulkAgentSchema` and `bulkModelSchema`.
2. Extend `lib/tickets/bulk.ts` with `bulkSetAgent` and `bulkSetModel` (pattern P2: `updateMany` with `stage: 'INBOX' + version` predicate).
3. `app/api/projects/[projectId]/tickets/bulk/agent/route.ts` and `.../model/route.ts`.
4. `lib/hooks/mutations/useBulkSetAgent.ts` and `useBulkSetModel.ts`.
5. `components/board/bulk-agent-dialog.tsx` — thin wrapper over `AgentEditDialog`, swapping `onSave` for the bulk mutation.
6. `components/board/bulk-model-dialog.tsx` — single-stage `Select` + model `Select` (subset of `ModelOverrideDialog` UX).
7. Wire buttons in `BulkActionBar`.
8. `tests/integration/tickets/bulk-agent.test.ts` and `tests/integration/tickets/bulk-model.test.ts`.

### Phase D — Fusion (User Story 3, P3)
1. Extend `lib/schemas/bulk-ticket.ts` with `fusionSchema`.
2. Extend `lib/tickets/bulk.ts` with `fuseTickets` — `prisma.$transaction`: per-id version+stage check, anchor update, `deleteMany` with count assertion (decision D6).
3. `app/api/projects/[projectId]/tickets/bulk/fusion/route.ts`.
4. `lib/hooks/mutations/useFuseTickets.ts`.
5. `components/board/ticket-detail-modal.tsx` — accept `fusionMode?: { absorbed; anchorVersion; clippedCount }` prop. When set, replace normal save handler with fusion mutation; render banner if `description.length > 10000`; disable Save accordingly.
6. `components/board/board.tsx` — when Fusion clicked, build `fusionDraft` via `buildFusionDescription` + `mergeAttachments`, open `TicketDetailModal` with `fusionMode` set.
7. `tests/unit/components/ticket-detail-modal.test.tsx` — extend with fusion-mode cases.
8. `tests/integration/tickets/bulk-fusion.test.ts` — atomic rollback, 409 contract, validation.

### Phase E — E2E golden path
- `tests/e2e/inbox-bulk-operations.spec.ts` — Playwright: seed 5 INBOX tickets, select 3, delete, observe inbox renders the remaining 2; one toast assertion.

## Testing Strategy

Follows Constitution III. Tests are placed by responsibility:

| Concern | Test file | Type |
|---------|-----------|------|
| Pure utilities (range select, attachment merge, description build) | `tests/unit/lib/selection.test.ts` | Vitest unit |
| Bulk action bar visibility/disabled states | `tests/unit/components/bulk-action-bar.test.tsx` | Vitest + RTL |
| Checkbox renders only in INBOX, no drag interference | `tests/unit/components/ticket-card-selection.test.tsx` | Vitest + RTL |
| Bulk delete confirmation lists ticket keys + irreversible warning | `tests/unit/components/bulk-delete-confirmation-modal.test.tsx` | Vitest + RTL |
| Fusion-mode behavior in detail modal | `tests/unit/components/ticket-detail-modal.test.tsx` (extension) | Vitest + RTL |
| Bulk delete endpoint behavior | `tests/integration/tickets/bulk-delete.test.ts` | Vitest integration |
| Bulk agent endpoint behavior | `tests/integration/tickets/bulk-agent.test.ts` | Vitest integration |
| Bulk model endpoint behavior | `tests/integration/tickets/bulk-model.test.ts` | Vitest integration |
| Fusion endpoint atomicity | `tests/integration/tickets/bulk-fusion.test.ts` | Vitest integration |
| End-to-end selection → delete journey | `tests/e2e/inbox-bulk-operations.spec.ts` | Playwright E2E |

**Test selection rationale**:
- Pure utilities → unit tests (decision tree §1).
- React components with user interactions → RTL tests (decision tree §2).
- API endpoints touching DB → integration tests (decision tree §3); E2E is **not** the default per constitution.
- Only ONE E2E test covers the user-visible end-to-end flow (SC-001's "<15 second" goal); the other user stories rely on integration + RTL combinations since none REQUIRE a real browser (no OAuth, no real drag-and-drop assertion — drag interference is verified by event-propagation assertions in RTL).
- All new project/ticket fixtures in tests use the `[e2e]` prefix as required by CLAUDE.md.

## Post-Design Constitution Re-Check

After completing Phase 0 (research.md) and Phase 1 (data-model.md + contracts/), the design re-evaluates as PASS for every principle:

- **I. TypeScript-First**: contracts and data-model surface explicit types; no `any` needed.
- **II. Component-Driven**: design reuses 3 existing dialogs/modals (AgentEditDialog, ModelOverrideDialog, TicketDetailModal) and adds 4 new small components scoped to `components/board/`.
- **III. TDD**: 5 new + 1 extended test files mapped 1:1 to feature units; no duplication of existing test coverage.
- **IV. Security-First**: every endpoint contract specifies auth, validation, and the server-side `stage='INBOX'` predicate; constraints mirror Prisma column limits.
- **V. Database Integrity**: contracts specify versioned `updateMany` for field updates and `prisma.$transaction` for fusion; no schema change.
- **V. Spec Clarification Guardrails**: design tracks every auto-resolved decision from the spec; no policy drift introduced.

Constitution Check: **PASS** post-design.

## Complexity Tracking

No constitution violations — section intentionally empty.
