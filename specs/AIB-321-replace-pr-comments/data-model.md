# Data Model: Review Dimension Replacement for Spec Sync

**Feature**: AIB-321 - Replace PR Comments Dimension with Spec Sync
**Date**: 2026-03-20

## Overview

This feature does not add or remove database tables. It changes the application-level model used to generate and interpret `Job.qualityScoreDetails` for verify jobs.

## Existing Persistent Models

### Job

Source of truth: `prisma/schema.prisma`

Relevant fields:
- `id: Int`
- `projectId: Int`
- `ticketId: Int`
- `command: String`
- `status: JobStatus`
- `qualityScore: Int | null`
- `qualityScoreDetails: String | null`
- `startedAt: DateTime`
- `completedAt: DateTime | null`

Role in this feature:
- Stores the overall review score for completed verify jobs.
- Stores the serialized dimension breakdown and findings metadata for new and historical reviews.

Validation rules:
- `qualityScore` remains an integer from `0` to `100`.
- `qualityScoreDetails` remains a JSON string accepted only when a job transitions to `COMPLETED`.
- No schema migration is required.

### Ticket

Source of truth: `prisma/schema.prisma`

Relevant fields:
- `id: Int`
- `projectId: Int`
- `stage: Stage`
- `workflowType: WorkflowType`
- `branch: String | null`

Role in this feature:
- Parent context for verify jobs whose results are shown in ticket review surfaces and analytics.
- No field changes required.

## Application-Level Entities

### Review Dimension Configuration

Authoritative application model stored in shared TypeScript configuration, not the database.

Fields:
- `agentId: string`
- `name: string`
- `weight: number`
- `affectsOverallScore: boolean`
- `displayOrder: number`

Initial configured values for this feature:

| agentId | name | weight | affectsOverallScore | displayOrder |
|---|---|---:|---|---:|
| `bug-detection` | `Bug Detection` | `0.30` | `true` | 1 |
| `compliance` | `Compliance` | `0.40` | `true` | 2 |
| `code-comments` | `Code Comments` | `0.20` | `true` | 3 |
| `historical-context` | `Historical Context` | `0.10` | `true` | 4 |
| `spec-sync` | `Spec Sync` | `0.00` | `false` | 5 |

Validation rules:
- There must always be five configured dimensions.
- Active dimensions where `affectsOverallScore = true` must sum to `1.00`.
- Zero-weight dimensions remain visible in persisted details and display surfaces.

### Review Result

Serialized into `Job.qualityScoreDetails`.

Fields:
- `version: number`
- `qualityScore: number`
- `threshold: 'Excellent' | 'Good' | 'Fair' | 'Poor'`
- `computedAt: string`
- `dimensions: ReviewDimensionResult[]`

Validation rules:
- `qualityScore` is the rounded weighted sum of only dimensions with `affectsOverallScore = true`.
- `threshold` is derived from `qualityScore`.
- `dimensions` must include a row for all configured dimensions in new reviews.
- Historical rows containing `PR Comments` remain valid and readable.

### Review Dimension Result

Child record inside `Review Result.dimensions`.

Fields:
- `name: string`
- `agentId: string`
- `score: number`
- `weight: number`
- `weightedScore: number`
- `issues?: string[]` or issue-equivalent agent output before final rendering

Validation rules:
- `score` must be an integer from `0` to `100`.
- `weightedScore` equals `score * weight`.
- `Spec Sync` uses `weight = 0.00` and `weightedScore = 0`.
- Historical entries with `agentId = 'pr-comments'` remain parseable.

### Spec Sync Finding

Produced by the review command and represented in the dimension’s findings/issue text.

Fields:
- `type: 'contradiction' | 'coverage-gap'`
- `specFilePath: string`
- `summary: string`
- `evidence: string`

Rules:
- Only spec files under `specs/specifications/` changed in the current PR are eligible.
- If no eligible spec files changed, no findings are produced and `Spec Sync.score = 100`.
- Findings should be limited to clear contradictions or obvious missing coverage tied to changed specs.

## State Transitions

### Verify Job Completion With Quality Score

1. VERIFY workflow runs code review command.
2. Code review command emits `QUALITY_SCORE_JSON`.
3. `verify.yml` parses the overall score and forwards the full JSON string to `PATCH /api/jobs/[id]/status`.
4. API route persists:
   - `qualityScore`
   - `qualityScoreDetails`
5. Ticket review UI and analytics later parse the stored JSON.

### Historical Compatibility

1. Old verify jobs may contain `PR Comments` in `qualityScoreDetails.dimensions`.
2. New verify jobs contain `Spec Sync` instead.
3. Consumers must render whichever dimension rows are stored for a given review.
4. Analytics aggregation currently groups by stored `name`, so mixed historical/new datasets will show separate `PR Comments` and `Spec Sync` rows until intentionally normalized.
5. Shared config should govern new-review generation and preferred display ordering, without invalidating legacy data.

## Derived Rules

- `Compliance` weight increases from `0.30` to `0.40`.
- `Spec Sync` replaces `PR Comments` in the configured dimension set.
- Global quality score and threshold calculations ignore zero-weight dimensions.
- Analytics aggregation continues to average by stored dimension name while preserving new `Spec Sync` visibility.
