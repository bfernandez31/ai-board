# Quickstart: Health Scan — Review Quality Analysis

**Ticket**: AIB-497
**Date**: 2026-04-03

---

## Prerequisites

- Node.js 22.20.0 with Bun runtime
- PostgreSQL 14+ running locally
- GitHub PAT with `repo` scope (for PR comment access)
- Existing health scan infrastructure operational

## Setup Steps

1. **Apply Prisma migration** after schema changes:
   ```bash
   bunx prisma migrate dev --name add-review-quality-scan-type
   bunx prisma generate
   ```

2. **Verify type registration** — after code changes, run:
   ```bash
   bun run type-check
   ```

3. **Test the scan trigger** manually:
   ```bash
   curl -X POST "http://localhost:3000/api/projects/3/health/scans" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $WORKFLOW_API_TOKEN" \
     -d '{"scanType": "REVIEW_QUALITY"}'
   ```

4. **Verify dashboard rendering** — open `http://localhost:3000/projects/3/health` and confirm the Review Quality card appears.

## Implementation Order

1. **Schema + types** (data layer): Prisma migration, TypeScript types, Zod schemas
2. **Backend registration** (scan infra): Command map, score calculator, health API response, ticket creation
3. **Claude command** (scan logic): `ai-board.health-review-quality.md` — PR discovery, comment collection, cross-referencing, scoring, cumulative analysis
4. **Workflow integration** (CI): Update `health-scan.yml` and `nightly-health.yml`
5. **Dashboard UI** (frontend): Module card, drawer rendering, trend integration
6. **Testing**: Integration tests for API, component tests for UI

## Key Files to Modify

| Layer | File | Change |
|-------|------|--------|
| Schema | `prisma/schema.prisma` | Add `REVIEW_QUALITY` enum + HealthScore fields |
| Types | `lib/health/types.ts` | Add report types, module metadata |
| Validation | `lib/health/report-schemas.ts` | Add Zod schema + union member |
| Commands | `lib/health/scan-commands.ts` | Add command mapping |
| Scoring | `lib/health/score-calculator.ts` | Include in global score |
| Tickets | `lib/health/ticket-creation.ts` | Add grouping for review gap tickets |
| API | `app/api/projects/[projectId]/health/route.ts` | Add reviewQuality module |
| Dashboard | `components/health/health-dashboard.tsx` | Add to MODULE_GRID |
| Card | `components/health/health-module-card.tsx` | Add icon |
| Drawer | `components/health/drawer/drawer-issues.tsx` | Add findings rendering |
| Workflow | `.github/workflows/health-scan.yml` | Add REVIEW_QUALITY case |
| Nightly | `.github/workflows/nightly-health.yml` | Add to scan loop |
| Command | `.claude-plugin/commands/ai-board.health-review-quality.md` | New file |
