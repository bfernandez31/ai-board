# Data Model: In-App PR Diff Viewer with Layered Grouping

**Feature**: AIB-879 | **Date**: 2026-06-30

This feature adds **one persisted DB field** and several **transient/runtime types**
(not stored). The live PR state is fetched from GitHub on open and never persisted.

---

## 1. Persisted: `Job.layerDecomposition` (Prisma)

Add a nullable JSON-string column to the existing `Job` model
(`prisma/schema.prisma`, Job model ~L61-65, beside `qualityScore`/`qualityScoreDetails`):

```prisma
model Job {
  // ...existing fields...
  qualityScore        Int?
  qualityScoreDetails String?

  // AIB-879: layer-decomposition snapshot emitted by the VERIFY code-review.
  // JSON string (see LayerDecompositionArtifact). Only populated for COMPLETED
  // verify jobs. Null = never reviewed / decomposition failed → viewer falls back
  // to flat Files mode.
  layerDecomposition  String?
}
```

- **Type**: `String?` (nullable). JSON serialized — matches the `qualityScoreDetails` precedent
  (no new column type, no Postgres `Json` migration risk).
- **Population**: written **only** on `status === 'COMPLETED'` for `command === 'verify'`, via
  the existing atomic `updateMany` in `app/api/jobs/[id]/status/route.ts`.
- **Migration**: `prisma migrate dev` (additive, nullable, no backfill — pre-existing jobs stay
  `null`). Run `bunx prisma generate` after.
- **No index needed** — always read via the already-indexed `(ticketId, status, startedAt)` path
  used by `getLatestScoredVerifyJob`.

### `LayerDecompositionArtifact` (shape of the JSON string)

```ts
interface LayerDecompositionArtifact {
  version: 1;
  computedAt: string;          // ISO-8601
  layers: LayerDescriptor[];   // dependency order = array order
}

interface LayerDescriptor {
  id: string;                  // stable slug, e.g. "foundations"
  title: string;               // e.g. "Foundations (schema & contracts)"
  summary: string;             // short, one-line
  order: number;               // 1-based dependency rank
  files: string[];             // member file paths (PR-relative)
}
```

**Validation rules**:
- `layers` ordered ascending by `order`; `order` unique within an artifact.
- `files` are file paths as they appeared at review time; reconciled against the **current**
  file set at view time (see Reconciliation).
- A file path appears in at most one layer (a file routed to >1 layer is de-duped to the first).
- Empty `layers` array is valid (treated as "no decomposition" → flat Files mode, FR-014).

---

## 2. Runtime / API types (NOT persisted)

Defined as Zod schemas in `app/lib/schemas/pr-diff.ts`; the API response is assembled per request.

### `PrDiffResponse` (the `GET …/pr-diff` body)

```ts
interface PrDiffResponse {
  pr: PrSummary | null;        // null → NO_PR_FOUND empty state (FR edge case)
  overview: PrOverview;        // title/status/synthesis/qualityScore
  layers: ResolvedLayer[];     // dependency order; includes synthetic "Additional changes"
  files: FileChange[];         // flat list (Files mode); same diffs as layers
  truncated: boolean;          // true if file/patch caps applied (large-PR edge case)
}
```

### `PrSummary` / `PrOverview` (FR-003)

```ts
interface PrSummary {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
}

interface PrOverview {
  pr: PrSummary | null;
  reviewSynthesis: string | null;   // from the verify review (Overview)
  qualityScore: number | null;      // existing Job.qualityScore
  qualityThreshold: ScoreThreshold | null; // reuse lib/quality-score.ts
}
```

### `ResolvedLayer` (FR-004, FR-005, FR-015)

```ts
interface ResolvedLayer {
  id: string;                  // "additional-changes" for the synthetic layer
  title: string;
  summary: string;
  order: number;
  files: FileChange[];         // resolved against current diff
  fileCount: number;           // derived counter
  commentCount: number;        // derived counter (reflects displayed comments, FR edge case)
  synthetic: boolean;          // true for "Additional changes"
}
```

### `FileChange` (FR-006, FR-007) — extends the existing diff file shape

```ts
interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed';
  additions: number;
  deletions: number;
  patch?: string;              // unified diff; absent for binary/generated/oversized
  binary: boolean;             // edge case: binary/generated → entry without line content
  patchTruncated: boolean;     // oversized patch collapsed by default
  comments: InlineComment[];   // anchored to lines within this file
}
```

> The `{ filename, status, additions, deletions, patch }` core is identical to
> `DocumentationDiffResponse.files[]` (`app/lib/schemas/documentation.ts:97-110`) so the existing
> `DiffViewer` rendering style applies directly; `binary`/`patchTruncated`/`comments` are additive.

### `InlineComment` (FR-009, FR-010, FR-011, FR-016)

```ts
interface InlineComment {
  id: number;
  source: 'ai-board' | 'bot' | 'human';   // attribution (FR-010)
  author: string;                          // login / display name
  line: number | null;                     // target line in current diff; null when outdated
  body: string;
  outdated: boolean;                       // true when anchor no longer exists (FR-016)
  createdAt: string;
}
```

**Validation / derivation rules**:
- `source`: `ai-board[bot]` → `'ai-board'`; GitHub `user.type === 'Bot'` → `'bot'`; else `'human'`.
- `outdated = true` when GitHub `line == null` OR the target line is not present in the current
  patch hunks. Outdated comments are kept and surfaced (never dropped).
- Read-only: no mutation fields; the API exposes no POST/PATCH/DELETE for comments.

---

## 3. Reconciliation (stored layers × live files) — FR-015

At view time (`PR State Retrieval` process):
1. Build the current `FileChange[]` from GitHub.
2. For each stored `LayerDescriptor`, intersect its `files` with current filenames → that layer's
   `FileChange[]`. Drop empty layers gracefully (edge case "layer files later removed") without
   breaking `order`.
3. Any current file **not** claimed by any layer → collect into the synthetic
   **"Additional changes"** layer (`id='additional-changes'`, `synthetic=true`), appended last.
4. If no artifact exists (or `layers` empty) → `layers = []`; client defaults to Files mode (FR-014).
5. Counters (`fileCount`, `commentCount`) derived **after** reconciliation so they reflect what is
   actually shown (edge case "counters vs displayed mismatch").

---

## 4. Entity → Requirement traceability

| Spec entity | Realization | Requirements |
|-------------|-------------|--------------|
| PR Diff View | `PrDiffViewer` component state (mode, selectedLayer) | FR-001, FR-002 |
| Layer (cohort) | `LayerDescriptor` (stored) → `ResolvedLayer` (runtime) | FR-004, FR-005, FR-015 |
| File Change | `FileChange` | FR-006, FR-007 |
| Inline Comment | `InlineComment` | FR-009, FR-010, FR-011, FR-016 |
| Review Synthesis & Quality Score | `PrOverview` (reuse `Job.qualityScore`) | FR-003 |
| Layer Decomposition Artifact | `Job.layerDecomposition` JSON | FR-012 |
