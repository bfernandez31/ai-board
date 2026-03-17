# AI-Board Feature Roadmap Design

> Design document for 22 new features across 3 tiers of complexity.
> Each feature is intended to become an ai-board ticket with functional requirements.
> No implementation code — tickets will flow through the normal INBOX→SHIP workflow.

---

## Quick Wins (1-2 tickets each)

### 1. Ticket Templates

**Problem**: Every ticket starts blank. Users re-type similar structures for bug reports, features, refactoring.

**Solution**: Predefined templates selectable from a dropdown in the ticket creation modal. Templates pre-fill title pattern and structured description.

**Functional Requirements**:
- Dropdown in ticket creation modal: "Bug Report", "Feature Request", "Refactoring", "Custom"
- Each template provides a title prefix and a markdown description skeleton
- Templates are project-scoped, stored in a `TicketTemplate` table (projectId, name, titlePrefix, descriptionTemplate, createdAt)
- Users can create/edit/delete custom templates from project settings
- Selecting a template pre-fills the form but remains fully editable
- "Custom" or blank option always available (no forced template)

---

### 2. Bulk Actions on Board

**Problem**: Cleaning up INBOX or moving multiple tickets requires repetitive drag-and-drop.

**Solution**: Multi-select tickets with checkboxes or Shift+click, then apply batch actions.

**Functional Requirements**:
- Selection mode: Checkbox overlay on ticket cards (toggle via toolbar button or keyboard shortcut)
- Shift+click for range selection within a column
- Bulk actions toolbar appears when >=1 ticket selected: Move to stage, Delete, Duplicate
- Move validates all selected tickets can transition to target stage
- Partial success handling: report which tickets moved and which were blocked
- "Select all in column" option
- Clear selection on action completion or Escape
- Confirmation modal for destructive actions (delete)

---

### 3. Ticket Priority

**Problem**: No way to signal urgency. All tickets in a column look equal.

**Solution**: Priority field with visual indicator on ticket cards.

**Functional Requirements**:
- Priority enum: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` (default: `MEDIUM`)
- Visual indicator on ticket card: colored dot or icon (red/orange/yellow/gray)
- Settable at creation and editable in ticket detail
- Tickets sorted by priority within each column (Critical first), then by existing sort order — except INBOX which preserves FIFO ordering (ascending ticket number) regardless of priority
- Priority included in search results display
- Priority passed to AI agent as context during SPECIFY/PLAN/BUILD
- Filter by priority on the board (optional, could be a follow-up)

---

### 4. Keyboard Shortcuts on Board

**Problem**: Power users rely on mouse for all board interactions.

**Solution**: Keyboard shortcuts for common actions with a discoverable help overlay.

**Functional Requirements**:
- `N` = open new ticket modal
- `S` or `/` = focus search input
- `1`-`6` = scroll to column (INBOX through SHIP)
- `?` = toggle shortcut help overlay
- `Escape` = close any open modal/overlay
- Help overlay: modal listing all shortcuts, dismissible
- Shortcuts disabled when a text input/textarea/contenteditable is focused
- Shortcuts disabled on mobile/tablet without physical keyboard (detect via media query `hover: hover`)
- Desktop/tablet-with-keyboard only — no gestures or mobile equivalent (actions already accessible via existing touch UI)
- Discoverable: small `?` icon in board header (desktop only, hidden on mobile)

---

### 5. Dark/Light Theme Toggle

**Problem**: Dark mode is hardcoded. Some users prefer light mode or system preference.

**Solution**: Theme toggle with 3 modes: Light, Dark, System.

**Functional Requirements**:
- Toggle in header: sun/moon icon cycling through Light → Dark → System
- Persist preference in localStorage + cookie (for SSR hydration match)
- System mode follows `prefers-color-scheme` media query
- Tailwind `dark:` classes already in place — leverage existing setup
- Smooth transition (no flash on page load)
- Respect across all pages (landing, board, settings, analytics, legal)
- Prerequisite: audit existing components for `dark:` variant coverage — may require adding light-mode classes to components that assume dark-only

---

### 6. Ticket Labels/Tags

**Problem**: No way to categorize tickets beyond title/description. Hard to filter by topic.

**Solution**: Colored tags on tickets with board filtering.

**Functional Requirements**:
- Labels are project-scoped: name (max 30 chars) + color (from a preset palette of 8-10 colors)
- Create/edit/delete labels in project settings
- Assign 0-5 labels per ticket (in creation modal and ticket detail)
- Labels displayed as colored pills on ticket cards (max 3 visible, "+N" overflow)
- Filter board by label: dropdown in board toolbar, multi-select, shows only matching tickets
- Labels passed to AI agent as context during SPECIFY/PLAN/BUILD
- Data model: `Label` table + `TicketLabel` junction table

---

### 7. Activity Log per Project

**Problem**: Hard to see what happened across a project. Job events are per-ticket only.

**Solution**: Dedicated activity timeline view showing all project events.

**Functional Requirements**:
- New page: `/projects/{projectId}/activity`
- Accessible from project menu (clock icon) and mobile hamburger
- Events: ticket created, stage transitions, comments posted, jobs started/completed/failed, deploys, cleanups
- Each event shows: timestamp, actor (user or AI-BOARD), action description, ticket key link
- Chronological (newest first), paginated (50 per page)
- Filter by event type (transitions, comments, jobs, all)
- Auto-refresh every 15 seconds
- Access: owners and members
- Note: reuses existing job event rendering components from the conversation timeline (03-collaboration)

---

### 8. Copy Ticket Key One-Click

**Problem**: Copying a ticket key (e.g., "AIB-123") requires manual text selection.

**Solution**: Copy button on ticket card and in ticket detail modal.

**Functional Requirements**:
- Small copy icon next to ticket key on board cards (visible on hover)
- Copy icon next to ticket key in detail modal header (always visible)
- Click copies `PROJECT_KEY-NUMBER` to clipboard
- Toast feedback: "Copied AIB-123"
- Works on mobile (tap instead of hover)
- Uses Clipboard API with fallback for older browsers

---

### 9. Favorite/Pin Tickets

**Problem**: Important tickets get buried in long columns.

**Solution**: Pin tickets to the top of their column.

**Functional Requirements**:
- Pin toggle: star/pin icon on ticket card (hover on desktop, always visible on mobile)
- Pinned tickets float to top of their column, separated by a subtle divider
- Multiple pinned tickets sorted by pin timestamp (most recent pin first)
- Pin state persists across sessions (boolean `isPinned` on ticket)
- Pin/unpin available in ticket detail modal too
- Visual indicator: filled star/pin icon when pinned
- Sort precedence: Pinned tickets first (by pin timestamp), then priority sort (non-INBOX columns), then existing sort order
- Unpinning returns ticket to normal sort position

---

### 10. Project Data Export

**Problem**: No way to extract data for external reporting or backup.

**Solution**: Export project data as CSV or JSON from project settings.

**Functional Requirements**:
- Export button in project settings
- Format selection: CSV or JSON
- Scope selection: Tickets, Jobs, Stats, or All
- Tickets export: key, title, description, stage, priority, labels, dates, branch, workflowType
- Jobs export: command, status, duration, cost, tokens, model, timestamps
- Stats export: aggregated analytics data
- Download as file (not displayed in UI)
- Include only data user has access to
- Rate limited: 1 export per minute per user

---

## Medium Features (3-5 tickets each)

### 11. Outgoing Webhooks

**Problem**: No way to react to ai-board events from external tools (Slack, CI/CD, custom dashboards).

**Solution**: Configurable webhook endpoints that receive event payloads.

**Functional Requirements**:
- Configuration in project settings: add/edit/delete webhook endpoints
- Per webhook: URL, secret (for HMAC signature verification), event selection checkboxes
- Events available: `ticket.created`, `ticket.moved`, `ticket.deleted`, `job.started`, `job.completed`, `job.failed`, `deploy.completed`, `comment.created`, `cleanup.started`, `cleanup.completed`
- Payload format: JSON with event type, timestamp, project key, ticket key, relevant data
- Delivery: POST request with `X-AIBoard-Signature` header (HMAC-SHA256 with secret)
- Retry policy: 3 retries with exponential backoff (1s, 5s, 30s)
- Delivery log: last 50 deliveries per webhook (status code, timestamp, response time)
- Disable/enable toggle per webhook
- Limit: 2 webhooks per project (Free), 10 (Pro), 20 (Team)
- Table: `Webhook` (projectId, url, secret, events[], enabled, createdAt)
- Table: `WebhookDelivery` (webhookId, event, statusCode, responseMs, createdAt)

---

### 12. Personal Dashboard (Home)

**Problem**: After login, users land on project list. No aggregated view of "what needs my attention".

**Solution**: A home dashboard that aggregates activity across all projects.

**Functional Requirements**:
- New page: `/dashboard` (default landing after sign-in, replectable by project list link)
- Sections:
  - **My Active Jobs**: Running/pending jobs across all projects (link to ticket)
  - **Recent Activity**: Last 20 events across all projects (same format as activity log)
  - **Unread Notifications**: Quick access to notification list
  - **Quick Stats**: Tickets shipped this week, total cost this month, success rate
  - **Projects**: Compact project cards with active ticket counts
- Polling: 15 seconds for jobs and activity
- Responsive: cards stack on mobile, grid on desktop
- Quick action: "New Ticket" dropdown with project selector
- Access: authenticated users only
- Does NOT replace project list — accessible via new nav item. Logo click remains on project list. Users can set dashboard as default landing in their preferences (future enhancement)

---

### 13. Ticket Dependencies

**Problem**: Tickets often depend on each other. No way to express or enforce ordering.

**Solution**: Link tickets with dependency relationships visible in the UI.

**Functional Requirements**:
- Relation types: `BLOCKS` / `BLOCKED_BY` (inverse auto-created), `RELATED_TO` (bidirectional)
- Add/remove dependencies in ticket detail modal (new "Dependencies" section in Details tab)
- Autocomplete search for target ticket (same project only)
- Display: list of linked tickets with type, key, title, stage, status icon
- Blocking enforcement: warning toast when moving a ticket that has unresolved blockers (not hard-block — user can override)
- Visual indicator on board card: small link icon when ticket has dependencies
- Cycle detection: prevent A blocks B blocks A
- Data model: `TicketRelation` table (type, sourceTicketId, targetTicketId)
- Cascade: relations deleted when either ticket is deleted
- Dependencies passed to AI agent as context (ticket keys + titles of blockers)
- Limit: 10 dependencies per ticket

---

### 14. Automatic Quality Score

**Problem**: Hard to objectively measure if the AI is producing good work. Comparison is manual.

**Solution**: Extend the existing `/ai-board.code-review` command so each review agent returns a dimension score (0-100) alongside its issues. A weighted final score is computed and stored on the verify job.

**Functional Requirements**:
- Score: 0-100, computed after VERIFY job completes (FULL workflow only)
- Scoring is produced by the 5 existing code review agents — each agent returns a sub-score (0-100) for its dimension in addition to listing issues. The score reflects the agent's qualitative judgment, not just issue count.
- Scoring dimensions (weighted):
  - Bug Detection: 30% (absence of bugs found by shallow scan)
  - Compliance (CLAUDE.md + Constitution): 30% (adherence to project rules)
  - Code Comments compliance: 20% (respect of inline code guidance)
  - Historical Context: 10% (consistency with git history patterns)
  - Previous PR Comments: 10% (not repeating past mistakes)
- Final score: weighted sum of dimension scores, rounded to integer
- The code review command writes a structured scoring output (JSON) to the workspace. The workflow parses it and sends the score via the existing job status update endpoint.
- Stored on Job model: `qualityScore` integer field (nullable, only for VERIFY jobs)
- No score for: QUICK workflow, CLEAN workflow, failed/cancelled VERIFY jobs
- When multiple VERIFY jobs exist (after rollback-reset), the displayed score is from the latest COMPLETED verify job. Rollback-reset supersedes previous scores.
- Thresholds: Excellent (90+, green), Good (70-89, blue), Fair (50-69, amber), Poor (<50, red)
- Displayed on: ticket card (small colored badge), ticket detail (Stats tab), analytics dashboard
- Analytics: average quality score over time chart, per-agent comparison, trend line

---

### 15. Slack/Discord Notifications

**Problem**: Users must check ai-board to know when jobs finish or when they're mentioned.

**Solution**: Push notifications to Slack/Discord channels via incoming webhooks.

**Functional Requirements**:
- Configuration in project settings: integration type (Slack/Discord), webhook URL, events to notify
- Leverages webhook system (#11) as transport layer, with formatted messages
- Slack format: rich attachment with color sidebar (green success, red failure), ticket key, title, link
- Discord format: embed with same info, adapted to Discord webhook format
- Events: job completed/failed, @mention, deploy completed, cleanup completed
- Message includes: ticket key (linked), title, status, actor, timestamp
- One integration per type per project (1 Slack + 1 Discord max)
- Test button: sends a test notification to verify webhook URL works
- Enable/disable toggle without deleting configuration
- Uses webhook event system (#11) for triggering, but formats payloads independently using Slack/Discord-specific formatters (Slack `blocks` format, Discord `embeds` format) — not the raw webhook JSON payload
- Prerequisite: Webhooks feature (#11) must be implemented first

---

### 16. Branch Diff Viewer in UI

**Problem**: Reviewing what the AI built requires going to GitHub. Breaks the workflow.

**Solution**: Inline diff viewer in ticket detail showing branch changes vs main.

**Functional Requirements**:
- New tab in ticket detail: "Changes" (visible when ticket has a branch)
- Display: list of changed files with insertions/deletions count
- Click file to expand: syntax-highlighted diff (green additions, red deletions)
- Stats header: X files changed, Y insertions, Z deletions
- Diff fetched via GitHub API (Octokit `compareCommits` or `getContent`)
- Collapsible files, "Expand all" / "Collapse all" buttons
- File type icons (based on extension)
- Search within diff (Ctrl/Cmd+F within the diff viewer)
- Loading state while fetching diff
- Error handling: branch deleted, repo inaccessible, rate limit
- Cache: diff cached for 60 seconds (invalidated on job completion)
- Tab position: after Files, before Stats (5 tabs total — mobile uses scrollable tab headers, already supported)

---

### 17. Ticket Estimation & Time Tracking

**Problem**: No way to predict effort or compare estimated vs actual time/cost.

**Solution**: AI-generated estimates at PLAN stage, tracked against actual job metrics.

**Functional Requirements**:
- Estimation generated during PLAN stage: AI outputs complexity assessment in plan.md
- Complexity field on ticket: T-shirt size (XS, S, M, L, XL) mapped to story points (1, 2, 3, 5, 8)
- AI outputs estimate in a structured format in plan.md (e.g., `## Estimation` section with `Complexity: M` and `Story Points: 3`)
- Parsed from plan.md and stored on ticket (`estimatedComplexity` enum, `storyPoints` integer)
- Fallback: if parsing fails, fields remain null and UI shows "No estimate available"
- Actual metrics: sum of all job durations and costs for the ticket (already tracked)
- Ticket detail: "Estimation" section showing estimated vs actual (duration, cost)
- Accuracy indicator: percentage deviation (estimated vs actual)
- Analytics: velocity chart enhanced with story points (points shipped per week)
- Analytics: estimation accuracy chart (how close estimates are over time)
- Helps calibrate AI agents and predict project timelines
- No manual estimation input — fully AI-driven from plan analysis

---

## Major Features (5+ tickets each)

### 18. Advanced Project Onboarding Wizard

**Problem**: Project creation is a single form. Users must manually configure everything after. No guidance for new users.

**Solution**: Multi-step wizard that scans the repo and pre-configures the project intelligently.

**Functional Requirements**:
- **Step 1 — Basics**: Project name, key (auto-suggested from repo name), description
- **Step 2 — Connect Repository**:
  - GitHub repo URL or owner/repo input
  - Validate access (check GH_PAT permissions)
  - Show repo info: language, stars, last commit, size
  - Error handling: invalid repo, no access, rate limit
- **Step 3 — Repository Scan**:
  - Auto-detect: primary language, framework (Next.js, React, Vue, Django, etc.), package manager
  - Detect existing: test framework, CI/CD config, README, docs folder
  - Detect structure: monorepo vs single, src layout
  - Display findings as a summary card
- **Step 4 — Constitution Generation**:
  - Based on scan results, generate a starter constitution.md
  - Preview with edit capability before saving
  - Include: detected stack, coding standards inferred from config files (ESLint, Prettier, tsconfig)
  - User can skip (empty constitution) or accept/modify
- **Step 5 — Configuration**:
  - Default agent selection (CLAUDE/CODEX) with recommendation based on detected stack
  - Clarification policy selection with contextual help
  - Optional: import ticket templates for detected project type
  - Optional: set deployment URL
- **Completion**: Project created with all config, branch protection info, ready to create first ticket
- **Skip option**: "Quick create" link on step 1 that creates with defaults (current behavior)
- **Progress indicator**: Step dots/bar showing current position
- **Back navigation**: Can go back to any previous step
- **State preservation**: Wizard state preserved if user navigates away accidentally

---

### 19. GitHub Import

**Problem**: Existing projects have issues, PRs, and context in GitHub. Starting fresh in ai-board means losing that context.

**Solution**: Import GitHub issues and PRs as ai-board tickets with intelligent mapping.

**Functional Requirements**:
- **Import trigger**: Button in project settings or during onboarding wizard (after repo connection)
- **Scan phase**:
  - Fetch all open issues and open PRs from connected repo
  - Display preview: count of issues, PRs, labels found
  - Show mapping preview before executing
- **Issue mapping**:
  - GitHub issue title → ticket title (truncated to 100 chars)
  - GitHub issue body → ticket description (truncated to 2000 chars, markdown preserved)
  - GitHub labels → ai-board labels (auto-create matching labels with closest color). Prerequisite: Feature #6 (Labels) must be implemented first. If not available, label import is skipped.
  - Issue state: open → INBOX, closed → not imported (option to include closed)
  - Assignees, milestones → stored in description as metadata (no direct model mapping)
- **PR mapping**:
  - Open PRs → tickets in BUILD or VERIFY stage (user selects target)
  - PR branch → ticket.branch (linked to existing branch)
  - PR description → ticket description
  - PR reviews → not imported (can be referenced via link)
- **Import options**:
  - Select which issues/PRs to import (checkboxes, select all/none)
  - Choose default stage for issues (INBOX or SPECIFY)
  - Choose to import labels (create new or map to existing)
  - Dry run: preview what will be created without creating
- **Execution**:
  - Batch creation with progress indicator (X/Y imported)
  - Each ticket created with `[imported]` metadata tag
  - GitHub issue comment added: "Imported to ai-board as {TICKET_KEY}" (optional, configurable)
  - Rate limited to respect GitHub API limits
- **Error handling**:
  - Partial failure: report which items failed, allow retry
  - Duplicate detection: skip issues already imported (track by GitHub issue number)
  - API rate limit: pause and resume
- **Limits**: Max 100 items per import (paginated for larger repos)
- **Data model**: `importedFromGithubId` nullable field on Ticket for dedup tracking

---

### 20. Multi-Agent Strategy (Agent Pipelines)

**Problem**: Single agent per ticket. No way to leverage different agents' strengths at different stages.

**Solution**: Configurable agent strategies per stage with optional parallel "race" mode.

**Functional Requirements**:
- **Strategy configuration** (project settings, new section):
  - Per-stage agent assignment: SPECIFY, PLAN, BUILD, VERIFY each get an agent selector
  - Default: all stages use project default agent (current behavior)
  - Override: select specific agent per stage
- **Race mode** (BUILD stage only, Team plan):
  - Enable race mode: runs 2 agents in parallel on the same BUILD
  - Creates 2 jobs (one per agent) on ephemeral branches (`{ticketKey}-race-a`, `{ticketKey}-race-b`) tracked on Job.branch
  - Both agents implement from same spec/plan on their respective branches
  - When both complete: auto-trigger `/compare` analysis
  - User picks winner: winning branch promoted to Ticket.branch, losing branch deleted
  - If one fails: winner is the successful one (no comparison needed)
  - Cost: billed for both agent runs (clear warning in UI)
- **Pipeline mode** (sequential agents):
  - Configure: Agent A does BUILD, Agent B does a review pass on Agent A's output
  - Second agent gets first agent's code + summary as context
  - Creates 2 sequential jobs (second waits for first to complete)
- **Configuration UI**:
  - Project settings: "Agent Strategy" section with stage-by-stage dropdowns
  - Race mode toggle (BUILD only) with cost warning
  - Pipeline mode toggle with agent order
  - Per-ticket override option in ticket detail
- **Analytics integration**:
  - Compare agent performance: success rate, cost, quality score per agent
  - Race mode stats: which agent wins more often
- **Data model**:
  - `AgentStrategy` table (projectId, stage, agents[], mode: SINGLE/RACE/PIPELINE)
  - Ticket-level override: `agentStrategyOverride` JSON field
- **Limits**: Race mode Team plan only, Pipeline mode Pro+ plans
- **Prerequisite**: Quality Score (#14) enhances race mode comparison

---

### 21. Public API + API Keys

**Problem**: All interaction is through the web UI. No programmatic access for automation, integrations, or custom tooling.

**Solution**: RESTful API with key-based authentication and rate limiting.

**Functional Requirements**:
- **Extends existing `PersonalAccessToken` model and `/settings/api-tokens` page** (already has SHA-256 hashed keys with salt):
  - Enhance existing token creation with optional expiry date
  - Add `lastUsedAt` tracking on existing model
  - List keys: name, created date, last used, expiry, revoke button (enhance existing UI)
  - Revoke key: immediate, confirmation required
  - Limit: 3 keys (Free), 10 (Pro), 25 (Team)
- **Authentication**: `Authorization: Bearer {api_key}` header
- **Endpoints** (read-write, project-scoped):
  - `GET /api/v1/projects` — list user's projects
  - `GET /api/v1/projects/:id` — project details
  - `GET /api/v1/projects/:id/tickets` — list tickets (filterable by stage, priority, label)
  - `POST /api/v1/projects/:id/tickets` — create ticket
  - `GET /api/v1/tickets/:key` — ticket details (by key, e.g., AIB-123)
  - `PATCH /api/v1/tickets/:key` — update ticket (title, description, priority, labels)
  - `POST /api/v1/tickets/:key/move` — transition ticket to stage
  - `POST /api/v1/tickets/:key/comments` — add comment
  - `GET /api/v1/tickets/:key/jobs` — list jobs for ticket
  - `GET /api/v1/projects/:id/analytics` — project analytics summary
- **Rate limiting** (per API key, sliding window):
  - Free: 100 requests/hour
  - Pro: 1,000 requests/hour
  - Team: 5,000 requests/hour
  - Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - 429 Too Many Requests with retry-after
- **Response format**: JSON, consistent error format `{ error: { code, message } }`
- **Versioning**: `/api/v1/` prefix, version in URL
- **Documentation**: Auto-generated OpenAPI 3.0 spec, served at `/api/v1/docs`
- **Pagination**: cursor-based for list endpoints (`?cursor=X&limit=50`, max 100)
- **Audit**: API key usage logged (endpoint, timestamp, status code)
- **Data model**: Extends existing `PersonalAccessToken` table with `lastUsedAt`, `expiresAt` fields. New `ApiAuditLog` table for usage tracking.
- **Security**: Existing SHA-256 + salt hashing preserved, transmitted only over HTTPS, no key in URL params

---

### 22. Project Templates & Constitution Marketplace

**Problem**: Every new project starts from scratch. Best practices and configurations aren't shareable.

**Solution**: Package project configs as templates. Community marketplace for sharing.

**Functional Requirements**:
- **Template creation** (from existing project):
  - "Save as Template" in project settings
  - Includes: constitution.md, clarification policy, agent config, ticket templates, labels, description
  - Does NOT include: tickets, jobs, members, billing data
  - Template name, description, category (SaaS, Mobile, Library, API, Fullstack, Other), tags
  - Preview before publishing
- **Template usage** (during project creation):
  - "Start from template" option in creation wizard / quick create
  - Browse templates: search, filter by category/tag
  - Preview template contents before applying
  - Apply: pre-fills all config, creates labels, imports ticket templates, sets constitution
  - All imported config is editable after creation
- **Personal templates**:
  - Private by default (only creator can use)
  - Available to all plans
- **Marketplace** (Team plan feature):
  - Publish template: makes it publicly discoverable
  - Browse public templates: search, sort by popularity/rating/recent
  - Template page: description, category, preview of constitution/config, author, usage count, rating
  - Rating system: 1-5 stars, gated to users who created at least one project from the template (one rating per user per template)
  - Author profile: link to published templates
  - Report mechanism for inappropriate content
- **Marketplace moderation**:
  - Content guidelines (no offensive content, must be functional)
  - Report → review → remove flow
  - Author can unpublish at any time
- **Data model**:
  - `ProjectTemplate` table (userId, name, description, category, tags[], config JSON, isPublic, usageCount, avgRating)
  - `TemplateRating` table (templateId, userId, score, createdAt)
- **Limits**: 5 private templates (Free), 20 (Pro), unlimited (Team). Publish to marketplace: Team only.
- **Import/Export**: Templates exportable as JSON file, importable from file (for sharing outside marketplace)

---

## Implementation Strategy

Each feature above is designed to become **one or more ai-board tickets**. The recommended implementation order follows dependency chains:

### Phase 1 — Foundation Quick Wins
Features 3 (Priority), 6 (Labels), 8 (Copy Key), 9 (Pin) — no dependencies, immediate UX improvement

### Phase 2 — Board Enhancement
Features 1 (Templates), 2 (Bulk Actions), 4 (Shortcuts), 5 (Theme), 10 (Export) — builds on Phase 1 UI patterns

### Phase 3 — Core Medium Features
Features 11 (Webhooks), 13 (Dependencies), 14 (Quality Score), 7 (Activity Log) — new data models, foundation for Phase 4

### Phase 4 — Integration & Insights
Features 12 (Dashboard), 15 (Slack/Discord), 16 (Diff Viewer), 17 (Estimation) — leverages Phase 3 infrastructure

### Phase 5 — Major Features
Features 18 (Onboarding), 19 (GitHub Import), 21 (API) — core platform expansion

### Phase 6 — Differentiation
Features 20 (Multi-Agent), 22 (Marketplace) — competitive moat, leverages everything above

---

*Design validated on 2026-03-17. Next step: create ai-board tickets per feature when ready to implement.*
