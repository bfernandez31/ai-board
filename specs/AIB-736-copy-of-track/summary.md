# Implementation Summary: Track Per-Turn Context Size on Jobs

**Branch**: `AIB-736-copy-of-track` | **Date**: 2026-04-24
**Spec**: [spec.md](spec.md)

## Changes Summary

Added per-turn context metrics tracking: peakContextTokens, avgContextTokens, turnCount as nullable Int columns on Job. Extended OTLP processor to compute these from Claude (input_tokens per api_request) and Codex (input_token_count per response.completed) events with multi-batch merge. Added context-health pill on job timeline (green/yellow/red based on 50K/100K thresholds), expanded detail metrics section, analytics distribution bar chart gated behind advancedAnalytics, and quality-score/context-size bucket helpers.

## Key Decisions

Used totalInputTokens (before subtracting cached) for Codex context tracking since cached tokens still occupy context window space. Left Gemini/Mistral jobs with null context fields (no reliable per-turn deltas). Context health chart colors follow existing chart-1/2/3 CSS variables mapped to health tiers. Analytics query filters by command, workflowType, and qualityBucket server-side.

## Files Modified

- `prisma/schema.prisma` + migration: 3 nullable Int columns
- `lib/telemetry/otlp-processor.ts`: TelemetryMetrics extension, Claude/Codex per-turn tracking, merge logic
- `lib/types/job-types.ts`: TicketJobWithTelemetry extension
- `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`: select clause
- `lib/analytics/aggregations.ts`: getContextHealthTier, getContextSizeBucket, getQualityScoreBucket
- `lib/analytics/types.ts`: ContextBucket, ContextHealthAnalytics
- `lib/analytics/queries.ts`: getContextHealthAnalytics
- `components/ticket/jobs-timeline.tsx`: health pill + detail grid
- `components/analytics/context-health-chart.tsx` (new): distribution bar chart
- `components/analytics/analytics-dashboard.tsx`: chart integration

## ⚠️ Manual Requirements

None
