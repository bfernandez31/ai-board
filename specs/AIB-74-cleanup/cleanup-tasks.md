# Cleanup Tasks

**Branch**: `AIB-74-cleanup`
**Created**: 2025-11-23

## Discovery
- [x] T001: Find last cleanup merge point (2c38bf0a6aa9cee55f0ed23c5b0643fb0e8b089b)
- [x] T002: Analyze diff since last cleanup (19 files changed)

## Analysis
- [x] T003: Dead code detection (Found 15+ unused exports, 2 orphaned files, duplicate definitions)
- [x] T004: Project impact assessment (Identified high-risk items: transition-lock, BoardProps, type duplication)
- [x] T005: Spec synchronization check (Found 2 doc inconsistencies: job commands, CLAUDE.md)

## Fixes
### Dead Code Removal (Safe)
- [ ] T006: Remove lib/utils/time.ts (unused duplicate of format-timestamp.ts)
- [ ] T007: Remove tests/unit/use-job-status.test.ts.skip (references non-existent modules)
- [ ] T008: Remove lib/schemas/demo-data.ts (unused schema file)
- [ ] T009: Remove currentJob prop from ticket-card.tsx and stage-column.tsx
- [ ] T010: Remove unused type exports from lib/types.ts (CreateTicketResponse, TicketCardProps, ColumnProps, UpdateStageRequest, UpdateStageResponse, StageConflictError)
- [ ] T011: Remove unused exports from lib/optimistic-updates.ts (confirmTicketUpdate)
- [ ] T012: Remove unused export from lib/stage-transitions.ts (isTerminalStage)

### Documentation Updates
- [ ] T013: Update data-model.md job command list (remove task/clarify, add verify and comment-* commands)
- [ ] T014: Update CLAUDE.md job commands section (add verify, expand comment-* notation)

## Validation
- [ ] T099: Run tests
- [ ] T100: Type check
- [ ] T101: Final review
