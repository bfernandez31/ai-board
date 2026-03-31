# Quickstart: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-412-copy-of-copy`

## Prerequisites

- Node.js 22.20.0, Bun runtime
- PostgreSQL 14+ with existing `HealthScan` data (no migrations needed)
- All dependencies already in `package.json` (Recharts, TanStack Query, lucide-react, shadcn/ui)

## Getting Started

```bash
git checkout AIB-412-copy-of-copy
bun install
bun run dev
```

## Key Implementation Entry Points

1. **Start with Phase 1** — API changes are prerequisites for everything else:
   - Add `tokensUsed`, `costUsd` to scan history select: `app/api/projects/[projectId]/health/scans/route.ts`
   - Create trends endpoint: `app/api/projects/[projectId]/health/trends/route.ts`

2. **Phase 3 can run in parallel** with Phase 2 — shared UI components have no API dependencies

3. **Phase 5 is the integration layer** — wire everything together in the dashboard

## Verification

```bash
bun run type-check          # Verify TypeScript types
bun run lint                # Verify code quality
bun run test:unit           # Run unit tests (formatting, sparkline, history icons)
bun run test:integration    # Run integration tests (trends endpoint, scan history)
```

## Reference Files

| Artifact | Path |
|----------|------|
| Feature spec | `specs/AIB-412-copy-of-copy/spec.md` |
| Implementation plan | `specs/AIB-412-copy-of-copy/plan.md` |
| Research decisions | `specs/AIB-412-copy-of-copy/research.md` |
| Data model | `specs/AIB-412-copy-of-copy/data-model.md` |
| API contract | `specs/AIB-412-copy-of-copy/contracts/health-trends-api.md` |
| Existing area chart pattern | `components/health/drawer/quality-gate-drawer.tsx` |
| Existing scan history | `components/health/drawer/drawer-history.tsx` |
| Health types | `lib/health/types.ts` |
