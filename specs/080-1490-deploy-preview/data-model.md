# Data Model: Manual Vercel Deploy Preview

**Date**: 2025-11-03 | **Feature**: Manual Vercel Deploy Preview | **Phase**: 1

## Overview

This feature extends the existing Ticket and Job models to support Vercel preview deployment tracking. No new entities are required - only field additions to existing models.

## Entity Changes

### Ticket Model (Extended)

**Purpose**: Store preview deployment URL for tickets in VERIFY stage

**New Fields**:

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `previewUrl` | `String?` | Nullable, Max 500 chars, HTTPS-only | URL of the active Vercel preview deployment for this ticket |

**Updated Schema**:
```prisma
model Ticket {
  id               Int       @id @default(autoincrement())
  ticketNumber     Int       // Sequential number within project
  ticketKey        String    @unique @db.VarChar(20)  // e.g., "ABC-123"
  title            String
  description      String?
  stage            Stage
  branch           String?   @db.VarChar(200)
  previewUrl       String?   @db.VarChar(500)  // NEW FIELD
  autoMode         Boolean   @default(false)
  clarificationPolicy ClarificationPolicy?
  workflowType     WorkflowType @default(FULL)
  projectId        Int
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  project          Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs             Job[]
  comments         Comment[]

  @@unique([projectId, ticketNumber])
  @@index([projectId])
  @@index([stage])
  @@index([ticketKey])
}
```

**Field Validation Rules**:
- `previewUrl` MUST be null or valid HTTPS URL
- `previewUrl` MUST be ≤500 characters
- `previewUrl` format: `https://{subdomain}.vercel.app` (Vercel preview domain)
- Setting `previewUrl` requires ticket to be in VERIFY stage (application-level validation)

**Relationships**:
- No new relationships (existing `jobs` relation used for deployment job tracking)

---

### Job Model (Extended)

**Purpose**: Track deployment workflow execution status using existing job infrastructure

**New Command Type**:

The `command` field (existing) now accepts a new literal value: `"deploy-preview"`

**No Schema Changes Required** - Job model already supports arbitrary command strings:
```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  projectId   Int
  command     String    @db.VarChar(100)  // Now includes "deploy-preview"
  status      JobStatus
  branch      String?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([ticketId])
  @@index([status])
}
```

**Command Value**: `"deploy-preview"`

**Status Transitions** (existing state machine):
- PENDING: Deployment job created, workflow dispatch pending
- RUNNING: GitHub Actions workflow executing Vercel deployment
- COMPLETED: Deployment succeeded, `previewUrl` updated on ticket
- FAILED: Deployment failed, error logged, user can retry

---

## Validation Rules

### Deploy Eligibility Validation (Application-Level)

A ticket is eligible for deployment if ALL conditions are met:

1. **Stage Requirement**: `ticket.stage === 'VERIFY'`
2. **Job Completion**: Latest job for ticket has `status === 'COMPLETED'`
3. **Branch Requirement**: `ticket.branch !== null` (feature branch must exist)
4. **Authorization**: User is project owner OR member (existing auth pattern)

**Implementation Location**: `app/lib/utils/deploy-preview-eligibility.ts`

```typescript
export function isTicketDeployable(ticket: {
  stage: Stage;
  branch: string | null;
  jobs: Array<{ status: JobStatus; createdAt: Date }>;
}): boolean {
  if (ticket.stage !== 'VERIFY') return false;
  if (!ticket.branch) return false;

  const latestJob = ticket.jobs.sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  )[0];

  return latestJob?.status === 'COMPLETED';
}
```

### Preview URL Validation (API-Level)

When updating `ticket.previewUrl`:

1. **Format**: Must match regex `^https://[a-z0-9-]+\.vercel\.app$`
2. **Length**: ≤500 characters
3. **Protocol**: HTTPS only (no HTTP)

**Implementation Location**: `app/lib/schemas/deploy-preview.ts`

```typescript
import { z } from 'zod';

export const previewUrlSchema = z.string()
  .url()
  .regex(/^https:\/\/[a-z0-9-]+\.vercel\.app$/, 'Must be a valid Vercel preview URL')
  .max(500, 'Preview URL must be ≤500 characters');
```

---

## Database Migration

### Migration: `add_ticket_preview_url`

**File**: `prisma/migrations/[timestamp]_add_ticket_preview_url/migration.sql`

```sql
-- Add previewUrl field to Ticket table
ALTER TABLE "Ticket" ADD COLUMN "previewUrl" VARCHAR(500);

-- No index required (nullable field, infrequent queries on this column)
```

**Migration Commands**:
```bash
# Development
npx prisma migrate dev --name add_ticket_preview_url

# Production (automated in CI/CD)
npx prisma migrate deploy
```

**Rollback Strategy**:
If deployment fails and migration must be reversed:

```sql
-- Rollback migration
ALTER TABLE "Ticket" DROP COLUMN "previewUrl";
```

**Data Migration**: Not required (all existing tickets start with `previewUrl = null`)

---

## Query Patterns

### Get Active Preview for Project

**Use Case**: Check if any ticket in project has an active preview (single-preview constraint)

```typescript
const activePreview = await prisma.ticket.findFirst({
  where: {
    projectId,
    previewUrl: { not: null },
  },
  select: { id: true, ticketKey: true, previewUrl: true },
});
```

**Performance**: Uses existing `@@index([projectId])` on Ticket table

---

### Clear All Previews in Project (Transaction)

**Use Case**: Enforce single-preview constraint when creating new deployment

```typescript
await prisma.$transaction(async (tx) => {
  // Clear all existing preview URLs
  await tx.ticket.updateMany({
    where: { projectId, previewUrl: { not: null } },
    data: { previewUrl: null },
  });

  // Create new deployment job
  const job = await tx.job.create({
    data: {
      ticketId,
      projectId,
      command: 'deploy-preview',
      status: 'PENDING',
      branch: ticket.branch,
    },
  });

  return job;
});
```

**Transaction Isolation**: Prevents race conditions when multiple users deploy simultaneously

---

### Get Deployment Job for Ticket

**Use Case**: Check if ticket has an active deployment in progress

```typescript
const deploymentJob = await prisma.job.findFirst({
  where: {
    ticketId,
    command: 'deploy-preview',
    status: { in: ['PENDING', 'RUNNING'] },
  },
  orderBy: { createdAt: 'desc' },
});
```

**Performance**: Uses existing `@@index([ticketId])` and `@@index([status])` on Job table

---

## State Transitions

### Deployment Lifecycle State Diagram

```
[Ticket: VERIFY, job: COMPLETED, branch: "080-feature"]
                    ↓
           User clicks deploy icon
                    ↓
         Confirmation modal shown
                    ↓
            User confirms deploy
                    ↓
    [Transaction: Clear existing previews + Create job]
                    ↓
         [Job: PENDING, command: "deploy-preview"]
                    ↓
      GitHub workflow dispatched via API
                    ↓
    [Job: RUNNING] ← Workflow updates status
                    ↓
         Vercel CLI deploys branch
                    ↓
              ┌─────┴─────┐
              ↓           ↓
     [Deployment Succeeds]  [Deployment Fails]
              ↓           ↓
  [Job: COMPLETED]  [Job: FAILED]
  [Ticket.previewUrl updated]  [Error logged]
              ↓           ↓
   Preview icon shown   Error indicator shown
   (clickable URL)     (retry available)
```

---

## Indexes & Performance

### Existing Indexes (No Changes Required)

All queries leverage existing indexes:

- `Ticket.@@index([projectId])`: Used for finding active previews in project
- `Ticket.@@index([stage])`: Used for filtering VERIFY stage tickets
- `Job.@@index([ticketId])`: Used for finding deployment jobs by ticket
- `Job.@@index([status])`: Used for filtering PENDING/RUNNING jobs
- `Job.@@index([projectId])`: Used for job polling (existing feature)

**No new indexes required** - queries optimized using existing schema.

---

## Data Integrity Constraints

### Single Preview Enforcement

**Constraint**: Only one ticket per project can have a non-null `previewUrl` at a time

**Enforcement Level**: Application-level (not database constraint)

**Rationale**: SQL does not support "only one non-null value per group" constraints. Enforced via transaction logic.

**Implementation**:
```typescript
// Transaction ensures atomicity
await prisma.$transaction(async (tx) => {
  await tx.ticket.updateMany({
    where: { projectId, previewUrl: { not: null } },
    data: { previewUrl: null },
  });
  // ... create new job
});
```

---

### Preview URL Nullability

**Constraint**: `previewUrl` MUST be null when ticket is not in VERIFY stage OR deployment has not completed

**Enforcement Level**: Application-level (validated before setting URL)

**Implementation**: GitHub workflow only updates `previewUrl` when:
1. Job status transitions to COMPLETED
2. Ticket is still in VERIFY stage (checked before API call)

---

## Security Considerations

### Authorization Checks

**Before allowing deployment**:
1. User MUST be authenticated (NextAuth session)
2. User MUST be project owner OR member (existing auth pattern)
3. Ticket MUST belong to user's authorized project

**Implementation**: Existing `verifyProjectAccess()` helper from `lib/db/auth-helpers.ts`

---

### Preview URL Tampering Prevention

**Risk**: Malicious user provides fake preview URL via API

**Mitigation**:
1. Only GitHub workflow can update `previewUrl` (not exposed in public API)
2. Workflow authenticates with `WORKFLOW_API_TOKEN` (secret)
3. Preview URL extracted from Vercel CLI stdout (not user input)

**API Endpoint**: `PATCH /api/projects/:projectId/tickets/:id/preview-url` (workflow-only, Bearer auth)

---

## Testing Data Scenarios

### Unit Test Scenarios (Vitest)

**Test File**: `tests/unit/deploy-preview-eligibility.test.ts`

1. ✅ Ticket in VERIFY stage with COMPLETED job and branch → deployable
2. ❌ Ticket in BUILD stage with COMPLETED job → not deployable
3. ❌ Ticket in VERIFY stage with RUNNING job → not deployable
4. ❌ Ticket in VERIFY stage with no branch → not deployable
5. ✅ Multiple jobs, latest is COMPLETED → deployable
6. ❌ Multiple jobs, latest is FAILED → not deployable

### Integration Test Scenarios (Playwright)

**Test File**: `tests/integration/deploy-preview/deploy-icon.spec.ts`

1. Deploy icon visible when ticket is deployable
2. Deploy icon hidden when ticket is not in VERIFY stage
3. Preview icon visible when `previewUrl` is set
4. Preview icon hidden when `previewUrl` is null
5. Confirmation modal shows warning when existing preview exists

### E2E Test Scenarios (Playwright)

**Test File**: `tests/e2e/deploy-preview-workflow.spec.ts`

1. Full deployment flow: Click deploy → confirm → job polling → preview icon appears
2. Single-preview enforcement: Deploy ticket A → deploy ticket B → ticket A preview cleared
3. Deployment failure handling: Trigger deploy → workflow fails → error indicator shown

---

## Backward Compatibility

### Existing Tickets

All existing tickets will have `previewUrl = null` after migration (default value). No data migration required.

### Existing Jobs

Job model unchanged - only new command type added. Existing jobs remain valid.

### API Compatibility

No breaking changes to existing API endpoints. New endpoints added:
- `POST /api/projects/:projectId/tickets/:id/deploy` (new)
- `PATCH /api/projects/:projectId/tickets/:id/preview-url` (new, workflow-only)

---

## Future Enhancements (Out of Scope)

### Preview URL Verification

Add background job to check if preview URL is still accessible (HTTP 200 check). Mark as stale if unreachable.

### Manual Preview Deletion

Add "Delete Preview" button on ticket card to manually remove preview URL and Vercel deployment.

### Multi-Preview Support

Allow multiple previews per project with environment labels (e.g., "staging", "review"). Requires UI changes for preview selection.

### Deployment History

Track all deployments for ticket (not just latest). Requires new `Deployment` entity with foreign key to Ticket.
