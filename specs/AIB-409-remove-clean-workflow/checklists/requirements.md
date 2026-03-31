# Requirements Checklist: AIB-409

**Feature**: Remove Clean Workflow - Merge Cleanup into Health Scan Compliance

## Acceptance Criteria

- [ ] COMPLIANCE scan detects dead code (unused exports, orphaned files) older than 30 days
- [ ] COMPLIANCE scan detects temp/debug files
- [ ] Remediation tickets are created for dead code and temp file issues
- [ ] Clean workflow, API route, command, UI components, and banner are fully removed
- [ ] Transition locking logic (`activeCleanupJobId`) is removed
- [ ] Last Clean passive module is removed from health dashboard
- [ ] Health dashboard displays correctly with 5 modules
- [ ] Global score calculation works without Last Clean
- [ ] No regression on existing health scans (security, compliance, tests, spec sync)
- [ ] Historical CLEAN tickets still display correctly on the board

## Preserved Items (Must NOT Be Removed)

- [ ] `CLEAN` value in `WorkflowType` Prisma enum
- [ ] Purple "Clean" badge rendering in `ticket-card.tsx` for historical tickets
- [ ] `CLEAN` in `workflow-distribution-chart.tsx` for historical analytics
