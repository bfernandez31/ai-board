# Data Model — AIB-759

## Schema changes

**None.** This feature is render-and-interaction-only. Confirmed by:

- FR-010: cost and token data MUST be preserved.
- SC-005 wording: "0 history rows display the cost ($) or token-count metric **after this change ships**" — i.e., visual change only.
- The existing `HealthScan` model in `prisma/schema.prisma` already has every field this feature reads.

No `prisma migrate` is run in this branch.

## Entities (read-only references)

### `HealthScan` (existing — `prisma/schema.prisma:541–594`)

The fields actually exercised by AIB-759:

| Field | Type | Used by feature for |
|-------|------|---------------------|
| `id` | `Int` (PK) | `selectedScanId` state, query key, URL param of new `GET …/scans/:scanId` route |
| `projectId` | `Int` (FK) | Authorization guard on the new endpoint (cross-project enumeration defence) |
| `scanType` | `HealthScanType` enum | Match against drawer's active `moduleType` to pick the right `parseScanReport` path |
| `status` | `HealthScanStatus` enum | Determines whether report rendering is meaningful (only `COMPLETED` historically had a populated `report`) |
| `score` | `Int?` | Existing history row score badge — unchanged rendering |
| `issuesFound` | `Int?` | **Drives the new friction badge.** Mapping: `0 → low`, `1–2 → med`, `≥3 → high`, `null → no badge` |
| `report` | `Json?` | Returned by new endpoint and parsed via `parseScanReport(moduleType, raw)` for drawer display |
| `baseCommit`, `headCommit` | `String?` | Existing commit-range line — unchanged |
| `durationMs` | `Int?` | Existing duration column — unchanged |
| `tokensUsed`, `costUsd` | `Int?` / `Decimal?` | **Still selected by the list endpoint, still on the type. Just not rendered in `HistoryEntry` anymore.** |
| `completedAt`, `createdAt` | `DateTime` | Existing date column — unchanged |

Fields not used by this feature (left unchanged): `errorMessage`, `startedAt`, `updatedAt`, `issuesFixed`.

## Derived values (in-app, not persisted)

### `frictionLevelForIssueCount(issuesFound: number | null): 'low' | 'med' | 'high' | null`

Pure function in `lib/health/issue-friction.ts`.

| Input | Output | Rationale |
|-------|--------|-----------|
| `null` | `null` | Caller omits the badge — same as today's `scan.issuesFound !== null` guard |
| `0` | `'low'` | FR-007: green for clean scans |
| `1`, `2` | `'med'` | FR-007: yellow for minor issues |
| `≥ 3` | `'high'` | FR-007: red for problematic scans |
| Negative or non-finite | `null` | Defensive — should never happen given the schema (`Int`), but avoids miscoloring on bad input |

This helper has its own unit tests (`tests/unit/lib/health/issue-friction.test.ts`) covering each band boundary.

## In-memory state introduced by the feature

### `selectedScanId: number | null` (in `ScanDetailDrawer`)

| Value | Meaning | UI state |
|-------|---------|----------|
| `null` | No historic row chosen → render the latest scan (current behavior). | "Latest" button: `disabled`. No row has `aria-pressed="true"`. |
| `number` | Historic row chosen. | "Latest" button: enabled. Matching history row has `aria-pressed="true"`, accent border, bold date. Issues / Recommendations / Fixes area renders the selected scan's report. |

### State transitions

- **On `moduleType` change** (drawer opens for a different module, or closes): `selectedScanId` → `null`. Implements FR-004.
- **On row activation** (click / Enter / Space on a `HistoryEntry`): `selectedScanId` → that scan's `id`. Implements FR-001, FR-002.
- **On "Latest" activation**: `selectedScanId` → `null`. Implements FR-005.
- **On rapid switches**: state takes the last value; TanStack Query keys per `scanId` so rendered report always reflects the last set value (FR-015).

## Validation rules touching this feature

- API: `scanId` must be a positive integer (Zod / `parseInt` + `>0` guard at the route level).
- API: looked-up scan's `projectId` MUST equal the URL `projectId`; otherwise return `404` (do not leak existence).
- UI: the friction helper MUST never throw; for unexpected inputs return `null` and skip the badge.

## Out of scope (explicitly)

- `QualityGateReport` (`QUALITY_GATE` module): rendered by a separate `quality-gate-drawer.tsx` (`health-dashboard.tsx:107–111`). Spec FR-012 lists the active modules sharing the scan-detail drawer; QUALITY_GATE is passive and uses its own drawer with no Scan History list.
- Cost/token persistence changes (FR-010 explicitly preserves them).
- Stickiness of selection across drawer reopens (auto-resolved as "do not persist").
