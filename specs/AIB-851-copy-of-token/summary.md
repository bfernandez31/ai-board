# Implementation Summary: Token Saving via RTK + Unified Per-Ticket Run Settings

**Branch**: `AIB-851-copy-of-token` | **Date**: 2026-06-04
**Spec**: [spec.md](spec.md)

## Changes Summary

Added project-level and per-ticket token saving settings with nullable override pattern (ticket > project > OFF). Created unified "Run settings" dialog replacing 3 separate dialogs, reducing kebab menu from 5 to 3 items. Workflow dispatch passes token_saving flag to all Claude workflow files. run-agent.sh activates RTK with graceful fallback. Job telemetry displays tokenSavingStatus. TokenSavingBadge shows in header strip when effective setting is ON.

## Key Decisions

Used existing nullable override pattern (same as clarificationPolicy/agent) for consistency. RunSettingsDialog composes existing dialog components via sub-dialogs rather than reimplementing their logic. RTK activation reports status via best-effort PATCH to job API on RUNNING status. Token saving is editable at any stage (not locked to INBOX like policy/agent) per spec decision.

## Files Modified

prisma/schema.prisma, lib/workflows/transition.ts, lib/validations/ticket.ts, lib/db/tickets.ts, lib/db/projects.ts, app/lib/schemas/clarification-policy.ts, app/lib/job-update-validator.ts, app/api/jobs/[id]/status/route.ts, app/api/projects/[projectId]/route.ts, app/api/projects/[projectId]/tickets/[id]/route.ts, app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts, components/settings/token-saving-card.tsx (new), components/tickets/run-settings-dialog.tsx (new), components/ui/token-saving-badge.tsx (new), components/board/ticket-detail-modal.tsx, components/ticket/jobs-timeline.tsx, .github/workflows/*.yml, .github/scripts/run-agent.sh

## Manual Requirements

None
