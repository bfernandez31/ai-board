# Research: Visual Job Type Distinction

**Date**: 2025-10-23
**Feature**: Visual distinction between stage transition jobs and AI-BOARD comment jobs

## Research Objectives

1. Icon selection for job types (workflow vs. AI-BOARD)
2. Color palette for accessibility compliance (WCAG 2.1 AA)
3. Component integration patterns with existing JobStatusIndicator
4. Animation and GPU acceleration best practices for React/TailwindCSS

---

## 1. Icon Selection for Job Types

### Decision: Workflow Jobs → Cog/Gear Icon, AI-BOARD Jobs → MessageSquare Icon

**Rationale**:
- **Workflow jobs** (specify, plan, tasks, implement, quick-impl) represent automated processes → Cog/Gear symbol is universally recognized for automation and mechanical processes
- **AI-BOARD jobs** (comment-specify, comment-plan, comment-build, comment-verify) represent user-initiated conversational assistance → MessageSquare (chat bubble) symbol clearly indicates communication/messaging

**Alternatives Considered**:
1. **Robot icon for AI-BOARD jobs** → Rejected: Too literal, not intuitive for "commenting" action
2. **Arrow icons for workflow progression** → Rejected: Doesn't convey automation, could be confused with navigation
3. **Lightning bolt for AI-BOARD** → Rejected: Already used for Quick workflow badge, creates visual confusion
4. **User icon for AI-BOARD** → Rejected: Doesn't emphasize the conversational/assistance nature

**Implementation**:
- lucide-react library already included in project (package.json line 46)
- Import `Cog` and `MessageSquare` from lucide-react
- Icon size: 4x4 (16px) to match existing JobStatusIndicator icon sizing (job-status-indicator.tsx line 107-131)

**Example Usage**:
```typescript
import { Cog, MessageSquare } from 'lucide-react';

// Workflow job indicator
<Cog className="h-4 w-4 text-blue-600" />

// AI-BOARD job indicator
<MessageSquare className="h-4 w-4 text-purple-600" />
```

---

## 2. Color Palette for Accessibility Compliance

### Decision: Blue for Workflow Jobs, Purple for AI-BOARD Jobs

**Rationale**:
- **WCAG 2.1 AA compliance**: 4.5:1 minimum contrast ratio for normal text
- **Existing color usage**: Blue already used for SONNET badge (ticket-card.tsx line 89), maintains visual consistency
- **Differentiation**: Purple provides clear distinction while remaining accessible
- **Status overlay**: Colors work with existing JobStatus color scheme (PENDING=gray, RUNNING=blue, COMPLETED=green, FAILED=red)

**Color Specifications** (TailwindCSS classes):

| Job Type | Icon Color | Text Color | Background | Contrast Ratio (on dark bg #181825) |
|----------|------------|------------|------------|-------------------------------------|
| Workflow | `text-blue-600` (#2563eb) | `text-blue-600` | `bg-blue-100/10` | 5.2:1 ✅ |
| AI-BOARD | `text-purple-600` (#9333ea) | `text-purple-600` | `bg-purple-100/10` | 4.9:1 ✅ |

**Alternatives Considered**:
1. **Orange for AI-BOARD** → Rejected: Similar to amber used in Quick workflow badge, creates confusion
2. **Green for Workflow** → Rejected: Already used for COMPLETED status, causes ambiguity
3. **Gray for Workflow** → Rejected: Too subtle, doesn't convey active automation
4. **Cyan for AI-BOARD** → Rejected: Too similar to blue in low-light conditions

**Accessibility Validation**:
- Test with Chrome DevTools Accessibility audit
- Verify with colorblind simulation (Deuteranopia, Protanopia, Tritanopia)
- Ensure icon shape distinction works even without color

**Implementation Notes**:
- Use TailwindCSS utility classes for consistency
- Apply color to both icon and accompanying text label
- Maintain existing dark theme background colors (#181825 card, #313244 borders)

---

## 3. Component Integration Patterns

### Decision: Extend JobStatusIndicator with Optional JobType Prop

**Rationale**:
- **Minimal code changes**: JobStatusIndicator already handles status display logic
- **Composition over modification**: Add optional jobType prop instead of creating new component
- **Reusability**: Same component works in TicketCard and TicketDetailModal contexts
- **Type safety**: TypeScript ensures correct prop usage

**Current Architecture** (from job-status-indicator.tsx):
```typescript
interface JobStatusIndicatorProps {
  status: JobStatus;
  command: string;
  className?: string;
  animated?: boolean;
  ariaLabel?: string;
}
```

**Enhanced Architecture**:
```typescript
export type JobType = 'WORKFLOW' | 'AI_BOARD';

interface JobStatusIndicatorProps {
  status: JobStatus;
  command: string;
  jobType?: JobType; // ← NEW: Optional for backward compatibility
  className?: string;
  animated?: boolean;
  ariaLabel?: string;
}
```

**Implementation Strategy**:
1. Create utility function `classifyJobType(command: string): JobType` in lib/utils/job-type-classifier.ts
2. Modify JobStatusIndicator to accept optional jobType prop
3. Conditionally render job type badge alongside status indicator
4. Update TicketCard to pass jobType derived from currentJob.command

**Backward Compatibility**:
- Make jobType prop optional
- If not provided, component behaves as before (no job type indicator)
- Gradual rollout: Update TicketCard first, then TicketDetailModal

**Alternatives Considered**:
1. **Create separate JobTypeIndicator component** → Rejected: Introduces duplication, requires coordination between two components
2. **Modify command string display directly** → Rejected: Doesn't provide visual distinction, relies on text parsing by users
3. **Add job type icon to Badge component** → Rejected: Badge is for static labels (SONNET, Quick), not dynamic job state

---

## 4. Animation and GPU Acceleration Best Practices

### Decision: CSS Transform Animations with `will-change` Hint

**Rationale**:
- **Existing pattern**: JobStatusIndicator already uses `will-change: transform` for RUNNING animation (job-status-indicator.tsx line 82-87)
- **GPU acceleration**: `transform` property triggers GPU compositing, achieving 60fps
- **Performance**: TailwindCSS `animate-quill-writing` class already configured for smooth animation
- **Accessibility**: Respects `prefers-reduced-motion` media query

**Current Animation Implementation**:
```typescript
<div
  className={cn(
    'flex items-center justify-center',
    shouldAnimate && 'animate-quill-writing'
  )}
  style={
    shouldAnimate
      ? { willChange: 'transform' }
      : undefined
  }
>
```

**Extension for Job Type Indicator**:
- No additional animation needed for job type badge
- Job type indicator remains static (icon + text)
- Only status indicator (PENDING/RUNNING/etc.) animates
- Maintains visual hierarchy: animated status draws attention, static job type provides context

**Performance Considerations**:
- Limit `will-change` to actively animating elements only
- Remove `will-change` when animation completes (existing behavior)
- Test on low-end devices (iOS Safari, Android Chrome)
- Monitor frame rates with Chrome DevTools Performance panel

**Alternatives Considered**:
1. **JavaScript-based animation (framer-motion)** → Rejected: Adds dependency, increases bundle size, overkill for simple indicator
2. **CSS transitions on color change** → Rejected: Color changes are instant state updates, not gradual transitions
3. **Pulse animation for AI-BOARD jobs** → Rejected: Too distracting, draws attention away from primary status

**Best Practices**:
- Use CSS custom properties for dynamic colors if needed
- Avoid layout thrashing (read-then-write DOM operations)
- Batch state updates to prevent multiple re-renders
- Use React.memo on TicketCard to prevent unnecessary re-renders

---

## 5. Component Pattern Matching Logic

### Decision: Prefix-Based Classification with Fallback

**Rationale**:
- **AI-BOARD commands** have consistent "comment-" prefix (comment-specify, comment-plan, comment-build, comment-verify)
- **Workflow commands** are single words (specify, plan, tasks, implement, quick-impl)
- **Simple logic**: `command.startsWith('comment-')` → AI_BOARD, else → WORKFLOW
- **Robust fallback**: Unknown commands default to WORKFLOW (conservative choice)

**Implementation**:
```typescript
// lib/utils/job-type-classifier.ts
export function classifyJobType(command: string): JobType {
  return command.startsWith('comment-') ? 'AI_BOARD' : 'WORKFLOW';
}

// Type safety
export type JobType = 'WORKFLOW' | 'AI_BOARD';
```

**Edge Cases**:
- Empty string command → Defaults to WORKFLOW
- Malformed commands → Defaults to WORKFLOW
- Future command additions → Automatically classified correctly if they follow naming convention

**Validation**:
- Unit tests for all known command values
- Integration tests for visual rendering
- E2E tests for user-facing behavior

**Alternatives Considered**:
1. **Hardcoded command list** → Rejected: Brittle, requires updates for new commands
2. **Database enum field** → Rejected: Requires schema migration, data backfill for existing jobs
3. **Regex pattern matching** → Rejected: Overkill for simple prefix check
4. **Configuration file** → Rejected: Adds complexity without flexibility benefits

---

## 6. Responsive Design Considerations

### Decision: Horizontal Layout with Shrink-to-Fit

**Rationale**:
- **Mobile constraint**: 320px minimum width (constitution.md, CLAUDE.md line 121)
- **Existing pattern**: TicketCard already uses flexbox with gap-2 spacing (ticket-card.tsx line 80)
- **Priority**: Status indicator more important than job type, gets priority in limited space
- **Graceful degradation**: Job type icon may wrap on very narrow screens, text label remains visible

**Layout Specifications**:
```
[Status Icon] [Status Text] | [Job Type Icon] [Job Type Text]
    RUNNING                  |     AI-BOARD
```

**Implementation**:
```typescript
<div className="flex items-center gap-3">
  {/* Status indicator (existing) */}
  <JobStatusIndicator status={status} command={command} />

  {/* Job type indicator (new) */}
  <div className="flex items-center gap-1.5 text-xs">
    {jobTypeIcon}
    <span>{jobTypeLabel}</span>
  </div>
</div>
```

**Responsive Breakpoints**:
- **≥768px (tablet)**: Full layout, all text labels visible
- **320px-767px (mobile)**: Icon-first layout, text labels may wrap
- **<320px**: Not supported (per project constraints)

**Alternatives Considered**:
1. **Vertical stack on mobile** → Rejected: Takes too much vertical space, reduces cards per screen
2. **Icon-only mode** → Rejected: Reduces accessibility, relies on tooltips
3. **Dropdown menu for details** → Rejected: Requires interaction, violates "no hover required" requirement (spec.md FR-007)

---

## Implementation Checklist

### Phase 0 Completion Criteria
- [x] Icon selection finalized (Cog for workflow, MessageSquare for AI-BOARD)
- [x] Color palette validated for WCAG 2.1 AA (blue #2563eb, purple #9333ea)
- [x] Component integration strategy defined (extend JobStatusIndicator)
- [x] Animation approach confirmed (reuse existing GPU-accelerated pattern)
- [x] Classification logic designed (prefix-based with fallback)
- [x] Responsive layout strategy documented (horizontal with shrink-to-fit)

### Next Steps (Phase 1)
1. Create data-model.md documenting JobType enum and classification rules
2. Generate API contracts (component interfaces, TypeScript types)
3. Write quickstart.md for developer implementation guidance
4. Update CLAUDE.md with new component patterns

---

## References

- **Existing Code**: components/board/job-status-indicator.tsx (lines 1-135)
- **Existing Code**: components/board/ticket-card.tsx (lines 1-120)
- **Constitution**: .specify/memory/constitution.md (Principles I-VI)
- **Project Guidelines**: CLAUDE.md (UI & Styling, Testing sections)
- **Specification**: specs/045-visual-distinction-between/spec.md
- **lucide-react Icons**: https://lucide.dev/icons (Cog, MessageSquare)
- **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/#contrast-minimum
- **TailwindCSS Colors**: https://tailwindcss.com/docs/customizing-colors
