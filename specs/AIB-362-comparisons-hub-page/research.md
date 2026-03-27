# Research: Comparisons Hub Page With Project List, Inline Detail, and VERIFY Launch

## Decision 1: Use durable `ComparisonRecord` data as the project hub source of truth

- Decision: Rewrite `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/comparisons/route.ts` to query Prisma `ComparisonRecord` rows instead of scanning `specs/*/comparisons/*.md` files.
- Rationale: The ticket-scoped comparison APIs already normalize durable records with participants, winner, decision points, and compliance data. Reusing that data avoids divergent history behavior, supports inline detail directly, and honors the spec assumption that saved comparison records already contain the needed structured content.
- Alternatives considered:
  - Keep filesystem scanning for the hub list and only use Prisma for detail. Rejected because the list would continue exposing incomplete fields and drift from persisted history.
  - Scan markdown and parse richer fields on demand. Rejected because it duplicates persistence work and adds brittle parsing logic.

## Decision 2: Add dedicated project-scoped list, detail, candidates, and launch endpoints

- Decision: Introduce project-scoped APIs for list/detail/candidate/launch behavior rather than forcing the hub to call ticket-scoped detail routes with an arbitrary participant ticket ID.
- Rationale: The project hub is authorized at the project level, not at the level of one selected participant ticket. Project-scoped contracts make pagination, pending-state refresh, and candidate selection straightforward while preserving the ticket modal’s existing routes unchanged.
- Alternatives considered:
  - Reuse the ticket-scoped detail route by picking the winner or first participant ticket. Rejected because the hub would need extra lookup logic and the contract would remain semantically misleading.
  - Build the hub entirely client-side from the ticket endpoints. Rejected because project-wide pagination and launch orchestration belong on the server.

## Decision 3: Reuse the current `/compare` workflow by creating the same comment/job pattern from the hub

- Decision: The launch endpoint should create the same user-visible `Comment` and `Job` records that `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comments/route.ts` creates when a user posts `@ai-board /compare ...`, then dispatch `ai-board-assist.yml` through the existing workflow helper.
- Rationale: This satisfies FR-012 without introducing a second comparison workflow. The existing workflow already persists durable comparison records after success, and it already knows how to fetch telemetry and generate compare artifacts.
- Alternatives considered:
  - Add a brand-new comparison-specific workflow dispatch input. Rejected because it forks behavior from the existing compare command and increases maintenance.
  - Create only a `Job` record and dispatch the workflow without a `Comment`. Rejected because the current AI-BOARD workflow contract expects comment content and the existing activity/audit trail should remain visible to users.

## Decision 4: Anchor a hub launch to one selected VERIFY ticket and rely on the existing compare semantics to include the full selected set

- Decision: When the user selects 2-5 VERIFY tickets, the backend chooses one selected ticket as the source anchor and includes the remaining selected ticket keys in the generated `@ai-board /compare ...` comment. The source anchor should be chosen deterministically from the selected set by descending `updatedAt`, then ascending `id`.
- Rationale: The current compare workflow already derives a source ticket from branch context and its telemetry prefetch script adds the source ticket to the compared set when not explicitly listed. That means a launch anchored to one selected ticket still compares all selected tickets without changing the compare engine.
- Alternatives considered:
  - Require the user to manually pick a “primary” source ticket in the UI. Rejected because it adds UX complexity with little product value.
  - Include every selected ticket key in the comment, including the source. Rejected because the existing command contract treats the source separately and does not need duplicate references.

## Decision 5: Model pending launch state from `Job` status and refresh comparison queries on terminal transition

- Decision: The launch endpoint returns the created `jobId`, and the hub polls project job status every 2 seconds only while at least one locally launched comparison request remains `PENDING` or `RUNNING`. On terminal transition, invalidate project comparison list/detail queries.
- Rationale: The codebase already has job polling utilities and existing `comment-*` job semantics. Reusing that mechanism avoids a new persistence model for launch requests while still meeting FR-013 and the edge case about a comparison finishing after the page is open.
- Alternatives considered:
  - Add a new database table for comparison launch requests. Rejected because `Job` already captures lifecycle state.
  - Poll the comparisons list continuously for all users. Rejected because it adds unnecessary load when no launches are in flight.

## Decision 6: Derive VERIFY candidate quality state from the latest verify job, matching existing comparison detail enrichment semantics

- Decision: Candidate rows should expose `qualityScore` as `available`, `pending`, or `unavailable` using the same latest-verify-job logic already present in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts`.
- Rationale: The spec explicitly allows tickets with missing quality scores to remain selectable, and the existing detail layer already defines the correct state model for quality availability.
- Alternatives considered:
  - Hide tickets without completed quality scores. Rejected because the spec says all current VERIFY tickets remain eligible.
  - Show only numeric scores or blanks. Rejected because explicit availability states are clearer and consistent with current comparison UI.
