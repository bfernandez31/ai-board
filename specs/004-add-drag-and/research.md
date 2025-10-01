# Research: Drag-and-Drop Ticket Movement

**Date**: 2025-10-01
**Feature**: 004-add-drag-and

## 1. @dnd-kit Integration Best Practices

### Decision: Use @dnd-kit/core with @dnd-kit/sortable
**Chosen**: @dnd-kit (https://dndkit.com)

**Rationale**:
- Modern, performant drag-and-drop library built for React
- Excellent TypeScript support with full type safety
- Built-in accessibility (keyboard navigation, screen readers)
- Modular design - use only what's needed
- Touch-friendly with PointerSensor and TouchSensor
- Works seamlessly with Next.js Client Components
- Active maintenance and strong community

**Alternatives Considered**:
- **react-beautiful-dnd**: Deprecated, no longer maintained
- **react-dnd**: More complex API, lacks built-in accessibility
- **Custom implementation**: High complexity, accessibility challenges

### Setup Pattern for Next.js 15
```typescript
'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

// Enable both mouse and touch interactions
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Prevent accidental drags
    },
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  })
);
```

### Touch Sensor Configuration
- **PointerSensor**: Handles mouse and touch events uniformly
- **TouchSensor**: Dedicated mobile touch support
- **activationConstraint**: Prevents accidental activation
  - `distance`: Minimum drag distance (8px)
  - `delay`: Long-press duration (250ms)
  - `tolerance`: Movement tolerance during delay (5px)

### Accessibility Requirements
- @dnd-kit provides built-in keyboard navigation
- Use `DndContext` with `announcements` prop for screen readers
- Ensure focus management during drag operations
- Add ARIA labels to draggable items and drop zones
- Provide visual feedback for keyboard users (focus rings)

### Performance Optimization for 100+ Items
1. **Collision Detection**: Use `closestCenter` for better performance than `rectIntersection`
2. **Virtualization**: Not needed for 100 items (threshold ~500+)
3. **React.memo**: Memoize TicketCard components to prevent unnecessary re-renders
4. **useMemo/useCallback**: Cache sensor configuration and event handlers
5. **Optimistic Updates**: Update UI immediately without waiting for server

## 2. Optimistic UI Patterns

### Decision: Optimistic Updates with Rollback on Conflict

**Pattern**:
```typescript
// 1. Immediately update local state
setTickets(prev => updateTicketStage(prev, ticketId, newStage));

// 2. Send request to server
const result = await fetch(`/api/tickets/${ticketId}`, {
  method: 'PATCH',
  body: JSON.stringify({ stage: newStage, version: currentVersion }),
});

// 3. On error, rollback
if (!result.ok) {
  setTickets(prev => revertTicketStage(prev, ticketId, originalStage));
  showError(await result.json());
}
```

**Rationale**:
- Meets <100ms latency requirement (no server wait)
- Provides instant visual feedback
- Maintains data consistency via rollback
- Clear error communication to users

**Alternatives Considered**:
- **Server-first (no optimism)**: Too slow, fails <100ms requirement
- **Optimistic without rollback**: Data consistency issues
- **Local-first with sync queue**: Unnecessary complexity for online-only requirement

### First-Write-Wins Conflict Detection

**Strategy**: Optimistic Concurrency Control (OCC) with version field

```typescript
// Database schema
model Ticket {
  id      Int      @id
  stage   Stage
  version Int      @default(1)  // Incremented on each update
  // ...
}

// Update logic
const ticket = await prisma.ticket.findUnique({ where: { id } });

if (ticket.version !== requestVersion) {
  // Conflict detected - another user updated first
  return res.status(409).json({
    error: "Ticket modified by another user",
    currentStage: ticket.stage,
    currentVersion: ticket.version,
  });
}

// Proceed with update (atomic)
const updated = await prisma.ticket.update({
  where: { id, version: requestVersion },
  data: { stage: newStage, version: { increment: 1 } },
});
```

**Rationale**:
- Version field provides lightweight concurrency control
- Atomic compare-and-swap in database
- Clear 409 Conflict response for client handling
- No database locks required (better performance)

**Alternatives Considered**:
- **Timestamp-based**: Race conditions with clock skew
- **Last-write-wins**: Violates spec requirement
- **Pessimistic locking**: Poor performance under high concurrency

### Network Status Detection

**Strategy**: Navigator.onLine API with periodic connectivity checks

```typescript
'use client';

import { useEffect, useState } from 'react';

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initial status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

**Rationale**:
- Native browser API, no dependencies
- Real-time updates on connectivity changes
- Works across all modern browsers
- Immediate UI feedback

**Alternatives Considered**:
- **Periodic ping**: Extra network requests, slower detection
- **Request failure detection**: Too late (after user action)

## 3. Sequential Stage Validation

### Decision: Dual Validation (Client + Server)

**Client-Side Validation** (lib/stage-validation.ts):
```typescript
export enum Stage {
  INBOX = 'INBOX',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}

const STAGE_ORDER: Stage[] = [
  Stage.INBOX,
  Stage.PLAN,
  Stage.BUILD,
  Stage.VERIFY,
  Stage.SHIP,
];

export function getNextStage(currentStage: Stage): Stage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[currentIndex + 1];
}

export function isValidTransition(
  fromStage: Stage,
  toStage: Stage
): boolean {
  const nextStage = getNextStage(fromStage);
  return nextStage === toStage;
}
```

**Server-Side Validation** (API route):
```typescript
import { z } from 'zod';
import { Stage, isValidTransition } from '@/lib/stage-validation';

const UpdateStageSchema = z.object({
  stage: z.nativeEnum(Stage),
  version: z.number().int().positive(),
});

export async function PATCH(req: Request) {
  const body = await req.json();
  const { stage: newStage, version } = UpdateStageSchema.parse(body);

  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!isValidTransition(ticket.stage, newStage)) {
    return NextResponse.json(
      { error: 'Invalid stage transition', message: `Cannot transition from ${ticket.stage} to ${newStage}` },
      { status: 400 }
    );
  }

  // ... proceed with update
}
```

**Rationale**:
- **Client validation**: Immediate feedback, better UX (disable invalid drop zones)
- **Server validation**: Security, data integrity (never trust client)
- **Shared logic**: Single source of truth in lib/stage-validation.ts
- **Type safety**: Zod schema validation catches malformed requests

**Alternatives Considered**:
- **Client-only**: Security risk, easy to bypass
- **Server-only**: Poor UX, slow feedback
- **Database constraints**: Limited to enum validation, not sequential logic

### Database-Level Constraint Enforcement

**Strategy**: Enum constraint + application-level validation

```prisma
enum Stage {
  INBOX
  PLAN
  BUILD
  VERIFY
  SHIP
}

model Ticket {
  stage Stage @default(INBOX)
}
```

**Rationale**:
- Enum ensures only valid stage values
- PostgreSQL constraint prevents invalid data
- Application logic enforces sequential transitions
- Defense in depth: multiple validation layers

## 4. Performance Optimization

### Sub-100ms Latency Techniques

**1. Optimistic UI Updates**
- Update local state immediately (0ms)
- API call happens asynchronously
- User sees instant response

**2. Minimal Re-renders**
```typescript
const TicketCard = React.memo(({ ticket }: { ticket: Ticket }) => {
  // Only re-renders when ticket changes
});

const handleDragEnd = useCallback((event) => {
  // Memoized handler prevents re-renders
}, [dependencies]);
```

**3. Database Query Optimization**
```prisma
model Ticket {
  id        Int      @id @default(autoincrement())
  stage     Stage    @default(INBOX)
  version   Int      @default(1)
  updatedAt DateTime @updatedAt

  @@index([stage])     // Fast filtering by stage
  @@index([updatedAt]) // Fast sorting
}
```

**4. Next.js Server Components**
- Initial board data loaded via Server Component
- Only drag-drop interaction requires Client Component
- Reduces client-side JavaScript bundle

**5. Connection Pooling**
Prisma automatically manages connection pooling for PostgreSQL, ensuring efficient database access under concurrent load.

### React Rendering Optimization

**Strategies**:
1. **React.memo**: Prevent re-renders of unchanged tickets
2. **useCallback**: Memoize event handlers
3. **useMemo**: Cache computed values (stage order, valid drop zones)
4. **Key stability**: Use ticket.id as key (not index)
5. **State locality**: Keep drag state in DndContext, not global

### Database Query Optimization

**For Concurrent Updates**:
```typescript
// Atomic update with version check
const updated = await prisma.ticket.update({
  where: {
    id: ticketId,
    version: currentVersion, // Ensures atomicity
  },
  data: {
    stage: newStage,
    version: { increment: 1 },
  },
});

if (!updated) {
  // Version mismatch - conflict detected
}
```

**For List Queries**:
```typescript
// Efficient query with indexes
const tickets = await prisma.ticket.findMany({
  where: { stage },
  orderBy: { updatedAt: 'desc' },
  select: {
    id: true,
    title: true,
    stage: true,
    version: true, // Include version for optimistic updates
  },
});
```

**Index Strategy**:
- `stage` index: Fast filtering by column
- `updatedAt` index: Fast sorting
- `id` primary key: Fast lookups for updates
- Composite index not needed (small dataset, simple queries)

## Summary of Key Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Drag Library** | @dnd-kit/core + @dnd-kit/sortable | Modern, accessible, TypeScript-first, excellent performance |
| **Touch Support** | PointerSensor + TouchSensor | Unified mouse/touch handling with proper activation constraints |
| **Optimistic UI** | Optimistic update with rollback | Meets <100ms latency requirement, maintains consistency |
| **Conflict Resolution** | Version field (OCC) | Lightweight, atomic, clear conflict detection |
| **Validation** | Client + Server (dual) | Best UX + security, shared logic |
| **Performance** | Optimistic + memo + indexes | Multiple optimization layers for <100ms target |
| **Offline Detection** | Navigator.onLine API | Native, real-time, no dependencies |

All research findings support constitutional principles (TypeScript-first, shadcn/ui, TDD, security-first, database integrity).

**All NEEDS CLARIFICATION resolved** - Ready for Phase 1 (Design & Contracts).
