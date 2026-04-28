# Implementation Plan: Inbox Ticket Analysis — Friction Risk, Recommendation, and Grounded Estimates

**Branch**: `AIB-743-inbox-ticket-analysis` | **Date**: 2026-04-27
**Spec**: `specs/AIB-743-inbox-ticket-analysis/spec.md`

> Phase 0 + Phase 1 outputs live alongside this file:
> `research.md` · `data-model.md` · `contracts/analysis-api.md` · `contracts/output-schema.md` · `workflows/inbox-analysis-workflow.md` · `workflows/inbox-analysis-command.md`

---

## Summary

Add an INBOX-only analysis panel to the ticket detail UI that surfaces a friction-risk rating, expected quality-gate range, QUICK/FULL recommendation with confidence, decomposed cost range, scope warnings, and clickable anchor citations grounded on AIB-742 outcome rows. The analysis runs as a 2-stage LLM pipeline (scoping pass → grounded estimation) dispatched via a new minimal GitHub Actions workflow, mirroring the HealthScan dispatch pattern. Results are persisted to a new append-only `TicketAnalysis` table; the latest row drives the panel; older rows are retained for audit. A "description-changed" banner offers user-triggered re-analysis. A 10-per-rolling-hour-per-user rate limit (FR-019) is enforced by an indexed query against the same table — no separate budget table.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.19.x, NextAuth.js, TanStack Query 5.95.2, Zod 4.3.6, shadcn/ui + Radix, Tailwind 3.4
**Storage**: PostgreSQL 14+ via Prisma; new `TicketAnalysis` table (append-only) — see `data-model.md`
**Testing**: Vitest (unit + integration), Playwright (single E2E happy-path for accessibility)
**Target Platform**: Linux (Vercel serverless for the app; Ubuntu GitHub Actions runners for the workflow)
**Project Type**: Web (Next.js full-stack monorepo)
**Performance Goals**:
- Trigger API (`POST .../analysis`) responds < 500 ms
- Panel render of a persisted row < 200 ms (SC-002)
- Analysis end-to-end p95 ≈ 15–25 s realistic (FR-004 / SC-001 specify 10 s p95 — research.md D1 documents the SLO gap with rationale)

**SLO acknowledgement (post-build, T066)**: SC-001 / FR-004 set a 10 s p95 target. The minimal `inbox-analysis.yml` workflow (no target-repo checkout, no service containers, no setup-bun) keeps GitHub Actions startup near the platform floor (~8–12 s), but the realistic p95 with the 2-stage LLM pipeline is **15–25 s**. We accept the gap rather than redesigning LLM execution in this ticket; revisit post-ship via the `[status, startedAt]` index-backed observability dashboard.
**Constraints**:
- Append-only writes on `TicketAnalysis` (FR-005, SC-009)
- Workflow-only LLM execution (no Anthropic SDK in `package.json`)
- Access parity with existing ticket access (FR-020) — reuse `verifyTicketAccess`
- No regression on existing flows (FR-026)
- CLAUDE.md commit rules (no `--no-verify`)
**Scale/Scope**:
- Up to 10 successful runs / user / hour (rate limited)
- Expected steady state < 1 k rows / project / month
- Anchors capped at 5 per analysis; scope warnings capped at 5

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — both passes recorded below.

### Pre-Phase-0 evaluation

| Principle | Verdict | Evidence |
|---|---|---|
| **I. TypeScript-First Development** | PASS | All new files are TypeScript strict; explicit Zod-derived types for API payloads; no `any` planned. |
| **II. Component-Driven Architecture** | PASS | New panel and banner reuse shadcn/ui (Card, Alert, Collapsible). Panel composed of focused sub-components (`InboxAnalysisPanel`, `AnchorCitationList`, `DescriptionChangedBanner`, `InboxAnalysisButton`) — each justified by either reuse, internal state, or > 40 lines of cohesive markup (see research.md "New components"). API routes live under `app/api/projects/[projectId]/tickets/[id]/analysis/...` per platform convention. |
| **III. Test-Driven Development (NON-NEGOTIABLE)** | PASS | Test layout follows `tests/integration/health/` and `tests/integration/outcomes/` patterns. New folder `tests/integration/analysis/` justified by domain isolation (research.md "Existing Files" inventory). Each requirement has a named test file (research.md §"Tests — new files"). |
| **IV. Security-First Design** | PASS | All inputs validated via Zod (`AnalysisInputSnapshotSchema`, `AnalysisOutputSchema`, etc.); Prisma column constraints match Zod (`titleSnapshot.max(100)`); credentials decrypted only inside the workflow via the existing internal credential endpoint with `WORKFLOW_API_TOKEN` auth (P3 in research.md); no raw SQL; access enforced by `verifyTicketAccess`. |
| **V. Database Integrity** | PASS | New model added via `prisma migrate dev`; cascade-on-delete to Ticket / Project / User; append-only invariant + WHERE-status='running' assertion guards transitions; dispatch-then-rollback (P1) keeps DB state consistent on workflow failure; no in-memory object reused after mutation (every read uses fresh DB queries). |
| **V. Specification Clarification Guardrails** | PASS | Spec already records 13 AUTO→CONSERVATIVE auto-resolved decisions with trade-offs and reviewer notes. PLAN does not override; the only deviation from the spec entity list is rephrasing `AnalysisRateBudget` and `AnchorReference` as derived (research.md D2 + data-model §7) — flagged explicitly with rationale rather than silent. |
| **Code Quality** | PASS | Functional components with hooks; descriptive names (`useTicketAnalysis`, `selectAnchors`, `extractStackContext`); JSDoc on exported functions in `lib/analysis/`. |
| **State Management** | PASS | Server state via TanStack Query (`useTicketAnalysis`); local state via `useState`. No new global state. Optimistic updates not applicable — analysis runs are async; the pattern is "create → poll → render" (matches jobs/health-scans). |
| **Error Handling** | PASS | Every API route has try/catch returning `{ error, code }`; 401/403/404/412/422/429 distinct from 500; errors logged with row IDs; user-facing messages for rate-limit explicitly include reset time. |

### Post-Phase-1 re-evaluation

After data-model.md, contracts/, workflows/ have been authored:

| Concern | Re-checked | Resolution |
|---|---|---|
| New model field `output: Json` is "untyped" at DB layer | Yes | Mitigated: typed via Zod (`AnalysisOutputSchema`) on the only writer (PATCH endpoint). The constitution allows JSON for legitimate variant data (cf. `Ticket.attachments`, `TicketOutcome.jobCountByPrefix`). |
| Discriminated `output` (full vs cold-start) under one column | Yes | Single column simplifies indexes and migrations; the discriminator is the row's `status` (data-model §2.2). Risk acknowledged: the panel renderer must branch on `status`. Tests cover both shapes. |
| 10s p95 SLO vs realistic 15–25 s | Yes | Documented as a known gap in research.md D1 and Technical Context. Not a constitution violation; it's a spec/reality alignment item flagged for post-ship calibration. **No complexity is added to chase the SLO** (constitution-aligned: don't over-engineer). |
| New `lib/analysis/` directory | Yes | Justified by domain isolation; mirrors `lib/outcomes/`, `lib/health/`. Constitution II encourages feature-folder structure. |
| `anchorIdsAttempted Int[]` on the row | Yes | Necessary to enforce "anchors[*] ⊆ candidates passed to scoping" on PATCH (data-model §6). Alternative (re-query at PATCH) was rejected because outcomes can change between trigger and completion. Documented; not a complexity violation. |
| Plan adds **one** new internal endpoint (`/api/internal/analysis-context`) used only by the workflow agent | Yes | Documented in workflows/inbox-analysis-command.md §6. Workflow-token auth only. |

**Verdict**: PASS at both gates. No principles violated; no exceptions to record in `Complexity Tracking`.

---

## Project Structure

### Documentation (this feature)

```
specs/AIB-743-inbox-ticket-analysis/
├── plan.md                                  # this file
├── research.md                              # Phase 0
├── data-model.md                            # Phase 1
├── contracts/
│   ├── analysis-api.md                      # Phase 1 — REST endpoints
│   └── output-schema.md                     # Phase 1 — Zod schema contract
├── workflows/
│   ├── inbox-analysis-workflow.md           # Phase 1 — GH Actions YAML spec
│   └── inbox-analysis-command.md            # Phase 1 — slash-command spec
├── checklists/                              # (existing)
├── spec.md                                  # (existing)
└── tasks.md                                 # Phase 2 (NOT created by /plan)
```

### Source Code (repository root)

The platform is a single Next.js monorepo. New paths are listed below; existing paths to extend are listed in research.md "Existing Files".

```
app/
├── api/
│   └── projects/[projectId]/tickets/[id]/analysis/
│       ├── route.ts                                    # GET latest + POST trigger
│       ├── eligibility/
│       │   └── route.ts                                # optional GET (P3)
│       └── [analysisId]/status/
│           └── route.ts                                # PATCH (workflow-only)
├── api/internal/analysis-context/
│   └── route.ts                                        # workflow-only context bundle
└── lib/hooks/queries/
    └── useTicketAnalysis.ts                            # TanStack Query hook

components/ticket/
├── inbox-analysis-panel.tsx                            # main panel
├── inbox-analysis-button.tsx                           # cost-labelled trigger
├── description-changed-banner.tsx                      # stale banner
└── anchor-citation-list.tsx                            # anchor entries

lib/analysis/
├── types.ts                                            # ANALYSIS_RULE_SET_VERSION, enums
├── output-schema.ts                                    # AnalysisOutputSchema (Zod)
├── input-schema.ts                                     # snapshot schemas
├── stack-extract.ts                                    # extractStackContext()
├── cost-table.ts                                       # estimateAnalysisCostUsd()
├── anchor-retrieval.ts                                 # selectAnchors()
├── stale-check.ts                                      # isStale()
├── persist.ts                                          # row-insert helper with invariants
├── serialize.ts                                        # row → API DTO
├── dispatch-analysis.ts                                # workflow dispatcher
└── prompts/
    ├── scoping.ts                                      # Phase B template
    └── grounded.ts                                     # Phase D template

prisma/
└── migrations/<timestamp>_add_ticket_analysis/
    └── migration.sql

.github/workflows/
└── inbox-analysis.yml                                  # new minimal workflow

.claude-plugin/
├── commands/inbox-analysis.md                          # slash command spec
└── skills/inbox-analysis/
    └── SKILL.md                                        # 2-stage agent skill

tests/
├── unit/
│   ├── analysis/
│   │   ├── cost-table.test.ts
│   │   ├── stack-extract.test.ts
│   │   ├── anchor-retrieval.test.ts
│   │   ├── stale-check.test.ts
│   │   └── output-schema.test.ts
│   └── components/
│       ├── inbox-analysis-panel.test.tsx
│       ├── description-changed-banner.test.tsx
│       └── anchor-citation-list.test.tsx
├── integration/analysis/
│   ├── trigger-analysis.test.ts
│   ├── analysis-status.test.ts
│   ├── cold-start.test.ts
│   ├── rate-limit.test.ts
│   ├── stale-banner.test.ts
│   ├── anchor-filtering.test.ts
│   └── append-only.test.ts
└── e2e/
    └── inbox-analysis.spec.ts                          # single happy-path Playwright
```

**Structure Decision**: Single Next.js app with feature-folder isolation under `lib/analysis/`, `components/ticket/` (extended), `app/api/projects/[projectId]/tickets/[id]/analysis/`, `tests/{unit,integration,e2e}/analysis/`. No new top-level package or service is introduced. The structure mirrors AIB-742's `lib/outcomes/` and the platform's HealthScan layout — research.md "Existing Files" lists every reference.

---

## Implementation Phases (high level — detailed tasks generated by `/ai-board.tasks`)

> Tasks.md is created by the `/ai-board.tasks` command, not this plan. The phases below sketch the dependency order.

### Phase 2.1 — Schema and primitives (parallel-safe)
- Add `TicketAnalysis` model + enum to `prisma/schema.prisma`; generate migration; run `bunx prisma generate`.
- Add `lib/analysis/types.ts`, `output-schema.ts`, `input-schema.ts` (Zod). Unit tests for each schema.
- Add `lib/analysis/cost-table.ts`, `stack-extract.ts`, `stale-check.ts`. Pure-function unit tests.

### Phase 2.2 — Anchor retrieval
- Add `lib/analysis/anchor-retrieval.ts` with `selectAnchors()` that follows the algorithm in research.md D5.
- Unit tests cover overlap scoring, tag tie-breaker, recency tie-breaker, cold-start threshold, no-free-form-text-similarity (FR-013), and result ordering.

### Phase 2.3 — Persistence + dispatch
- Add `lib/analysis/persist.ts` (insert with Zod validation, status invariants).
- Add `lib/analysis/serialize.ts` (row → API DTO; performs the access-filter for anchors).
- Add `lib/analysis/dispatch-analysis.ts` mirroring `lib/health/scan-dispatch.ts` (P1 dispatch-then-rollback).

### Phase 2.4 — API routes
- `POST /api/projects/.../analysis` — auth, INBOX gating, rate-limit count, anchor candidate set, dispatch, 202.
- `GET /api/projects/.../analysis` — latest row + eligibility block (with stale-flag computation).
- `PATCH /api/projects/.../analysis/:id/status` — workflow auth, Zod-validated body, status transition assertion.
- `GET /api/internal/analysis-context` — workflow-only bundling endpoint.
- Integration tests cover each handler's happy path and every error code in the contracts.

### Phase 2.5 — Workflow + agent skill
- Add `.github/workflows/inbox-analysis.yml`.
- Add `.claude-plugin/commands/inbox-analysis.md` and `.claude-plugin/skills/inbox-analysis/SKILL.md`.
- Add `lib/analysis/prompts/scoping.ts` and `lib/analysis/prompts/grounded.ts`.

### Phase 2.6 — UI
- Add `components/ticket/inbox-analysis-button.tsx` (cost label, rate-limit-aware disabled state).
- Add `components/ticket/inbox-analysis-panel.tsx` (running, success, cold-start, failed branches).
- Add `components/ticket/description-changed-banner.tsx` (ARIA live region).
- Add `components/ticket/anchor-citation-list.tsx` (clickable anchors, "no score" placeholder, tombstoned degraded state).
- Add `app/lib/hooks/queries/useTicketAnalysis.ts` (P5 polling pattern).
- Modify `components/board/ticket-detail-modal.tsx` to mount the panel inside the Details tab.
- Component tests for each, plus extend `tests/unit/components/ticket-detail-modal.test.tsx` with INBOX-gating cases.

### Phase 2.7 — Cross-cutting + E2E
- `tests/e2e/inbox-analysis.spec.ts`: keyboard navigation, screen-reader landmark verification, anchor click navigates.
- Run `bun run type-check && bun run lint && bun run test` — green before tasks.md is closed.

---

## Testing Strategy

Per constitution III: **Testing Trophy**, integration > E2E. The test inventory below references real files from research.md "Existing Files".

| Concern | Test type | File (new or extended) |
|---|---|---|
| Anchor scoring algorithm | Vitest unit | `tests/unit/analysis/anchor-retrieval.test.ts` (new — no existing covers domain-overlap scoring) |
| Stale-check whitespace tolerance | Vitest unit | `tests/unit/analysis/stale-check.test.ts` (new) |
| Stack extract field omission / safety | Vitest unit | `tests/unit/analysis/stack-extract.test.ts` (new — `tests/unit/config-schema.test.ts` covers parsing, not extraction) |
| Cost table fallback model | Vitest unit | `tests/unit/analysis/cost-table.test.ts` (new) |
| Output schema validation | Vitest unit | `tests/unit/analysis/output-schema.test.ts` (new) |
| Panel renders all branches (running/success/cold-start/failed) | RTL component | `tests/unit/components/inbox-analysis-panel.test.tsx` (new — `quality-score-section.test.tsx` is a different concern) |
| Banner ARIA live region + revert clears | RTL component | `tests/unit/components/description-changed-banner.test.tsx` (new) |
| Anchor list "no score" / tombstoned | RTL component | `tests/unit/components/anchor-citation-list.test.tsx` (new) |
| Modal INBOX-gating | RTL component | `tests/unit/components/ticket-detail-modal.test.tsx` (extended — new test cases) |
| Trigger API flow | Vitest integration | `tests/integration/analysis/trigger-analysis.test.ts` (new — `tests/integration/health/trigger-scan.test.ts` is the pattern reference) |
| Status PATCH transitions + idempotency | Vitest integration | `tests/integration/analysis/analysis-status.test.ts` (new) |
| Cold-start path | Vitest integration | `tests/integration/analysis/cold-start.test.ts` (new) |
| Rate limit + reset window | Vitest integration | `tests/integration/analysis/rate-limit.test.ts` (new) |
| Banner end-to-end (server stale-flag) | Vitest integration | `tests/integration/analysis/stale-banner.test.ts` (new) |
| Anchor access filtering | Vitest integration | `tests/integration/analysis/anchor-filtering.test.ts` (new) |
| Append-only invariant | Vitest integration | `tests/integration/analysis/append-only.test.ts` (new — verifies SC-009) |
| Single happy-path with a11y checks | Playwright E2E | `tests/e2e/inbox-analysis.spec.ts` (new) |

E2E count is intentionally **one**: the keyboard + screen-reader traversal of Story 1's happy path. All other cases are integration or unit.

---

## Complexity Tracking

*No constitution violations to justify.* The plan reuses every existing pattern (HealthScan dispatch, TicketOutcome query, TanStack polling, shadcn cards, Aurora B+ utility classes). No new external dependency is introduced. The single intentional deviation from the spec entity list — collapsing `AnalysisRateBudget` and `AnchorReference` into derived/inlined forms — is explicitly justified in research.md D2 and data-model §7.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *(none)* | — | — |

---

## Open items for `/ai-board.tasks`

Hand-off notes for task generation:

1. **Schema migration ordering**: The Prisma migration must run before any code that imports `prisma.ticketAnalysis` types. Mark the migration task as a hard prerequisite for all `lib/analysis/` and `app/api/.../analysis/` tasks.
2. **Test mode parity**: The dispatcher's test-mode short-circuit (`isWorkflowTestMode`) MUST be added to `lib/analysis/dispatch-analysis.ts` so integration tests can exercise the full POST → PATCH cycle without GitHub Actions.
3. **Eligibility endpoint (P3)**: The standalone `GET .../analysis/eligibility` is optional in v1; mark it `[OPTIONAL]` in tasks.md. It can ship in a follow-up if no consumer outside the panel needs it.
4. **SLO note**: When tasks.md adds the verification task for SC-001, link it to research.md D1 so the verifier knows the realistic target is 15–25 s p95 and a strict 10 s would require an architectural reset of LLM execution.
5. **Constitution check re-run**: `/ai-board.analyze` is expected to flag the SLO gap; the answer is "tracked, accepted, see plan §Technical Context".
