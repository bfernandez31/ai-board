# Research: Replace PR Comments with Spec Sync

## R-001: Current Dimension Architecture

**Decision**: Extend the existing `DIMENSION_WEIGHTS` config into a richer `DIMENSION_CONFIG` array that includes agent ID, display name, weight, and active status.

**Rationale**: The current `DIMENSION_WEIGHTS` (`lib/quality-score.ts:26-32`) is a simple `Record<string, number>` that only maps agentId to weight. The spec requires a single config source for both scoring and display (FR-002, FR-010). A typed array of dimension config objects provides agent ID, display name, weight, and ordering in one place.

**Alternatives considered**:
- Keep `DIMENSION_WEIGHTS` as-is and add a separate display name map → violates single-config requirement
- Database-driven config → over-engineering for rarely-changed config (auto-resolved decision in spec)

## R-002: Spec Sync Agent Behavior

**Decision**: Replace Agent #4 (PR Comments) with a Spec Sync agent that analyzes `specs/specifications/**/*.md` files modified in the PR for consistency with code changes.

**Rationale**: The PR Comments agent (step 4d in `ai-board.code-review.md`) reads previous PRs for comments. The Spec Sync agent instead:
1. Lists spec files modified in the PR (via `gh pr diff`)
2. If no spec files modified → returns score 100 immediately (FR-006)
3. If spec files found → reads them + code changes and checks for contradictions (FR-004) and gaps (FR-005)

**Alternatives considered**:
- Analyze ALL spec files → too slow, high false-positive rate (auto-resolved in spec)
- Add as 6th agent → violates FR-012 (must remain 5 agents)

## R-003: Weight Rebalancing

**Decision**: New weights: Compliance 0.40, Bug Detection 0.30, Code Comments 0.20, Historical Context 0.10, Spec Sync 0.00. Active weights sum to 1.00.

**Rationale**: Spec FR-007 is explicit. Compliance increases from 0.30 to 0.40. Spec Sync at 0.00 means scores are computed and stored but don't affect the global quality score (FR-009).

**Alternatives considered**: None — weights are explicitly specified in requirements.

## R-004: Historical Data Compatibility

**Decision**: No data migration. Old `qualityScoreDetails` JSON retains `pr-comments` agentId. Display components handle both `pr-comments` and `spec-sync` gracefully.

**Rationale**: Auto-resolved decision in spec — CONSERVATIVE approach preserves data. The `quality-score-section.tsx` already renders dimensions dynamically from the JSON `dim.name` field, so old "PR Comments" labels persist naturally.

**Alternatives considered**:
- Database migration to rename old records → unnecessary risk, no user benefit
- Add display name mapping for legacy IDs → unnecessary since names are stored in JSON

## R-005: Analytics Dimension Display

**Decision**: The analytics `getQualityScoreAnalytics` function (`lib/analytics/queries.ts:570-590`) aggregates dimensions by `dim.name` from stored JSON. No changes needed there — it naturally shows whatever dimension names exist in the data. The `dimensionComparison` chart will show both "PR Comments" (historical) and "Spec Sync" (new) if both exist in the data range.

**Rationale**: The aggregation logic is already dimension-name-agnostic. It reads names from stored JSON, not from the config. This naturally handles the transition.

**Alternatives considered**:
- Force-merge old/new dimension names → would lose the distinction between old and new reviews

## R-006: Config-Driven Display

**Decision**: Export a `getDimensionDisplayName(agentId: string): string` helper from the config, and export the full config array for UI components that need to enumerate dimensions.

**Rationale**: FR-010 requires display components to read from config, not hardcode strings. The `quality-score-section.tsx` already uses `dim.name` from stored JSON (correct for historical data). The analytics dimension comparison chart should use config labels for current dimensions.

**Alternatives considered**:
- Only use stored JSON names → works for ticket detail but not for analytics config display
