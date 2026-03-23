# Cleanup Tasks

**Branch**: `AIB-343-cleanup`
**Created**: 2026-03-23
**Merge Point**: 2c38bf0a6aa9cee55f0ed23c5b0643fb0e8b089b (798 commits, 1263 files)

## Discovery
- [x] T001: Merge point received from workflow
- [x] T002: Analyze diff since last cleanup (798 commits, 1263 files changed)

## Analysis
- [x] T003: Dead code detection — 23+ unused exports in lib/, app/lib/, components/
- [x] T004: Project impact assessment — README.md violates constitution
- [x] T005: Spec synchronization check — 4 CLAUDE.md inaccuracies found

## Temporary File Cleanup
- [ ] T005.1: Delete README.md (constitution violation: no README at project root)

## Fixes
- [ ] T006: Fix CLAUDE.md inaccuracies (Recharts version, auth helpers path, previewUrl docs, notification polling)
- [ ] T007: Remove dead exports from lib/comparison/ (compareMetrics, generateMetricsSummary, extractMetricsFromMerge, compareMultipleSpecs, calculateAverageAlignment, isComparisonMeaningful, parseReportFilename, validateCrossProjectReferences, validateSameProjectTickets)
- [ ] T008: Remove dead exports from app/lib/types/mention.ts (10 unused types/interfaces)
- [ ] T009: Remove dead exports from app/lib/schemas/ (ticket.ts, project.ts, documentation.ts)
- [ ] T010: Remove dead exports from lib/db/ (push-subscriptions, users, subscriptions, projects, tokens)
- [ ] T011: Remove unused export getAllowedDocTypes from components/ticket/edit-permission-guard.tsx
- [ ] T012: Remove dead exports from lib/ misc (isTerminalStage, clearCleanupLock, getCleanupLockDetails, clearRateLimit, getRateLimitHeaders)
- [ ] T013: Remove unused hook useProjectTickets from app/lib/hooks/queries/useTickets.ts

## Validation
- [ ] T099: Run impacted tests
- [ ] T100: Type check
- [ ] T101: Final review
