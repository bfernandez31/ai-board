# Implementation Plan: In-App PR Diff Viewer with Layered Grouping (Read-Only)

**Branch**: `AIB-879-visualiseur-de-diff` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-879-visualiseur-de-diff/spec.md`

## Summary

Add a read-only, full-screen in-app viewer for a ticket's PR diff, opened from VERIFY/SHIP. It
shows an Overview entry plus a toggle between **Layers** (semantic cohorts produced by the VERIFY
review) and **Files** (flat) modes, rendering unified diffs in the existing `DiffViewer` style with
read-only inline comments anchored to their lines. The diff and comments are fetched live from
GitHub on open (using the acting user's GitHub authorization); only the layer grouping comes from a
persisted snapshot. That snapshot is emitted by the existing VERIFY code-review and stored on the
verify `Job` (a new `layerDecomposition` column), mirroring the `qualityScore` artifact lifecycle so
consultation triggers no new review computation.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, `@octokit/rest` ^22, Zod,
TanStack Query v5, TailwindCSS 3.4, shadcn/ui + Radix, lucide-react
**Storage**: PostgreSQL 14+ via Prisma — one additive nullable column `Job.layerDecomposition`
**Testing**: Vitest (unit + integration), RTL for components, Playwright only if a browser is required
**Target Platform**: Vercel (Next.js server) + Postgres
**Project Type**: Web application (Next.js App Router monolith)
**Performance Goals**: Viewer ready within a few seconds for typical PRs (SC-002); large PRs stay
responsive via file/patch caps (edge case)
**Constraints**: Read-only (no mutation, no comment compose); zero new review computation on open
(FR-012); per-user GitHub authorization (FR-017); unified single-column diff only (FR-018)
**Scale/Scope**: One new GET API route, one Prisma column, ~3 new UI components + 1 hook, additive
edits to the code-review command + verify.yml + job-status route. No NEEDS CLARIFICATION remain.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after Phase 1.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. TypeScript-First | All new code strict-typed; Zod schemas for the API request/response and the artifact; explicit interfaces (`PrDiffResponse`, `InlineComment`, `LayerDecompositionArtifact`). No `any`. | PASS |
| II. Component-Driven | shadcn `Dialog/Tabs/ScrollArea/Badge/Button/Skeleton` reused; `PrFileDiff` extracted only because it adds inline-comment + collapse behavior (justified by II); `PrDiffViewer` kept cohesive. | PASS |
| III. TDD | Extend existing tests (`ticket-detail-modal`, `jobs/status`); new files only where no domain exists (`pr-diff` route, `pr-diff-viewer`, `pr-layers`). Behavior-focused, RTL accessibility-first, assertions outside conditionals. | PASS |
| IV. Security-First | Per-user GitHub OAuth + `requireRepoScope`; `verifyTicketAccess` authorization; Zod validation of params/body; no secrets in responses; actionable auth errors (401/403, never 500 fall-through). | PASS |
| V. Database Integrity | Additive nullable column via `prisma migrate dev`; persisted only inside the existing atomic `updateMany` on COMPLETED; re-read `updatedJob` post-mutation; no orphaned state. | PASS |
| V. Clarification Guardrails | All decisions documented in spec's Auto-Resolved Decisions; three CONSERVATIVE fallbacks recorded (outdated comments, authorization, scope). | PASS |
| Error Handling | Route has single try/catch, `{ error, code }` envelope, typed codes; GitHub failures propagated (no silent swallow). | PASS |

**Result**: PASS — no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```
specs/AIB-879-visualiseur-de-diff/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0: Existing Files + Patterns to Follow
├── data-model.md        # Phase 1: entities + Prisma column + runtime types
├── contracts/
│   ├── pr-diff-api.md            # GET …/pr-diff contract
│   └── layer-decomposition-artifact.md
├── workflows/
│   ├── verify-layer-decomposition.md   # VERIFY review extension
│   └── pr-state-retrieval.md           # on-open read process
└── checklists/requirements.md
```

### Source Code (repository root)

```
prisma/
└── schema.prisma                                  # + Job.layerDecomposition String?

app/
├── lib/schemas/
│   └── pr-diff.ts                                 # NEW: Zod schemas (PrDiffResponse, FileChange,
│                                                  #      InlineComment, LayerDecompositionArtifact)
└── api/projects/[projectId]/tickets/[id]/
    └── pr-diff/route.ts                           # NEW: GET — PR State Retrieval

lib/
├── pr-layers.ts                                   # NEW: parse + reconcile helpers (parseLayerDecomposition,
│                                                  #      reconcileLayers → ResolvedLayer[])
├── github/pr-state.ts                             # NEW: resolvePr/listFiles/listReviewComments + mapping
│                                                  #      (reuses createUserGitHubClient, callWithRetry, caps)
├── github/user-client.ts                          # REUSE
├── outcomes/github-files.ts                        # PATTERN (retry + GITHUB_FILES_CAP)
├── quality-score.ts                                # PATTERN (parse helper) + reuse threshold/colors
├── types/job-types.ts                              # + layerDecomposition: string | null
└── hooks/use-pr-diff.ts                            # NEW: usePrDiff(projectId, ticketId, {enabled})

components/
├── ticket/
│   ├── diff-viewer.tsx                             # PATTERN (visual tokens)
│   ├── pr-diff-viewer.tsx                          # NEW: Dialog + side rail (Overview/Layers/Files)
│   └── pr-file-diff.tsx                            # NEW: per-file diff w/ inline comments + collapse
└── board/
    └── ticket-detail-modal.tsx                     # + "PR Diff" button gated to VERIFY/SHIP

app/api/jobs/[id]/status/route.ts                   # + persist layerDecomposition on COMPLETED
.claude-plugin/commands/ai-board.code-review.md     # + emit LAYER_DECOMPOSITION_JSON: marker
.github/workflows/verify.yml                         # + parse marker, include in COMPLETED PATCH

tests/
├── unit/pr-layers.test.ts                          # NEW: reconcile + Additional-changes + parse
├── unit/components/pr-diff-viewer.test.tsx          # NEW: modes, layers, outdated comments, fallbacks
├── unit/components/ticket-detail-modal.test.tsx      # EXTEND: PR-diff button visibility VERIFY/SHIP
├── integration/api/projects/pr-diff.test.ts          # NEW: route (no-PR, auth, layers, files, comments)
└── integration/jobs/status.test.ts                   # EXTEND: layerDecomposition persisted on COMPLETED
```

**Structure Decision**: Web-application monolith (Next.js App Router). New code follows the
established split: API route under `app/api/projects/[projectId]/tickets/[id]/`, Zod schemas under
`app/lib/schemas/`, pure helpers under `lib/`, hooks under `lib/hooks/`, components under
`components/ticket|board/`. All paths above are real existing files (extend) or net-new files in
established directories.

## Implementation Phases

Build server-down then UI, with tests alongside each layer (constitution III). Each phase is
independently testable and maps to the spec's prioritized user stories.

### Phase A — Persistence & VERIFY artifact (enables Layers; P1 prerequisite)
1. Add `Job.layerDecomposition String?` to `prisma/schema.prisma`; `prisma migrate dev` + `bunx prisma generate`.
2. Extend `app/api/jobs/[id]/status/route.ts`: accept optional `layerDecomposition` (Zod string,
   JSON-parseable), persist **only** on `COMPLETED` inside the existing atomic `updateMany`
   (follow the `qualityScore` guard at L282-288). Add `layerDecomposition` to `lib/types/job-types.ts`.
3. Extend `.claude-plugin/commands/ai-board.code-review.md` to emit `LAYER_DECOMPOSITION_JSON:` on
   its own line **before** the absolute-last `QUALITY_SCORE_JSON:` line.
4. Extend `.github/workflows/verify.yml` "Read Quality Score" step: independently grep the layer
   marker (NOT `tail -1`), base64 it, add `layerDecomposition` to the COMPLETED PATCH payload.

### Phase B — Read path: helpers + API route (User Story 1 & 2, P1)
5. `lib/pr-layers.ts`: `parseLayerDecomposition()` (tolerant, like `parseQualityScoreDetails`) +
   `reconcileLayers(artifact, files)` → `ResolvedLayer[]` with synthetic "Additional changes"
   (FR-015), empty-layer omission, post-merge counters.
6. `lib/github/pr-state.ts`: `resolvePr`, `listPrFiles`, `listPrReviewComments`, mapping to
   `FileChange`/`InlineComment` — reuse `createUserGitHubClient`, wrap in `callWithRetry`, apply
   `GITHUB_FILES_CAP` + per-patch size cap (follow `github-files.ts:203-296`), derive comment
   `source`/`outdated`.
7. `app/lib/schemas/pr-diff.ts`: Zod schemas for `PrDiffResponse` and the artifact.
8. `app/api/projects/[projectId]/tickets/[id]/pr-diff/route.ts`: implement PR State Retrieval per
   the contract — `verifyTicketAccess` → GitHub client/scope → resolve PR (or `pr: null`) → files
   → comments → load latest COMPLETED verify job → parse+reconcile layers → Overview. Typed
   error mapping mirroring `docs/diff/route.ts:194-225` + `AUTH_REQUIRED`/`NO_PR_FOUND`. Test-mode
   fixture short-circuit.

### Phase C — UI (User Story 1, 2, 3)
9. `lib/hooks/use-pr-diff.ts`: TanStack Query hook, lazy `enabled` on open, fresh fetch
   (follow `useDocumentationDiff`); query key under `app/lib/query-keys.ts`.
10. `components/ticket/pr-file-diff.tsx`: render a `FileChange` patch in the exact `DiffViewer`
    visual style (zinc card, green/red, `+/-` counters, binary fallback) + collapsible block +
    inline read-only comments anchored to lines; outdated comments surfaced at file header. No
    compose/reply/resolve controls (FR-011).
11. `components/ticket/pr-diff-viewer.tsx`: shadcn `Dialog` (match `DocumentationViewer` sizing)
    with side rail — Overview / Layers ↔ Files toggle (FR-002); Overview shows title/status/
    synthesis/quality score (FR-003); Layers list with title/summary/file+comment counters in
    dependency order (FR-004); selecting a layer renders its files (FR-005); Files mode renders the
    flat list (FR-006); empty/no-PR/auth-required/loading states (skeletons).
12. Extend `components/board/ticket-detail-modal.tsx` footer (~L1276-1351): add a "PR Diff" button
    visible only when `stage ∈ {VERIFY, SHIP}`, opening `PrDiffViewer` via local state (mirror the
    `docViewerOpen` pattern). Style consistent with the existing aurora buttons.

## Testing Strategy

Per constitution III, using the Phase-0 inventory to extend existing files:

- **Unit (Vitest)**: `tests/unit/pr-layers.test.ts` — reconcile (classified/unclassified →
  "Additional changes", empty-layer omission, ordering, counters), tolerant parse of malformed
  artifact. New file (no existing domain).
- **Component (Vitest + RTL)**:
  - `tests/unit/components/pr-diff-viewer.test.tsx` (new) — Layers/Files toggle, layer selection
    renders files, Overview content, outdated-comment surfacing, no compose controls (read-only),
    no-PR / auth-required / never-reviewed fallbacks. Accessibility-first queries,
    `renderWithProviders`.
  - `tests/unit/components/ticket-detail-modal.test.tsx` (extend) — PR-diff button shows only in
    VERIFY/SHIP, hidden elsewhere.
- **Integration (Vitest)**:
  - `tests/integration/api/projects/pr-diff.test.ts` (new) — happy path (layers+files+comments),
    `pr: null` empty state, never-reviewed → `layers:[]`, post-review file → "Additional changes",
    missing scope → `AUTH_REQUIRED`, forbidden user → 403. Uses `x-test-user-id` + test-mode fixture.
  - `tests/integration/jobs/status.test.ts` (extend) — `layerDecomposition` persisted on COMPLETED,
    ignored on non-COMPLETED, idempotent under duplicate terminal callback.
- **E2E (Playwright)**: none required — no browser-only capability (no OAuth/drag-drop/viewport)
  in this read-only viewer; integration + component coverage is sufficient (constitution III #5).

## Complexity Tracking

No constitution violations — section intentionally empty.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 artifacts: design adds exactly one nullable column reusing the proven
`qualityScore` lifecycle, one read-only GET route reusing established auth/GitHub/error patterns,
and UI composed from shadcn primitives + the existing diff-rendering style. No new dependencies, no
new permission surface, no mutation paths. **All gates remain PASS.**
