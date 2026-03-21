# Quick Implementation: Enrich comparison dialog with operational metrics and quality data

**Feature Branch**: `AIB-334-enrich-comparison-dialog`
**Created**: 2026-03-21
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Enrich the ticket comparison dialog to display operational metrics (tokens consumed, duration, cost, AI model) and quality gate scores alongside the existing code metrics.

## Changes

### Types (`lib/types/comparison.ts`)
- Added `totalTokens`, `jobCount`, `model` to `ComparisonTelemetryEnrichment`
- Added `qualityDetails` to `ComparisonParticipantDetail`

### API (`lib/comparison/comparison-detail.ts`, `lib/comparison/comparison-record.ts`)
- Changed telemetry query from latest-job-only to aggregation across all jobs per ticket
- Added `qualityScoreDetails` fetch from verify jobs for popover breakdown
- Updated `normalizeTelemetryEnrichment` to accept aggregated input with jobCount and model

### UI Components
- **Ranking cards** (`comparison-ranking.tsx`): Added badges for workflow type, agent, quality score
- **Operational Metrics** (`comparison-operational-metrics.tsx`): New section with comparison table for tokens, duration, cost, job count, quality. Best values highlighted. Sticky first column for horizontal scroll support.
- **Quality Popover** (`comparison-quality-popover.tsx`): Click quality score to see dimension breakdown with progress bars
- **Comparison Viewer** (`comparison-viewer.tsx`): Wired up Operational Metrics section between Implementation Metrics and Decision Points

### Tests
- Updated `comparison-ranking.test.tsx` with new badge tests
- Created `comparison-operational-metrics.test.tsx` with 7 tests
- Updated `comparison-dashboard-sections.test.tsx`, `markdown-table-rendering.test.tsx`, `comparison-record.test.ts` fixtures
