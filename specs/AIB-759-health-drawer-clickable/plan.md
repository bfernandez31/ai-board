# Implementation Plan: Health drawer — clickable scan history + visible issue counts

**Branch**: `AIB-759-health-drawer-clickable` | **Date**: 2026-04-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-759-health-drawer-clickable/spec.md`

## Summary

Make every Scan History row in the active health-module drawer (Compliance, Security, Tests, Spec Sync, Review Quality) interactive — clicking, Enter, or Space replaces the report area with that scan's detailed report while leaving the Score Trend chart pinned to the full period. Colorize each row's `issuesFound` count with the existing unified `Badge variant="attribute-tc" kind="friction"` (low/med/high), and stop rendering the cost ($) and token columns. Cost and token data remain in the database and the API; only the rendering is removed.

Technical approach: lift `selectedScanId` state into `ScanDetailDrawer`; introduce one new REST endpoint `GET /api/projects/:projectId/health/scans/:scanId` and one TanStack Query hook `useScanById` so historic-row clicks fetch and display the right report; convert each `<HistoryEntry>` row to a native `<button>` with `aria-pressed` selection state and a non-color selection cue (left accent border + bold date); add a "Latest" affordance, disabled when the latest scan is implicitly current. No schema migration.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict)
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.95.2, shadcn/ui (existing `Badge`, `Sheet`, `Button`, `Tooltip`), lucide-react, TailwindCSS 3.4
**Storage**: PostgreSQL via Prisma — no schema change
**Testing**: Vitest + React Testing Library (component + integration); no E2E required for this feature
**Target Platform**: Browser (Next.js client component)
**Project Type**: Web (single Next.js app)
**Performance Goals**: <500 ms perceived latency on row swap (SC-008); cached subsequent re-clicks (TanStack Query 30 s `staleTime`)
**Constraints**: No new color tokens (FR-008, SC-004); no schema migration (FR-010, SC-005); WCAG AA contrast; keyboard-operable (US4); no hardcoded hex/rgb
**Scale/Scope**: ~10 history rows per drawer page; up to 5 active modules sharing the drawer (FR-012)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | Pass | All new code in strict TS; no `any`. New helper, hook, and route all explicitly typed. |
| **II. Component-Driven** | Pass | Reuses existing shadcn/ui `Badge`, `Button`. No custom UI primitive. `<DrawerHistory>` already exists; we extend it. New code is in client components (`'use client'` already declared). |
| **III. TDD (NON-NEGOTIABLE)** | Pass | Test plan covers each FR. Existing `tests/unit/components/scan-detail-drawer.test.tsx` extended (constitution: "extend, don't duplicate") for orchestration cases. New test files justified: `drawer-history.test.tsx` (no existing coverage of the row), `issue-friction.test.ts` (new helper), `scan-by-id.test.ts` (new endpoint). RTL queries default to `getByRole`; user interactions via `userEvent`. |
| **IV. Security-First** | Pass | New endpoint uses `verifyProjectAccess`. Cross-project ID-enumeration defence: scan's `projectId` re-checked against URL `:projectId`; mismatch returns `404`, not `403`. Integer validation on path params. No new secrets. No new sensitive fields exposed (response shape mirrors the already-shipped list endpoint with `includeReport=true`). |
| **V. Database Integrity** | Pass | No migration. No mutation. Read-only endpoint. |
| **V. Specification Clarification Guardrails** | Pass | Spec contains an `Auto-Resolved Decisions` block. CONSERVATIVE fallbacks (Latest affordance, empty state, selection reset) are honored verbatim in the design. |

**Additional Standards (CLAUDE.md)**:

- No hardcoded hex/rgb (FR-008): friction levels come from existing `LEVEL_FRICTION_CLASS` map (`components/ui/badge.tsx:112–117`).
- No dynamic Tailwind class construction: helper returns one of the literal levels `'low'`, `'med'`, `'high'` and the badge component already maps them statically.
- Aurora B+ theme: reuses `aurora-bg-selected`, `aurora-glass`.
- shadcn-only UI primitives: `Badge`, `Button` from `components/ui/`.

**Gate verdict**: All checks pass. No `Complexity Tracking` entries required.

## Project Structure

### Documentation (this feature)

```
specs/AIB-759-health-drawer-clickable/
├── plan.md                                 # This file
├── research.md                             # Phase 0 output
├── data-model.md                           # Phase 1 output
├── contracts/
│   ├── get-scan-by-id.md                   # New REST endpoint contract
│   └── drawer-history-component.md         # DrawerHistory props/behavior contract
├── checklists/                             # (existing folder, unrelated to /plan)
├── spec.md                                 # Authoritative spec (input)
└── tasks.md                                # Phase 2 — created by /ai-board.tasks (NOT here)
```

### Source Code (repository root)

```
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── health/
│               └── scans/
│                   ├── route.ts                       # EXISTING — unchanged
│                   └── [scanId]/
│                       ├── route.ts                   # NEW — GET handler (contract: get-scan-by-id.md)
│                       └── status/
│                           └── route.ts               # EXISTING — unchanged
└── lib/
    ├── hooks/
    │   ├── useScanReport.ts                          # EXISTING — unchanged (latest-scan source)
    │   └── useScanById.ts                            # NEW — historic-scan source
    └── query-keys.ts                                  # MODIFIED — add health.scan(projectId, scanId) key

components/
└── health/
    ├── scan-detail-drawer.tsx                        # MODIFIED — lift selectedScanId state, switch render source
    └── drawer/
        └── drawer-history.tsx                        # MODIFIED — controlled, clickable rows, friction badge, no cost/tokens, "Latest" button

lib/
└── health/
    └── issue-friction.ts                             # NEW — frictionLevelForIssueCount helper

tests/
├── unit/
│   ├── components/
│   │   ├── drawer-history.test.tsx                   # NEW — clickability, badges, removed columns, keyboard
│   │   └── scan-detail-drawer.test.tsx               # EXTENDED — historic selection, empty state, reset
│   └── lib/
│       └── health/
│           └── issue-friction.test.ts                # NEW — threshold helper
└── integration/
    └── health/
        └── scan-by-id.test.ts                        # NEW — endpoint auth + cross-project guard
```

**Structure Decision**: Single Next.js project (web). Existing `app/api/.../health/scans/[scanId]/` directory hosts the new sibling `route.ts`. No new top-level directories. Tests follow existing `tests/{unit,integration}/...` convention; `tests/unit/lib/health/` is a new but obvious leaf for pure helper tests.

## Phase 0 Research — see `research.md`

Resolved 8 decisions (D-001 through D-008). Captured "Existing Files" inventory (modify, new, extend, reference) and "Patterns to Follow" (P-1 through P-6) with concrete file paths and line numbers from the live codebase. No `NEEDS CLARIFICATION` entries remain.

## Phase 1 Design — see `data-model.md` and `contracts/`

- `data-model.md`: documents zero schema changes; lists which existing `HealthScan` fields the feature reads; defines the derived helper `frictionLevelForIssueCount`; specifies the `selectedScanId: number | null` UI state and its transitions (FR-001, FR-002, FR-004, FR-005, FR-015).
- `contracts/get-scan-by-id.md`: HTTP contract for the new endpoint (path, params, auth, defence-in-depth, response shapes, status codes, integration test surface).
- `contracts/drawer-history-component.md`: props (`selectedScanId`, `latestScanId`, `onSelect`), visual state, removed elements, friction-badge usage, "Latest" button, and the controlled-component handshake with `ScanDetailDrawer`.
- Agent context: `update-agent-context.sh claude` ran successfully; CLAUDE.md is up to date.

## Implementation Phases (for /ai-board.tasks to expand)

The expansion below is intentionally non-prescriptive about ordering; `/ai-board.tasks` will produce the final dependency-ordered `tasks.md`.

### Phase A — Pure logic & types

1. Create `lib/health/issue-friction.ts` exporting `frictionLevelForIssueCount`.
2. Add `tests/unit/lib/health/issue-friction.test.ts` covering the boundary table from `data-model.md`.
3. Register `health.scan(projectId, scanId)` in `app/lib/query-keys.ts` (Pattern P-2 — match neighboring keys).

### Phase B — Server endpoint

4. Create `app/api/projects/[projectId]/health/scans/[scanId]/route.ts` per Pattern P-3 and `contracts/get-scan-by-id.md`. Reuse `verifyProjectAccess`. Add the cross-project `projectId` guard.
5. Create `tests/integration/health/scan-by-id.test.ts` with the seven test surface cases listed in the contract.

### Phase C — Client hook

6. Create `app/lib/hooks/useScanById.ts` mirroring `useScanReport` (Pattern P-2). Use the new query key. Throw on non-OK; parse with `parseScanReport`.

### Phase D — Drawer UI

7. Modify `components/health/drawer/drawer-history.tsx`:
   - Drop `Coins`, `Zap`, `formatCost`, `formatTokens` imports and the two tooltip blocks (lines 115–135) (FR-009, P-5).
   - Replace `issuesFound` `<span>` with `<Badge variant="attribute-tc" kind="friction" level={…}>` (Pattern P-1, D-003).
   - Convert outer `<div>` of `HistoryEntry` to `<button type="button">` with `aria-pressed`, selection styling, and `onClick → onSelect(scan.id)` (D-004).
   - Add the "Latest" `<Button variant="ghost" size="sm">` next to the header label (D-005).
   - Add new props `selectedScanId`, `latestScanId`, `onSelect` to the component signature.
8. Modify `components/health/scan-detail-drawer.tsx`:
   - Add `useState<number | null>` for `selectedScanId` and a `useEffect` resetting on `moduleType` change (D-002, D-007, FR-004).
   - Call both `useScanReport` (latest) and `useScanById` (selected); compute `displayedScan`/`displayedReport`.
   - Replace single empty-state copy with the conditional from `contracts/drawer-history-component.md` (FR-014).
   - Pass `selectedScanId`, `latestScanId = latestData?.scan?.id ?? null`, `onSelect={setSelectedScanId}` to `<DrawerHistory>`.

### Phase E — Tests

9. Create `tests/unit/components/drawer-history.test.tsx` with the eleven-case surface from the component contract (cases 1–11).
10. Extend `tests/unit/components/scan-detail-drawer.test.tsx` with cases 12–14 from the component contract (historic selection, empty-state copy, reset on `moduleType` change).

## Testing Strategy

Follows constitution §III. Decision-tree alignment:

| What | Test type | File |
|------|-----------|------|
| `frictionLevelForIssueCount` | **Vitest unit** (pure fn) | `tests/unit/lib/health/issue-friction.test.ts` (new) |
| `<DrawerHistory>` rendering, click/keyboard, friction badge, "Latest" | **Vitest + RTL component** | `tests/unit/components/drawer-history.test.tsx` (new) |
| `<ScanDetailDrawer>` orchestration | **Vitest + RTL component** | `tests/unit/components/scan-detail-drawer.test.tsx` (extend) |
| `GET /api/projects/:projectId/health/scans/:scanId` | **Vitest integration** | `tests/integration/health/scan-by-id.test.ts` (new) |
| End-to-end browser flow | **Not required** | The feature is keyboard + mouse on a single page; full coverage is achievable with component + integration tests. E2E budget reserved for cross-page flows. |

Existing-tests audit (constitution: "search FIRST, extend, don't duplicate"):

- `scan-detail-drawer.test.tsx` already exists for the drawer → **extend it** rather than create a new orchestration test file.
- `drawer-issues.test.tsx` covers report rendering — **untouched** because the report shape and `<DrawerIssues>` props are unchanged. The drawer simply feeds it a different report when a historic row is selected.
- No file covers `<DrawerHistory>` row rendering today → **new file justified**.

RTL queries: prefer `getByRole('button', { name: /…/ })` for the row and "Latest" affordance; `getByLabelText` for the friction badge's `aria-label`; avoid `getByTestId` unless asserting a specific data-testid intentionally exposed (e.g., the badge's level via class assertion is acceptable since it's a CSS contract).

User interactions: `userEvent.click` for mouse, `userEvent.keyboard('{Enter}')` and `'{ }'` (Space) on focused buttons.

## Complexity Tracking

*Not required — Constitution Check passed without violations.*
