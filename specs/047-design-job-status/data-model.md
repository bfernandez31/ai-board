# Data Model: Simplified Job Status Display

**Feature**: `047-design-job-status`
**Date**: 2025-10-24
**Phase**: 1 - Design & Contracts

## Overview

This feature requires **NO database schema changes** and **NO data model modifications**. All changes are purely visual (UI/UX refinement) leveraging existing data structures.

## Existing Data Structures (No Changes)

### Job Entity (Prisma Schema)

**Source**: Existing Prisma schema (`prisma/schema.prisma`)

```typescript
model Job {
  id           Int       @id @default(autoincrement())
  ticketId     Int
  projectId    Int
  command      String    // e.g., "specify", "comment-build"
  status       JobStatus // PENDING | RUNNING | COMPLETED | FAILED | CANCELLED
  branch       String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  completedAt  DateTime? // Timestamp when job reached terminal state

  ticket       Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

**Fields Used by This Feature**:
- `status`: Job status for visual rendering (icon, color, animation)
- `command`: Job command for classification (workflow vs AI-BOARD) and contextual labels
- `completedAt`: Timestamp for tooltip formatting ("AI-BOARD assisted on [timestamp]")

**No Changes Required**: All necessary data already exists in database

---

### JobType Enum (Application Layer)

**Source**: Existing TypeScript enum (`lib/types/job-types.ts`)

```typescript
export enum JobType {
  WORKFLOW = 'WORKFLOW',    // Automated workflow jobs (specify, plan, build)
  AI_BOARD = 'AI_BOARD',    // User-initiated AI assistance (@ai-board mentions)
}
```

**Usage**: Classification logic determines visual rendering mode:
- `WORKFLOW` → Simple status display (icon + label, no prefix)
- `AI_BOARD` → Compact icon-only display (bot icon, color-coded, tooltip)

**No Changes Required**: Existing classification logic in `classifyJobType()` sufficient

---

### JobStatus Enum (Prisma Schema)

**Source**: Existing Prisma enum

```typescript
enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Visual Mapping** (per feature requirements):

| Status    | Workflow Display       | AI-BOARD Display                          |
|-----------|------------------------|-------------------------------------------|
| PENDING   | ⏱️ PENDING              | 🤖 (purple) + tooltip "preparing..."      |
| RUNNING   | ✏️ WRITING              | 🤖 (purple) + tooltip "working..."        |
| COMPLETED | ✅ COMPLETED            | 🤖 (purple) + tooltip "assisted on [timestamp]" |
| FAILED    | ❌ FAILED               | 🤖 (red) + tooltip "assistance failed"    |
| CANCELLED | 🚫 CANCELLED            | 🤖 (gray) + tooltip "assistance cancelled"|

**No Changes Required**: Enum values unchanged, only visual rendering differs

---

## Component Props Interfaces

### JobStatusIndicatorProps (Modified)

**Location**: `components/board/job-status-indicator.tsx`

**Changes**: No interface changes required - existing props support all needed functionality

```typescript
export interface JobStatusIndicatorProps {
  status: JobStatus;      // Current job status
  command: string;        // Job command (for contextual labels)
  jobType?: JobType;      // WORKFLOW | AI_BOARD (determines rendering mode)
  stage?: string;         // Ticket stage (not used for WORKFLOW, removed from display)
  className?: string;     // Optional styling
  animated?: boolean;     // Animation control (workflow only)
  ariaLabel?: string;     // Accessibility label override
}
```

**Rendering Logic Changes**:
- `jobType === WORKFLOW` → Skip stage prefix, render status icon + label only
- `jobType === AI_BOARD` → Render compact bot icon with color + tooltip, skip label text

---

### TicketCardProps (No Changes)

**Location**: `components/board/ticket-card.tsx`

**Existing Interface** (unchanged):

```typescript
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null;  // Workflow job (left side of status line)
  aiBoardJob?: Job | null;   // AI-BOARD job (right side of status line)
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}
```

**Layout Changes Only**:
- Change `space-y-2` (vertical stack) to `flex justify-between` (horizontal layout)
- Workflow job naturally flows left
- AI-BOARD job positioned right via flexbox

---

## Utility Functions

### New: formatTimestamp()

**Location**: `lib/utils/format-timestamp.ts` (NEW FILE)

**Purpose**: Format job completion timestamps for tooltips in human-readable format

**Signature**:

```typescript
/**
 * Format timestamp for tooltip display
 *
 * @param timestamp - Date object, ISO string, or null
 * @returns Formatted string (e.g., "2 minutes ago", "Oct 24, 3:42 PM")
 */
export function formatTimestamp(timestamp: Date | string | null): string;
```

**Examples**:
- Input: `new Date('2025-10-24T15:40:00')` (2 minutes ago)
- Output: `"2 minutes ago"`

- Input: `new Date('2025-10-23T10:00:00')` (yesterday)
- Output: `"Oct 23, 10:00 AM"`

- Input: `null`
- Output: `"Unknown time"`

**Implementation Strategy**:
- Use `Intl.RelativeTimeFormat` for recent times (< 24 hours)
- Use `Intl.DateTimeFormat` for older timestamps
- Handle null/invalid inputs gracefully

---

## Visual State Machine

### Workflow Job States (Simplified Display)

```
┌──────────────────────────────────────────┐
│  Status Icon + Label Only (No Prefix)   │
└──────────────────────────────────────────┘
          │
          ├─→ PENDING:   ⏱️ PENDING
          ├─→ RUNNING:   ✏️ WRITING (animated)
          ├─→ COMPLETED: ✅ COMPLETED
          ├─→ FAILED:    ❌ FAILED
          └─→ CANCELLED: 🚫 CANCELLED
```

### AI-BOARD Job States (Compact Icon-Only)

```
┌──────────────────────────────────────────┐
│    Bot Icon + Color + Tooltip            │
└──────────────────────────────────────────┘
          │
          ├─→ PENDING:   🤖 (purple) [tooltip: "AI-BOARD is preparing..."]
          ├─→ RUNNING:   🤖 (purple) [tooltip: "AI-BOARD is working on this ticket"]
          ├─→ COMPLETED: 🤖 (purple) [tooltip: "AI-BOARD assisted on Oct 24, 3:42 PM"]
          ├─→ FAILED:    🤖 (red)    [tooltip: "AI-BOARD assistance failed"]
          └─→ CANCELLED: 🤖 (gray)   [tooltip: "AI-BOARD assistance cancelled"]
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Board Component                          │
│  - Fetches jobs via useJobPolling hook                          │
│  - Groups jobs by ticketId                                       │
│  - Passes workflowJob + aiBoardJob to TicketCard                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TicketCard Component                         │
│  - Receives: workflowJob, aiBoardJob                            │
│  - Layout: flex justify-between (single line)                   │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│   JobStatusIndicator          │  │   JobStatusIndicator          │
│   (Workflow Job)              │  │   (AI-BOARD Job)              │
│                               │  │                               │
│ - jobType: WORKFLOW           │  │ - jobType: AI_BOARD           │
│ - Render: Icon + Label        │  │ - Render: Icon only           │
│ - No prefix                   │  │ - With Tooltip                │
│ - Left side (natural flow)    │  │ - Right side (flex end)       │
└───────────────────────────────┘  └───────────────────────────────┘
```

---

## No Migrations Required

### Database Schema
- ✅ No Prisma schema changes
- ✅ No migrations to generate
- ✅ No data backfill needed
- ✅ No API contract changes

### TypeScript Types
- ✅ No new enums or interfaces
- ✅ No breaking changes to existing types
- ✅ All changes backward compatible

---

## Phase 1 Data Model Completion

**Status**: ✅ COMPLETE

**Summary**: No data model changes required. Feature leverages existing Job entity fields (`status`, `command`, `completedAt`) with purely visual rendering modifications. One new utility function (`formatTimestamp`) added for timestamp formatting in tooltips.

**Next Phase**: Generate component interface contracts
