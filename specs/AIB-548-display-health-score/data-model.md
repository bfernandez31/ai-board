# Data Model: Display health score heart indicator on project cards

## Overview

This feature does not introduce new database tables or columns. It adds a read-only projection over the existing `Project` and `HealthScore` models so the projects list can render a compact health summary for each project card.

## Existing Persisted Entities

### Project

Source: `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`

Relevant fields:
- `id`
- `name`
- `githubOwner`
- `githubRepo`
- `deploymentUrl`
- `updatedAt`
- `tickets`
- `healthScore`

Relevant relationship:
- One-to-one optional relation to `HealthScore` through `Project.healthScore`

### HealthScore

Source: `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`

Relevant fields:
- `projectId`
- `globalScore`
- `securityScore`
- `complianceScore`
- `testsScore`
- `specSyncScore`
- `qualityGate`
- `reviewQualityScore`
- `lastSecurityScan`
- `lastComplianceScan`
- `lastTestsScan`
- `lastSpecSyncScan`
- `lastReviewQualityScan`

Validation and semantic rules already established in existing code:
- `null` means no completed score is available for that metric.
- `globalScore` is a whole number `0-100` or `null`.
- Score bands are derived by `/home/runner/work/ai-board/ai-board/target/lib/quality-score.ts`.
- The runtime health endpoint currently derives `qualityGate` live from verify jobs rather than trusting the stored `qualityGate` column.

## New Read-Only Projection Types

### ProjectHealthSummary

Purpose:
- Compact, card-safe representation of project health attached to the projects list response.

Fields:
- `globalScore: number | null`
- `label: "Excellent" | "Good" | "Fair" | "Poor" | "No data yet"`
- `color: { text: string; bg: string; fill: string }`
- `subScores: ProjectHealthSubScores`

Rules:
- Derived from the existing `HealthScore` row for active modules plus a current Quality Gate aggregate for the same project.
- If no `HealthScore` exists, `globalScore` is `null`, `label` is `"No data yet"`, muted colors are used, and all sub-scores are `null`.
- `globalScore` should be recomputed from the projected sub-scores instead of copied blindly from `HealthScore.globalScore`.

### ProjectHealthSubScores

Fields:
- `security: number | null`
- `compliance: number | null`
- `tests: number | null`
- `specSync: number | null`
- `qualityGate: number | null`
- `reviewQuality: number | null`

Rules:
- `security`, `compliance`, `tests`, `specSync`, and `reviewQuality` map from the persisted `HealthScore` row.
- `qualityGate` comes from the existing Quality Gate aggregation logic over verify jobs.
- `null` must render as `—` in the popover instead of an inferred numeric value.

### ProjectWithCount

Existing type to extend in `/home/runner/work/ai-board/ai-board/target/app/lib/types/project.ts`.

New field:
- `healthSummary: ProjectHealthSummary`

## UI-State Model

### Indicator States

1. Scored state
   - Trigger: `healthSummary.globalScore !== null`
   - Display: numeric score inside heart indicator, score-band styling, accessible label announcing score and threshold

2. No-data state
   - Trigger: `healthSummary.globalScore === null`
   - Display: muted heart with `—`, accessible label announcing `"Project health score: no data yet"`

### Popover Rows

Fixed row order:
1. Security
2. Compliance
3. Tests
4. Spec Sync
5. Quality Gate
6. Review Quality

Per-row rules:
- Numeric value uses the canonical score-band styling for `0-100`.
- Missing value renders `—` with muted styling.
- Rows are informational only and do not expose actions or links.

## State Transitions

There are no new persisted transitions for this feature. Card state changes are a direct reflection of the latest `HealthScore` values already maintained by the health scan workflows and related APIs.
