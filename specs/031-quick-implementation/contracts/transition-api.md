# API Contract: Ticket Transition with Quick-Impl Support

**Endpoint**: `POST /api/projects/:projectId/tickets/:id/transition`
**Feature**: 031-quick-implementation
**Purpose**: Transition ticket between stages with optional quick-impl mode

---

## Request

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | Integer | Yes | Project ID (validated against session user) |
| `id` | Integer | Yes | Ticket ID (must belong to projectId) |

### Request Body

```typescript
{
  targetStage: 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP'
}
```

**Zod Schema** (existing - no changes):
```typescript
import { z } from 'zod';

export const TransitionRequestSchema = z.object({
  targetStage: z.enum(['SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
});
```

### Headers

```
Content-Type: application/json
Cookie: next-auth.session-token=<session>
```

---

## Response

### Success Response (200 OK)

#### Case 1: Automated Stage Transition (SPECIFY, PLAN, BUILD)

```json
{
  "success": true,
  "jobId": 123,
  "message": "Workflow dispatched successfully"
}
```

**Quick-Impl Detection** (internal logic - not exposed in response):
- `currentStage === "INBOX" && targetStage === "BUILD"` → quick-impl mode
- Job created with `command: "quick-impl"`
- Workflow dispatched: `.github/workflows/quick-impl.yml`

#### Case 2: Manual Stage Transition (VERIFY, SHIP)

```json
{
  "success": true,
  "message": "Stage updated (no workflow for VERIFY/SHIP)"
}
```

### Error Responses

#### 400 Bad Request - Invalid Transition

```json
{
  "error": "Invalid stage transition",
  "message": "Cannot transition from INBOX to PLAN. Tickets must progress sequentially through stages.",
  "code": "INVALID_TRANSITION"
}
```

**Updated Validation Logic**:
- INBOX → SPECIFY: ✓ Valid (normal)
- INBOX → BUILD: **✓ Valid (quick-impl, NEW)**
- INBOX → PLAN: ✗ Invalid (skipping SPECIFY)
- INBOX → VERIFY: ✗ Invalid (skipping SPECIFY, PLAN, BUILD)
- SPECIFY → BUILD: ✗ Invalid (skipping PLAN)

#### 400 Bad Request - Job Not Completed

```json
{
  "error": "Cannot transition",
  "message": "Cannot transition: workflow is still running",
  "code": "JOB_NOT_COMPLETED",
  "details": {
    "currentStage": "SPECIFY",
    "targetStage": "PLAN",
    "jobStatus": "RUNNING",
    "jobCommand": "specify"
  }
}
```

**Quick-Impl Exemption**:
- INBOX → BUILD: **Job validation SKIPPED** (no prior job exists)
- All other transitions: Job validation ENFORCED (feature 030-should-not-be)

#### 400 Bad Request - Validation Error

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "issues": [
    {
      "code": "invalid_enum_value",
      "path": ["targetStage"],
      "message": "Invalid enum value. Expected 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP', received 'INVALID'"
    }
  ]
}
```

#### 403 Forbidden - Cross-Project Access

```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

**Scenario**: Ticket exists but belongs to different project than URL parameter

#### 404 Not Found - Ticket Not Found

```json
{
  "error": "Ticket not found"
}
```

#### 404 Not Found - Project Not Found

```json
{
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```

#### 409 Conflict - Version Mismatch

```json
{
  "error": "Conflict: Ticket was modified by another user",
  "currentVersion": 5
}
```

**Scenario**: Optimistic concurrency control detected concurrent modification

#### 500 Internal Server Error - GitHub Dispatch Failed

```json
{
  "error": "GitHub workflow dispatch failed",
  "code": "GITHUB_ERROR"
}
```

---

## Behavior Changes for Quick-Impl

### Detection Logic

```typescript
// lib/workflows/transition.ts (NEW CODE)
const currentStage = ticket.stage;
const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;
```

### Workflow Dispatch

**Normal Mode** (INBOX → SPECIFY, SPECIFY → PLAN, PLAN → BUILD):
```typescript
await octokit.actions.createWorkflowDispatch({
  owner: ticket.project.githubOwner,
  repo: ticket.project.githubRepo,
  workflow_id: 'speckit.yml',
  ref: 'main',
  inputs: {
    ticket_id: ticket.id.toString(),
    command: 'specify', // or 'plan', 'implement'
    branch: ticket.branch || '',
    job_id: job.id.toString(),
  },
});
```

**Quick-Impl Mode** (INBOX → BUILD):
```typescript
await octokit.actions.createWorkflowDispatch({
  owner: ticket.project.githubOwner,
  repo: ticket.project.githubRepo,
  workflow_id: 'quick-impl.yml', // DIFFERENT WORKFLOW
  ref: 'main',
  inputs: {
    ticket_id: ticket.id.toString(),
    command: 'quick-impl',         // DIFFERENT COMMAND
    branch: '',                     // Empty (no branch yet)
    job_id: job.id.toString(),
    ticketTitle: ticket.title,      // QUICK-IMPL SPECIFIC
    ticketDescription: ticket.description, // QUICK-IMPL SPECIFIC
  },
});
```

### Job Creation

**Normal Mode**:
```typescript
const job = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    command: STAGE_COMMAND_MAP[targetStage], // 'specify', 'plan', 'implement'
    status: JobStatus.PENDING,
    startedAt: new Date(),
    updatedAt: new Date(),
  },
});
```

**Quick-Impl Mode**:
```typescript
const job = await prisma.job.create({
  data: {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    command: 'quick-impl', // OVERRIDES 'implement'
    status: JobStatus.PENDING,
    startedAt: new Date(),
    updatedAt: new Date(),
  },
});
```

### Job Validation

**Normal Mode** (SPECIFY → PLAN, PLAN → BUILD, BUILD → VERIFY):
```typescript
if (shouldValidateJobCompletion(currentStage)) {
  const jobValidation = await validateJobCompletion(ticket, targetStage);
  if (!jobValidation.success) {
    return jobValidation; // 400 error
  }
}
```

**Quick-Impl Mode** (INBOX → BUILD):
```typescript
// Skip validation - INBOX has no prior jobs
if (!isQuickImpl && shouldValidateJobCompletion(currentStage)) {
  // Validation logic...
}
```

---

## Database Effects

### Ticket Update

```typescript
await prisma.ticket.update({
  where: {
    id: ticketId,
    version: currentTicket.version, // Optimistic concurrency
  },
  data: {
    stage: 'BUILD', // Updated from INBOX
    version: { increment: 1 }, // Version 1 → 2
  },
});
```

**Fields NOT Updated**:
- `branch`: Remains `null` (set by GitHub workflow via `/branch` endpoint)
- `title`, `description`: Unchanged
- `autoMode`, `clarificationPolicy`: Unchanged

### Job Creation

```sql
INSERT INTO Job (ticketId, projectId, command, status, startedAt, updatedAt)
VALUES (123, 1, 'quick-impl', 'PENDING', NOW(), NOW());
```

---

## Test Cases

### Success Cases

#### Test 1: INBOX → BUILD Quick-Impl

**Request**:
```bash
POST /api/projects/1/tickets/123/transition
{
  "targetStage": "BUILD"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "jobId": 456,
  "message": "Workflow dispatched successfully"
}
```

**Assertions**:
- Job created with `command: "quick-impl"`
- Ticket stage updated: `INBOX` → `BUILD`
- Ticket version incremented: `1` → `2`
- Workflow dispatched: `.github/workflows/quick-impl.yml`

#### Test 2: INBOX → SPECIFY Normal

**Request**:
```bash
POST /api/projects/1/tickets/123/transition
{
  "targetStage": "SPECIFY"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "jobId": 789,
  "message": "Workflow dispatched successfully"
}
```

**Assertions**:
- Job created with `command: "specify"`
- Workflow dispatched: `.github/workflows/speckit.yml`

---

### Error Cases

#### Test 3: INBOX → PLAN Invalid Transition

**Request**:
```bash
POST /api/projects/1/tickets/123/transition
{
  "targetStage": "PLAN"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Invalid stage transition",
  "message": "Cannot transition from INBOX to PLAN. Tickets must progress sequentially through stages.",
  "code": "INVALID_TRANSITION"
}
```

**Assertions**:
- No job created
- Ticket stage unchanged
- Version not incremented

#### Test 4: SPECIFY → BUILD Job Not Completed

**Request**:
```bash
POST /api/projects/1/tickets/123/transition
{
  "targetStage": "PLAN"
}
```

**Precondition**: Ticket in SPECIFY stage with PENDING job

**Response** (400 Bad Request):
```json
{
  "error": "Cannot transition",
  "message": "Cannot transition: workflow is still running",
  "code": "JOB_NOT_COMPLETED",
  "details": {
    "currentStage": "SPECIFY",
    "targetStage": "PLAN",
    "jobStatus": "PENDING",
    "jobCommand": "specify"
  }
}
```

**Assertions**:
- Transition blocked by job validation (feature 030-should-not-be)
- Quick-impl is NOT subject to this validation (INBOX has no prior jobs)

---

## Implementation Checklist

### Backend Changes

- [ ] Modify `lib/workflows/transition.ts`:
  - [ ] Add `isQuickImpl` detection logic (line ~180)
  - [ ] Override command for quick-impl: `command = isQuickImpl ? 'quick-impl' : STAGE_COMMAND_MAP[targetStage]`
  - [ ] Override workflow file: `workflow_id = isQuickImpl ? 'quick-impl.yml' : 'speckit.yml'`
  - [ ] Skip job validation for quick-impl: `if (!isQuickImpl && shouldValidateJobCompletion(...))`
  - [ ] Add quick-impl specific workflow inputs: `ticketTitle`, `ticketDescription`

- [ ] Modify `lib/stage-validation.ts`:
  - [ ] Add INBOX → BUILD special case in `isValidTransition()`

- [ ] API endpoint `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`:
  - [ ] NO CHANGES NEEDED (transparent to quick-impl mode)

### Test Coverage

- [ ] Extend `tests/api/ticket-transition.spec.ts`:
  - [ ] Add test: "should transition ticket from INBOX to BUILD via quick-impl"
  - [ ] Add test: "should allow INBOX→BUILD transition without job validation"
  - [ ] Modify test: "should reject invalid transition (skipping stages)" to allow INBOX → BUILD

- [ ] Create `tests/unit/stage-validation.spec.ts`:
  - [ ] Add test: "allows INBOX → BUILD (quick-impl)"
  - [ ] Add test: "rejects SPECIFY → BUILD (skipping PLAN)"

---

## API Contract Complete

**Status**: ✅ Fully documented
**Breaking Changes**: NONE (additive only)
**Backwards Compatible**: YES (existing transitions unchanged)
