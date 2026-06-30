---
description: "Task list for In-App PR Diff Viewer with Layered Grouping (Read-Only)"
---

# Tasks: In-App PR Diff Viewer with Layered Grouping (Read-Only)

**Input**: Design documents from `/specs/AIB-879-visualiseur-de-diff/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution III). Behavior-focused, RTL accessibility-first, assertions outside conditionals.

**Organization**: Tasks are grouped by user story. US1 is the MVP (core viewer + layers); US2 (comments) and US3 (Overview + fallbacks) extend it. File paths are validated against the repository — existing files are EXTENDED, new files are created only where no existing domain file exists (per research.md "Existing Files").

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, and Polish phases carry no story label)
- Exact file paths are included in every task

## Path Conventions
Next.js App Router monolith (per plan.md): API routes under `app/api/`, Zod schemas under `app/lib/schemas/`, pure helpers under `lib/`, hooks under `lib/hooks/`, components under `components/ticket|board/`, tests under `tests/{unit,integration}/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm prerequisites; no new runtime dependencies are introduced (plan.md "no new dependencies").

- [ ] T001 [P] Confirm required dependencies are already present (no install needed): `@octokit/rest` ^22, `zod`, `@tanstack/react-query` v5, and shadcn primitives `dialog`/`tabs`/`scroll-area`/`badge`/`skeleton`/`button` in `components/ui/`. Record in this file if any are missing (none expected).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persisted column, shared types, and shared Zod schemas that BOTH the persistence chain and the read API depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add `layerDecomposition String?` nullable column to the `Job` model in `prisma/schema.prisma` (beside `qualityScore`/`qualityScoreDetails`), with the comment documenting "COMPLETED verify jobs only; null = never reviewed / failed → flat Files mode" per data-model.md §1.
- [ ] T003 Run `bunx prisma migrate dev` (additive, nullable, no backfill) then `bunx prisma generate` to regenerate the client.
- [ ] T004 [P] Add `layerDecomposition: string | null` to `TicketJobWithTelemetry` in `lib/types/job-types.ts` (alongside `qualityScore`/`qualityScoreDetails`).
- [ ] T005 [P] Add `layerDecomposition: true` to the job `select` clause in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` so the PR-diff route can read the artifact.
- [ ] T006 [P] Create Zod schemas + inferred types in `app/lib/schemas/pr-diff.ts`: `PrSummary`, `PrOverview`, `InlineComment`, `FileChange`, `ResolvedLayer`, `PrDiffResponse`, and `LayerDecompositionArtifact` (file shape mirrors `app/lib/schemas/documentation.ts` `{ filename, status, additions, deletions, patch? }`, extended with `binary`/`patchTruncated`/`comments`) per data-model.md §2 and contracts/.

**Checkpoint**: DB column, types, and response schemas exist — user-story implementation can begin.

---

## Phase 3: User Story 1 - Review a PR's diff in-app, grouped by layers (Priority: P1) 🎯 MVP

**Goal**: From a VERIFY/SHIP ticket, open a full-screen viewer showing the PR diff organized into ordered semantic layers (Overview/Layers/Files rail), each layer rendering its files' unified diffs in the existing `DiffViewer` visual style with collapse + add/remove counters. Includes the VERIFY pipeline that produces and persists the layer artifact.

**Independent Test**: Open a ticket in VERIFY that has a reviewed PR → a full-screen viewer opens with the Overview/Layers/Files rail; selecting a layer renders its files' diffs with syntax highlighting and per-file addition/deletion counts in dependency order.

### Tests for User Story 1

**NOTE: Write these tests FIRST and ensure they FAIL before implementation. Extend existing files where the domain already exists (per research.md inventory).**

- [ ] T007 [P] [US1] Create parse + reconcile tests (sibling to `tests/unit/quality-score.test.ts`) in `tests/unit/pr-layers.test.ts`: tolerant `parseLayerDecomposition` of malformed/null artifact, `reconcileLayers` ordering by `order`, empty-layer omission, post-merge `fileCount`/`commentCount` counters.
- [ ] T008 [P] [US1] Create API route happy-path tests in `tests/integration/api/projects/pr-diff.test.ts`: reviewed PR returns ordered `layers` with files + flat `files`, using `x-test-user-id` + the test-mode fixture.
- [ ] T009 [P] [US1] Extend `tests/integration/jobs/status.test.ts`: `layerDecomposition` persisted on `COMPLETED`, ignored on non-COMPLETED, idempotent under a duplicate terminal callback.
- [ ] T010 [P] [US1] Extend `tests/unit/components/ticket-detail-modal.test.tsx`: "PR Diff" button visible only when `stage ∈ {VERIFY, SHIP}`, hidden elsewhere.
- [ ] T011 [P] [US1] Create viewer component tests in `tests/unit/components/pr-diff-viewer.test.tsx`: Layers ↔ Files toggle, selecting a layer renders its files, per-file diff blocks collapsible with counters (accessibility-first queries, `renderWithProviders`).

### Implementation for User Story 1

- [ ] T012 [P] [US1] Extend `.claude-plugin/commands/ai-board.code-review.md` to emit a `LAYER_DECOMPOSITION_JSON:` line (artifact per contracts/layer-decomposition-artifact.md) on its own line **before** the absolute-last `QUALITY_SCORE_JSON:` line.
- [ ] T013 [P] [US1] Extend the "Read Quality Score" step in `.github/workflows/verify.yml` (~L702-751) to independently grep `LAYER_DECOMPOSITION_JSON:` (NOT `tail -1`), base64-encode it, and add `layerDecomposition` to the COMPLETED PATCH payload.
- [ ] T014 [US1] Extend `app/api/jobs/[id]/status/route.ts` to accept optional `layerDecomposition` (Zod string, JSON-parseable) and persist it **only** on `COMPLETED` inside the existing atomic `updateMany` (mirror the `qualityScore` guard ~L282-288); re-read `updatedJob` after mutation. (Depends on T002, T006.)
- [ ] T015 [P] [US1] Implement `lib/pr-layers.ts`: `parseLayerDecomposition()` (tolerant, like `parseQualityScoreDetails`) and `reconcileLayers(artifact, files)` → `ResolvedLayer[]` — intersect each `LayerDescriptor.files` with current filenames, omit empty layers without breaking `order`, route unclassified files to the synthetic "Additional changes" layer (`id='additional-changes'`, `synthetic=true`, appended last), derive `fileCount`/`commentCount` after reconciliation (data-model.md §3). (Depends on T006.)
- [ ] T016 [P] [US1] Implement `lib/github/pr-state.ts` `resolvePr` + `listPrFiles` + `FileChange` mapping: resolve PR via `pulls.list({ head: "owner:branch", state: 'all', per_page: 50 })` (prefer open, else most recent by `updated_at`), `pulls.listFiles` paginated, wrap in `callWithRetry`, apply `GITHUB_FILES_CAP` + per-patch size cap (follow `lib/outcomes/github-files.ts:203-296`), set `binary`/`patchTruncated`/`truncated`. Reuse `createUserGitHubClient`. (Depends on T006.)
- [ ] T017 [US1] Implement the GET route `app/api/projects/[projectId]/tickets/[id]/pr-diff/route.ts`: `verifyTicketAccess` → require `ticket.branch` → `createUserGitHubClient` + `requireRepoScope` → resolve PR (or 200 `pr:null`) → files → load latest COMPLETED verify job (`getLatestScoredVerifyJob` pattern) → `parseLayerDecomposition` + `reconcileLayers` → assemble `PrDiffResponse`. Typed error envelope `{ error, code }` mirroring `app/api/projects/[projectId]/docs/diff/route.ts:194-225` plus `AUTH_REQUIRED`/`BRANCH_NOT_FOUND`/`GITHUB_FORBIDDEN`/`GITHUB_API_ERROR`; test-mode fixture short-circuit per contracts/pr-diff-api.md. (Depends on T005, T006, T015, T016.)
- [ ] T018 [US1] Add a PR-diff query key to `app/lib/query-keys.ts` and implement `lib/hooks/use-pr-diff.ts` (`usePrDiff(projectId, ticketId, { enabled })`, lazy `enabled` on open, fresh fetch) following `useDocumentationDiff` in `lib/hooks/use-documentation-history.ts`. (Depends on T006, T017.)
- [ ] T019 [P] [US1] Implement `components/ticket/pr-file-diff.tsx`: render one `FileChange` patch in the exact `components/ticket/diff-viewer.tsx` visual style (zinc card, green/red lines, `+/-` counters, `FileCode/Plus/Minus` icons, binary fallback) with a collapsible per-file block. Comment rendering is added in US2. (Depends on T006.)
- [ ] T020 [US1] Implement `components/ticket/pr-diff-viewer.tsx`: shadcn `Dialog` sized like `components/board/documentation-viewer.tsx`, side rail with Overview / Layers ↔ Files toggle (FR-002), Layers list (title/summary/file+comment counters in dependency order, FR-004), layer selection renders its files via `PrFileDiff` (FR-005), Files mode renders the flat list (FR-006), loading skeletons. (Depends on T018, T019.)
- [ ] T021 [US1] Extend the footer of `components/board/ticket-detail-modal.tsx` (~L1276-1351) with a "PR Diff" button visible only when `stage ∈ {VERIFY, SHIP}`, opening `PrDiffViewer` via local state (mirror the `docViewerOpen` pattern), styled consistently with the existing aurora buttons. (Depends on T020.)

**Checkpoint**: A reviewed PR opens in a full-screen viewer with ordered layers and per-file diffs — MVP is independently functional and testable.

---

## Phase 4: User Story 2 - See all inline comments anchored to the right line (Priority: P1)

**Goal**: Within a layer's/file's diff, show read-only inline comments from all sources (our review, other bots, humans) anchored to their target line with author/source attribution; comments whose target line no longer exists are surfaced as "outdated" rather than dropped. No compose/reply/edit/resolve controls.

**Independent Test**: Open the viewer for a PR with comments from multiple sources → each appears anchored to its target line, attributed by source; an outdated comment is shown flagged at the file header; no compose/reply/resolve controls exist anywhere.

### Tests for User Story 2

- [ ] T022 [P] [US2] Extend `tests/integration/api/projects/pr-diff.test.ts`: comments from `ai-board[bot]`, a third-party bot, and a human are mapped with correct `source`/`author`, attached to files by `path`+line, and one comment with no current anchor is returned with `outdated: true`.
- [ ] T023 [P] [US2] Extend `tests/unit/components/pr-diff-viewer.test.tsx`: comments render anchored to their lines with attribution, an outdated comment surfaces at the file header, and NO posting/replying/editing/resolving controls are present (read-only, FR-011).

### Implementation for User Story 2

- [ ] T024 [US2] Extend `lib/github/pr-state.ts` with `listPrReviewComments` (paginated, `callWithRetry`) and `InlineComment` mapping: derive `source` (`ai-board[bot]`→`'ai-board'`, `user.type==='Bot'`→`'bot'`, else `'human'`), set `outdated=true` when `line==null` or the target line is absent from the current patch hunks, and anchor to the current line otherwise (data-model.md §2). (Depends on T016.)
- [ ] T025 [US2] Extend `app/api/projects/[projectId]/tickets/[id]/pr-diff/route.ts` to fetch comments and attach them to each `FileChange.comments`, and update `lib/pr-layers.ts` `commentCount` to reflect attached (displayed) comments after reconciliation. (Depends on T017, T024.)
- [ ] T026 [US2] Extend `components/ticket/pr-file-diff.tsx` to render read-only inline comments anchored to their target line (author/source attribution) and surface outdated comments at the file header. No compose/reply/resolve affordances (FR-009/FR-010/FR-011/FR-016). (Depends on T019, T025.)

**Checkpoint**: US1 and US2 both work — diffs render with their full inline discussion, read-only, with outdated comments preserved.

---

## Phase 5: User Story 3 - Overview and graceful fallbacks (Priority: P2)

**Goal**: An Overview entry summarizes the PR (title, status, review synthesis, existing quality score). The viewer never errors: a never-reviewed PR opens in flat Files mode, a no-PR ticket shows a "no PR available" state, missing GitHub authorization shows an actionable message, and post-review files appear under "Additional changes".

**Independent Test**: (a) never-reviewed PR → flat Files list with diffs, no error, Files mode active; (b) reviewed PR that gained files → those files appear under "Additional changes" in Layers mode; (c) Overview shows PR title, status, review synthesis, and quality score.

### Tests for User Story 3

- [ ] T027 [P] [US3] Extend `tests/integration/api/projects/pr-diff.test.ts`: `pr:null` empty state (200), never-reviewed PR → `layers:[]`, a post-review file routed to the "Additional changes" synthetic layer, missing repo scope → `AUTH_REQUIRED` (403), forbidden user → `FORBIDDEN` (403).
- [ ] T028 [P] [US3] Extend `tests/unit/components/pr-diff-viewer.test.tsx`: Overview renders title/status/synthesis/quality score; no-PR, auth-required, and never-reviewed (defaults to Files mode) fallback states render without error.

### Implementation for User Story 3

- [ ] T029 [US3] Extend `app/api/projects/[projectId]/tickets/[id]/pr-diff/route.ts` to assemble `PrOverview` (`reviewSynthesis`, `qualityScore`, `qualityThreshold`) from the latest COMPLETED verify job, reusing the threshold/color helpers in `lib/quality-score.ts` (FR-003). (Depends on T017.)
- [ ] T030 [US3] Extend `components/ticket/pr-diff-viewer.tsx` with the Overview entry (title/status/synthesis/quality score) and the empty-state branches: no-PR ("no PR available"), `AUTH_REQUIRED` (actionable message), and never-reviewed → default to Files mode (FR-003/FR-014/FR-017). (Depends on T020, T029.)

**Checkpoint**: All three user stories are independently functional; the viewer is robust on un-reviewed, drifted, no-PR, and unauthorized cases.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and edge-case finishing affecting multiple stories.

- [ ] T031 Run `bun run type-check` and `bun run lint`; fix ALL errors (including any pre-existing) before commit per CLAUDE.md.
- [ ] T032 [P] Verify SC-006 visual consistency: `components/ticket/pr-file-diff.tsx` matches `components/ticket/diff-viewer.tsx` tokens (zinc card, green/red, `+/-` counters); no hardcoded hex/rgb colors.
- [ ] T033 Surface large-PR/binary edge cases in `components/ticket/pr-diff-viewer.tsx`: render `truncated` and `patchTruncated` indicators and the binary "status-only" file entry so large PRs stay responsive (spec Edge Cases).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. T003 depends on T002. T004/T005/T006 depend on T002+T003. BLOCKS all user stories.
- **User Story 1 (Phase 3, P1)**: Depends on Foundational. The MVP.
- **User Story 2 (Phase 4, P1)**: Depends on Foundational; extends US1 files (`pr-state.ts`, route, `pr-file-diff.tsx`).
- **User Story 3 (Phase 5, P2)**: Depends on Foundational; extends US1 files (route, `pr-diff-viewer.tsx`).
- **Polish (Phase 6)**: Depends on all targeted stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independently testable — the core viewer + layers + VERIFY artifact pipeline.
- **US2 (P1)**: Builds on US1's `pr-state.ts`/route/`pr-file-diff.tsx`; independently testable (comments visible & anchored, read-only).
- **US3 (P2)**: Builds on US1's route/`pr-diff-viewer.tsx`; independently testable (Overview + fallbacks). The synthetic "Additional changes" reconcile lives in US1's T015 and is exercised by US3's T027.

### Within Each User Story

- Tests are written FIRST and must FAIL before implementation.
- Schemas/types (Foundational) → helpers (`pr-layers`, `pr-state`) → API route → hook → components → modal wiring.

### Parallel Opportunities

- T004, T005, T006 (Foundational) — different files, after T003.
- All US1 tests T007–T011 — different files.
- T012, T013 (command + workflow) and T015, T016, T019 (helpers + leaf component) — different files, each depends only on Foundational.
- US2 tests T022, T023 and US3 tests T027, T028 — different files.

---

## Parallel Example: User Story 1

```bash
# Tests first (all different files):
Task: "Create parse+reconcile tests in tests/unit/pr-layers.test.ts"
Task: "Create API happy-path tests in tests/integration/api/projects/pr-diff.test.ts"
Task: "Extend tests/integration/jobs/status.test.ts (layerDecomposition persisted)"
Task: "Extend tests/unit/components/ticket-detail-modal.test.tsx (PR Diff button)"
Task: "Create tests/unit/components/pr-diff-viewer.test.tsx (toggle + selection)"

# Then parallel implementation (different files):
Task: "Emit LAYER_DECOMPOSITION_JSON in .claude-plugin/commands/ai-board.code-review.md"
Task: "Parse layer marker in .github/workflows/verify.yml"
Task: "Implement lib/pr-layers.ts (parse + reconcile)"
Task: "Implement lib/github/pr-state.ts (resolvePr + listPrFiles)"
Task: "Implement components/ticket/pr-file-diff.tsx (diff rendering)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: Foundational (DB column, types, schemas) — CRITICAL, blocks all stories.
3. Phase 3: User Story 1 (viewer + layers + VERIFY artifact pipeline).
4. **STOP and VALIDATE**: open a reviewed-PR ticket in VERIFY → ordered layers + per-file diffs.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test → demo (MVP: layered diff viewer).
3. US2 → test → demo (inline comments, read-only).
4. US3 → test → demo (Overview + robust fallbacks).

### Parallel Execution Strategy

After Foundational completes, US1 must land first (US2 and US3 extend its files). US2 and US3 touch overlapping US1 files (route, viewer, pr-state) so run them sequentially after US1 rather than fully in parallel; within each story, the [P] tasks above can run concurrently.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- [Story] label maps each task to its user story for traceability.
- Verify tests FAIL before implementing.
- Read-only feature: no mutation paths, no comment compose/reply/resolve, unified single-column diff only (FR-011, FR-018).
- Opening the viewer triggers ZERO new review computation — layers come from the persisted snapshot (FR-012, SC-002).
- Run `bun run type-check` and `bun run lint` before committing; if Prisma schema changed, `bunx prisma generate`.
