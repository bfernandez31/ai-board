# Feature Specification: Project Analytics Dashboard

**Feature Branch**: `AIB-87-opus-project-analytics`
**Created**: 2025-11-28
**Status**: Draft
**Input**: User description: "Add an analytics page accessible from project menu with metrics visualization for cost, tokens, tools, and workflow performance"

## Auto-Resolved Decisions

- **Decision**: Time range selection approach for analytics
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) - Feature context is neutral with slight internal tooling signal
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Flexible time ranges add moderate complexity but provide essential drill-down capability
  2. Conservative approach defaults to 30-day view with preset options (7d, 30d, 90d, all time) rather than free-form date pickers
- **Reviewer Notes**: Verify 30-day default aligns with typical project review cycles

---

- **Decision**: Chart granularity (daily vs weekly aggregation)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) - Standard analytics expectation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Auto-adjusting granularity (daily for <30 days, weekly for >=30 days) provides appropriate detail level
  2. Adds minor complexity but avoids cluttered or sparse visualizations
- **Reviewer Notes**: Confirm auto-adjustment logic matches user mental model

---

- **Decision**: Empty state handling when no job data exists
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.85) - Industry-standard pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Display friendly empty states with guidance instead of blank charts
  2. Minor additional design work but significantly better user experience
- **Reviewer Notes**: Ensure empty state messaging guides users toward creating their first workflow

---

- **Decision**: Data refresh strategy for dashboard
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.85) - Aligns with existing polling patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Use existing 10-15 second polling interval pattern consistent with other project pages
  2. Avoids real-time complexity while ensuring reasonably fresh data
- **Reviewer Notes**: Verify polling interval doesn't impact performance with large datasets

---

- **Decision**: Chart library selection
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.8) - Industry-standard choice
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Recommend Recharts (lightweight, React-native, shadcn/ui compatible) over heavier alternatives
  2. Implementation detail but affects bundling; spec remains technology-agnostic
- **Reviewer Notes**: Implementation may choose alternative if better fit discovered

## User Scenarios & Testing

### User Story 1 - View Project Cost Overview (Priority: P1)

As a project owner, I want to see an overview of my project's AI spending so I can monitor costs and identify trends.

**Why this priority**: Cost visibility is the primary driver for analytics adoption; users need immediate insight into spending patterns to manage budgets effectively.

**Independent Test**: Can be fully tested by navigating to analytics page and verifying overview cards display accurate cost data from job history. Delivers immediate budget visibility value.

**Acceptance Scenarios**:

1. **Given** a project with completed jobs containing cost data, **When** I navigate to the analytics page, **Then** I see four overview cards showing total cost, success rate, average job duration, and tickets shipped this month
2. **Given** a project with jobs from multiple periods, **When** I view the total cost card, **Then** I see the current period cost and a percentage trend indicator comparing to the previous period
3. **Given** a project with no completed jobs, **When** I navigate to the analytics page, **Then** I see an empty state with guidance on how to create my first workflow

---

### User Story 2 - Analyze Cost Distribution by Stage (Priority: P1)

As a project owner, I want to understand how costs are distributed across workflow stages (BUILD, SPECIFY, PLAN, VERIFY) so I can optimize my development process.

**Why this priority**: Understanding stage-level cost breakdown enables targeted optimization and identifies which phases consume most resources.

**Independent Test**: Can be tested by viewing horizontal bar chart showing cost breakdown by stage. Delivers optimization insight value.

**Acceptance Scenarios**:

1. **Given** a project with jobs across multiple stages, **When** I view the Cost by Stage chart, **Then** I see horizontal bars representing cost for BUILD, SPECIFY, PLAN, and VERIFY stages
2. **Given** a project where BUILD stage dominates costs, **When** I view the Cost by Stage chart, **Then** BUILD bar is visually prominent with proportional size and labeled cost value
3. **Given** a project with no jobs in a particular stage, **When** I view the Cost by Stage chart, **Then** that stage appears with zero value (not hidden)

---

### User Story 3 - Track Cost Trends Over Time (Priority: P2)

As a project owner, I want to visualize cost trends over time so I can identify spending patterns and forecast future costs.

**Why this priority**: Trend visibility enables proactive budget management and early detection of cost anomalies.

**Independent Test**: Can be tested by viewing area chart showing cost progression over selected time period. Delivers trend analysis value.

**Acceptance Scenarios**:

1. **Given** a project with jobs over multiple weeks, **When** I view the Cost Over Time chart with 30-day range, **Then** I see an area chart with daily cost data points
2. **Given** I am viewing cost trends, **When** I select a different time range (7d, 30d, 90d, all time), **Then** the chart updates to show data for the selected period with appropriate granularity
3. **Given** sparse data over a long period, **When** I view a 90-day range, **Then** the chart shows weekly aggregations for readability

---

### User Story 4 - Monitor Token Usage and Cache Efficiency (Priority: P2)

As a project owner, I want to understand token consumption patterns including cache efficiency so I can optimize prompts and reduce costs.

**Why this priority**: Token breakdown reveals optimization opportunities; cache efficiency directly impacts cost savings.

**Independent Test**: Can be tested by viewing token usage chart and cache efficiency indicator. Delivers optimization opportunity insight.

**Acceptance Scenarios**:

1. **Given** a project with job telemetry data, **When** I view the Token Usage chart, **Then** I see a stacked or grouped bar chart showing input tokens, output tokens, and cache tokens
2. **Given** a project with cache usage data, **When** I view the Cache Efficiency indicator, **Then** I see a ring/donut chart showing percentage of cache savings with the savings amount
3. **Given** jobs without cache data, **When** I view the Cache Efficiency indicator, **Then** I see a message indicating cache metrics are not available

---

### User Story 5 - Analyze Tool Usage Patterns (Priority: P3)

As a project owner, I want to see which AI tools (Edit, Read, Bash, Write, Glob, etc.) are used most frequently so I can understand my workflow patterns.

**Why this priority**: Tool usage insights help understand AI assistance patterns and identify automation opportunities.

**Independent Test**: Can be tested by viewing horizontal bar chart of tool frequencies. Delivers workflow pattern visibility.

**Acceptance Scenarios**:

1. **Given** a project with completed jobs that used various tools, **When** I view the Top Tools chart, **Then** I see horizontal bars ranking tools by usage frequency
2. **Given** jobs using many different tools, **When** I view the Top Tools chart, **Then** I see the top 10 tools with remaining aggregated as "Other"
3. **Given** a project with no tool usage data, **When** I view the Top Tools chart, **Then** I see an empty state indicating no tool data is available

---

### User Story 6 - View Workflow Distribution and Velocity (Priority: P3)

As a project owner, I want to understand my workflow type distribution (FULL/QUICK/CLEAN) and shipping velocity so I can assess team productivity.

**Why this priority**: Distribution and velocity metrics provide team performance insights and help identify process improvements.

**Independent Test**: Can be tested by viewing workflow distribution donut chart and velocity bar chart. Delivers productivity visibility.

**Acceptance Scenarios**:

1. **Given** a project with tickets using different workflow types, **When** I view the Workflow Distribution chart, **Then** I see a donut chart showing proportion of FULL, QUICK, and CLEAN workflows
2. **Given** a project with shipped tickets over several weeks, **When** I view the Velocity chart, **Then** I see a bar chart showing tickets shipped per week
3. **Given** I am viewing the dashboard, **When** I look at the tickets shipped overview card, **Then** I see the count for the current month

---

### User Story 7 - Navigate to Analytics from Project Menu (Priority: P1)

As a user, I want to access analytics directly from the project card dropdown menu so I can quickly view project metrics without extra navigation.

**Why this priority**: Easy access from existing navigation patterns ensures discoverability and adoption.

**Independent Test**: Can be tested by clicking project menu and selecting Analytics option. Delivers navigation accessibility.

**Acceptance Scenarios**:

1. **Given** I am viewing the projects list, **When** I click the project menu dropdown, **Then** I see an "Analytics" menu item with an appropriate icon
2. **Given** I click the Analytics menu item, **When** the page loads, **Then** I am navigated to `/projects/{projectId}/analytics`
3. **Given** I am on the analytics page, **When** I use browser navigation, **Then** back button returns me to my previous location

---

### Edge Cases

- What happens when a job has null/missing telemetry fields? Display available metrics with "N/A" or appropriate fallback for missing values
- How does the dashboard handle jobs currently in PENDING or RUNNING status? Include in counts but exclude from cost/token calculations until completed
- What happens when all jobs in the selected time range are FAILED or CANCELLED? Show the data with success rate reflecting the failures; don't hide failed job data
- How should very large cost values be displayed? Use abbreviated format (e.g., $1.2K, $45.6K) with full value on hover

## Requirements

### Functional Requirements

- **FR-001**: System MUST display an analytics page at the route `/projects/{projectId}/analytics` accessible only to project owners and members
- **FR-002**: System MUST show four overview metric cards: Total Cost with trend percentage, Success Rate percentage, Average Job Duration, and Tickets Shipped (current month)
- **FR-003**: System MUST display a Cost Over Time area chart with selectable time ranges (7 days, 30 days, 90 days, all time)
- **FR-004**: System MUST display a Cost by Stage horizontal bar chart showing cost breakdown for BUILD, SPECIFY, PLAN, and VERIFY stages
- **FR-005**: System MUST display a Token Usage chart showing input tokens, output tokens, and cache tokens (read + creation)
- **FR-006**: System MUST display a Top Tools horizontal bar chart showing the most frequently used AI tools
- **FR-007**: System MUST display a Cache Efficiency ring/donut chart showing cache savings percentage
- **FR-008**: System MUST display a Workflow Distribution donut chart showing FULL, QUICK, and CLEAN workflow proportions
- **FR-009**: System MUST display a Velocity bar chart showing tickets shipped per week
- **FR-010**: System MUST add an "Analytics" menu item to the project dropdown menu (alongside existing Clean Project and Settings options)
- **FR-011**: System MUST use responsive bento grid layout adapting to different screen sizes
- **FR-012**: System MUST show appropriate empty states when no data is available for a given metric or chart
- **FR-013**: System MUST calculate trend percentages by comparing current period to the equivalent previous period
- **FR-014**: System MUST aggregate job data based on the job's associated stage (derived from command type: specify, plan, implement, verify)
- **FR-015**: System MUST respect project access control (only owners and members can view analytics)

### Key Entities

- **Job**: Source of all analytics data; contains telemetry fields (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, toolsUsed, command, status, completedAt)
- **Ticket**: Links jobs to workflow type (workflowType: FULL, QUICK, CLEAN) and provides shipped status for velocity calculations
- **Project**: Container for analytics scope; provides access control and date range context
- **Stage**: Derived from job command (specify → SPECIFY, plan → PLAN, implement → BUILD, verify → VERIFY) for stage-based cost breakdown

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can access project analytics within 2 clicks from the projects list page
- **SC-002**: Analytics page loads and displays all charts within 3 seconds for projects with up to 1,000 jobs
- **SC-003**: All numeric metrics are accurately calculated and consistent with underlying job data
- **SC-004**: Dashboard correctly reflects data changes within 15 seconds without manual refresh
- **SC-005**: Users can identify their highest-cost workflow stage within 5 seconds of viewing the dashboard
- **SC-006**: Cost trend indicator accurately reflects the percentage change compared to the previous equivalent period
- **SC-007**: Dashboard remains usable and readable on screens ranging from tablet (768px) to large desktop (1920px+)
- **SC-008**: Empty states provide clear guidance directing users toward actions that will populate analytics data
