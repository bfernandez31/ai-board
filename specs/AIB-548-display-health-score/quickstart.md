# Quickstart: Display health score heart indicator on project cards

## Implementation Steps

1. Extend `/home/runner/work/ai-board/ai-board/target/lib/db/projects.ts` so `getUserProjects()` selects the related `healthScore` fields needed by project cards.
2. Extend `/home/runner/work/ai-board/ai-board/target/app/lib/types/project.ts` with `ProjectHealthSummary` and the nested sub-score shape.
3. Update `/home/runner/work/ai-board/ai-board/target/app/projects/page.tsx` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/route.ts` to map the selected `healthScore` row into the `healthSummary` response shape using the existing score-label/color helpers.
4. Create `/home/runner/work/ai-board/ai-board/target/components/projects/project-health-indicator.tsx` for the heart icon, accessible label, and read-only popover.
5. Update `/home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx` to place the indicator in the upper-right card header area without breaking `ProjectMenu`, GitHub link, deployment URL, or card navigation.
6. Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/crud.test.ts` with `GET /api/projects` assertions for scored and no-data project health summaries.
7. Add `/home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx` for card rendering, popover disclosure, and interaction isolation.

## Validation

Run:

```bash
cd /home/runner/work/ai-board/ai-board/target
bun run test:unit tests/unit/components/projects/project-card.test.tsx
bun run test:integration tests/integration/projects/crud.test.ts
bun run type-check
bun run lint
```

## Manual Verification

1. Open `/projects` with at least one project that has a populated `HealthScore` row and one without health data.
2. Confirm scored projects show a heart indicator in the card’s upper-right area with the numeric score.
3. Confirm no-data projects show a muted heart with `—`.
4. Hover or focus the indicator and confirm the popover shows exactly six rows: Security, Compliance, Tests, Spec Sync, Quality Gate, Review Quality.
5. Confirm any missing sub-score renders as `—`.
6. Confirm clicking the card still navigates to `/projects/{projectId}/board`.
7. Confirm interacting with the health indicator does not trigger card navigation and does not add links or buttons inside the popover.
