# Implementation Plan: Display Health Score Heart Indicator on Project Cards

**Feature Branch**: `AIB-546-display-health-score`
**Created**: 2026-04-07
**Status**: Ready for Implementation

## Technical Context

| Aspect | Value |
|--------|-------|
| Database changes | None — HealthScore model exists, query-only change |
| New components | 1 (`HealthScoreHeart`) |
| Modified files | 5 (data layer, types, API, server page, project card) |
| New test files | 2 (unit component test, integration API test) |
| Dependencies | None — all utilities and UI primitives already available |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| TypeScript strict mode | PASS | All new types explicitly defined; `ProjectWithCount` extended with typed `healthScore` field |
| shadcn/ui only | PASS | Uses existing `Popover` component from `components/ui/popover.tsx` |
| Server Components default | PASS | `HealthScoreHeart` is client component (hover interactivity requires it); project card is already client |
| No forbidden deps | PASS | No new dependencies introduced |
| Test-driven development | PASS | Unit test for new component, integration test for API change |
| Security-first | PASS | No user input, no new endpoints, read-only data display |
| Database integrity | PASS | No schema changes, no mutations — read-only Prisma select extension |
| Color tokens only | PASS | Uses `ctp-*` theme tokens for score colors, `text-muted-foreground` for no-data state |
| No dynamic Tailwind classes | PASS | All color classes returned as complete static strings from `getScoreColor()` |

## Implementation Phases

### Phase 1: Data Layer — Extend Project List Query

**Goal**: Include health score data in the project list response without adding new endpoints.

#### Task 1.1: Extend Prisma Query

**File**: `lib/db/projects.ts`
**Change**: Add `healthScore` to the `select` clause in `getUserProjects()`.

```typescript
// Add to existing select block:
healthScore: {
  select: {
    globalScore: true,
    securityScore: true,
    complianceScore: true,
    testsScore: true,
    specSyncScore: true,
    qualityGate: true,
    reviewQualityScore: true,
  }
}
```

#### Task 1.2: Extend TypeScript Type

**File**: `app/lib/types/project.ts`
**Change**: Add `healthScore` field to `ProjectWithCount` interface.

```typescript
healthScore: {
  globalScore: number | null;
  securityScore: number | null;
  complianceScore: number | null;
  testsScore: number | null;
  specSyncScore: number | null;
  qualityGate: number | null;
  reviewQualityScore: number | null;
} | null;
```

#### Task 1.3: Update Response Mappers

**Files**: `app/projects/page.tsx` (server component), `app/api/projects/route.ts` (API route)
**Change**: Map `healthScore` from Prisma result to response shape in both locations.

```typescript
// Add to project mapping in both files:
healthScore: project.healthScore ?? null,
```

### Phase 2: UI — Heart Indicator Component

**Goal**: Create a reusable heart indicator with colored SVG, score text, glow effect, and hover popover.

#### Task 2.1: Create HealthScoreHeart Component

**File**: `components/projects/health-score-heart.tsx` (NEW)

**Props**:
```typescript
interface HealthScoreHeartProps {
  healthScore: ProjectWithCount['healthScore'];
}
```

**Behavior**:
- Renders an SVG heart path filled with the threshold color
- Displays score number (or em-dash for null) centered inside the heart
- Applies a colored `drop-shadow` glow matching the threshold color
- No-data state: muted fill color, em-dash text, no glow
- `onClick`: calls `stopPropagation()` to prevent card navigation (FR-009, FR-012)
- Hover triggers popover with sub-score breakdown

**Sub-score popover content**:
- Title: "Health Breakdown"
- 6 rows, each with label, score value (or dash), and threshold color
- Labels: Security, Compliance, Tests, Spec Sync, Quality Gate, Review Quality
- Reuses `getScoreColor()` for per-sub-score coloring
- Informational only — no links or buttons (FR-008)

**Color utilities**: Import `getScoreColorConfig()` from `lib/health/score-calculator.ts` for null-safe color resolution.

#### Task 2.2: Integrate into ProjectCard

**File**: `components/projects/project-card.tsx`
**Change**: Add `HealthScoreHeart` to the `CardHeader` flex container, positioned between the project title and the project menu.

```tsx
<div className="flex items-center justify-between">
  <CardTitle className="text-foreground" data-testid="project-name">
    {project.name}
  </CardTitle>
  <div className="flex items-center gap-1">
    <HealthScoreHeart healthScore={project.healthScore} />
    <div onClick={(e) => e.stopPropagation()}>
      <ProjectMenu projectId={project.id} />
    </div>
  </div>
</div>
```

### Phase 3: Testing

**Goal**: Verify heart indicator rendering and data layer integration.

#### Task 3.1: Unit Test — HealthScoreHeart Component

**File**: `tests/unit/components/health-score-heart.test.tsx` (NEW)

**Test cases**:
1. Renders green heart with score "95" for globalScore=95
2. Renders blue heart with score "75" for globalScore=75
3. Renders yellow heart with score "55" for globalScore=55
4. Renders red heart with score "30" for globalScore=30
5. Renders red heart with score "0" for globalScore=0 (edge case: not no-data)
6. Renders greyed-out heart with dash for null healthScore
7. Renders greyed-out heart with dash for healthScore with null globalScore
8. Popover displays all 6 sub-scores with correct colors on hover
9. Popover shows dashes for null sub-scores
10. Click on heart does not propagate (stopPropagation test)

**Pattern**: Use `renderWithProviders()` from `tests/utils/component-test-utils.tsx`, query by `data-testid`, use `userEvent.hover()` for popover.

#### Task 3.2: Integration Test — Projects API with Health Score

**File**: `tests/integration/projects/projects-with-health.test.ts` (NEW)

**Test cases**:
1. GET `/api/projects` includes `healthScore` field for projects with health data
2. GET `/api/projects` returns `healthScore: null` for projects without health data
3. Health score sub-fields are correctly serialized (all 7 score fields present)

**Pattern**: Use existing test database seeding, create a HealthScore record for a test project, verify API response shape.

## Testing Strategy

Per constitution §III (Test Selection Decision Tree):
- `HealthScoreHeart` is a React component with user interactions (hover) → **Vitest + RTL component test**
- API response shape change → **Vitest integration test**
- No browser-required behavior (no OAuth, drag-drop, viewport) → **No E2E test needed**

**Existing test files**: No existing test file covers project card rendering or project list health data. New test files are justified.

## Artifacts

| Artifact | Path |
|----------|------|
| Feature Spec | `specs/AIB-546-display-health-score/spec.md` |
| Implementation Plan | `specs/AIB-546-display-health-score/plan.md` |
| Research | `specs/AIB-546-display-health-score/research.md` |
| Data Model | `specs/AIB-546-display-health-score/data-model.md` |

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| HealthScore join slows project list query | Low | Indexed `projectId` (unique), single optional join |
| Popover interferes with card click navigation | Low | `stopPropagation()` on heart click, popover is hover-only |
| SVG heart rendering inconsistency across browsers | Low | Standard SVG path, no exotic features |
| Mobile hover behavior | Medium | Per spec assumption: mobile users use dedicated health page; hover popover is desktop enhancement |
