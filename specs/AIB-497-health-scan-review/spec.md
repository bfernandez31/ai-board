# Feature Specification: Health Scan — Review Quality Analysis

**Feature Branch**: `AIB-497-health-scan-review`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Health scan: Review Quality analysis across merged PRs"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Cumulative analysis lookback period set to 30 days
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score 4 / 0.6)
- **Fallback Triggered?**: No — AUTO resolved with sufficient confidence to CONSERVATIVE
- **Trade-offs**:
  1. 30-day window captures enough history for pattern detection without unbounded growth
  2. Shorter windows risk missing slow-burn patterns; longer windows increase processing time
- **Reviewer Notes**: Confirm 30 days is sufficient given current PR merge velocity (~2-4 FULL PRs/week)

---

- **Decision**: Recurring pattern threshold set to 3 occurrences across different PRs
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score 4 / 0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Threshold of 3 reduces false positives from one-off review gaps
  2. Higher threshold would delay detection of genuine recurring issues
- **Reviewer Notes**: Validate that 3 is achievable given PR volume; adjust if too few tickets are generated

---

- **Decision**: Severity penalty weights (high=-15, medium=-8, low=-3) applied to base score of 100
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score 4 / 0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Conservative penalties ensure high-severity misses strongly impact the score
  2. A single PR with 7+ high-severity misses could drive the score to zero, which may feel punitive
- **Reviewer Notes**: Monitor early runs to confirm scoring feels representative; floor at 0 (no negative scores)

---

- **Decision**: Filtering out doc/spec staleness and TypeScript/ESLint-catchable issues from missed findings
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (established practice — low-value noise reduction)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reduces noise significantly; doc staleness and linter issues are addressed by other tools
  2. Risk of over-filtering if Codex/Copilot comments are borderline
- **Reviewer Notes**: Filtering logic must be explicit and auditable; edge cases should err on inclusion

---

- **Decision**: Only FULL workflow PRs analyzed (QUICK excluded)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (explicitly stated in ticket rationale)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Focuses analysis on substantive PRs with meaningful review surface
  2. QUICK workflow review quality remains unmonitored
- **Reviewer Notes**: No action needed — ticket explicitly requires this filtering

---

- **Decision**: Deduplication of cross-source findings uses file path + overlapping line range (within 5 lines)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (score 4 / 0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. 5-line overlap tolerance handles minor line offset differences between reviewers
  2. Too loose a tolerance risks merging distinct issues on nearby lines
- **Reviewer Notes**: Validate tolerance with real PR data; tighten if false dedup observed

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nightly Review Quality Scan Execution (Priority: P1)

The system automatically runs the Review Quality scan as part of the nightly health schedule. It identifies FULL workflow PRs merged since the last scan, collects review comments from all three sources (ai-board custom, Codex, Copilot), cross-references them to find gaps in ai-board's coverage, and stores a scored report.

**Why this priority**: This is the core value proposition — without incremental collection, no analysis is possible.

**Independent Test**: Can be fully tested by triggering a scan with known merged PRs that have review comments from multiple sources, then verifying the resulting report contains correctly identified missed findings.

**Acceptance Scenarios**:

1. **Given** 3 FULL workflow PRs were merged since the last scan, **When** the nightly scan runs, **Then** the system fetches review comments from all 3 sources for each PR and produces a report with missed findings classified by category and severity.
2. **Given** no FULL workflow PRs were merged since the last scan, **When** the nightly scan runs, **Then** the system skips gracefully with no report and no score recorded.
3. **Given** a PR has a Codex comment about an edge-case validation issue on `src/api/handler.ts:42` and no corresponding ai-board comment on the same file/line range, **When** the scan processes this PR, **Then** the finding appears in `missedFindings` with source "codex", category "edge-case validation", and the appropriate severity.
4. **Given** a PR has a Copilot comment about a doc staleness issue, **When** the scan processes this PR, **Then** the finding is filtered out and does not appear in the report.

---

### User Story 2 - Cumulative Pattern Detection and Ticket Creation (Priority: P2)

After each incremental collection, the system analyzes the last 30 days of scan reports to identify recurring review gap patterns. When the same category appears across 3 or more different PRs, the system checks for existing `[Review Gap]` tickets and creates new ones only for previously unticketed patterns.

**Why this priority**: Pattern detection transforms individual findings into actionable improvement tickets, closing the feedback loop to the constitution and review prompts.

**Independent Test**: Can be tested by seeding 3+ scan reports with repeated category patterns and verifying that a `[Review Gap]` ticket is generated with the correct title, description, and suggested rule.

**Acceptance Scenarios**:

1. **Given** the last 30 days of scan reports contain "error handling" missed findings across 4 different PRs, and no existing `[Review Gap]` ticket for "error handling", **When** cumulative analysis runs, **Then** a new ticket is created with title `[Review Gap] Add rule for error handling` including PR numbers, evidence, and a suggested constitution rule.
2. **Given** a recurring pattern for "state/lifecycle" already has an open `[Review Gap]` ticket, **When** cumulative analysis detects this pattern again, **Then** no duplicate ticket is created and the pattern is marked `alreadyTicketed: true` in the report.
3. **Given** a category appears in only 2 PRs over 30 days, **When** cumulative analysis runs, **Then** no ticket is generated for that category (below threshold).

---

### User Story 3 - Dashboard Module Card and Detail Drawer (Priority: P3)

Project maintainers view the Review Quality module on the health dashboard. The card displays the coverage score, number of missed findings, and a trend sparkline. Clicking the card opens a detail drawer showing current run findings grouped by category, cumulative recurring patterns with suggested rules, and any generated tickets.

**Why this priority**: Visibility into review quality trends drives continuous improvement, but the analysis engine (P1/P2) must work first.

**Independent Test**: Can be tested by loading the health dashboard with a project that has Review Quality scan results and verifying the card renders score/findings/trend and the drawer shows grouped findings and patterns.

**Acceptance Scenarios**:

1. **Given** a project has completed Review Quality scans, **When** a user opens the health dashboard, **Then** the Review Quality card displays the latest coverage score, total missed findings count, and a trend sparkline over recent scans.
2. **Given** a user clicks the Review Quality card, **When** the detail drawer opens, **Then** it shows missed findings grouped by category (with severity badges), cumulative recurring patterns with suggested constitution rules, and links to any generated tickets.
3. **Given** a project has never run a Review Quality scan, **When** a user views the health dashboard, **Then** the Review Quality card shows a "Never scanned" state consistent with other module cards.

---

### Edge Cases

- What happens when a PR has no review comments from any source? The scan processes it but reports zero missed findings for that PR.
- How does the system handle rate limiting when fetching GitHub review comments for many PRs? The scan processes PRs sequentially with appropriate request spacing; if rate-limited, it reports partial results and logs the error.
- What happens when a Codex or Copilot comment is ambiguous about which line it references? Comments without clear file/line metadata are excluded from cross-referencing but logged for diagnostic purposes.
- What happens when a previous scan report in the cumulative window has malformed JSON? The system skips that report in aggregation and logs a warning; analysis proceeds with available reports.
- What if the ai-board custom review comment spans multiple issues in a single `### Code review` section? Each distinct issue mentioned is treated as a separate finding for cross-referencing purposes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add `REVIEW_QUALITY` as a new health scan type alongside existing types (Security, Compliance, Tests, Spec Sync).
- **FR-002**: System MUST only process PRs associated with FULL workflow tickets, excluding QUICK workflow PRs.
- **FR-003**: System MUST track the last scan timestamp to process only PRs merged since the previous scan run (incremental, no re-reading).
- **FR-004**: System MUST collect review comments from three sources per PR: ai-board custom (`### Code review` in issue comments), Codex (`chatgpt-codex-connector[bot]` inline comments), and Copilot (`Copilot` inline comments).
- **FR-005**: System MUST cross-reference findings to identify issues caught by Codex or Copilot that ai-board custom did not catch.
- **FR-006**: System MUST filter out low-value findings: doc/spec staleness, issues detectable by TypeScript or ESLint, and duplicate findings across sources (same file + overlapping line range within 5 lines).
- **FR-007**: System MUST classify each missed finding into one of the defined categories: state/lifecycle, edge-case validation, test quality, error handling, UI/UX state, CI/workflow, API contract, security, performance.
- **FR-008**: System MUST assess severity (high/medium/low) for each missed finding based on runtime impact potential.
- **FR-009**: System MUST calculate a coverage score starting at 100 with penalties per missed finding: high=-15, medium=-8, low=-3, with a floor of 0.
- **FR-010**: System MUST perform cumulative analysis across the last 30 days of scan reports after each incremental collection.
- **FR-011**: System MUST identify recurring patterns defined as the same category appearing across 3 or more different PRs within the analysis window.
- **FR-012**: System MUST check for existing open `[Review Gap]` tickets (matching category and similar description) before creating new tickets for recurring patterns.
- **FR-013**: System MUST generate tickets for new recurring patterns with title format `[Review Gap] Add rule for {pattern description}`, including PR numbers, evidence, suggested rule, and target (constitution or review prompt).
- **FR-014**: System MUST store the scan report in structured JSON format containing summary, missedFindings, cumulativeAnalysis, and generatedTickets sections.
- **FR-015**: System MUST skip gracefully when no new FULL workflow PRs have merged since the last run, producing no report and no score update.
- **FR-016**: System MUST display a Review Quality module card on the health dashboard showing coverage score, missed findings count, and trend sparkline.
- **FR-017**: System MUST provide a detail drawer for the Review Quality module showing current findings by category, cumulative patterns with suggested rules, and generated ticket links.
- **FR-018**: System MUST integrate into the existing nightly health scan schedule.

### Key Entities *(include if feature involves data)*

- **Review Quality Scan Report**: A structured report per scan run containing summary metrics, individual missed findings, cumulative analysis results, and generated ticket references. Stored as JSON within the existing health scan infrastructure.
- **Missed Finding**: A single review gap instance — a specific issue caught by Codex or Copilot but not by ai-board custom, with PR number, source, category, severity, description, file, and line.
- **Recurring Pattern**: An aggregated insight from cumulative analysis — a category that appears across multiple PRs with a suggested constitution rule or review prompt improvement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The scan correctly identifies at least 80% of review gaps when compared against a manually curated baseline of 10 merged PRs with known cross-reviewer discrepancies.
- **SC-002**: Recurring patterns are surfaced and ticketed within 1 nightly scan cycle after the third occurrence threshold is met.
- **SC-003**: The coverage score accurately reflects review completeness — a run with zero missed findings scores 100, and each severity level penalizes proportionally as defined.
- **SC-004**: No duplicate `[Review Gap]` tickets are created for the same category and pattern across consecutive scan runs.
- **SC-005**: The health dashboard displays the Review Quality module with score, trend, and drill-down detail consistent with existing module load times.
- **SC-006**: Over a 30-day period, the system reduces the time required to identify review quality gaps from hours of manual cross-referencing to zero manual effort.

## Assumptions

- The project's GitHub repository has Codex and Copilot review bots enabled on PRs, so their comments are available via the GitHub API.
- The ai-board custom review always posts its review as a PR issue comment containing `### Code review` as a heading.
- The GitHub API token used by the health scan workflow has sufficient permissions to read PR comments (both issue comments and review comments).
- The existing nightly health workflow infrastructure supports adding a new scan type without structural changes.
- PR merge dates are reliable for determining "merged since last scan" boundaries.
