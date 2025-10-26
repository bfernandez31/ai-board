# API Contracts: Living Workflow Section

**Feature**: Mini-Kanban animated demo for landing page
**Date**: 2025-10-26
**Status**: N/A - No API contracts needed

## Overview

This feature is a **pure frontend presentation component** with no API endpoints, database operations, or external service integrations. All data is hardcoded within the React component.

## No API Contracts Required

### Why No Contracts?
1. **No Server Communication**: Component does not fetch data from APIs or webhooks
2. **No Database Operations**: No CREATE, READ, UPDATE, or DELETE operations
3. **No External Services**: No third-party API integrations (GitHub, Anthropic, etc.)
4. **Static Demo**: All ticket data and workflow stages are hardcoded constants

### What This Feature DOES Have
- **TypeScript Interfaces**: See `data-model.md` for component props and state types
- **Zod Schemas**: Runtime validation for type safety (not API validation)
- **CSS Classes**: Styling contracts defined in Tailwind classes
- **Component APIs**: React component props (see data-model.md for interfaces)

## Component Public API

While there are no HTTP/REST APIs, the MiniKanbanDemo component has a **component API** (props interface):

```typescript
// Component API (not HTTP API)
interface MiniKanbanDemoProps {
  className?: string;
  animationInterval?: number; // Default: 10000ms
  transitionDuration?: number; // Default: 1000ms
  autoStart?: boolean; // Default: true
}

// Usage in landing page
<MiniKanbanDemo
  className="my-8"
  animationInterval={10000}
  transitionDuration={1000}
  autoStart={true}
/>
```

## Future Considerations

If this feature were to evolve to include server functionality, the following contracts would be needed:

### Hypothetical: Save Demo State Endpoint (NOT IMPLEMENTED)
```yaml
# EXAMPLE ONLY - NOT IMPLEMENTED IN THIS FEATURE
POST /api/demo/save-state
Content-Type: application/json

Request:
{
  "tickets": [
    { "id": 1, "title": "Add user authentication", "column": 2 }
  ],
  "timestamp": "2025-10-26T12:00:00Z"
}

Response (200 OK):
{
  "saved": true,
  "stateId": "abc123"
}

Response (400 Bad Request):
{
  "error": "Invalid ticket data",
  "code": "VALIDATION_ERROR"
}
```

### Hypothetical: Fetch Demo Configuration (NOT IMPLEMENTED)
```yaml
# EXAMPLE ONLY - NOT IMPLEMENTED IN THIS FEATURE
GET /api/demo/config

Response (200 OK):
{
  "animationInterval": 10000,
  "transitionDuration": 1000,
  "ticketExamples": [
    { "id": 1, "title": "Add user authentication", "column": 1 }
  ]
}
```

**Note**: These are hypothetical examples only. The current implementation has no server-side contracts.

## Browser APIs Used

While there are no HTTP APIs, the component uses **browser Web APIs**:

### Intersection Observer API
```typescript
// Browser API contract
const observer = new IntersectionObserver(
  (entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    setIsVisible(entry.isIntersecting);
  },
  {
    root: null, // viewport
    rootMargin: '0px',
    threshold: 0.1, // 10% visibility triggers
  }
);

observer.observe(elementRef.current);
```

**Browser Support**: Chrome 51+, Firefox 55+, Safari 12.1+, Edge 15+

### Media Query API (prefers-reduced-motion)
```typescript
// Browser API contract
const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

mediaQuery.addEventListener('change', (event: MediaQueryListEvent) => {
  setPrefersReducedMotion(event.matches);
});
```

**Browser Support**: All modern browsers (Chrome 74+, Firefox 63+, Safari 10.1+)

### setInterval / clearInterval
```typescript
// Browser API contract
const timerId: number = window.setInterval(
  () => progressTickets(),
  10000 // 10 seconds
);

window.clearInterval(timerId);
```

**Browser Support**: Universal (ES3+)

## Testing Contracts

### Vitest Unit Test Expectations
```typescript
// Pure function contract
function calculateNextColumn(current: ColumnIndex): ColumnIndex;

// Expected behavior
expect(calculateNextColumn(0)).toBe(1); // INBOX → SPECIFY
expect(calculateNextColumn(5)).toBe(0); // SHIP → INBOX (wrap)
```

### Playwright E2E Test Expectations
```typescript
// Visual behavior contract
test('ticket moves after 10 seconds', async ({ page }) => {
  await page.goto('/');
  const ticket = page.locator('[data-ticket-id="1"]');

  const initialColumn = await ticket.getAttribute('data-column');
  await page.waitForTimeout(10500);
  const newColumn = await ticket.getAttribute('data-column');

  expect(Number(newColumn)).toBe(Number(initialColumn) + 1);
});
```

## CSS Animation Contract

The component relies on CSS animations with specific timing and easing:

```css
/* Animation contract */
.ticket {
  transition: transform 1000ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

/* Reduced motion contract */
@media (prefers-reduced-motion: reduce) {
  .ticket {
    transition: opacity 300ms ease;
    transform: none;
  }
}
```

**Contract Guarantees**:
- Transition duration: 1000ms (must match `transitionDuration` prop)
- Easing function: Material Design "standard" curve
- Reduced motion: Fade transitions instead of position changes
- GPU acceleration: `transform` and `opacity` properties only

## Accessibility Contract

The component adheres to the following accessibility contract:

### ARIA Attributes (NOT used - intentional)
- **No `role="button"`**: Tickets are not interactive (visual demo only)
- **No `tabIndex`**: No keyboard navigation needed (not a functional Kanban)
- **No `aria-live`**: Automatic updates not announced to screen readers (marketing demo)

**Rationale**: This is a visual demonstration for sighted users. Making it keyboard-accessible or screen-reader-friendly would be misleading, as it suggests interactive functionality that doesn't exist.

### Reduced Motion Contract (REQUIRED)
```typescript
// Contract: Respect user preferences
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Disable position animations
  // Use fade transitions only (300ms opacity)
  // Maintain workflow progression (position changes still occur)
}
```

**Required Behavior**:
- `prefers-reduced-motion: no-preference` → Full animations
- `prefers-reduced-motion: reduce` → Fade-only transitions

## Performance Contract

### Success Criteria (from spec.md)
- **SC-002**: 60fps animation smoothness on 2018+ devices
- **SC-003**: Hover pause/resume within 100ms (perceived as instant)
- **SC-007**: Complete ticket journey within 60 seconds

### Performance Budget
| Metric | Target | Contract |
|--------|--------|----------|
| **First Load JS** | +0KB | No external libraries (CSS animations only) |
| **Animation FPS** | 60fps | GPU-accelerated `transform` and `opacity` |
| **Hover Response** | <100ms | CSS `:hover` pseudo-class (instant) |
| **Reflow/Repaint** | 0 | No layout changes during animation |

## Summary

**This feature has ZERO API contracts** because it's a pure presentation component with no server communication. The only contracts are:

1. **Component Props API**: TypeScript interface for MiniKanbanDemo (see data-model.md)
2. **Browser APIs**: Intersection Observer, Media Query, setInterval
3. **CSS Animation Contract**: Timing, easing, reduced-motion behavior
4. **Accessibility Contract**: Respect prefers-reduced-motion preference
5. **Performance Contract**: 60fps, <100ms interactions, 0KB bundle overhead

For implementation details, see:
- **data-model.md**: TypeScript interfaces and state management
- **research.md**: Technology decisions and animation strategy
- **quickstart.md**: Development setup and testing instructions
