# Research: Display Health Score Heart Indicator on Project Cards

**Feature Branch**: `AIB-546-display-health-score`
**Created**: 2026-04-07

## Technical Context Resolution

### 1. HealthScore Data Model

- **Decision**: Reuse existing `HealthScore` Prisma model (one-to-one with `Project` via unique `projectId`)
- **Rationale**: Model already contains all required fields — `globalScore` (nullable int) and 6 sub-scores (`securityScore`, `complianceScore`, `testsScore`, `specSyncScore`, `qualityGate`, `reviewQualityScore`), all nullable integers 0-100
- **Alternatives considered**: Creating a denormalized score cache on the Project model — rejected because the existing relation is efficient via Prisma eager loading

### 2. Score Threshold & Color Utilities

- **Decision**: Reuse `getScoreColor()` from `lib/quality-score.ts` and `getScoreColorConfig()` from `lib/health/score-calculator.ts`
- **Rationale**: These already implement the exact threshold breakpoints (90/70/50) and color mappings (ctp-green/ctp-blue/ctp-yellow/ctp-red) specified in the feature requirements
- **Alternatives considered**: Duplicating threshold logic in a new utility — rejected to maintain single source of truth

### 3. Popover Component

- **Decision**: Use shadcn/ui `Popover` component (`components/ui/popover.tsx`) with hover behavior
- **Rationale**: Already available in the project. No `HoverCard` component exists, but Popover can be configured with `onOpenChange` and mouse event handlers for hover-triggered display
- **Alternatives considered**: Using `Tooltip` — rejected because tooltip is not designed for rich content with multiple sub-scores; using Radix `HoverCard` — would require installing a new shadcn component

### 4. Heart Icon Approach

- **Decision**: Use SVG heart shape with score text rendered inside, leveraging lucide-react `Heart` icon as visual reference for shape
- **Rationale**: Per spec auto-resolved decision, SVG provides precise control over sizing, color fill, and glow effects. The score number is rendered as centered text over the heart shape
- **Alternatives considered**: Using lucide-react `Heart` icon directly — limited control over fill and text overlay positioning

### 5. Data Loading Strategy

- **Decision**: Extend `getUserProjects()` Prisma query in `lib/db/projects.ts` to include `healthScore` relation via Prisma `select`
- **Rationale**: Per spec FR-010, health data must load alongside project data. Adding a single join is minimal overhead vs N+1 per-card fetching
- **Alternatives considered**: Separate `/api/projects/health` batch endpoint — rejected as unnecessary complexity

## Existing Files

### Source Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `lib/db/projects.ts` | `getUserProjects()` Prisma query | **Extend** — add `healthScore` to select clause |
| `app/lib/types/project.ts` | `ProjectWithCount` type | **Extend** — add `healthScore` field |
| `app/projects/page.tsx` | Server component project list | **Extend** — map healthScore in response transform |
| `app/api/projects/route.ts` | GET `/api/projects` handler | **Extend** — map healthScore in response transform |
| `components/projects/project-card.tsx` | Project card component | **Extend** — add heart indicator to CardHeader |

### Source Files to Reuse (Read-Only)

| File | Purpose | What to Reuse |
|------|---------|---------------|
| `lib/quality-score.ts` | Score thresholds and colors | `getScoreColor()`, `getScoreThreshold()` |
| `lib/health/score-calculator.ts` | Null-safe score config | `getScoreColorConfig()` |
| `components/health/health-sub-score-badge.tsx` | Sub-score display pattern | Visual pattern for popover sub-score rows |
| `components/ui/popover.tsx` | Radix Popover wrapper | Popover/PopoverTrigger/PopoverContent |

### New Files to Create

| File | Purpose |
|------|---------|
| `components/projects/health-score-heart.tsx` | Heart indicator component with SVG, color, glow, and hover popover |

### Existing Test Files

| File | Covers | Action |
|------|--------|--------|
| `tests/unit/health/score-calculator.test.ts` | `calculateGlobalScore`, `getScoreLabel`, `getScoreColorConfig` | No changes needed — utilities unchanged |
| `tests/unit/quality-score.test.ts` | `getScoreColor`, `getScoreThreshold` | No changes needed — utilities unchanged |
| `tests/unit/components/health-hero.test.tsx` | Health hero score display | No changes needed — separate component |
| `tests/unit/components/health-module-card.test.tsx` | Health module card states | No changes needed — separate component |
| `tests/integration/health/health-score.test.ts` | Health score GET endpoint | No changes needed — different endpoint |

### New Test Files to Create

| File | Purpose | Rationale |
|------|---------|-----------|
| `tests/unit/components/health-score-heart.test.tsx` | Test heart indicator rendering, color thresholds, no-data state, popover sub-scores | New component — no existing test covers project card health display |
| `tests/integration/projects/projects-with-health.test.ts` | Test that GET `/api/projects` includes health score data | Existing project integration tests don't cover health score inclusion |
