# Feature Specification: Admin home dashboard with business KPIs and trends

**Feature Branch**: `AIB-800-admin-home-dashboard`
**Created**: 2026-05-12
**Status**: Draft
**Input**: Ticket AIB-800 — replace the current `/admin` redirect with a real admin home that surfaces business KPIs, conditional alerts, trends, and actionable details at a glance.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: MRR is computed as the sum of monthly price points for all currently active PRO and TEAM subscriptions, using the per-plan price defined by the billing catalog. Annual / non-monthly cadences are normalized to a monthly contribution. Currency follows the existing billing system.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium (signal score netScore=-1, several conflicting interpretations exist for "MRR estimé")
- **Fallback Triggered?**: Yes — multiple reasonable interpretations (cash collected vs. contract value vs. recognized revenue); CONSERVATIVE picks the most universally understood SaaS definition (recurring contract value at snapshot time).
- **Trade-offs**:
  1. Excludes one-time fees and credits, so it is a simpler approximation than financial-grade MRR.
  2. Stays comparable month over month and matches the existing plan catalog without new accounting infrastructure.
- **Reviewer Notes**: Confirm currency unit (single currency vs. multi-currency display) and whether trial subscriptions should count as MRR.

- **Decision**: MAU (Monthly Active Users) counts distinct users who have triggered at least one job in the trailing 30 days. "Active" means a meaningful product action (job execution), not merely a session/login.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium
- **Fallback Triggered?**: Yes — "active" is ambiguous (login vs. action vs. job); CONSERVATIVE picks the highest-signal definition that already has reliable tracking in the platform.
- **Trade-offs**:
  1. Excludes lurkers who log in without working — number is lower than a session-based MAU.
  2. Tightly correlated to platform value delivered and to MRR drivers, which is what an operator wants to see.
- **Reviewer Notes**: If the team prefers a session-based MAU later, the calculation can be changed without changing the UI.

- **Decision**: FREE → PAID conversion rate is computed as the share of currently paying users (PRO + TEAM) over the total user base (FREE + PRO + TEAM) at snapshot time. It is presented as a current-state ratio, not a cohort conversion.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium
- **Fallback Triggered?**: Yes — could be interpreted as a cohort metric (sign-ups that became paying within N days); CONSERVATIVE picks the snapshot interpretation because it is unambiguous, drift-resistant, and matches the KPI tile context (a current ratio next to a current count).
- **Trade-offs**:
  1. Does not show conversion speed (time-to-paid).
  2. Easier to interpret for a 5-second glance and consistent with how the other Pulse tiles present current state.
- **Reviewer Notes**: Cohort-based time-to-paid can be added later as a separate metric if needed.

- **Decision**: The 30-day activation funnel uses a cohort approach — the denominator at every step is the set of users who signed up in the trailing 30 days. Each subsequent step counts how many of THAT cohort reached the milestone (first project created, first job launched, first paid subscription), regardless of whether the milestone occurred during the 30-day window.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium
- **Fallback Triggered?**: Yes — could also be read as "any milestone reached during the 30 days regardless of cohort"; CONSERVATIVE picks the cohort interpretation because that is the standard meaning of an activation funnel and the only one that lets steps be compared to each other.
- **Trade-offs**:
  1. Users who signed up just before the window starts are not measured here; activation diagnostics may need a longer window for deeper analysis.
  2. Step-to-step rates are mathematically valid and tell a coherent story about onboarding health.
- **Reviewer Notes**: If activation can take more than 30 days, surface a tooltip explaining the window.

- **Decision**: The "job success rate < 90% on 7 days" alert is gated by a minimum volume threshold: it does not trigger unless at least 20 jobs ran in the trailing 7 days. Below that volume, the data is considered too sparse to be actionable.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium
- **Fallback Triggered?**: Yes — ticket does not mention a minimum volume; CONSERVATIVE picks a small threshold to prevent the alert from firing on, e.g., 1 failure out of 2 jobs.
- **Trade-offs**:
  1. A real incident that happens during a low-traffic week could be muted.
  2. Avoids alert fatigue and false positives during quiet periods; the operator can still rely on the failed-jobs table to spot rare anomalies.
- **Reviewer Notes**: Tune the threshold once real traffic baselines are visible.

- **Decision**: "Critical cron not executed for more than 36h" alert is scoped to a curated allowlist of crons whose absence has business impact (e.g., billing reconciliation, log retention, scheduled cleanup). The list is defined as part of this feature rather than monitoring every workflow.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium
- **Fallback Triggered?**: Yes — ticket says "cron critique" without naming them; CONSERVATIVE picks an explicit allowlist instead of guessing or watching every cron.
- **Trade-offs**:
  1. New crons must be opted into the allowlist explicitly.
  2. Prevents noise from optional / experimental crons and keeps the alert signal high.
- **Reviewer Notes**: Confirm which crons join the initial allowlist; document the registration process.

- **Decision**: The "unprocessed Stripe webhook errors in the last 24h" alert relies on a record of webhook processing failures. Detecting this requires recording each webhook delivery outcome (success / failure / retry exhausted), since the current event log only stores events that were processed successfully.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: Medium
- **Fallback Triggered?**: Yes — ticket assumes detection is possible but does not specify the data source; CONSERVATIVE acknowledges the gap and includes the tracking obligation in scope so the alert is real and testable.
- **Trade-offs**:
  1. Adds a small surface area (webhook outcome tracking) to the feature.
  2. Without it the alert would silently never fire — a false sense of safety that is worse than no alert.
- **Reviewer Notes**: Validate the retention window for failed-webhook records (28+ days is conservative).

- **Decision**: Tables and charts that rank by jobs (top users, top projects, jobs/day) count every job regardless of final status (success, failed, cancelled). The dedicated success-vs-fail chart breaks the count down by outcome.
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A user/project with many failed jobs is still surfaced as "active".
  2. Matches operator intent ("who is exercising the platform"); status breakdown remains visible in the dedicated trend chart.
- **Reviewer Notes**: None.

- **Decision**: The 30-second auto-refresh keeps the previously rendered data visible while the new fetch is in flight, swapping in updated values only when the fresh result arrives. The page never shows a global loading skeleton during background refresh, only on first paint.
- **Policy Applied**: AUTO → CONSERVATIVE fallback
- **Confidence**: High
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Operators may briefly see slightly stale data while a refetch is pending.
  2. Eliminates the visible flicker mentioned as a requirement and keeps the dashboard usable while updating.
- **Reviewer Notes**: None.

- **Decision**: Non-admin users (and unauthenticated users) receive an HTTP 404 response on `/admin`. The response is byte-for-byte indistinguishable from a missing route — no "forbidden" hint, no redirect to login from this surface.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly less helpful for a legitimate admin who is signed out (they see 404 rather than a login prompt).
  2. Hides the existence of admin tooling from the public, which is the stated requirement.
- **Reviewer Notes**: None.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 5-second health glance with KPIs and conditional alerts (Priority: P1)

When an allowlisted admin lands on `/admin`, they immediately see (a) any critical alerts that demand attention and (b) the four Pulse KPI tiles that tell them whether the business is growing, paying, and active. They can decide within a few seconds whether to drill deeper or close the tab and move on.

**Why this priority**: This is the entire reason the page exists — replacing the current redirect with a single screen that answers "is the platform healthy right now?". Even without trends, panels, or tables, this slice already delivers the core operator value.

**Independent Test**: An allowlisted admin opens `/admin`, sees four Pulse tiles populated with real numbers, sees zero or more alert banners depending on platform state, and can verify by changing platform state (e.g., dropping success rate below threshold) that an alert appears on the next refresh.

**Acceptance Scenarios**:

1. **Given** the user is signed in and on the admin allowlist, **When** they visit `/admin`, **Then** the page renders the admin shell with the "Accueil" sidebar item marked active and the four Pulse tiles populated.
2. **Given** the platform is healthy (success rate ≥ 90%, no Stripe failures, all critical crons fresh), **When** an admin visits `/admin`, **Then** no alert banner is shown above the Pulse tiles.
3. **Given** the trailing 7-day job success rate has dropped below 90% with at least the minimum volume of jobs, **When** an admin visits `/admin`, **Then** a low-success-rate alert is shown with a link to the failed jobs view.
4. **Given** there are unprocessed Stripe webhook failures in the last 24 hours, **When** an admin visits `/admin`, **Then** a Stripe-error alert is shown with a link to the failed events.
5. **Given** at least one allowlisted critical cron has not run for more than 36 hours, **When** an admin visits `/admin`, **Then** a stale-cron alert is shown with a link to the cron history.
6. **Given** each Pulse tile has a primary value plus two deltas and a sparkline, **When** the tile renders, **Then** the deltas reflect the right reference periods (Users: 7d & 30d; MAU: vs previous month & % of base; MRR: month delta & PRO/TEAM split; Active paying: 30d delta & FREE→PAID conversion).

---

### User Story 2 - Business health overview (Priority: P2)

The admin scrolls (or glances) past the KPI strip and sees three panels that answer: how is the customer mix? how is the activation funnel performing? are we losing more than we are gaining this month?

**Why this priority**: Once the operator confirms the platform is alive, the next question is "are we doing well commercially?". This stratum delivers that without requiring the deepest detail.

**Independent Test**: An admin scrolls to the Santé Business row and verifies the plan donut, the 4-step activation funnel with conversion rates, and the churn panel with this-month cancellations, downgrades, MRR lost, and net MRR delta — all rendered with real values from production data.

**Acceptance Scenarios**:

1. **Given** the user base spans FREE, PRO, and TEAM plans, **When** the donut renders, **Then** it shows three segments proportional to current plan counts with the absolute count for each plan.
2. **Given** a 30-day signup cohort exists, **When** the funnel renders, **Then** it shows four sequential steps (Signup → first project created → first job launched → first paid subscription) and the percentage of cohort retained at each step.
3. **Given** there have been cancellations and/or downgrades this calendar month, **When** the churn panel renders, **Then** it shows the count of cancellations, the count of downgrades, the MRR lost, and the net MRR delta for the month.
4. **Given** there are no cancellations this month, **When** the churn panel renders, **Then** it shows zeros without errors and the net MRR delta reflects only acquisitions and upgrades.

---

### User Story 3 - Trend lines over 30 days and 12 months (Priority: P3)

The admin wants to confirm that today's snapshot is part of a healthy trajectory: are signups trending up, are jobs growing without a parallel rise in failures, is MRR climbing month over month?

**Why this priority**: Trends contextualize the KPIs — a flat number means different things on a rising curve vs. a falling one. Useful but not blocking.

**Independent Test**: An admin scrolls to the Tendances row and sees three charts populated with real values: signups per day for 30 days, jobs per day for 30 days split by success/fail, and MRR per month for 12 months.

**Acceptance Scenarios**:

1. **Given** there have been signups in the last 30 days, **When** the signups chart renders, **Then** it shows one data point per day for the trailing 30 days with the correct count per day.
2. **Given** there have been jobs in the last 30 days, **When** the jobs chart renders, **Then** it shows daily stacked counts of successful and failed jobs, summing to total daily jobs.
3. **Given** the platform has been operating for at least one month, **When** the MRR chart renders, **Then** it shows one MRR data point per month for the trailing 12 months (or fewer if the platform is younger), each value corresponding to month-end MRR.

---

### User Story 4 - Actionable detail tables (Priority: P3)

The admin sees four compact tables in a 2x2 grid so they can quickly identify named users and projects worth following up on: who paid, who churned, who is most active, which projects are busiest.

**Why this priority**: This is the "drill-down within the same screen" stratum. It complements the KPIs but is not what answers the 5-second question.

**Independent Test**: An admin scrolls to the Détails actionnables grid and verifies each table shows the right rows in the right order with the right columns.

**Acceptance Scenarios**:

1. **Given** users became paying in the last 30 days, **When** the "new paying users" table renders, **Then** it lists those users with email, current paid plan, and account age, ordered most-recent-first.
2. **Given** users cancelled their subscription in the last 30 days, **When** the cancellations table renders, **Then** it lists those users with email, the plan they lost, and their account age, ordered most-recent-first.
3. **Given** the current calendar month has activity, **When** the top users table renders, **Then** it shows the 5 users with the highest job counts this month, with email, plan, and job count, ordered by count descending.
4. **Given** the current calendar month has activity, **When** the top projects table renders, **Then** it shows the 5 projects with the highest job counts this month, with project key, owner email, and job count, ordered by count descending.

---

### User Story 5 - Auto-refresh and admin gating (Priority: P2)

The admin keeps the dashboard open in a tab and expects it to stay current without manual reload. A non-admin who somehow knows the URL must not be able to confirm the page exists.

**Why this priority**: These are platform-wide rules that apply to every other story, so they ride on top.

**Independent Test**: Leave the dashboard open for a minute and observe that values update on a 30-second cadence with no global loading skeleton flashing. Sign in as a non-allowlisted user and request `/admin` — the response is indistinguishable from a missing route.

**Acceptance Scenarios**:

1. **Given** the dashboard has rendered once and data has changed on the server, **When** 30 seconds have elapsed, **Then** the values refresh on screen without unmounting any block and without a global skeleton being displayed.
2. **Given** a non-admin user is signed in, **When** they request `/admin`, **Then** they receive an HTTP 404 response with no body or markup that hints at admin tooling.
3. **Given** an unauthenticated user, **When** they request `/admin`, **Then** they receive the same 404 response as a signed-in non-admin.

---

### Edge Cases

- **New platform with very little data**: Funnel, trends, and tables degrade gracefully — empty tables show a friendly "no data yet" message, sparklines render flat, deltas display "—" when there is no prior period to compare to.
- **All plans empty for a segment**: A zero-count plan still appears in the donut legend with a "0" count, not omitted, so the operator can confirm the segment exists.
- **No signups in last 30 days**: Funnel shows 0 across all steps and each step's conversion shows "—" instead of dividing by zero.
- **Cron just deployed and never ran**: A cron registered in the critical allowlist but never executed is treated the same as a stale cron (alert triggered) so missing data is visible rather than silent.
- **Concurrent admins**: Two admins viewing the page simultaneously see the same data on their own 30-second cadence; there is no shared state.
- **Slow data fetch**: If the refresh takes longer than 30 seconds, the in-flight request completes before the next one is scheduled; requests do not stack.
- **Server unreachable during refresh**: The previous data stays visible and a small subtle indicator (does not require a full skeleton) signals that the last refresh failed; the next refresh is attempted on schedule.
- **MRR-bearing subscription in a non-standard state (e.g., past due, paused)**: Subscriptions are counted as active only when they are in a state that genuinely represents recurring revenue per the billing system's definition; trial subscriptions are excluded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/admin` MUST render the new admin home dashboard for users on the admin allowlist, replacing the current redirect to `/admin/insights`.
- **FR-002**: Requests to `/admin` from non-allowlisted authenticated users and from unauthenticated users MUST return an HTTP 404 response that is indistinguishable from a missing route.
- **FR-003**: The admin home MUST render inside the existing admin shell with the sidebar item labelled "Accueil" highlighted as the active route.
- **FR-004**: The page MUST render a top-of-page alert area that is empty when no anomaly is detected and that displays one banner per detected anomaly otherwise.
- **FR-005**: System MUST detect and surface a "low job success rate" alert when the trailing 7-day job success rate is below 90% and the trailing 7-day job volume meets the minimum-volume threshold.
- **FR-006**: System MUST detect and surface a "Stripe webhook errors" alert when one or more Stripe webhook deliveries failed processing within the last 24 hours.
- **FR-007**: System MUST record the outcome of each Stripe webhook delivery (success / failure / retry exhausted) so that the Stripe webhook alert has a reliable data source.
- **FR-008**: System MUST detect and surface a "stale critical cron" alert when any cron on the critical-cron allowlist has not executed within the last 36 hours.
- **FR-009**: System MUST maintain a record of the last successful execution time for each cron on the critical-cron allowlist.
- **FR-010**: Each alert banner MUST include a contextual action link to the relevant deeper view (failed jobs, failed Stripe events, cron history).
- **FR-011**: The Pulse strip MUST display exactly four KPI tiles side by side, each with one primary value, two numeric deltas, and one 30-day sparkline.
- **FR-012**: The Users tile MUST show total user count with a 7-day delta and a 30-day delta.
- **FR-013**: The MAU tile MUST show users who triggered at least one job in the trailing 30 days, with a delta vs. the previous trailing 30 days and a percentage of the total user base.
- **FR-014**: The MRR tile MUST show estimated monthly recurring revenue (sum of PRO + TEAM monthly contributions) with a current-month delta and a PRO/TEAM split.
- **FR-015**: The Active Paying tile MUST show the count of currently paying users (PRO + TEAM) with a 30-day delta and the FREE→PAID conversion rate (paying / total).
- **FR-016**: The Santé Business stratum MUST render three side-by-side panels: plan distribution donut, 30-day activation funnel, and current-month churn panel.
- **FR-017**: The plan distribution donut MUST show the current count of users on each of FREE, PRO, TEAM with an absolute count next to each segment.
- **FR-018**: The activation funnel MUST display four sequential steps (Signup → first project created → first job launched → first paid subscription) measured against the cohort of users who signed up in the trailing 30 days, and MUST display the conversion percentage between each consecutive pair of steps.
- **FR-019**: The churn panel MUST display the current calendar month's count of cancellations, count of downgrades, MRR lost, and net MRR delta.
- **FR-020**: The Tendances stratum MUST render three charts: signups per day over 30 days, jobs per day over 30 days stacked by success vs fail, and MRR per month over 12 months.
- **FR-021**: The Détails actionnables stratum MUST render four compact tables in a 2x2 grid: new paying users in the last 30 days, recent cancellations in the last 30 days, top 5 users by jobs this month, and top 5 projects by jobs this month.
- **FR-022**: The new paying users table MUST show email, plan, and account age, ordered most-recent-first.
- **FR-023**: The cancellations table MUST show email, the lost plan, and account age, ordered most-recent-first.
- **FR-024**: The top users table MUST show email, plan, and current-month job count, ordered by job count descending, limited to 5 rows.
- **FR-025**: The top projects table MUST show project key, owner email, and current-month job count, ordered by job count descending, limited to 5 rows.
- **FR-026**: The page MUST refresh its data automatically every 30 seconds with no global loading skeleton; previously rendered data MUST remain visible during the in-flight refresh.
- **FR-027**: When a background refresh fails, the page MUST keep showing the most recent successful data and MUST attempt the next scheduled refresh.
- **FR-028**: All numeric values displayed in tiles, panels, charts, and tables MUST be computed from current platform data and not from hardcoded or seeded fixtures.
- **FR-029**: When a block has no data to display (e.g., no signups in 30 days, no cancellations this month), the block MUST render an empty state without errors and without divide-by-zero artifacts in derived percentages.
- **FR-030**: The page MUST visually conform to the existing admin shell so that navigation, theming, and density match the other admin pages.

### Key Entities

- **Admin Allowlist**: The set of user email addresses authorized to view admin surfaces. Membership decides whether `/admin` returns the dashboard or 404.
- **User**: A platform account; categorized by current plan (FREE / PRO / TEAM), signup date, last activity timestamp.
- **Subscription**: A user's current paid plan with state (active, cancelled, downgraded, trial, etc.), monthly price contribution, and timestamps for lifecycle events used by churn and MRR calculations.
- **Job**: A unit of work executed on the platform with a status (success, failed, cancelled, etc.) and timestamps; used for success-rate alert, active-user definition, trend charts, and ranking tables.
- **Project**: A user-owned container of tickets and jobs; used for the top-projects ranking.
- **Stripe Webhook Outcome**: A record of each inbound Stripe webhook delivery and whether it was processed successfully, used to compute the Stripe-error alert.
- **Critical Cron Registration**: The allowlist of crons whose stale-execution status is monitored, along with the recorded last-success timestamp for each entry.

### Internal Processes

- **Critical cron last-run capture**: Each cron on the critical-cron allowlist records its last successful execution time so the dashboard can detect staleness.
  - **Input**: Cron identity (name or registered key) and the timestamp at which it completed successfully.
  - **Phases**: 1) Cron completes its functional work; 2) Outcome is recorded against the allowlist entry; 3) Failure during the cron itself MUST NOT update the timestamp.
  - **Output**: Updated last-success timestamp per allowlisted cron.
  - **Error behavior**: A failed cron run leaves the previous timestamp unchanged; if the cron stays failed past 36 hours, the dashboard alert fires.

- **Stripe webhook outcome capture**: Each incoming Stripe webhook delivery is recorded with the outcome of processing so the alert can detect recent failures.
  - **Input**: Stripe event id, type, and the result of the processing attempt.
  - **Phases**: 1) Webhook is received; 2) Processing is attempted; 3) The result (success / failure / retries exhausted) is recorded against the event.
  - **Output**: A queryable history of webhook outcomes covering at least the trailing 24 hours; older records may be pruned per existing retention practice.
  - **Error behavior**: A processing failure is recorded as such and counts toward the alert; a processing failure during outcome capture itself falls back to a log so the operator can still investigate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An allowlisted admin opening `/admin` for the first time perceives the page as ready (alerts area and four Pulse tiles visible with values) within 3 seconds on a typical broadband connection.
- **SC-002**: An operator can answer "is the platform healthy right now?" using only the top of the page (alerts + Pulse) in under 5 seconds.
- **SC-003**: Every numeric figure shown on the page corresponds to a value an operator can independently re-derive from the underlying platform data, with no fixture or placeholder values surviving to production.
- **SC-004**: Each of the three alert conditions (low success rate, Stripe webhook errors, stale critical cron) can be deliberately triggered in a staging environment and produces the corresponding banner with a working action link.
- **SC-005**: When platform state changes (e.g., a new paying user, a new failed job), the change is reflected in the dashboard within at most 30 seconds without the operator reloading the page and without a visible global skeleton flash.
- **SC-006**: A non-admin or signed-out user requesting `/admin` cannot distinguish the response from a request to a non-existent route on the same domain.
- **SC-007**: The four detail tables each show the correct top-N rows in the correct order for a representative dataset, verified by an independent SQL or read-only data check.
- **SC-008**: When the platform has no signups, no cancellations, or no jobs in the relevant window, the corresponding blocks render empty states without runtime errors and without nonsense percentages.
