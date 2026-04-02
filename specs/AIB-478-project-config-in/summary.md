# Implementation Summary: Project Config in DB + Dynamic Workflow Dispatch

**Branch**: `AIB-478-project-config-in` | **Date**: 2026-04-02
**Spec**: [spec.md](spec.md)

## Changes Summary

Stored per-project `.ai-board/config.yml` as JSON in the database (`config` + `configSyncedAt` fields on Project model). Replaced hardcoded service inputs with dynamic config-based mapping. Added config sync API endpoint, auto-refresh before dispatch (1h staleness), ConfigCard in project settings, auto-import on project creation, and centralized ORM setup in setup-environment.sh (removing hardcoded Prisma steps from 4 workflow YAML files).

## Key Decisions

Used optimistic locking (Prisma `updateMany` with `configSyncedAt` condition) for concurrent sync safety. Stripped `env` section before DB storage for security. Made config auto-import fire-and-forget so project creation never fails on config issues. Package manager is NOT a dispatch input — setup-environment.sh reads it directly from config.yml.

## Files Modified

- `prisma/schema.prisma` — Added `config Json?` + `configSyncedAt DateTime?` to Project
- `lib/config-sync.ts` — NEW: GitHub fetch, validate, store with optimistic locking
- `lib/workflows/service-inputs.ts` — Dynamic config→service-input mapping
- `lib/workflows/transition.ts` — Staleness check + auto-refresh before dispatch
- `lib/health/scan-dispatch.ts` — Project-aware service inputs + staleness check
- `app/lib/workflows/dispatch-ai-board.ts` — Service inputs in AI-board dispatch
- `app/api/projects/[projectId]/config/sync/route.ts` — NEW: sync endpoint
- `components/settings/config-card.tsx` — NEW: read-only config display + sync button
- `.github/scripts/setup-environment.sh` — Centralized ORM setup
- 4 workflow YAML files — Removed hardcoded Prisma steps

## ⚠️ Manual Requirements

None
