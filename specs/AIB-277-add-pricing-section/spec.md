# Feature Specification: Add Pricing Section to Landing Page

**Feature Branch**: `AIB-277-add-pricing-section`
**Created**: 2026-03-12
**Status**: Draft
**Input**: User description: "Add a pricing section with 3 plan cards (Free/Pro/Team), plan-specific CTAs, and a minimalist FAQ to the landing page. Position after WorkflowSection and before CTASection."

## Auto-Resolved Decisions

- **Decision**: Footer modification scope — the ticket title mentions "& footer" but the description only specifies landing page pricing section changes. Resolved to scope this ticket to the landing page pricing section only; footer changes are excluded.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (0.3) — title and description conflict on footer scope; no detail provided for footer work.
- **Fallback Triggered?**: Yes — AUTO netScore -1 with absScore 1 yielded confidence 0.3 (below 0.5 threshold), promoted to CONSERVATIVE.
- **Trade-offs**:
  1. Keeps scope focused and deliverable; footer pricing link can be a follow-up ticket if needed.
  2. No wasted effort on undefined footer requirements.
- **Reviewer Notes**: If footer changes (e.g., adding a "Pricing" link in the footer navigation) are desired, create a separate ticket with detailed requirements.

---

- **Decision**: Plan features and pricing data source — resolved to use the existing plan configuration already defined in the system (Free: $0, Pro: $15/mo, Team: $30/mo) as the single source of truth for the pricing cards.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: High (0.9) — plan data already exists in the codebase and matches the ticket's 3-card requirement exactly.
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE, but decision is unambiguous regardless.
- **Trade-offs**:
  1. Ensures pricing consistency between the landing page and the authenticated billing page.
  2. Any future price changes automatically reflect on the landing page.
- **Reviewer Notes**: Verify that the feature lists shown on the landing page are appropriate for a marketing context (may differ slightly from the technical limits shown on the billing settings page).

---

- **Decision**: FAQ content scope — the ticket mentions "BYOK" and "supported agents (claude/codex)". Resolved to include a compact FAQ section with 3-4 questions covering: what BYOK means, which AI agents are supported, trial details, and plan switching.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Medium (0.6) — ticket explicitly names two FAQ topics; the remaining topics are standard pricing FAQ items.
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE.
- **Trade-offs**:
  1. Covers the two explicitly requested topics plus common pricing questions users would expect.
  2. Keeping to 3-4 questions maintains the "minimalist" requirement from the ticket.
- **Reviewer Notes**: Confirm the exact FAQ answers align with current product capabilities and marketing messaging.

---

- **Decision**: CTA button destinations — Free plan "Get Started" links to sign-up/sign-in; Pro/Team "Start 14-day trial" links to sign-up/sign-in (unauthenticated users cannot directly start checkout).
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: High (0.9) — landing page is for unauthenticated visitors; checkout requires authentication first.
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE, but decision is clear from existing auth patterns.
- **Trade-offs**:
  1. Simple, consistent flow: all CTAs direct to authentication, then users can subscribe from the billing settings page.
  2. No need for complex plan-specific checkout deep links on the public landing page.
- **Reviewer Notes**: Consider adding query parameters to the sign-in URL (e.g., `?plan=PRO`) so the post-login experience can direct users to the relevant plan checkout. This is a nice-to-have enhancement, not a blocker.

## User Scenarios & Testing

### User Story 1 - View Pricing Plans on Landing Page (Priority: P1)

A visitor arrives at the landing page and scrolls down to compare available plans. They see three clearly differentiated pricing cards (Free, Pro, Team) with pricing, features, and a call-to-action button for each plan. The pricing section appears between the workflow showcase and the final call-to-action.

**Why this priority**: This is the core deliverable of the ticket — without visible pricing cards, the feature has no value.

**Independent Test**: Can be fully tested by loading the landing page and verifying three pricing cards are visible with correct plan names, prices, features, and CTA buttons.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they scroll past the workflow section, **Then** they see a pricing section with three plan cards displayed side by side on desktop.
2. **Given** a visitor viewing the pricing section, **When** they read the Free card, **Then** they see "$0" or "Free" pricing, the features list (1 project, 5 tickets/month, BYOK required), and a "Get Started" button.
3. **Given** a visitor viewing the pricing section, **When** they read the Pro card, **Then** they see "$15/month" pricing, the features list (unlimited projects, unlimited tickets, 14-day trial), a "Most Popular" badge, and a "Start 14-day trial" button.
4. **Given** a visitor viewing the pricing section, **When** they read the Team card, **Then** they see "$30/month" pricing, the features list (everything in Pro, project members up to 10, advanced analytics, 14-day trial), and a "Start 14-day trial" button.
5. **Given** a visitor viewing the pricing section, **When** they click any CTA button, **Then** they are directed to the sign-in/sign-up page.

---

### User Story 2 - View Pricing FAQ (Priority: P2)

A visitor has questions about the pricing plans and scrolls below the pricing cards to find a minimalist FAQ section that answers common questions about BYOK, supported AI agents, trials, and plan changes.

**Why this priority**: The FAQ reduces friction and pre-answers common questions, but the pricing cards (P1) deliver the primary value independently.

**Independent Test**: Can be tested by verifying FAQ questions and answers are visible below the pricing cards and that each FAQ item can be expanded/collapsed.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they scroll below the pricing cards, **Then** they see a FAQ section with 3-4 questions.
2. **Given** a visitor viewing the FAQ, **When** they look at the questions, **Then** they find answers about BYOK (what it means, when it applies) and supported AI agents (Claude, Codex).
3. **Given** a visitor viewing the FAQ, **When** they interact with a question, **Then** the answer expands or is immediately visible in a compact layout.

---

### User Story 3 - Responsive Pricing Display (Priority: P2)

A visitor accesses the landing page from a mobile device or tablet. The pricing cards and FAQ adapt to the smaller viewport, stacking vertically on mobile while remaining readable and usable.

**Why this priority**: Responsive design is essential for a public-facing marketing page, but is a display concern built alongside P1.

**Independent Test**: Can be tested by resizing the browser viewport to mobile (375px), tablet (768px), and desktop (1280px) widths and verifying the layout adapts correctly.

**Acceptance Scenarios**:

1. **Given** a visitor on a mobile device (viewport < 768px), **When** they view the pricing section, **Then** the three plan cards stack vertically in a single column.
2. **Given** a visitor on a tablet (viewport 768px-1024px), **When** they view the pricing section, **Then** the cards display in a responsive grid (2 or 3 columns depending on available space).
3. **Given** a visitor on desktop (viewport > 1024px), **When** they view the pricing section, **Then** the three cards display in a 3-column grid.

---

### Edge Cases

- What happens when a visitor has an extremely narrow viewport (< 320px)? Cards should still be fully visible with horizontal scrolling prevented.
- What happens when plan data changes (e.g., prices are updated)? The landing page should reflect the same source of truth as the billing page to avoid discrepancies.
- What happens if the page is loaded with JavaScript disabled? The pricing section should still render its static content (it is a server component on a server-rendered page).

## Requirements

### Functional Requirements

- **FR-001**: The landing page MUST display a pricing section positioned after the workflow section and before the final call-to-action section.
- **FR-002**: The pricing section MUST display exactly three plan cards: Free, Pro, and Team.
- **FR-003**: Each plan card MUST show the plan name, monthly price (Free: $0, Pro: $15, Team: $30), and a list of included features.
- **FR-004**: The Pro plan card MUST be visually distinguished as the recommended option (e.g., "Most Popular" badge or highlighted border).
- **FR-005**: The Free plan card MUST display a "Get Started" CTA button that links to the sign-in/sign-up page.
- **FR-006**: The Pro and Team plan cards MUST each display a "Start 14-day trial" CTA button that links to the sign-in/sign-up page.
- **FR-007**: A minimalist FAQ section MUST appear below the pricing cards with 3-4 questions covering at minimum: BYOK explanation and supported AI agents (Claude, Codex).
- **FR-008**: The pricing section and FAQ MUST be fully responsive, adapting from a single-column mobile layout to a multi-column desktop layout.
- **FR-009**: The pricing section MUST use the existing design system tokens (dark theme, semantic color tokens) and be visually consistent with the other landing page sections.
- **FR-010**: The pricing data displayed MUST be consistent with the plan configuration used elsewhere in the application to avoid pricing discrepancies.

### Key Entities

- **Plan Card**: Represents a subscription tier displayed to visitors. Attributes: plan name, price, feature list, CTA label, CTA destination, visual emphasis (popular badge).
- **FAQ Item**: A question-answer pair displayed in the FAQ section. Attributes: question text, answer text, display order.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of landing page visitors can view all three pricing cards without scrolling horizontally on viewports 375px and wider.
- **SC-002**: All plan prices and features displayed on the landing page match the authoritative plan configuration with zero discrepancies.
- **SC-003**: Each CTA button on a pricing card successfully navigates the visitor to the sign-in/sign-up page within 1 click.
- **SC-004**: The FAQ section answers at least 3 common pricing questions, reducing the need for visitors to seek pricing information elsewhere.
- **SC-005**: The pricing section renders correctly across mobile (375px), tablet (768px), and desktop (1280px) viewports with no layout breakage.

## Assumptions

- The landing page is only shown to unauthenticated visitors (confirmed by existing codebase pattern).
- Plan pricing and features are stable and unlikely to change frequently; if they do, the landing page will reflect changes from the shared plan configuration.
- The FAQ content is static and does not require a CMS or dynamic data source.
- No A/B testing or analytics tracking is required for this initial implementation.
