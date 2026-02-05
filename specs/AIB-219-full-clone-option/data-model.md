# Data Model: Full Clone Option

**Feature**: AIB-219 Full Clone Option for Ticket Duplication
**Date**: 2026-02-05

## Entities

### Ticket (Existing - No Schema Changes)

The full clone feature uses the existing Ticket model without modifications.

| Field | Type | Notes for Full Clone |
|-------|------|---------------------|
| id | Int | Auto-generated for cloned ticket |
| ticketNumber | Int | New sequence number from project |
| ticketKey | String | New key: `{PROJECT_KEY}-{ticketNumber}` |
| title | String | Prefixed with "Clone of " |
| description | String | Copied from source |
| stage | Stage | **Preserved** from source (not reset to INBOX) |
| version | Int | Reset to 1 |
| projectId | Int | Same as source |
| branch | String? | **New branch** created from source |
| previewUrl | String? | Set to null |
| autoMode | Boolean | Copied from source |
| workflowType | WorkflowType | Copied from source |
| attachments | Json? | Copied from source |
| clarificationPolicy | ClarificationPolicy? | Copied from source |

### Job (Existing - No Schema Changes)

All jobs are copied with complete telemetry data.

| Field | Type | Notes for Full Clone |
|-------|------|---------------------|
| id | Int | Auto-generated for each copied job |
| ticketId | Int | References **new** ticket ID |
| projectId | Int | Same as source |
| command | String | Copied from source |
| status | JobStatus | Copied from source (point-in-time snapshot) |
| branch | String? | Updated to **new branch name** |
| commitSha | String? | Copied from source |
| logs | String? | Copied from source |
| startedAt | DateTime | Copied from source |
| completedAt | DateTime? | Copied from source |
| inputTokens | Int? | Copied from source |
| outputTokens | Int? | Copied from source |
| cacheReadTokens | Int? | Copied from source |
| cacheCreationTokens | Int? | Copied from source |
| costUsd | Float? | Copied from source |
| durationMs | Int? | Copied from source |
| model | String? | Copied from source |
| toolsUsed | String[] | Copied from source |

## State Transitions

### Clone Mode Selection

```
┌─────────────────────────────────────────────────────────────┐
│                    Duplicate Dropdown                        │
├─────────────────────────────────────────────────────────────┤
│  Ticket Stage         │  Available Options                   │
├───────────────────────┼─────────────────────────────────────┤
│  INBOX                │  Simple copy only                    │
│  SPECIFY              │  Simple copy, Full clone             │
│  PLAN                 │  Simple copy, Full clone             │
│  BUILD                │  Simple copy, Full clone             │
│  VERIFY               │  Simple copy, Full clone             │
│  SHIP                 │  Simple copy only                    │
└───────────────────────┴─────────────────────────────────────┘
```

### Full Clone Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User clicks │────▶│  API creates │────▶│  API copies  │
│  Full Clone  │     │  new branch  │     │  ticket+jobs │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │                    │
        │                    ▼                    │
        │           ┌──────────────┐              │
        │           │ GitHub API   │              │
        │           │ createRef()  │              │
        │           └──────────────┘              │
        │                    │                    │
        │                    ▼                    │
        │           ┌──────────────┐              │
        │           │ Success/Fail │              │
        │           └──────────────┘              │
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────┐
│                    Transaction Block                      │
│  1. Create ticket with new ticketKey, branch, stage      │
│  2. Copy all jobs with new ticketId, updated branch      │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
                ┌──────────────┐
                │ Return new   │
                │ ticket to UI │
                └──────────────┘
```

## Validation Rules

### Full Clone Preconditions

| Rule | Validation | Error Message |
|------|------------|---------------|
| Source has branch | `sourceTicket.branch !== null` | "Source ticket has no branch" |
| Branch exists on GitHub | `octokit.repos.getBranch()` succeeds | "Source branch not found on GitHub" |
| Valid stage | Stage in [SPECIFY, PLAN, BUILD, VERIFY] | N/A (UI hides option) |

### Title Prefix Rules

| Mode | Prefix | Max Source Length |
|------|--------|-------------------|
| Simple copy | "Copy of " | 92 chars (100 - 8) |
| Full clone | "Clone of " | 91 chars (100 - 9) |

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                        Project                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Source Ticket                         │ │
│  │  stage: PLAN                                             │ │
│  │  branch: "087-feature-name"                              │ │
│  │  ┌───────────────────────────────────────────────────────┤ │
│  │  │ Job 1  │ Job 2  │ Job 3  │ (with telemetry)          │ │
│  │  └───────────────────────────────────────────────────────┘ │
│  └─────────────────────────────────────────────────────────┘ │
│                            │                                  │
│                     Full Clone                                │
│                            ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Cloned Ticket                         │ │
│  │  stage: PLAN (preserved)                                 │ │
│  │  branch: "219-feature-name" (new)                        │ │
│  │  ┌───────────────────────────────────────────────────────┤ │
│  │  │ Job 1' │ Job 2' │ Job 3' │ (copied with telemetry)   │ │
│  │  └───────────────────────────────────────────────────────┘ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## No Schema Migration Required

This feature uses existing Prisma models. No database migration needed.
