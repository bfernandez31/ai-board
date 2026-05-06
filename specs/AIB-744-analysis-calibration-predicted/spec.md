# Feature Specification: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Feature Branch**: `AIB-744-analysis-calibration-predicted`
**Created**: 2026-04-30
**Status**: Draft
**Input**: User description: "Analysis calibration: predicted vs actual + drift dashboard — pair every analyzed-then-shipped ticket's stored predictions (friction, quality range, cost range, QUICK/FULL recommendation) with the captured outcome, persist the deltas as a snapshot, and surface a project-owner-only drift dashboard reflecting at least the last 30 shipped+analyzed tickets per project."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

> **AUTO scoring**: signals detected — owner-only access control (+3), audit/accountability framing (+2), reliability of downstream join (+2), no regression on dependent features (+1), neutral feature context (+1), informative-not-prescriptive framing (−2). **netScore = +7**, no conflicting buckets. **Suggested policy: CONSERVATIVE (confidence High, 0.9)**. Applied to every decision below.

- **Decision**: Pairing is triggered by **outcome-capture completion**, not by the raw SHIP transition itself, so the actuals are guaranteed to exist before the join runs. The "within minutes of the SHIP event" SLO is preserved end-to-end (SHIP → outcome capture → calibration), and a bounded retry runs the pairing if its dependencies are not yet ready.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Eliminates a race condition between this feature and AIB-742, at the cost of a small additional latency that is invisible to users.
  2. Calibration depends on AIB-742's "within minutes" capture SLO; if that SLO regresses, this feature's SLO regresses with it.
- **Reviewer Notes**: Confirm AIB-742 emits a stable signal (terminal status on its outcome record) that this feature can listen to or poll, rather than re-implementing outcome readiness detection.

- **Decision**: Friction confusion matrix uses a **binary positive class**: predicted "low" maps to "predicted clean", predicted "medium" or "high" map to "predicted friction"; actual `frictionFree = true` is the positive class. The 2x2 cells (TP / FP / FN / TN) are stored explicitly on every calibration row. The full 3-class predicted rating is also persisted alongside, so a future drill-down can distinguish medium from high without remigrating data.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Binary class is the simplest framing that lets us compute precision and recall on "low risk" — the explicit headline metric.
  2. Storing the 3-class rating alongside costs a few bytes per row but preserves audit integrity if the binarisation rule is later challenged.
- **Reviewer Notes**: Confirm "low risk = predicted clean" is the right collapsing rule; medium-vs-high distinction is intentionally hidden from the headline matrix.

- **Decision**: A quality hit is recorded when the actual quality score falls **inside the predicted `[lower, upper]` range, inclusive of both bounds**. Tickets whose actual quality score is null (QUICK workflow, no verify) are recorded as **`n/a`**, not as hit or miss; the distribution chart surfaces hits, misses, and `n/a` as three explicit buckets so QUICK tickets cannot inflate or deflate the headline rate.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Inclusive bounds favour the analysis when the actual lands exactly on the edge — defensible because the prediction is itself a coarse range.
  2. `n/a` as a distinct bucket protects count integrity at the cost of one extra label users must read.
- **Reviewer Notes**: Confirm cold-start analyses (which by spec lack a numeric quality range) are excluded from the quality bucket entirely (see latest-analysis decision below) rather than being tallied as `n/a`.

- **Decision**: A cost hit is recorded when the actual aggregated cost falls inside the **summed predicted range**: `[baselineLower + marginalLower, baselineUpper + marginalUpper]`. Predicted cost components are decomposed (baseline pipeline cost + marginal friction cost) per AIB-743's contract, so the summed range matches what the user saw before clicking. Null actual cost (every job had null `costUsd`) is recorded as `n/a`.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Comparing against the summed range matches the user-facing "expected cost" line and avoids favouring or disfavouring the prediction by picking a sub-component.
  2. Decomposed components are still persisted on the calibration row so a future drill-down (baseline-only hit rate vs marginal-only hit rate) is possible without re-deriving from analysis rows.
- **Reviewer Notes**: Confirm the predicted range stored on the analysis row contains explicit lower and upper bounds for both components (per AIB-743 FR-017); calibration should fail loudly if those fields are missing rather than silently coercing to zero.

- **Decision**: The QUICK/FULL recommendation is paired on **two independent axes**, both stored:
  (a) `recommendationMatched` — `true` if the recommendation equals the actual `workflowType`,
  (b) `recommendationFrictionAligned` — `true` if `(recommendation = QUICK AND actual frictionFree)` OR `(recommendation = FULL AND NOT actual frictionFree)`.
  The dashboard surfaces both rates separately because a recommendation can be "matched" (the user followed it) yet still wrong in hindsight (friction emerged anyway).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Two axes give a more honest picture than collapsing them into a single boolean — directly addresses the spec's "compared against the workflow type that was actually used and against whether friction emerged regardless".
  2. Slightly more complex UI; mitigated by labelling each axis explicitly on the dashboard.
- **Reviewer Notes**: Confirm `actualWorkflowType` reads from the persisted `Ticket.workflowType` field, which is set once and never changes per the project conventions in CLAUDE.md.

- **Decision**: When a ticket has multiple analyses, the calibration row pairs **the most recent analysis with status `success`** at the moment outcome capture completes. Analyses with status `cold_start`, `failed`, or `running` are skipped (cold-start lacks numeric ranges; failed has no output; running is incomplete). If no `success` analysis exists for the ticket, **no calibration row is created** and the ticket is excluded from drift metrics, but it still counts in the adoption counter (entered INBOX, may or may not have been analyzed).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Restricting drift to `success` analyses keeps every cell of the confusion matrix populated by comparable inputs — the metric stays meaningful.
  2. Cold-start tickets are visible on the ticket itself (panel) but absent from the drift view; this is intentional (no numeric ranges to compare).
- **Reviewer Notes**: Confirm the "older analyses kept for audit" requirement is satisfied by AIB-743's append-only table — this feature does not need to copy older rows; the pointer to the paired row is sufficient.

- **Decision**: Storage is a **dedicated append-only `AnalysisCalibration` table, one row per ticket** (1:1 keyed by `ticketId`). The row references the paired `TicketAnalysis` row and the paired `TicketOutcome` row by foreign key. Once written, the row is immutable; if a ticket is later re-shipped (rollback then re-ship — out of scope per current platform behaviour), no replacement row is created.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 1:1 keying enforces the "latest analysis paired against actual" rule at the schema level — duplicates are impossible by construction.
  2. Immutability matches the snapshot philosophy of AIB-742 and protects historical drift data from drift in the pairing rules themselves.
- **Reviewer Notes**: Confirm `@@unique([ticketId])` is the right cardinality given the platform never re-ships a ticket; if cross-version re-ships ever become a thing, a `version` axis can be added without breaking existing rows.

- **Decision**: When the paired outcome is `partial = true` (per AIB-742), the calibration row is **still created**: telemetry-derived comparisons (cost, friction-free which is computed regardless) populate normally, while change-shape-derived comparisons that would depend on missing data are recorded as `n/a` with a `partialReason` snapshot. The row contributes to adoption counts but its `n/a` cells are excluded from the headline rates.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Always creating a row preserves count integrity ("X tickets shipped + analyzed = X calibration rows") and matches AIB-742's own partial-row stance.
  2. Consumers must read the `n/a` flags rather than treating null cells as "missed"; the headline charts handle this explicitly.
- **Reviewer Notes**: Confirm cost is the only telemetry-derived comparable that survives a partial outcome; friction-free is also derivable since it depends on quality + friction-job count, both job-level fields.

- **Decision**: Re-pairing on outcome change is **never performed**. AIB-742 outcomes are immutable; this feature inherits that immutability. If a future feature retroactively recomputes outcomes (out of scope), it is that feature's responsibility to also recompute affected calibration rows or to emit new rows under a versioned schema.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. One-shot pairing matches the snapshot philosophy and is the simplest correct semantics.
  2. Future calibration improvements cannot retroactively benefit existing rows; deemed acceptable for an informative dashboard.
- **Reviewer Notes**: Document the immutability invariant on the API contract so consumers know the data is point-in-time.

- **Decision**: The drift dashboard is restricted to **project owners only** via the existing `verifyProjectOwnership` helper. Members and non-members are shown a generic "not found" response (no leak that the dashboard exists for that project). No new role or permission tier is introduced.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Owner-only is the explicit acceptance criterion; reusing the existing helper minimises authorization regression risk.
  2. Members of the project can view individual analyses on the ticket but not the aggregated drift view; deemed correct for a feature labelled "internal to project owners for now".
- **Reviewer Notes**: Confirm `verifyProjectOwnership` is the canonical owner-only gate used elsewhere; this feature should reuse it directly.

- **Decision**: The dashboard reflects **the most recent 30 shipped+analyzed tickets per project** for distributions and the confusion matrix. The acceptance criterion ("at least the last 30") is interpreted as a minimum window: the dashboard surfaces 30 by default and indicates when the underlying dataset is larger (e.g., "30 of 47 shipped+analyzed tickets"). The adoption counter uses a separate, broader denominator (see next decision).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A fixed 30-row window keeps the dashboard interpretable; older calibration rows remain in the table for future per-window selection.
  2. Projects with fewer than 30 calibration rows show a "still warming up" indicator instead of an empty state — clearer than a partially populated chart.
- **Reviewer Notes**: PLAN may surface a window selector (e.g., 30 / 60 / 90); the default of 30 satisfies the explicit spec.

- **Decision**: The **adoption counter** is "tickets that entered INBOX in the project since the analysis feature was first available" vs "of those, how many received at least one persisted analysis". This denominator is bounded per project and is project-agnostic relative to drift metrics — adoption is shown alongside drift but is not gated by the 30-row window. A ticket counts as "analyzed" if it has ≥1 row of any status (including failed and cold_start), so the counter reflects user attempts, not just successful runs.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Counting attempted analyses (any status) reflects the spec's "how often the feature is actually used" — not just how often it succeeded.
  2. The denominator excludes tickets created before the analysis feature shipped on the project, so older inboxes do not depress adoption artificially.
- **Reviewer Notes**: Confirm a per-project marker exists (or can be derived) for "feature first available on this project"; absent that, fall back to "tickets created on or after the first analysis row in the project".

- **Decision**: Pairing failure handling — if the calibration job cannot complete after bounded retries (e.g., a transient infrastructure issue), **no calibration row is written** for that ticket and the failure is logged for observability. SHIP and outcome capture are not affected; the ticket is silently excluded from drift metrics. A subsequent owner-initiated re-pair is **out of scope** for this feature.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Failure does not cascade to user-visible flows — the dashboard is a downstream consumer and must never block delivery.
  2. A small fraction of calibration rows may be missing after persistent infrastructure incidents; acceptable for an informative dashboard.
- **Reviewer Notes**: Confirm the existing job-failure observability (logs, alerting) is sufficient; no new alert channel is introduced here.

- **Decision**: Dashboard polling cadence is **15 seconds**, matching the existing analytics dashboard pattern. The calibration query reads only the latest 30 rows + counters and is expected to return in tens of milliseconds. No background recomputation runs on the read path.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 15s polling is consistent with established platform patterns and is sufficient for a "within minutes" pairing SLO.
  2. Read path stays read-only and reactive, matching the architectural note "no separate ETL pipeline".
- **Reviewer Notes**: Confirm polling cadence with the existing analytics dashboard; matching cadence simplifies user mental model.

- **Decision**: Accessibility — the confusion matrix is rendered as a labelled HTML table with cell counts (and percentages as a secondary line); each axis carries an explicit text label ("Predicted: low risk", "Actual: friction-free"). Hit/miss distributions are rendered side-by-side as a labelled chart **and** a sortable table, so screen-reader and keyboard-only users have a tabular fallback. No information is conveyed by colour alone.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dual representation (chart + table) costs a small amount of UI real estate but is the safest path to WCAG AA on a quantitative dashboard.
  2. Counts plus percentages on every cell prevent misreads where one cell appears empty due to a small denominator.
- **Reviewer Notes**: Confirm the existing analytics dashboard uses a similar table-fallback pattern; reuse the convention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Owner views the drift dashboard with confusion matrix and distributions (Priority: P1)

A project owner navigates to the calibration view and sees, on a single page, how the inbox-analysis feature's predictions have held up against actual outcomes for the most recent shipped+analyzed tickets in this project. The view contains: a 2x2 friction confusion matrix with explicit cell counts (true positive, true negative, false positive, false negative) plus precision and recall on the "low risk" class; a quality-range hit/miss/`n/a` distribution; a cost-range hit/miss/`n/a` distribution; a recommendation panel showing "matched the user's choice" and "aligned with what friction actually emerged" as two separate rates. Every signal carries a text label and a tabular fallback. The owner can read the dashboard without prior context and understand where the analysis is reliable and where it drifts.

**Why this priority**: This is the headline value the ticket exists for — without it, the calibration data is invisible and the analysis feature has no measurable accountability. It also exercises the entire end-to-end pipeline (pairing job + storage + read-side query + render).

**Independent Test**: On a project with at least 30 shipped+analyzed tickets (mix of QUICK and FULL workflow types, mix of frictionFree outcomes), navigate to the calibration view as the project owner. Confirm the page renders within the platform's standard time budget, the confusion matrix shows non-zero counts in at least three of the four cells, both distributions render with labelled hit/miss/`n/a` buckets, and the recommendation panel surfaces both the matched-rate and the friction-aligned rate. Verify each visual element has an associated text label or tabular row.

**Acceptance Scenarios**:

1. **Given** a project with at least 30 shipped tickets that received a successful analysis, **When** the owner opens the calibration view, **Then** the page renders the 2x2 confusion matrix with explicit TP / FP / FN / TN counts, precision and recall on the "low risk" class, the quality and cost distributions with three buckets each (hit / miss / `n/a`), and the recommendation panel with matched-rate and friction-aligned-rate.
2. **Given** the dashboard is rendered, **When** the owner inspects any signal, **Then** every coloured element has a text-equivalent label and the tabular data is accessible to screen readers and keyboard users.
3. **Given** a project has more than 30 shipped+analyzed tickets, **When** the dashboard is rendered, **Then** the metrics reflect the most recent 30 rows and the page indicates the larger denominator (e.g., "30 of 47").
4. **Given** a project has fewer than 30 shipped+analyzed tickets, **When** the dashboard is rendered, **Then** the page renders with the available rows and a "still warming up" indicator naming the current count, without producing an empty-state error.

---

### User Story 2 — Pairing happens within minutes of SHIP, persisted as an immutable snapshot (Priority: P1)

When a ticket reaches SHIP and that ticket has at least one stored successful analysis, the system pairs the most recent successful analysis with the captured outcome and persists the deltas to a dedicated calibration row. The row appears within minutes of the SHIP event. Re-running the pairing or recomputing the deltas is never necessary — the row is immutable.

**Why this priority**: The pairing is the precondition for everything else. Without it, the dashboard has nothing to display. P1 because it must be reliable from day one — every analyzed ticket that ships must contribute to drift data.

**Independent Test**: Ship a ticket end-to-end on a project where the ticket has a single successful analysis. Within minutes of the SHIP transition, query the calibration table for that ticket and confirm exactly one row exists, with all paired fields populated (predicted vs actual friction, quality range vs actual quality, cost range vs actual cost, recommendation vs actual workflow type and friction). Re-trigger any equivalent of the pairing path; confirm no duplicate row is created and no existing row is mutated.

**Acceptance Scenarios**:

1. **Given** a ticket has been analyzed (status `success`) and reaches SHIP, **When** outcome capture completes, **Then** within minutes a calibration row exists for that ticket, with all paired fields populated and references to both the source analysis row and the source outcome row.
2. **Given** a calibration row exists for a ticket, **When** any subsequent re-pairing is triggered, **Then** the existing row is not modified (immutable snapshot guarantee) and no duplicate row is created.
3. **Given** outcome capture for a ticket is delayed (transient infrastructure issue), **When** the calibration job runs, **Then** it retries with bounded backoff until outcome capture completes; if outcome capture fails permanently, no calibration row is written and the failure is logged.
4. **Given** a ticket reaches SHIP but has no successful analysis (only failed, cold-start, or no analyses at all), **When** outcome capture completes, **Then** no calibration row is created for that ticket.

---

### User Story 3 — Tickets analyzed multiple times pair only the latest successful analysis (Priority: P2)

A ticket is analyzed once, the user edits the description, the user re-analyzes (per AIB-743's banner flow), the ticket eventually ships. Calibration pairs the latest successful analysis with the actual outcome — earlier analyses on the same ticket are retained on their original table for audit but do not produce calibration rows of their own and do not contribute to drift metrics.

**Why this priority**: Without this rule, drift metrics would double-count tickets that were re-analyzed and would mix superseded predictions with current ones — making the headline numbers unreliable. P2 (not P1) because it is a correctness rule on top of Story 2's pairing flow.

**Independent Test**: Take a ticket, run analysis once, edit the description, re-analyze (creating a second successful analysis row per AIB-743), ship the ticket. Confirm exactly one calibration row exists, that it references the second (latest) analysis row, and that the first analysis row is unmodified and still queryable on the analysis table.

**Acceptance Scenarios**:

1. **Given** a ticket has two successful analyses created at different times, **When** the ticket ships and pairing runs, **Then** exactly one calibration row exists and it references the most recent of the two analyses.
2. **Given** the pairing has run, **When** the older analysis row is queried directly, **Then** it is unchanged, still readable on the ticket's history, and not referenced by any calibration row.
3. **Given** a ticket has both successful and failed analyses, **When** pairing runs, **Then** the latest `success` row is selected (regardless of whether a more recent `failed` row exists) and the latest `failed` row is ignored for drift but still visible on the ticket.

---

### User Story 4 — Cold-start and partial-outcome tickets are handled honestly (Priority: P2)

A ticket whose latest analysis is `cold_start` (the project lacked enough comparable history at analysis time) does not produce a calibration row, because the analysis lacks numeric ranges to compare. The ticket is still counted in the adoption denominator (it was an attempt). Separately, a ticket whose paired outcome is `partial = true` (AIB-742 was unable to compute change-shape because the commit was unreachable) does produce a calibration row, but the change-shape-dependent fields are recorded as `n/a` and excluded from the headline rates; cost and friction-free comparisons populate normally.

**Why this priority**: Honest handling of degraded inputs is the difference between a dashboard owners trust and one they learn to ignore. P2 because the headline drift metrics still work without it, but the dashboard's credibility erodes if these cases are mishandled.

**Independent Test**: Construct a project with: (a) a shipped ticket whose latest analysis is `cold_start`, (b) a shipped ticket whose outcome is `partial = true`, (c) a normal shipped+analyzed ticket. Confirm: (a) produces no calibration row but counts in adoption; (b) produces a calibration row with cost and friction populated and quality and any change-shape-dependent fields marked `n/a`; (c) produces a fully populated calibration row.

**Acceptance Scenarios**:

1. **Given** a ticket whose latest analysis is `cold_start`, **When** the ticket ships and pairing runs, **Then** no calibration row is created and the ticket is excluded from drift metrics. The cold-start panel remains visible on the ticket itself per AIB-743.
2. **Given** a ticket whose outcome is `partial = true`, **When** pairing runs, **Then** a calibration row is created with cost-hit and friction-confusion cells populated, and any field that requires change-shape data is recorded as `n/a` with a `partialReason` reference to the outcome row.
3. **Given** a partial calibration row exists, **When** the dashboard renders, **Then** the headline rates exclude `n/a` cells from their denominators, and the `n/a` count is shown as a separate bucket so owners can see how many comparisons were skipped.

---

### User Story 5 — Adoption counter visibility (Priority: P2)

The owner sees, alongside drift metrics, a simple counter: how many tickets have entered INBOX in this project since the analysis feature became available, and how many of those received at least one analysis attempt. The ratio gives an honest read on how much the feature is being used. The counter is independent of the 30-row drift window — it counts attempts (any status) over the broader denominator.

**Why this priority**: A drift dashboard for a feature that nobody uses is misleading. The adoption counter prevents the headline rates from being interpreted in isolation. P2 because the drift metrics themselves are the headline.

**Independent Test**: On a project where the analysis feature has been available for some time, navigate to the calibration view. Confirm the adoption counter shows two numbers (tickets entered INBOX since feature availability, of which N analyzed) and a derived ratio. Create a new INBOX ticket without analyzing it; confirm the denominator increments and the ratio drops accordingly. Analyze the new ticket (any status, including a deliberately failed one); confirm the numerator increments and the ratio recovers.

**Acceptance Scenarios**:

1. **Given** a project where the analysis feature has been available, **When** the owner opens the calibration view, **Then** the adoption counter is rendered alongside drift metrics, showing tickets-entered-INBOX, of-which-analyzed, and a ratio.
2. **Given** a ticket is analyzed and the analysis row is `failed` or `cold_start`, **When** the counter recomputes, **Then** the ticket counts in the numerator (an attempt was made) even though it does not contribute to drift metrics.
3. **Given** a ticket was created before the analysis feature became available on the project, **When** the counter is computed, **Then** it is not counted in the denominator (so older inboxes do not artificially depress adoption).

---

### User Story 6 — Owner-only access enforced server-side (Priority: P2)

A project member (non-owner) attempts to navigate to the calibration view. The server returns the same response it would for any non-existent project resource — no leak that the dashboard exists. The owner of the same project sees the dashboard. No new role or permission tier is introduced; the existing owner-only gate is reused.

**Why this priority**: The acceptance criterion "accessible only to project owners" must hold even against a knowledgeable user who tries the URL directly. P2 because the standard owner-only flow is well-trodden in the platform; this is a correctness requirement, not a novel one.

**Independent Test**: Authenticate as a project owner; confirm the calibration view loads. Authenticate as a project member of the same project; confirm a not-found response (no leak). Authenticate as a non-member; confirm the same not-found response.

**Acceptance Scenarios**:

1. **Given** a request to the calibration view, **When** the requesting user is the project's owner, **Then** the view returns the calibration data.
2. **Given** a request to the calibration view, **When** the requesting user is a project member but not the owner, **Then** the response is a generic "not found" with no data leakage.
3. **Given** a request to the calibration view, **When** the requesting user has no access to the project, **Then** the response is identical to the member-without-access case (indistinguishable response).

---

### Edge Cases

- A ticket reaches SHIP, outcome capture completes, but the ticket has no successful analysis (only `failed` rows). No calibration row is created; the ticket appears in adoption (analyzed-attempted=true) but not in drift metrics.
- A ticket has been analyzed and reaches SHIP, but outcome capture fails permanently (after AIB-742's bounded retries) leaving an outcome row with `partial = true`. Calibration still creates a row using available telemetry-derived fields; change-shape-dependent fields are `n/a`.
- A ticket has multiple successful analyses (at least two re-analyses). Only the most recent is paired; older are retained on the analysis table for audit and explicitly excluded from drift.
- The most recent analysis row finished after the outcome capture completed but before SHIP (rare ordering due to async pipelines). Pairing uses the latest `success` row at the time pairing runs, regardless of which transition completed first.
- A calibration row exists for a ticket, then the underlying ticket is hard-deleted (cascade). The calibration row is removed by cascade. The dashboard recomputes counts on the next render; no stale row is shown.
- An analysis recommendation is QUICK and the actual workflow was QUICK and the ticket was friction-free. Both axes record `true` (matched and friction-aligned).
- An analysis recommendation is QUICK, the actual workflow was QUICK, but the ticket needed iterate jobs (frictionFree=false). `recommendationMatched=true` but `recommendationFrictionAligned=false`. The dashboard shows this divergence.
- An analysis recommendation is FULL, the actual workflow was QUICK (the user overrode the recommendation), and the ticket was friction-free. `recommendationMatched=false` but `recommendationFrictionAligned=false` as well (FULL was recommended yet friction did not emerge).
- The actual quality score sits exactly on the predicted upper bound (e.g., predicted [70, 85], actual = 85). Treated as a hit (inclusive bounds).
- The actual cost is null (every job had null `costUsd` — extreme edge). Cost cell is `n/a`. Friction and quality cells populate normally if available.
- A new project ships its first analyzed ticket. Adoption counter shows 1 / N (where N = tickets-since-feature-availability); drift dashboard shows the "still warming up" state until the project accumulates more rows.
- The 30-row window includes a mix of partial-outcome rows and full-outcome rows. Headline rates honour the `n/a` exclusions per cell; the dashboard caption lists the denominator each headline rate uses.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist exactly one calibration row per ticket that has both a paired successful analysis and a captured outcome. The row MUST be 1:1 with the ticket and append-only.
- **FR-002**: Pairing MUST be triggered by outcome-capture completion (so actuals are guaranteed to exist), not by the raw SHIP transition. The end-to-end SLO from SHIP transition to calibration row availability MUST be "within minutes".
- **FR-003**: Pairing MUST select the most recent `TicketAnalysis` row with status `success` for the ticket. Analyses with status `cold_start`, `failed`, or `running` MUST be skipped.
- **FR-004**: When a ticket has no `success` analysis at pairing time, no calibration row MUST be created. The ticket MUST still be counted in the adoption denominator if it entered INBOX since the feature became available on the project.
- **FR-005**: System MUST NOT modify a calibration row after it is written. The row is an immutable snapshot. No re-pairing path is exposed to users.
- **FR-006**: System MUST persist, on each calibration row: the ticketId, projectId, references to the paired `TicketAnalysis` row and the paired `TicketOutcome` row, the rule-set version that produced the pairing rules, the timestamp the row was written, the `shippedAt` denormalised from the outcome (for ordering), and all paired predicted-vs-actual fields enumerated in FR-007 through FR-011.
- **FR-007**: Friction pairing MUST persist: the predicted three-class rating (`low | medium | high`); the binarised "predicted clean" flag (true iff `low`); the actual `frictionFree` boolean (read from `TicketOutcome`); and the explicit confusion-matrix cell (`TP | TN | FP | FN`) computed against the positive class (predicted clean = positive, actual frictionFree = positive).
- **FR-008**: Quality pairing MUST persist: the predicted lower and upper bounds; the actual quality score (nullable for QUICK); the hit verdict in `{ hit, miss, n_a }` (n_a when actual is null).
- **FR-009**: Cost pairing MUST persist: the predicted summed range (baseline lower + marginal lower, baseline upper + marginal upper); the decomposed predicted components (baseline lower/upper, marginal lower/upper) for future drill-downs; the actual `totalCostUsd`; the hit verdict in `{ hit, miss, n_a }` (n_a when actual is null).
- **FR-010**: Recommendation pairing MUST persist: the predicted recommendation (`QUICK | FULL`); the predicted recommendation confidence (`low | medium | high`); the actual `workflowType` (`QUICK | FULL`); two boolean axes — `recommendationMatched` (predicted == actual) and `recommendationFrictionAligned` (QUICK + frictionFree, or FULL + NOT frictionFree).
- **FR-011**: When the paired outcome is `partial = true`, the calibration row MUST still be created. Cells whose computation requires fields the outcome was unable to capture MUST be recorded as `n/a` with a reference to the outcome's `partialReason`. Cells that can be computed from the available telemetry MUST be populated normally.
- **FR-012**: System MUST NOT block, delay, or alter the SHIP transition or the AIB-742 outcome-capture flow. Calibration is a downstream consumer; failures in calibration MUST NOT cascade to those flows.
- **FR-013**: The drift dashboard route MUST authorize only project owners via the existing owner-only gate. Non-owners (including project members) MUST receive a generic not-found response with no data leakage.
- **FR-014**: The dashboard MUST surface, for the project being viewed: a 2x2 friction confusion matrix with explicit TP / TN / FP / FN counts and percentages, plus precision and recall on the "low risk" positive class; a quality-hit distribution (hit / miss / n_a); a cost-hit distribution (hit / miss / n_a); a recommendation panel showing `recommendationMatched` rate and `recommendationFrictionAligned` rate as two separate numbers.
- **FR-015**: The drift metrics MUST reflect the most recent 30 calibration rows in the project (ordered by paired-outcome `shippedAt` descending). When fewer than 30 rows exist, the dashboard MUST render with the available rows and a "still warming up" indicator naming the current count.
- **FR-016**: The dashboard MUST surface an adoption counter: numerator = count of distinct tickets in the project that have at least one `TicketAnalysis` row of any status; denominator = count of distinct tickets in the project that entered INBOX on or after the moment the analysis feature became available on the project; and the ratio. The adoption counter is computed independently of the 30-row drift window.
- **FR-017**: The dashboard MUST be read-only and reactive: the read path MUST NOT trigger any recomputation, LLM call, or write. Polling cadence MUST match the existing analytics dashboard convention (15 seconds).
- **FR-018**: All dashboard signals MUST carry text labels and a tabular fallback. The confusion matrix MUST be rendered as a labelled HTML table with cell counts. No information MUST be conveyed by colour alone (WCAG AA).
- **FR-019**: Pairing failures MUST be logged for observability. After bounded retries, a failed pairing MUST result in no calibration row being written; SHIP and outcome capture MUST continue unaffected. No user-facing alert is surfaced for individual pairing failures.
- **FR-020**: System MUST NOT regress AIB-742 outcome capture or AIB-743 inbox analysis. No edits to those tables, contracts, or flows are required by this feature.
- **FR-021**: Calibration rows MUST NOT be exposed on individual ticket pages or to non-owners. The "ticket-facing display showing whether the analysis was right" is explicitly out of scope; the loop is internal to project owners.
- **FR-022**: The dashboard MUST NOT auto-correct, alert, or modify analysis prompts based on observed drift. Prescriptive logic is out of scope.

### Assumptions

- AIB-742 (outcome capture) and AIB-743 (inbox analysis) have shipped before this feature, including the data models referenced (`TicketOutcome` with `frictionFree`, `partial`, `partialReason`, `totalCostUsd`, `qualityScore`, `workflowType`; `TicketAnalysis` with structured `output` containing predicted friction rating, predicted quality range, predicted cost range decomposed into baseline + marginal, predicted recommendation with confidence).
- The platform never re-ships a ticket that has already shipped; rollback paths return the ticket to an earlier stage but the next SHIP is still the same ticket lifecycle and calibration's 1:1 keying remains valid.
- The calibration table size is bounded by the count of shipped+analyzed tickets per project — small enough that a single per-project query for the latest 30 rows is cheap.
- The "moment the analysis feature became available on the project" is derivable — either from a per-project flag introduced by AIB-743 or, failing that, from the timestamp of the project's first `TicketAnalysis` row. The reviewer-notes flag this for confirmation.
- The platform's analytics dashboard 15s polling cadence is the established convention for this kind of read-only owner-only view; this feature adopts it for consistency.

### Key Entities *(include if feature involves data)*

- **AnalysisCalibration**: One immutable row per shipped+analyzed ticket. Captures: identity (ticketId, projectId, FK to the paired `TicketAnalysis` row, FK to the paired `TicketOutcome` row); the rule-set version that produced the pairing rules; the timestamp the row was written; friction pairing fields (predicted rating, predicted-clean binary, actual frictionFree, confusion-cell `TP|TN|FP|FN`); quality pairing fields (predicted lower, predicted upper, actual score nullable, hit verdict `hit|miss|n_a`); cost pairing fields (predicted summed lower/upper, decomposed components, actual cost, hit verdict); recommendation pairing fields (predicted, predicted confidence, actual workflowType, `recommendationMatched`, `recommendationFrictionAligned`); a `partial` flag and `partialReason` snapshot when the source outcome was partial; the `shippedAt` of the paired outcome (denormalised for ordering). Cardinality: 1:1 with Ticket; many:1 with Project. Cascade delete with both Ticket and Project.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **PairAnalysisWithOutcome**: Triggered when a `TicketOutcome` row is created (outcome-capture completion).
  - **Input**: The newly created `TicketOutcome` row (ticketId, projectId, all outcome fields).
  - **Phases**:
    1. Look up the most recent `TicketAnalysis` row for the ticket with status `success`. If none exists, exit cleanly (no row written).
    2. Read the analysis output payload (predicted friction rating, predicted quality range, predicted cost range with decomposed baseline + marginal components, predicted recommendation + confidence).
    3. Compute friction pairing: binarise the predicted rating (low → predicted clean; medium/high → predicted friction); compare against `outcome.frictionFree`; classify into `TP | TN | FP | FN` against the "low risk" positive class.
    4. Compute quality pairing: if `outcome.qualityScore` is null → `n_a`; else compare against the predicted lower/upper bounds, inclusive → `hit | miss`.
    5. Compute cost pairing: if `outcome.totalCostUsd` is null → `n_a`; else compute the predicted summed range and compare → `hit | miss`. Persist the decomposed components for future drill-down.
    6. Compute recommendation pairing: `recommendationMatched = (predicted == ticket.workflowType)`; `recommendationFrictionAligned = (predicted == QUICK AND outcome.frictionFree) OR (predicted == FULL AND NOT outcome.frictionFree)`.
    7. Write the calibration row with all paired fields, the rule-set version, the FK references, the `shippedAt` denormalised from the outcome, and the `partial` flag mirrored from the outcome.
  - **Output**: One immutable `AnalysisCalibration` row visible to the dashboard read path. No user-visible side-effect.
  - **Error behavior**: Bounded retries on transient infrastructure errors. If retries are exhausted, no row is written and the failure is logged for observability. SHIP and outcome capture are unaffected. No partial calibration rows are written — either the row is complete (with `n/a` cells where applicable per FR-011) or it is not written at all.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of shipped+analyzed tickets have a calibration row available within 5 minutes of the SHIP transition (measured from SHIP timestamp to calibration row creation timestamp).
- **SC-002**: Calibration rows are append-only: 0 mutations to existing `AnalysisCalibration` rows are observed in a periodic audit query over a representative window.
- **SC-003**: 100% of calibration rows reference exactly one `TicketAnalysis` row with status `success` and exactly one `TicketOutcome` row, both for the same ticket (referential-integrity invariant).
- **SC-004**: When a project has at least 30 shipped+analyzed tickets, the drift dashboard's confusion matrix shows non-zero counts in at least three of the four cells in 100% of cases observed in dogfood (sanity check that the binarisation and pairing rules produce useful distributions, not all-clustered-in-one-cell artefacts).
- **SC-005**: Quality and cost distributions correctly classify QUICK-workflow tickets (where `outcome.qualityScore` is null) as `n/a` in 100% of cases — verified by sampling persisted calibration rows against their source outcomes.
- **SC-006**: Recommendation pairing surfaces both axes in 100% of calibration rows where both predicted recommendation and actual workflowType are present, with `recommendationMatched` and `recommendationFrictionAligned` as independent booleans.
- **SC-007**: The drift dashboard route returns a generic not-found response in 100% of attempts by non-owners (project members and non-members alike), with no data leakage in the response body or headers.
- **SC-008**: The adoption counter's numerator reflects all `TicketAnalysis` rows of any status for the project, and its denominator excludes tickets created before the analysis feature became available on the project — verified across at least three projects of varying ages.
- **SC-009**: No regression on AIB-742 outcome capture or AIB-743 inbox analysis: outcome rows continue to be persisted within their existing SLO, analysis rows continue to be persisted within their existing SLO, and the calibration feature's failure modes do not cascade — verified by periodic monitoring.
- **SC-010**: Accessibility audits (automated tooling + manual screen-reader pass) report zero critical issues on the drift dashboard. The confusion matrix is announced as a table with row and column headers; the hit/miss distributions have tabular fallbacks; no signal is conveyed by colour alone.
- **SC-011**: When a ticket's paired outcome is `partial = true`, the calibration row is still created in 100% of such cases, with the cells that depend on missing data marked `n/a` and the cells that depend on available telemetry populated normally — verified by sampling persisted rows with `partial = true` against their source outcomes.
- **SC-012**: When a ticket is analyzed multiple times before shipping, the calibration row references the most recent `success` analysis in 100% of cases — verified by sampling tickets with ≥2 analyses against their calibration rows.
