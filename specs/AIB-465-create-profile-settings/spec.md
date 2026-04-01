# Feature Specification: Create Profile Settings Page

**Feature Branch**: `AIB-465-create-profile-settings`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Create profile settings page — a read-only `/settings/profile` page displaying user account information from GitHub OAuth, added as the first item in settings navigation."

## Auto-Resolved Decisions

- **Decision**: Scope limited to read-only profile display only — delete account functionality (referenced in platform-opening-design.md Section 8) is excluded from this ticket
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — ticket explicitly states "Read-only — no edit forms" and does not mention delete account
- **Fallback Triggered?**: Yes — AUTO confidence was Low (0.3, absScore=1), promoted to CONSERVATIVE
- **Trade-offs**:
  1. Keeps scope tight and deliverable; delete account can be a separate ticket
  2. No impact on timeline — avoids scope creep
- **Reviewer Notes**: Delete account flow from Section 8 of platform-opening-design.md should be tracked as a separate ticket

---

- **Decision**: GitHub username for "Linked GitHub account" will be retrieved from the Account provider record or derived from the user's GitHub OAuth data stored at sign-in time
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — the existing Account model stores GitHub OAuth tokens and the user-service captures login/username at sign-in
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Relies on data already captured during OAuth sign-in; no additional API calls needed
  2. If the user changes their GitHub username after sign-in, the displayed name may be stale until next login
- **Reviewer Notes**: Verify that GitHub username is persisted in a retrievable field (Account record or User name field)

---

- **Decision**: Registration date displayed using locale-aware formatting (e.g., "March 15, 2026") without showing exact time
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — no specific format requested; date-only is standard for profile pages
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clean, user-friendly display; consistent with common profile page patterns
  2. Users who want exact timestamps won't see them (low impact)
- **Reviewer Notes**: Formatting choice is cosmetic; adjust if design system conventions differ

## User Scenarios & Testing

### User Story 1 - View Profile Information (Priority: P1)

As an authenticated user, I want to see my account information on a dedicated profile page so I can verify my identity and account details at a glance.

**Why this priority**: This is the core purpose of the feature — without profile information display, the page has no value.

**Independent Test**: Can be fully tested by navigating to `/settings/profile` after sign-in and verifying all user fields (avatar, name, email, GitHub link, registration date, current plan) are displayed correctly.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they navigate to `/settings/profile`, **Then** they see their GitHub avatar displayed as a circular image, their display name, email address, linked GitHub username (as a clickable link to their GitHub profile), registration date (formatted), and current subscription plan
2. **Given** a signed-in user with a FREE plan, **When** they view their profile, **Then** the current plan section shows "Free" with a link to billing settings (`/settings/billing`)
3. **Given** a signed-in user with a PRO or TEAM plan, **When** they view their profile, **Then** the current plan section shows the correct plan name with a link to billing settings
4. **Given** an unauthenticated user, **When** they attempt to access `/settings/profile`, **Then** they are redirected to the sign-in page

---

### User Story 2 - Navigate to Profile from Settings Menu (Priority: P1)

As an authenticated user, I want to find the Profile page easily in the settings navigation so I can access my account information without searching.

**Why this priority**: Navigation discoverability is essential for users to find and use the profile page — equally critical as the page content itself.

**Independent Test**: Can be tested by opening the settings menu/user dropdown and verifying "Profile" appears as the first item, linking to `/settings/profile`.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the settings navigation, **Then** "Profile" appears as the first menu item, above "AI Credentials", "Access Tokens", and "Billing"
2. **Given** a signed-in user on the profile page, **When** they click another settings menu item, **Then** they navigate to that settings page and can return to Profile

---

### User Story 3 - Responsive Profile Page (Priority: P2)

As a user on a mobile device, I want the profile page to display correctly on smaller screens so I can view my account information from any device.

**Why this priority**: Responsive layout ensures accessibility across devices but is secondary to core content and navigation.

**Independent Test**: Can be tested by viewing `/settings/profile` on mobile viewport sizes and verifying all content is readable and properly laid out.

**Acceptance Scenarios**:

1. **Given** a signed-in user on a mobile device (viewport < 768px), **When** they view the profile page, **Then** all profile information is displayed in a single-column layout without horizontal scrolling
2. **Given** a signed-in user on a tablet or desktop, **When** they view the profile page, **Then** the layout uses available space effectively and maintains visual consistency with other settings pages

---

### Edge Cases

- What happens when the user's GitHub avatar URL is unavailable or returns an error? A fallback placeholder (initials or generic icon) should be displayed.
- What happens when the user's name is null (GitHub allows no display name)? The page should gracefully handle missing optional fields by showing the email or a "Not set" indicator.
- What happens when the user has no subscription record? The plan should default to displaying "Free".

## Requirements

### Functional Requirements

- **FR-001**: System MUST display the authenticated user's GitHub avatar as a circular image on the profile page
- **FR-002**: System MUST display the user's display name on the profile page
- **FR-003**: System MUST display the user's email address on the profile page
- **FR-004**: System MUST display the user's linked GitHub username as a clickable link that opens their GitHub profile in a new tab
- **FR-005**: System MUST display the user's registration date in a human-readable, locale-aware format
- **FR-006**: System MUST display the user's current subscription plan with a link to the billing settings page
- **FR-007**: System MUST present all profile information as read-only — no edit forms or input fields
- **FR-008**: System MUST add "Profile" as the first item in the settings navigation menu, before existing items (AI Credentials, Access Tokens, Billing)
- **FR-009**: System MUST redirect unauthenticated users away from the profile page to the sign-in flow
- **FR-010**: System MUST handle missing optional fields (name, avatar) gracefully with appropriate fallbacks
- **FR-011**: System MUST render the profile page responsively across mobile, tablet, and desktop viewports
- **FR-012**: System MUST use the aurora theme styling consistent with existing settings pages

### Key Entities

- **User**: The authenticated user whose profile is displayed. Key attributes: avatar image, display name, email, registration date. Source: existing User model and GitHub OAuth data.
- **Account**: The linked GitHub OAuth account providing the GitHub username. Source: existing Account model.
- **Subscription**: The user's current billing plan (FREE/PRO/TEAM). Source: existing Subscription model.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view all six profile fields (avatar, name, email, GitHub link, registration date, plan) within 2 seconds of navigating to the profile page
- **SC-002**: 100% of profile page content is accessible and readable on viewports from 320px to 1920px wide without horizontal scrolling
- **SC-003**: Users can navigate to the profile page from the settings menu in a single click
- **SC-004**: Profile page maintains WCAG AA contrast requirements (4.5:1 minimum) for all text content
- **SC-005**: All profile data accurately reflects the user's current account state as stored in the system
