# Data Model: Unified Deploy Preview Icon

**Feature**: Consolidate preview and deploy icons into single stateful icon
**Branch**: `084-1499-fix-deploy`
**Date**: 2025-11-04

## Overview

This feature is a **UI-only refactor** with no database schema changes. The unified deploy icon uses existing data from the Ticket and Job models.

## Existing Data Models (No Changes Required)

### Ticket Model (Prisma Schema)

```prisma
model Ticket {
  id            Int       @id @default(autoincrement())
  ticketKey     String    @unique @db.VarChar(20)
  ticketNumber  Int
  title         String    @db.VarChar(500)
  description   String?   @db.Text
  stage         Stage
  branch        String?   @db.VarChar(200)  // Used for deploy eligibility check
  previewUrl    String?   @db.VarChar(500)  // Primary field for preview icon state
  projectId     Int
  // ... other fields

  jobs          Job[]     // Relationship to Job model

  @@unique([projectId, ticketNumber])
  @@index([projectId])
}
```

**Fields Used by Unified Icon**:
- `previewUrl` (String?, nullable): When NOT NULL, icon shows green preview state (highest priority)
- `stage` (Stage enum): Used by `isTicketDeployable()` to check if stage === 'VERIFY'
- `branch` (String?, nullable): Used by `isTicketDeployable()` to check if branch exists
- `jobs` (Job[]): Used to find deploy job and check latest job status

### Job Model (Prisma Schema)

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  projectId   Int
  command     String    @db.VarChar(200)  // "deploy-preview" for deploy jobs
  status      JobStatus                   // PENDING/RUNNING/COMPLETED/FAILED/CANCELLED
  branch      String?   @db.VarChar(200)
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId])
  @@index([projectId])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Fields Used by Unified Icon**:
- `command` (String): Filter for `command === "deploy-preview"` to find deploy job
- `status` (JobStatus): Determines deploying state (PENDING/RUNNING) and retry eligibility (FAILED/CANCELLED)

## New Type Definitions

### DeployIconState Enum (TypeScript)

```typescript
/**
 * Represents the visual and interaction state of the unified deploy preview icon.
 * States are prioritized from highest to lowest as defined.
 */
export type DeployIconState =
  | 'preview'    // Green ExternalLink icon, clickable, opens preview URL
  | 'deploying'  // Blue Rocket icon, bounce animation, disabled (job PENDING/RUNNING)
  | 'deployable' // Neutral Rocket icon, clickable, opens deploy modal (isDeployable OR job FAILED/CANCELLED)
  | 'hidden';    // No icon shown
```

**State Priority Logic** (Highest to Lowest):
1. `preview`: `ticket.previewUrl !== null`
2. `deploying`: `deployJob?.status === 'PENDING' || deployJob?.status === 'RUNNING'`
3. `deployable`: `isDeployable === true || deployJob?.status === 'FAILED' || deployJob?.status === 'CANCELLED'`
4. `hidden`: None of the above conditions are met

## Computed Values

### Icon State Resolution

**Function**: `getDeployIconState(ticket, deployJob, isDeployable)`

```typescript
/**
 * Computes the unified deploy icon state based on ticket data, deploy job, and eligibility.
 *
 * @param ticket - Ticket with previewUrl field
 * @param deployJob - Current deploy job (if exists)
 * @param isDeployable - Whether ticket meets deployment criteria
 * @returns DeployIconState enum value
 */
export function getDeployIconState(
  ticket: { previewUrl: string | null },
  deployJob: { status: JobStatus } | null | undefined,
  isDeployable: boolean
): DeployIconState {
  // Priority 1: Preview (highest)
  if (ticket.previewUrl !== null) {
    return 'preview';
  }

  // Priority 2: Deploying
  if (deployJob?.status === 'PENDING' || deployJob?.status === 'RUNNING') {
    return 'deploying';
  }

  // Priority 3: Deployable (includes retry after failure)
  if (isDeployable || deployJob?.status === 'FAILED' || deployJob?.status === 'CANCELLED') {
    return 'deployable';
  }

  // Priority 4: Hidden (fallback)
  return 'hidden';
}
```

**Inputs**:
- `ticket.previewUrl`: Existing Ticket field (no query changes)
- `deployJob.status`: Filtered from existing Job query using `getDeployJob()` helper
- `isDeployable`: Computed from existing `isTicketDeployable()` function

**Performance**:
- Pure function, no database queries
- Computes in <1ms (suitable for Vitest unit tests)
- Memoized with `React.useMemo()` to prevent unnecessary re-renders

## Data Flow

### Ticket Card Rendering

```
TicketCard receives props:
  - ticket: TicketWithVersion
  - deployJob: Job | null
  - ... other props

↓

Compute isDeployable (useMemo):
  isTicketDeployable({ stage, branch, jobs })

↓

Compute deployIconState (useMemo):
  getDeployIconState(ticket, deployJob, isDeployable)

↓

Render icon based on state:
  - preview: Green ExternalLink button (onClick: open URL)
  - deploying: Blue Rocket button (disabled, bounce animation)
  - deployable: Neutral Rocket button (onClick: open modal)
  - hidden: No icon rendered
```

### Job Polling Integration

```
useJobPolling (2s interval):
  Polls /api/projects/:id/jobs/status

↓

Job status updates:
  PENDING → RUNNING → COMPLETED/FAILED/CANCELLED

↓

TicketCard re-renders with updated deployJob:
  - PENDING/RUNNING: Icon shows 'deploying' state
  - COMPLETED: previewUrl updated, icon shows 'preview' state
  - FAILED/CANCELLED: Icon shows 'deployable' state (retry)

↓

Icon state transitions automatically via React.useMemo()
```

## Validation Rules (Existing - No Changes)

### Deploy Eligibility Validation

**Function**: `isTicketDeployable({ stage, branch, jobs })`

**Rules** (from `lib/utils/deploy-preview-eligibility.ts`):
- Stage must be 'VERIFY'
- Branch must exist (not null, not empty string)
- Latest job must have status 'COMPLETED'

### Preview URL Validation

**Zod Schema** (from `lib/schemas/deploy-preview.ts`):
```typescript
export const previewUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://'), 'Preview URL must use HTTPS')
  .refine((url) => /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(url), 'Preview URL must be Vercel domain')
  .max(500);
```

**Validation Points**:
- HTTPS-only protocol
- Vercel domain pattern: `https://*-.vercel.app`
- Maximum 500 characters

## Entity Relationships (Existing)

```
Ticket (1) ←→ (N) Job
  - Ticket.jobs[] contains all jobs for the ticket
  - Job.ticketId references Ticket.id
  - Deploy job filtered by Job.command === "deploy-preview"

Ticket.previewUrl (String?)
  - Set by workflow via PATCH /api/projects/:projectId/tickets/:id/preview-url
  - Triggers icon state change from 'deployable'/'deploying' to 'preview'
  - Persists across job completions (stable state)
```

## State Transitions

### Icon State Transitions (Ticket Lifecycle)

```
Initial State (VERIFY stage, no preview):
  hidden → deployable (when branch + completed job exist)

User Triggers Deployment:
  deployable → deploying (job created with status PENDING)

Workflow Execution:
  deploying → deploying (job status PENDING → RUNNING)
  deploying → preview (job status RUNNING → COMPLETED, previewUrl set)

Deployment Failure:
  deploying → deployable (job status RUNNING → FAILED/CANCELLED)

User Retries After Failure:
  deployable → deploying (new job created)

Permanent Preview State:
  preview (remains until previewUrl cleared or ticket updated)
```

### Database State Changes (None for This Feature)

**No schema migrations required** - This feature only changes UI logic.

**Existing database operations continue unchanged**:
- Job creation: `POST /api/projects/:projectId/tickets/:id/deploy`
- Job status updates: `PATCH /api/jobs/:id/status`
- Preview URL updates: `PATCH /api/projects/:projectId/tickets/:id/preview-url`

## Performance Considerations

### Query Impact (None - No New Queries)

**Existing Queries Used**:
- Ticket query: Already fetches `previewUrl`, `stage`, `branch`, `jobs`
- Job polling: Already filters jobs by `projectId` every 2 seconds

**No Additional Database Load**:
- Icon state computed client-side from existing data
- No new API endpoints or database queries
- No new indexes required

### Rendering Performance

**Optimization Strategy**:
- Use `React.useMemo()` for icon state computation
- Use `React.memo()` for TicketCard component (already implemented)
- Pure function `getDeployIconState()` enables efficient memoization

**Performance Targets** (from Technical Context):
- Icon state computation: <1ms (pure function)
- State transition animation: 60fps (CSS animation)
- Re-render after job update: <50ms (React memoization)

## Migration Plan (None Required)

**No database migrations** - This is a UI-only refactor.

**Component Deprecation**:
- Remove `components/board/ticket-card-preview-icon.tsx` (no longer used)
- Remove `components/board/ticket-card-deploy-icon.tsx` (no longer used)
- Update imports in `components/board/ticket-card.tsx`

**Backward Compatibility**:
- No API contract changes
- No prop interface changes to TicketCard component
- Existing tests may need updates if they directly imported deprecated components

## Testing Data Requirements

### Vitest Unit Tests (Pure Logic)

**Test Fixtures** (in-memory TypeScript objects):
```typescript
const mockTicket = {
  previewUrl: null, // or 'https://test.vercel.app'
};

const mockDeployJob = {
  status: 'PENDING' as JobStatus, // or 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
};

const isDeployable = true; // or false
```

**Test Cases**:
- All 4 icon states independently
- State priority when multiple conditions true
- Edge cases (null values, undefined jobs)

### Playwright Integration Tests (DOM Interactions)

**Test Data Requirements** (E2E database setup):
```typescript
// Create test ticket with preview URL
await prisma.ticket.create({
  data: {
    id: 999,
    title: '[e2e] Ticket with Preview',
    previewUrl: 'https://test-preview.vercel.app',
    stage: 'VERIFY',
    branch: '999-test-branch',
    projectId: 1,
  },
});

// Create test ticket with deploy job
await prisma.ticket.create({
  data: {
    id: 998,
    title: '[e2e] Deployable Ticket',
    stage: 'VERIFY',
    branch: '998-test-branch',
    projectId: 1,
    jobs: {
      create: {
        command: 'deploy-preview',
        status: 'PENDING',
        projectId: 1,
      },
    },
  },
});
```

**Test Scenarios**:
- Green icon visible when ticket has preview URL
- Rocket icon visible when ticket is deployable
- Blue bounce animation during deployment
- Click handlers (preview opens URL, deploy opens modal)
- Icon hidden when ticket not deployable

## Summary

**Database Changes**: None
**New Types**: `DeployIconState` enum (TypeScript only)
**New Functions**: `getDeployIconState()` (pure utility function)
**API Changes**: None
**Migration Required**: None

This feature consolidates existing UI components without touching the database or API layer.
