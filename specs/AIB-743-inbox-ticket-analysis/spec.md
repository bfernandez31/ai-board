# Feature Specification: Inbox Ticket Analysis — Friction Risk, Recommendation, and Grounded Estimates

**Feature Branch**: `AIB-743-inbox-ticket-analysis`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "Inbox ticket analysis: friction risk, recommendation, and grounded estimates — on demand, surface a friction-risk rating, expected quality-gate range, QUICK-vs-FULL recommendation with confidence, decomposed cost range, scope warnings, and clickable anchor citations grounded on past outcome records, persisted per ticket and re-runnable when the description changes."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

> **AUTO scoring**: signals detected — cost protection / rate limiting (+2), auditability / quality safeguards (+2), accessibility & access control (+2), no regression on existing flows (+1), generic stack-agnostic UX (+1), internal-feature framing (−2). **netScore = +5**, no conflicting buckets. **Suggested policy: CONSERVATIVE (confidence High, 0.9)**. Applied to every decision below.

- **Decision**: Anchor-ticket retrieval is grounded on **structural-domain overlap plus semantic-tag overlap** drawn from the outcome records produced by AIB-742, with no free-form text similarity. A past ticket is "comparable" when it (a) belongs to the same project, (b) has a non-`partial` outcome, and (c) shares at least one structural domain (top-level path segment) with the analyzed ticket's predicted domain set from the scoping pass; tie-breakers prefer overlap of semantic tags (`touched_db_schema`, `touched_tests`, `touched_ci`) and recency.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Restricting to non-partial outcomes guarantees grounded reasoning at the cost of a slower warm-up after AIB-742 ships.
  2. Same-project scope yields sharper anchors but reduces signal volume for new projects; mitigated by the cold-start path.
- **Reviewer Notes**: Confirm same-project scoping is the desired isolation; cross-project anchoring is explicitly out of scope until calibration data justifies it.

- **Decision**: Cold-start activates when **fewer than 3 comparable past outcomes** are available for the project after applying the overlap rule. The panel renders without numeric cost or quality-gate ranges, surfaces qualitative scope warnings only, and displays an explicit cold-start notice naming the cause ("not enough comparable shipped tickets yet").
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Threshold of 3 keeps the bar low enough that newer projects see numeric output quickly, while still requiring more than a single anchor before quoting ranges.
  2. Below the threshold, users still get a useful qualitative read, but lose the cost-budgeting payoff until more tickets ship.
- **Reviewer Notes**: Calibrate the threshold once enough analyses have been run; this is a starting value, not a permanent rule.

- **Decision**: Anchor count surfaced in the UI is **up to 5 anchor tickets** per analysis, ordered by overlap strength then recency. The same set is sent to the grounded estimation prompt.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Five is a defensible "few" — enough for triangulation, small enough that the user can audit each.
  2. Larger sets would dilute the grounding prompt and increase token cost.
- **Reviewer Notes**: PLAN may revisit the ordering function; the count itself is a UX cap, not a model parameter.

- **Decision**: Scope warnings are capped at **up to 5** entries per analysis, prioritized in this order: (1) ambiguity in core requirement, (2) multi-feature bundling, (3) missing acceptance criteria, (4) missing scope boundary, (5) other. Each warning is a single short sentence pointing at the offending portion of the description.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A small cap forces the model to triage rather than dump every minor concern.
  2. Some legitimate warnings may be elided when many concerns coexist; users can re-analyze after editing the description.
- **Reviewer Notes**: The order above is a starting heuristic; PLAN may tune the prompt without changing the cap.

- **Decision**: Rate limiting is **10 successful analyses per user per rolling hour, project-agnostic**. The eleventh attempt within the window is rejected with a clear message stating when capacity returns. Failed analyses (LLM error, transient outage) do not consume the budget.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Per-user scoping prevents one user from burning a project-wide budget; project-level limits are not introduced now to avoid coordination cost.
  2. Excluding failed runs from the budget protects users from being penalised by transient infrastructure issues.
- **Reviewer Notes**: PLAN should align the storage/expiry semantics with the existing rate-limit pattern in the codebase (if one exists).

- **Decision**: The cost figure displayed on the **button label before the click** is an **estimated USD range** (lower–upper) for the analysis itself, derived from the project's declared agent and a static per-analysis cost reference table. The actual measured cost is recorded on the persisted analysis row after completion.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. USD is the user-facing currency already familiar from billing; tokens would be unfamiliar to non-technical reviewers.
  2. A static table is a coarse pre-click estimate; the post-run measured cost is what bills.
- **Reviewer Notes**: Keep the table close to the existing billing/cost reference if one exists; do not introduce a parallel pricing source.

- **Decision**: Re-analysis is **always user-triggered**. No background recomputation runs automatically — not when the description changes, not on a schedule, not on stage transitions. The "description changed" banner is purely informational and offers a re-analyze action; until the user clicks it, the existing analysis stays visible.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Strict user-triggered policy honours the explicit "stays in control of cost" requirement and aligns with the rate-limit model.
  2. Stale analyses can persist if the user ignores the banner; the banner itself signals staleness.
- **Reviewer Notes**: Confirm no notification or email side-effect is wanted on the change-detected event.

- **Decision**: Stale-detection compares the ticket's **current `title + description`** against the snapshot stored on the latest analysis row. Any non-whitespace difference triggers the banner. Edits that revert to the snapshot dismiss the banner without requiring a re-run.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Whitespace-tolerance prevents formatting tweaks from being flagged as content changes.
  2. Title-or-description changes both count, matching the user-facing "description has been edited" criterion (the title is part of the analysis input).
- **Reviewer Notes**: Confirm that comments on the ticket do **not** count as description changes for the banner.

- **Decision**: Storage is a **dedicated analysis table, append-only, one row per analysis run**. Newest row is the "current" analysis displayed. Older rows are retained indefinitely for audit (no automatic deletion). The latest row drives all UX (panel content, banner comparison, anchor links).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Append-only history protects future calibration consumers (referenced as "Why Now") that want to compare prediction vs delivered outcome.
  2. Storage grows linearly with re-analyses; bounded by rate limits and user behaviour, expected to stay small.
- **Reviewer Notes**: PLAN should confirm whether older rows ever need to be archived once the calibration feature exists; default is no.

- **Decision**: Access control **mirrors existing ticket access rules**. Triggering an analysis requires the same permission as opening the ticket (project owner or member). Reading a persisted analysis requires the same. No new roles or permission tiers are introduced.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reusing the ticket-access helpers is the safest path against authorization regressions.
  2. Anchor links inside the panel may point to tickets the viewer can already access (same project), so no cross-project leak is possible by design.
- **Reviewer Notes**: Confirm `verifyTicketAccess` (or its equivalent) is the canonical check and is reused on both trigger and read paths.

- **Decision**: The grounded estimation prompt receives, in addition to the ticket text, **the project's declared stack and a bounded extract of its operating context** (language, framework, services list, testing framework, e2e flag). The extract is capped at a small text budget (a few hundred tokens) to keep the same code path generic across projects regardless of stack size.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A bounded extract keeps the prompt size predictable and the cost stable across projects.
  2. Some niche operating context may be omitted; the cap prefers genericity over completeness.
- **Reviewer Notes**: PLAN should specify the exact extract fields, with a graceful fallback when any field is missing (the project was created before the field was introduced).

- **Decision**: The analysis **does not block the user**. The trigger returns immediately; the panel displays a "running" placeholder until results arrive. If the run fails or exceeds the SLO, the placeholder shows the error and the run is not consumed against the rate limit.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Asynchronous execution avoids tying up the UI during a multi-stage LLM run.
  2. Users see a transient "running" state for several seconds; this is preferable to a blocked browser.
- **Reviewer Notes**: PLAN may align with the existing job/poll patterns used for SPECIFY/PLAN/BUILD jobs.

- **Decision**: When a banner-triggered re-analyze runs, it produces a **new row**; the previous row is preserved (auditable history) but no longer surfaced in the panel.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Append-only re-analysis preserves the ability to study how predictions evolved with description edits — useful for the calibration feature.
  2. Slightly more storage than overwrite-in-place; bounded by rate limits.
- **Reviewer Notes**: PLAN should ensure analytics over the table can distinguish "latest" from "historical" rows efficiently.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — One-click grounded analysis on an INBOX ticket (Priority: P1)

A project member opens an INBOX ticket whose description has just been written. They click a single button labelled with the expected USD analysis cost, and within a few seconds the ticket displays a panel that summarises: a friction-risk rating (low/medium/high), an expected quality-gate range anchored on similar past tickets, a QUICK-vs-FULL recommendation with a short justification and a confidence level, an expected cost range broken into baseline pipeline cost plus marginal friction cost, up to five short scope warnings, and up to five clickable anchor tickets each showing its own friction status and quality score. The result is persisted, so reopening the ticket later shows the same panel instantly without a second LLM call.

**Why this priority**: This is the headline value the ticket exists for — making the QUICK/FULL decision visible at the moment it is taken. Without this story, every other story is decoration. It also exercises the entire end-to-end pipeline (scoping pass + grounded pass + persistence + render).

**Independent Test**: On a project with at least three non-partial historical outcomes that share a domain with a freshly created INBOX ticket, click the analysis button, observe the running placeholder, and confirm the panel renders within ten seconds with all required fields populated, an anchor list of up to five clickable tickets, and a recommendation with text justification. Reload the page; the panel must reappear instantly without re-running any LLM call.

**Acceptance Scenarios**:

1. **Given** an INBOX ticket on a project with sufficient comparable history, **When** the user clicks the analysis button, **Then** within 10 seconds the panel shows a friction-risk rating, an expected quality-gate range, a QUICK-vs-FULL recommendation with justification text and a low/medium/high confidence label, an expected cost range with a baseline component and a marginal friction component, scope warnings if any, and up to 5 anchor tickets each showing its own friction status and quality score.
2. **Given** a ticket that has already been analyzed, **When** the user reopens the ticket page, **Then** the persisted panel renders immediately on first paint, with no second LLM call charged or executed.
3. **Given** an analysis is running, **When** the user reloads the page mid-run, **Then** the panel shows a "running" placeholder; on completion the panel updates to the result without further user action.
4. **Given** the analysis panel is displayed, **When** the user clicks any anchor ticket entry, **Then** the user is navigated to that ticket's page within the current project.
5. **Given** the analysis run fails (LLM error, timeout), **When** the failure surfaces, **Then** the panel shows an actionable error message, the run does not consume the user's hourly budget, and a retry button is available.

---

### User Story 2 — Cold-start handling when comparable history is insufficient (Priority: P1)

A user runs analysis on an INBOX ticket of a project that does not yet have enough non-partial outcome records sharing a structural domain with the new ticket. Instead of fabricating numeric ranges, the panel renders a qualitative-only view: scope warnings derived from the description alone, no quality-gate or cost ranges, and an explicit cold-start notice that names the reason ("not enough comparable shipped tickets in the same domain yet"). The recommendation field, if shown, is presented with low confidence and a justification stating it is description-only.

**Why this priority**: Prediction grounded on insufficient history is worse than no prediction. Honest cold-start handling is the difference between a feature users trust and one they learn to ignore. It is also the dominant case for any newly onboarded project, so the experience must be deliberate, not an empty-state error.

**Independent Test**: On a fresh project with zero shipped tickets, run the analysis and confirm the panel shows scope warnings, the cold-start notice with a clear cause, no quality-gate or cost numeric ranges, and (if a recommendation is provided at all) it carries a low-confidence label and explicitly attributes itself to description-only reasoning.

**Acceptance Scenarios**:

1. **Given** a project with zero comparable past outcomes for the analyzed ticket's predicted domain, **When** analysis runs, **Then** the panel shows the cold-start notice, a populated scope-warnings list (or "no warnings"), no numeric quality-gate or cost ranges, and an empty anchor-tickets list.
2. **Given** a project with one or two comparable past outcomes (below the cold-start threshold of 3), **When** analysis runs, **Then** the same cold-start path renders; the available anchors are not shown as ranges-anchors, but the existence of "early data" may be noted in the cold-start text.
3. **Given** a cold-start panel is displayed, **When** new tickets ship and history accumulates above the threshold, **Then** a re-analyze on the same ticket produces a non-cold-start panel with numeric ranges (preserving the user-triggered semantics — the system does not auto-refresh).

---

### User Story 3 — Description-changed banner and re-analyze (Priority: P1)

After an analysis has been persisted, the user edits the ticket title or description. The next time the panel renders, a banner clearly states that the description has changed since the analysis was generated and offers a one-click re-analyze action. Until the user clicks, the prior analysis remains visible (and labelled as such), so the user keeps full control over when LLM cost is incurred. Reverting the edits to the analysis-time snapshot dismisses the banner automatically.

**Why this priority**: Description changes are the single most common reason for a stale analysis. Without this signal, users would either waste analyses on every page load (auto-rerun) or trust an outdated panel. The banner pattern threads that needle.

**Independent Test**: Analyze a ticket. Edit its title or description, reload the ticket. Confirm the banner appears with a re-analyze button. Click revert (restore the original text). Reload. Confirm the banner is gone. Re-edit, click re-analyze. Confirm a new analysis is produced (new row), the banner clears, and the previous row is retained for audit.

**Acceptance Scenarios**:

1. **Given** a ticket with a persisted analysis, **When** the user edits the title or description, **Then** the next panel render shows a "description changed since analysis" banner with a re-analyze action.
2. **Given** the banner is visible, **When** the user clicks re-analyze, **Then** a new analysis runs (subject to the rate limit) and on completion the panel shows the new result, the banner clears, and the prior analysis row remains stored for audit.
3. **Given** the banner is visible, **When** the user reverts the edits to match the snapshot stored on the analysis, **Then** the banner clears without requiring a re-run.
4. **Given** comments are added to a ticket with a persisted analysis, **When** the panel renders, **Then** the banner does **not** appear (comments are not part of the description input).
5. **Given** the banner is visible, **When** the user navigates away and back without clicking re-analyze, **Then** the banner remains and the prior analysis is still shown — nothing runs in the background.

---

### User Story 4 — Auditable anchor citations (Priority: P2)

Each anchor ticket in the panel is clickable and shows, inline, its own friction status (frictionFree yes/no) and quality score (or "no score" for QUICK tickets). The user can therefore audit the recommendation: clicking an anchor opens that past ticket; the visible status and score let the user judge whether the anchor is a credible comparable. If the user disagrees with the analysis, they can see the basis on which it reasoned.

**Why this priority**: Without auditability, a recommendation is a black box; users must take or leave it. With auditability, a recommendation becomes an argument the user can verify, accept, or override — which is the explicit "stays in control" stance of the product.

**Independent Test**: Run an analysis on a ticket with sufficient history. Confirm each displayed anchor entry includes (a) a clickable link to the past ticket, (b) a visible friction-status indicator with text label, (c) a visible quality score (numeric) or a clear "no score" placeholder. Click each one and verify navigation succeeds.

**Acceptance Scenarios**:

1. **Given** an analysis has produced anchor citations, **When** the user inspects any anchor entry, **Then** the entry shows the past ticket's key, friction status, quality score (or "no score"), and is clickable.
2. **Given** the user clicks an anchor, **When** navigation completes, **Then** the past ticket page loads in the current project context.
3. **Given** an anchor's source ticket has been deleted or the user lacks access (edge case), **When** the panel renders, **Then** the anchor entry is shown in a degraded state ("ticket no longer available") without breaking the panel.

---

### User Story 5 — Stack-aware analysis across all supported projects (Priority: P2)

The same code path produces sensible analyses regardless of the project's language, framework, or services. When the analysis prompt is built, the project's declared stack signals (language, framework, services list, testing framework) and a bounded operating-context extract are included so the model can reason about ambiguity through the lens of that stack. A user on a Python+postgres project sees the same panel structure as a user on a TypeScript+postgres project; only the substantive content differs.

**Why this priority**: Genericity is an explicit acceptance criterion. Without this, the analysis would silently bias toward the project the prompt was designed against. P2 (not P1) because the surface story is identical to Story 1; what makes it independent is that it must be tested across multiple stacks.

**Independent Test**: Run the analysis on freshly created INBOX tickets across at least two projects with different stacks (e.g., TypeScript/Next + postgres and another language/framework combination). Confirm the panel renders consistently in both, the recommendation justification references stack-relevant concerns, and there are no errors arising from stack-dependent prompt logic.

**Acceptance Scenarios**:

1. **Given** two projects with distinct declared stacks, **When** the same descriptive ticket is analyzed in each, **Then** both panels render with the same fields, and the recommendation justification text references at least one stack-relevant signal in each.
2. **Given** a project whose declared stack is missing some optional fields (e.g., no `services`), **When** analysis runs, **Then** the prompt gracefully omits those fields and the analysis still completes — no error is shown to the user.

---

### User Story 6 — Cost transparency and rate limiting (Priority: P2)

The button label exposes an estimated USD cost range for the analysis itself before the user clicks. After the run completes, the persisted analysis row records the actual measured cost. A per-user rate limit (10 successful analyses per rolling hour, project-agnostic) bounds spend; the eleventh attempt is rejected with a message stating when capacity returns. Failed runs do not consume budget.

**Why this priority**: Cost protection was an explicit acceptance criterion. P2 because it is a guardrail rather than the primary value, but it is the precondition for keeping the feature on by default.

**Independent Test**: With a fresh hourly budget, run the analysis 10 times within an hour on different INBOX tickets; confirm each succeeds and the button shows a USD range pre-click. Attempt an 11th analysis; confirm it is rejected with a clear "budget exhausted, retry at HH:MM" message. Force a failure on a 12th attempt by some controllable means (mock LLM error); confirm it does not increment the consumed budget.

**Acceptance Scenarios**:

1. **Given** an INBOX ticket, **When** the panel is displayed before any click, **Then** the analysis button label includes an estimated USD cost range.
2. **Given** a user has run 10 successful analyses in the last hour, **When** they trigger an 11th, **Then** the request is rejected with a clear message including the time at which capacity returns.
3. **Given** an analysis run fails, **When** the failure is recorded, **Then** the user's hourly budget is unchanged and the user can retry immediately.
4. **Given** an analysis completes successfully, **When** the row is persisted, **Then** it records the measured USD cost and the timestamp at which the run completed.

---

### User Story 7 — Accessibility (Priority: P3)

Color-coded signals (friction risk, recommendation confidence) are accompanied by text labels. The "description changed" banner is announced to screen readers. Keyboard users can trigger the analysis button, navigate to anchor tickets, and dismiss/act on the banner without a mouse.

**Why this priority**: Accessibility is an acceptance criterion and a non-negotiable per the constitution's UX principles, but it does not block the core value flow; it is a quality bar applied to all stories above.

**Independent Test**: With a screen reader enabled and keyboard-only navigation, complete the full happy path of Story 1 and Story 3. Confirm: every color-coded element has a text-equivalent label; the analysis button is reachable and announces its label including cost; the banner is announced when it appears; anchor tickets are reachable and named.

**Acceptance Scenarios**:

1. **Given** the analysis panel is displayed, **When** a screen reader user navigates the panel, **Then** every color-coded element (risk, confidence) has a text label that is announced.
2. **Given** the description-changed banner appears, **When** a screen reader is active, **Then** the banner's appearance is announced as a live region update.
3. **Given** keyboard-only navigation, **When** the user tabs through the panel, **Then** the analysis button, banner action, and every anchor link are reachable and operable.

---

### Edge Cases

- The ticket transitions out of INBOX (e.g., to SPECIFY or BUILD) while an analysis is running. The run completes and the row is persisted, but the analysis button is no longer offered on the ticket page (analysis is INBOX-only). The persisted row remains visible if accessed.
- The ticket transitions back into INBOX after a rollback. The previously persisted analysis (if any) remains visible; the user may re-analyze.
- Two concurrent analysis runs are triggered for the same ticket (e.g., two tabs open). The system allows both to complete (each is its own row); the latest completion wins for the panel display. Both rows count against the user's rate budget.
- The project's outcome data is wiped or the AIB-742 capture has not yet caught up. Cold-start path activates uniformly; no error is shown.
- A non-partial outcome exists but its quality score is null (QUICK ticket that shipped). Such outcomes contribute to anchor selection (domain overlap, friction status) but do not contribute to the quality-gate range estimation.
- The prompt extract for a project's operating context exceeds the token budget. The extract is truncated deterministically (e.g., longest fields trimmed first); analysis still runs.
- The user lacks access to one of the past tickets selected as an anchor (cross-member visibility difference). The anchor is filtered out before render — never linked, never shown.
- A description-changed banner is displayed while a re-analyze is already in progress. The banner is suppressed during the run and re-evaluates against the new snapshot afterwards.
- The first LLM stage (scoping pass) fails. The analysis is recorded as failed, no second-stage call is made, the user budget is not consumed, and the panel surfaces the failure with a retry option.
- The second LLM stage (grounded pass) fails after the scoping pass succeeded. The analysis is recorded as failed; the partial scoping output is not surfaced (avoids inconsistent UX).
- A project's declared stack changes between an analysis and a subsequent re-analysis. The new analysis uses the current stack; older rows retain their original stack snapshot for audit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to trigger an analysis on any ticket in stage INBOX through a single button on the ticket page.
- **FR-002**: The analysis button MUST NOT be offered on tickets outside stage INBOX. The persisted result, if one exists, MUST remain readable from any stage.
- **FR-003**: The analysis button label MUST display an estimated USD cost range for the analysis itself before the user clicks.
- **FR-004**: A typical successful analysis MUST complete end-to-end within 10 seconds (target p95).
- **FR-005**: System MUST persist exactly one row per analysis run to a dedicated, append-only analysis store. Older rows MUST be retained for audit and never modified.
- **FR-006**: When a ticket has at least one persisted analysis, the latest row MUST drive the panel display, and reopening the ticket MUST render the panel without invoking any LLM call.
- **FR-007**: When the ticket's title or description has changed (non-whitespace difference) since the snapshot stored on the latest analysis row, the panel MUST display a "description changed" banner offering a re-analyze action.
- **FR-008**: A re-analyze action MUST be available on every analyzed ticket. Triggering it MUST run the full analysis pipeline and create a new row; the existing row is preserved, not overwritten.
- **FR-009**: System MUST NOT auto-trigger any analysis or re-analysis. Every run requires an explicit user action.
- **FR-010**: Comments on the ticket MUST NOT count as description changes for banner purposes.
- **FR-011**: The analysis pipeline MUST consist of two LLM stages: a scoping pass on the ticket text alone (and the bounded stack/operating-context extract), followed by a grounded estimation pass that additionally receives the top comparable past outcomes.
- **FR-012**: Comparable past outcomes MUST be selected by structural-domain overlap (and semantic-tag overlap as tie-breaker) drawn exclusively from the AIB-742 outcome dataset, scoped to the same project, restricted to non-partial rows, and capped at 5 anchors.
- **FR-013**: System MUST NOT use free-form text similarity (embeddings or otherwise) for comparable-ticket retrieval.
- **FR-014**: When fewer than 3 comparable past outcomes are available, system MUST activate the cold-start path: the panel renders without numeric quality-gate or cost ranges and surfaces an explicit cold-start notice naming the cause.
- **FR-015**: Even in cold-start, system MUST surface scope warnings derived from the ticket text alone.
- **FR-016**: The grounded estimation prompt MUST receive, in addition to the ticket text, the project's declared stack (language, framework, services list, testing framework, e2e flag) and a bounded operating-context extract.
- **FR-017**: System MUST produce, for non-cold-start analyses: a friction-risk rating in {low, medium, high}; an expected quality-gate range with explicit lower and upper bounds; a recommendation in {QUICK, FULL} with a low/medium/high confidence label and a short text justification; an expected cost range decomposed into baseline pipeline cost and marginal friction cost; up to 5 scope warnings; and up to 5 anchor tickets ordered by overlap strength then recency.
- **FR-018**: Each anchor entry MUST display the past ticket's key, friction status, and quality score (or an explicit "no score" indicator), and MUST link to the ticket page within the current project.
- **FR-019**: System MUST enforce a rate limit of 10 successful analyses per user per rolling hour, project-agnostic. Failed runs MUST NOT count against the budget. Rejected requests MUST surface a message including when capacity returns.
- **FR-020**: Access control on triggering and reading an analysis MUST exactly match existing ticket-access rules (project owner or member). No new role or permission tier is introduced.
- **FR-021**: Anchor entries MUST be filtered to those the requesting user has access to before render. Inaccessible anchors MUST NOT be displayed and MUST NOT leak metadata.
- **FR-022**: System MUST persist, on each row: the analysis input snapshot (ticket title + description at run time), the project's stack snapshot, the anchor IDs used, the model output (all panel fields), the rule-set version that generated the recommendation, the actual measured USD cost, the start and end timestamps, and the run status (success/failure/cold-start).
- **FR-023**: System MUST handle failures gracefully: scoping-pass failures abort the run before the grounded pass; any failure produces a failed row that does not consume budget; the panel surfaces a retry option; partial output is never displayed.
- **FR-024**: System MUST run analyses asynchronously: triggering returns immediately; the panel shows a "running" placeholder until the run completes or fails. No HTTP request is left blocking for the duration of the run.
- **FR-025**: Color-coded signals (risk, confidence) MUST be accompanied by accessible text labels. The "description changed" banner MUST be announced to screen readers as a live region update. All interactive elements MUST be keyboard-operable.
- **FR-026**: System MUST NOT regress any existing ticket flow. Triggering, displaying, or failing an analysis MUST NOT alter ticket stage, job lifecycle, notifications, billing, or any other existing path.

### Assumptions

- The AIB-742 outcome capture feature has shipped and produced at least some non-partial outcomes for the projects on which this feature is meaningfully tested. Cold-start otherwise dominates (intended behaviour).
- The project's declared stack fields (`language`, `framework`, `services`, `testing.framework`, `testing.e2e`) come from the existing per-project configuration consumed elsewhere in the platform.
- The platform has a consistent unit cost model that allows a static USD reference table to estimate analysis cost ahead of the run with reasonable accuracy.
- The structural-domain set used for overlap is the same `domains: String[]` set persisted on `TicketOutcome` rows by AIB-742.
- The project's "default agent" is the agent configured in `agent.cli` of the project config; this feature does not introduce cross-agent recommendation logic.

### Key Entities *(include if feature involves data)*

- **TicketAnalysis**: One row per analysis run, append-only. Captures the input snapshot (ticket key, title, description), the project stack snapshot (language, framework, services, testing framework), the anchor IDs used (foreign references to past tickets/outcomes), the panel output fields (frictionRisk, qualityGateRange, recommendation, recommendationConfidence, recommendationJustification, costRangeBaseline, costRangeMarginalFriction, scopeWarnings, anchors), the cold-start flag and its reason code, the rule-set version, the measured USD cost, the run status (running/success/failed/cold-start), and the start/end timestamps. Relations: belongs to one Ticket; belongs to one Project (denormalized for query convenience); belongs to one User (the trigger).
- **AnalysisRateBudget**: Per-user rolling-window state used to enforce the 10-per-hour limit. Relations: belongs to one User.
- **AnchorReference**: Lightweight projection embedded on each TicketAnalysis row (or normalized — left to PLAN), identifying past tickets used as anchors with enough denormalized data to render the anchor list without re-fetching outcome rows on every panel paint (ticket key, friction status at analysis time, quality score at analysis time, overlap strength).

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **InboxAnalysisRun**: Triggered when a user clicks the analysis button or the re-analyze action on an INBOX ticket.
  - **Input**: Ticket identifier, current ticket title and description, project context (including declared stack and operating-context extract), requesting user, requesting user's current hourly-budget state.
  - **Phases**:
    1. Authorize: verify the user has access to the ticket; verify the ticket is in stage INBOX.
    2. Rate-limit check: reject early if the user has reached the per-hour cap.
    3. Persist a new TicketAnalysis row in `running` status with the input snapshot.
    4. Scoping pass: invoke the LLM on the ticket text + bounded stack/operating-context extract to produce the predicted structural-domain set, scope warnings, and a description-only friction-risk hint.
    5. Anchor retrieval: query the AIB-742 outcome dataset for the same project, filter to non-partial rows, score by structural-domain overlap (using the predicted domains from step 4) and semantic-tag overlap, take the top 5; if fewer than 3 qualifying anchors remain, mark the run as cold-start and skip step 6.
    6. Grounded estimation pass: invoke the LLM on the ticket text + stack extract + the selected anchors' outcome summaries (friction status, quality score, structural domains, semantic tags, cost, duration) to produce the friction-risk rating, quality-gate range, recommendation with confidence and justification, and decomposed cost range.
    7. Persist the complete output to the existing row, set status to `success` (or `cold-start` when triggered by step 5), and stamp the measured cost and end timestamp. Increment the user's rate-limit budget for successful runs.
  - **Output**: A finalized TicketAnalysis row visible in the panel. Cold-start rows are still surfaced — they have no numeric ranges but carry the cold-start notice and scope warnings.
  - **Error behavior**: Any failure transitions the row to `failed` with a reason code; the user's budget is not incremented; the panel surfaces a retry option. The grounded pass never runs if the scoping pass fails. No partial rows are ever displayed in the panel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of successful analyses complete within 10 seconds end-to-end (measured from button click to panel paint).
- **SC-002**: Reopening an already-analyzed ticket renders the panel in under 200 ms, with zero LLM calls executed (measured by panel-paint latency and an LLM-call counter on the read path).
- **SC-003**: When a project's outcome dataset contains at least 3 non-partial comparable rows for the analyzed ticket's predicted domain, 100% of analyses produce a non-cold-start panel with all numeric ranges populated.
- **SC-004**: When a project's outcome dataset contains fewer than 3 comparable rows, 100% of analyses surface the cold-start notice and scope warnings, and produce no numeric ranges.
- **SC-005**: The "description changed" banner appears on every panel render where the current `title + description` differs (non-whitespace) from the stored snapshot, and disappears when the user reverts the edits — verified end-to-end.
- **SC-006**: The 11th analysis attempt within a rolling hour by a single user is rejected with a user-readable message naming the time at which capacity returns. Failed runs (LLM error, timeout) are observed not to consume budget.
- **SC-007**: Across at least two projects with distinct declared stacks, the same analyzed-ticket description produces a fully rendered panel in both, with no errors arising from stack-dependent code paths.
- **SC-008**: Anchor links resolve to the cited tickets in 100% of cases where the user has access to those tickets, and the anchors that the user lacks access to are filtered out before render in 100% of cases (privacy invariant).
- **SC-009**: Analysis runs are recorded as append-only: 0 mutations to existing TicketAnalysis rows are observed in a periodic audit query over a representative window.
- **SC-010**: No regression on existing ticket flows: stage transitions, job lifecycle, notifications, billing, and existing analytics produce identical observable results when the analysis feature is enabled, disabled, or failing.
- **SC-011**: Accessibility audits (automated tooling + manual screen-reader pass) report zero critical issues on the analysis panel and the description-changed banner.
- **SC-012**: Anchor citations carry, for every analysis run, the friction status and quality score of the cited tickets — verified by sampling persisted rows.
