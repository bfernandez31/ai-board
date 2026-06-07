# Feature Specification: Insights Analysis Covers All Agent Sessions of Every Ticket

**Feature Branch**: `AIB-856-copy-of-insights`
**Created**: 2026-06-07
**Status**: Draft
**Input**: User description (AIB-856): "[Insights] Analyser toutes les sessions d'un ticket, pas qu'une seule" — the platform-wide Insights analysis currently keeps only one agent session per shipped ticket (the earliest, typically SPECIFY) and ignores the rest (plan / implement / iterate / verify), so the global diagnostic is partial and not representative of how the platform actually behaved.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Analysis scope stays **global across all projects** (no per-project filter), as the ticket explicitly mandates. The feature continues to characterize platform/harness behavior, not a single project.
- **Policy Applied**: AUTO (explicit ticket directive reinforced)
- **Confidence**: High — the ticket states this as a hard constraint and an acceptance criterion.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeps the broad, representative corpus the feature is designed for.
  2. No additional filtering complexity introduced.
- **Reviewer Notes**: Confirm no project filter is reintroduced anywhere in selection or counting.

- **Decision**: Session selection is driven by a **reliable per-session marker** (each agent session is individually tracked as "analyzed / not yet analyzed") rather than a single global time cursor. Consecutive analyses pick up exactly the sessions not yet covered.
- **Policy Applied**: AUTO → CONSERVATIVE fallback (data-integrity priority)
- **Confidence**: Medium — the ticket describes the boundary defect but not the exact mechanism; the cautious choice prevents lost or double-counted sessions.
- **Fallback Triggered?**: Yes — coverage/no-loss has higher impact than convenience, so the most cautious "no gap, no overlap" guarantee was chosen.
- **Trade-offs**:
  1. Eliminates window-boundary loss and double counting (core goal).
  2. Requires durable per-session state instead of a single timestamp.
- **Reviewer Notes**: Validate that a session analyzed once is never re-analyzed, and one never analyzed is always eligible next run.

- **Decision**: The analysis corpus includes **all Claude agent sessions regardless of ticket outcome** — shipped, in-progress, failed, abandoned, and rolled-back tickets — selected by session activity time, not by ticket SHIP. Only sessions whose captured transcript still exists are eligible.
- **Policy Applied**: AUTO → CONSERVATIVE fallback (completeness of the platform diagnostic)
- **Confidence**: Medium — the ticket flags non-shipped work as "often the most instructive" and requires an explicit, documented scope decision; including it best serves the stated goal.
- **Fallback Triggered?**: Yes — chose the more complete corpus over the narrower shipped-only scope.
- **Trade-offs**:
  1. Surfaces friction in tickets that never shipped (where work most often stalls).
  2. Larger corpus per run; relies on transcript retention for eligibility.
- **Reviewer Notes**: Confirm the decision is documented in-product/spec and that pre-flight and reporting reflect non-shipped sessions.

- **Decision**: A session is **eligible only if its captured transcript is still available**; sessions whose transcript has aged out of retention are excluded from "expected" eligibility and reported transparently as a discrepancy, never silently dropped.
- **Policy Applied**: AUTO → CONSERVATIVE fallback (honest reporting)
- **Confidence**: Medium — retention can prune transcripts between activity and analysis; the cautious choice avoids promising sessions that cannot be read.
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Prevents the run from failing on unreadable sessions.
  2. Introduces an "expected vs analyzed" gap that must be explained to the viewer.
- **Reviewer Notes**: Confirm pruned/unreadable sessions are counted as a reported gap, not as analyzed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every session of every ticket is analyzed (Priority: P1)

As a platform administrator, when I run an Insights analysis I want it to consider **all** agent sessions of each ticket in the period (specify → plan → implement → iterate → verify), across all projects — not just the first session — so that the diagnostic reflects where the real work and friction actually happened.

**Why this priority**: This is the core defect. Today only the earliest session per ticket (typically the thinnest, SPECIFY) is analyzed, making every report unrepresentative. Fixing this delivers the primary value on its own.

**Independent Test**: Take a multi-session FULL ticket with distinct specify/plan/implement/iterate/verify sessions, run an analysis covering its period, and confirm all of those sessions are part of the analyzed corpus (verifiable via the analyzed-session count and the resulting report content) — not just one.

**Acceptance Scenarios**:

1. **Given** a FULL ticket with five Claude sessions (specify, plan, implement, iterate, verify) all having captured transcripts in the period, **When** an analysis runs, **Then** all five sessions are included in the corpus and counted as analyzed.
2. **Given** tickets belonging to several different projects in the period, **When** an analysis runs, **Then** sessions from every project are included with no per-project filtering.
3. **Given** a ticket with implement/iterate/verify sessions, **When** an analysis runs, **Then** those later sessions (not only the earliest specify session) influence the produced report.

---

### User Story 2 - No session lost or counted twice between consecutive analyses (Priority: P1)

As a platform administrator running analyses periodically, I want two consecutive analyses to neither overlap nor skip any session at the period boundary, so that every session is analyzed exactly once over time.

**Why this priority**: A session silently lost at a window boundary is lost permanently; a session counted twice distorts the diagnostic. Reliable once-and-only-once coverage is essential for trust in the feature.

**Independent Test**: Run analysis A, then create new sessions (including one active right around the boundary), then run analysis B; confirm every session appears in exactly one of the two runs.

**Acceptance Scenarios**:

1. **Given** an analysis has completed, **When** a second analysis runs later, **Then** no session already analyzed by the first is analyzed again.
2. **Given** a session that is active right at the boundary between two runs, **When** the second analysis runs, **Then** that session is analyzed exactly once (neither dropped nor duplicated).
3. **Given** an analysis that fails partway, **When** it is retried or a later analysis runs, **Then** sessions not successfully analyzed remain eligible and are not marked as covered.

---

### User Story 3 - Sessions from non-shipped tickets are included (Priority: P2)

As a platform administrator, I want sessions from tickets that are still in progress, failed, abandoned, or rolled back in VERIFY to be included in the analysis, so that the most instructive friction (where work stalled) is not invisible.

**Why this priority**: The ticket calls out that unshipped work is "often the most instructive." It broadens coverage meaningfully but builds on the per-session selection from US1/US2.

**Independent Test**: With a ticket that ran sessions but never shipped (e.g., rolled back from VERIFY to PLAN), run an analysis covering its period and confirm its sessions are in the analyzed corpus.

**Acceptance Scenarios**:

1. **Given** a ticket with completed agent sessions but no SHIP outcome, **When** an analysis runs, **Then** its sessions are eligible and analyzed.
2. **Given** a ticket rolled back in VERIFY, **When** an analysis runs, **Then** its sessions are included.
3. **Given** the included scope (shipped + non-shipped), **When** a reviewer reads the spec/report, **Then** the scope decision is explicitly documented.

---

### User Story 4 - Report shows analyzed vs expected session counts (Priority: P2)

As a platform administrator reading a completed report, I want to see how many sessions were actually analyzed versus how many were expected for the period, and to be warned of any gap, so I can judge how complete and trustworthy the diagnostic is.

**Why this priority**: Without a visible analyzed-vs-expected figure, partial coverage (e.g., pruned transcripts) is indistinguishable from full coverage — the original "impression that sessions are missing" persists.

**Independent Test**: Construct a period where some eligible sessions cannot be read (transcript pruned) and confirm the report shows analyzed < expected and surfaces the discrepancy.

**Acceptance Scenarios**:

1. **Given** a completed analysis where every eligible session was readable, **When** the report is displayed, **Then** it shows the analyzed session count equal to the expected count for the period.
2. **Given** a completed analysis where some eligible sessions' transcripts were pruned, **When** the report is displayed, **Then** it shows analyzed < expected and clearly signals the shortfall.
3. **Given** any completed report, **When** it is displayed, **Then** the count reflects all sessions of all in-scope tickets (not a per-ticket-deduplicated count).

---

### Edge Cases

- **Pruned transcript**: An eligible session's captured transcript ages out of retention between becoming eligible and being analyzed → excluded from "analyzed", reported as part of the expected-vs-analyzed gap, never silently dropped, and the run does not fail solely because of it.
- **No new sessions since last run**: Analysis is refused with a clear "nothing new to analyze" message (current refusal behavior preserved, re-expressed in session terms rather than shipped-ticket terms).
- **First-ever run**: Covers all eligible sessions from the earliest available session forward.
- **Session active during an in-flight analysis**: A session that becomes eligible while an analysis is running is not assumed covered by that run; it remains eligible for the next run.
- **Same session appearing under multiple jobs/tickets**: Counted and analyzed once, never duplicated.
- **Concurrent trigger attempts**: A second analysis cannot start while one is running (existing single-run guard preserved).
- **Window boundary exactly at a session timestamp**: Deterministic inclusion rule so the session lands in exactly one run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analysis MUST remain global across all projects; it MUST NOT be re-scoped or filtered to a single project at any selection, counting, or reporting step.
- **FR-002**: For each in-scope ticket, the analysis MUST include **all** of its Claude agent sessions in the period (specify, plan, implement, iterate, verify, and any other Claude session command), not only the earliest one.
- **FR-003**: The system MUST NOT de-duplicate to a single session per ticket; every distinct session is an independent unit of analysis.
- **FR-004**: Session selection MUST be based on a reliable per-session marker that records whether each session has already been analyzed, rather than a single global time cursor.
- **FR-005**: Two consecutive analyses MUST NOT overlap (no session analyzed twice) and MUST NOT skip any session at the period boundary (no session lost).
- **FR-006**: A session that has not been successfully analyzed MUST remain eligible for a future analysis; a failed or aborted run MUST NOT mark its sessions as covered.
- **FR-007**: The analysis corpus MUST include sessions from tickets regardless of outcome — shipped, in-progress, failed, abandoned, and rolled-back — selected by session activity rather than by ticket SHIP status.
- **FR-008**: The decision to include non-shipped tickets' sessions MUST be explicitly documented (in this spec and surfaced to administrators, e.g., via report context describing the corpus).
- **FR-009**: A session is eligible for analysis only if its captured transcript is still available; sessions whose transcript is unavailable MUST be excluded from the analyzed set and accounted for as a reported gap, not silently omitted.
- **FR-010**: A completed report MUST display the number of sessions actually analyzed and the number expected for the period (all eligible Claude sessions since the last analysis).
- **FR-011**: When analyzed sessions are fewer than expected, the report MUST clearly signal the discrepancy and its scope so the viewer understands coverage is partial.
- **FR-012**: The pre-flight / trigger gate MUST decide whether a new analysis can run based on the presence of not-yet-analyzed eligible sessions (rather than newly shipped tickets), and MUST present a clear message when there is nothing new to analyze.
- **FR-013**: The single-run concurrency guarantee MUST be preserved: at most one analysis runs at a time, and a session becoming eligible during an in-flight run remains eligible for the next run.
- **FR-014**: First-ever analysis MUST cover all eligible sessions from the earliest available session onward.
- **FR-015**: The session count surfaced in reports MUST reflect every analyzed session (not a per-ticket-deduplicated count); any retained ticket count MUST stay consistent with this all-sessions corpus.

### Key Entities *(include if feature involves data)*

- **Insights Analysis Run**: A single execution of the platform-wide analysis. Has a status (running / completed / failed), a period it covers, the count of sessions analyzed, the count of sessions expected, and an indication of any coverage gap. Produces a report artifact.
- **Agent Session**: One agent run for a ticket stage (specify, plan, implement, iterate, verify, etc.), with an activity time, an owning ticket and project, and an associated captured transcript. The unit of analysis. Carries a per-session "analyzed" marker.
- **Ticket Outcome / Status**: Whether and when a ticket shipped (and otherwise its lifecycle state). Informs reporting context but no longer gates which sessions are eligible.
- **Coverage Accounting**: For a given run, the relationship between expected eligible sessions and actually analyzed sessions, including the reason for any shortfall (e.g., unavailable transcript).

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Insights Analysis Process**: Triggered by an administrator (or pre-flight-gated trigger) to characterize platform/harness behavior across all projects.
  - **Input**: The set of not-yet-analyzed eligible Claude agent sessions across all projects, identified via the per-session marker; the period boundaries derived from that set.
  - **Phases**:
    1. Determine eligible sessions (all Claude sessions with available transcripts, any ticket outcome, not yet analyzed).
    2. Establish the expected session count for the run.
    3. Retrieve each eligible session's transcript; account for any that cannot be retrieved as a coverage gap.
    4. Analyze the full multi-session corpus to produce the diagnostic report.
    5. Record analyzed-session count, expected count, and any discrepancy on the run; mark the successfully analyzed sessions as covered.
  - **Output**: A completed report artifact, the run's analyzed/expected counts and discrepancy indicator, and per-session "analyzed" markers updated for the covered sessions.
  - **Error behavior**: On failure, the run is marked failed with a reason; sessions are NOT marked covered, so they remain eligible for a later run. Unavailable individual transcripts do not fail the whole run; they are reported as a gap. The single-run guard prevents concurrent executions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a FULL ticket with N distinct sessions in the period, 100% of those N sessions (not 1) are included in the analyzed corpus.
- **SC-002**: Across two consecutive analyses over a set of sessions, every session is analyzed exactly once — 0% lost and 0% double-counted, including sessions active at the boundary.
- **SC-003**: 100% of analyses keep global scope — sessions from every project with eligible sessions in the period are represented; 0 analyses are restricted to a single project.
- **SC-004**: Sessions from non-shipped tickets (in-progress, failed, rolled-back) that have available transcripts in the period are included in 100% of runs, and the scope decision is documented.
- **SC-005**: Every completed report displays both the analyzed and expected session counts, and any run where analyzed < expected visibly signals the gap (100% of such runs).
- **SC-006**: When all eligible transcripts are available, analyzed count equals expected count (no unexplained shortfall) in 100% of runs.
