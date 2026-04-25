# Implementation Summary: Track Per-Turn Context Size On Jobs To Analyze Context Rot Impact On Quality

**Branch**: `AIB-734-track-per-turn` | **Date**: 2026-04-25
**Spec**: [spec.md](spec.md)

## Changes Summary

Added nullable job context telemetry fields and migration, persisted per-turn peak/average/turn-count metrics during OTLP ingestion, exposed derived context risk bands on ticket jobs, and expanded project analytics with command/workflow/quality filters plus peak-distribution and quality-bucket context charts. Missing or unsupported context telemetry stays null-safe with explicit empty-slice messaging.

## Key Decisions

Stored context metrics directly on `Job`; derived risk bands and quality buckets from one shared helper; treated quality-bucket filtering as a context-analytics slice rather than a global dashboard filter; kept unsupported or historical jobs visually neutral and excluded from context comparisons instead of backfilling or coercing zeros.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/20260425061544_add_job_context_metrics/`, `lib/telemetry/otlp-processor.ts`, `lib/analytics/{context-metrics,queries,types}.ts`, `app/api/projects/[projectId]/{analytics,tickets/[id]/jobs}/route.ts`, `components/analytics/{analytics-dashboard,context-peak-distribution-chart,context-quality-bucket-chart,empty-state}.tsx`, `components/ticket/jobs-timeline.tsx`, related tests, `package.json`, `next.config.ts`, `.env.test`.

## ⚠️ Manual Requirements

None
