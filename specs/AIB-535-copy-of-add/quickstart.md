# Quickstart: Add SKIPPED Status for Health Scans

## What This Feature Does

Adds a `SKIPPED` status to health scans so that when a scan agent detects there's nothing to evaluate (e.g., no PRs to review, no changed files to scan), it can exit early with a clear status instead of producing a misleading score of 100.

## Implementation Order

### Layer 1: Database (no dependencies)
1. Add `SKIPPED` to `HealthScanStatus` enum in `prisma/schema.prisma`
2. Run `bunx prisma migrate dev --name add-health-scan-skipped-status`
3. Run `bunx prisma generate`

### Layer 2: API (depends on Layer 1)
4. Update status update endpoint to accept `SKIPPED` status
5. Add validation: SKIPPED requires null score, skip HealthScore aggregate update
6. Update health GET endpoint to surface SKIPPED status and skip reason

### Layer 3: TypeScript Types (depends on Layer 2)
7. Update `HealthModuleStatus` interface with `skipReason` field
8. No changes needed to score calculator (already handles nulls)

### Layer 4: UI (depends on Layer 3)
9. Add `'skipped'` card state to `health-module-card.tsx`
10. Show "N/A" score badge and skip reason text for SKIPPED modules

### Layer 5: Workflow (depends on Layer 2)
11. Update `health-scan.yml` to check `skipped` field in result file
12. Add defensive guard: ignore `skipped` for COMPLIANCE and TESTS types
13. Send SKIPPED status to API when appropriate

### Layer 6: Agent Commands (independent)
14. Update REVIEW_QUALITY agent to detect 0 PRs and exit with `skipped: true`
15. Update SECURITY agent to detect 0 changed files and exit with `skipped: true`
16. Update SPEC_SYNC agent to detect 0 spec files and exit with `skipped: true`

## Key Design Decisions

- **HealthScore NOT updated on SKIPPED**: Preserves last meaningful score
- **Trends exclude SKIPPED**: Already handled by existing `status: 'COMPLETED'` filter
- **COMPLIANCE/TESTS never skip**: Defensive guard in workflow, not just agent convention
- **Backward compatible**: Old agents without `skipped` field behave identically

## Verification

```bash
bun run type-check          # TypeScript compiles
bun run lint                # No lint errors
bun run test:unit           # Unit tests pass
bun run test:integration    # Integration tests pass (health endpoints)
```
