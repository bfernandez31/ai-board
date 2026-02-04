# Data Model: Full Clone Option for Ticket Duplication

**Feature**: AIB-217-full-clone-option
**Date**: 2026-02-04

## Overview

This feature does NOT require schema changes. It leverages existing `Ticket` and `Job` models with new database operations that copy data between records.

## Existing Entities (No Changes)

### Ticket

The existing Ticket model supports all fields needed for full clone:

| Field | Type | Clone Behavior |
|-------|------|----------------|
| id | Int | Auto-generated (new) |
| title | String | Prefixed with "Clone of " |
| description | String | Copied |
| stage | Stage | **Preserved** (not reset to INBOX) |
| version | Int | Reset to 1 |
| projectId | Int | Copied (same project) |
| ticketNumber | Int | Auto-generated (sequence) |
| ticketKey | String | Auto-generated (`{KEY}-{ticketNumber}`) |
| branch | String? | **New branch created** from source |
| previewUrl | String? | Set to null (new deployment needed) |
| autoMode | Boolean | Reset to false |
| workflowType | WorkflowType | Copied |
| attachments | Json? | Copied |
| clarificationPolicy | ClarificationPolicy? | Copied |
| closedAt | DateTime? | Set to null |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-generated |

### Job

The existing Job model supports all telemetry fields for deep copy:

| Field | Type | Clone Behavior |
|-------|------|----------------|
| id | Int | Auto-generated (new) |
| ticketId | Int | Set to new ticket ID |
| command | String | Copied |
| status | JobStatus | Copied |
| branch | String? | **Updated** to new branch name |
| commitSha | String? | Copied (historical reference) |
| logs | String? | Copied |
| startedAt | DateTime | Copied |
| completedAt | DateTime? | Copied |
| projectId | Int | Copied |
| inputTokens | Int? | Copied |
| outputTokens | Int? | Copied |
| cacheReadTokens | Int? | Copied |
| cacheCreationTokens | Int? | Copied |
| costUsd | Float? | Copied |
| durationMs | Int? | Copied |
| model | String? | Copied |
| toolsUsed | String[] | Copied |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-generated |

## Data Operations

### Full Clone Transaction

```
BEGIN TRANSACTION

1. READ source ticket with project (for key generation)
2. READ all jobs for source ticket
3. GET next ticket number from sequence
4. GET source branch SHA from GitHub API
5. CREATE new GitHub branch from source SHA
6. CREATE new ticket (preserve stage, new branch)
7. CREATE all job copies (new ticketId, update branch)

COMMIT (or ROLLBACK on any failure)
```

### Simple Copy (Existing - Unchanged)

```
1. READ source ticket with project
2. GET next ticket number from sequence
3. CREATE new ticket (stage=INBOX, branch=null, no jobs)
```

## Validation Rules

### Full Clone Eligibility

A ticket is eligible for full clone when:
- `stage` IN ('SPECIFY', 'PLAN', 'BUILD', 'VERIFY')
- `branch` IS NOT NULL (has associated branch)

### Title Prefix

| Operation | Prefix | Max Source Length |
|-----------|--------|-------------------|
| Simple copy | "Copy of " | 92 chars (100 - 8) |
| Full clone | "Clone of " | 91 chars (100 - 9) |

## State Transitions

Full clone does NOT trigger state transitions. The cloned ticket starts at the same stage as the source and can be transitioned independently.

```
Source (BUILD) --full clone--> Clone (BUILD)
                                    |
                                    v
                              Independent lifecycle
```

## Constraints

1. **Referential Integrity**: Cloned jobs reference cloned ticket ID
2. **Uniqueness**: New ticketKey guaranteed unique via sequence
3. **Branch Uniqueness**: New branch name guaranteed unique via ticket number
4. **Transaction Isolation**: All-or-nothing creation (ticket + jobs + branch)

## No Schema Migration Required

This feature operates entirely within existing schema. No `prisma migrate dev` needed.
