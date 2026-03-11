# Feature Specification: Add pricing section to landing page & footer

**Feature Branch**: `AIB-270-add-pricing-section`  
**Created**: March 11, 2026  
**Status**: Draft  
**Input**: User description: "## Objectif\\nAjouter une section pricing et un footer à la landing page existante.\\n\\n## Landing page actuelle\\nLa landing (`app/landing/page.tsx`) a déjà : HeroSection, FeaturesGrid, WorkflowSection, CTASection.\\n\\n## Ajouts demandés\\n\\n### Section Pricing\\n- 3 cartes (Free / Pro / Team) avec les features de chaque plan\\n- CTA par plan : Free = \"Get Started\", Pro/Team = \"Start 14-day trial\"\\n- Positionnée après WorkflowSection et avant CTASection\\n- FAQ minimaliste sous les cartes (BYOK, quels agents supportés)\\n\\n### Footer\\n- Liens vers Terms of Service et Privacy Policy\\n- Liens vers GitHub repo\\n- Copyright\\n- Affiché sur toutes les pages publiques (landing, legal)\\n\\n## Contraintes\\n- Intégrer dans la landing existante, pas de nouvelle page\\n- Cohérent avec le design system (dark theme, shadcn/ui)\\n- Responsive"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Define pricing card content (price points, feature bullets, testimonials) without new input.  
  **Policy Applied**: CONSERVATIVE (AUTO net score +1 → fallback enforced due to 0.3 confidence).  
  **Confidence**: Low (0.3) — based on neutral marketing context only.  
  **Fallback Triggered?**: Yes — AUTO lacked confidence, so we defaulted to CONSERVATIVE assumptions emphasizing clarity over speed.  
  **Trade-offs**:  
  1. Locks in interim price points ($0 Free, $49/mo Pro, $149/mo Team) and feature tiers that marketing must validate before publish.  
  2. Slightly longer copywriting cycle because any change to pricing/benefits requires coordinated review.  
  **Reviewer Notes**: Confirm with Growth/Finance that the proposed plan structure, benefits, and trial duration align with upcoming billing plans before shipping.

- **Decision**: Determine CTA destinations and behavior (where “Get Started” and “Start 14-day trial” send users and when to open modals vs. new tabs).  
  **Policy Applied**: CONSERVATIVE.  
  **Confidence**: Medium — reuses existing signup + upgrade funnel patterns observed elsewhere in the product.  
  **Fallback Triggered?**: No.  
  **Trade-offs**:  
  1. Guarantees consistent onboarding by routing Free plan to the standard signup path and paid plans to the upgrade flow with pre-selected tier.  
  2. Requires analytics to distinguish clicks per plan, adding minor tracking work.  
  **Reviewer Notes**: Validate that upgrade pages already support deep-link parameters for pre-selecting Pro vs Team trials.

- **Decision**: Interpret “all public pages” for the footer as landing + legal surfaces and standardize layout copy.  
  **Policy Applied**: CONSERVATIVE.  
  **Confidence**: Medium — assumes marketing routes traffic only through landing, Terms, and Privacy for now.  
  **Fallback Triggered?**: No.  
  **Trade-offs**:  
  1. Ensures future public pages automatically pick up the shared footer by centralizing it in the marketing layout, which may require additional layout refactors later.  
  2. Slightly increases regression testing scope because any marketing page now depends on the shared footer component.  
  **Reviewer Notes**: Reconfirm list of “public” routes before release; add more pages to the layout include list if needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare plans and convert (Priority: P1)

A prospective customer scrolls through the landing page to understand available plans, compares Free, Pro, and Team tiers, and selects the CTA that best matches their needs.

**Why this priority**: Pricing is the primary blocker to conversion; without it, visitors cannot self-serve. 

**Independent Test**: In a staging environment, load the landing page, scroll to the pricing section, verify that each plan card lists the defined attributes and that clicking each CTA routes to the correct signup or upgrade flow with the plan pre-selected.

**Acceptance Scenarios**:

1. **Given** a visitor on `/landing`, **when** they reach the pricing section, **then** three cards display (Free/Pro/Team) with name, short description, feature bullets, price, and CTA label specified in this spec.
2. **Given** a visitor clicks “Get Started” on the Free card, **when** the action completes, **then** the user is taken to the standard signup page in the same tab.
3. **Given** a visitor clicks “Start 14-day trial” on Pro or Team, **when** the action executes, **then** the upgrade flow opens with the appropriate paid plan highlighted and trial messaging shown before any payment entry.

---

### User Story 2 - Resolve BYOK and agent support questions (Priority: P2)

An enterprise lead needs to know whether they can bring their own model provider (BYOK) and which AI agents integrate before initiating a sales conversation.

**Why this priority**: These FAQs reduce pre-sales friction and prevent unnecessary support tickets.

**Independent Test**: Inspect the FAQ accordion beneath the pricing cards, confirm the BYOK and “supported agents” questions are present, the answers match this spec, and they remain accessible without expanding other content.

**Acceptance Scenarios**:

1. **Given** the pricing section is visible, **when** the user expands the BYOK question, **then** the answer states that BYOK is available on Pro (limited) and Team (full) with instructions to connect via workspace settings.
2. **Given** the FAQ is collapsed, **when** the user selects the “Which agents are supported?” item, **then** the answer lists the supported agent providers (Claude, GPT-4 class, Gemini Advanced) and clarifies update cadence.

---

### User Story 3 - Access legal and repo links from any public page (Priority: P3)

A visitor reviewing policies or the open-source repository needs consistent footer access regardless of which marketing/legal page they are on.

**Why this priority**: Ensures compliance and transparency; regulators expect prominent legal links.

**Independent Test**: Navigate to `/landing`, `/terms`, and `/privacy`, verify the same footer block renders, links open in new tabs with correct URLs, and copyright text reflects the current year and company name.

**Acceptance Scenarios**:

1. **Given** any public marketing page, **when** the footer renders, **then** Terms of Service and Privacy Policy links are visible, accessible, and open their respective routes in a new tab.
2. **Given** a visitor on the Terms page, **when** they scroll to the bottom, **then** the footer still appears with the GitHub repository link and copyright notice.

### Edge Cases

- What happens when screen width is <360px? → Plan cards stack vertically with consistent spacing, CTAs remain full-width buttons, and FAQ accordions collapse to single-column.
- How does system handle locales that require different currency? → Default to USD pricing but include a short disclaimer (“Pricing in USD — regional taxes shown at checkout”).
- What if Terms or Privacy routes fail to load? → Display a toast or inline message indicating the legal page is temporarily unavailable and provide a contact email.
- What happens if analytics flags low CTA clicks for a specific plan? → Ensure CTA elements expose data attributes for instrumentation so marketing can A/B test copy without code changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pricing section must appear immediately after the WorkflowSection and before the CTASection on the landing page without duplicating existing sections.
- **FR-002**: Display three plan cards labeled Free, Pro, and Team, each with a plan badge, price (Free $0/mo, Pro $49/mo, Team $149/mo), succinct description, and at least four feature bullets defined below.
- **FR-003**: Feature bullets per plan must communicate capabilities: Free (1 project, 10 open tickets/month, community support, shared agents), Pro (5 projects, 50 tickets/month, 10 members, priority support, BYOK connectors limited to one provider), Team (unlimited projects, 200 tickets/month, 25 members, dedicated success manager, full BYOK, advanced audit logs).
- **FR-004**: Each plan card must include its CTA: Free uses “Get Started” linking to the standard signup path; Pro and Team use “Start 14-day trial” linking to the upgrade flow with plan pre-selected and trial messaging, while recording plan identifier for analytics.
- **FR-005**: Present a compact FAQ block directly under the cards containing exactly two accordion items: “Can I bring my own model (BYOK)?” and “Which AI agents are supported?”, with answers mirroring the messaging in User Story 2.
- **FR-006**: The section must respect the existing dark theme styles (typography scale, spacing, shadcn/ui components) and remain fully responsive across mobile (≥320px), tablet, and desktop without horizontal scrolling; plan cards should collapse into a swipeable or stacked layout on mobile.
- **FR-007**: Add a shared footer component containing Terms of Service, Privacy Policy, GitHub repository link, and copyright (“© [current year] ai-board, Inc.”), all using accessible contrast and opening external links in new tabs.
- **FR-008**: Ensure the shared footer component renders on all public marketing routes (landing, Terms, Privacy, and future marketing pages using the same layout) without affecting authenticated product surfaces.
- **FR-009**: Provide instrumentation hooks (data attributes or IDs) for each CTA and FAQ expansion to enable analytics tracking without DOM restructuring.
- **FR-010**: Content for plan pricing, bullets, FAQ answers, and footer links must be centralized in a single configuration object so that marketing can update copy or add plans without editing multiple components.

### Key Entities

- **PricingPlan**: Represents each plan card; attributes include `name`, `priceSummary`, `description`, `featureBullets[]`, `ctaLabel`, `ctaDestination`, `trialLength`, and `analyticsId`.
- **FAQEntry**: Represents each FAQ item; attributes include `question`, `answer`, `defaultExpanded`, and `trackingId`.
- **FooterLinkGroup**: Represents footer content; attributes include `linkLabel`, `href` (internal or external), `opensInNewTab`, and `visibilityScope` (e.g., `publicOnly`).

## Assumptions & Dependencies

- Pricing amounts and quotas provided here reflect the upcoming pricing launch; Marketing/GTM will confirm or adjust them before publication without requiring structural changes.
- Terms of Service and Privacy Policy pages already exist at `/terms` and `/privacy`; if URLs differ, routing updates will be provided before QA.
- Existing signup and upgrade flows accept plan identifiers via query parameters or other metadata so CTAs can deep-link without redesigning those flows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% of mobile sessions (width ≥320px) can view the complete pricing section without horizontal scrolling or truncated CTAs, as confirmed through responsive QA.
- **SC-002**: At least 25% of unique landing visitors who reach the pricing section click one of the plan CTAs within 30 days of launch, measured via analytics events defined in FR-009.
- **SC-003**: FAQ interactions reduce inbound support tickets about BYOK or supported agents by 30% within one month (baseline = previous 30-day ticket volume on those topics).
- **SC-004**: 100% of public marketing pages (landing, Terms, Privacy) pass legal compliance review by surfacing Terms and Privacy links within one click at all viewport sizes.
