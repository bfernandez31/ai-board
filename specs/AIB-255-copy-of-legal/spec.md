# Feature Specification: Legal Pages - Terms of Service & Privacy Policy

**Feature Branch**: `AIB-255-copy-of-legal`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Add mandatory legal pages (Terms of Service & Privacy Policy) for a publicly accessible SaaS. Pages must be public, linked from footer and sign-in page, in English."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Page URL structure — resolved to `/legal/terms` and `/legal/privacy` grouped under a `/legal` namespace
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 8) — strong compliance signals from legal/GDPR keywords
- **Fallback Triggered?**: No — AUTO resolved with high confidence to CONSERVATIVE
- **Trade-offs**:
  1. Clean URL namespace groups all legal content; easy to add future legal pages (e.g., cookie policy)
  2. No additional routing overhead — simple static pages
- **Reviewer Notes**: Confirm `/legal/` prefix aligns with branding and SEO expectations

---

- **Decision**: Consent mechanism at sign-in — resolved to informational links ("By signing in, you agree to...") rather than a mandatory checkbox
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 8) — ticket specifies "lien affiche avant le premier sign-up (consentement)" which indicates visible links, not a blocking checkbox
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Informational consent is standard for OAuth-based sign-in flows and reduces friction
  2. A mandatory checkbox would provide stronger legal protection but adds UX friction and is not standard for OAuth sign-in
- **Reviewer Notes**: For stricter jurisdictions or future compliance needs, consider upgrading to a checkbox-based consent flow

---

- **Decision**: Content management approach — resolved to static page content embedded in source code rather than CMS or database-managed content
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 8) — ticket explicitly states "pas besoin d'un avocat pour un MVP/test" indicating a simple, static approach is appropriate
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Static content is simple, fast to load, and version-controlled with the codebase
  2. Content updates require code changes and redeployment rather than a CMS edit
- **Reviewer Notes**: If legal content needs frequent updates by non-developers, consider extracting to a CMS in a future iteration

---

- **Decision**: Footer placement — resolved to a global footer component visible on all pages (public and authenticated)
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score: 8) — ticket says "Lien dans le footer de toutes les pages"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Global footer ensures legal links are always accessible regardless of user state
  2. Adds a new layout element to every page; minimal visual impact if designed unobtrusively
- **Reviewer Notes**: Verify footer does not interfere with existing page layouts, especially full-height views

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Terms of Service (Priority: P1)

As an unauthenticated visitor, I want to read the Terms of Service so that I understand the conditions for using the platform before signing up.

**Why this priority**: Legal compliance is the primary driver. Terms of Service must be accessible before any user interaction or account creation.

**Independent Test**: Can be fully tested by navigating to the Terms of Service URL without being logged in and verifying all required content sections are visible.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they navigate to the Terms of Service page, **Then** the full Terms of Service content is displayed without requiring authentication
2. **Given** a visitor is on the Terms of Service page, **When** they scroll through the content, **Then** all sections are readable with clear headings including: conditions of use, limitation of liability, BYOK API cost responsibility, and AI-generated code responsibility
3. **Given** a visitor is on any page, **When** they click the "Terms of Service" link in the footer, **Then** they are taken to the Terms of Service page

---

### User Story 2 - View Privacy Policy (Priority: P1)

As an unauthenticated visitor, I want to read the Privacy Policy so that I understand how my data is collected and used before I share any personal information.

**Why this priority**: Privacy Policy is equally critical for legal compliance, especially under GDPR. Must be accessible before sign-up.

**Independent Test**: Can be fully tested by navigating to the Privacy Policy URL without being logged in and verifying all required content sections are visible.

**Acceptance Scenarios**:

1. **Given** a visitor is not signed in, **When** they navigate to the Privacy Policy page, **Then** the full Privacy Policy content is displayed without requiring authentication
2. **Given** a visitor is on the Privacy Policy page, **When** they read the content, **Then** all required sections are present: data collected (GitHub profile, email), cookies (NextAuth session cookies), no data resale statement, and GDPR rights (right to deletion)
3. **Given** a visitor is on any page, **When** they click the "Privacy Policy" link in the footer, **Then** they are taken to the Privacy Policy page

---

### User Story 3 - Legal Links on Sign-In Page (Priority: P1)

As a new user about to sign in for the first time, I want to see links to the Terms of Service and Privacy Policy on the sign-in page so that I can review them before creating an account.

**Why this priority**: Displaying consent-related links at the point of sign-up is a legal requirement for transparency. Without this, users cannot give informed consent.

**Independent Test**: Can be fully tested by navigating to the sign-in page (without being logged in) and verifying that Terms of Service and Privacy Policy links are visible and functional.

**Acceptance Scenarios**:

1. **Given** a user is on the sign-in page, **When** the page loads, **Then** a consent notice with links to Terms of Service and Privacy Policy is displayed (e.g., "By signing in, you agree to our Terms of Service and Privacy Policy")
2. **Given** a user is on the sign-in page, **When** they click the Terms of Service link in the consent notice, **Then** they are navigated to the Terms of Service page
3. **Given** a user is on the sign-in page, **When** they click the Privacy Policy link in the consent notice, **Then** they are navigated to the Privacy Policy page

---

### User Story 4 - Footer with Legal Links (Priority: P2)

As any user (authenticated or not), I want a footer with legal links on every page so that I can always access the legal information.

**Why this priority**: The footer provides persistent access to legal pages across the entire application, supporting ongoing compliance.

**Independent Test**: Can be fully tested by visiting multiple pages (landing, sign-in, dashboard) and verifying the footer with legal links is present on all of them.

**Acceptance Scenarios**:

1. **Given** a visitor is on any public page (landing, sign-in, legal pages), **When** they scroll to the bottom, **Then** a footer with links to Terms of Service and Privacy Policy is visible
2. **Given** an authenticated user is on any application page, **When** they scroll to the bottom, **Then** the same footer with legal links is visible
3. **Given** a user is on a mobile device, **When** they view any page, **Then** the footer is responsive and legal links are accessible

---

### Edge Cases

- What happens when a user accesses a legal page URL with a trailing slash or incorrect casing? The system should handle URL normalization gracefully (Next.js default behavior).
- How does the legal page display on very small screens? Content must remain readable and scrollable on mobile devices.
- What happens if a user bookmarks a legal page and returns later after content is updated? The page should always show the latest version with the effective date visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Terms of Service page accessible at a public URL without requiring authentication
- **FR-002**: System MUST provide a Privacy Policy page accessible at a public URL without requiring authentication
- **FR-003**: The Terms of Service MUST include sections covering: conditions of use, limitation of liability, BYOK model (user responsibility for API costs), and AI-generated code responsibility disclaimer
- **FR-004**: The Privacy Policy MUST include sections covering: data collected (GitHub profile, email), cookies used (NextAuth session cookies), no data resale commitment, and GDPR rights (including right to request data deletion)
- **FR-005**: System MUST display a footer on all pages (public and authenticated) containing links to Terms of Service and Privacy Policy
- **FR-006**: System MUST display a consent notice on the sign-in page with links to Terms of Service and Privacy Policy, visible before any sign-in action
- **FR-007**: All legal content MUST be written in English
- **FR-008**: Each legal page MUST display an effective date indicating when the content was last updated
- **FR-009**: Legal pages MUST be responsive and readable on all device sizes (mobile, tablet, desktop)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All legal pages load successfully and display full content within 2 seconds for unauthenticated users
- **SC-002**: 100% of application pages display a footer with functional links to both legal pages
- **SC-003**: The sign-in page displays consent links that correctly navigate to both legal pages
- **SC-004**: Legal pages are accessible on mobile, tablet, and desktop viewports without horizontal scrolling or unreadable text
- **SC-005**: All legal content sections specified in the requirements (FR-003, FR-004) are present and readable

### Assumptions

- The application name used in legal content will match the current product name ("ai-board")
- Contact information for data deletion requests will use a generic contact method (e.g., email address or GitHub issue)
- Legal content is a reasonable MVP version and is not reviewed by legal counsel
- The footer is a new component that does not currently exist in the application
- No cookie consent banner is required at this stage (only session cookies are used, which are exempt under most cookie laws)
