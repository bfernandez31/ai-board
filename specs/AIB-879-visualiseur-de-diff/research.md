# Research: In-App PR Diff Viewer with Layered Grouping (Read-Only)

**Feature**: AIB-879 | **Date**: 2026-06-30

## Overview

The feature adds a read-only, full-screen in-app viewer for a ticket's PR diff, organized
by semantic layers produced by the VERIFY review. It composes three concerns:

1. **Read path (live)** — fetch the PR's current diff + inline comments from GitHub on open.
2. **Persisted artifact** — a layer-decomposition snapshot emitted by the VERIFY code-review
   and stored on the verify job (alongside the existing `qualityScore`).
3. **UI** — a Dialog viewer (Overview / Layers / Files) reusing the existing diff-rendering style.

All NEEDS CLARIFICATION items were resolved by the spec's Auto-Resolved Decisions (no open unknowns).

---

## Existing Files

### Diff rendering (reuse / pattern reference for FR-007, FR-008)

| Path | Covers | Action |
|------|--------|--------|
| `components/ticket/diff-viewer.tsx` | Per-file unified-diff renderer: zinc card, green/red line coloring, `+/-` counters, `FileCode/Plus/Minus` icons, binary-file fallback. **No inline comments, no collapsing.** | **Pattern reference** — match styling exactly; cannot reuse as-is (needs inline comments + collapse). |
| `app/lib/schemas/documentation.ts` (L97-110) | `documentationDiffResponseSchema` / `DocumentationDiffResponse` — `{ sha, files:[{ filename, status, additions, deletions, patch? }] }`. | **Reuse the file shape**; extend with comments + layers in a new PR-diff schema. |
| `components/board/documentation-viewer.tsx` | Dialog viewer (`max-w-4xl max-h-[90vh]`, tabs, ScrollArea) that hosts `DiffViewer`. | **Pattern reference** for the Dialog container + open trigger. |
| `lib/hooks/use-documentation-history.ts` (`useDocumentationDiff`, L123-138) | TanStack Query hook fetching a diff endpoint with lazy `enabled`. | **Pattern reference** for `usePrDiff`. |

### VERIFY review + quality-score artifact (FR-003, FR-012)

| Path | Covers | Action |
|------|--------|--------|
| `.claude-plugin/commands/ai-board.code-review.md` | The VERIFY code-review command; emits `QUALITY_SCORE_JSON:` as its **absolute last** output line (L118-122). | **Extend** — emit a `LAYER_DECOMPOSITION_JSON:` line *before* the quality-score line. |
| `.github/workflows/verify.yml` (L702-751) | "Read Quality Score" step parses `QUALITY_SCORE_JSON:` and PATCHes it to job status. | **Extend** — add a parallel parse of `LAYER_DECOMPOSITION_JSON:` and include it in the PATCH payload. |
| `app/api/jobs/[id]/status/route.ts` (L255-288) | Persists `qualityScore`/`qualityScoreDetails` only on `COMPLETED`, via atomic `updateMany`. | **Extend** — persist `layerDecomposition` the same way. |
| `lib/quality-score.ts` | Types + `parseQualityScoreDetails()` parse helper, threshold/color helpers. | **Pattern reference** for a new `lib/pr-layers.ts` parse helper. |
| `components/ticket/quality-score-section.tsx` (L22-45) | `getLatestScoredVerifyJob()` — filter `command==='verify' && status==='COMPLETED' && qualityScore!=null`, latest by `startedAt`. | **Pattern reference** for selecting the verify job carrying the layer artifact + reading the synthesis/score for Overview. |
| `prisma/schema.prisma` (Job model L29-91; `qualityScore`/`qualityScoreDetails` L61-65) | Job model; existing nullable artifact fields. | **Extend** — add `layerDecomposition String?`. |
| `lib/types/job-types.ts` (L55-79) | `TicketJobWithTelemetry` (includes `qualityScore`, `qualityScoreDetails`). | **Extend** — add `layerDecomposition: string | null`. |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` (L128-162) | Job `select` clause returning quality fields. | **Extend** — add `layerDecomposition: true` (used by the PR-diff route, not necessarily the jobs list). |

### GitHub integration (FR-001, FR-006, FR-009, FR-010, FR-013, FR-017)

| Path | Covers | Action |
|------|--------|--------|
| `lib/github/user-client.ts` | `createUserGitHubClient(userId)`, `getGitHubAccessToken`, `hasRepoScope`, `requireRepoScope` (throws `code: 'MISSING_SCOPE'`). | **Reuse** — per-user GitHub auth (matches FR-017 / Auto-Resolved authorization decision). |
| `lib/outcomes/github-files.ts` (`fetchBranchDiff`, L180-296) | PR lookup by `head: owner:branch`, `callWithRetry` wrapper, `GITHUB_FILES_CAP` truncation guard, typed failure reasons. | **Pattern reference** — PR resolution, retry, large-PR cap. |
| `lib/db/auth-helpers.ts` | `verifyProjectAccess`/`verifyTicketAccess` returning `{ githubOwner, githubRepo, defaultBranch }`. | **Reuse** — authorization + repo identity. |
| `app/api/projects/[projectId]/docs/diff/route.ts` | Reference API route: validate → `verifyProjectAccess` → octokit → typed error mapping (401/403/404/500), test-mode short-circuit. | **Pattern reference** for the new PR-diff route. |
| `app/lib/utils/ticket-resolver.ts` | `resolveTicket(projectId, identifier)`. | **Reuse** if needed for branch→ticket resolution. |

### Ticket UI (FR-001, FR-002)

| Path | Covers | Action |
|------|--------|--------|
| `components/board/ticket-detail-modal.tsx` (footer L1276-1351) | Where Spec/Plan/Tasks/Summary/Compare buttons live; `useTicketJobs` polling at L201; doc-viewer open pattern (`docViewerOpen` state). | **Extend** — add a "PR Diff" button gated to VERIFY/SHIP that opens `PrDiffViewer`. |
| `components/ui/{dialog,sheet,tabs,scroll-area,button,badge,skeleton}.tsx` | shadcn primitives available. | **Reuse**. |
| `app/lib/hooks/queries/useTicketJobs.ts` | Job-fetching hook pattern + query keys. | **Pattern reference** for `usePrDiff`. |

### Existing tests to EXTEND (constitution III — search first, don't duplicate)

| Path | Domain |
|------|--------|
| `tests/unit/components/ticket-detail-modal.test.tsx` | Add: PR-diff button visible only in VERIFY/SHIP. |
| `tests/integration/jobs/status.test.ts` | Add: `layerDecomposition` persisted on COMPLETED, ignored otherwise. |
| `tests/unit/quality-score.test.ts` | Sibling for `tests/unit/pr-layers.test.ts` (new parse helper). |
| `tests/unit/lib/github/user-client.test.ts` | Pattern reference for new GitHub-client-dependent route tests. |

> No existing test covers a PR-diff viewer/route, so NEW files are justified: `tests/integration/api/projects/pr-diff.test.ts`, `tests/unit/components/pr-diff-viewer.test.tsx`, `tests/unit/pr-layers.test.ts`.

---

## Patterns to Follow

### 1. Per-user GitHub auth with actionable failure (FR-017, security)

`lib/github/user-client.ts:36-56` — obtain the acting user's Octokit via OAuth token, and
`requireRepoScope` throws `Error` with `code='MISSING_SCOPE'`. The Auto-Resolved authorization
decision mandates the **acting user's** GitHub authorization (not a shared server token). The new
route MUST:
- resolve the session user, call `createUserGitHubClient(session.user.id)`;
- on missing token / missing scope / GitHub 403/404, return a typed `AUTH_REQUIRED` /
  `GITHUB_FORBIDDEN` code → UI renders an actionable message (never a broken/empty state).

This is **stronger** than `docs/diff/route.ts` (which uses `process.env.GITHUB_TOKEN`); we
deliberately follow the per-user pattern to satisfy FR-017.

### 2. Typed error mapping in API route (`docs/diff/route.ts:194-225`)

Single top-level `try/catch`; map `Unauthorized`→401, `Forbidden`/`Project not found`→403,
GitHub `status===404`→404, else 500. Always `{ error, code }` structured body
(constitution "Error Handling"). The PR-diff route MUST mirror this and add a
`NO_PR_FOUND` (200 with empty-state payload, not an error) per the "No PR" edge case.

### 3. GitHub retry + large-PR cap (`github-files.ts:203-296`)

Wrap GitHub calls in `callWithRetry`; treat transient vs not_found/unauthorized distinctly.
Apply a `GITHUB_FILES_CAP`-style bound and per-file patch-size bound so very large PRs / huge
file diffs stay responsive (edge case "Very large PR"): collapse oversized patches by default
and mark them, rather than streaming megabytes to the client.

### 4. Persist-on-COMPLETED, atomic (`app/api/jobs/[id]/status/route.ts:282-296`)

Layer artifact persistence MUST follow the existing guard: only write when
`requestedStatus === 'COMPLETED'` and the field is present, inside the existing atomic
conditional `updateMany({ where: { id, status: currentStatus } })`. Do **not** add a second
write. After mutation, never reuse the pre-mutation object (constitution V) — read
`updatedJob`.

### 5. Quality-score artifact lifecycle as the template (`quality-score.ts` + verify.yml + command)

The layer-decomposition artifact mirrors the quality-score artifact end-to-end:
- command emits a `*_JSON:` marker → workflow greps & base64s it → PATCH payload → status
  route persists nullable JSON string → parse helper (`parseQualityScoreDetails` analog) →
  UI reads latest COMPLETED verify job. Reuse this exact chain; do not invent new transport.
- **Ordering constraint**: `QUALITY_SCORE_JSON:` must remain the absolute-last line (the
  command and verify.yml `tail -1` depend on it). Emit `LAYER_DECOMPOSITION_JSON:` on its
  own line **before** it; the workflow greps the layer marker independently (not `tail -1`).

### 6. Read-only inline comments (FR-009, FR-011)

GitHub `pulls.listReviewComments` returns `{ path, line, original_line, body, user.login,
user.type ('Bot'|'User') }`. Source attribution: our bot = `ai-board[bot]`; other bots =
`user.type === 'Bot'`; humans otherwise. **Outdated** = `line == null` (position no longer
maps) or target line absent from the current patch hunks → surface at file header, never drop
(FR-016, Auto-Resolved CONSERVATIVE decision). Render with **no** compose/reply/resolve controls.

### 7. Component extraction discipline (constitution II)

Reuse `DiffViewer`'s visual tokens but create a `PrFileDiff` only because it adds inline
comments + collapsing (justified: own behavior). Keep `PrDiffViewer` cohesive; extract a
sub-component only when reused ≥2×, has own state, or parent exceeds ~300 lines.

---

## Key Decisions

- **Decision**: Per-user GitHub OAuth token (`createUserGitHubClient`) for the live read.
  **Rationale**: FR-017 + Auto-Resolved authorization decision require the *acting user's*
  GitHub authorization; yields the actionable auth message naturally.
  **Alternatives**: shared `GITHUB_TOKEN` (as in docs/diff) — rejected: hides per-user
  authorization and contradicts the spec.

- **Decision**: New `Job.layerDecomposition String?` (nullable JSON), persisted on COMPLETED
  verify jobs, parsed by a `lib/pr-layers.ts` helper.
  **Rationale**: Identical lifecycle to `qualityScore`; minimal new storage surface
  (Auto-Resolved decision #1). **Alternatives**: separate table / blob artifact — rejected:
  over-engineering for a small per-job JSON snapshot.

- **Decision**: Live diff/comments + stored layers merged at view time; unclassified files →
  synthetic "Additional changes" layer (FR-015).
  **Rationale**: Auto-Resolved decisions #1/#2 (always-fresh diff, snapshot layers).
  **Alternatives**: recompute layers on open — rejected by FR-012 (no new review cost).

- **Decision**: Single `GET /api/projects/[projectId]/tickets/[id]/pr-diff` returns Overview +
  layers + files (with patches) + comments in one payload.
  **Rationale**: One live fetch on open (SC-002), simplest client.
  **Alternatives**: split endpoints (metadata/diff/comments) — rejected: more round-trips,
  no v1 benefit.

- **Decision**: Unified (single-column) diff only; Dialog (not Sheet) container.
  **Rationale**: FR-018 scope boundary; Dialog matches `DocumentationViewer`.
