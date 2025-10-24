# Research: Simplified Job Status Display

**Feature**: `047-design-job-status`
**Date**: 2025-10-24
**Phase**: 0 - Research & Discovery

## Research Summary

This feature is a **visual refinement** with explicit design requirements provided in the specification. No significant research is required as all technical unknowns have been resolved through examination of existing codebase patterns.

## Technical Decisions

### Decision 1: Tooltip Implementation

**Decision**: Use shadcn/ui `Tooltip` component for AI-BOARD status tooltips

**Rationale**:
- Already part of project dependencies (shadcn/ui exclusively for UI primitives per constitution)
- Provides accessible tooltip behavior (ARIA attributes, keyboard navigation)
- Consistent with existing component patterns in codebase
- Built on Radix UI primitives ensuring cross-browser compatibility

**Alternatives Considered**:
- Custom tooltip with CSS: Rejected due to accessibility concerns and constitution requirement to use shadcn/ui
- Native HTML title attribute: Rejected due to poor UX (delays, no styling control, limited accessibility)

**Implementation Notes**:
- Import from `@/components/ui/tooltip` (shadcn/ui installation)
- Wrap AI-BOARD icon with `<TooltipProvider>`, `<Tooltip>`, `<TooltipTrigger>`, `<TooltipContent>`
- Tooltip content will be status-specific text with formatted timestamps

---

### Decision 2: Timestamp Formatting

**Decision**: Create `formatTimestamp()` utility function for human-readable job completion times

**Rationale**:
- Tooltip requires "AI-BOARD assisted on [timestamp]" format per FR-009
- Relative time format ("2 minutes ago", "yesterday", "Oct 24, 2025") improves UX
- Centralized utility enables consistent formatting across app
- Pure function perfect for Vitest unit testing

**Alternatives Considered**:
- Inline formatting in component: Rejected due to lack of testability and reusability
- Third-party library (date-fns, dayjs): Rejected due to unnecessary dependency for simple formatting
- ISO string display: Rejected due to poor user experience

**Implementation Notes**:
- Location: `/lib/utils/format-timestamp.ts`
- Input: `Date | string | null`
- Output: `string` (e.g., "2 minutes ago", "Oct 24, 3:42 PM")
- Logic: Use `Intl.RelativeTimeFormat` for relative times, `Intl.DateTimeFormat` for absolute dates

---

### Decision 3: Layout Strategy for Single-Line Display

**Decision**: Use flexbox with `justify-between` for workflow (left) and AI-BOARD (right) positioning

**Rationale**:
- Maintains single-line layout regardless of workflow status text length
- AI-BOARD indicator consistently positioned at far right
- Responsive and handles content overflow gracefully
- No complex CSS grid or absolute positioning required

**Alternatives Considered**:
- CSS Grid: Rejected due to unnecessary complexity for 2-item layout
- Absolute positioning: Rejected due to fragility and lack of responsiveness
- Fixed width workflow container: Rejected due to inflexibility with varying status text lengths

**Implementation Notes**:
- Parent container: `flex items-center justify-between`
- Workflow job (left): Natural flow with icon + label
- AI-BOARD job (right): Compact icon only with tooltip

---

### Decision 4: Remove Stage Prefix Without Breaking Existing Tests

**Decision**: Conditionally skip rendering prefix section in `JobStatusIndicator` for workflow jobs

**Rationale**:
- Minimally invasive change to existing component
- Preserves AI-BOARD behavior (shows "AI-BOARD" prefix was intended as label, now becomes tooltip content)
- TypeScript type safety ensures no runtime errors
- Existing tests can be updated to match new behavior

**Alternatives Considered**:
- Create new component variant: Rejected due to code duplication and maintenance burden
- Boolean prop to control prefix rendering: Rejected due to API complexity (current approach cleaner)
- Remove prefix logic entirely: Rejected due to need to preserve AI-BOARD distinction

**Implementation Notes**:
- Check `jobType === JobType.WORKFLOW` → skip prefix rendering
- Check `jobType === JobType.AI_BOARD` → render compact icon-only mode
- Update tests to verify simplified output

---

## Best Practices Applied

### React Component Design
- Single Responsibility: `JobStatusIndicator` handles status display, `TicketCard` handles layout
- Composition: Tooltip wraps AI-BOARD icon, no monolithic component
- Type Safety: All props explicitly typed with TypeScript interfaces

### Accessibility (WCAG 2.1 AA)
- Tooltip keyboard navigation (Enter/Space to show, Escape to hide)
- ARIA labels for screen readers ("AI-BOARD is working on this ticket")
- Color not sole indicator (icons + text + tooltips provide multiple cues)
- Respect `prefers-reduced-motion` (no animations for AI-BOARD icons)

### Performance
- No new API calls or data fetching (purely visual)
- Memoization preserved in `TicketCard` (React.memo)
- CSS class concatenation with `cn()` utility (optimized)
- No layout thrashing (single reflow for layout change)

---

## Integration Patterns

### Existing Codebase Patterns to Follow

**Component Structure**:
- Client components use `'use client'` directive (Next.js 15 App Router)
- Props interfaces exported separately for reusability
- Functional components with hooks (no class components)

**Icon Usage**:
- Import from `lucide-react` package
- Consistent sizing: `h-4 w-4` for status icons
- Color via TailwindCSS utility classes

**Type Classification**:
- Use existing `classifyJobType()` from `lib/utils/job-type-classifier.ts`
- No changes to JobType enum or classification logic

**Styling**:
- TailwindCSS utility classes exclusively
- Catppuccin color palette (existing dark theme)
- `cn()` utility for conditional class merging

---

## Dependencies

### New Dependencies Required
- **None** - All required dependencies already in project:
  - `lucide-react`: BotMessageSquare icon
  - `shadcn/ui`: Tooltip component
  - `@/lib/utils`: cn() utility

### Dependency Verification
✅ `lucide-react` - Already installed (existing icon library)
✅ `shadcn/ui` - Already installed (UI component library)
✅ `@/components/ui/tooltip` - Check if Tooltip already installed, add if needed

---

## Risk Assessment

### Low Risk
- ✅ No API changes (frontend-only)
- ✅ No database schema changes
- ✅ No authentication/authorization changes
- ✅ Existing component modification (not new component)

### Medium Risk
- ⚠️ Visual regression: Existing job status display changes may affect user muscle memory
  - **Mitigation**: Feature provides clearer, less cluttered display (positive UX change)
- ⚠️ Test updates required: Existing tests expect stage prefix in output
  - **Mitigation**: TDD approach ensures tests updated before implementation

### No Significant Risks Identified
- Feature scope is small and isolated
- Changes are purely visual with no data/logic implications
- Rollback is trivial (revert component files)

---

## Phase 0 Completion Checklist

- [x] All technical decisions documented with rationale
- [x] Best practices identified and recorded
- [x] Integration patterns with existing codebase clarified
- [x] Dependencies verified (no new external dependencies required)
- [x] Risk assessment completed
- [x] No NEEDS CLARIFICATION items remaining from Technical Context

**Ready for Phase 1**: ✅ Proceed to data model and contracts generation
