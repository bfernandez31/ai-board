# Quick Implementation: Automatic Quality Score via Code Review

**Feature Branch**: `AIB-305-automatic-quality-score`
**Created**: 2026-03-17
**Mode**: Quick Implementation

## Description

Extend the existing code review system so each review agent returns a dimension score (0-100) alongside its issues. A weighted final score is computed and stored on the verify job.

## Implementation Summary

### Database
- Added `qualityScore Int?` field to Job model (nullable, only for VERIFY jobs)
- Migration: `add_quality_score`

### Code Review Command
- Updated 5 review agents to each return a dimension score (0-100)
- Added step 9: writes `quality-score.json` with structured scoring output
- Dimensions: Bug Detection (30%), Compliance (30%), Code Comments (20%), Historical Context (10%), PR Comments (10%)

### Verify Workflow
- Added "Parse Quality Score" step to read `quality-score.json`
- Updated "Update Job Status - Success" to include `qualityScore` in PATCH payload
- Only for FULL workflow (skipped for QUICK/CLEAN)

### Job Status API
- Extended `jobStatusUpdateSchema` to accept optional `qualityScore` (0-100 integer)
- PATCH `/api/jobs/:id/status` now persists quality score

### UI - Ticket Card
- Added colored `QualityScoreBadge` (compact mode) next to workflow/agent badges
- Quality score sourced from latest COMPLETED verify job via `getLatestQualityScore()`

### UI - Ticket Detail Stats Tab
- Added quality score card with `Award` icon at top of stats
- Shows full badge with tier label (Excellent/Good/Fair/Poor)

### UI - Analytics Dashboard
- Added `avgQualityScore` to `OverviewMetrics` (6th overview card)
- Added `QualityScoreChart` (area chart with reference lines at 70/90)
- Added `qualityOverTime` data to analytics API response

### Thresholds
- Excellent: 90+ (green)
- Good: 70-89 (blue)
- Fair: 50-69 (amber)
- Poor: <50 (red)
