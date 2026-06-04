# Implementation Plan: Token saving via RTK + unified per-ticket Run settings

**Branch**: `AIB-849-token-saving-via` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-849-token-saving-via/spec.md`

## Summary

Add a project-level **Token saving** default (owner-controlled, default OFF) with a three-state per-ticket override (Inherit / Force ON / Force OFF), following the exact inheritance model of clarification policy and agent. When the effective value is ON for a **Claude** run on a standard stage, the runner installs the pinned **RTK** ("Rust Token Killer") binary and registers it as a Claude Code PreToolUse hook so command outputs are compressed before entering context — non-blocking, so any install/activation failure degrades gracefully to a recorded fallback and never fails the run. Each job records a `TokenSavingOutcome` (ACTIVE / INACTIVE / FELL_BACK) surfaced in job details; savings are measured with existing per-job telemetry (no new estimation). The three standalone ticket kebab dialogs (Edit Policy / Edit Agent / Edit Models) are consolidated into a single **Run settings** dialog that also hosts the new token-saving control, and a header status-strip badge appears when token saving is effectively ON.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0; Bash (runner scripts)
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, Zod; external pinned binary `rtk-ai/rtk` (Rust, fetched at run time)
**Storage**: PostgreSQL 14+ via Prisma — 3 new columns (`Project.tokenSaving`, `Ticket.tokenSaving`, `Job.tokenSavingOutcome`) + 1 new enum (`TokenSavingOutcome`)
**Testing**: Vitest (unit + integration), Playwright (E2E — avoid unless browser-only)
**Target Platform**: Vercel (Next.js app) + GitHub Actions runners (centralized workflow execution)
**Project Type**: Web application (single Next.js app; runner = bash scripts under `.github/`)
**Performance Goals**: OFF runs show no measurable overhead (SC-007); ON runs target ~80% reduction on command-heavy stages (SC-002)
**Constraints**: Token-saving failure MUST NEVER fail or degrade a run (FR-006/SC-003); RTK version pinned (FR-017); Claude-only (FR-007); no new token-estimation machinery (FR-009)
**Scale/Scope**: Phase-1 scope = Claude agent on specify/plan/build/verify/ship + quick-impl

## Constitution Check

*GATE: re-checked after Phase 1 design — PASS.*

| Principle | Assessment |
|-----------|-----------|
| I. TypeScript-First | All new code strict TS, explicit types; no `any`; new Prisma fields get generated types. ✅ |
| II. Component-Driven | New cards/dialogs/badges compose shadcn/ui + existing `Badge`/`Dialog`; Run settings dialog reuses existing section components (cohesion over splitting). ✅ |
| III. TDD (NON-NEGOTIABLE) | Extend existing tests first (transitions, model-override, job-update-validator, ticket-detail-modal); new files only for genuinely new domains (token-saving endpoint, run-settings-dialog, token-saving-badge). Test-type choices follow §III decision tree. ✅ |
| IV. Security-First | Project toggle owner-only (`verifyProjectOwnership`); ticket override `verifyTicketAccess`; Zod schemas with `.nullable()` matching nullable columns; RTK install never holds secrets; outcome reporting uses existing workflow-token auth. ✅ |
| V. Database Integrity | Additive nullable/defaulted columns via `prisma migrate dev` (no backfill); override persisted before any dispatch; outcome first-write-wins; no pre-mutation object reuse. ✅ |
| Error Handling | New API routes wrapped in try/catch returning `{error, code}`; 403 for non-owner; runner swallows RTK errors by design (the ONE justified deviation from "never swallow" — mandated by FR-006/SC-003 and recorded in Complexity Tracking). ✅ |
| Colors / Tailwind | Badge + outcome indicator use static literal class strings and semantic/`ctp-*` tokens only. ✅ |

**No unjustified violations.** One justified deviation tracked below.

## Project Structure

### Documentation (this feature)
```
specs/AIB-849-token-saving-via/
├── plan.md              # This file
├── spec.md              # Feature spec (input)
├── research.md          # Phase 0 — decisions, existing files, patterns
├── data-model.md        # Phase 1 — schema + effective value + transitions
├── contracts/
│   └── token-saving-api.md   # Phase 1 — API + UI contracts
├── workflows/
│   └── rtk-activation.md     # Phase 1 — runner activation process
└── tasks.md             # Phase 2 (/ai-board.tasks — NOT created here)
```

### Source Code (repository root) — concrete touch points
```
prisma/schema.prisma                         # +enum TokenSavingOutcome; +Project.tokenSaving; +Ticket.tokenSaving; +Job.tokenSavingOutcome

lib/
├── workflows/transition.ts                  # +resolveEffectiveTokenSaving; add tokenSaving to workflowInputs (Claude stages)
├── db/projects.ts                           # updateProject: apply tokenSaving when defined
├── db/tickets.ts                            # duplicate/fullClone: copy tokenSaving; +token-saving override helper (active-run guard)
└── types/job-types.ts                       # +tokenSavingOutcome on TicketJobWithTelemetry

app/
├── lib/schemas/clarification-policy.ts      # projectUpdateSchema += tokenSaving boolean
├── lib/job-update-validator.ts              # jobStatusUpdateSchema += tokenSavingOutcome enum
├── lib/utils/token-saving-icons.ts          # NEW — static label/description helpers
├── api/projects/[projectId]/route.ts        # pass tokenSaving through (owner-only already)
├── api/projects/[projectId]/tickets/[id]/token-saving/route.ts   # NEW — override PATCH (no INBOX gate; active-run guard)
└── api/jobs/[id]/status/route.ts            # persist tokenSavingOutcome

components/
├── projects/token-saving-card.tsx           # NEW — owner-only project card (US1)
├── tickets/run-settings-dialog.tsx          # NEW — 4-section consolidated dialog (US3)
├── tickets/{policy,agent,model-override}-edit-dialog.tsx  # reused as section content
├── ui/token-saving-badge.tsx                # NEW — header badge (US4)
├── board/ticket-detail-modal.tsx            # kebab → single "Run settings"; render badge; compute effective value
└── ticket/jobs-timeline.tsx                 # JobRow outcome indicator

.github/
├── scripts/run-agent.sh                     # +activate_token_saving (non-blocking) + outcome PATCH
└── workflows/{speckit,quick-impl,verify,iterate}.yml   # +tokenSaving input → TOKEN_SAVING env

tests/
├── integration/tickets/transitions.test.ts            # EXTEND — effective value, dispatch input, non-Claude
├── integration/tickets/token-saving.test.ts           # NEW — project PATCH, override endpoint, clone copy
├── unit/job-update-validator.test.ts                  # EXTEND — tokenSavingOutcome
├── unit/components/ticket-detail-modal.test.tsx       # EXTEND — kebab 3 items, badge visibility
├── unit/components/run-settings-dialog.test.tsx       # NEW — 4 sections, gating, indicators
└── unit/components/token-saving-badge.test.tsx        # NEW — ON shows / OFF hides
```

**Structure Decision**: Single Next.js web app with centralized GitHub-Actions runner. New code slots into the established feature layout (`components/<feature>`, `app/api/<resource>`, `lib/<domain>`); the runner change lives in the existing `run-agent.sh` agent dispatcher. No new top-level structure.

## Implementation Phases

Ordered by spec priority (P1 → P2). Each phase is independently testable per its Independent Test.

### Phase A — Data + inheritance foundation (enables US1, US2)
1. Schema: add enum + 3 columns; `prisma migrate dev`; `prisma generate`.
2. `resolveEffectiveTokenSaving` in `transition.ts` (mirror `resolveEffectiveAgent:58-61`).
3. `projectUpdateSchema` + `updateProject` apply `tokenSaving` (owner-only path unchanged).
4. EXTEND `transitions.test.ts`: effective value resolution incl. Force-OFF over ON default.

### Phase B — Runner activation + outcome reporting (US2, FR-004–008)
1. Add `tokenSaving` to `workflowInputs` for Claude standard/quick/verify (`transition.ts:268-355`).
2. Add `tokenSaving` input → `TOKEN_SAVING` env in 4 workflow YAMLs.
3. `activate_token_saving` in `run-agent.sh` (non-blocking; pinned `RTK_VERSION`; sets `TOKEN_SAVING_OUTCOME`) per `workflows/rtk-activation.md`; PATCH outcome via `report_runtime_versions`.
4. `jobStatusUpdateSchema` + status route persist `tokenSavingOutcome`; EXTEND `job-update-validator.test.ts`.

### Phase C — Ticket override endpoint + clone (US3 data, edge cases)
1. NEW `token-saving/route.ts` (no INBOX gate; `ACTIVE_RUN` 409 guard; `version` concurrency) + DB helper.
2. Copy `tokenSaving` in `duplicateTicket` + `fullCloneTicket`.
3. NEW `tests/integration/tickets/token-saving.test.ts`.

### Phase D — Unified Run settings dialog + kebab (US3, FR-010–012, FR-016)
1. NEW `run-settings-dialog.tsx` composing existing Agent/Models/Policy controls + Token saving section; preserve INBOX-only gating for Agent/Policy, per-stage for Models.
2. `ticket-detail-modal.tsx`: replace 3 kebab items with single "Run settings".
3. EXTEND `ticket-detail-modal.test.tsx` (kebab = 3 items); NEW `run-settings-dialog.test.tsx`.

### Phase E — Project card + badges (US1, US4)
1. NEW `token-saving-card.tsx` mounted in project settings; owner-only / read-only for members.
2. NEW `token-saving-badge.tsx` + `token-saving-icons.ts`; render in status strip when effective ON.
3. `jobs-timeline.tsx` outcome indicator (FELL_BACK visually distinct from INACTIVE).
4. NEW `token-saving-badge.test.tsx`.

## Testing Strategy

Per constitution §III decision tree and the Phase-0 "Existing Files" inventory:
- **Pure functions** (`resolveEffectiveTokenSaving`, validators) → Vitest unit.
- **API + DB** (project PATCH owner-only, override endpoint active-run guard, clone copy, outcome persistence) → Vitest integration, EXTENDING `transitions.test.ts` and the new `token-saving.test.ts`; pattern-reference `model-override.test.ts`.
- **Components** (Run settings dialog sections/gating/indicators, token-saving card, badge visibility, jobs-timeline indicator) → Vitest + RTL, EXTENDING `ticket-detail-modal.test.tsx`, new files only where no existing file covers the domain.
- **E2E**: none required — no browser-only behavior; defer to integration/component (E2E is ~5s each).
- **Runner**: covered by integration assertions on dispatch inputs + outcome persistence; the bash `activate_token_saving` non-blocking contract is verified via the FELL_BACK/INACTIVE acceptance cases (SC-003, FR-007).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|-----------|--------------------------------------|
| Runner swallows RTK install/activation errors (deviates from constitution "never silently swallow external failures") | FR-006 / SC-003 require that a token-saving failure NEVER fails or degrades a run | Propagating the error would abort the Claude run — directly violating the spec's central safety guarantee. The error is not truly silent: it is recorded as `FELL_BACK` on the job and shown in job details. |
| New dedicated `token-saving` ticket endpoint instead of reusing the ticket PATCH | Token-saving override is editable at any stage (active-run guard), unlike INBOX-only agent/policy | Adding it to `patchTicketInline` would entangle it with the INBOX gate and risk regressing FR-016 (no change to existing override semantics); a separate route mirrors the precedent set by `model-config/route.ts`. |
