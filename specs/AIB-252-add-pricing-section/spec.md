# Feature Specification: Add Pricing Section to Landing Page & Footer

**Feature Branch**: `AIB-252-add-pricing-section`
**Created**: 2026-03-11
**Status**: Draft
**Input**: User description: "Add a pricing section and enhance footer on the landing page"

## Auto-Resolved Decisions

- **Decision**: Plan data displayed on the landing page pricing section must match the existing billing plan definitions (Free at $0/mo, Pro at $15/mo, Team at $30/mo) rather than introducing separate marketing-only pricing.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) -- plan pricing is already defined in the system and must remain consistent to avoid misleading users.
- **Fallback Triggered?**: Yes -- AUTO policy scored low confidence (netScore=+1, absScore=1, confidence=0.3) due to neutral feature context with no strong signals. Promoted to CONSERVATIVE per fallback rules.
- **Trade-offs**:
  1. Ensures pricing accuracy and consistency across the application; no risk of marketing/billing mismatch.
  2. No additional timeline cost -- reuses existing plan data rather than creating separate definitions.
- **Reviewer Notes**: Verify that the plan features displayed on the landing page align with the current billing plan capabilities. If marketing wants to highlight different features than what the billing system tracks, that would require a separate ticket.

---

- **Decision**: FAQ section will cover two topics: (1) what BYOK (Bring Your Own Key) means and why it is required for the Free plan, and (2) which AI agents/models are supported by the platform.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.8) -- the ticket description explicitly mentions "BYOK, quels agents supportes" as FAQ topics.
- **Fallback Triggered?**: Yes -- same AUTO-to-CONSERVATIVE fallback as above.
- **Trade-offs**:
  1. Covers the two most common pre-purchase questions; additional FAQ items can be added in future iterations.
  2. Minimal scope -- only two FAQ entries keeps the section lightweight and fast to implement.
- **Reviewer Notes**: Review FAQ answers for accuracy before launch. Confirm the list of supported agents is current.

---

- **Decision**: The existing footer component already contains Terms of Service and Privacy Policy links plus copyright. This feature will enhance it by adding a GitHub repository link, and ensure the footer is rendered on the landing page (it already appears on legal pages).
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.85) -- a footer component already exists; the ticket asks for GitHub link, legal links, and copyright, most of which are already present.
- **Fallback Triggered?**: Yes -- same AUTO-to-CONSERVATIVE fallback.
- **Trade-offs**:
  1. Builds on existing component rather than creating a duplicate, maintaining consistency.
  2. Minimal effort -- only additive changes to an existing component.
- **Reviewer Notes**: Confirm the correct GitHub repository URL to link to. Verify the footer renders correctly on both the landing page and legal pages.

---

- **Decision**: The pricing section will use a collapsible/accordion pattern for the FAQ to keep the page compact, with questions visible and answers expandable.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) -- "FAQ minimaliste" suggests a compact presentation; collapsible is the standard UX pattern for FAQs.
- **Fallback Triggered?**: Yes -- same AUTO-to-CONSERVATIVE fallback.
- **Trade-offs**:
  1. Collapsible FAQ keeps the section clean; users who want details can expand. Standard usability pattern.
  2. No significant cost -- the existing UI component library provides accordion components.
- **Reviewer Notes**: If a flat (always-visible) FAQ is preferred over collapsible, adjust during implementation.

## User Scenarios & Testing

### User Story 1 - View and Compare Pricing Plans (Priority: P1)

A visitor lands on the homepage and scrolls to the pricing section to understand what plans are available, what features each includes, and how much they cost. They can quickly compare the three tiers (Free, Pro, Team) side by side and decide which plan fits their needs.

**Why this priority**: The pricing section is the primary conversion driver. Users need clear, accurate plan information to make a purchase decision. Without this, the landing page cannot effectively convert visitors to paying customers.

**Independent Test**: Can be tested by navigating to the landing page, scrolling to the pricing section, and verifying that all three plan cards display correct names, prices, features, and call-to-action buttons.

**Acceptance Scenarios**:

1. **Given** a visitor is on the landing page, **When** they scroll past the workflow section, **Then** they see a pricing section with three plan cards displayed side by side (on desktop) or stacked (on mobile).
2. **Given** the pricing section is visible, **When** a visitor reads the Free plan card, **Then** they see the plan name, "$0/month" price, feature list (1 project, 5 tickets/month, BYOK API key required), and a "Get Started" button.
3. **Given** the pricing section is visible, **When** a visitor reads the Pro plan card, **Then** they see the plan name, "$15/month" price, feature list (unlimited projects, unlimited tickets, 14-day free trial), a "Start 14-day trial" button, and a visual indicator that this is the most popular plan.
4. **Given** the pricing section is visible, **When** a visitor reads the Team plan card, **Then** they see the plan name, "$30/month" price, feature list (everything in Pro, project members, advanced analytics, 14-day free trial), and a "Start 14-day trial" button.

---

### User Story 2 - Click Pricing CTA to Sign Up or Start Trial (Priority: P1)

A visitor decides on a plan and clicks the corresponding call-to-action button. Free plan users are directed to sign up. Pro and Team plan users are directed to start a 14-day trial.

**Why this priority**: CTAs are the conversion mechanism. Without functional buttons, the pricing section is informational but not actionable.

**Independent Test**: Can be tested by clicking each plan's CTA button and verifying navigation to the appropriate sign-up or trial flow.

**Acceptance Scenarios**:

1. **Given** a visitor clicks "Get Started" on the Free plan card, **When** the navigation completes, **Then** they are directed to the sign-up page.
2. **Given** a visitor clicks "Start 14-day trial" on the Pro plan card, **When** the navigation completes, **Then** they are directed to the sign-up page (trial activation occurs after account creation).
3. **Given** a visitor clicks "Start 14-day trial" on the Team plan card, **When** the navigation completes, **Then** they are directed to the sign-up page (trial activation occurs after account creation).

---

### User Story 3 - Read Pricing FAQ (Priority: P2)

A visitor has questions about the platform before committing. They scroll below the pricing cards to find a short FAQ section that answers common pre-purchase questions about BYOK and supported agents.

**Why this priority**: FAQ reduces friction for users on the fence. It addresses objections without requiring them to contact support, but is secondary to the pricing cards themselves.

**Independent Test**: Can be tested by scrolling below the pricing cards and verifying the FAQ section displays questions with expandable answers.

**Acceptance Scenarios**:

1. **Given** a visitor is viewing the pricing section, **When** they scroll below the plan cards, **Then** they see a FAQ subsection with at least two questions visible.
2. **Given** the FAQ is visible, **When** a visitor clicks on a question about BYOK, **Then** the answer expands to explain what BYOK means and why the Free plan requires users to bring their own API key.
3. **Given** the FAQ is visible, **When** a visitor clicks on a question about supported agents, **Then** the answer expands to list the AI agents/models supported by the platform.

---

### User Story 4 - See Footer on Public Pages (Priority: P2)

A visitor scrolling to the bottom of the landing page (or any legal page) sees a footer with links to Terms of Service, Privacy Policy, and the GitHub repository, along with a copyright notice.

**Why this priority**: The footer provides essential legal compliance links and builds trust. It is important but less critical than the pricing section for conversion.

**Independent Test**: Can be tested by scrolling to the bottom of the landing page and each legal page, verifying the footer is visible with all expected links.

**Acceptance Scenarios**:

1. **Given** a visitor is on the landing page, **When** they scroll to the bottom, **Then** they see a footer containing links to Terms of Service, Privacy Policy, and GitHub repository, plus a copyright notice.
2. **Given** a visitor is on the Terms of Service page, **When** they scroll to the bottom, **Then** the same footer is visible.
3. **Given** a visitor is on the Privacy Policy page, **When** they scroll to the bottom, **Then** the same footer is visible.
4. **Given** a visitor clicks the GitHub link in the footer, **When** the link opens, **Then** it navigates to the project's GitHub repository in a new tab.

---

### User Story 5 - Responsive Pricing Display (Priority: P2)

A visitor accesses the landing page on a mobile device. The pricing cards stack vertically and remain readable. The FAQ section and footer adapt to the smaller screen.

**Why this priority**: Mobile responsiveness ensures the landing page works for all visitors regardless of device, but is a quality concern rather than a core feature.

**Independent Test**: Can be tested by viewing the landing page at mobile viewport widths and verifying layout adapts correctly.

**Acceptance Scenarios**:

1. **Given** a visitor views the landing page on a mobile device (viewport < 768px), **When** they scroll to the pricing section, **Then** the plan cards are stacked vertically in a single column.
2. **Given** a mobile visitor views the pricing section, **When** they read any plan card, **Then** all text, prices, features, and CTA buttons are fully visible without horizontal scrolling.
3. **Given** a mobile visitor scrolls to the footer, **When** they view the footer, **Then** links are arranged vertically or wrapped appropriately for the screen width.

### Edge Cases

- What happens when plan pricing changes in the billing system? The landing page pricing section must reflect current plan data, not hardcoded values.
- What happens if the GitHub repository URL is not configured? The footer should still render with available links; the GitHub link can be omitted gracefully.
- How does the pricing section appear when the visitor is already authenticated? The section remains the same -- the landing page is public-facing with no auth state awareness.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a pricing section on the landing page positioned after the workflow section and before the final call-to-action section.
- **FR-002**: The pricing section MUST show exactly three plan cards: Free, Pro, and Team.
- **FR-003**: Each plan card MUST display the plan name, monthly price, a list of included features, and a call-to-action button.
- **FR-004**: The Free plan card MUST display a "Get Started" button; Pro and Team plan cards MUST display "Start 14-day trial" buttons.
- **FR-005**: The Pro plan card MUST be visually distinguished as the recommended/most popular option.
- **FR-006**: All pricing CTA buttons MUST navigate the visitor to the sign-up page.
- **FR-007**: A FAQ subsection MUST appear below the pricing cards with at least two questions: one about BYOK and one about supported agents.
- **FR-008**: FAQ answers MUST be expandable/collapsible (not all visible at once).
- **FR-009**: The footer MUST display links to Terms of Service, Privacy Policy, and the GitHub repository, plus a copyright notice.
- **FR-010**: The footer MUST be visible on all public pages: the landing page and all legal pages.
- **FR-011**: The GitHub repository link in the footer MUST open in a new browser tab.
- **FR-012**: The pricing section and footer MUST be fully responsive, adapting layout for mobile, tablet, and desktop viewports.
- **FR-013**: The pricing section and footer MUST be consistent with the existing dark-theme design system used on the landing page.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of landing page visitors can view all three pricing plans without horizontal scrolling on any device viewport (320px to 1920px+).
- **SC-002**: All pricing CTA buttons successfully navigate to the sign-up page within 1 second of clicking.
- **SC-003**: FAQ questions are expandable/collapsible with a single click, and answer content is visible within 300ms of interaction.
- **SC-004**: Footer is visible on 100% of public pages (landing, terms of service, privacy policy).
- **SC-005**: Pricing data displayed on the landing page matches the billing system plan definitions with zero discrepancies.
- **SC-006**: The pricing section passes accessibility checks (sufficient color contrast, keyboard navigable, screen reader compatible).
