# Component Interface Contracts

**Feature**: 020-9179-real-time
**Date**: 2025-10-10
**Framework**: React 18 + TypeScript 5.6

## Component Overview

This document defines TypeScript interfaces and props for all components in the real-time job status feature.

---

## 1. JobStatusIndicator Component

**Purpose**: Display current job status with animated visual indicators

**File**: `components/board/job-status-indicator.tsx`

**Component Type**: Client Component (`"use client"`)

### Props Interface

```typescript
export interface JobStatusIndicatorProps {
  /**
   * Current job status to display
   */
  status: JobStatus

  /**
   * Job command for context (e.g., "specify", "plan", "build")
   */
  command: string

  /**
   * Optional CSS class name for styling
   */
  className?: string

  /**
   * Whether to show animation (for RUNNING status)
   * @default true
   */
  animated?: boolean

  /**
   * Accessibility label for screen readers
   */
  ariaLabel?: string
}
```

### Usage Example

```tsx
import { JobStatusIndicator } from '@/components/board/job-status-indicator'

// Running job with animation
<JobStatusIndicator
  status="RUNNING"
  command="specify"
  animated={true}
  ariaLabel="Job is currently running"
/>

// Completed job (no animation)
<JobStatusIndicator
  status="COMPLETED"
  command="plan"
  ariaLabel="Job completed successfully"
/>

// Failed job
<JobStatusIndicator
  status="FAILED"
  command="build"
  ariaLabel="Job failed with errors"
/>
```

### Visual States

| Status | Icon | Color | Animation |
|--------|------|-------|-----------|
| PENDING | ⏱️ Clock | Gray 500 | None |
| RUNNING | ✍️ Quill/Pen | Blue 500 | Writing motion (2s loop) |
| COMPLETED | ✅ Checkmark | Green 500 | None |
| FAILED | ❌ X-Circle | Red 500 | None |
| CANCELLED | ⊘ Ban | Gray 400 | None |

### Animation Specification

**RUNNING Animation** (CSS Keyframes):
```css
@keyframes quill-writing {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-2px) rotate(2deg); }
  75% { transform: translateY(2px) rotate(-2deg); }
}

.job-running-animation {
  animation: quill-writing 2s ease-in-out infinite;
  will-change: transform;
}
```

### Accessibility Requirements

- Icon has `role="img"` and `aria-label` describing status
- Color is not the only indicator (icon shape also differs)
- Animation respects `prefers-reduced-motion` media query
- Status text provided for screen readers

---

## 2. TicketCard Component (Modified)

**Purpose**: Display ticket with job status indicator (metadata section removed)

**File**: `components/board/ticket-card.tsx`

**Component Type**: Client Component (`"use client"`)

### Props Interface (Updated)

```typescript
export interface TicketCardProps {
  /**
   * Ticket data
   */
  ticket: Ticket

  /**
   * Current job for this ticket (null if no jobs)
   */
  currentJob: Job | null

  /**
   * Callback when ticket is clicked
   */
  onClick?: () => void

  /**
   * Whether ticket is being dragged
   */
  isDragging?: boolean

  /**
   * Optional CSS class name
   */
  className?: string
}
```

### Layout Structure (NEW)

```tsx
<Card className="ticket-card">
  {/* Header: Ticket ID + Badge */}
  <CardHeader>
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">#{ticket.id}</span>
      <Badge variant="secondary">SONNET</Badge>
    </div>
  </CardHeader>

  {/* Body: Title */}
  <CardContent>
    <h3 className="text-base font-medium">{ticket.title}</h3>
  </CardContent>

  {/* Footer: Job Status (NEW - replaces metadata) */}
  {currentJob && (
    <CardFooter>
      <JobStatusIndicator
        status={currentJob.status}
        command={currentJob.command}
        ariaLabel={`Job ${currentJob.command} is ${currentJob.status.toLowerCase()}`}
      />
    </CardFooter>
  )}
</Card>
```

### Removed Elements

**Before** (OLD):
```tsx
<CardFooter className="metadata-section">
  <div className="text-xs text-muted-foreground">
    <span>PLAN: 12 messages / 3 tools</span>
    <span>BUILD: 45 messages / 8 tools</span>
    <span>VERIFY: 8 messages / 2 tools</span>
  </div>
</CardFooter>
```

**After** (NEW):
```tsx
<CardFooter>
  {currentJob && (
    <JobStatusIndicator
      status={currentJob.status}
      command={currentJob.command}
    />
  )}
</CardFooter>
```

---

## 3. WebSocketProvider Component

**Purpose**: Manage WebSocket connection lifecycle and provide context to child components

**File**: `components/board/websocket-provider.tsx`

**Component Type**: Client Component (`"use client"`)

### Props Interface

```typescript
export interface WebSocketProviderProps {
  /**
   * Project ID to subscribe to for job updates
   */
  projectId: number

  /**
   * Child components that need WebSocket access
   */
  children: React.ReactNode

  /**
   * WebSocket URL (defaults to window.location.origin + /api/ws)
   */
  wsUrl?: string

  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (status: WebSocketStatus) => void
}
```

### Context Interface

```typescript
export interface WebSocketContextValue {
  /**
   * Current connection status
   */
  status: WebSocketStatus

  /**
   * Most recent job status updates (keyed by ticketId)
   */
  jobUpdates: Map<number, JobStatusUpdate>

  /**
   * Subscribe to a specific ticket's updates
   */
  subscribeToTicket: (ticketId: number) => void

  /**
   * Unsubscribe from a specific ticket
   */
  unsubscribeFromTicket: (ticketId: number) => void

  /**
   * Manually reconnect if disconnected
   */
  reconnect: () => void

  /**
   * Send custom message to server
   */
  send: (message: ClientMessage) => void
}

export type WebSocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
```

### Usage Example

```tsx
// In board page
import { WebSocketProvider } from '@/components/board/websocket-provider'

export default function BoardPage({ params }: { params: { projectId: string } }) {
  const projectId = parseInt(params.projectId)

  return (
    <WebSocketProvider
      projectId={projectId}
      onConnectionChange={(status) => console.log('WS status:', status)}
    >
      <Board projectId={projectId} />
    </WebSocketProvider>
  )
}

// In child component
import { useWebSocket } from '@/components/board/websocket-provider'

function TicketCard({ ticket }: { ticket: Ticket }) {
  const { jobUpdates } = useWebSocket()
  const currentJob = jobUpdates.get(ticket.id)

  return (
    <Card>
      {/* ... ticket content ... */}
      {currentJob && (
        <JobStatusIndicator
          status={currentJob.status}
          command={currentJob.command}
        />
      )}
    </Card>
  )
}
```

---

## 4. useJobStatus Hook

**Purpose**: Client-side hook for managing job status with 500ms minimum display duration

**File**: `lib/hooks/use-job-status.ts`

### Hook Interface

```typescript
export interface UseJobStatusOptions {
  /**
   * Ticket ID to track job status for
   */
  ticketId: number

  /**
   * Minimum display duration for each status (milliseconds)
   * @default 500
   */
  minDisplayDuration?: number

  /**
   * Whether to enable status transitions
   * @default true
   */
  enabled?: boolean
}

export interface UseJobStatusResult {
  /**
   * Current displayed status (may be delayed from actual status)
   */
  displayStatus: JobStatus | null

  /**
   * Actual latest status from WebSocket
   */
  actualStatus: JobStatus | null

  /**
   * Whether status transition is in progress
   */
  isTransitioning: boolean

  /**
   * Job command (e.g., "specify", "plan")
   */
  command: string | null

  /**
   * Manually force status update (skip delay)
   */
  forceUpdate: () => void
}
```

### Usage Example

```tsx
import { useJobStatus } from '@/lib/hooks/use-job-status'

function TicketCard({ ticket }: { ticket: Ticket }) {
  const { displayStatus, command, isTransitioning } = useJobStatus({
    ticketId: ticket.id,
    minDisplayDuration: 500
  })

  return (
    <Card>
      {/* ... ticket content ... */}
      {displayStatus && command && (
        <JobStatusIndicator
          status={displayStatus}
          command={command}
          className={isTransitioning ? 'opacity-75' : ''}
        />
      )}
    </Card>
  )
}
```

### Implementation Logic

```typescript
export function useJobStatus(options: UseJobStatusOptions): UseJobStatusResult {
  const { ticketId, minDisplayDuration = 500, enabled = true } = options
  const { jobUpdates } = useWebSocket()
  const [displayStatus, setDisplayStatus] = useState<JobStatus | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const actualUpdate = jobUpdates.get(ticketId)
  const actualStatus = actualUpdate?.status ?? null
  const command = actualUpdate?.command ?? null

  useEffect(() => {
    if (!enabled || !actualStatus) return

    // If first status or no delay needed, update immediately
    if (!displayStatus || minDisplayDuration === 0) {
      setDisplayStatus(actualStatus)
      return
    }

    // Otherwise, enforce minimum display duration
    setIsTransitioning(true)

    timeoutRef.current = setTimeout(() => {
      setDisplayStatus(actualStatus)
      setIsTransitioning(false)
    }, minDisplayDuration)

    return () => clearTimeout(timeoutRef.current)
  }, [actualStatus, enabled, minDisplayDuration])

  const forceUpdate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setDisplayStatus(actualStatus)
    setIsTransitioning(false)
  }, [actualStatus])

  return {
    displayStatus,
    actualStatus,
    isTransitioning,
    command,
    forceUpdate
  }
}
```

---

## 5. Board Component (Modified)

**Purpose**: Main board component integrating WebSocket provider and ticket cards

**File**: `components/board/board.tsx`

**Component Type**: Client Component (`"use client"`)

### Props Interface (Updated)

```typescript
export interface BoardProps {
  /**
   * Project ID for this board
   */
  projectId: number

  /**
   * Initial tickets data (from server)
   */
  initialTickets: TicketWithJobs[]

  /**
   * Initial jobs map (ticketId → most recent job)
   */
  initialJobs: Map<number, Job>
}

/**
 * Ticket with related job data
 */
export interface TicketWithJobs extends Ticket {
  /**
   * Most recent active job for this ticket
   */
  currentJob: Job | null
}
```

### Integration Pattern

```tsx
import { WebSocketProvider, useWebSocket } from './websocket-provider'

export function Board({ projectId, initialTickets, initialJobs }: BoardProps) {
  return (
    <WebSocketProvider projectId={projectId}>
      <BoardContent
        initialTickets={initialTickets}
        initialJobs={initialJobs}
      />
    </WebSocketProvider>
  )
}

function BoardContent({
  initialTickets,
  initialJobs
}: {
  initialTickets: TicketWithJobs[]
  initialJobs: Map<number, Job>
}) {
  const { jobUpdates } = useWebSocket()
  const [tickets, setTickets] = useState(initialTickets)

  // Merge initial jobs with real-time updates
  const getTicketJob = (ticketId: number): Job | null => {
    const liveUpdate = jobUpdates.get(ticketId)
    if (liveUpdate) {
      return {
        ...initialJobs.get(ticketId)!,
        status: liveUpdate.status,
        command: liveUpdate.command
      }
    }
    return initialJobs.get(ticketId) ?? null
  }

  return (
    <div className="board-grid">
      {stages.map((stage) => (
        <StageColumn key={stage} stage={stage}>
          {tickets
            .filter((t) => t.stage === stage)
            .map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                currentJob={getTicketJob(ticket.id)}
              />
            ))}
        </StageColumn>
      ))}
    </div>
  )
}
```

---

## Type Definitions

### Shared Types (from Prisma)

```typescript
// Prisma-generated types
export type { Job, Ticket, JobStatus } from '@prisma/client'

// Extended types
export interface TicketWithCurrentJob extends Ticket {
  currentJob: Job | null
}
```

### WebSocket Message Types

```typescript
// See contracts/websocket-api.md for full Zod schemas

export type JobStatusUpdate = {
  type: 'job-status-update'
  projectId: number
  ticketId: number
  jobId: number
  status: JobStatus
  command: string
  timestamp: string
}

export type ClientMessage =
  | { type: 'subscribe'; projectId: number }
  | { type: 'unsubscribe'; projectId: number }
  | { type: 'ping'; timestamp: string }

export type ServerMessage =
  | { type: 'connected'; clientId: string; timestamp: string }
  | { type: 'subscribed'; projectId: number; timestamp: string }
  | { type: 'unsubscribed'; projectId: number; timestamp: string }
  | JobStatusUpdate
  | { type: 'error'; code: string; message: string; timestamp: string }
  | { type: 'pong'; timestamp: string }
```

---

## Testing Contracts

### Component Testing Requirements

Each component must have:
1. **Unit Tests**: Isolated component rendering with mocked props
2. **Integration Tests**: Component integration with WebSocket context
3. **Visual Tests**: Playwright screenshots for all status states
4. **Accessibility Tests**: Screen reader compatibility, keyboard navigation

### Test File Locations

```
tests/
├── unit/
│   ├── job-status-indicator.test.tsx
│   ├── ticket-card.test.tsx
│   └── use-job-status.test.ts
├── integration/
│   ├── websocket-provider.test.tsx
│   └── board-realtime-updates.test.tsx
└── e2e/
    ├── job-status-realtime.spec.ts
    ├── job-status-animations.spec.ts
    └── ticket-card-visual.spec.ts
```

---

## Contract Compliance Checklist

- [x] All component props interfaces defined
- [x] TypeScript types exported and documented
- [x] Usage examples provided
- [x] Visual states specified (colors, icons, animations)
- [x] Accessibility requirements documented
- [x] Hook interfaces and implementation logic defined
- [x] Integration patterns with WebSocket context shown
- [x] Testing requirements specified

**Status**: ✅ Component Interface Contracts Complete
