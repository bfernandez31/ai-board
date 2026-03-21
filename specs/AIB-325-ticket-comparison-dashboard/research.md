# Research: Ticket Comparison Dashboard

## Decision 1: Persist comparison history in PostgreSQL, not only in branch-scoped markdown

**Decision**: Add Prisma-backed comparison persistence models centered on `ComparisonRecord` and `ComparisonParticipant`, with child records for immutable comparison-only analysis.

**Rationale**:
- The current implementation stores comparison reports at `specs/{branch}/comparisons/*.md`, which makes discovery branch-specific instead of participant-specific.
- FR-004 and FR-005 require the same comparison to be discoverable from every participating ticket and distinguishable across repeated runs.
- Database persistence provides stable identifiers, indexes, foreign keys, and efficient history queries without parsing markdown filenames or file contents.

**Alternatives considered**:
- Continue using markdown-only storage: rejected because it cannot satisfy multi-ticket discoverability without duplicated files or brittle file scanning.
- Store one markdown file per participating ticket: rejected because it multiplies artifacts and introduces synchronization drift.

## Decision 2: Persist only comparison-specific analysis; enrich from existing ticket and job data at read time

**Decision**: Save ranking, recommendation, per-ticket score/rationale, comparison-time code metrics, decision points, and compliance assessments. Do not make the comparison record the source of truth for ticket metadata, telemetry, or quality scores.

**Rationale**:
- FR-003 explicitly forbids duplicating ticket, telemetry, and quality information already stored elsewhere.
- `Ticket` and `Job` already hold authoritative metadata, telemetry, and verify quality information.
- Read-time enrichment lets the detail response surface current optional data while preserving the historical comparison outcome.

**Alternatives considered**:
- Snapshot every ticket field and every telemetry aggregate into the comparison record: rejected because it creates data drift and duplicate ownership.
- Avoid any snapshots: rejected because FR-002 requires preserving comparison-specific metrics and ranking rationale from the original run.

## Decision 3: Use ticket-scoped, DB-backed read endpoints keyed by `comparisonId`

**Decision**: Replace filename-based history/detail reads with ticket-scoped APIs that query Prisma by participant membership and return structured JSON payloads.

**Rationale**:
- Current endpoints are tied to `ticket.branch` and markdown parsing, which fails the requirement that any participating ticket can open the same result.
- Numeric `comparisonId` is stable even if branch names, filenames, or markdown formatting evolve.
- Ticket-scoped endpoints align with existing ticket modal UX and can reuse `verifyTicketAccess()` to enforce authorization.

**Alternatives considered**:
- Project-wide only comparison detail endpoints: rejected because the ticket detail surface is the primary user entry point.
- Keep filename routes and add database lookup behind them: rejected because the filename remains an unnecessary unstable external identifier.

## Decision 4: Keep `/compare` markdown generation and structured persistence in the same run

**Decision**: The `/compare` implementation will continue generating the markdown report, then persist one structured comparison record referencing that artifact as part of the same application workflow.

**Rationale**:
- FR-014 and FR-015 require backward compatibility and consistency between the markdown report and the structured record.
- Persisting both outputs from the same in-memory comparison result avoids conflicting winners, rankings, or recommendation text.
- Storing `markdownPath` or equivalent provenance on the record provides traceability without making markdown the query index.

**Alternatives considered**:
- Generate structured records first and derive markdown later asynchronously: rejected because delayed writes could diverge.
- Drop markdown entirely: rejected by the spec.

## Decision 5: Replace the markdown modal body with a structured dashboard while preserving the existing ticket entry point

**Decision**: Keep the `Compare` action in the ticket detail modal, but change the viewer to load structured history and detail data and render ranking, metrics, decision points, and compliance sections.

**Rationale**:
- FR-008 through FR-012 require a visual comparison dashboard, not a raw markdown reader.
- The current `ComparisonViewer` and `use-comparisons` hook provide a stable insertion point for this upgrade without redesigning the whole ticket detail flow.
- This limits implementation scope while solving the actual usability gap.

**Alternatives considered**:
- Add a new standalone comparison page only: rejected because the spec emphasizes access from any participating ticket.
- Continue rendering markdown with better styling: rejected because the required structured metrics, decision grids, and pending/unavailable states are not well-served by markdown parsing.
