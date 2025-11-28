# Feature Specification: Project Analytics Dashboard

**Feature Branch**: `AIB-83-project-analytics-dashboard`
**Created**: 2025-11-28
**Status**: Draft
**Input**: User description: "{"ticketKey":"AIB-83","title":"Project Analytics Dashboard","description":"Ajouter une page de statistiques accessible depuis le menu projet (dropdown sur les cartes) avec une entrée Analytics.\n\n  Objectif\n\n  Exploiter les données de télémétrie Claude (tokens, coût, durée, outils) pour visualiser la santé et l'activité du projet.\n\n  Métriques clés\n\n  Overview cards (4 en haut):\n  - Total cost ($) + trend %\n  - Success rate (%) - jobs completed vs failed\n  - Avg job duration\n  - Tickets shipped (ce mois)\n\n  Charts:\n  1. Cost Over Time - Area chart, coût quotidien/hebdo\n  2. Cost by Stage - Horizontal bars (BUILD/SPECIFY/PLAN/VERIFY)\n  3. Token Usage - Input vs Output vs Cache (stacked ou grouped)\n  4. Top Tools - Horizontal bars (Edit, Read, Bash, Write, Glob...)\n  5. Cache Efficiency - Ring/donut avec % d'économies\n  6. Workflow Distribution - Donut (FULL/QUICK/CLEAN)\n  7. Velocity - Bar chart tickets shipped par semaine\n\n  Design\n\n  - Layout Bento Grid responsive","clarificationPolicy":"AUTO"}"

## Auto-Resolved Decisions

- **Decision**: Default time range for analytics data
- **Policy Applied**: AUTO → PRAGMATIC (netScore: -2, medium confidence)
- **Confidence**: Medium (0.6) — Feature description emphasized speed ("accessible depuis le menu"), no compliance/sensitive signals detected; internal workflow analytics without external user data; conflicting buckets: 0
- **Fallback Triggered?**: No — netScore < 0 clearly indicates pragmatic approach
- **Trade-offs**:
  1. Impact on scope: Default to 30 days of data, allowing users to drill down if needed (reduces initial query complexity)
  2. Impact on timeline: Simplifies first version by avoiding complex date range controls
- **Reviewer Notes**: Validate whether 30-day default meets user needs for monthly reporting; consider adding configurable date ranges in future iterations

---

- **Decision**: Caching strategy for analytics calculations
- **Policy Applied**: AUTO → PRAGMATIC (netScore: -1, medium confidence)
- **Confidence**: Medium (0.6) — Internal analytics tool prioritizing responsiveness; no sensitive data concerns; conflicting buckets: 0
- **Fallback Triggered?**: No — Speed and internal context favor pragmatic approach
- **Trade-offs**:
  1. Impact on quality: Real-time calculations without caching may show slight delays with large datasets
  2. Impact on timeline: No caching infrastructure needed for initial version
- **Reviewer Notes**: Monitor query performance; add caching (Redis/in-memory) if analytics page load exceeds 2 seconds with typical project sizes

---

- **Decision**: Granularity for cost/token tracking over time
- **Policy Applied**: AUTO → PRAGMATIC (netScore: -1, medium confidence)
- **Confidence**: Medium (0.6) — User description specified "daily/weekly"; internal tool without regulatory constraints; conflicting buckets: 0
- **Fallback Triggered?**: No — Clear user preference for daily/weekly views
- **Trade-offs**:
  1. Impact on scope: Daily aggregation sufficient for most analytics needs
  2. Impact on timeline: Avoids complexity of multiple granularity options
- **Reviewer Notes**: Confirm daily aggregation meets reporting needs; hourly granularity could be added if real-time monitoring becomes critical

## User Scenarios & Testing

### User Story 1 - View Project Cost Overview (Priority: P1)

Project managers and engineering leads need to quickly understand how much their AI-powered workflows are costing. They open the analytics dashboard to see total spend, identify cost trends, and determine if spending is within expected ranges.

**Why this priority**: Cost visibility is the primary driver for analytics adoption; without it, teams cannot manage budgets or optimize expensive operations.

**Independent Test**: Can be fully tested by creating test jobs with telemetry data, navigating to analytics page, and verifying cost metrics display correctly. Delivers immediate value by answering "How much are we spending?"

**Acceptance Scenarios**:

1. **Given** a project with completed jobs containing telemetry data, **When** user navigates to analytics page via project menu, **Then** overview card displays total cost in USD with 2 decimal precision
2. **Given** multiple jobs across different time periods, **When** analytics page loads, **Then** cost trend percentage shows increase/decrease compared to previous period
3. **Given** no jobs with cost data, **When** user views analytics, **Then** cost card displays $0.00 with "No data available" message

---

### User Story 2 - Monitor Job Success Rates (Priority: P1)

Development teams need to understand workflow reliability. They check the success rate to identify if specification, planning, or build jobs are failing more frequently than expected, indicating process issues.

**Why this priority**: Success rate is critical for identifying systemic problems that block productivity; low success rates signal urgent attention needed.

**Independent Test**: Can be tested by creating jobs with different statuses (COMPLETED/FAILED/CANCELLED), loading analytics, and verifying success rate percentage is calculated correctly. Delivers standalone value for reliability monitoring.

**Acceptance Scenarios**:

1. **Given** 8 COMPLETED jobs and 2 FAILED jobs, **When** analytics page loads, **Then** success rate displays 80%
2. **Given** project with only PENDING or RUNNING jobs, **When** user views analytics, **Then** success rate shows "N/A - No completed jobs"
3. **Given** all jobs COMPLETED successfully, **When** analytics loads, **Then** success rate displays 100% with green indicator

---

### User Story 3 - Analyze Cost by Workflow Stage (Priority: P2)

Teams want to identify which workflow stages (SPECIFY, PLAN, BUILD, VERIFY) consume the most resources. They examine the cost-by-stage chart to determine if certain stages are unexpectedly expensive.

**Why this priority**: Stage-level breakdown enables targeted optimization; teams can focus improvements on the most expensive phases without needing time-series data.

**Independent Test**: Can be tested independently by creating jobs across different commands (specify, plan, implement, verify), viewing the analytics chart, and verifying costs are correctly grouped by stage. Delivers actionable insights for cost optimization.

**Acceptance Scenarios**:

1. **Given** jobs with commands mapped to stages (specify→SPECIFY, implement→BUILD), **When** cost-by-stage chart renders, **Then** horizontal bars show cost for each stage sorted highest to lowest
2. **Given** no jobs for a particular stage, **When** chart loads, **Then** that stage shows $0.00 with empty bar
3. **Given** BUILD stage has highest cost, **When** user views chart, **Then** BUILD bar is longest and highlighted

---

### User Story 4 - Track Token Usage Patterns (Priority: P2)

Technical leads want to understand token consumption patterns to optimize prompts and caching. They review input/output/cache token charts to identify opportunities for cost reduction through better cache utilization.

**Why this priority**: Token-level insights enable optimization without requiring cost history; teams can immediately see cache efficiency and adjust accordingly.

**Independent Test**: Can be tested by creating jobs with different token distributions (high input, high cache reads, high output), viewing token usage chart, and verifying stacked/grouped bars display correctly. Delivers optimization insights independently.

**Acceptance Scenarios**:

1. **Given** jobs with input, output, and cache token data, **When** token usage chart loads, **Then** stacked bars display three segments with labels and counts
2. **Given** cacheReadTokens > 0, **When** cache efficiency donut chart renders, **Then** percentage shows (cacheReadTokens / totalTokens) * 100
3. **Given** no cache usage, **When** cache efficiency chart loads, **Then** displays "0% cache efficiency" with educational tooltip

---

### User Story 5 - Identify Most-Used Tools (Priority: P3)

Engineering teams want to know which Claude tools (Edit, Read, Bash, etc.) are used most frequently. They check the top tools chart to understand workflow patterns and optimize tool availability.

**Why this priority**: Tool usage analytics provide operational insights but aren't critical for cost/reliability management; useful for long-term optimization.

**Independent Test**: Can be tested by creating jobs with `toolsUsed` arrays, viewing the top tools chart, and verifying bars are sorted by frequency. Delivers process insights independently of other metrics.

**Acceptance Scenarios**:

1. **Given** jobs with toolsUsed arrays, **When** top tools chart renders, **Then** horizontal bars show top 10 tools sorted by frequency
2. **Given** tool "Edit" used 50 times and "Read" used 30 times, **When** chart loads, **Then** Edit bar is longer than Read bar
3. **Given** no tool usage data, **When** chart renders, **Then** displays "No tool data available"

---

### User Story 6 - View Cost Trends Over Time (Priority: P3)

Finance teams and project managers want to see spending trends to predict future costs and identify anomalies. They examine the cost-over-time area chart to spot spikes or unusual patterns.

**Why this priority**: Time-series analysis is valuable for forecasting but not essential for immediate cost awareness; most users need current totals first.

**Independent Test**: Can be tested by creating jobs with different completion dates, viewing the area chart, and verifying daily/weekly aggregation renders correctly. Delivers trend analysis independently.

**Acceptance Scenarios**:

1. **Given** jobs completed across multiple days, **When** cost-over-time chart loads with "daily" granularity, **Then** area chart shows data points for each day
2. **Given** user switches to "weekly" view, **When** chart re-renders, **Then** costs are aggregated by week with smooth curve
3. **Given** large spike in costs on one day, **When** user hovers over data point, **Then** tooltip shows date, cost, and job count

---

### User Story 7 - Understand Workflow Distribution (Priority: P3)

Teams using multiple workflow types (FULL, QUICK, CLEAN) want to see usage distribution. They check the workflow donut chart to determine if quick-impl is overused or if cleanup workflows are running regularly.

**Why this priority**: Workflow distribution insights are useful for process improvement but don't directly impact cost or reliability; informational rather than actionable.

**Independent Test**: Can be tested by creating tickets with different workflowType values, viewing the donut chart, and verifying segment sizes match distribution. Delivers process visibility independently.

**Acceptance Scenarios**:

1. **Given** 60% FULL workflows, 30% QUICK, 10% CLEAN, **When** donut chart loads, **Then** segments are sized proportionally with percentages labeled
2. **Given** only FULL workflows, **When** chart renders, **Then** shows single full circle with "100% FULL" label
3. **Given** no tickets with workflowType data, **When** chart loads, **Then** displays "No workflow data available"

---

### User Story 8 - Monitor Ticket Velocity (Priority: P3)

Team leads want to track how many tickets are being shipped per week to measure productivity. They review the velocity bar chart to identify trends and plan future capacity.

**Why this priority**: Velocity tracking is helpful for planning but not critical for immediate operational needs; teams can function without it initially.

**Independent Test**: Can be tested by creating tickets in SHIP stage with different updatedAt timestamps, viewing velocity chart, and verifying weekly aggregation is correct. Delivers productivity insights independently.

**Acceptance Scenarios**:

1. **Given** tickets shipped across 4 weeks, **When** velocity chart loads, **Then** bar chart shows count per week with week labels
2. **Given** 10 tickets shipped in current week, **When** chart renders, **Then** current week bar is highest with value label
3. **Given** no shipped tickets, **When** chart loads, **Then** displays empty chart with "No tickets shipped yet" message

---

### Edge Cases

- What happens when a project has zero jobs? Analytics page displays all charts with "No data available" messages and zeroed metrics.
- What happens when telemetry data is incomplete (some jobs missing costUsd)? System calculates metrics using only available data; incomplete data doesn't break charts.
- What happens when user accesses analytics for a project they don't own or aren't a member of? Authorization check returns 403 Forbidden with error message.
- What happens when analytics API queries large datasets (1000+ jobs)? Response time may degrade; consider pagination or aggregation limits if load time exceeds 2 seconds.
- What happens when date ranges span across years? Charts adapt axis labels to show year markers; no functionality breaks.
- What happens when cache efficiency is 100%? Donut chart shows full circle with "100% efficient" label and green indicator.
- What happens when workflowType is NULL for old tickets? System excludes NULL values from distribution chart or groups them as "Unknown".

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a navigation entry labeled "Analytics" in the project dropdown menu (accessible via three-dot menu on project cards)
- **FR-002**: System MUST display four overview cards at top of analytics page showing: Total Cost (USD), Success Rate (%), Average Job Duration (minutes/seconds), and Tickets Shipped This Month
- **FR-003**: System MUST calculate total cost by summing `costUsd` from all jobs belonging to the project
- **FR-004**: System MUST calculate success rate as (COMPLETED jobs / (COMPLETED + FAILED + CANCELLED jobs)) * 100, excluding PENDING and RUNNING jobs
- **FR-005**: System MUST calculate average job duration by averaging `durationMs` from completed jobs, converting to human-readable format
- **FR-006**: System MUST count tickets shipped this month by querying tickets in SHIP stage with `updatedAt` in current calendar month
- **FR-007**: System MUST display cost trend percentage showing change compared to previous period (e.g., previous 30 days if viewing last 30 days)
- **FR-008**: System MUST render cost-over-time area chart with toggle between daily and weekly granularity
- **FR-009**: System MUST map job commands to workflow stages: specify→SPECIFY, plan→PLAN, implement→BUILD, verify/deploy-preview→VERIFY, and aggregate costs accordingly
- **FR-010**: System MUST display cost-by-stage horizontal bar chart sorted descending by cost
- **FR-011**: System MUST render token usage chart showing input tokens, output tokens, and cache tokens (cache read + cache creation) as stacked or grouped bars
- **FR-012**: System MUST display top 10 most frequently used tools as horizontal bar chart, aggregating from `toolsUsed` arrays across all jobs
- **FR-013**: System MUST calculate cache efficiency as (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100 and display as donut chart
- **FR-014**: System MUST render workflow distribution donut chart showing percentage of FULL, QUICK, and CLEAN workflows based on ticket `workflowType` field
- **FR-015**: System MUST display velocity bar chart showing tickets shipped per week for last 8-12 weeks
- **FR-016**: System MUST enforce project access authorization using existing `verifyProjectAccess` helper (owner or member)
- **FR-017**: System MUST handle missing telemetry data gracefully, displaying "No data available" rather than errors
- **FR-018**: System MUST use responsive Bento Grid layout that adapts to mobile, tablet, and desktop viewports
- **FR-019**: Charts MUST display tooltips on hover showing detailed breakdowns (date, value, counts)
- **FR-020**: System MUST fetch analytics data via dedicated API endpoint that aggregates telemetry from Job model

### Key Entities

- **Analytics Summary**: Aggregated metrics representing project health; includes total cost, success rate, average duration, tickets shipped; derived from Job and Ticket entities; no persistent storage (calculated on-demand)
- **Cost Breakdown**: Time-series and categorical cost data; includes daily/weekly aggregations, stage-level groupings; sourced from Job.costUsd, Job.command, Job.completedAt
- **Token Metrics**: Token consumption data across types; includes input, output, cache read, cache creation tokens; sourced from Job telemetry fields; used for cache efficiency calculations
- **Tool Usage**: Frequency count of Claude tools used; aggregated from Job.toolsUsed arrays; used to identify most common workflow patterns
- **Velocity Metrics**: Ticket completion rates over time; calculated from Ticket.updatedAt for tickets in SHIP stage; grouped by week

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can navigate from project card to analytics page in 2 clicks (dropdown menu → Analytics)
- **SC-002**: Analytics page loads and displays all charts and overview cards within 2 seconds for projects with up to 500 jobs
- **SC-003**: Cost metrics are accurate to within $0.01 of summed telemetry data
- **SC-004**: Success rate percentage matches manual calculation of (COMPLETED / total_final_jobs) * 100 with zero tolerance for error
- **SC-005**: All charts gracefully handle zero-data scenarios without displaying errors or broken layouts
- **SC-006**: Analytics page is fully functional on mobile devices (320px width) with scrollable charts and responsive grid
- **SC-007**: 90% of project managers can identify their highest-cost workflow stage within 10 seconds of viewing analytics
- **SC-008**: Cache efficiency metric correctly reflects token savings, helping teams optimize prompt caching strategies
- **SC-009**: Unauthorized access attempts return 403 Forbidden without exposing project data
- **SC-010**: Analytics data remains synchronized with telemetry updates without requiring manual refresh
