# Feature Specification: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Feature Branch**: `AIB-773-copy-of-analysis`
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "Copy of Analysis calibration: predicted vs actual + drift dashboard"

## Auto-Resolved Decisions

- **Decision**: Friction confusion matrix binarization — predictions and actuals are mapped onto a "low risk" vs "not low risk" axis (i.e. medium and high collapse into the positive class) so that precision and recall can be reported on the "low risk" class explicitly, as called out in the description.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score +4: data-quality concern, accountability framing, project-owner access — no speed signals)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Drops nuance between medium and high friction in the headline matrix; full 3×3 raw counts are still persisted on the paired record for audit.
  2. Keeps the dashboard simple and aligned with the description's "binary class, easiest to evaluate" guidance.
- **Reviewer Notes**: Confirm that "first-shot-clean = positive low-risk match" mapping aligns with the outcomes feature's `firstShotClean` boolean and the predicted enum values.

- **Decision**: Hit/miss definition for cost-range and quality-gate predictions — a "hit" means the actual value falls within the predicted range (inclusive of bounds); anything below or above the range counts as a "miss" with the direction (under/over) recorded for distribution analysis.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score +3: range-vs-point comparison is standard, accountability framing)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Treats a prediction that is "barely off" the same as one that is "wildly off" in the headline counter; direction is preserved separately so future iterations can refine.
  2. Avoids introducing arbitrary tolerance buffers that would have no objective grounding today.
- **Reviewer Notes**: If the analysis outputs ranges that are sometimes a single point (low and high bounds equal), treat the actual as a hit only on exact equality.

- **Decision**: Pairing trigger — pairing is performed asynchronously when a ticket transitions to stage SHIP and the corresponding outcome record has been persisted; if the outcome arrives later, the pairing is retried until both inputs are present, with a bounded retry window of 24 hours after the SHIP transition.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (score +2: "within minutes" framing in description, but no explicit ordering between SHIP event and outcome capture)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slight delay possible if the outcome capture pipeline lags; tickets where actuals never materialise within 24h are flagged but excluded from drift.
  2. Avoids fragile coupling that would assume a strict event order between two independent features.
- **Reviewer Notes**: Plan phase should confirm whether SHIP transition or outcome record persistence is the safer trigger; either is acceptable if the other is awaited.

- **Decision**: "Most recent analysis" tie-breaking — when multiple analyses exist for a ticket, the one with the latest `createdAt` timestamp counts toward drift metrics; ties (same timestamp to the millisecond) are broken by the highest analysis ID. Older analyses are retained but flagged `excludedFromDrift = true`.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score +3: explicit acceptance criterion, deterministic tie-breaker)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. None of consequence — deterministic, auditable.
- **Reviewer Notes**: Verify the analysis table already exposes a stable monotonic ID alongside `createdAt`.

- **Decision**: Dashboard window — the dashboard surfaces all paired records for a project, with the most recent 30 always included; if more than 30 paired records exist they are all shown, ordered most recent first, but no upper bound is enforced beyond practical pagination (default page size 50).
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (score +2: "at least 30" floor, no ceiling specified)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Owners of long-lived projects can scroll back further at the cost of slightly larger payloads on first load.
  2. Avoids hiding data that owners explicitly want for accountability purposes.
- **Reviewer Notes**: Confirm pagination approach with the ticket dashboard's existing UX conventions.

- **Decision**: Counter denominator — "analyses produced vs tickets passing through INBOX" is computed against tickets that *left* INBOX in the same project (not tickets currently sitting there) so the ratio is stable over time and not skewed by backlog volume.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (score +2: counter is described loosely; need a stable denominator)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A ticket that re-enters INBOX (rollback) would be counted twice in the denominator if it leaves INBOX a second time; analyses re-run on the same ticket are also counted multiple times in the numerator, which keeps the ratio meaningful for "how often do we analyse a ticket that moves out of INBOX".
- **Reviewer Notes**: If rollback semantics inflate counts noticeably in practice, plan phase may wish to deduplicate on `ticketId`.

## User Scenarios & Testing

### User Story 1 - Drift dashboard for project owners (Priority: P1)

A project owner wants to know whether the inbox analysis is accurate enough to trust. They open the analysis drift section of their project's analytics area and immediately see, in tabular form, how the analysis predictions have aligned with actual outcomes across recent shipped tickets — a friction confusion matrix with explicit true/false positives and negatives, the rate at which cost predictions landed inside their range, the rate at which quality predictions landed inside their range, and a usage counter showing how many analysed tickets actually shipped versus how many tickets left INBOX in total.

**Why this priority**: This is the entire reason the feature exists. Without the dashboard, the calibration data is invisible and decisions about the analysis feature stay intuition-based.

**Independent Test**: Seed a project with at least one shipped ticket that had a stored analysis and a captured outcome; sign in as the project owner; open the drift dashboard; verify that the four panels render with the seeded values and that all numeric signals are accompanied by text labels (no color-only encoding).

**Acceptance Scenarios**:

1. **Given** a project owner with three shipped tickets that each have a stored analysis and a captured outcome, **When** they open the analysis drift dashboard, **Then** they see a 2×2 friction confusion matrix with explicit counts of true positives, false positives, true negatives, and false negatives on the "low risk" class, plus precision and recall numbers, all labelled.
2. **Given** the same project, **When** the owner views the cost-range panel, **Then** they see the count of paired records whose actual cost fell inside the predicted range and the count of those that fell outside (split by under/over), as a labelled table.
3. **Given** the same project, **When** the owner views the quality-gate panel, **Then** they see the count of paired records whose actual quality score fell inside the predicted range and those outside, as a labelled table.
4. **Given** the same project, **When** the owner views the usage panel, **Then** they see "X analysed tickets shipped vs Y tickets left INBOX" with both values rendered as text alongside the ratio.

---

### User Story 2 - Pairing predictions with actual outcomes at SHIP (Priority: P1)

The system is responsible for the pairing itself. When any ticket that has at least one stored analysis transitions to SHIP and its outcome record has been captured, the system computes the deltas between the latest analysis's predictions and the actual outcome and persists them as a paired record. This happens automatically and without operator intervention.

**Why this priority**: Without this pairing, the dashboard has nothing to show. It is the foundation of every other capability in this feature.

**Independent Test**: Create a ticket with a stored analysis, drive it through to SHIP, ensure the outcome capture has run, and verify that within minutes a paired record exists in the database with deltas for friction, cost, quality, and workflow recommendation, referencing the latest analysis (not an older one if multiple exist).

**Acceptance Scenarios**:

1. **Given** a ticket with one stored analysis and a captured outcome, **When** the ticket reaches SHIP, **Then** a paired record is persisted within 5 minutes containing: predicted friction, actual first-shot-clean status, predicted cost range, actual cost, predicted quality range, actual quality, predicted workflow recommendation, actual workflow used, and whether friction emerged.
2. **Given** a ticket with three stored analyses and a captured outcome, **When** the ticket reaches SHIP, **Then** the pairing references the most recent analysis only; the older two are kept in storage but marked excluded from drift.
3. **Given** a ticket with no stored analysis, **When** it reaches SHIP, **Then** no paired record is created and no error is logged as a failure.
4. **Given** a ticket with a stored analysis but with the outcome record not yet persisted at SHIP, **When** the outcome record subsequently lands within 24 hours, **Then** the pairing is created retroactively; if no outcome lands within 24 hours, the ticket is flagged as unpaired and excluded from drift.

---

### User Story 3 - Access restricted to project owners (Priority: P2)

Members and non-members of a project must not see the drift dashboard. Only the owner of a project sees their own project's dashboard.

**Why this priority**: The dashboard exposes information about the analysis feature's quality, which is sensitive to the team and not user-facing in the product. Restricting it now avoids creating a precedent that this loop is for everyone.

**Independent Test**: Sign in as a project member (not owner) and a non-member; in both cases attempt to load the drift dashboard URL or section; verify access is denied. Sign in as the owner; verify access succeeds.

**Acceptance Scenarios**:

1. **Given** a user who is a member of a project but not its owner, **When** they request the drift dashboard for that project, **Then** access is denied with a clear "owner only" message.
2. **Given** a user who is not a member of a project, **When** they request the drift dashboard for that project, **Then** access is denied as if the resource did not exist.
3. **Given** the owner of a project, **When** they request the drift dashboard, **Then** access succeeds and they see only their own project's data.

---

### User Story 4 - Audit trail for older analyses (Priority: P3)

When a ticket has been analysed multiple times, the older analyses are not silently dropped. They are kept on the ticket and remain visible in the ticket's existing analysis history, but they are explicitly marked as "not counted toward drift" so a viewer of the audit trail understands why the dashboard only reflects one analysis per ticket.

**Why this priority**: This protects the integrity of the drift signal (no double-counting) while preserving the historical record. It is lower priority because it is an audit nicety, not the headline value.

**Independent Test**: Create a ticket with three analyses, drive it to SHIP, then inspect the ticket's stored analyses; verify the most recent is flagged as `countedInDrift = true` and the other two as `excludedFromDrift = true`.

**Acceptance Scenarios**:

1. **Given** a ticket with three analyses and a paired record, **When** an auditor lists analyses for that ticket, **Then** exactly one is flagged as counted toward drift and the rest are flagged as excluded.

---

### Edge Cases

- **Ticket reaches SHIP with no analysis ever stored**: no paired record is created; the dashboard ratio's denominator still increments (ticket left INBOX) so the "analysed vs total" ratio reflects reality.
- **Analysis was stored but the outcome capture never ran or failed**: pairing waits up to 24 hours, then the ticket is flagged unpaired and excluded from drift; no false data appears in the dashboard.
- **Predicted cost range is missing on the analysis (older analyses generated before the field existed)**: the cost-range panel excludes that paired record from its denominator and labels it as "incomparable" in the audit record, so it does not skew the rate.
- **Project has fewer than 30 shipped+analysed tickets**: the dashboard renders with whatever count exists and labels the sample size explicitly so owners know not to over-interpret.
- **Project has zero shipped+analysed tickets**: the dashboard renders an empty state explaining that no paired records exist yet, with the usage counter still showing "0 analysed shipped / N tickets left INBOX".
- **Ticket is rolled back from VERIFY to PLAN and ships later**: only the SHIP that actually occurs triggers pairing; intermediate transitions do not.
- **A ticket is analysed after it has already been shipped (re-analysis post-ship)**: that analysis is stored but never paired, since the ship-time snapshot is already locked in.
- **Two paired records would be created for the same ticket due to a duplicate SHIP event**: pairing is idempotent on `(ticketId)` — the existing record is updated rather than duplicated.
- **A ticket's analysis predicted FULL but it was actually run as QUICK (or vice versa)**: the workflow recommendation is recorded as a mismatch, and the "friction emerged regardless" flag is also recorded so owners can see the dual signal explicitly.
- **The dashboard is opened by an owner whose project has been transferred**: only the current owner of record at view time has access.

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect when a ticket transitions to stage SHIP and, if at least one analysis is stored for that ticket, attempt to create a paired record within 5 minutes of the SHIP transition (subject to the outcome record being available).
- **FR-002**: System MUST select the most recent analysis (by `createdAt`, ties broken by highest analysis ID) as the basis for the paired record; older analyses MUST be retained and explicitly flagged as excluded from drift.
- **FR-003**: System MUST compute and persist, on the paired record, the following deltas: predicted-vs-actual friction (predicted enum, actual first-shot-clean boolean, derived match), predicted-vs-actual cost (predicted range, actual value, hit boolean, miss direction), predicted-vs-actual quality (predicted range, actual value, hit boolean, miss direction), predicted-vs-actual workflow recommendation (predicted enum, actual enum, match boolean), and whether friction emerged regardless of recommendation match.
- **FR-004**: System MUST NOT create a paired record for a ticket that has no stored analysis at the time of SHIP, and MUST NOT log this as a failure.
- **FR-005**: System MUST retry pairing for a ticket whose analysis is stored but whose outcome record is not yet available at SHIP, for up to 24 hours after the SHIP transition; after that, the ticket MUST be flagged as unpaired and excluded from drift.
- **FR-006**: System MUST treat the pairing operation as idempotent on `ticketId` so that duplicate SHIP events update the existing record rather than create a second one.
- **FR-007**: System MUST expose a drift dashboard at the project level, accessible only to the user who currently owns the project; members, non-members, and former owners MUST be denied access.
- **FR-008**: Drift dashboard MUST display a friction confusion matrix on the "low risk" class, showing explicit counts of true positives, false positives, true negatives, and false negatives, plus precision and recall figures, all rendered with text labels and tabular layout (no color-only encoding).
- **FR-009**: Drift dashboard MUST display a cost-range hit/miss panel showing the count of paired records where actual cost was inside the predicted range, the count where it was below the range, and the count where it was above the range, in a labelled table.
- **FR-010**: Drift dashboard MUST display a quality-gate hit/miss panel with the same structure as the cost-range panel, applied to the actual quality score versus the predicted quality range.
- **FR-011**: Drift dashboard MUST display a usage panel showing the count of analysed tickets that have shipped, the count of tickets that have left INBOX in total for the project, and the resulting ratio, all as text and number values.
- **FR-012**: Drift dashboard MUST surface at least the 30 most recent paired records per project; when more exist they MUST also be available, with pagination if needed; when fewer exist the actual sample size MUST be labelled explicitly.
- **FR-013**: Drift dashboard MUST NOT modify the analysis prompt, alert on threshold breaches, or auto-correct any data; it is read-only.
- **FR-014**: System MUST NOT change the existing inbox analysis flow or the outcomes capture flow as a side effect of this feature.
- **FR-015**: System MUST handle paired records where a particular predicted dimension is missing (e.g., older analysis without a quality range) by excluding that record from that single panel's denominator and counting it as "incomparable" in audit storage, while still counting the other dimensions where data exists.
- **FR-016**: System MUST keep all paired records and the analyses they reference scoped to a single project; cross-project aggregation MUST NOT be possible from this dashboard.
- **FR-017**: System MUST apply the same pairing logic uniformly to every project, with no per-project special cases or overrides.

### Key Entities

- **AnalysisOutcomePairing**: One row per shipped ticket that had at least one stored analysis. Stores a reference to the ticket, the analysis used as the basis, the captured outcome, and the computed deltas across the four dimensions (friction, cost, quality, workflow recommendation). Carries an `unpairedReason` field for the rare case where pairing failed within the retry window.
- **AnalysisDriftFlag (on Analysis)**: A boolean (or equivalent) on the existing analysis records indicating whether that analysis is the one counted toward drift for its ticket. The most recent analysis per ticket is `true`; older analyses on the same ticket are `false`. Default before SHIP is `false` for all analyses; the flag is set at pairing time.
- **DriftDashboardSnapshot (computed view, not necessarily stored)**: The aggregated representation surfaced to owners, derived from `AnalysisOutcomePairing` records joined with the ticket-leaving-INBOX counter. Not a separate table unless query performance requires it; if materialised, refreshed reactively, never on a separate ETL schedule.

### Internal Processes

- **Pairing process**: Triggered when a ticket reaches stage SHIP.
  - **Input**: The ticket's identifier; the latest stored analysis for that ticket (if any); the captured outcome record (if any).
  - **Phases**:
    1. Detect SHIP transition for a given ticket.
    2. Look up the most recent analysis for that ticket; if none exists, exit successfully without creating a paired record.
    3. Look up the outcome record; if not yet available, schedule a retry within the 24-hour window.
    4. Compute deltas across friction, cost, quality, and workflow recommendation dimensions.
    5. Upsert the paired record keyed on the ticket identifier.
    6. Set the `countedInDrift` flag on the chosen analysis to `true` and on all other analyses for that ticket to `false`.
  - **Output**: An `AnalysisOutcomePairing` row, an updated set of analysis flags, and (if applicable) an `unpairedReason` for tickets that never paired within 24 hours.
  - **Error behavior**: Retries are bounded to 24 hours after SHIP. Failures inside the retry window are logged but do not interrupt the SHIP flow itself. After the window, the ticket is flagged unpaired and excluded from drift; no further retries are attempted unless an operator triggers them manually.

## Success Criteria

### Measurable Outcomes

- **SC-001**: When a ticket with a stored analysis reaches SHIP, the corresponding paired record is queryable within 5 minutes in 95% of cases (measured over a rolling 7-day window).
- **SC-002**: The drift dashboard for any project with at least one shipped+analysed ticket loads its full set of panels (confusion matrix, cost panel, quality panel, usage panel) in under 2 seconds at the 95th percentile.
- **SC-003**: An owner can identify, in under 30 seconds of looking at the dashboard, whether the friction prediction has been more right than wrong on the "low risk" class, and by how much, without needing additional documentation.
- **SC-004**: After 30 days of operation on a project that ships at least 30 analysed tickets, the dashboard reflects all 30 most recent paired records with no more than 1 missing pairing attributable to the 24-hour retry window expiring.
- **SC-005**: 100% of dashboard signals are accessible without relying on color (every numeric or categorical signal is reinforced by a text label or tabular value), as verified by an accessibility audit pass.
- **SC-006**: 0 cross-project data leakage incidents — no project owner ever sees data from a project they do not own; verified through automated authorization tests covering the dashboard endpoints.
- **SC-007**: 0 regressions on the inbox analysis or outcomes capture flows attributable to this feature, as measured by their existing test suites continuing to pass unchanged.
