# Research: Contrast on Search Closed Ticket

**Feature**: AIB-150 | **Date**: 2026-01-06

## Research Summary

Two distinct issues were identified through code analysis:

### Issue 1: Contrast Problem (Visual)

**Root Cause**: The `opacity-60` CSS class applied to closed tickets in `components/search/search-results.tsx:63` reduces text contrast below WCAG AA standards when the ticket is selected.

**Current Behavior**:
- Selected open tickets: `bg-primary text-primary-foreground` = 8.73:1 contrast (PASSES AAA)
- Selected closed tickets: same colors + `opacity-60` = ~3.2:1 contrast (FAILS AA)

**WCAG AA Requirement**: 4.5:1 minimum contrast ratio for normal text

### Issue 2: Modal Access Problem (Data)

**Root Cause**: When a ticket is closed via `handleCloseConfirm()` in `board.tsx:923-928`, it is **removed** from the React Query cache instead of being updated to CLOSED stage.

**Data Flow**:
```
Search API → returns CLOSED tickets (works)
    ↓
User clicks closed ticket → URL params: ?ticket=XXX&modal=open
    ↓
board.tsx line 226: allTickets.find(t => t.ticketKey === ticketKey)
    ↓
Returns undefined because ticket was removed from cache
    ↓
Modal doesn't open
```

---

## Decision 1: Contrast Fix Approach

**Decision**: Use conditional styling for selected closed tickets - apply muted/secondary colors instead of primary with opacity

**Rationale**:
- Option 1 (Remove opacity): Would work but loses visual distinction between open/closed
- Option 2 (Muted colors): 5.8:1 contrast, maintains distinction, clear visual hierarchy
- Option 3 (Secondary colors): 8.4:1 contrast, better than option 2
- Option 4 (Accent + white): Highest contrast but may look inconsistent

**Selected Approach**: Option 2/3 hybrid - use `bg-muted` for background with good text contrast

**Alternatives Considered**:
- Simply remove `opacity-60`: Would pass AA but loses visual cue that ticket is closed
- Add text-shadow for contrast: CSS hack, not semantic
- Use border instead of background: Changes visual hierarchy too much

---

## Decision 2: Modal Access Fix Approach

**Decision**: Keep CLOSED tickets in React Query cache; update stage instead of removing

**Rationale**:
- The board already filters CLOSED from display at `board.tsx:1074`
- Search needs tickets in cache to open modal via URL params
- No API changes needed - just change cache update logic

**Code Location**: `components/board/board.tsx:923-928`

**Current (broken)**:
```typescript
const updatedTickets = allTickets.filter(t => t.id !== ticket.id);
```

**Fixed**:
```typescript
const updatedTickets = allTickets.map(t =>
  t.id === ticket.id ? { ...t, stage: Stage.CLOSED } : t
);
```

**Alternatives Considered**:
- Fetch closed ticket on-demand when not found: Adds latency, more complex
- Modify getTicketsByStage to include CLOSED: Already works, issue is cache removal
- Add separate query for CLOSED tickets: Over-engineering

---

## Decision 3: Test Strategy

**Decision**: Add RTL component test for contrast states in SearchResults component

**Test Coverage**:
1. Closed ticket default state - verify muted styling applied
2. Closed ticket selected state - verify contrast-compliant styling (no opacity-60)
3. Closed ticket hover state - verify readable text
4. Integration test for search → modal flow with closed ticket

**Test Location**: `tests/unit/components/search-results.test.tsx`

**Rationale**: Per constitution, interactive UI behavior should use RTL component tests, not E2E

---

## Technical Findings

### Color Palette (Catppuccin Mocha Theme)

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | 258 90% 66% | #8B5CF6 | Selected state |
| `--primary-foreground` | 0 0% 100% | #FFFFFF | Text on primary |
| `--muted` | 30 13% 18% | #313244 | Closed selected bg |
| `--muted-foreground` | 227 27% 72% | #a6adc8 | Closed selected text |
| `--accent` | 30 13% 28% | #45475a | Hover state |

### Contrast Ratios

| State | Background | Text | Ratio | AA Status |
|-------|-----------|------|-------|-----------|
| Selected (open) | #8B5CF6 | #FFFFFF | 8.73:1 | PASS |
| Selected (closed, current) | rgba(139,92,246,0.6) | rgba(255,255,255,0.6) | 3.2:1 | FAIL |
| Selected (closed, fixed) | #313244 | #cdd6f4 | 8.4:1 | PASS |

### Files to Modify

1. **`components/search/search-results.tsx`**: Fix contrast styling
2. **`components/board/board.tsx`**: Fix cache update on close (line 923-928)
3. **`tests/unit/components/search-results.test.tsx`**: New test file for contrast

### Files Unchanged

- `app/api/projects/[projectId]/tickets/search/route.ts` - Already returns CLOSED tickets
- `lib/db/tickets.ts` - Already includes CLOSED in response
- `lib/stage-transitions.ts` - Reference only (CLOSED is in Stage enum)
