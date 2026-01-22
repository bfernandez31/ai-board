# Data Model: /review Command

**Date**: 2026-01-22
**Branch**: AIB-178-review-command-from

## Overview

The /review command does NOT introduce new data entities. It reuses existing models:

- **Job** - Tracks workflow execution (existing)
- **Comment** - Stores AI-BOARD responses (existing)

## Existing Entities Used

### Job (No Changes)

The /review command creates a job with command `comment-verify` via the existing ai-board-assist workflow dispatch.

```prisma
model Job {
  id          Int        @id @default(autoincrement())
  ticketId    Int
  projectId   Int
  status      JobStatus  @default(PENDING)
  command     String     // "comment-verify" for /review
  branch      String?
  startedAt   DateTime?
  completedAt DateTime?
  updatedAt   DateTime   @updatedAt
  // ... relations
}
```

**Command Format**: `comment-verify` (same as other ai-board-assist commands in VERIFY stage)

### Comment (No Changes)

Response posted using existing Comment model with 2000 character limit.

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  userId    String   // "ai-board-system-user" for AI-BOARD responses
  content   String   @db.VarChar(2000)
  // ... timestamps, relations
}
```

## No Schema Migration Required

This feature operates entirely within existing data structures:

1. **Input**: Workflow receives branch, stage, user info via dispatch inputs
2. **Processing**: Uses gh CLI to find PR, invokes /code-review skill
3. **Output**: Posts comment via existing ai-board comment endpoint
4. **Tracking**: Creates Job record via existing job creation flow

## State Transitions

No new state transitions. Standard ai-board-assist flow:

```
User posts @ai-board /review
    ↓
Job created: PENDING → RUNNING
    ↓
Workflow executes /review command
    ↓
Code-review posts to PR
    ↓
Summary posted to ticket comment
    ↓
Job status: COMPLETED (or FAILED)
```
