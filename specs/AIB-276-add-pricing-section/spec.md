# Feature Specification: Add pricing section to landing page & footer

**Feature Branch**: `AIB-276-add-pricing-section`  
**Created**: 2026-03-12  
**Status**: Draft  
**Input**: User description: "Ajouter une section pricing et un footer a la landing page existante avec 3 plans, une FAQ minimale, et un footer coherent sur toutes les pages publiques."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Treat the request as a public marketing-site enhancement focused on communicating plan options and giving visitors direct access to legal and repository links, without expanding into checkout, account management, or new standalone pages.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Low (score: +1, neutral public feature context only; no sensitive, scalability, or speed signals)
- **Fallback Triggered?**: Yes - AUTO confidence was below 0.5, so the specification defaulted to CONSERVATIVE guardrails to keep scope and acceptance criteria explicit.
- **Trade-offs**:
  1. Scope stays narrow and testable by limiting the feature to landing-page content, plan comparison messaging, FAQ content, and public footer consistency.
  2. The specification avoids guessing monetization or legal workflows that were not requested, which reduces rework but may require later expansion if billing journeys change.
- **Reviewer Notes**: Confirm that plan names, CTA labels, FAQ topics, and footer destinations match current product and legal messaging before implementation.

- **Decision**: Assume the existing public footer should be updated to include the GitHub repository link and to remain visible on landing and legal pages through the shared public layout rather than creating page-specific footer variants.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: +1 with repository and legal destinations explicitly named in the request, plus existing public-page consistency requirement)
- **Fallback Triggered?**: Yes - AUTO still fell back to CONSERVATIVE because overall feature confidence remained low.
- **Trade-offs**:
  1. Reusing a shared public footer minimizes inconsistent navigation across public pages.
  2. This assumes the current footer placement is acceptable; if marketing later wants landing-specific footer content, the shared approach may need refinement.
- **Reviewer Notes**: Validate whether any public routes should intentionally exclude the footer before planning begins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare plans on the landing page (Priority: P1)

As a visitor evaluating AI Board, I want to compare Free, Pro, and Team plans directly on the landing page so I can understand the available options without leaving the page.

**Why this priority**: Pricing clarity is the primary requested addition and directly supports conversion from anonymous visitors to sign-up or trial starts.

**Independent Test**: Can be fully tested by visiting the landing page and confirming that all three plans, their included capabilities, and the expected CTA labels appear in the new pricing section between the workflow and final CTA sections.

**Acceptance Scenarios**:

1. **Given** a visitor opens the landing page, **When** they scroll past the workflow section, **Then** they see a pricing section before the final call-to-action section.
2. **Given** the pricing section is visible, **When** the visitor reviews the plan cards, **Then** they can distinguish Free, Pro, and Team plans with a clear list of included capabilities for each plan.
3. **Given** the pricing cards are visible, **When** the visitor reads the action buttons, **Then** the Free plan shows `Get Started` and the Pro and Team plans show `Start 14-day trial`.

---

### User Story 2 - Resolve common pricing questions without leaving the page (Priority: P2)

As a visitor who is unsure about pricing details, I want a concise FAQ below the pricing cards so I can answer common questions such as BYOK support and supported agents before deciding to continue.

**Why this priority**: The FAQ reduces friction in the same decision moment as pricing, but it is secondary to the actual plan comparison.

**Independent Test**: Can be tested independently by viewing the pricing area and confirming the FAQ appears directly beneath the plan cards with concise answers for the requested topics.

**Acceptance Scenarios**:

1. **Given** a visitor reaches the pricing area, **When** they continue below the plan cards, **Then** they see a minimal FAQ section in the same landing-page flow.
2. **Given** the FAQ is displayed, **When** the visitor scans the entries, **Then** they can find answers about BYOK and which agents are supported.

---

### User Story 3 - Access public legal and repository links from any public page (Priority: P3)

As a visitor on a public-facing page, I want a footer with legal and repository links so I can verify the product's terms, privacy commitments, and source repository from anywhere in the public experience.

**Why this priority**: Public trust and navigation consistency matter, but this supports the pricing addition rather than defining the core conversion experience.

**Independent Test**: Can be tested by visiting the landing page and legal pages and confirming the same footer includes Terms of Service, Privacy Policy, GitHub repository, and copyright.

**Acceptance Scenarios**:

1. **Given** a visitor is on the landing page, **When** they reach the bottom of the page, **Then** they see a footer with links to Terms of Service, Privacy Policy, and the GitHub repository, plus copyright text.
2. **Given** a visitor opens a public legal page, **When** the page loads, **Then** the same footer content remains available there as well.

### Edge Cases

- What happens when plan descriptions differ in length? The pricing section should still present all three plans clearly without hiding CTA labels or making one plan unreachable on smaller screens.
- What happens when the GitHub repository link is temporarily unavailable or changes? Public pages should still expose the footer consistently, and the repository destination must be maintained as a configurable content value during implementation review.
- How does the landing page behave on smaller screens? Visitors should be able to read each pricing card, FAQ item, and footer link without horizontal scrolling or clipped content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The landing page MUST include a pricing section positioned after the workflow section and before the final call-to-action section.
- **FR-002**: The pricing section MUST present exactly three plans named Free, Pro, and Team.
- **FR-003**: Each plan MUST include a clearly readable summary of the capabilities or benefits included in that plan so visitors can compare the offerings.
- **FR-004**: The pricing section MUST provide a primary CTA for each plan with the labels `Get Started` for Free and `Start 14-day trial` for both Pro and Team.
- **FR-005**: The pricing section MUST include a concise FAQ directly below the plan cards covering BYOK and supported agents.
- **FR-006**: The pricing and FAQ content MUST be integrated into the existing landing page rather than introduced as a separate page or detached flow.
- **FR-007**: The public footer MUST include links to Terms of Service, Privacy Policy, and the project's GitHub repository.
- **FR-008**: The public footer MUST include copyright text.
- **FR-009**: The same footer content MUST be available on all public pages, including the landing page and legal pages.
- **FR-010**: The pricing section and footer MUST remain visually consistent with the existing public-site design language, including dark-theme presentation.
- **FR-011**: The pricing section, FAQ, and footer MUST remain usable on mobile and desktop screen sizes without loss of content or primary actions.

### Key Entities *(include if feature involves data)*

- **Plan Summary**: Public-facing description of one offer tier, including plan name, included capabilities, and CTA label.
- **Pricing FAQ Item**: Short question-and-answer content used to address common pre-purchase concerns within the landing page.
- **Public Footer Link**: Navigational destination shown in the footer for legal information or repository access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of public visitors can view Free, Pro, and Team plan summaries and their corresponding CTAs on the landing page without leaving the page.
- **SC-002**: 100% of public pages include a footer exposing legal links, repository access, and copyright information.
- **SC-003**: On standard mobile and desktop viewports, all pricing cards, FAQ entries, and footer links remain readable and operable without horizontal scrolling.
- **SC-004**: Stakeholder review confirms that the landing page communicates the three plan options and the two FAQ topics clearly enough that no follow-up clarification content is required before implementation planning.

## Assumptions

- Pricing cards communicate plan differences descriptively and do not need to expose billing amounts unless separate product copy is provided later.
- CTA destinations can follow the product's existing public acquisition flow and do not require new conversion pages in this feature.
- Legal pages already exist and only need footer consistency, not rewritten legal content.
