# Research: Display health score heart indicator on project cards

## Existing Files

### Source Files

- `/home/runner/work/ai-board/ai-board/target/app/projects/page.tsx`
  - Covers the server-rendered Projects page and maps `getUserProjects()` output into the `ProjectsListResponse` shape.
  - Extend. This is the primary server mapping that must include health summary data in the initial page payload.

- `/home/runner/work/ai-board/ai-board/target/app/api/projects/route.ts`
  - Covers `GET /api/projects` and `POST /api/projects`.
  - Extend the GET response shape so API consumers receive project-card health summary data without per-card follow-up requests.

- `/home/runner/work/ai-board/ai-board/target/lib/db/projects.ts`
  - Covers the Prisma selector for user-visible projects in `getUserProjects()`.
  - Extend the `select` to include the existing `healthScore` relation so health summary data is fetched in the same query path that already powers the projects list.

- `/home/runner/work/ai-board/ai-board/target/app/lib/types/project.ts`
  - Covers the typed `ProjectWithCount` and `ProjectsListResponse` contract for the projects list.
  - Extend with a nested project health summary projection used by both the page mapping and API route.

- `/home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx`
  - Covers the clickable project card UI, existing top-right menu affordance, GitHub link, deployment URL, and shipped-ticket summary.
  - Extend to render the new health indicator in the card header area while preserving menu click isolation and card navigation.

- `/home/runner/work/ai-board/ai-board/target/components/projects/projects-container.tsx`
  - Covers the responsive project-card grid.
  - Reuse as-is unless spacing changes become necessary after indicator placement validation.

- `/home/runner/work/ai-board/ai-board/target/components/ui/popover.tsx`
  - Existing Radix/shadcn popover primitive with portal rendering and semantic surface styles.
  - Reuse for the read-only health summary popover so the implementation stays within the project’s component conventions.

- `/home/runner/work/ai-board/ai-board/target/lib/quality-score.ts`
  - Canonical source for score thresholds and Tailwind-safe score color classes via `getScoreThreshold()` and `getScoreColor()`.
  - Reuse for score-band styling on the project-card indicator and sub-score rows.

- `/home/runner/work/ai-board/ai-board/target/lib/health/score-calculator.ts`
  - Canonical source for health global score calculation and no-data label/color helpers.
  - Reuse for no-data label semantics and for keeping project-card score bands aligned with the health dashboard.

- `/home/runner/work/ai-board/ai-board/target/lib/health/quality-gate.ts`
  - Existing quality-gate aggregation helper that computes the passive module score from verify jobs.
  - Extend with a batched project-list-friendly helper if the projects list needs canonical Quality Gate values without per-project API calls.

- `/home/runner/work/ai-board/ai-board/target/lib/health/types.ts`
  - Canonical source for the six health modules and health response typing.
  - Reuse module labels and dimension ordering conceptually; no direct API reuse because the projects list needs a compact projection rather than the full health dashboard response.

- `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/health/route.ts`
  - Existing health endpoint that derives the current global score, no-data semantics, passive quality-gate handling, and module summaries.
  - Reference for canonical health semantics. Do not call it per card; instead project the required fields into the projects list query to satisfy FR-012.

- `/home/runner/work/ai-board/ai-board/target/components/health/health-sub-score-badge.tsx`
  - Existing health dashboard badge for labeled sub-scores.
  - Reference only. Do not reuse directly because the project-card popover needs a denser, card-specific layout and uses `"---"` today instead of the spec-required em dash.

- `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-quality-popover.tsx`
  - Existing small popover pattern for score breakdowns.
  - Reuse as the structural pattern for a project-card health popover: trigger-as-child, read-only content, compact list layout.

- `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
  - Source of truth for persisted health data via `Project.healthScore` and the `HealthScore` model.
  - Reuse existing fields only. No schema change is required for this feature.

### Existing Test Files

- `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/crud.test.ts`
  - Existing integration coverage for `GET /api/projects` and project route basics.
  - Extend. This is the correct file for asserting the new list payload fields because it already owns `/api/projects` coverage.

- `/home/runner/work/ai-board/ai-board/target/tests/integration/health/health-score.test.ts`
  - Existing integration coverage for health response semantics, including no-data and skipped-scan behavior.
  - Extend only if a missing semantic needs confirmation while designing the projection. Otherwise reference its existing coverage rather than duplicating health endpoint tests.

- `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-quality-popover.test.tsx`
  - Existing component test pattern for Radix popovers rendered through the shared testing utilities.
  - Reference pattern only. It should not be repurposed for project-card behavior.

- `/home/runner/work/ai-board/ai-board/target/tests/utils/component-test-utils.tsx`
  - Existing provider wrapper for RTL component tests.
  - Reuse for any new `ProjectCard` component tests.

- No existing unit/component test file currently covers `/home/runner/work/ai-board/ai-board/target/components/projects/project-card.tsx`.
  - Create a new file only for this uncovered domain, most likely `/home/runner/work/ai-board/ai-board/target/tests/unit/components/projects/project-card.test.tsx`.

## Technical Decisions

### Decision: Extend the projects list query and response with a compact `healthSummary` projection

Rationale:
- FR-012 explicitly forbids separate per-card retrievals.
- The projects page already maps a single `getUserProjects()` result into both the server page and the API route.
- `Project.healthScore` already contains the global score and all required sub-scores, so the change can stay read-only and query-local.

Alternatives considered:
- Call `/api/projects/[projectId]/health` per card. Rejected because it violates FR-012 and would create N+1 network behavior.
- Add a new project-list-specific API endpoint. Rejected because the existing page and API already share one list contract and only need projection growth.

### Decision: Use `HealthScore` for active scan sub-scores and derive `qualityGate` with the existing Quality Gate aggregation logic

Rationale:
- The persisted `HealthScore` row is already the right source for `security`, `compliance`, `tests`, `specSync`, and `reviewQuality`.
- The canonical health endpoint currently derives Quality Gate live through `/home/runner/work/ai-board/ai-board/target/lib/health/quality-gate.ts` rather than trusting `HealthScore.qualityGate`.
- A batched server-side aggregation across all listed project IDs preserves canonical semantics without violating FR-012.

Alternatives considered:
- Read `HealthScore.qualityGate` directly. Rejected because current runtime semantics derive Quality Gate live and the cached field is not the authoritative path used by the health endpoint.
- Omit Quality Gate from the popover. Rejected because the spec requires six dimensions and existing health semantics include it.

### Decision: Define no-data as `globalScore === null`, rendering a muted heart with `—`

Rationale:
- This matches the feature spec’s explicit no-data state.
- `getScoreLabel(null)` already returns `"No data yet"`, which can back the non-visual text alternative.
- Sub-scores already support `null` in the existing health model, so the popover can show `—` without estimation.

Alternatives considered:
- Hide the indicator when no data exists. Rejected because FR-006 requires a visible no-data heart.
- Render `0` for missing data. Rejected because it would falsely imply poor health rather than absence of scan data.

### Decision: Recompute the project-card `globalScore` from the projected sub-scores instead of trusting the stored `HealthScore.globalScore`

Rationale:
- The canonical health endpoint computes the displayed aggregate from current module inputs, including live Quality Gate data.
- Recomputing in the list mapping avoids drift between project cards and the health dashboard when Quality Gate changes.

Alternatives considered:
- Return the stored `HealthScore.globalScore` unchanged. Rejected because it may not reflect the current live-derived Quality Gate contribution.

### Decision: Reuse the canonical score bands from `lib/quality-score.ts`

Rationale:
- `getScoreThreshold()` matches the spec’s Excellent/Good/Fair/Poor ranges.
- `getScoreColor()` returns complete static Tailwind-safe classes and avoids forbidden dynamic class construction.
- The same utility already drives other score displays, reducing drift.

Alternatives considered:
- Introduce project-card-specific color mapping. Rejected because it duplicates logic and risks inconsistent thresholds.

### Decision: Implement the breakdown as a read-only popover anchored to the heart indicator

Rationale:
- The feature needs hover/focus reveal behavior without adding navigation or actions.
- The shared `Popover` primitive and the existing comparison popover pattern fit the requested informational summary.
- The trigger can use `stopPropagation()` to preserve card navigation while remaining keyboard-focusable.

Alternatives considered:
- Use `Tooltip` instead of `Popover`. Rejected because the popover content is multi-row and needs richer structure and focus support.
- Make the indicator itself link to the health dashboard. Rejected because FR-010 forbids navigation targets in the summary interaction.

### Decision: Add a dedicated project-card-specific indicator component

Rationale:
- `project-card.tsx` already handles several click-isolation concerns; extracting the health display keeps those concerns localized and testable.
- The new component can encapsulate icon rendering, accessible label generation, score-band visuals, and popover content.

Alternatives considered:
- Inline all indicator logic inside `project-card.tsx`. Rejected because the accessibility and popover behavior would make the card component harder to maintain and test.
- Reuse `health-sub-score-badge.tsx` directly. Rejected because its layout and `"---"` fallback do not match this feature’s compact popover requirements.

### Decision: Cover the change with one existing integration file and one new component test file

Rationale:
- Constitution III requires extending existing tests first.
- `/tests/integration/projects/crud.test.ts` already owns `/api/projects` responses and should verify the new `healthSummary` fields.
- There is no existing component test file for project cards, so a new `/tests/unit/components/projects/project-card.test.tsx` is justified for navigation preservation, no-data rendering, and popover disclosure.

Alternatives considered:
- Add Playwright coverage. Rejected because the behavior is UI plus data projection and fits faster integration/component coverage.
- Create a new integration file for the projects list API. Rejected because `crud.test.ts` already covers that domain.

## Clarifications Resolved

### Decision: The six sub-scores on project cards are `Security`, `Compliance`, `Tests`, `Spec Sync`, `Quality Gate`, and `Review Quality`

Rationale:
- `MODULE_METADATA` and the health endpoint confirm these are the canonical six modules currently exposed.
- The feature spec names the same six labels.

Alternatives considered:
- Use any older five-module contract. Rejected because the repository now includes `Review Quality` and no longer exposes `lastClean`.

### Decision: The project-card popover should show cached numeric values only, not scan status, trend, issues, or actions

Rationale:
- The feature spec requests a compact informational summary with no actions.
- Limiting the payload to scores keeps the project list fast and avoids duplicating dashboard-only concepts.

Alternatives considered:
- Include summaries like `"All clear"` or `"No scan yet"` per dimension. Rejected because the requested UI is score-focused and the minimal payload keeps the card compact.

### Decision: Accessibility text should announce both the overall state and the no-data state

Rationale:
- FR-014 requires understandable non-visual cues.
- The indicator trigger can provide an `aria-label` such as `"Project health score: 82, Good"` or `"Project health score: no data yet"`.

Alternatives considered:
- Rely on visual score text alone. Rejected because the heart shape and color treatment are not sufficient non-visual affordances.
