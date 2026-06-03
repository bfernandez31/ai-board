# Implementation Summary: Feature Specification: Token saving via RTK + unified per-ticket Run settings

**Branch**: `AIB-848-token-saving-via` | **Date**: 2026-06-03
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented project and ticket token-saving settings, run-captured job telemetry, fail-open RTK activation for Claude core workflows, a unified Run settings dialog, cloned-ticket telemetry preservation, and job/timeline reporting without savings estimates.

## Key Decisions

Token saving is resolved at job creation and preserved as point-in-time telemetry. Workflow activation is Claude/core-command only and fails open with fallback status reporting. Per-ticket overrides share existing INBOX editability rules and are managed alongside agent, model, and policy settings.

## Files Modified

Prisma schema/migration; workflow dispatch and runner files; project/ticket/job API routes; `lib/db` ticket/project helpers; token-saving resolver/types/validation; settings card, Run settings dialog, ticket modal, stats/timeline; focused unit/integration tests; task and summary specs.

## ⚠️ Manual Requirements

None
