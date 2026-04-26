# Feature Specification: Capture Ticket Outcomes at SHIP for Analytics and Prediction Grounding

**Feature Branch**: `AIB-742-capture-ticket-outcomes`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Capture ticket outcomes at SHIP for analytics and prediction grounding — when a ticket reaches SHIP, persist a one-shot, immutable outcome record aggregating job telemetry, change shape, structural domain, semantic tags, and a derived frictionFree boolean; provide a generic, idempotent backfill for historical shipped tickets across any supported stack."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Quality threshold for the `frictionFree` boolean is set at **final verify quality score ≥ 75** (on the existing 0–100 scale). When no quality score is available (e.g., QUICK workflow tickets that never run verify), `frictionFree` is `false` by default and a reason code is captured.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4, derived from +2 reliability/scalability, +1 neutral feature, +1 minor sensitive — see analysis below)
- **Fallback Triggered?**: No — netScore positive and no conflicting buckets, CONSERVATIVE chosen as recommended.
- **Trade-offs**:
  1. A higher threshold avoids labelling shaky tickets as "clean", protecting analytics integrity, at the cost of fewer tickets being marked `frictionFree`.
  2. Default-`false` for unscored tickets is safer for downstream prediction grounding than default-`true`, but means QUICK-workflow successes never count as "clean" until verify scoring is generalized.
- **Reviewer Notes**: Confirm the 75 threshold matches existing qualityScore label bands (good/excellent) used elsewhere in the system; calibrate if dimension weights shift.

- **Decision**: Friction-job classification covers (a) any job whose command starts with `iterate`, and (b) any job whose command starts with `comment-` (current set: `comment-specify`, `comment-plan`, `comment-build`, `comment-verify`, `comment-ship`). All other commands are pipeline jobs.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prefix-based classification is robust to new comment commands being added in the future.
  2. A future job command outside these prefixes that conceptually represents friction would not be captured until the rule is updated; offset by versioning the rule with the outcome record.
- **Reviewer Notes**: If a new friction-style command is introduced (e.g., `revisit-*`), update the classifier and bump its rule version; existing rows remain unchanged by design.

- **Decision**: Outcome capture covers tickets reaching stage SHIP from **both FULL and QUICK workflow types**. QUICK tickets simply have `null` quality score and any verify-derived fields recorded as null.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Including QUICK tickets gives complete delivery analytics across both pipelines.
  2. Mixed null verify fields require consumers to handle absence; mitigated by exposing `workflowType` on the outcome.
- **Reviewer Notes**: Verify analytics/prediction consumers always check `workflowType` before grouping by quality score.

- **Decision**: Outcome storage is a **dedicated, append-only outcome record** keyed one-to-one by ticket. Outcomes are written exactly once at SHIP and are not updated thereafter (immutable snapshot).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Immutability protects historical analytics from drift in inference rules.
  2. Cannot retroactively benefit from improved rules; mitigated by versioning rule sets and allowing future features to migrate or recompute via a separate, opt-in operation outside this ticket's scope.
- **Reviewer Notes**: Confirm that no existing flow expects ticket outcome data to be writable post-SHIP.

- **Decision**: Backfill is per-project, idempotent, and resumable. Re-running on a project skips tickets that already have an outcome and resumes from the last successfully processed ticket on transient failure. It throttles external repository API usage and runs without locking the live ingestion path.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Per-project scoping prevents one project's API quota issues from stalling others.
  2. Skip-on-existing means that an outcome computed with stale rules will not be re-derived by backfill; that is intentional (immutability).
- **Reviewer Notes**: Confirm rate-limit strategy aligns with the platform's existing pattern for repository-fetching workflows.

- **Decision**: Tickets without a usable commit reference (e.g., commit lookup fails, repository unreachable, or no commits attached to any job) still receive an outcome record. Change-shape and domain fields are recorded as null/empty, a `partial` boolean is set to `true`, and a `partialReason` code captures why.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Always producing a row preserves count integrity for delivery analytics ("X tickets shipped" matches "X outcome rows").
  2. Consumers must filter on `partial = false` for change-shape questions; an explicit flag makes that filter discoverable.
- **Reviewer Notes**: Confirm consumers detect the `partial` flag rather than silently treating null change-shape as zero changes.

- **Decision**: Domain extraction takes the **top-level path segment** of every touched file path. The outcome stores the unique set of segments and, alongside, a frequency map of files-per-segment, so consumers can weight domains by hit count.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Top-level segments are stack-agnostic and need no per-project configuration, satisfying the genericity requirement.
  2. Coarse granularity means deep monorepos may show low domain diversity; deeper granularity is left to future analysis features.
- **Reviewer Notes**: Confirm with prediction consumers that "top-level segment" is the intended granularity for clustering similar tickets.

- **Decision**: Semantic tags `touched_db_schema`, `touched_tests`, `touched_ci` are derived from a **system-maintained generic stack lookup**, populated by the project's declared services, testing framework, and language. Examples: `services` includes `postgres` ⇒ schema indicator paths include `prisma/schema.prisma`, `migrations/**`, `*.sql`; `testing.framework = vitest` ⇒ test indicator includes `**/*.test.ts`, `**/*.spec.ts`, plus the project-wide `tests/**`. `touched_ci` is derived from a generic CI indicator set (e.g., `.github/workflows/**`, `.gitlab-ci.yml`, `.circleci/**`) and the language-specific tooling. The lookup table lives in the system, not in any project's repository.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A central lookup keeps projects free of per-project config, satisfying genericity, and lets us evolve detection without touching each repo.
  2. Newly adopted technologies require a lookup-table update before their tags fire correctly; existing outcomes are immutable so they remain unaffected.
- **Reviewer Notes**: Validate that the lookup covers TypeScript/Next, Python, Go, Rust, and Zig as called out in the ticket; missing entries surface as `false` tags rather than errors.

- **Decision**: Test-vs-code ratio is computed as `lines_in_test_paths / max(total_lines_changed, 1)` where "test paths" come from the same lookup that drives `touched_tests`. Both numerator and denominator use additions + deletions combined.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Combined +/- lines smooths cases where deletions dominate refactors.
  2. Stack-agnostic test detection comes for free from the same lookup that powers `touched_tests`.
- **Reviewer Notes**: Confirm the ratio's intended use (ticket-quality grounding) doesn't require separating additions from deletions.

- **Decision**: Capture timing — outcome is computed and persisted during the SHIP transition path itself (synchronously enqueued, asynchronously executed) and surfaced "within minutes". Failure to compute does **not** block the SHIP transition; failures are retried with bounded backoff and surface as a partial outcome with a `partialReason` after retries are exhausted.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Decoupling protects the user-visible SHIP flow from outcome-computation hiccups.
  2. A small lag between SHIP and outcome availability is acceptable for analytics consumers.
- **Reviewer Notes**: Confirm "within minutes" SLO is acceptable to the prediction-grounding feature that depends on this data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live capture of every shipped ticket's outcome (Priority: P1)

When any ticket transitions to stage SHIP, the system records a single, structured, immutable outcome that aggregates everything we know about how the ticket was delivered: job-level cost and duration, the count of pipeline vs friction jobs, the final quality score, the shape and domain of the change, and a derived `frictionFree` boolean. Consumers can then query outcomes per project, per domain, or by friction status without re-aggregating.

**Why this priority**: This is the core capability. Without live capture, every downstream consumer (the two upcoming prediction features and any honest delivery analytics) keeps re-deriving signals incorrectly. New shipped tickets are the freshest, highest-value data and must not be lost while we wait for backfill.

**Independent Test**: Ship a representative ticket end-to-end and confirm that, within minutes of the SHIP transition, an outcome row exists for that ticket exposing total cost, total duration, pipeline-vs-friction counts, quality score, files touched, lines added/removed, code-vs-test ratio, structural domains, semantic tags, `frictionFree`, and `partial` (false in the happy path). Re-querying must return the same data — the row is immutable.

**Acceptance Scenarios**:

1. **Given** a FULL-workflow ticket whose verify produced a quality score of 90, with no iterate jobs and no comment-driven jobs, **When** the ticket transitions to SHIP, **Then** an outcome row is persisted within minutes containing aggregated cost/duration, the verify quality score (90), `frictionFree = true`, derived domains, semantic tags, and `partial = false`.
2. **Given** a FULL-workflow ticket that needed two `iterate` jobs and one `comment-build` job, **When** the ticket reaches SHIP, **Then** the outcome row records `pipelineJobCount` and `frictionJobCount` correctly (friction count ≥ 3) and `frictionFree = false`, regardless of quality score.
3. **Given** a QUICK-workflow ticket that ships, **When** SHIP fires, **Then** the outcome row records aggregated job telemetry, has `workflowType = QUICK`, `qualityScore = null`, and `frictionFree = false` (no verify quality available).
4. **Given** outcome computation fails transiently after SHIP (e.g., temporary repository fetch failure), **When** retries are exhausted, **Then** the outcome row is still persisted with `partial = true`, a `partialReason` code, job-level signals filled in, and change-shape fields null.
5. **Given** an outcome row already exists for a ticket, **When** any subsequent re-evaluation is triggered, **Then** the existing row is **not** modified (immutable snapshot guarantee).

---

### User Story 2 - Generic, stack-agnostic structural domain and semantic tagging (Priority: P1)

Any project supported by the platform — TypeScript/Next, Python, Go, Rust, Zig, and beyond — produces meaningful structural domains and semantic tags on every outcome, without needing a per-project domain config file. Tags `touched_db_schema`, `touched_tests`, and `touched_ci` are derived from each project's declared stack (services, testing framework, language) plus a generic, system-maintained lookup table.

**Why this priority**: Genericity is non-negotiable per the ticket: prediction grounding must work uniformly across all projects, not just the canonical one. If tagging fails on Python or Rust projects, the resulting dataset is biased and consumers will treat it as such.

**Independent Test**: For at least four projects spanning different stacks (e.g., TypeScript/Next, Python, Go, Rust), ship one ticket each that touches a database schema file, a test file, and a CI file appropriate to that stack. Confirm each outcome reports `touched_db_schema`, `touched_tests`, and `touched_ci` as `true`, with no project-side configuration changes.

**Acceptance Scenarios**:

1. **Given** a ticket on a Python/postgres project that modifies `migrations/0042_add_field.py`, `tests/test_users.py`, and `.github/workflows/ci.yml`, **When** the ticket ships, **Then** the outcome's semantic tags include `touched_db_schema`, `touched_tests`, and `touched_ci`, all `true`.
2. **Given** a ticket on a Rust project that touches only `src/lib.rs`, **When** it ships, **Then** all three tags are `false` and the structural domain set includes `src` (top-level segment).
3. **Given** a ticket whose touched files include `app/api/foo.ts` and `lib/billing/charge.ts`, **When** it ships, **Then** structural domains include both `app` and `lib`, with a frequency map reflecting how many files of each segment were touched.
4. **Given** a project declares `services: [postgres]` and `testing.framework: vitest`, **When** outcomes are computed, **Then** the system uses the generic lookup to map those declarations to the correct file-pattern indicators with no per-project config file.

---

### User Story 3 - Per-project backfill of historical shipped tickets (Priority: P1)

Operators can run a backfill for any project to populate outcomes for every historical ticket that previously shipped. The backfill is idempotent (re-running skips already-populated tickets), resumable (transient failures don't lose progress), respects external repository rate limits, and is safe to run while the system serves live traffic.

**Why this priority**: Without backfill, analytics and prediction consumers start with an empty dataset and have to wait months to accumulate enough rows. The platform has 700+ historical shipped tickets — those signals are cheap to capture today and risk being lost if job records or repository commits age out.

**Independent Test**: On a project with a known set of historical shipped tickets (and a known set of cancelled/abandoned tickets that should be ignored), run the backfill twice. Confirm the first run creates one outcome row per shipped ticket, the second run is a no-op (idempotent), no live traffic is impacted (no errors on concurrent SHIPs during backfill), and external API usage stays within published rate limits.

**Acceptance Scenarios**:

1. **Given** a project with 120 historical shipped tickets and no existing outcome rows, **When** backfill runs to completion, **Then** 120 outcome rows exist, one per shipped ticket, indexed by ticket.
2. **Given** the same project after a successful backfill, **When** backfill is re-run, **Then** zero new rows are written and the operation completes quickly (idempotent).
3. **Given** a project where commit metadata for some old tickets is unreachable, **When** backfill runs, **Then** those tickets receive outcome rows with `partial = true` and a `partialReason` code; tickets with reachable commits receive complete rows.
4. **Given** the backfill is interrupted mid-run (process killed, network blip), **When** it is restarted, **Then** it resumes from where it left off and does not re-process tickets that were already written.
5. **Given** backfill is running, **When** new tickets simultaneously transition to SHIP, **Then** live capture continues to function and outcomes for new tickets are persisted without conflict with backfill.
6. **Given** the project's external repository host enforces an hourly request budget, **When** backfill runs across thousands of historical tickets, **Then** the backfill stays under that budget and pauses/yields rather than triggering rate-limit errors.

---

### User Story 4 - Queryable analytics over delivery patterns (Priority: P2)

Once outcomes exist, the platform can answer aggregate questions about its own delivery without bespoke joins: "what fraction of our tickets ship first-shot clean?", "which top-level domains take the most iteration?", "what's the median cost of a SHIP for project X by month?".

**Why this priority**: This is the standalone value the ticket explicitly calls out — even before any prediction feature consumes outcomes, honest delivery analytics is a deliverable. Lower priority than P1 because it depends on capture and backfill being in place, but higher than nothing because it validates the dataset's quality.

**Independent Test**: Run aggregation queries against the outcome dataset filtered by project, by structural domain, and by `frictionFree`. Each query returns results in reasonable time and matches a hand-computed expected answer on a small fixture set.

**Acceptance Scenarios**:

1. **Given** outcomes exist for a project, **When** querying "fraction of shipped tickets where `frictionFree = true`", **Then** the result is a numeric ratio that matches a hand-computed count over the same dataset.
2. **Given** outcomes for a multi-project workspace, **When** filtering by structural domain `app`, **Then** only outcomes whose domain set includes `app` are returned.
3. **Given** outcomes captured at SHIP, **When** the user looks at outcomes for a ticket more than 30 days old, **Then** the row is still present and unchanged (immutability persists across the analytics horizon).

---

### Edge Cases

- A shipped ticket has zero jobs (theoretical edge — should not occur, but if it does, the outcome row is created with all aggregated fields zero and `partial = true`, `partialReason = "no_jobs"`).
- A shipped ticket has no commit references on any job (e.g., legacy data): outcome row created with `partial = true`, `partialReason = "no_commit_reference"`, change-shape fields null, structural domain empty, semantic tags all `false`, job-level signals fully populated.
- The same ticket reaches SHIP, then is reverted to an earlier stage, then shipped again later. The outcome reflects the **first** time SHIP was reached and persists; subsequent SHIP transitions do not overwrite it (immutability).
- A project's stack declarations are missing (`services`, `testing`, or `language` absent from project config). The system falls back to its generic indicator set (e.g., default `tests/**`, `.github/workflows/**`, common DB schema patterns) and continues — semantic tags may yield `false` rather than erroring.
- Two outcome computations race for the same ticket (live capture retry vs backfill picking it up). The persistence layer guarantees at-most-one row per ticket; the second write is a no-op.
- An external repository becomes permanently unreachable for a project during backfill. The backfill marks those tickets `partial = true` rather than failing the whole run.
- A ticket touches **only** non-source files (e.g., docs at the repo root). Domain set may be `{""}` (root) or skip empty segments — outcome must record the truth (root-level changes), not silently drop the ticket.
- Quality score is technically present but null because verify ran but did not produce a score (e.g., agent error). Outcome treats this identically to "no quality score" for `frictionFree` purposes.
- Job command set evolves and a new friction-style command is added. The classification rule is captured by version with the outcome record so future analyses can reinterpret old rows if desired (without rewriting them).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist exactly one structured outcome record per ticket the first time that ticket transitions to stage SHIP, and MUST NOT modify that record thereafter.
- **FR-002**: System MUST capture the outcome within minutes of the SHIP transition for live tickets, without blocking or regressing the SHIP transition itself if outcome computation fails.
- **FR-003**: Outcome record MUST include, at minimum, all of: total cost, total duration, count of pipeline jobs, count of friction jobs, final quality score (nullable), files touched (list), lines added, lines removed, code-vs-test ratio, structural domains (set), structural-domain frequency map, semantic tags (`touched_db_schema`, `touched_tests`, `touched_ci`), `frictionFree` boolean, `partial` boolean, `partialReason` code (nullable), `workflowType`, and the rule-set version used to derive classifications.
- **FR-004**: System MUST aggregate cost, duration, and token telemetry by summing across all jobs belonging to the ticket, regardless of stage or command type.
- **FR-005**: System MUST classify each job as either pipeline or friction. A job is friction if its command starts with `iterate` or `comment-`; otherwise it is pipeline.
- **FR-006**: System MUST compute `frictionFree = true` only when the ticket has zero friction jobs AND a final verify quality score ≥ 75; in all other cases (including null quality score) it is `false`.
- **FR-007**: System MUST extract structural domains as the set of unique top-level path segments across all files touched by the ticket's commits, and MUST also store the per-segment file count.
- **FR-008**: System MUST derive `touched_db_schema`, `touched_tests`, and `touched_ci` from a generic, system-maintained lookup table parameterized by each project's declared `services`, `testing.framework`, and `language`. The mapping MUST work without any per-project domain configuration file.
- **FR-009**: The generic lookup table MUST cover at least the languages and stacks listed in the ticket: TypeScript/Next, Python, Go, Rust, and Zig. Missing coverage for a stack MUST yield `false` tags, never errors.
- **FR-010**: System MUST capture an outcome record for tickets that have no usable commit reference, setting `partial = true`, populating job-level signals fully, leaving change-shape and domain fields empty/null, and setting a `partialReason` code that consumers can filter on.
- **FR-011**: Outcomes MUST be persisted for tickets reaching SHIP under both FULL and QUICK workflow types, with `workflowType` recorded on the outcome.
- **FR-012**: System MUST NOT capture outcomes for tickets that did not reach SHIP (cancelled, abandoned, in-progress).
- **FR-013**: System MUST provide a per-project backfill mechanism that populates outcomes for every historical shipped ticket of that project.
- **FR-014**: Backfill MUST be idempotent: re-running on a project skips tickets that already have an outcome row, with no side effects.
- **FR-015**: Backfill MUST be resumable: an interrupted run picks up from the last successfully processed ticket on restart.
- **FR-016**: Backfill MUST respect external repository API rate limits using the project's existing credentials and MUST NOT introduce any new credentials, secrets, or environment variables for that purpose.
- **FR-017**: Backfill MUST be safe to run concurrently with live SHIP-driven outcome capture without producing duplicate rows or corrupting either path.
- **FR-018**: Outcomes MUST be queryable by project, by `frictionFree`, by `partial`, and by membership in a structural domain (e.g., "outcomes whose domains include `app`").
- **FR-019**: System MUST NOT regress any existing flow — capturing an outcome is purely additive instrumentation. SHIP transitions, job lifecycle, ticket queries, and all existing analytics MUST behave identically when this feature is disabled, when it is enabled but fails, and when it succeeds.
- **FR-020**: System MUST record the rule-set version used for friction classification, semantic tag derivation, and quality threshold on every outcome row, so future analyses can interpret historical rows correctly.
- **FR-021**: When a ticket reaches SHIP more than once (e.g., post-rollback re-ship), the system MUST treat only the **first** SHIP as outcome-defining; subsequent transitions MUST NOT modify the existing row.
- **FR-022**: System MUST never recompute outcomes when the inference rules later change — the outcome is, by contract, a snapshot at SHIP time.

### Assumptions

- Final quality score for `frictionFree` is the verify-job quality score recorded on the most recent COMPLETED verify job belonging to the ticket; this is consistent with how quality score is currently produced (FR-006 depends on this assumption).
- "Within minutes" is the agreed live-capture SLO; tighter latency is not required by current consumers.
- The rule-set version field is monotonically incremented when classification rules change; consumers may treat older rows as authoritative under their original rule version.
- Backfill processes tickets newest-first by default to maximize value of the most recent (and most likely actionable) outcomes early.
- The system will not re-run backfill automatically; operators trigger it. This avoids unintended cost spikes against external APIs.

### Key Entities *(include if feature involves data)*

- **TicketOutcome**: One row per shipped ticket, written exactly once at SHIP. Captures aggregated job telemetry (total cost, total duration, token usage, tools used union), job counts (pipeline, friction, breakdown by command-prefix family), final quality score (nullable), change-shape signals (files touched list, lines added, lines removed, code-vs-test ratio), structural information (top-level domains as a set + per-segment file count map), semantic tags (`touched_db_schema`, `touched_tests`, `touched_ci`), the derived `frictionFree` boolean, the partial-state flag (`partial` + `partialReason`), `workflowType`, and a `ruleSetVersion`. Relations: belongs to one Ticket; belongs to one Project (denormalized for query convenience).
- **StackIndicatorLookup**: A system-owned, generic mapping from a project's declared stack signals (e.g., `services` entries, `testing.framework`, `language`) to file-pattern indicators used for semantic tagging. Not a per-project artifact — lives inside the platform. Relations: read by the outcome-derivation logic; versioned alongside `ruleSetVersion`.
- **BackfillProgress**: Per-project, per-run progress state that records the last processed ticket so backfill can resume after interruption. Relations: belongs to one Project; ephemeral once a run completes successfully.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **OutcomeCaptureOnShip**: Triggered when a ticket transitions to stage SHIP, for both FULL and QUICK workflows.
  - **Input**: Ticket identifier, project context, the ticket's job records (with telemetry, quality score, command type, commit references), and the project's declared stack (`services`, `testing.framework`, `language`).
  - **Phases**:
    1. Verify no outcome already exists for this ticket; if one exists, exit (immutability).
    2. Aggregate job-level telemetry across all jobs of the ticket (cost, duration, tokens, tools).
    3. Classify each job as pipeline or friction by command prefix.
    4. Resolve the ticket's commit references; fetch the union of touched files, lines added, lines removed using the project's existing repository credentials.
    5. Compute structural domains, frequency map, and code-vs-test ratio from touched files.
    6. Derive semantic tags via the StackIndicatorLookup parameterised by the project's declared stack.
    7. Compute `frictionFree` from friction count and quality score threshold.
    8. Persist a single TicketOutcome row, including `ruleSetVersion`.
  - **Output**: Exactly one immutable TicketOutcome row, available for query within minutes.
  - **Error behavior**: If commit fetch fails after retries, persist the row with `partial = true` and the appropriate `partialReason`. If outcome computation fails entirely (e.g., persistence layer down), retry with bounded backoff; the SHIP transition itself is never blocked. No partial row is ever overwritten by a later success — first write wins.

- **HistoricalOutcomeBackfill**: Triggered manually per-project by an operator.
  - **Input**: Project identifier; optional cursor (resume point); optional rate-limit budget override.
  - **Phases**:
    1. Enumerate the project's tickets that have reached SHIP and do not yet have an outcome row.
    2. For each such ticket, run the same outcome-derivation logic as OutcomeCaptureOnShip (steps 2–8 above), but with throttling appropriate for batch processing.
    3. Update BackfillProgress after each successful row write so the run is resumable.
    4. Yield/pause when external API budget is approaching exhaustion; resume after the rate window resets.
  - **Output**: One TicketOutcome row per previously shipped ticket of the project; BackfillProgress reflects the run's terminal state.
  - **Error behavior**: Per-ticket failures (e.g., commit unreachable) produce a `partial = true` row and the run continues. Run-level failures (e.g., process killed) leave previously-written rows untouched and let the next invocation resume from the cursor. Rate-limit hits cause throttling, not row failures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tickets that reach stage SHIP after this feature deploys have a TicketOutcome row persisted within 5 minutes of the SHIP transition (measured over a rolling 7-day window).
- **SC-002**: After running per-project backfill on every project, every historical shipped ticket has an outcome row, with at most a small fraction (target ≤ 5%) flagged `partial` due to unreachable commit metadata.
- **SC-003**: The platform can answer "what fraction of shipped tickets shipped frictionFree?" in a single query against the outcome dataset, returning a numeric answer in under 1 second per project.
- **SC-004**: Backfill completes for a typical project (≤ 1,000 historical shipped tickets) without exceeding the project's external repository API budget — measured by zero rate-limit-error rows in the run log.
- **SC-005**: Re-running backfill on a fully populated project produces zero new outcome rows and zero modifications to existing rows (idempotency).
- **SC-006**: Across all supported stacks (TypeScript/Next, Python, Go, Rust, Zig), at least 95% of outcomes for tickets that touched stack-relevant files (DB schema, tests, CI) carry the corresponding semantic tags as `true`, validated on a curated fixture per stack.
- **SC-007**: No regression in existing flows: SHIP-transition latency increases by no more than a negligible amount (target ≤ 50 ms p95) attributable to outcome enqueueing; existing analytics, job APIs, and ticket queries return identical results before and after the feature ships.
- **SC-008**: Outcome immutability: 0 outcome rows are mutated after creation, verified via a periodic audit query over a representative window.
- **SC-009**: Concurrent live-capture and backfill produce no duplicate rows for the same ticket (uniqueness invariant holds in 100% of cases).
