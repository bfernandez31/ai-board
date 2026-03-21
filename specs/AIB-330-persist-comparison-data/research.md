# Research: Persist comparison data to database via workflow

## Decision 1: Use an ephemeral JSON handoff artifact beside the markdown report

**Decision**: After markdown generation succeeds, `/compare` writes transient `specs/{branch}/comparisons/comparison-data.json` containing the structured report plus the scoped metadata required for persistence, and the workflow deletes that JSON file before committing artifacts.

**Rationale**:
- The spec requires markdown to remain the primary artifact while adding a structured handoff for durable storage.
- A file-based handoff fits the current workflow model, where `.github/workflows/ai-board-assist.yml` already routes `/compare` and can inspect branch-local artifacts after the command completes.
- A stable `comparison-data.json` path lets the workflow distinguish “no JSON produced” from “JSON exists but ingest failed.”
- The repo still has project-wide comparison discovery that scans committed markdown files, so keeping JSON transient avoids introducing a second committed artifact surface prematurely.

**Alternatives considered**:
- Persist directly from the compare command into the database: rejected because the spec explicitly wants workflow-mediated persistence and the workflow is the stable automation boundary.
- Encode the JSON in `.ai-board-result.md`: rejected because that file is status-oriented and not a safe structured transport contract.

## Decision 2: Reuse the existing comparison persistence service through a workflow-only API route

**Decision**: Add workflow-authenticated `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons` that validates the request and delegates to `persistComparisonRecord()`.

**Rationale**:
- The transactional write and record mapping already exist in `lib/comparison/comparison-record.ts`.
- Using an API route keeps automation writes aligned with other workflow-token operations in the app.
- Reusing the existing comparisons route keeps read and write concerns on the same ticket-scoped resource while allowing auth to differ by method.

**Alternatives considered**:
- Create a separate `/persist` route: rejected because it adds surface area without adding meaningful isolation.
- Add session-auth write access for users: rejected because the spec explicitly scopes persistence to workflow token auth.

## Decision 3: Shape the JSON artifact around the existing `ComparisonReport` plus persistence metadata

**Decision**: The artifact payload should embed the existing `ComparisonReport` and add only the fields the current persistence service cannot derive safely from route context alone: `compareRunKey`, `markdownPath`, `sourceTicketId`, and a participant ticket mapping array.

**Rationale**:
- `ComparisonReport` already contains the structured comparison content needed for ranking, metrics, compliance, recommendation, and provenance.
- The persistence service still needs durable ticket IDs and the markdown path to connect the report to real project/ticket records.
- This minimizes workflow-side transformation and keeps the endpoint responsible for domain validation.

**Alternatives considered**:
- Invent a new persistence-only payload unrelated to `ComparisonReport`: rejected because it duplicates structure and increases drift risk.
- Require the workflow to resolve ticket IDs itself: rejected because domain validation belongs on the server side.

## Decision 4: Make retries idempotent with a compare-run key, not with participant-set deduping

**Decision**: Include a unique `compareRunKey` in `comparison-data.json` and use it in the persistence path to collapse workflow retries for the same generated artifact.

**Rationale**:
- The current persistence service creates a new `ComparisonRecord` on every call, so workflow retries would otherwise create misleading duplicates.
- The existing comparison history intentionally allows multiple runs for the same participant set, so deduping by tickets or markdown path is too aggressive.
- A compare-run key keeps “retry the same run” distinct from “run compare again later on the same tickets.”

**Alternatives considered**:
- No idempotency: rejected because retries can produce duplicate history entries that look like distinct comparisons.
- Deduping by `sourceTicketId + participant keys`: rejected because repeated comparisons are valid historical events.

## Decision 5: Keep live enrichment behavior unchanged for this ticket

**Decision**: AIB-330 persists the existing comparison dashboard facts and markdown provenance, but does not expand the persistence model to snapshot live telemetry or additional alignment fields.

**Rationale**:
- The current read path already joins persisted comparison records with live `Job` data for telemetry and quality enrichment.
- The ticket scope is a persistence bridge, not a redesign of the dashboard data model.
- Avoiding a schema expansion keeps the change focused on workflow reliability and backward compatibility.

**Alternatives considered**:
- Snapshot all telemetry and alignment details now: rejected because it broadens scope beyond the workflow persistence bridge and would require a follow-up design on read-side ownership semantics.
- Delay persistence until a fuller snapshot model exists: rejected because the dashboard already depends on durable records and this ticket closes the current generation gap.
