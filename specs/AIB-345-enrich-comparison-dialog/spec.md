# Quick Implementation: Enrich comparison dialog with operational metrics and quality data

**Feature Branch**: `AIB-345-enrich-comparison-dialog`
**Created**: 2026-03-26
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Enriched the ticket comparison dialog to display operational metrics (tokens consumed, duration, cost, AI model) and quality gate scores alongside the existing code metrics.

## Changes

### Types (`lib/types/comparison.ts`)
- Extended `ComparisonTelemetryEnrichment` with `totalTokens`, `jobCount`, and `model` fields
- Added `QualityScoreDimension` and `QualityScoreBreakdown` types for quality detail popover
- Added `qualityDetails` field to `ComparisonParticipantDetail`

### Backend (`lib/comparison/comparison-detail.ts`)
- Changed job telemetry from latest-job-only to aggregating ALL completed jobs per participant
- Added `qualityScoreDetails` to verify job query for breakdown popover data
- Added `parseQualityScoreDetails()` to parse stored JSON dimension scores
- Added `aggregateJobsForTicket()` to sum tokens, cost, duration across all jobs and determine primary model

### Backend (`lib/comparison/comparison-record.ts`)
- Updated `normalizeTelemetryEnrichment()` to accept aggregated data shape with jobCount and model
- Updated `normalizeParticipantDetail()` to pass through `qualityDetails`

### UI Components
- **`comparison-ranking.tsx`** (FR-1): Added workflow type, agent, and quality score badges to each participant card
- **`comparison-operational-metrics.tsx`** (FR-2, FR-4): New component with comparison table for total tokens, input/output tokens, duration, cost, job count, and quality. Sticky metric labels column for horizontal scroll. Best-value highlighting per row.
- **`comparison-quality-popover.tsx`** (FR-3): Clickable quality score opens popover showing 5 dimension scores with progress bars, weights, and threshold label
- **`comparison-viewer.tsx`** (FR-5): Added Operational Metrics section between Implementation Metrics and Decision Points
