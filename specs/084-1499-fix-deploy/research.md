# Research: Unified Deploy Preview Icon

**Feature**: Consolidate preview and deploy icons into single stateful icon
**Branch**: `084-1499-fix-deploy`
**Date**: 2025-11-04

## Executive Summary

The current implementation uses two separate components (`TicketCardPreviewIcon` and `TicketCardDeployIcon`) that can appear simultaneously, creating visual clutter and confusion. This research documents the design decisions for consolidating these into a single stateful icon with clear visual hierarchy.

## Research Findings

### 1. Current Implementation Analysis

**Problem Identification**:
- Two separate icon components in `components/board/ticket-card.tsx` (lines 169-203)
- Preview icon always shown when `ticket.previewUrl` exists (line 169-174)
- Deploy icon shown when `deployJob` exists OR `isDeployable` is true (lines 177-203)
- Icons can appear simultaneously when ticket has preview URL AND is deployable
- User explicitly requested cleanup: "just need to clean up the useless preview deploy button"

**Current Icon Logic**:
```typescript
// Preview Icon (always shows if previewUrl exists)
{ticket.previewUrl && (
  <TicketCardPreviewIcon previewUrl={ticket.previewUrl} ticketKey={ticket.ticketKey} />
)}

// Deploy Icon (shows if deploy job exists OR ticket is deployable)
{deployJob ? (
  // Show job indicator for PENDING/RUNNING, deploy button for FAILED/CANCELLED/COMPLETED
) : isDeployable ? (
  <TicketCardDeployIcon onDeploy={() => setShowDeployModal(true)} ticketKey={ticket.ticketKey} />
) : null}
```

### 2. Icon State Priority Research

**Decision**: Icon State Priority Order (Highest to Lowest)
**Rationale**:
- Preview state takes highest priority because accessing deployed previews is the primary user goal
- Once preview exists, user no longer needs deploy action (deployment already completed)
- Deploying state needs visual feedback to prevent duplicate deployments
- Deploy action only relevant when no preview exists and ticket is deployable

**State Priority**:
1. **Preview (Green Icon)**: `ticket.previewUrl !== null` - User can access deployed preview
2. **Deploying (Blue Bounce)**: `deployJob.status === 'PENDING' | 'RUNNING'` - Deployment in progress
3. **Deployable (Neutral Icon)**: `isDeployable === true OR deployJob.status === 'FAILED' | 'CANCELLED'` - User can trigger deploy
4. **Hidden**: None of above conditions met

**Alternatives Considered**:
- Show both icons simultaneously: Rejected due to visual clutter (current problem)
- Deploy takes priority over preview: Rejected because user already achieved goal (preview exists)
- Use dropdown menu: Rejected due to extra click overhead and complexity

### 3. Icon Selection Research

**Decision**: Use existing lucide-react icons with color coding
**Rationale**:
- ExternalLink (green): Clearly indicates external preview deployment access
- Rocket (neutral): Familiar deploy action icon from existing implementation
- Blue bounce animation: Existing pattern for PENDING/RUNNING jobs (consistency)

**Icon States**:
| State | Icon | Color | Animation | Clickable |
|-------|------|-------|-----------|-----------|
| Preview | ExternalLink | text-green-400 | None | Yes (opens URL) |
| Deploying | Rocket | text-blue-400 | Bounce | No (disabled) |
| Deployable | Rocket | text-[#a6adc8] | None | Yes (opens modal) |
| Hidden | N/A | N/A | N/A | N/A |

**Color Rationale**:
- Green (text-green-400): Reuses existing completed status badge color for consistency
- Blue (text-blue-400): Matches existing PENDING/RUNNING job indicator color
- Neutral (text-[#a6adc8]): Matches existing hover state for non-active icons

**Alternatives Considered**:
- Custom SVG icons: Rejected due to maintenance overhead and shadcn/ui conventions
- Same icon for all states: Rejected due to poor visual distinction
- Amber/yellow for deploying: Rejected due to lack of existing usage in design system

### 4. Component Architecture Research

**Decision**: Inline icon logic in TicketCard component, remove separate icon components
**Rationale**:
- Icon state logic is tightly coupled to ticket and job data (already in TicketCard)
- Separate components add indirection without meaningful reusability
- State priority logic requires access to multiple props (ticket, deployJob, isDeployable)
- Simplifies codebase by reducing component count (remove 2 files)

**Implementation Pattern**:
```typescript
// Compute icon state once in TicketCard
const deployIconState = React.useMemo(() => {
  if (ticket.previewUrl) return 'preview';
  if (deployJob?.status === 'PENDING' || deployJob?.status === 'RUNNING') return 'deploying';
  if (isDeployable || deployJob?.status === 'FAILED' || deployJob?.status === 'CANCELLED') return 'deployable';
  return 'hidden';
}, [ticket.previewUrl, deployJob?.status, isDeployable]);

// Render single icon based on state
{deployIconState !== 'hidden' && (
  <Button /* ... state-dependent props ... */>
    {deployIconState === 'preview' ? <ExternalLink /> : <Rocket />}
  </Button>
)}
```

**Alternatives Considered**:
- Create new `UnifiedDeployIcon` component: Rejected due to tight coupling with parent state
- Use state machine library: Rejected due to overkill for 4 simple states
- Keep separate components, hide one conditionally: Rejected due to unnecessary complexity

### 5. Testing Strategy Research

**Decision**: Hybrid testing with Vitest (unit) + Playwright (integration)
**Rationale**:
- State priority logic is pure function (perfect for Vitest unit tests ~1ms)
- Icon rendering and click behavior requires DOM (Playwright integration tests)
- Constitution Principle III mandates hybrid testing for this scenario

**Test Coverage**:
- **Unit Tests (Vitest)**: Icon state priority logic
  - Test all 4 state conditions independently
  - Test state priority when multiple conditions true
  - Test edge cases (null values, undefined jobs)
- **Integration Tests (Playwright)**: Component rendering and interactions
  - Test green icon appearance when preview URL exists
  - Test rocket icon appearance when deployable
  - Test blue bounce animation during deployment
  - Test click handlers (preview opens URL, deploy opens modal)
  - Test disabled state during deployment

**Alternatives Considered**:
- E2E tests only: Rejected due to slow feedback loop (~500ms vs 1ms)
- Unit tests only: Rejected due to inability to test DOM interactions
- React Testing Library: Rejected in favor of existing Playwright setup (constitution mandates Playwright)

### 6. Accessibility Research

**Decision**: Maintain existing accessibility patterns with updated labels
**Rationale**:
- Existing icon buttons already have aria-label and title attributes
- Screen readers need context for state changes
- Keyboard navigation must work consistently

**Accessibility Requirements**:
- aria-label must describe current state and action ("Open preview deployment" vs "Deploy preview")
- title attribute provides hover tooltip
- disabled state must prevent keyboard focus when deploying
- Color must not be sole indicator (icon shape changes too: ExternalLink vs Rocket)

**Alternatives Considered**:
- Add aria-live region for state changes: Rejected as overkill for non-critical updates
- Use role="status" for deploying state: Rejected due to lack of meaningful status text
- Add visible text labels: Rejected due to space constraints and design consistency

## Implementation Checklist

Based on research findings, implementation requires:

- [ ] Remove `components/board/ticket-card-preview-icon.tsx` (deprecated)
- [ ] Remove `components/board/ticket-card-deploy-icon.tsx` (deprecated)
- [ ] Add icon state priority logic to `TicketCard` component
- [ ] Render unified icon based on state (green ExternalLink for preview, neutral/blue Rocket for deploy)
- [ ] Update click handlers (preview opens URL, deploy opens modal)
- [ ] Update aria-labels and tooltips for accessibility
- [ ] Create Vitest unit tests for state priority logic (`tests/unit/unified-deploy-icon.test.ts`)
- [ ] Create Playwright integration tests for rendering and interactions (`tests/integration/board/unified-deploy-icon.spec.ts`)
- [ ] Verify no existing tests require updates (search with Grep/Glob before creating new tests)

## Open Questions

**None** - All research complete. No clarifications needed from stakeholders.

## References

- Current implementation: `components/board/ticket-card.tsx` (lines 169-203)
- Job status indicator pattern: `components/board/job-status-indicator.tsx`
- Deploy eligibility logic: `lib/utils/deploy-preview-eligibility.ts`
- Constitution testing requirements: `.specify/memory/constitution.md` (Principle III)
- Design system colors: TailwindCSS config (text-green-400, text-blue-400, text-[#a6adc8])
