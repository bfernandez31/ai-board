# Feature Specification: Browser Push Notifications for Job Completion and Mentions

**Feature Branch**: `AIB-159-browser-push-notifications`
**Created**: 2026-01-07
**Status**: Draft
**Input**: User description: "As a project owner, I want to receive browser notifications when my jobs complete or someone mentions me, so I can stay informed without keeping the ai-board tab open."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Push notification recipient scope limited to project owners only (not all project members)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.85) — The ticket explicitly states "Recipients: Project owner only" as a scope constraint
- **Fallback Triggered?**: No — Explicit requirement in ticket description, no ambiguity
- **Trade-offs**:
  1. Members must rely on in-app notifications; owner may still need to forward important updates manually
  2. Simpler implementation with single recipient logic; easier permission model
- **Reviewer Notes**: Future iteration may extend to project members. Ensure the architecture supports adding recipient types later.

---

- **Decision**: Push notification opt-in uses persistent browser local storage to remember dismissal state
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (0.6) — Standard UX pattern for opt-in prompts; no security/compliance signals
- **Fallback Triggered?**: No — Common practice, low risk
- **Trade-offs**:
  1. Users clearing browser data will see the prompt again; acceptable for opt-in flow
  2. No server-side "dismissed" tracking means cross-device state is not synchronized
- **Reviewer Notes**: Confirm that showing prompt again after data clear is acceptable UX.

---

- **Decision**: Subscription data (push endpoint, keys) stored server-side in database for delivery
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8) — Required for server-to-browser push delivery via Web Push protocol
- **Fallback Triggered?**: No — Technical necessity, not a design choice
- **Trade-offs**:
  1. Additional database storage for push subscription fields
  2. Enables reliable push delivery even when user's browser tab is closed
- **Reviewer Notes**: Ensure subscription data is properly handled per security best practices.

---

- **Decision**: Notification click opens existing ai-board tab if present, otherwise opens new tab
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (0.65) — Standard notification behavior; matches existing notification dropdown navigation pattern
- **Fallback Triggered?**: No — Matches established codebase pattern in notification-dropdown component
- **Trade-offs**:
  1. May require service worker to coordinate with existing tabs
  2. Consistent with user expectations for notification clicks
- **Reviewer Notes**: Test with multiple ai-board tabs open to ensure correct focus behavior.

---

- **Decision**: Job cancellation (CANCELLED status) triggers notification with neutral messaging
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — CANCELLED is a terminal state; user should know job stopped
- **Fallback Triggered?**: No — Explicit in acceptance criteria ("Job completion (COMPLETED, FAILED, CANCELLED)")
- **Trade-offs**:
  1. May create noise if jobs are frequently cancelled
  2. Keeps user informed of all terminal states consistently
- **Reviewer Notes**: Consider if cancelled jobs warrant different visual treatment than failures.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Push Notifications (Priority: P1)

As a project owner, I want to opt-in to push notifications so I can receive alerts outside the browser tab.

**Why this priority**: Core enablement flow—without this, no push notifications are possible. Gate for all other functionality.

**Independent Test**: Can be fully tested by visiting ai-board, seeing the opt-in prompt, clicking Enable, granting browser permission, and verifying subscription is saved.

**Acceptance Scenarios**:

1. **Given** a project owner visits ai-board for the first time, **When** the page loads, **Then** a floating opt-in prompt appears with "Enable Push Notifications" message and Enable/Dismiss buttons
2. **Given** the opt-in prompt is visible, **When** the user clicks "Enable", **Then** the browser's native permission dialog appears
3. **Given** the browser permission dialog is shown, **When** the user grants permission, **Then** the push subscription is created and stored, and the prompt disappears with a success indicator
4. **Given** the browser permission dialog is shown, **When** the user denies permission, **Then** the prompt disappears and the user is not subscribed
5. **Given** the opt-in prompt is visible, **When** the user clicks "Dismiss", **Then** the prompt disappears and does not reappear for that browser session (stored in local storage)

---

### User Story 2 - Receive Job Completion Notification (Priority: P1)

As a project owner with push notifications enabled, I want to receive a browser notification when my job completes so I know the result without checking the board.

**Why this priority**: Primary use case stated in the ticket—knowing when jobs finish.

**Independent Test**: Can be tested by enabling notifications, triggering a job, and verifying the browser notification appears when job reaches terminal state.

**Acceptance Scenarios**:

1. **Given** push notifications are enabled and a job is running for a ticket in my project, **When** the job completes successfully (COMPLETED), **Then** a browser notification appears with "Job Completed: {ticketKey}" and the ticket title
2. **Given** push notifications are enabled and a job is running, **When** the job fails (FAILED), **Then** a browser notification appears with "Job Failed: {ticketKey}" and the ticket title
3. **Given** push notifications are enabled and a job is running, **When** the job is cancelled (CANCELLED), **Then** a browser notification appears with "Job Cancelled: {ticketKey}" and the ticket title
4. **Given** a browser notification for job completion is displayed, **When** the user clicks the notification, **Then** ai-board opens (or focuses existing tab) and navigates to the ticket modal
5. **Given** the browser tab is minimized or user is in another application, **When** a job reaches terminal state, **Then** the notification still appears (browser-level push, not in-app)

---

### User Story 3 - Receive @mention Notification (Priority: P2)

As a project owner with push notifications enabled, I want to receive a browser notification when someone mentions me so I can respond promptly.

**Why this priority**: Secondary use case; leverages existing @mention infrastructure in the notification system.

**Independent Test**: Can be tested by enabling notifications, having another user @mention the owner in a comment, and verifying the browser notification appears.

**Acceptance Scenarios**:

1. **Given** push notifications are enabled for a project owner, **When** another user creates a comment mentioning the owner with @mention, **Then** a browser notification appears with "@{actorName} mentioned you in {ticketKey}"
2. **Given** a browser notification for @mention is displayed, **When** the user clicks the notification, **Then** ai-board opens and navigates to the ticket modal's comments tab, scrolling to the relevant comment
3. **Given** push notifications are NOT enabled, **When** someone mentions the owner, **Then** only the in-app notification (bell icon) appears—no browser notification

---

### User Story 4 - Manage Notification Preferences (Priority: P3)

As a project owner, I want to manage my push notification settings so I can enable, disable, or re-enable notifications.

**Why this priority**: Quality-of-life feature; core flows work without explicit settings UI.

**Independent Test**: Can be tested by accessing notification settings, toggling push on/off, and verifying behavior changes accordingly.

**Acceptance Scenarios**:

1. **Given** push notifications are enabled, **When** the user accesses notification settings, **Then** they can see their current subscription status (enabled/disabled)
2. **Given** push notifications are enabled, **When** the user disables notifications in settings, **Then** the subscription is removed and no further push notifications are sent
3. **Given** push notifications were previously disabled, **When** the user re-enables notifications, **Then** a new subscription is created (may prompt for browser permission if previously revoked)

---

### Edge Cases

- What happens when the browser does not support push notifications (e.g., older browsers, Safari on certain versions)? System degrades gracefully; opt-in prompt is not shown, and user relies on in-app notifications.
- What happens when the user blocks notifications at the browser/OS level after previously enabling? Subscription becomes invalid; push fails silently on server side. User must re-enable via browser settings and re-subscribe.
- What happens when multiple jobs complete simultaneously? Each job triggers a separate notification. Browser may group them depending on OS settings.
- What happens when the push subscription expires? Subscriptions may expire or become invalid over time. Server should handle failed push attempts gracefully (log error, potentially mark subscription as invalid).
- What happens when user is logged out? Push notifications are tied to authenticated user. If logged out, no new subscriptions are created; existing subscription remains but server filters by authenticated session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an opt-in prompt to project owners who have not yet enabled or dismissed push notifications
- **FR-002**: Opt-in prompt MUST include "Enable" and "Dismiss" actions
- **FR-003**: System MUST request browser notification permission when user clicks "Enable"
- **FR-004**: System MUST store push subscription data (endpoint, keys) on the server after successful permission grant
- **FR-005**: System MUST persist dismissal state in browser local storage to avoid re-showing prompt
- **FR-006**: System MUST send push notification when a job transitions to COMPLETED status
- **FR-007**: System MUST send push notification when a job transitions to FAILED status
- **FR-008**: System MUST send push notification when a job transitions to CANCELLED status
- **FR-009**: Push notification content MUST include the job outcome indicator, ticket key, and ticket title
- **FR-010**: System MUST send push notification when a user is @mentioned in a comment
- **FR-011**: @mention push notification content MUST include the actor's name and ticket key
- **FR-012**: Clicking a push notification MUST navigate to the relevant ticket modal
- **FR-013**: Push notifications MUST work when the browser tab is not active (background/minimized)
- **FR-014**: System MUST only send push notifications to project owners (not members)
- **FR-015**: System MUST provide a way for users to view and manage their push notification subscription status
- **FR-016**: System MUST handle browsers that do not support push notifications by hiding the opt-in prompt
- **FR-017**: System MUST handle failed push delivery gracefully without crashing or blocking other operations

### Key Entities *(include if feature involves data)*

- **PushSubscription**: Represents a user's browser push subscription. Contains push endpoint URL, encryption keys (p256dh, auth), subscription expiration, associated user, and creation timestamp.
- **User (extended)**: Existing user model extended with push subscription relationship. One user may have multiple subscriptions (multiple browsers/devices).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Project owners can enable push notifications with a single click (after browser permission)
- **SC-002**: Push notifications are delivered within 5 seconds of job status change or @mention creation
- **SC-003**: Push notifications appear when user is on a different tab, minimized browser, or different application
- **SC-004**: 100% of terminal job states (COMPLETED, FAILED, CANCELLED) trigger push notifications for subscribed owners
- **SC-005**: 100% of @mentions to subscribed project owners trigger push notifications
- **SC-006**: Clicking a notification navigates to the correct ticket modal within 2 seconds
- **SC-007**: Opt-in prompt dismissal persists across page refreshes (local storage)
- **SC-008**: System handles unsupported browsers gracefully with no visible errors
