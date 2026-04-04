# Quickstart: Add SKIPPED Status for Health Scans

## Prerequisites

- Bun installed, `bun install` completed
- PostgreSQL running with database seeded (`bunx prisma migrate dev`)

## Implementation Order

### 1. Database Layer (5 min)
```bash
# Add SKIPPED to HealthScanStatus enum in prisma/schema.prisma
# Then generate migration:
bunx prisma migrate dev --name add_skipped_health_scan_status
bunx prisma generate
```

### 2. API Layer — Status PATCH Endpoint
Modify `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`:
- Add `'SKIPPED'` to Zod status enum
- Add SKIPPED to `VALID_TRANSITIONS` for PENDING and RUNNING
- Add SKIPPED as terminal (empty array)
- Add validation: reject score when status is SKIPPED
- Skip HealthScore upsert when status is SKIPPED

### 3. API Layer — Health GET Endpoint
Modify `app/api/projects/[projectId]/health/route.ts`:
- Update `latestScans` query to include SKIPPED status
- Update `buildModuleStatus()` to handle SKIPPED scan status

### 4. UI Layer — Module Card
Modify `components/health/health-module-card.tsx`:
- Add `skipped` to `CardState` type
- Add SKIPPED detection in `getCardState()`
- Add "Skipped" badge in `ScoreBadge`
- Add "N/A" display for skipped modules

### 5. UI Layer — Drawer
Modify `components/health/drawer/drawer-states.tsx`:
- Add `skipped` state with "Nothing to evaluate" message

Modify `components/health/drawer/drawer-history.tsx`:
- Add SKIPPED badge rendering in `HistoryEntry`

### 6. Workflow Layer
Modify `.github/workflows/health-scan.yml`:
- Update the "Update Status" step to check result file for SKIPPED indicator
- Send `status: SKIPPED` to the PATCH endpoint when applicable

### 7. Tests
```bash
# Run existing tests to confirm no regressions
bun run test:unit
bun run test:integration

# Run new tests
bun run test:integration tests/integration/health/health-scan-skipped.test.ts
bun run test:unit tests/unit/components/health-module-card.test.tsx
```

## Verification Checklist

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] SKIPPED scan does not update HealthScore
- [ ] Dashboard shows distinct treatment for SKIPPED modules
- [ ] Trend charts exclude SKIPPED data points
- [ ] Scan history includes SKIPPED entries with "Nothing to evaluate"
