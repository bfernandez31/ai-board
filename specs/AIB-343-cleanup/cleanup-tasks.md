# Cleanup Tasks

**Branch**: `AIB-343-cleanup`
**Created**: 2026-03-23
**Merge Point**: 2c38bf0a6aa9cee55f0ed23c5b0643fb0e8b089b (798 commits, 1263 files)

## Discovery
- [x] T001: Merge point received from workflow
- [x] T002: Analyze diff since last cleanup (798 commits, 1263 files changed)

## Analysis
- [x] T003: Dead code detection — 40+ unused exports across lib/, app/lib/, components/
- [x] T004: Project impact assessment — README.md violates constitution §VI
- [x] T005: Spec synchronization check — 4 CLAUDE.md inaccuracies found and fixed

## Temporary File Cleanup
- [x] T005.1: Delete README.md (constitution violation: no README at project root)
- [x] T005.2: No debug documentation or one-shot scripts found (docs/troubleshooting/ already cleaned)

## Fixes
- [x] T006: Fix CLAUDE.md inaccuracies (Recharts 2.x→3.x, auth helpers path, previewUrl/deploymentUrl docs, notification polling)
- [x] T007: Remove dead exports from lib/comparison/ (9 unused functions)
- [x] T008: Remove dead exports from app/lib/types/mention.ts (10 unused types/interfaces)
- [x] T009: Remove dead exports from app/lib/schemas/ (project.ts deleted, ticket.ts & documentation.ts trimmed)
- [x] T010: Remove dead exports from lib/db/ (push-subscriptions, users, subscriptions, projects, tokens)
- [x] T011: Un-export getAllowedDocTypes in components/ticket/edit-permission-guard.tsx (internal use only)
- [x] T012: Remove dead exports from lib/ misc (isTerminalStage, clearCleanupLock, getCleanupLockDetails, clearRateLimit, getRateLimitHeaders)
- [x] T013: Remove unused hook useProjectTickets from app/lib/hooks/queries/useTickets.ts

## Validation
- [x] T099: Run unit tests — 86 files, 1118 tests passed
- [x] T100: Type check — passed (verified on every commit)
- [x] T101: Lint — passed (verified on every commit)
