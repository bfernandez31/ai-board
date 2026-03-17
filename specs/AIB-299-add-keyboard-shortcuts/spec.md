# Feature Specification: Add Keyboard Shortcuts on Board

**Feature Branch**: `AIB-299-add-keyboard-shortcuts`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "Add keyboard shortcuts for common board actions on desktop/tablet with physical keyboard"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Mobile detection strategy — use CSS media query `(hover: hover)` as the primary detection mechanism rather than `navigator.maxTouchPoints`
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1) — neutral feature context, no sensitive or speed signals
- **Fallback Triggered?**: Yes — LOW confidence caused AUTO to promote to CONSERVATIVE
- **Trade-offs**:
  1. CSS media query `(hover: hover)` is more reliable for detecting physical keyboard/pointer availability than JavaScript-based touch detection
  2. Some hybrid devices (e.g., Surface with keyboard attached) may still trigger shortcuts; this is acceptable since they have physical keyboards
- **Reviewer Notes**: Verify that `(hover: hover)` correctly excludes touch-only tablets in target browser matrix

---

- **Decision**: First-visit help overlay behavior — show the shortcut help overlay automatically on first board visit, dismissible via Escape or clicking outside, with a localStorage flag to prevent re-showing
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. First-visit auto-show improves discoverability but may briefly interrupt workflow
  2. localStorage flag means clearing browser data resets the hint, which is acceptable behavior
- **Reviewer Notes**: Confirm localStorage key `shortcuts-hint-dismissed` does not conflict with existing keys

---

- **Decision**: Shortcut scope boundary — shortcuts are active only on the board page and are completely disabled inside the ticket detail modal (except Escape to close)
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Disabling shortcuts in the detail modal prevents accidental actions while reading/editing ticket content
  2. Users must close the modal before using board shortcuts, which is the expected UX pattern
- **Reviewer Notes**: Ensure Escape key correctly prioritizes closing the innermost open overlay (detail modal > help overlay > other modals)

---

- **Decision**: Column scroll behavior — use smooth scrolling to bring the target column into the visible viewport, scrolling the board container horizontally
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Smooth scroll provides a polished UX but may feel slow for rapid column-switching
  2. Users who prefer instant navigation can still scroll manually
- **Reviewer Notes**: Verify smooth scroll works consistently across target browsers

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Ticket Creation via Keyboard (Priority: P1)

A power user working on the board wants to quickly create a new ticket without reaching for the mouse. They press `N` on their keyboard, the new ticket creation modal opens immediately, and they can start typing the ticket title.

**Why this priority**: Ticket creation is the most frequent board action. Enabling it via keyboard significantly speeds up power-user workflows.

**Independent Test**: Can be fully tested by pressing `N` on the board page and verifying the new ticket modal opens. Delivers immediate value for keyboard-centric users.

**Acceptance Scenarios**:

1. **Given** the user is on the board page with no text input focused, **When** they press `N`, **Then** the new ticket creation modal opens with the title field focused
2. **Given** the user is typing in a text input on the board, **When** they press `N`, **Then** no modal opens (the character is typed into the input instead)
3. **Given** the user is on a mobile device without a physical keyboard, **When** the board loads, **Then** keyboard shortcuts are not registered

---

### User Story 2 - Fast Search Access (Priority: P1)

A user wants to quickly find a ticket on the board. They press `S` or `/` to focus the search input and begin typing immediately, without needing to click the search bar.

**Why this priority**: Search is the second most common board interaction. Quick access via keyboard improves navigation efficiency.

**Independent Test**: Can be fully tested by pressing `S` or `/` on the board page and verifying the search input receives focus.

**Acceptance Scenarios**:

1. **Given** the user is on the board page with no text input focused, **When** they press `S`, **Then** the search input is focused and ready for typing
2. **Given** the user is on the board page with no text input focused, **When** they press `/`, **Then** the search input is focused and ready for typing
3. **Given** the search input is already focused, **When** the user presses `Escape`, **Then** the search input loses focus

---

### User Story 3 - Column Navigation via Number Keys (Priority: P2)

A user working on a large board with many tickets wants to quickly jump to a specific stage column. They press a number key (`1` through `6`) and the board smoothly scrolls to bring that column into view.

**Why this priority**: Column navigation is useful for boards with many tickets where columns may be off-screen, but is secondary to ticket creation and search.

**Independent Test**: Can be fully tested by pressing number keys `1`–`6` and verifying the board scrolls to the corresponding column.

**Acceptance Scenarios**:

1. **Given** the user is on the board page, **When** they press `1`, **Then** the board scrolls to show the INBOX column
2. **Given** the user is on the board page, **When** they press `4`, **Then** the board scrolls to show the BUILD column
3. **Given** the user is on the board page, **When** they press `6`, **Then** the board scrolls to show the SHIP column
4. **Given** a text input is focused, **When** the user presses `3`, **Then** the board does not scroll (the character is typed into the input)

---

### User Story 4 - Shortcut Help Overlay (Priority: P2)

A user new to the board wants to discover available keyboard shortcuts. They see a small `?` icon in the board header area, hover over it to see "Keyboard shortcuts (?)", and click it (or press `?`) to open a help overlay listing all shortcuts.

**Why this priority**: Discoverability is essential for adoption but secondary to the shortcuts themselves functioning correctly.

**Independent Test**: Can be fully tested by pressing `?` or clicking the help icon and verifying the overlay displays all shortcuts in a readable format.

**Acceptance Scenarios**:

1. **Given** the user is on the board page, **When** they press `?` (Shift+/), **Then** a centered modal appears listing all keyboard shortcuts in a two-column table (Key | Action)
2. **Given** the help overlay is open, **When** the user presses `Escape`, **Then** the overlay closes
3. **Given** the help overlay is open, **When** the user clicks outside the overlay, **Then** the overlay closes
4. **Given** the help overlay is open, **When** the user presses `?` again, **Then** the overlay closes (toggle behavior)
5. **Given** the user visits the board for the first time (no `shortcuts-hint-dismissed` localStorage flag), **When** the board loads, **Then** the help overlay is shown automatically
6. **Given** the user has dismissed the help overlay previously, **When** they visit the board again, **Then** the help overlay is not shown automatically

---

### User Story 5 - Escape Key Closes Modals and Overlays (Priority: P3)

A user has a modal or overlay open and wants to quickly dismiss it using the keyboard. Pressing `Escape` closes the topmost open modal or overlay.

**Why this priority**: Escape-to-close is a standard accessibility pattern. It enhances all other shortcuts but is lower priority because shadcn/ui dialogs already handle Escape natively.

**Independent Test**: Can be fully tested by opening any modal/overlay and pressing Escape to verify it closes.

**Acceptance Scenarios**:

1. **Given** the new ticket modal is open, **When** the user presses `Escape`, **Then** the modal closes
2. **Given** the help overlay is open, **When** the user presses `Escape`, **Then** the overlay closes
3. **Given** both the help overlay and a modal are open, **When** the user presses `Escape`, **Then** the topmost overlay/modal closes first

---

### Edge Cases

- What happens when the user presses a shortcut key while a contenteditable element is focused? Shortcuts are suppressed to avoid interfering with text editing.
- What happens when the user presses `N` while the new ticket modal is already open? The shortcut is ignored (modal is already open, and focus is likely in a text field).
- What happens when the user presses a number key for a column that is already in view? The board still scrolls to ensure the column is fully visible (idempotent behavior).
- What happens when the user has a physical keyboard connected to a tablet? Shortcuts work since `(hover: hover)` media query matches devices with fine pointer input.
- What happens when localStorage is unavailable (e.g., private browsing in some browsers)? The first-visit hint gracefully degrades — either always show or never show, without throwing errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST register keyboard shortcuts (`N`, `S`, `/`, `1`–`6`, `?`, `Escape`) on the board page only
- **FR-002**: System MUST suppress all keyboard shortcuts (except `Escape`) when a text input, textarea, or contenteditable element is focused
- **FR-003**: System MUST suppress all keyboard shortcuts on devices that match touch-only input (no hover capability)
- **FR-004**: Pressing `N` MUST open the new ticket creation modal with the title field focused
- **FR-005**: Pressing `S` or `/` MUST focus the search input in the board header
- **FR-006**: Pressing `1` through `6` MUST smoothly scroll the board to the corresponding stage column (1=INBOX, 2=SPECIFY, 3=PLAN, 4=BUILD, 5=VERIFY, 6=SHIP)
- **FR-007**: Pressing `?` (Shift+/) MUST toggle the shortcut help overlay
- **FR-008**: The help overlay MUST display all available shortcuts in a two-column table format (Key | Action)
- **FR-009**: The help overlay MUST be dismissible via `Escape` key or clicking outside
- **FR-010**: A `?` icon MUST be visible in the board header area on desktop, hidden on mobile
- **FR-011**: The `?` icon MUST show a tooltip "Keyboard shortcuts (?)" on hover
- **FR-012**: The help overlay MUST appear automatically on the user's first board visit, tracked via localStorage flag `shortcuts-hint-dismissed`
- **FR-013**: System MUST gracefully handle localStorage unavailability without errors
- **FR-014**: Shortcuts MUST be completely inactive inside the ticket detail modal (except `Escape` to close the modal, which is existing behavior)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All defined keyboard shortcuts (`N`, `S`, `/`, `1`–`6`, `?`, `Escape`) respond within 100ms of key press on the board page
- **SC-002**: Zero shortcut activations occur when a text input, textarea, or contenteditable element is focused
- **SC-003**: Zero shortcut activations occur on touch-only devices without a physical keyboard
- **SC-004**: 100% of first-time board visitors see the shortcut help overlay on initial load
- **SC-005**: The help overlay correctly displays all shortcuts and is dismissible via Escape or outside click
- **SC-006**: Column scroll shortcuts (`1`–`6`) bring the target column fully into the visible viewport
- **SC-007**: All keyboard shortcuts pass automated test coverage (unit tests for the hook, component tests for the overlay and integration)
