# Next Features - /specify Prompts

Generated: 2025-10-02
Based on: vision/overview.md analysis

---

## Priority 1: Foundation Features

### 006-add-specify-stage

```
/specify

Add SPECIFY stage to the kanban workflow between INBOX and PLAN.

WHAT:
Introduce SPECIFY column, transitions, and UI badges so tickets flow INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP.

WHY:
SPECIFY is required for the spec-kit pipeline; tickets must pause there before planning.

REQUIREMENTS:

DATA & MIGRATIONS:
- Update Prisma Stage enum to include SPECIFY and generate migration.
- Default new tickets to INBOX; adjust seeds/tests for the new enum value.

API & VALIDATION:
- PATCH /api/tickets/[id] validates sequential transitions (INBOX→SPECIFY→PLAN … SHIP).
- Stage validation utilities updated with the new stage order.

UI:
- Board renders SPECIFY column with empty state messaging.
- Stage badges include SPECIFY styling (distinct color).
- Drag-and-drop allows INBOX→SPECIFY only; invalid jumps show toast error.

ACCEPTANCE CRITERIA:
- Column visible on board with correct ordering.
- Drag from INBOX to SPECIFY persists in database.
- Invalid transitions (e.g., INBOX→PLAN) blocked with descriptive toast.
- Existing tickets migrate without data loss.
- Tests/migrations committed.

NON-GOALS:
- No auto-advance from SPECIFY.
- No clarify badges yet.
```

---

### 007-enable-ticket-editing

```
/specify

Enable inline editing of ticket title and description inside the ticket detail modal.

WHAT:
Add edit mode within the modal so users can change title/description with validation and optimistic updates.

WHY:
Teams need to correct ticket information without leaving the board.

REQUIREMENTS:

UI:
- Title behaves Trello-style: click the header → inline input with focus, pencil icon on hover, Enter/blur saves, ESC restores original text.
- Description is always present (mandatory). Clicking anywhere in the description region (or the hover pencil) swaps to textarea with counter; ESC/Cancel restores original text.
- Save/Cancel controls appear only while editing; show loading state during persistence.

API:
- PATCH /api/tickets/[id] accepts { title?, description?, version }.
- Uses optimistic concurrency (version field) and returns updated ticket payload.

STATE & UX:
- Disable Save when invalid or unchanged; show inline validation errors.
- Enforce title ≤100 chars; description must stay ≥1 and ≤1000 chars with live counter/warning at 90%.
- Optimistic update on success; rollback on error with toast.
- Refresh board state after confirmation.

ACCEPTANCE CRITERIA:
- Clicking the title opens inline edit without extra button; Enter/blur saves, ESC cancels.
- Clicking the description body opens textarea editor; empty save blocked with inline error.
- Saved changes immediately update board; toasts indicate success/error.
- Concurrent edit conflict triggers descriptive toast and refresh prompt.
- Unit tests cover title/description edit flows and API interactions.

NON-GOALS:
- No stage editing.
- No markdown formatting or auto-save.
```

---

### 008-add-ticket-deletion

```
/specify

Add ticket deletion from the ticket detail modal with confirmation dialog.

WHAT:
Allow users to permanently delete a ticket after explicit confirmation.

WHY:
Users need to remove obsolete tickets to keep the board clean.

REQUIREMENTS:

UI:
- “Delete ticket” destructive button in modal footer.
- Confirmation dialog with ticket title, irreversible warning, Confirm/Cancel controls.
- Success toast + modal close + board refresh.

API:
- DELETE /api/tickets/[id] removes ticket in transaction; handles 404/500 gracefully.
- Returns JSON status for optimistic update handling.

STATE:
- Disable confirm while deleting; show spinner.
- Remove ticket from local state without full reload; handle errors with toast.

ACCEPTANCE CRITERIA:
- Delete button opens confirmation dialog.
- Confirm deletes ticket and removes card from board.
- Cancel keeps ticket intact.
- Errors surface toast and leave ticket untouched.
- Tests cover API and UI flows.

NON-GOALS:
- No soft delete/undo.
- No bulk delete or audit log.
```

---

### 009-add-stage-indicators

```
/specify

Display ticket count badges and capacity warnings on each board column.

WHAT:
Show the number of tickets per stage with visual warnings when thresholds are exceeded (INBOX>10, PLAN>8, BUILD>6, VERIFY>8).

WHY:
PMs need immediate visibility into workload and bottlenecks.

REQUIREMENTS:

UI:
- Stage header shows badge with count.
- Warning state: amber badge + subtle background tint when threshold exceeded.
- Empty state styling for zero tickets.

DATA UPDATES:
- Counts update live on ticket create/delete/drag-drop.
- Works with server refresh and optimistic updates.

ACCESSIBILITY:
- Tooltip/aria-label explaining warning state.
- Badge readable in dark theme.

ACCEPTANCE CRITERIA:
- Counts accurate after board actions.
- Warning triggers at defined thresholds and clears after reductions.
- Behaviour consistent on mobile/desktop.

NON-GOALS:
- No configurable thresholds.
- No historical analytics.
```

---

### 010-add-spec-tab

```
/specify

Add markdown specification storage and viewing tab in the ticket detail modal.

WHAT:
Introduce a nullable spec field, last updated timestamp, and a new modal tab to view the spec content.

WHY:
We need space to store manual/AI-generated specifications before automation kicks in.

REQUIREMENTS:

DATA:
- Prisma migration: Ticket.spec (text, nullable) + specUpdatedAt (DateTime?).
- Update API responses to include spec metadata.

UI:
- Modal tabs: “Details” (default) and “Spec”.
- Spec tab renders markdown with dark theme styling and scrollable container.
- Empty state message + icon when no spec recorded.

ACCEPTANCE CRITERIA:
- Spec tab appears once migration applied.
- Tickets with spec display formatted markdown.
- Empty spec shows placeholder.
- Modal remembers last tab during open session.

NON-GOALS:
- No editing yet (view only).
- No AI integration or version history.
```

---

## Priority 2: Spec Management

### 011-add-spec-editor

```
/specify

Add markdown editor for creating and editing ticket specifications.

WHAT:
Allow users to manually write and edit ticket specifications in markdown format with live preview.

WHY:
Users need to document requirements before AI integration is available.

REQUIREMENTS:

EDITOR:
- Markdown text area with syntax highlighting, line numbers, auto-indentation.
- Tab key support and keyboard shortcuts (Ctrl/Cmd+S saves).

PREVIEW:
- Live markdown preview.
- Side-by-side on desktop (≥768px), tabbed toggle on mobile.
- Same markdown renderer as view mode.

EDITING FLOW:
- “Edit Spec” button in Spec tab toggles edit mode.
- Save/Cancel buttons; auto-save draft to localStorage.
- Restore draft when returning; clear draft on successful save.

VALIDATION:
- Max 10,000 characters with counter and warning at 90%.
- Prevent save when over limit or empty.

UNSAVED CHANGES:
- Warn when closing modal or switching tabs with unsaved edits.

UPDATES:
- Update specUpdatedAt timestamp; show last updated label.
- Success toast on save.

ACCEPTANCE CRITERIA:
- Editor opens and saves spec to DB.
- Preview updates live; responsive layouts work.
- Draft survives refresh until saved.
- Unsaved warning triggers appropriately.

NON-GOALS:
- No collaborative editing.
- No AI assistance.
```

---

## Priority 3: Enhanced Board Experience

### 012-add-ticket-filtering

```
/specify

Add search and stage filter controls to quickly find tickets on the board.

WHAT:
Allow users to filter tickets by text search and stage selection.

WHY:
As the board grows, users need to quickly find tickets without scrolling all stages.

REQUIREMENTS:

SEARCH:
- Input in board header; filters title/description (case-insensitive, partial match).
- Real-time filtering with clear button and search icon.

STAGE FILTER:
- Multi-select dropdown (checkbox list).
- “All stages” default; show selected count; clear option.

COMBINED FILTERS:
- Search AND stage filters work together.
- Filter state reflected in URL query params (shareable, back/forward support).

DISPLAY:
- Show filtered ticket count.
- “No results” empty state.
- Preserve drag/drop while filters active.
- Clear-all button resets filters.

ACCEPTANCE CRITERIA:
- Filters apply instantly and persist via URL.
- Drag/drop still works under filters.
- Responsive layout.

NON-GOALS:
- No advanced query syntax or saved presets.
```

---

### 013-add-ticket-sorting

```
/specify

Add sorting options to organize tickets within each stage.

WHAT:
Allow users to sort tickets by date, title, or manual drag-drop order.

WHY:
Users need to prioritize and organize tickets according to different criteria.

REQUIREMENTS:

SORT OPTIONS:
- Created date (newest/oldest), Updated date (newest/oldest), Title (A→Z / Z→A), Manual order.

UI:
- Sort dropdown in board header with current selection indicator.
- Persist preference in localStorage.

MANUAL SORTING:
- Add sortOrder field to tickets.
- Save order on drag-drop; maintain within stage.

AUTO SORTING:
- Disable drag when auto-sort active; show “Drag disabled” message.
- Switching back to Manual re-enables drag using stored order.

ACCEPTANCE CRITERIA:
- All sort modes behave correctly and persist between sessions.
- Manual order stored and restored.
- Works alongside filters.

NON-GOALS:
- No per-user or per-stage custom sorting rules.
```

---

## Priority 4: GitHub Preparation

### 014-add-project-model

```
/specify

Add Project entity to organize tickets and prepare for multi-repo support.

WHAT:
Create a Project data model and associate all tickets with a default project.

WHY:
Vision requires workspace/project organization and GitHub repo connections.

REQUIREMENTS:

DATA MODEL:
- Create Project model (id, name, description, createdAt, updatedAt).
- Add projectId to Ticket (required, FK with cascade on delete).
- Migration creates default project “ai-board” and assigns existing tickets.

UI:
- Board header displays current project name.
- Future-proof structure for project switcher.

ACCEPTANCE CRITERIA:
- Database updated with project records.
- Tickets reference default project.
- Board shows project name without regressions.

NON-GOALS:
- No multi-project UI switching yet.
- No project settings page.
```
