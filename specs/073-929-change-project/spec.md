# Feature Specification: Project Card Redesign

**Feature Branch**: `073-929-change-project`
**Created**: 2025-10-29
**Status**: Draft
**Input**: User description: "#929 Change project card - Transform project cards to display last shipped ticket instead of description"

## Auto-Resolved Decisions

- **Decision**: Remove project description field from card display and replace with shipped ticket status
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: Low (0.3) - Neutral UI improvement context with insufficient signal strength
- **Fallback Triggered?**: Yes - AUTO promoted to CONSERVATIVE due to low confidence score
- **Trade-offs**:
  1. Removes ability to view project description at-a-glance; users must click into project for full context
  2. Assumes shipped ticket status is more valuable than static description text
  3. May increase cognitive load if users expect to see descriptions
- **Reviewer Notes**: Validate that removal of description field doesn't impact user workflows; consider A/B testing to measure impact on project selection/navigation

---

- **Decision**: Display relative time format for shipped tickets ("2h ago") instead of absolute timestamps
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - Industry standard pattern (GitHub, Vercel, Linear use relative times)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. More intuitive for recent activity but less precise than absolute timestamps
  2. Requires client-side formatting logic for proper timezone handling
- **Reviewer Notes**: Ensure relative time updates periodically or on page refresh; consider tooltip with absolute time on hover

---

- **Decision**: Truncate long ticket titles with ellipsis to prevent card layout breaking
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High - Standard UI pattern for fixed-width containers
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users may not see full ticket titles on card
  2. Requires hover state or tooltip to show complete title
- **Reviewer Notes**: Define maximum character length for truncation; test with various title lengths

## User Scenarios & Testing

### User Story 1 - View Project Shipping Progress (Priority: P1)

As a project owner, I want to see my latest shipped ticket and total count at-a-glance so I can quickly assess project momentum and recent accomplishments without opening each project.

**Why this priority**: Core value proposition - surfaces actionable shipping status immediately, replaces less useful static description text

**Independent Test**: Can be fully tested by viewing the projects list page and verifying shipped ticket information displays correctly; delivers immediate value by showing project activity status

**Acceptance Scenarios**:

1. **Given** a project with at least one shipped ticket, **When** I view the projects page, **Then** I see the most recent shipped ticket title with a checkmark icon and relative timestamp ("Shipped 2h ago")
2. **Given** a project with multiple shipped tickets, **When** I view the project card, **Then** I see only the most recent shipped ticket and the total count of all tickets ("· 5 total")
3. **Given** a project with no shipped tickets, **When** I view the project card, **Then** I see "No tickets shipped yet · 5 total" where 5 is the total ticket count across all stages
4. **Given** a shipped ticket with a very long title, **When** I view the project card, **Then** I see the title truncated with ellipsis and can view the full title via tooltip on hover

---

### User Story 2 - Quick Access to Deployment URL (Priority: P2)

As a project owner, I want to quickly access and copy my project's deployment URL so I can share it with stakeholders or verify the live site without navigating through multiple pages.

**Why this priority**: Improves workflow efficiency for projects with active deployments; secondary to core shipping status but high-value for deployed projects

**Independent Test**: Can be tested by adding a deployment URL to a project and verifying copy functionality works; delivers standalone value for deployed projects

**Acceptance Scenarios**:

1. **Given** a project with a deployment URL configured, **When** I view the project card, **Then** I see the clickable deployment URL displayed below the project name
2. **Given** a project with a deployment URL, **When** I click the copy icon next to the URL, **Then** the URL is copied to my clipboard without triggering navigation to the project details
3. **Given** a project without a deployment URL, **When** I view the project card, **Then** the deployment URL section is not displayed (no empty placeholder)
4. **Given** I click the copy icon, **When** the URL is copied, **Then** I see visual feedback (e.g., icon change, tooltip) confirming the copy action

---

### User Story 3 - Navigate to GitHub Repository (Priority: P3)

As a project owner, I want to quickly access my GitHub repository from the project card so I can review code or manage issues without searching for the repo link.

**Why this priority**: Convenience feature for developers; useful but not critical for understanding project status

**Independent Test**: Can be tested by verifying GitHub link displays and opens correctly; delivers value independently for projects with GitHub integration

**Acceptance Scenarios**:

1. **Given** a project linked to a GitHub repository, **When** I view the project card, **Then** I see the "owner/repo" link with a GitHub icon
2. **Given** a GitHub repository link, **When** I click it, **Then** the GitHub repository opens in a new tab without triggering navigation to the project details page
3. **Given** a project without GitHub integration, **When** I view the project card, **Then** the GitHub link is not displayed

---

### Edge Cases

- What happens when a project has zero total tickets? (Display "No tickets yet" or "0 total")
- How does the system handle projects with very long repository names? (Truncate or wrap)
- What if the deployment URL is extremely long? (Truncate with ellipsis, show full URL on hover)
- How does the card display when both deployment URL and GitHub link are missing? (Only show project name and ticket status)
- What if the last shipped ticket was shipped years ago? (Relative time should say "2y ago" or show full date for very old tickets)
- How does the system behave when a ticket is un-shipped (moved from SHIP to another stage)? (Should update to show the new most recent shipped ticket)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display the most recently shipped ticket's title on each project card
- **FR-002**: System MUST show a relative timestamp for when the last ticket was shipped (e.g., "Shipped 2h ago")
- **FR-003**: System MUST display the total count of all tickets across all stages for the project
- **FR-004**: System MUST show "No tickets shipped yet" message when no tickets are in SHIP stage
- **FR-005**: System MUST display deployment URL as a clickable link when configured for a project
- **FR-006**: System MUST provide a copy-to-clipboard button for deployment URLs
- **FR-007**: System MUST display GitHub repository as "owner/repo" with a clickable link
- **FR-008**: System MUST prevent card click navigation when clicking deployment URL, copy icon, or GitHub link
- **FR-009**: System MUST truncate long ticket titles with ellipsis to maintain card layout
- **FR-010**: System MUST NOT display the project description field on the card
- **FR-011**: System MUST display a checkmark icon next to shipped ticket titles
- **FR-012**: System MUST hide deployment URL and GitHub sections when not configured (no empty placeholders)
- **FR-013**: System MUST update relative timestamps when the page refreshes or periodically
- **FR-014**: System MUST maintain existing card visual design and styling patterns

### Key Entities

- **Project**: Represents a user's project with name, optional deployment URL, GitHub owner/repo, and associated tickets
- **Ticket**: Represents a work item with title, stage (including SHIP stage), and timestamps; belongs to exactly one project
- **Shipped Ticket**: A ticket in the SHIP stage; projects track the most recent one by timestamp for display

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify which projects have recent shipping activity in under 3 seconds of viewing the projects page
- **SC-002**: Users can copy deployment URLs without navigating away from the projects page (0 page navigations)
- **SC-003**: Users can access GitHub repositories from project cards in 1 click (opens in new tab)
- **SC-004**: Project cards display correctly for projects with 0 to 100+ tickets without layout breaking
- **SC-005**: Users can distinguish between projects with shipped tickets vs. no shipped tickets at-a-glance
- **SC-006**: Card interactions (copy URL, open GitHub) do not interfere with card click navigation 100% of the time
- **SC-007**: Relative timestamps update accurately to reflect current time (within 1 minute accuracy for recent timestamps)
