# Feature Specification: Sign-In Page Redesign

**Feature Branch**: `041-sign-in-page`
**Created**: 2025-10-22
**Status**: Draft
**Input**: User description: "Sign-in page redesign with header, three OAuth providers (GitHub, GitLab, BitBucket), matching site theme"

## Auto-Resolved Decisions

- **Decision**: OAuth provider availability - GitLab and BitBucket shown as disabled buttons vs hidden entirely
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.85) - User explicitly requested "three possibilities" with GitHub active and others disabled, indicating all three should be visible
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Scope**: Showing disabled buttons increases visual complexity but sets clear expectation for future features
  2. **UX**: Visible disabled options communicate product roadmap and prevent user confusion about missing alternatives
- **Reviewer Notes**: Verify that disabled state provides appropriate visual feedback (grayed out, cursor not-allowed) and includes explanatory tooltip or text

---

- **Decision**: Header behavior on sign-in page - Show marketing variant vs application variant
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.9) - Existing header component has logic to hide on /auth pages; user requests "reprendre le header" (bring back the header)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Consistency**: Showing header aligns with all other pages, improving navigation consistency
  2. **UX**: Header provides branding and potential navigation back to landing page
- **Reviewer Notes**: Confirm whether marketing variant (with "Sign In" button) or minimal variant should be shown; suggest marketing variant without "Sign In" button to avoid circular reference

---

- **Decision**: Sign-in page layout structure - Centered card vs full-width sections
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.85) - User references Vercel's sign-in page which uses centered card design; existing implementation already uses centered card
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Visual Appeal**: Centered card focuses attention and provides better visual hierarchy
  2. **Responsive**: Card design adapts well to mobile and desktop viewports
- **Reviewer Notes**: Verify card width and spacing match design system conventions

---

- **Decision**: Error handling and loading states during OAuth flow
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium (0.65) - Standard OAuth flow considerations, no explicit requirement but essential for production readiness
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **User Experience**: Loading indicators and error messages prevent user confusion during authentication
  2. **Scope**: Adds minimal complexity with standard patterns (spinners, error toasts)
- **Reviewer Notes**: Validate error messages are user-friendly and actionable (e.g., "GitHub authentication failed. Please try again.")

## User Scenarios & Testing

### User Story 1 - GitHub OAuth Sign-In (Priority: P1)

A user visits the sign-in page and authenticates using their GitHub account to access the AI-BOARD platform.

**Why this priority**: Core authentication mechanism and only active OAuth provider; all other features depend on successful sign-in.

**Independent Test**: Can be fully tested by navigating to /auth/signin, clicking "GitHub" button, completing OAuth flow, and landing on the projects dashboard. Delivers immediate value by unblocking platform access.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on /auth/signin, **When** they click the GitHub OAuth button, **Then** they are redirected to GitHub's authorization page
2. **Given** a user completing GitHub OAuth successfully, **When** they are redirected back to the application, **Then** they land on their projects dashboard (/projects)
3. **Given** a user on a protected page (e.g., /projects/1/board), **When** they are redirected to sign-in with callbackUrl, **Then** after successful authentication they return to the original page
4. **Given** an already authenticated user, **When** they navigate to /auth/signin, **Then** they are automatically redirected to their projects dashboard

---

### User Story 2 - Visual Consistency with Site Theme (Priority: P2)

The sign-in page matches the visual design of the rest of the application, providing a cohesive user experience.

**Why this priority**: Essential for professional appearance and brand consistency; does not block authentication functionality but significantly impacts first impression.

**Independent Test**: Can be fully tested by visual inspection of the sign-in page against other pages (landing, dashboard), verifying colors, typography, spacing, and header presence match design system.

**Acceptance Scenarios**:

1. **Given** a user on /auth/signin, **When** they view the page, **Then** the background color matches other pages (dark theme #1e1e2e)
2. **Given** a user viewing the OAuth provider card, **When** they inspect the border, **Then** it uses the site's violet color (#8B5CF6)
3. **Given** a user on /auth/signin, **When** they view the page header, **Then** it displays the same header component as other pages (logo, branding, navigation)
4. **Given** a user on mobile or desktop, **When** they view the sign-in page, **Then** the layout is responsive and maintains visual consistency

---

### User Story 3 - Multiple OAuth Provider Options Display (Priority: P3)

Users see three OAuth provider options (GitHub, GitLab, BitBucket) with clear indication that only GitHub is currently available.

**Why this priority**: Sets expectations for future authentication options and demonstrates product roadmap; purely informational and does not impact current authentication flow.

**Independent Test**: Can be fully tested by viewing the sign-in page and verifying all three provider buttons are present, GitHub is interactive, and GitLab/BitBucket are visually disabled with explanatory text.

**Acceptance Scenarios**:

1. **Given** a user on /auth/signin, **When** they view the OAuth options, **Then** they see three provider buttons: GitHub, GitLab, and BitBucket
2. **Given** a user viewing the OAuth options, **When** they inspect GitLab and BitBucket buttons, **Then** they appear visually disabled (grayed out, reduced opacity)
3. **Given** a user hovering over disabled providers, **When** they interact with the button, **Then** the cursor shows "not-allowed" state and a tooltip explains "Coming soon"
4. **Given** a user attempting to click GitLab or BitBucket, **When** they click, **Then** no action occurs (button is non-interactive)

---

### Edge Cases

- **What happens when GitHub OAuth fails?** User sees error message explaining the failure and is prompted to retry; user remains on sign-in page
- **What happens when OAuth callback URL is manipulated?** System validates callback URL against allowed patterns (internal routes only); malicious URLs are rejected and user redirected to default (/projects)
- **What happens when user cancels GitHub OAuth mid-flow?** User is redirected back to sign-in page with optional message "Authentication cancelled"
- **What happens when network connection fails during OAuth?** User sees error message indicating connection issue and retry option
- **What happens when GitLab/BitBucket support is added in future?** Buttons transition from disabled to enabled state; no structural changes needed to page layout

## Requirements

### Functional Requirements

- **FR-001**: Sign-in page MUST display application header with logo, branding, and navigation consistent with other pages
- **FR-002**: Sign-in page MUST use dark background (#1e1e2e) matching site theme
- **FR-003**: Sign-in page MUST display authentication card with violet border (#8B5CF6)
- **FR-004**: System MUST provide GitHub OAuth authentication as active option
- **FR-005**: Sign-in page MUST display GitLab OAuth option in disabled state (non-interactive, visually grayed)
- **FR-006**: Sign-in page MUST display BitBucket OAuth option in disabled state (non-interactive, visually grayed)
- **FR-007**: Disabled OAuth providers MUST show explanatory text or tooltip indicating "Coming soon" status
- **FR-008**: System MUST redirect authenticated users attempting to access /auth/signin to their projects dashboard
- **FR-009**: System MUST preserve callbackUrl parameter through OAuth flow to return users to original destination
- **FR-010**: System MUST display loading indicator during OAuth authentication process
- **FR-011**: System MUST display user-friendly error messages when OAuth authentication fails
- **FR-012**: Sign-in page MUST be fully responsive across mobile, tablet, and desktop viewports
- **FR-013**: OAuth buttons MUST use appropriate provider icons and branding colors (GitHub, GitLab, BitBucket)
- **FR-014**: Sign-in page MUST maintain accessibility standards (ARIA labels, keyboard navigation, focus states)

### Key Entities

- **OAuth Provider**: Represents authentication service (GitHub, GitLab, BitBucket) with attributes: provider name, icon, enabled status, authorization URL
- **Authentication Session**: Represents user authentication state with attributes: user ID, session token, expiration, OAuth provider used
- **Callback URL**: Represents destination after successful authentication with attributes: original path, validation status, fallback route

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can complete GitHub OAuth sign-in in under 10 seconds (excluding external GitHub authorization time)
- **SC-002**: Sign-in page loads in under 2 seconds on standard broadband connection
- **SC-003**: 95% of users successfully complete authentication on first attempt without errors
- **SC-004**: Visual consistency audit shows 100% compliance with design system (colors, typography, spacing)
- **SC-005**: Accessibility audit achieves WCAG 2.1 AA compliance (keyboard navigation, screen reader support, color contrast)
- **SC-006**: Authenticated users attempting to access sign-in page are redirected to dashboard in under 500ms
- **SC-007**: Sign-in page renders correctly across 5 major browsers (Chrome, Firefox, Safari, Edge, mobile Safari)
- **SC-008**: Zero user-reported confusion about disabled OAuth providers (clear visual feedback and messaging)
