# Projects - Functional Specification

## Purpose

Projects organize tickets into separate workspaces, each with its own Kanban board, settings, and team members. Users can manage multiple projects simultaneously and configure project-specific automation policies.

## Project Structure

### Project Information

Each project contains:

- **Name**: Project identifier and title
- **Key**: Unique 3-character identifier (e.g., "ABC", "DEF")
  - Uppercase alphanumeric format
  - Generated from project name or provided by user
  - Used as prefix for all ticket keys in the project
  - Immutable after project creation
- **Description**: Brief explanation of project purpose (stored but not displayed on cards)
- **Deployment URL**: Optional URL for deployed project (with quick-copy functionality)
- **GitHub Repository**: Required GitHub owner and repository name
  - **GitHub Owner**: Organization or user name (e.g., "bfernandez31")
  - **GitHub Repo**: Repository name (e.g., "ai-board", "my-project")
  - Used for workflow automation and code management
  - Workflows execute on external project repositories
- **Default Clarification Policy**: How AI resolves ambiguities during specification
- **Default Agent**: Which AI agent executes workflow automation (CLAUDE or CODEX; default: CLAUDE)
- **Has Specs**: Whether project specifications have been generated (boolean, default: false; set to true when a RETRO_SPEC job completes)
- **Creation Timestamp**: When project was created
- **Last Updated**: Most recent activity across all tickets

### Project-Ticket Relationship

- Each project contains multiple tickets
- Each ticket belongs to exactly one project
- Tickets cannot move between projects
- Deleting a project removes all its tickets

## Project List View

### Viewing All Projects

Users access projects through a dedicated projects list page:

**Display Information**:
- Project name
- **Health score heart indicator** (top-right corner of each card): a heart outline in the score color with the project's global health score (0–100) displayed inside. The heart interior fills progressively from bottom to top in proportion to the score (e.g., 72 → lower 72% of the interior is filled, upper 28% is empty). The fill is translucent so the card surface remains visible through it. Heart color bands: green (85–100), violet (60–84), orange (40–59), red (0–39). Projects that have never been scanned show a muted outline with a dash inside. Hovering the heart displays a popover with all 6 sub-scores (Security, Compliance, Tests, Spec Sync, Quality Gate, Review Quality); each sub-score shows its value and threshold color (following the standard 90/70/50 system thresholds), or a dash when not yet scanned. The heart is informational only — it does not trigger navigation or interfere with the card's click-to-board behavior.
- Deployment URL (if configured, with copy-to-clipboard functionality)
- GitHub repository link (if configured, displayed as "owner/repo")
- Latest shipped ticket information:
  - Ticket key (bold, e.g., "ABC-123") followed by ticket title with checkmark icon
  - Full text truncated with ellipsis if too long
  - Tooltip on hover shows complete "ticketKey + title" text
  - Metadata displayed below ticket title:
    - Relative timestamp ("Shipped 2h ago")
    - Total ticket count across all stages ("· 5 total")
  - "No tickets shipped yet" message when no shipped tickets exist

**Visual Design**:
- Modern and clean interface
- Scrollable container for many projects (50+)
- No pagination - all projects visible
- Compact card layout with clear information hierarchy

**Interaction**:
- Hover over project shows scale/transform effect
- Cursor changes to pointer indicating clickability
- Click project navigates to project board
- Click deployment URL opens in current tab (does not trigger card navigation)
- Click GitHub link opens repository in new tab (does not trigger card navigation)
- Click copy icon copies deployment URL to clipboard without triggering navigation
- Visual feedback on successful copy action (icon change or tooltip)

**Smart Display**:
- Deployment URL section hidden when not configured (no empty placeholder)
- GitHub link section hidden when not configured
- Full ticket title visible via tooltip on hover for truncated titles
- Relative timestamps update on page refresh

**Sort Order**:
- Projects are ordered from most recently active to least recently active
- A project's activity timestamp is the most recent of: project last-updated time, latest ticket update (including stage transitions), and latest workflow execution start
- Projects with no ticket or workflow activity fall back to the project's own last-updated time and appear last among recently-touched projects
- Ties (equal activity timestamps) are broken by project ID descending so ordering is deterministic
- The order is recomputed on every page load and reflects the latest activity after any ticket move, workflow run, or project edit

### Empty State

When no projects exist:
- Message indicates no projects are available
- Call-to-action encourages creating first project
- Clear path to project creation

### Navigation

**To Project Board**:
- Click any project card (except interactive elements)
- Redirects to project's Kanban board
- URL format: `/projects/{projectId}/board`

**To Ticket Details**:
- Access tickets via clean, human-readable URLs
- URL format: `/browse/{TICKET_KEY}` (e.g., `/browse/ABC-123`)
- Ticket keys clearly indicate which project they belong to
- URLs are stable and shareable (bookmarks, external links)

**Action Buttons**:
- "Import Project" button (with icon) — opens the Import Project modal; requires GitHub `repo` scope
- "Create Project" button (with icon) — disabled (manual project creation is a future feature)

**Responsive Layout**:
- **Desktop** (≥640px): Page header displays title and action buttons in a horizontal row
  - Title aligned left
  - Buttons aligned right
  - All elements share same horizontal line
- **Mobile** (<640px): Page header stacks vertically
  - Title appears first (full width)
  - Action buttons stack below title
  - Buttons arrange vertically for easy thumb access
  - Maintains consistent spacing and readability

**Project Card Grid**:
- **Desktop** (≥1024px): 3-column grid layout (grid-cols-3)
- **Tablet** (640px - 1023px): 2-column grid layout (grid-cols-2)
- **Mobile** (<640px): 1-column layout (grid-cols-1, full width cards)
- Cards maintain consistent spacing and visual hierarchy across all breakpoints
- Scrollable container supports 50+ projects without performance degradation

**Text Overflow Handling**:
- Long ticket titles truncate with ellipsis to prevent card overflow
- Tooltip displays full ticket title on hover (format: "ticketKey + title")
- GitHub repository links displayed as "owner/repo" format
- Deployment URLs show hostname only (e.g., "example.vercel.app")
- All text content uses `min-w-0` and `truncate` utilities to prevent horizontal scroll
- Cards maintain fixed width boundaries on mobile viewports (375px minimum)

### Activity Heatmap

Below the project cards grid, the `/projects` page renders a GitHub-style contribution heatmap that aggregates the signed-in user's AI activity across every project they own or are a member of.

**Layout**:
- Section rendered below the project cards, sized to fit its content (GitHub-style fixed-cell grid) and horizontally centered within the page rather than stretching to full viewport width
- Header line above the grid in the form "X jobs · Y tickets shipped in the last year" (or "in 2025" when a specific year is selected), where X is total job count and Y is distinct tickets currently in `SHIP` stage whose `updatedAt` falls in the period
- 7-row grid (days of the week) × one column per ISO week intersecting the selected period
- Month labels along the top, aligned to the column in which each month begins
- Day-of-week labels along the left side (sticky during horizontal scroll)
- Legend in the bottom-right: five swatches from least to most intense, labeled "Less" on the left and "More" on the right

**Cell coloring**:
- Five violet intensity buckets drawn from the aurora theme
- Bucket 0 represents zero jobs for that day; buckets 1–4 use quantile thresholds (p25/p50/p75) computed over the non-zero days in the period — a single outlier day does not flatten the rest of the scale
- When at least one day has activity, bucket 1 is never empty (all same-count non-zero days fall into bucket 1)
- Cells for weekdays outside the selected period are omitted rather than rendered, producing a "chipped corner" effect on partial weeks at period boundaries

**Cell tooltip (hover on desktop, tap on mobile)**:
- Formatted human-readable date
- Ticket-shipped line: "N tickets shipped" (distinct tickets currently in `SHIP` stage whose `updatedAt` falls on that day)
- Jobs and cost line: "N jobs · $X.XX"
- When any contributing job on that day has no recorded cost, the cost portion is omitted entirely — never displayed as "$NaN" or "$0"
- On touch devices, tapping outside the cell dismisses the tooltip; only one tooltip is visible at a time

**Period selector** (year dropdown above the grid):
- "Last 12 months" (default, rolling 12-month window ending today)
- Each calendar year from the user's account-creation year through the current year, ordered most recent first
- Hidden or disabled when the only available option is "Last 12 months" (user was created in the current calendar year)
- Switching selection re-renders the grid for the new period

**Agent filter** (dropdown above the grid):
- Populated from the distinct agents present in the user's jobs, combining explicit `ticket.agent` values with the effective agent inherited from `project.defaultAgent`
- "All" entry selected by default
- Hidden entirely when fewer than two distinct agents are present
- When filtering by a specific agent, jobs from tickets with that explicit agent AND jobs from tickets with no explicit agent whose project's default agent matches the filter are both included
- Agent filter does not change the grid boundaries; only the counts used for coloring and tooltips

**URL-shareable state**:
- Selected period and agent filter are reflected in URL query parameters `heatmapPeriod` (values: `last12months` or a four-digit year) and `heatmapAgent` (values: `all` or an agent identifier such as `CLAUDE`)
- Defaults are omitted from the URL — a fresh view keeps the URL clean
- Copying the URL and opening it in another tab (while signed in) reproduces the same period and agent filter
- Invalid query parameters (non-existent year, unknown agent) are silently coerced to defaults

**Empty and error states**:
- When the selected period has zero jobs (after any active filter), the grid is replaced by the centered message "No activity to show yet — your AI work will appear here" while legend and filter controls remain visible
- When the aggregation fails on first render, the heatmap region shows a non-blocking error card ("Couldn't load activity — please refresh") without blocking the project cards above it
- Polled refreshes that fail do not blank the current grid; they retry silently on the next interval

**Rendering and refresh**:
- Initial data is fetched server-side so the heatmap appears on first paint with no loading spinner flash
- Background refetches update the data silently on a 15-second polling cadence (matching analytics and usage)

**Responsive behavior**:
- On viewports too narrow to display the full grid, the grid scrolls horizontally within its container rather than shrinking cells or wrapping weekday rows
- Cells are fixed at 14 px with a 2 px gap — the grid never stretches cells to fill surrounding space, which keeps empty (bucket 0) days legible regardless of viewport width
- The containing section adapts to content width and is centered horizontally; it never fills viewport width just to leave blank space around the grid
- The day-of-week label column remains pinned (sticky) to the left edge as cells and month labels scroll underneath
- The `/projects` page scroll is adjusted so the heatmap is reachable via natural page scroll rather than being cut off by an internal scroll constraint on the project cards region

**Scope and accuracy**:
- Data is scoped to the signed-in user — jobs from projects they own and projects they are a member of
- "Tickets shipped" is counted from tickets currently in `SHIP` stage whose `updatedAt` falls within the period; `CLOSED` tickets are excluded so only actively-shipped work is reflected
- Because `updatedAt` is the anchor, a ticket shipped earlier but edited within the period (comment, description change, re-trigger) will appear on the edit date rather than the original ship date; a ticket rolled back out of `SHIP` stops being counted
- The daily cell's `shippedTicketCount` counts tickets whose `updatedAt` falls on that day; the header's `Y tickets shipped` is the sum of per-day cell counts (since each ticket has a single `updatedAt`, the two totals agree)

## Project Settings

### Settings Page Navigation

**Access**:
- Settings page accessible from project menu or direct URL `/projects/{projectId}/settings`
- Available to project owners and members

**Page Layout**:
- Header displays "Project Settings" title with project name
- "Back to Board" button in top-right corner of settings header
- Button displays left arrow icon with "Back to Board" text
- Navigates to `/projects/{projectId}/board`
- Outline variant styling for secondary action appearance

### Constitution Management

Projects include a constitution document that defines development guidelines, testing requirements, and governance rules:

**Purpose**:
- Documents project-specific principles and standards
- Provides AI agents with project context and rules
- Maintains consistency across all tickets
- Enables team alignment on development practices

**Constitution Location**:
- Stored at `.ai-board/memory/constitution.md` in project repository
- Markdown format for human and AI readability
- Version-controlled alongside project code

**Viewing Constitution**:
- Accessible via "Constitution" button in project settings
- Opens modal viewer with markdown rendering
- Supports all standard markdown elements (headers, code blocks, tables, lists)
- Same rendering quality as ticket documentation viewer

**Editing Constitution**:
- Edit mode with raw markdown textarea
- Save commits changes to repository with descriptive message
- Unsaved changes warning prevents accidental data loss
- Markdown syntax validation before save
- Available to project owners and members

**Constitution History**:
- View chronological commit history
- See author, date, and commit message for each change
- Diff view shows additions (green) and deletions (red)
- Provides transparency and audit trail for governance changes

**Access Control**:
- View and edit permissions follow project access model
- Available to project owners and members
- Uses same authorization as other project settings

**Error Handling**:
- Clear message when constitution file doesn't exist
- User-friendly errors for network or API issues
- Preserves unsaved edits on save failure for retry

### Default Agent Configuration

Projects have a configurable default AI agent that determines which AI executes workflow automation for all tickets:

**Purpose**:
- Sets which AI agent handles all new tickets by default
- Individual tickets can override the project default
- Ensures consistent agent assignment without per-ticket configuration

**Available Agents**:

1. **CLAUDE (Anthropic Claude)**:
   - Default for all new and existing projects
   - Current production agent for all workflow automation
   - Backward-compatible with all existing workflows

2. **CODEX (OpenAI Codex)**:
   - Alternative agent for projects requiring OpenAI's offering
   - Must be explicitly selected; not the default

3. **MISTRAL (Mistral vibe CLI)**:
   - Third provider option for projects requiring Mistral's offering
   - Uses the vibe CLI for workflow execution
   - Requires a stored Mistral API key credential

4. **GEMINI (Google Gemini CLI)**:
   - Fourth provider option for projects requiring Google's offering
   - Uses the Gemini CLI for supported ticket workflows
   - Requires a stored Google credential (API key or supported Gemini auth bundle)
   - Some workflows remain restricted even when Gemini is selected as the project default

**Configuration**:
- Accessible from project settings page
- Dropdown select with agent options
- Changes apply to future tickets only (existing ticket overrides unaffected)
- Only owners can modify (authorization: `verifyProjectOwnership`)

**Inheritance**:
- New tickets inherit the project's `defaultAgent` when no ticket-level override is set
- Ticket `agent` field is `null` by default (means: use project default)
- Effective agent resolved at workflow dispatch time via `resolveEffectiveAgent(ticket.agent, project.defaultAgent)`

### Project Configuration

Each project reads its runtime and service configuration from `.ai-board/config.yml` in its GitHub repository. The parsed config is stored in the database and used to supply the correct service inputs to every workflow dispatch.

**Config Storage**:
- Config is stored as structured JSON alongside the project record
- Nullable — absence means no config has been synced; workflows use backward-compatible defaults (PostgreSQL 16, Bun)
- The `env` section from `config.yml` is never stored in the database (secrets excluded)

**Config Display in Settings**:
- Project settings include a read-only Config card showing:
  - Runtime details: language, framework, package manager
  - Enabled services with their versions (e.g., PostgreSQL 14)
  - Agent configuration
  - Last sync timestamp
- When no config has been synced, the card prompts the owner to sync

**Manual Config Sync**:
- Project owners and members can trigger a sync via the "Sync config" button in settings
- The system fetches `.ai-board/config.yml` from the repository, validates the YAML, and stores the result
- Validation errors are shown with specific field-level messages (e.g., "Invalid postgres_version: must be 14, 15, or 16")
- If no config file is found, the system informs the user and suggests creating one

**Auto-Import on Project Creation**:
- When a new project is imported, the system automatically attempts to fetch and store the config
- If the fetch fails (missing file, GitHub error), the project is created successfully with null config — no error

**Auto-Refresh Before Dispatch**:
- Before dispatching any workflow, the system checks whether the stored config is older than 1 hour
- Stale config is refreshed automatically from GitHub; fresh config is used as-is
- If auto-refresh fails, dispatch is blocked and a clear error is shown

**Dynamic Service Inputs**:
- All workflow dispatch paths (ticket transitions, health scans, AI-board assist, rollback-reset, deploy preview) read the project's stored config to supply the correct service container inputs
- Example: a project declaring PostgreSQL 14 results in `needs_postgres: true` and `postgres_version: 14` in the dispatch
- Projects without config receive the same defaults as before this feature was introduced

### AI Models Configuration

Projects have a configurable per-stage model for each of the 5 automated job types, available independently for the Claude and Codex agents. This allows cost-conscious tuning without affecting other agents.

**Purpose**:
- Assign a specific model per workflow stage to balance cost and capability
- New projects are pre-populated with smart defaults optimized for cost
- Existing project owners can opt in to smart defaults with a single action

**Available Models** (closed whitelists):

Claude:

| ID | Display Name |
|----|-------------|
| `claude-opus-4-8` | Claude Opus 4.8 |
| `claude-opus-4-7` | Claude Opus 4.7 |
| `claude-opus-4-6` | Claude Opus 4.6 |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 |

Codex:

| ID | Display Name |
|----|-------------|
| `gpt-5.5` | GPT-5.5 |
| `gpt-5.4` | GPT-5.4 |
| `gpt-5.4-mini` | GPT-5.4 mini |
| `gpt-5.3-codex` | GPT-5.3 Codex |
| `gpt-5.2` | GPT-5.2 |

**Configurable Stages** (smart defaults applied to new projects of either agent):

| Stage | Claude default | Codex default |
|-------|----------------|---------------|
| SPECIFY | Claude Opus 4.8 | GPT-5.5 |
| PLAN | Claude Opus 4.8 | GPT-5.5 |
| IMPLEMENT | Claude Sonnet 4.6 | GPT-5.4 |
| QUICK-IMPL | Claude Sonnet 4.6 | GPT-5.4 mini |
| VERIFY | Claude Sonnet 4.6 | GPT-5.4 mini |

**Configuration UI**:
- Accessible from project Settings page as an "AI Models" card
- Renders a 5-row table (one per stage) with a model selector when the project's default agent is Claude or Codex
- The dropdown for each stage is sourced from the active agent's whitelist; the inactive agent's stored values stay in the database but are not rendered
- Each selector change is persisted immediately with an optimistic update; on failure the previous value is restored and a non-blocking error is shown
- "Apply Smart Defaults" action overwrites all 5 stages of the active agent atomically with that agent's cost-conscious set

**Mistral / Gemini projects**:
- When the project's default agent is Mistral or Gemini, the AI Models card shows an informational message and no selectors are rendered
- Stored Claude and Codex configuration is preserved for when the agent is switched back

**Agent switching (dormancy)**:
- Claude and Codex per-stage selections are stored in independent column sets; switching `defaultAgent` between the two never overwrites either set
- Switching back restores the originally-configured selections for that agent

**Resolution at dispatch**:
- When the effective agent for a workflow job is Claude, the model resolves as: ticket override → project default → global fallback `claude-opus-4-8`
- When the effective agent is Codex, the model resolves as: ticket override → project default → global fallback `gpt-5.5`
- A stored model identifier that is no longer in the active agent's whitelist (e.g., deprecated by the provider) is treated as "not set" and falls through to the next resolver layer
- Only the 5 configurable stages are affected; other job types (`iterate`, `comment-*`, `health-scan`, etc.) always use the active agent's CLI default

**Authorization**:
- Project owners and members can read and update the AI Models configuration
- API enforces the same "owner or member" rule as the clarification policy

### Token Saving Configuration

Projects have a configurable token saving setting that controls whether Claude agent runs use RTK (output compression tool) to reduce token consumption:

**Purpose**:
- Enables project-wide token saving via RTK compression for Claude agent runs
- Reduces token consumption by semantically compressing large command outputs
- Individual tickets can override the project default

**Configuration**:
- Accessible from project settings page as a "Token Saving" card
- Toggle switch (ON/OFF) with descriptive text explaining the feature
- Default: OFF for all projects
- Only owners can modify (`verifyProjectOwnership`)
- Changes apply to future runs only (in-progress runs unaffected)

**Inheritance**:
- New tickets inherit the project's `tokenSaving` when no ticket-level override is set
- Ticket `tokenSaving` field is `null` by default (means: use project default)
- Effective token saving resolved at workflow dispatch time via `resolveEffectiveTokenSaving(ticket.tokenSaving, project.tokenSaving)`
- Resolution chain: ticket override → project default → OFF (global fallback)

### Clarification Policy Configuration

Projects have a configurable default clarification policy:

**Purpose**:
- Determines how AI resolves ambiguities during specification generation
- Applies to all new tickets unless overridden
- Reduces need for ticket-level configuration

**Available Policies**:

1. **AUTO (🤖 Context-Aware)**:
   - Analyzes feature description for keywords
   - Chooses CONSERVATIVE for sensitive features
   - Chooses PRAGMATIC for internal tools
   - Documents detection in generated specifications

2. **CONSERVATIVE (🛡️ Security-First)**:
   - Prioritizes security and long-term quality
   - Strict validation and error handling
   - Suitable for customer-facing features
   - Appropriate for financial or compliance features

3. **PRAGMATIC (⚡ Speed-First)**:
   - Prioritizes simplicity and fast delivery
   - Permissive validation with smart defaults
   - Suitable for internal tools
   - Appropriate for prototypes and MVPs

**Configuration**:
- Accessible from project settings page
- Dropdown select with policy options
- Help text explains each policy philosophy
- Changes apply to future tickets only (no retroactive effect)

**Default Behavior**:
- New projects default to AUTO policy
- Provides reasonable defaults without configuration
- Users can change at any time

## User-Project Relationship

### Project Ownership

- Every project has one owner (the user who created it)
- User ID is required when creating projects
- Owner has full administrative access to the project

### Project Membership

**Member Access**:
- Projects can have multiple members (collaborators)
- Members can access the project board and all tickets
- Members have read-write access (create, update, comment on tickets)
- Members can transition tickets through workflow stages
- Members cannot delete projects or manage other members (owner-only)

**Access Control**:
- Users can access projects they own OR projects they are members of
- Authorization checks validate "owner OR member" relationship
- Cross-user access (neither owner nor member) returns permission error
- Project ownership check is performed first for performance optimization

**Ticket Access**:
- Project members can view/modify all tickets in the project
- Ticket operations require project ownership OR membership
- Authorization validated on every request
- No per-ticket permission differences between owner and members

### AI-BOARD Membership

**Automatic Membership**:
- AI-BOARD user automatically added to all new projects
- Added as standard "member" role
- Enables @ai-board mentions in all tickets
- Created atomically with project (transaction integrity)

**Member Role**:
- AI-BOARD has same permissions as regular members
- Can be mentioned in comments
- Posts comments as responses to mentions
- Does not have admin or owner privileges

## Project Persistence

### Data Storage

All project data persists automatically:
- Project settings save immediately on change
- Ticket count updates as tickets are created/deleted
- Last updated timestamp updates on any activity

### Data Integrity

**Referential Integrity**:
- Projects must have a valid user ID (owner)
- Tickets must reference existing project ID
- Foreign key constraints enforce relationships

**Cascade Behavior**:
- Deleting project removes all associated tickets
- Deleting project removes all ticket comments
- Deleting user removes all their projects

## Multi-Project Workflows

### Context Switching

Users working across multiple projects:
- Navigate between projects via project list
- Each project maintains separate board state
- Tickets isolated within projects
- No cross-project ticket visibility

### Project-Level Policies

Settings configured at project level:
- Clarification policy applies to all project tickets
- Individual tickets can override project settings
- Policy inheritance provides consistent defaults

### Activity Tracking

Projects track activity across all tickets:
- Last updated reflects most recent ticket change
- Ticket count shows total across all stages
- Activity visible in project list view
- Activity drives the default ordering of the project list — the most recently active project appears first (see **Sort Order** under Project List View)

## Project Actions

### Project Analytics

Users can access comprehensive analytics dashboard to visualize AI workflow metrics and track project performance:

**Menu Access**:
- Project menu contains "Analytics" option (with Chart icon)
- Available to project owners and members
- Navigates to `/projects/{projectId}/analytics`

**Dashboard Features**:
- **Overview Cards**: Display total cost, success rate, average job duration, tickets shipped, and tickets closed for the active time range
- **Cost Over Time**: Area chart showing cost trends with selectable time ranges (7d, 30d, 90d, all time)
- **Cost by Stage**: Horizontal bar chart breaking down cost across SPECIFY, PLAN, BUILD, VERIFY stages
- **Token Usage**: Chart showing input tokens, output tokens, and cache tokens
- **Cache Efficiency**: Ring/donut chart displaying cache savings percentage
- **Top Tools**: Horizontal bar chart ranking most-used AI tools (Edit, Read, Bash, etc.)
- **Workflow Distribution**: Donut chart showing proportion of FULL and QUICK workflows
- **Velocity**: Bar chart displaying tickets shipped per week

Per-turn context telemetry (`peakContextTokens`, `avgContextTokens`, `turnCount`) continues to be captured on each Job and is surfaced inside the job timeline; the dashboard does not currently render an aggregated chart for it.

**Dashboard Filters**:
- **Time Range**: 7 days, 30 days, 90 days, or all time
- **Ticket Outcome**: Shipped, closed, or all completed tickets
- **Agent**: All agents, or one recorded AI agent with job history in the current project
- Filter changes update overview cards and all charts together so the dashboard stays internally consistent
- Filter state is stored in the analytics page URL so the current view persists across refreshes and shared links

**Overview Metrics**:
- Total cost and cost trend for the active filters
- Success rate based on completed versus failed jobs in the active filters
- Average duration for completed jobs in the active filters
- Tickets shipped count for the selected time range and agent filter
- Tickets closed count for the selected time range and agent filter

**Time Range Selection**:
- Preset options: 7 days, 30 days, 90 days, all time
- Default: 30-day view
- Charts auto-adjust granularity (daily for <30 days, weekly for ≥30 days)

**Empty States**:
- When filters match no job analytics, overview cards remain visible for the active period
- Charts and breakdown sections show filter-aware empty states instead of stale values
- Empty copy explains the active agent, outcome, and time range selection

**Data Updates**:
- Polling-based refresh every 15 seconds
- Automatically reflects new job completions while keeping the current filters applied

**Access Control**:
- Only project owners and members can view analytics
- Analytics scoped to single project (no cross-project visibility)

**Navigation**:
- "Back to Board" button in analytics page header (top-right)
- Button displays left arrow icon with "Back to Board" text
- Navigates to `/projects/{projectId}/board`
- Outline variant styling for secondary action appearance

### Analysis Calibration Drift Dashboard

Project owners can review how the inbox-analysis predictions have held up against actual delivery outcomes. The dashboard pairs every analyzed-then-shipped ticket's stored predictions with the captured outcome and surfaces the deltas as a confusion matrix, two distributions, a recommendation panel, and an adoption counter.

**Page Access**:
- Owner-only page at `/projects/{projectId}/calibration`
- Project members and non-members receive the same generic "not found" response — the dashboard's existence is not leaked
- No new role or permission tier; the existing owner-only gate is reused

**Window**:
- Headline metrics reflect the most recent 30 calibration rows in the project, ordered by paired-outcome `shippedAt` descending
- When the project has more than 30 paired tickets, the page shows "30 of N shipped+analyzed tickets" so the owner knows the underlying dataset is larger
- When the project has fewer than 30 paired tickets, the page renders with the available rows and a "still warming up" indicator naming the current count, instead of an empty-state error

**Friction Confusion Matrix**:
- 2×2 labelled HTML table on the binary "predicted clean" / "actual frictionFree" classification
- Predicted "low" friction risk maps to "predicted clean"; predicted "medium" or "high" maps to "predicted friction"
- Cells display explicit counts and percentages for true positive (TP), true negative (TN), false positive (FP), and false negative (FN) — the positive class is "predicted clean" with "actual frictionFree"
- Precision and recall on the "low risk" class are surfaced alongside the matrix; both render as `null` when the relevant denominator is zero

**Quality and Cost Distributions**:
- Each rendered as a labelled chart paired with a sortable tabular fallback so screen-reader and keyboard-only users have an equivalent view
- Three explicit buckets per distribution: `hit`, `miss`, and `n/a` so QUICK tickets (no quality score) and tickets without recorded cost cannot inflate or deflate the headline rate
- Quality hit: actual quality score falls inside the predicted `[lower, upper]` range, inclusive of both bounds
- Cost hit: actual aggregated cost falls inside the summed predicted range (`baselineLower + marginalLower` … `baselineUpper + marginalUpper`)

**Recommendation Panel**:
- Two independent rates over the window, presented as separate stat cards:
  - **Matched rate**: the predicted recommendation (`QUICK` or `FULL`) equalled the actual `workflowType` the user used
  - **Friction-aligned rate**: `QUICK` was predicted and the ticket was friction-free, OR `FULL` was predicted and friction emerged
- Both axes are reported separately because a recommendation can be "matched" (the user followed it) yet still wrong in hindsight, or vice versa

**Adoption Counter**:
- Numerator: distinct tickets in the project that entered INBOX on or after the moment the analysis feature became available AND have at least one analysis attempt of any status (including `failed` and `cold_start`) — reflects user attempts, not just successful runs. Constraining the numerator to the same date population as the denominator keeps the ratio bounded at ≤ 1.0 (retroactive analyses on tickets created before the feature was available do not inflate the numerator).
- Denominator: tickets that entered INBOX in the project on or after the moment the analysis feature became available on the project (so older inboxes do not artificially depress adoption)
- Ratio is rendered alongside the absolute counts; the counter is computed independently of the 30-row drift window

**Honest Handling of Degraded Inputs**:
- Tickets whose latest analysis is `cold_start` produce no calibration row (no numeric ranges to compare) but still count in the adoption denominator
- Tickets whose paired outcome is `partial = true` still produce a calibration row: cells that depend on missing telemetry are recorded as `n/a` with a `partialReason` snapshot, while cells that can be computed (cost, friction-free) populate normally
- Headline rates exclude `n/a` cells from their denominators; the `n/a` count is surfaced as a separate bucket so owners can see how many comparisons were skipped
- Tickets with multiple analyses pair only the most recent `success` row; older analyses remain on the analysis history but do not contribute to drift metrics
- Tickets without any `success` analysis produce no calibration row but still count in the adoption denominator

**Refresh Cadence**:
- The dashboard polls every 15 seconds, matching the analytics dashboard convention
- The read path is read-only: it never triggers a recomputation, LLM call, or write
- The dashboard is informative only — no auto-correction, alerting, or modification of analysis prompts is performed based on observed drift

**Accessibility**:
- The confusion matrix is a labelled HTML table; both axes carry explicit text labels ("Predicted: low risk", "Actual: friction-free")
- Hit/miss distributions render as a labelled chart and a sortable tabular fallback; no information is conveyed by colour alone
- Counts plus percentages are shown on every cell so small denominators cannot mislead

## Project Import

### Overview

Users import an existing GitHub repository as a new ai-board project. The import flow handles OAuth scope verification, repository selection, admin rights validation, config auto-loading, and project creation in a single modal flow.

### OAuth Scope Requirement

The import flow requires the GitHub OAuth token to include `repo` scope. This scope is requested during GitHub sign-in. Users who signed up before this scope was required see a re-authorization prompt the first time they attempt to import.

**Re-authorization prompt**:
- Explains why `repo` scope is needed
- Provides a single "Authorize GitHub Access" button that initiates GitHub OAuth with `repo` scope
- Returns the user to the import modal after authorization completes
- User can dismiss without authorizing; no project is created

### Repo Picker

The repo picker lists the user's GitHub repositories (personal and organizational) with the following display per repository:
- Repository name and full name (`owner/repo`)
- Description (truncated)
- Visibility badge (public or private)
- Last push date
- Owner avatar

**Filtering and search**:
- Text search filters by name and description (debounced 300 ms)
- Organization filter narrows results to a single org or personal account
- Pagination via "Load more" (30 repos per page, up to 100 per request)

**Repository states in picker**:
- **Selectable**: user has admin access and repo is not already imported
- **Disabled — already imported**: repo is linked to an existing project (tooltip identifies the project)
- **Disabled — no admin access**: user lacks admin permission on the repo

### Import Flow

1. User clicks "Import Project" — modal opens and checks GitHub auth status
2. If `repo` scope is missing: re-authorization prompt is shown
3. If `repo` scope is present: repo picker loads
4. User selects a repository — confirmation step shows repo details with optional name and description fields
5. User confirms — `POST /api/projects/import` is called
6. On success: projects list is refreshed and user is redirected to the project board or setup wizard

**Post-import redirect**:
- `.ai-board/config.yml` present and valid → redirect to `/projects/{id}`
- Config missing or invalid → redirect to `/projects/{id}/setup`

### Validation and Error States

- **Duplicate repo**: repo already linked to a project — blocked with message identifying the existing project
- **No admin rights**: user lacks admin access on the selected repo — blocked before creation
- **Quota exceeded**: subscription plan project limit reached — blocked with upgrade prompt
- **GitHub rate limit**: displayed with estimated reset time
- **Network failure**: inline error with retry option
- **Malformed config**: project created, user redirected to setup wizard with warning

### Constraints

- Exactly one ai-board project per GitHub repository (global uniqueness on `githubOwner` + `githubRepo`)
- Admin rights on the target repository are required at import time
- Subscription-based project quota applies to imported projects equally

## Project Onboarding Setup

### Overview

When a project is imported without a `.ai-board/config.yml` file, the system directs the project owner through an onboarding setup flow before the project board becomes accessible. The setup flow configures the project's agent and creates the necessary configuration files via a one-time onboarding workflow.

### Setup Page Access

- The setup page is accessible only to the project owner at `/projects/{projectId}/setup`
- Non-owners attempting to access the setup page receive an access denied error
- Projects with `configSyncedAt` already set bypass setup entirely — the setup URL redirects to the project board
- The board page redirects unconfigured projects (null `configSyncedAt`) to the setup page

### Setup Flow

1. **Agent Selection**: The owner selects which AI agent CLI to use from the setup page options. The selected agent becomes the project's default agent, but the onboarding workflow may still reject agents that are unsupported for setup automation.
2. **Credential Check**: The system verifies the owner has a valid stored credential for the selected agent's provider. If the credential is missing, the initialize button is disabled and actionable guidance is displayed linking to the credentials settings page
3. **Initialize**: The owner clicks "Initialize Project" to create a setup job and dispatch the onboarding workflow
4. **Progress Tracking**: The page polls every 2 seconds and displays the current job state (pending spinner, running progress, or failed error with retry)
5. **Completion**: When the workflow completes, config sync runs automatically. Once `configSyncedAt` is set, the page redirects to the project board

### Job State and Retry

Each setup attempt creates a `ProjectSetupJob` record that tracks:
- Selected agent, current status, workflow run identifier
- Start and completion timestamps
- Error details (on failure)
- Artifact summary: lists files created, preserved (e.g., existing `CLAUDE.md`), and missing, along with commit SHA and optional error code

When the workflow fails, the setup page displays the error message and offers a "Retry" button. Retrying creates a fresh job and dispatches a new workflow run, preserving the history of previous attempts.

### Guards and Constraints

- Only one setup job can be active (PENDING or RUNNING) per project at a time — duplicate dispatches are rejected
- Projects already configured (non-null `configSyncedAt`) cannot dispatch new setup jobs
- Page refreshes during a running job correctly resume showing the active state via polling

### Error States

| Scenario | Behavior |
|----------|----------|
| Missing credential for selected agent | Initialize button disabled; guidance shown |
| Active job already running | Duplicate dispatch blocked (409 response); destructive toast shown with server error message |
| Dispatch API returns any error (non-2xx) | Destructive toast shown: "Failed to initialize project" with server error message |
| Network error during dispatch | Destructive toast shown: "Failed to initialize project — Could not connect to the server" |
| Project already configured | Dispatch blocked; page redirects to board |
| Target repo clone fails (`DISPATCH_FAILED`) | Job fails; error displayed with retry option |
| Stack detection fails (`CONFIG_GENERATION_FAILED`) | Job fails; error displayed with retry option |
| LLM generation fails (`GUIDANCE_GENERATION_FAILED`) | Partial success: config committed, guidance missing; setup page shows which files were created vs missing |
| Git push fails (`COMMIT_FAILED`) | Job fails with message; error displayed with retry option |
| Config sync failure after COMPLETED | Project stays on setup page; retry resolves |

## Spec Generation for Existing Projects

### Overview

After onboarding completes, the project board offers a one-click workflow to generate project specifications for the existing codebase. Generated specs are committed to `specs/specifications/` in the target repository and improve health scan results, AI ticket workflows, and code review quality.

### hasSpecs Field

The `Project` model includes a `hasSpecs` boolean field (default `false`) that tracks whether project specifications have been generated:

- Set to `true` when a RETRO_SPEC job completes successfully (via the job status PATCH endpoint)
- Returned by `GET /api/projects/{id}` as part of the project payload — no separate query needed
- The board page reads `project.hasSpecs` directly to decide whether to show the spec generation banner/badge
- The `/api/projects/{id}/setup/jobs?command=RETRO_SPEC` endpoint is only called during active generation polling, not on initial board load

### Spec Generation Banner

When a project has `hasSpecs = false`, a dismissible banner appears on the board:

> "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality — [Generate] [×]"

- Clicking "Generate" opens the spec generation modal
- Clicking "×" dismisses the banner; dismissal persists across page reloads on the same device (stored in localStorage per project)
- The banner does not reappear on the same device after dismissal
- Only the project owner sees the banner

### Spec Generation Modal

The modal provides three configuration options:

**Depth picker** (radio group, required):
- **Quick** — Project overview and high-level architecture summary (~5 min)
- **Standard** (default) — Architecture, API endpoints, data model, and key workflows (~15 min)
- **Comprehensive** — Full functional and technical specs, entity documentation, API schemas, and workflow documentation (~40 min)

**Documentation URL** (optional): URL of existing external documentation (Notion, Confluence, wiki). The workflow fetches the URL, follows redirects, and incorporates the resolved content when it is reachable. If the URL is unreachable, spec generation continues using only the codebase.

**Additional context** (optional): Free-text field for business context or guidance for the spec generator.

Clicking "Generate Specs" dispatches the background workflow. The modal closes immediately; the owner is not navigated away from the board.

### Board Status Badge

The badge and banner are only rendered when specs have not yet been generated (`hasSpecs = false`). When specs already exist, no polling occurs and neither component is shown.

**Polling activation**: The setup jobs endpoint is not polled on initial board load. Polling only starts when the user explicitly triggers spec generation (or resumes via a localStorage flag after page refresh during an active generation). This avoids unnecessary API calls for projects that simply have no specs yet.

While a retro-spec job is active, a status badge appears in the board area above the stage columns:

| State | Display |
|-------|---------|
| PENDING / RUNNING | "Generating specs..." with pulse animation |
| COMPLETED | "Specs ready" — visible for the remaining time within 30 seconds of `completedAt`, then fades out. Does not reappear on subsequent page navigations. |
| FAILED | Error indicator with retry button |

The badge is mutually exclusive with the banner: when a job is active or has failed, the badge is shown instead of the banner. The banner is hidden during FAILED state since the badge handles retry.

### Triggering Spec Generation After Banner Dismissal

After the banner is dismissed, spec generation can be triggered from the board menu ("Generate Specs" option). This opens the same modal.

### Concurrency Constraint

Only one active retro-spec job is permitted per project at a time. A second request while one is active is rejected with a `409 JOB_ACTIVE` error.

## External Repository Support

### Multi-Repository Architecture

AI-Board supports managing tickets for external GitHub repositories:

**Repository Configuration**:
- Each project linked to a specific GitHub repository
- GitHub owner and repository name required during project creation
- Workflows execute against the configured external repository
- AI-Board workflows centralized in ai-board repository

**Workflow Execution**:
- GitHub Actions workflows defined in ai-board repository
- Workflows checkout external project repository for operations
- Claude executes commands in context of external project
- Changes committed and pushed to external project branches

**Requirements**:
- External projects do NOT need any AI-Board configuration files
- All scripts, commands, and templates are provided by ai-board workflows via double checkout pattern
- Workflows automatically:
  - Checkout ai-board repository (for scripts/commands)
  - Checkout target repository (external project)
  - Symlink ai-board commands to target's `.claude/commands/`
- Test configuration files (if workflows use tests)
- GitHub Personal Access Token (PAT) with repo access
- PAT configured as `GH_PAT` secret in ai-board repository

**Optional: Local Plugin Installation**:
For local development with ai-board commands, install the plugin:
```bash
/plugin install ai-board@github:bfernandez31/ai-board
```

**Workflow Authentication**:
- AI-Board uses GitHub PAT to access external repositories
- PAT must have `repo` scope for full repository access
- Same PAT used for all external projects (centralized secrets)

**Benefits**:
- Centralized workflow management in ai-board
- No need to configure workflows in each project
- Consistent automation across all managed projects
- Easy onboarding of new projects
