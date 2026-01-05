# Feature Specification: Comment with Ticket and Command Autocomplete

**Feature Branch**: `AIB-141-comment-with-ticket`
**Created**: 2026-01-05
**Status**: Draft
**Input**: User description: "Like for the @ in comments, I would like to have the same for commands and ticket keys. After a @mention to AI board assistance, if we type /, we should have a dropdown like for the mention but to list the commands with a short description. For now, we only have the command compare. If we type # in a comment, we should have the list of tickets for this project with the key and the title, and on select, have only the ticket key like this: #AIB-120. It is just to save time with autocomplete."

## Auto-Resolved Decisions

- **Decision**: Command list source - where to get available commands
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.85) - Existing pattern established with `.claude/commands/` directory
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Limited to commands exposed via metadata; requires explicit command registration
  2. Future commands automatically available without code changes
- **Reviewer Notes**: Verify that `/compare` is the only user-invocable command in comment context. AI-BOARD assistant commands should not be exposed to end users.

---

- **Decision**: Ticket search scope - which tickets to show in autocomplete
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Security/authorization requires project-scoped access
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users can only autocomplete tickets they have access to (same project)
  2. Cross-project references would require explicit URL linking
- **Reviewer Notes**: Ticket list must respect existing project access controls (owner OR member).

---

- **Decision**: Command trigger context - when `/` shows command dropdown
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.7) - User description suggests "after @ai-board", but could be more broadly useful
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Restricting to post-@ai-board context limits discoverability
  2. Simpler UX with clear trigger point
- **Reviewer Notes**: User explicitly stated "After a @mention to AI board assistance, if we type /". This decision follows user intent exactly.

## User Scenarios & Testing

### User Story 1 - Ticket Reference Autocomplete (Priority: P1)

A user writing a comment wants to reference another ticket in the current project. Instead of manually typing or looking up the ticket key, they type `#` to trigger an autocomplete dropdown showing all project tickets. They can filter by typing partial matches and select to insert the ticket key.

**Why this priority**: Core productivity feature that saves time on every comment. Tickets are referenced frequently in discussions.

**Independent Test**: Can be fully tested by creating a comment with `#AIB-` and verifying dropdown appears with filterable tickets, selection inserts `#AIB-120` format.

**Acceptance Scenarios**:

1. **Given** a user is typing in the comment textarea, **When** they type `#`, **Then** a dropdown appears showing tickets from the current project with format `{KEY} - {title}`.
2. **Given** the ticket dropdown is visible, **When** the user continues typing (e.g., `#AIB-1`), **Then** the dropdown filters to show only matching tickets.
3. **Given** a filtered ticket list, **When** the user selects a ticket (click or Enter), **Then** the ticket key is inserted in format `#{TICKET_KEY}` (e.g., `#AIB-120`) and the dropdown closes.
4. **Given** the ticket dropdown is visible, **When** the user presses Escape, **Then** the dropdown closes without inserting anything.
5. **Given** the ticket dropdown is visible, **When** the user clicks outside the dropdown, **Then** the dropdown closes without inserting anything.
6. **Given** the user types `#` at the start of a word, **When** the dropdown appears, **Then** keyboard navigation (Arrow Up/Down) changes the selected ticket.

---

### User Story 2 - Command Autocomplete After AI-BOARD Mention (Priority: P2)

After mentioning `@ai-board` in a comment, the user wants to specify a command. When they type `/`, a dropdown appears with available commands and short descriptions. Selecting a command inserts it into the comment.

**Why this priority**: Enhances AI-BOARD interaction efficiency. Currently only one command (`/compare`), but pattern establishes foundation for future commands.

**Independent Test**: Can be fully tested by typing `@ai-board /` and verifying dropdown shows `/compare` with description, selection inserts `/compare`.

**Acceptance Scenarios**:

1. **Given** a user has typed `@ai-board` (or selected AI-BOARD mention), **When** they type `/`, **Then** a dropdown appears showing available commands with descriptions.
2. **Given** the command dropdown is visible, **When** the user types additional characters (e.g., `/com`), **Then** the dropdown filters to matching commands.
3. **Given** a command is selected, **When** the user confirms selection (click or Enter), **Then** the command text is inserted (e.g., `/compare`) and the dropdown closes.
4. **Given** the command dropdown is visible, **When** the user presses Escape or clicks outside, **Then** the dropdown closes.
5. **Given** no AI-BOARD mention precedes the cursor, **When** the user types `/`, **Then** no command dropdown appears (treated as regular text).

---

### User Story 3 - Keyboard Navigation Consistency (Priority: P3)

Users familiar with the existing @mention autocomplete expect consistent keyboard navigation for ticket and command dropdowns.

**Why this priority**: UX consistency reduces learning curve and prevents confusion.

**Independent Test**: Can be tested by verifying Arrow keys, Enter, and Escape work identically across @mention, #ticket, and /command dropdowns.

**Acceptance Scenarios**:

1. **Given** any autocomplete dropdown is visible, **When** the user presses Arrow Down, **Then** the next item is highlighted.
2. **Given** any autocomplete dropdown is visible, **When** the user presses Arrow Up, **Then** the previous item is highlighted.
3. **Given** an item is highlighted, **When** the user presses Enter, **Then** that item is selected and inserted.
4. **Given** any autocomplete dropdown is visible, **When** the user presses Escape, **Then** the dropdown closes without selection.

---

### Edge Cases

- What happens when typing `#` but no tickets exist in the project? **Show "No tickets found" message or empty state.**
- What happens when typing `/` but no commands are available? **Show "No commands available" message or empty state.**
- What happens if user types `#` inside an existing mention (e.g., `@[id:name]#`)? **Do not trigger autocomplete; treat as regular text.**
- What happens when the ticket list is very long (100+ tickets)? **Limit initial display to most recent/relevant tickets; filtering narrows results.**
- What happens if user types `#` then immediately presses Enter? **Insert `#` as literal text if no selection made.**
- What happens when typing `##` (double hash)? **Only first `#` triggers autocomplete; subsequent chars filter the list.**

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a ticket autocomplete dropdown when user types `#` at a word boundary in the comment textarea.
- **FR-002**: Ticket dropdown MUST show tickets in format `{TICKET_KEY} - {title}` (e.g., "AIB-120 - Fix login bug").
- **FR-003**: Ticket selection MUST insert only the ticket key with hash prefix (e.g., `#AIB-120`), not the title.
- **FR-004**: System MUST filter ticket list in real-time as user continues typing after `#`.
- **FR-005**: Ticket autocomplete MUST only show tickets from the current project.
- **FR-006**: System MUST display a command autocomplete dropdown when user types `/` after an AI-BOARD mention.
- **FR-007**: Command dropdown MUST show command name and short description for each available command.
- **FR-008**: Command selection MUST insert the command text (e.g., `/compare`).
- **FR-009**: Both dropdowns MUST support keyboard navigation (Arrow Up, Arrow Down, Enter, Escape).
- **FR-010**: Both dropdowns MUST close when clicking outside or pressing Escape.
- **FR-011**: System MUST NOT trigger `#` autocomplete inside existing mention markup.
- **FR-012**: System MUST position dropdowns relative to cursor/caret position, consistent with existing @mention behavior.

### Key Entities

- **Ticket**: Represents a project ticket with `ticketKey` (e.g., "AIB-120") and `title` attributes used in autocomplete display.
- **Command**: Represents an AI-BOARD assistant command with `name` (e.g., "/compare") and `description` for dropdown display.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can reference tickets via `#` autocomplete within 2 seconds (vs. manual lookup time).
- **SC-002**: 100% of project tickets are searchable via the `#` autocomplete.
- **SC-003**: Command autocomplete shows all available commands with descriptions.
- **SC-004**: Keyboard-only users can complete autocomplete interactions without mouse.
- **SC-005**: Autocomplete dropdowns render without blocking comment typing (non-modal interaction).
- **SC-006**: All autocomplete scenarios covered by automated tests (unit and integration).
