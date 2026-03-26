# Research: Redesign Comparison Dialog as Mission Control Dashboard

**Feature Branch**: `AIB-355-redesign-comparison-dialog`
**Research Date**: 2026-03-26

## Decision 1: Keep the Existing Ranking as the Winner Source of Truth

- Decision: The redesign will continue to use `winnerTicketId` and ranked `participants` from the existing `ComparisonDetail` payload as the authoritative winner ordering.
- Rationale: The current backend already persists and serves a deterministic winner, and the spec explicitly limits this work to presentation rather than a new business rule.
- Alternatives considered: Recomputing the winner in the client was rejected because it could drift from persisted comparison results; showing co-winners was rejected because FR-001 requires exactly one hero winner.

## Decision 2: Preserve a Single Comparison Session for 2-6 Participants

- Decision: All participants remain visible in one dialog session, with a dominant winner hero followed by ranked participant cards and horizontally scrollable detail sections where necessary.
- Rationale: This matches the spec’s anti-pagination requirement and fits the existing `ScrollArea`-based dialog shell without adding new fetches or nested views.
- Alternatives considered: Pagination and tabbed participant drill-down were rejected because they hide direct comparison context; collapsing lower-ranked participants behind accordions was rejected because it slows scanning.

## Decision 3: Merge Metrics into One Relative Dashboard Matrix

- Decision: Replace the split implementation and operational metric sections with one unified matrix that includes cost, duration, quality score, files changed, lines changed, test files changed, total tokens, input tokens, output tokens, and job count.
- Rationale: The current code already provides all required values through `participants[].metrics`, `participants[].telemetry`, and `participants[].quality`, so the redesign can reduce cognitive load without changing the API.
- Alternatives considered: Keeping two tables was rejected because the spec explicitly asks for a unified matrix; moving detailed metrics into per-participant drawers was rejected because it breaks row-wise comparison.

## Decision 4: Use Semantic Tokens and Existing Variants for Status Cues

- Decision: Winner, score band, compliance, and enrichment-state emphasis will be expressed with semantic Tailwind tokens and existing shadcn/ui variants, with neutral copy for pending or unavailable states.
- Rationale: Project rules forbid hardcoded colors and dynamic Tailwind class generation, and the current theme already exposes `background`, `card`, `muted`, `primary`, `accent`, `destructive`, and related semantic tokens.
- Alternatives considered: Custom hex-based badges were rejected by project policy; relying on color alone was rejected because the spec requires understandable non-hover and neutral-state treatment.

## Decision 5: Keep Quality Breakdown on the Existing Interactive Pattern

- Decision: The quality score remains interactive through the existing quality popover behavior while being embedded inside the merged metrics matrix and headline summary.
- Rationale: FR-010 requires preserving the score breakdown interaction, and the repo already has `comparison-quality-popover.tsx` plus component tests around quality-score UI.
- Alternatives considered: Inlining the full breakdown in every row was rejected because it would bloat dense comparison views; removing the interaction was rejected because it regresses existing behavior.

## Decision 6: Surface Compliance and Decision States Before Expansion

- Decision: Compliance will stay grid-based with explicit pass, mixed, fail, and missing states per participant, while decision points will show verdict cue, title, and summary in the trigger row with the first item expanded by default.
- Rationale: The existing components already render grid rows and collapsibles, so the redesign can strengthen scanability by changing visual hierarchy and default-open behavior rather than inventing new data structures.
- Alternatives considered: Hiding notes entirely behind tooltips was rejected because non-hover users still need access; showing every decision body expanded was rejected because it hurts scanability for larger comparisons.

## Decision 7: Treat This as a Frontend-First Change with Contract Regression Coverage

- Decision: Planning assumes no backend schema or route changes, but it snapshots the current comparison read contracts and extends integration tests to protect the payload shape the new UI depends on.
- Rationale: The feature spec says backend contracts remain unchanged, and repository inspection shows the current GET routes already expose ranking, metrics, decision points, and compliance rows.
- Alternatives considered: Introducing a new dashboard-specific endpoint was rejected because it adds unnecessary API surface; relying only on component fixtures was rejected because it would not protect against route regressions.
