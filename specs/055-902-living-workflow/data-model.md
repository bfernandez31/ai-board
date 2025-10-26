# Data Model: Living Workflow Section

**Feature**: Mini-Kanban animated demo for landing page
**Date**: 2025-10-26
**Type**: Frontend-only (no database entities)

## Overview

This feature is a **pure presentation component** with no database persistence. All data is hardcoded in the component and managed in React local state. The data model defines TypeScript interfaces for type safety and developer experience.

## Entity Definitions

### DemoTicket

Represents an example work item in the animated demo.

**TypeScript Interface**:
```typescript
interface DemoTicket {
  id: number;
  title: string;
  column: number; // 0-5 (INBOX to SHIP)
}
```

**Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `id` | number | Yes | Positive integer | Unique identifier for ticket (1, 2, 3) |
| `title` | string | Yes | Length 1-50 chars | Display title (e.g., "Add user authentication") |
| `column` | number | Yes | 0-5 (enum) | Current column position (0=INBOX, 5=SHIP) |

**Behavior**:
- Progresses from column to column every 10 seconds
- Cycles back to INBOX (column 0) after reaching SHIP (column 5)
- Responds to hover state (visual highlight only)
- No drag-and-drop functionality (visual affordance only)

**Validation Rules** (Zod schema for type safety):
```typescript
import { z } from 'zod';

const DemoTicketSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(50),
  column: z.number().int().min(0).max(5),
});

type DemoTicket = z.infer<typeof DemoTicketSchema>;
```

**Hardcoded Data** (static, no API):
```typescript
const DEMO_TICKETS: DemoTicket[] = [
  { id: 1, title: 'Add user authentication', column: 1 }, // SPECIFY
  { id: 2, title: 'Fix mobile layout bug', column: 3 },   // BUILD
  { id: 3, title: 'Implement dark mode', column: 0 },     // INBOX
] as const;
```

### WorkflowStage

Represents one of the 6 workflow columns in the mini-Kanban.

**TypeScript Interface**:
```typescript
interface WorkflowStage {
  index: number;
  name: string;
  label: string;
  color: string; // Tailwind CSS color class
}
```

**Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `index` | number | Yes | 0-5 | Column position (0=INBOX, 5=SHIP) |
| `name` | string | Yes | Enum: 'INBOX' \| 'SPECIFY' \| ... | Internal stage identifier |
| `label` | string | Yes | Length 1-20 chars | Display label for column header |
| `color` | string | Yes | Valid Tailwind class | Background color for column (e.g., 'bg-gray-50') |

**Hardcoded Data** (static configuration):
```typescript
const WORKFLOW_STAGES: WorkflowStage[] = [
  { index: 0, name: 'INBOX', label: 'Inbox', color: 'bg-gray-50' },
  { index: 1, name: 'SPECIFY', label: 'Specify', color: 'bg-blue-50' },
  { index: 2, name: 'PLAN', label: 'Plan', color: 'bg-purple-50' },
  { index: 3, name: 'BUILD', label: 'Build', color: 'bg-green-50' },
  { index: 4, name: 'VERIFY', label: 'Verify', color: 'bg-yellow-50' },
  { index: 5, name: 'SHIP', label: 'Ship', color: 'bg-pink-50' },
] as const;
```

### AnimationState

Manages the state of the animation system.

**TypeScript Interface**:
```typescript
interface AnimationState {
  tickets: DemoTicket[];
  isPaused: boolean;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}
```

**Fields**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tickets` | DemoTicket[] | Yes | DEMO_TICKETS | Current state of all demo tickets |
| `isPaused` | boolean | Yes | false | True when user hovers over board |
| `isVisible` | boolean | Yes | true | True when section is in viewport (Intersection Observer) |
| `prefersReducedMotion` | boolean | Yes | false | True when user has prefers-reduced-motion: reduce |

**State Transitions**:
```typescript
// Ticket progression (every 10 seconds if not paused and visible)
const progressTickets = (tickets: DemoTicket[]): DemoTicket[] =>
  tickets.map(ticket => ({
    ...ticket,
    column: ticket.column < 5 ? ticket.column + 1 : 0,
  }));

// Pause state (on hover enter/leave)
const togglePause = (isPaused: boolean): boolean => !isPaused;

// Visibility state (Intersection Observer callback)
const updateVisibility = (isIntersecting: boolean): boolean => isIntersecting;
```

**Guards** (when to animate):
```typescript
const shouldAnimate = (state: AnimationState): boolean =>
  !state.isPaused &&
  state.isVisible &&
  !state.prefersReducedMotion;
```

### TicketTransition

Represents the visual transition of a ticket between columns (used for animation orchestration).

**TypeScript Interface**:
```typescript
interface TicketTransition {
  ticketId: number;
  fromColumn: number;
  toColumn: number;
  startTime: number; // timestamp
  duration: number; // milliseconds
  easing: string; // CSS easing function
}
```

**Fields**:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `ticketId` | number | Yes | - | ID of ticket being animated |
| `fromColumn` | number | Yes | - | Starting column (0-5) |
| `toColumn` | number | Yes | - | Destination column (0-5) |
| `startTime` | number | Yes | Date.now() | Timestamp when animation started |
| `duration` | number | Yes | 1000 | Animation duration in milliseconds |
| `easing` | string | Yes | 'cubic-bezier(0.4, 0, 0.2, 1)' | CSS easing function |

**Usage**:
- Tracked in React state during active transitions
- Used to calculate intermediate positions for smooth animations
- Cleared after transition completes (1s)

**Example**:
```typescript
const transition: TicketTransition = {
  ticketId: 1,
  fromColumn: 2, // PLAN
  toColumn: 3,   // BUILD
  startTime: Date.now(),
  duration: 1000,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};
```

## Type Definitions (Enums)

### WorkflowStageName

Enum for the 6 workflow stages.

```typescript
enum WorkflowStageName {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}

// Type-safe column index type
type ColumnIndex = 0 | 1 | 2 | 3 | 4 | 5;
```

### AnimationStatus

Enum for animation system status.

```typescript
enum AnimationStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  REDUCED_MOTION = 'REDUCED_MOTION',
}
```

## Component Props Interfaces

### MiniKanbanDemo Props

Main component for the animated mini-Kanban demo.

```typescript
interface MiniKanbanDemoProps {
  className?: string;
  animationInterval?: number; // Default: 10000ms
  transitionDuration?: number; // Default: 1000ms
  autoStart?: boolean; // Default: true
}
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `className` | string | No | '' | Additional CSS classes for styling |
| `animationInterval` | number | No | 10000 | Time between ticket progressions (ms) |
| `transitionDuration` | number | No | 1000 | Duration of column-to-column animation (ms) |
| `autoStart` | boolean | No | true | Whether to start animation immediately |

### DemoTicketCard Props

Individual ticket card component.

```typescript
interface DemoTicketCardProps {
  ticket: DemoTicket;
  isAnimating: boolean;
  isHovered: boolean;
  onHoverChange: (isHovered: boolean) => void;
}
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `ticket` | DemoTicket | Yes | Ticket data to display |
| `isAnimating` | boolean | Yes | True during column transition |
| `isHovered` | boolean | Yes | True when mouse over ticket |
| `onHoverChange` | (boolean) => void | Yes | Callback when hover state changes |

### WorkflowColumnCard Props

Column component for one of the 6 stages.

```typescript
interface WorkflowColumnCardProps {
  stage: WorkflowStage;
  tickets: DemoTicket[];
  isHovered: boolean;
}
```

**Props**:
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `stage` | WorkflowStage | Yes | Column configuration (name, color, etc.) |
| `tickets` | DemoTicket[] | Yes | Tickets currently in this column |
| `isHovered` | boolean | Yes | True when mouse over column |

## Helper Functions (Pure Utility Functions)

### calculateNextColumn

Determines the next column for a ticket (with wraparound).

```typescript
/**
 * Calculates the next column index for a ticket.
 * Wraps around to INBOX (0) after SHIP (5).
 */
function calculateNextColumn(currentColumn: ColumnIndex): ColumnIndex {
  return (currentColumn < 5 ? currentColumn + 1 : 0) as ColumnIndex;
}
```

**Unit Test** (Vitest):
```typescript
describe('calculateNextColumn', () => {
  it('increments column from 0 to 1', () => {
    expect(calculateNextColumn(0)).toBe(1);
  });

  it('increments column from 4 to 5', () => {
    expect(calculateNextColumn(4)).toBe(5);
  });

  it('wraps column from 5 to 0', () => {
    expect(calculateNextColumn(5)).toBe(0);
  });
});
```

### shouldAnimate

Determines whether animations should run based on current state.

```typescript
/**
 * Checks if animations should run based on pause state,
 * visibility, and user accessibility preferences.
 */
function shouldAnimate(
  isPaused: boolean,
  isVisible: boolean,
  prefersReducedMotion: boolean
): boolean {
  return !isPaused && isVisible && !prefersReducedMotion;
}
```

**Unit Test** (Vitest):
```typescript
describe('shouldAnimate', () => {
  it('returns true when not paused, visible, and no reduced motion', () => {
    expect(shouldAnimate(false, true, false)).toBe(true);
  });

  it('returns false when paused', () => {
    expect(shouldAnimate(true, true, false)).toBe(false);
  });

  it('returns false when not visible', () => {
    expect(shouldAnimate(false, false, false)).toBe(false);
  });

  it('returns false when reduced motion enabled', () => {
    expect(shouldAnimate(false, true, true)).toBe(false);
  });
});
```

### getColumnName

Maps column index to human-readable stage name.

```typescript
/**
 * Maps column index (0-5) to workflow stage name.
 */
function getColumnName(index: ColumnIndex): WorkflowStageName {
  const stages: WorkflowStageName[] = [
    WorkflowStageName.INBOX,
    WorkflowStageName.SPECIFY,
    WorkflowStageName.PLAN,
    WorkflowStageName.BUILD,
    WorkflowStageName.VERIFY,
    WorkflowStageName.SHIP,
  ];
  return stages[index];
}
```

**Unit Test** (Vitest):
```typescript
describe('getColumnName', () => {
  it('maps 0 to INBOX', () => {
    expect(getColumnName(0)).toBe(WorkflowStageName.INBOX);
  });

  it('maps 5 to SHIP', () => {
    expect(getColumnName(5)).toBe(WorkflowStageName.SHIP);
  });
});
```

## Custom Hooks

### useAnimationState

Custom hook for managing animation state machine.

```typescript
interface UseAnimationStateReturn {
  tickets: DemoTicket[];
  isPaused: boolean;
  isVisible: boolean;
  prefersReducedMotion: boolean;
  togglePause: () => void;
  setVisible: (visible: boolean) => void;
}

function useAnimationState(
  initialTickets: DemoTicket[],
  interval: number = 10000
): UseAnimationStateReturn {
  const [tickets, setTickets] = useState(initialTickets);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!shouldAnimate(isPaused, isVisible, prefersReducedMotion)) {
      return;
    }

    const timer = setInterval(() => {
      setTickets(prev => prev.map(ticket => ({
        ...ticket,
        column: calculateNextColumn(ticket.column as ColumnIndex),
      })));
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, isVisible, prefersReducedMotion, interval]);

  return {
    tickets,
    isPaused,
    isVisible,
    prefersReducedMotion,
    togglePause: () => setIsPaused(prev => !prev),
    setVisible: (visible) => setIsVisible(visible),
  };
}
```

### useReducedMotion

Custom hook to detect prefers-reduced-motion preference.

```typescript
function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}
```

**Unit Test** (Vitest with jsdom):
```typescript
describe('useReducedMotion', () => {
  it('returns false when prefers-reduced-motion is not set', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is set', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
```

### useIntersectionObserver

Custom hook to detect when section is in viewport.

```typescript
function useIntersectionObserver(
  ref: RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}
```

## Validation

### Runtime Validation (Zod Schemas)

```typescript
import { z } from 'zod';

// DemoTicket validation
export const DemoTicketSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(50),
  column: z.number().int().min(0).max(5),
});

// WorkflowStage validation
export const WorkflowStageSchema = z.object({
  index: z.number().int().min(0).max(5),
  name: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
  label: z.string().min(1).max(20),
  color: z.string().regex(/^bg-\w+-\d+$/), // Tailwind color class format
});

// AnimationState validation
export const AnimationStateSchema = z.object({
  tickets: z.array(DemoTicketSchema),
  isPaused: z.boolean(),
  isVisible: z.boolean(),
  prefersReducedMotion: z.boolean(),
});
```

### Type Safety

All interfaces are TypeScript strict mode compatible:
- No `any` types
- All optional fields explicitly marked with `?`
- Readonly arrays use `as const` assertion
- Enums used for fixed value sets

## State Management

### State Location
All state is **local to the MiniKanbanDemo component** using React `useState` and `useEffect`.

### State Flow
```
Component Mount
  ↓
Initialize tickets (DEMO_TICKETS)
  ↓
Start animation timer (10s interval)
  ↓
User hovers → Pause animation
  ↓
User leaves → Resume animation
  ↓
Timer fires → Progress tickets
  ↓
Re-render with new positions
  ↓
CSS transitions handle visual movement
```

### No Global State
- No Context API needed (self-contained component)
- No Redux/Zustand (constitution prohibits for client state)
- No server state (no API calls or data fetching)

## Relationships

### DemoTicket ↔ WorkflowStage
- **Relationship**: Many-to-One (many tickets in one column at a time)
- **Key**: `ticket.column` (foreign key to `stage.index`)
- **Navigation**: `WORKFLOW_STAGES[ticket.column]` → WorkflowStage

### AnimationState → DemoTicket[]
- **Relationship**: One-to-Many (state contains array of tickets)
- **Ownership**: AnimationState owns ticket positions
- **Updates**: Immutable updates via `setTickets(prev => ...)`

## Data Flow Diagram

```
┌─────────────────────────────────────────┐
│ MiniKanbanDemo Component                │
│                                         │
│  State:                                 │
│  ├─ tickets: DemoTicket[]               │
│  ├─ isPaused: boolean                   │
│  ├─ isVisible: boolean                  │
│  └─ prefersReducedMotion: boolean       │
│                                         │
│  Effects:                               │
│  ├─ useEffect (animation timer)         │
│  ├─ useEffect (intersection observer)   │
│  └─ useEffect (media query listener)    │
└─────────────────────────────────────────┘
         │
         ├─ Render ──────────────────────┐
         │                               │
         ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│ WorkflowColumnCard   │      │ DemoTicketCard       │
│                      │      │                      │
│ Props:               │      │ Props:               │
│ ├─ stage             │      │ ├─ ticket            │
│ ├─ tickets           │      │ ├─ isAnimating       │
│ └─ isHovered         │      │ └─ onHoverChange     │
└──────────────────────┘      └──────────────────────┘
         │                               │
         └───────── CSS Transitions ─────┘
                    (GPU-accelerated)
```

## Testing Data Model

### Test Fixtures

```typescript
// tests/fixtures/demo-tickets.ts
export const TEST_TICKETS: DemoTicket[] = [
  { id: 1, title: '[e2e] Test ticket 1', column: 0 },
  { id: 2, title: '[e2e] Test ticket 2', column: 2 },
  { id: 3, title: '[e2e] Test ticket 3', column: 4 },
];

export const TEST_STAGES: WorkflowStage[] = [
  { index: 0, name: 'INBOX', label: 'Inbox', color: 'bg-gray-50' },
  { index: 1, name: 'SPECIFY', label: 'Specify', color: 'bg-blue-50' },
  { index: 2, name: 'PLAN', label: 'Plan', color: 'bg-purple-50' },
  { index: 3, name: 'BUILD', label: 'Build', color: 'bg-green-50' },
  { index: 4, name: 'VERIFY', label: 'Verify', color: 'bg-yellow-50' },
  { index: 5, name: 'SHIP', label: 'Ship', color: 'bg-pink-50' },
];
```

### Mock Data for E2E Tests

```typescript
// Playwright test setup
test.beforeEach(async ({ page }) => {
  // No database setup needed (static demo)
  await page.goto('/');
});

test('demo tickets progress through columns', async ({ page }) => {
  const firstTicket = page.locator('[data-ticket-id="1"]');

  // Wait for 10-second interval
  await page.waitForTimeout(10500);

  // Verify ticket moved to next column
  const newColumn = await firstTicket.getAttribute('data-column');
  expect(newColumn).toBe('1'); // SPECIFY
});
```

## Summary

### Key Entities
1. **DemoTicket** - Represents example work items
2. **WorkflowStage** - Represents the 6 workflow columns
3. **AnimationState** - Manages animation system state
4. **TicketTransition** - Tracks active transitions

### No Persistence
- All data is hardcoded in the component
- No database schema changes required
- No API endpoints needed
- No Prisma migrations

### Type Safety
- All interfaces TypeScript strict mode compatible
- Zod schemas for runtime validation
- No `any` types
- Explicit optional fields

### Testing Strategy
- Vitest unit tests for pure functions (`calculateNextColumn`, `shouldAnimate`, etc.)
- Playwright E2E tests for visual behavior and interactions
- Test fixtures for consistent test data
- Mock window.matchMedia for reduced-motion tests
