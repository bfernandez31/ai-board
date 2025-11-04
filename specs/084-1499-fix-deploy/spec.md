# Feature Specification: Unified Deploy Preview Icon

**Feature Branch**: `084-1499-fix-deploy`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "#1499 fix deploy preview UI - consolidate two separate deploy preview icons into a single stateful icon"

## Auto-Resolved Decisions

- **Decision**: Icon color when preview URL exists
- **Policy Applied**: AUTO
- **Confidence**: High (netScore +1, clear feature context, no conflicting signals)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Green color provides clear visual feedback that deployment is active and clickable
  2. May require additional testing to ensure color choice meets accessibility standards
- **Reviewer Notes**: Validate that green color (#10b981 or similar) has sufficient contrast against dark background (WCAG AA compliance)

---

- **Decision**: Disabled state behavior when deploy job is running/pending
- **Policy Applied**: AUTO
- **Confidence**: High (netScore +2, user explicitly stated requirement, no ambiguity)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents user confusion and duplicate job creation
  2. Maintains existing bounce animation for clear feedback
- **Reviewer Notes**: Verify that disabled state prevents all click events and shows appropriate tooltip

---

- **Decision**: Icon type (single unified icon vs separate icons)
- **Policy Applied**: PRAGMATIC (user explicitly requested consolidation: "just need to clean up the useless preview deploy button")
- **Confidence**: High (netScore +3, explicit user directive, clear scope reduction)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simplifies UI by removing redundant icon (cleaner interface)
  2. Single icon must handle multiple states clearly (may require careful visual design)
- **Reviewer Notes**: Ensure consolidated icon states are visually distinct enough for users to understand current status at a glance

## User Scenarios & Testing

### User Story 1 - View and Open Active Preview Deployment (Priority: P1)

**Scenario**: A developer has a ticket in VERIFY stage with an active Vercel preview deployment and wants to open it in their browser.

**Why this priority**: This is the primary success path - users need to access their deployed previews to verify changes. This delivers immediate value by providing direct access to the preview environment.

**Independent Test**: Can be fully tested by creating a ticket with a preview URL and verifying the green icon opens the URL in a new tab. Delivers the value of quick access to preview deployments.

**Acceptance Scenarios**:

1. **Given** a ticket has a preview URL set, **When** user views the ticket card, **Then** a green clickable icon is displayed
2. **Given** a ticket has a preview URL, **When** user clicks the green icon, **Then** the preview URL opens in a new browser tab
3. **Given** a ticket has a preview URL in any stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP), **When** user views the ticket, **Then** the green icon is visible regardless of stage
4. **Given** the preview URL opens in a new tab, **When** the action completes, **Then** the current tab remains focused on the board

---

### User Story 2 - Trigger New Preview Deployment (Priority: P2)

**Scenario**: A developer has completed work on a ticket in VERIFY stage and wants to deploy a preview to Vercel for testing.

**Why this priority**: This enables developers to create new preview deployments when needed. While critical for the workflow, it's secondary to accessing existing deployments since deployment is a one-time action per verification cycle.

**Independent Test**: Can be fully tested by creating a deployable ticket (VERIFY stage, has branch, completed job) and verifying the deploy icon triggers the confirmation modal. Delivers the value of on-demand preview creation.

**Acceptance Scenarios**:

1. **Given** a ticket is in VERIFY stage with a branch and completed job, **When** user views the ticket card, **Then** a deploy icon is displayed
2. **Given** the deploy icon is visible, **When** user clicks it, **Then** a confirmation modal opens with deployment details
3. **Given** the confirmation modal is open, **When** user confirms deployment, **Then** a deploy job is created and the icon shows deploying state
4. **Given** a ticket already has a preview URL, **When** user views the ticket, **Then** the green preview icon is shown instead of the deploy icon (deployed state takes precedence)

---

### User Story 3 - Monitor Deployment Progress (Priority: P3)

**Scenario**: A developer has triggered a preview deployment and wants to see real-time feedback on deployment status.

**Why this priority**: Provides feedback during deployment process but doesn't block the core workflow. Users can continue other work while deployment progresses.

**Independent Test**: Can be fully tested by triggering a deployment and verifying the icon shows loading state with blue bounce animation. Delivers the value of deployment progress visibility.

**Acceptance Scenarios**:

1. **Given** a deploy job is PENDING or RUNNING, **When** user views the ticket card, **Then** the icon displays with blue bounce animation
2. **Given** the deploy icon is bouncing (deploying state), **When** user attempts to click it, **Then** no action occurs (icon is disabled)
3. **Given** a deployment is in progress, **When** the deployment completes successfully, **Then** the icon changes to green preview state
4. **Given** a deployment is in progress, **When** the deployment fails or is cancelled, **Then** the icon returns to deployable state (allowing retry)

---

### User Story 4 - Handle Deployment Failures (Priority: P4)

**Scenario**: A developer's preview deployment has failed or been cancelled and they want to retry deployment.

**Why this priority**: Error recovery is important but less common than successful deployments. This ensures users aren't blocked when issues occur.

**Independent Test**: Can be fully tested by simulating a failed deployment and verifying the deploy icon reappears for retry. Delivers the value of deployment resilience.

**Acceptance Scenarios**:

1. **Given** a deploy job has status FAILED or CANCELLED, **When** user views the ticket card, **Then** the deploy icon is displayed (same as not deployed)
2. **Given** a failed deploy job exists, **When** user clicks the deploy icon, **Then** the confirmation modal opens allowing retry
3. **Given** the user confirms retry after failure, **When** the new job is created, **Then** the icon shows deploying state again

---

### Edge Cases

- What happens when a ticket has a preview URL but is not in VERIFY stage? (Icon should still show green and open URL - stage doesn't matter for preview access)
- How does the system handle rapid clicking during deployment? (Icon is disabled during PENDING/RUNNING to prevent duplicate jobs)
- What happens when a ticket becomes non-deployable after having a preview URL? (Green preview icon persists since preview URL exists)
- How does the icon behave when a ticket transitions from BUILD to VERIFY? (Shows deploy icon if deployable conditions met)
- What happens if deployment completes but preview URL update fails? (Deploy job shows COMPLETED, but no green icon appears until previewUrl is set)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a single unified icon for deploy preview functionality (no separate preview and deploy icons)
- **FR-002**: System MUST display green clickable icon when ticket has preview URL, regardless of ticket stage
- **FR-003**: System MUST open preview URL in new browser tab when green icon is clicked
- **FR-004**: System MUST display deployable icon when ticket meets deployment criteria (stage=VERIFY, has branch, latest job COMPLETED) and has no preview URL
- **FR-005**: System MUST disable icon and show blue bounce animation when deploy job status is PENDING or RUNNING
- **FR-006**: System MUST prevent user interaction (clicks) when icon is in deploying state
- **FR-007**: System MUST display deploy icon (not green preview icon) when deploy job status is FAILED or CANCELLED, allowing retry
- **FR-008**: System MUST show confirmation modal when user clicks deploy icon in deployable state
- **FR-009**: System MUST prioritize green preview state over deploy state when both preview URL exists and ticket is deployable
- **FR-010**: System MUST maintain consistent icon size and positioning with existing job status indicators

### Icon State Priority (Highest to Lowest)

1. **Green Preview Icon**: Ticket has `previewUrl` (takes precedence over all other states)
2. **Deploying Indicator**: Deploy job status is PENDING or RUNNING (blue bounce animation)
3. **Deploy Icon**: Ticket is deployable (stage=VERIFY, has branch, completed job) OR deploy job is FAILED/CANCELLED
4. **No Icon**: None of the above conditions are met

### Key Entities

- **Deploy Icon State**: Represents the current visual and interaction state of the unified deploy icon
  - States: Preview (green, clickable), Deployable (neutral, clickable), Deploying (blue bounce, disabled), Hidden (not shown)
  - Attributes: color, clickable status, animation status, tooltip text, click handler
- **Deploy Job**: Tracks preview deployment workflow execution
  - Relevant attributes: status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED), command ("deploy-preview")
  - Relationship: One deploy job per deployment attempt per ticket

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can access active preview deployments with one click (green icon opens URL immediately)
- **SC-002**: Ticket cards display at most one deploy-related icon at any time (no duplicate icons)
- **SC-003**: Users receive clear visual feedback during deployment (blue bounce animation visible when job is PENDING/RUNNING)
- **SC-004**: Users can distinguish between preview-ready and deployable states at a glance (green vs neutral icon coloring)
- **SC-005**: System prevents duplicate deployments through disabled state when job is already running
- **SC-006**: Users can retry failed deployments with same interaction pattern as initial deployment (deploy icon visible after FAILED/CANCELLED)
