# Feature Specification: Profile Settings Page

**Feature Branch**: `AIB-467-copy-of-create`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Create profile settings page — read-only display of user account information from GitHub OAuth"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Scope limited to read-only profile display (no delete account)

- **Decision**: The platform-opening-design Section 8 includes both "Profile Page" and "Delete Account" in the same section. This ticket covers only the read-only profile display. Delete account functionality is a separate concern (referenced as Ticket 18 in the design doc).
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence due to neutral feature context)
- **Confidence**: Low (score: 1) — feature is straightforward but AUTO scoring yielded absScore < 3
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE due to confidence < 0.5
- **Trade-offs**:
  1. Clean separation of concerns; profile display ships independently of destructive delete flow
  2. No additional timeline cost — delete account is already scoped as a follow-up ticket
- **Reviewer Notes**: Confirm that delete account remains out of scope for this ticket and will be addressed in a subsequent ticket

### Decision 2: GitHub username sourced from linked OAuth account

- **Decision**: The user's GitHub username and profile link will be derived from their linked OAuth account data (the Account relation on the User model), not from a separate field on the User model.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the existing data model stores OAuth provider account info in the Account table, and no alternative source exists
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Accurate GitHub identity from the authoritative OAuth source
  2. Requires querying the Account relation in addition to the User record
- **Reviewer Notes**: Verify that the Account model stores the GitHub username or profile URL in its provider-specific fields

### Decision 3: Settings navigation added to all settings entry points

- **Decision**: "Profile" will be added as the first item in all places where settings navigation links appear (currently the mobile menu and any desktop navigation). The navigation order will be: Profile, AI Credentials, Access Tokens, Billing.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the ticket description explicitly defines this order, and the platform-opening-design Section 8 confirms it
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent navigation across all breakpoints
  2. Minimal change to existing navigation components
- **Reviewer Notes**: Ensure the navigation label matches existing conventions ("Profile" vs "Account")

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Profile Information (Priority: P1)

A logged-in user navigates to the Profile settings page to see their account information. They see their GitHub avatar, display name, email address, linked GitHub account, registration date, and current subscription plan — all presented as read-only information.

**Why this priority**: This is the core value of the feature. Users need a single place to review their account details.

**Independent Test**: Can be fully tested by navigating to `/settings/profile` as an authenticated user and verifying all profile fields are displayed correctly.

**Acceptance Scenarios**:

1. **Given** an authenticated user with a GitHub OAuth account, **When** they navigate to `/settings/profile`, **Then** they see their circular avatar image, display name, email, GitHub username (as a link to their GitHub profile), formatted registration date, and current plan name.
2. **Given** an authenticated user whose GitHub account has no avatar set, **When** they visit the profile page, **Then** a fallback avatar (initials) is displayed instead of a broken image.
3. **Given** an authenticated user on a FREE plan, **When** they view their current plan on the profile page, **Then** the plan name is shown with a link to the billing settings page.

---

### User Story 2 - Navigate to Profile from Settings Menu (Priority: P2)

A user opens the settings menu (mobile or desktop) and sees "Profile" as the first item. They tap/click it to navigate to the profile page.

**Why this priority**: Discoverability — users must be able to find the profile page through the existing navigation.

**Independent Test**: Can be tested by opening the navigation menu and verifying "Profile" appears first in the settings section, and clicking it navigates to `/settings/profile`.

**Acceptance Scenarios**:

1. **Given** an authenticated user on mobile, **When** they open the mobile menu, **Then** they see "Profile" as the first settings link above "AI Credentials", "Access Tokens", and "Billing".
2. **Given** an authenticated user on desktop, **When** they access the settings navigation, **Then** "Profile" appears as the first item in the settings list.

---

### User Story 3 - Responsive Profile Page (Priority: P3)

A user views their profile on a mobile device. The layout adapts to the smaller screen without horizontal scrolling or content overflow.

**Why this priority**: Mobile usability is important but secondary to core functionality.

**Independent Test**: Can be tested by viewing `/settings/profile` at various viewport widths (mobile, tablet, desktop) and verifying the layout remains usable.

**Acceptance Scenarios**:

1. **Given** a user on a mobile device (viewport < 768px), **When** they view the profile page, **Then** all profile information is visible without horizontal scrolling and text is readable.
2. **Given** a user on a desktop device, **When** they view the profile page, **Then** the content is centered with a max-width container consistent with other settings pages.

---

### Edge Cases

- What happens when a user's email is null (GitHub account with private email)? Display "Not available" or similar placeholder text.
- What happens when the user's name is null? Display the GitHub username as the display name fallback.
- What happens when the session data is unavailable or loading? Show a loading skeleton consistent with other settings pages.
- What happens when a user has no subscription record? Display "Free" as the default plan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display the user's profile page at the `/settings/profile` route, accessible only to authenticated users.
- **FR-002**: System MUST display the user's avatar as a circular image sourced from their GitHub OAuth account, with an initials fallback when no image is available.
- **FR-003**: System MUST display the user's display name from their account, with a fallback to their GitHub username if the name is not set.
- **FR-004**: System MUST display the user's email address.
- **FR-005**: System MUST display the user's linked GitHub account as their username, rendered as a clickable link to their GitHub profile.
- **FR-006**: System MUST display the user's registration date in a human-readable format (e.g., "April 1, 2026").
- **FR-007**: System MUST display the user's current subscription plan name with a navigational link to the billing settings page (`/settings/billing`).
- **FR-008**: All profile information MUST be read-only — no edit forms or inline editing capabilities.
- **FR-009**: System MUST add "Profile" as the first item in the settings navigation menu, with the updated order: Profile, AI Credentials, Access Tokens, Billing.
- **FR-010**: The profile page MUST use the same visual styling conventions as existing settings pages (aurora theme, consistent spacing, icons).
- **FR-011**: The profile page MUST be responsive and usable on mobile, tablet, and desktop viewports.

### Key Entities *(include if feature involves data)*

- **User**: Core account record — provides name, email, image (avatar URL), and createdAt (registration date). No new fields required.
- **Account**: OAuth provider link — provides the GitHub username and profile URL for the linked account display.
- **Subscription**: Billing record — provides the current plan name (FREE/PRO/TEAM) for display on the profile page.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all six profile fields (avatar, name, email, GitHub link, registration date, plan) on a single page within 2 seconds of navigation.
- **SC-002**: Profile page is accessible and fully functional on viewports from 320px to 1920px wide without horizontal scrolling.
- **SC-003**: "Profile" link is discoverable as the first item in settings navigation on both mobile and desktop.
- **SC-004**: 100% of profile data fields display gracefully when source data is missing (null/empty), showing appropriate fallback text instead of blank spaces or errors.
- **SC-005**: The profile page requires zero user input — all information is populated automatically from the user's existing account data.
