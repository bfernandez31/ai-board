# Feature Specification: Manual Vercel Deploy Preview

**Feature Branch**: `080-1490-deploy-preview`
**Created**: 2025-11-03
**Status**: Draft
**Input**: User description: "#1490 Deploy Preview - je souhaite permettre de deployer manuellement l'application sur l'environnement vercel de preview pour les tickets qui on un job completed de verify sur le stage verify. Pour cela il faut faire une nouvelle git hub action, qui va lancer le deploiement sur vercel de la branche du ticket et qui va ajouter une url sur le ticket. Si un ticket a une url de preview alors on affiche un icone cliquable sur le ticket card entre completed et le ai assistant icon. Si on clique dessus ouvre l'url sur un autre onglet. Si pas d'url sur un ticket et que le ticket est dans le stage verify avec le job completed alors on permet via une icone de lancer le deploeiement, il faut une confirmation si un ticket a deja une url de preview. Il ne peut avoir qu'un ticket en preview a la fois. Il faut un visuel pour savoir que le deploiement a lieu, via un job specifique, comme pour le ai assistant job."

## Auto-Resolved Decisions

### Decision 1: Deploy Preview Environment Strategy

- **Decision**: Resolved deployment isolation and preview environment management
- **Policy Applied**: AUTO (recommended CONSERVATIVE due to Medium confidence 0.6, netScore=4)
- **Confidence**: Medium (0.6) - Feature has neutral deployment keywords with one internal tooling signal (GitHub Actions), suggesting measured approach without explicit speed pressure
- **Fallback Triggered?**: No - Single conflicting bucket and absScore=4 within acceptable range
- **Trade-offs**:
  1. **Scope**: Enforcing single active preview ensures resource control but may delay parallel review workflows
  2. **Quality**: Manual trigger with confirmation prevents accidental deployments and cost overruns
  3. **Timeline**: Conservative approach may require more validation steps vs. automatic deployment on verify completion
- **Reviewer Notes**:
  - Validate that single-preview constraint aligns with team's review velocity
  - Consider if preview URL should persist after deployment completes or be invalidated
  - Confirm Vercel preview environment quotas support expected usage volume

### Decision 2: Preview URL Lifecycle

- **Decision**: Preview URL stored on ticket, persists until overwritten by new deployment
- **Policy Applied**: CONSERVATIVE (via AUTO)
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Quality**: Immutable preview URLs provide stable reference for reviewers and QA
  2. **Cost**: URLs remain active consuming Vercel resources until explicitly replaced
  3. **UX**: Clear visual indicator (icon) shows preview availability without checking external systems
- **Reviewer Notes**:
  - Verify Vercel preview URL expiration policy (auto-cleanup after inactivity?)
  - Consider adding explicit "delete preview" action for manual cleanup
  - Confirm preview URLs are accessible to all project members (not just owners)

### Decision 3: Deployment Job Tracking Pattern

- **Decision**: Deploy preview uses same Job model pattern as AI assistant (PENDING → RUNNING → COMPLETED/FAILED)
- **Policy Applied**: CONSERVATIVE (via AUTO)
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Consistency**: Reuses existing job tracking infrastructure, reducing new code complexity
  2. **UX**: Users see familiar deployment progress indicators (same visual pattern as AI assist)
  3. **Scope**: Job status polling already implemented, no new real-time infrastructure needed
- **Reviewer Notes**:
  - Confirm Job.command field accepts new "deploy-preview" command type
  - Validate job failure handling (show error message to user, allow retry?)
  - Ensure job cleanup doesn't accidentally delete active preview URLs

## User Scenarios & Testing

### User Story 1 - View Active Preview Deployment (Priority: P1)

A project member verifies their implemented feature on a live preview environment before final approval. They see the preview icon on the ticket card, click it, and the preview application opens in a new browser tab showing their changes.

**Why this priority**: Core value proposition - users must be able to access deployed previews immediately. Without this, the entire feature is non-functional.

**Independent Test**: Can be fully tested by creating a ticket with a preview URL, rendering the ticket card, and verifying the icon is clickable and opens the correct URL in a new tab.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with a COMPLETED deploy job and preview URL, **When** user views the ticket card, **Then** a preview icon appears in the bottom job section of the ticket card, on the right side next to the AI-BOARD assistance icon. The icon is clickable and displays the rocket icon indicating deployment success.
2. **Given** a ticket with a COMPLETED deploy job and preview URL, **When** user clicks the preview icon, **Then** the preview URL opens in a new browser tab
3. **Given** a ticket in VERIFY stage without a preview URL, **When** user views the ticket card, **Then** no preview icon appears (deploy icon shown instead, see Story 2)

---

### User Story 2 - Trigger Manual Deploy Preview (Priority: P1)

A project member completes verification work and wants to deploy their ticket's branch to preview. They see a deploy icon in the bottom job section on the right side (next to AI-BOARD icon), click it, receive a confirmation prompt (especially if another preview is active), confirm, and the deployment starts with visible progress indication.

**Why this priority**: Core user action to initiate deployments. Without this, users cannot create previews.

**Independent Test**: Can be fully tested by creating a ticket in VERIFY stage with completed job and no preview URL, clicking the deploy icon, confirming the modal, and verifying the deployment job is created and workflow is triggered.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with a COMPLETED job and no preview URL, **When** user views the ticket card, **Then** a deploy icon appears in the bottom job section, on the right side next to the AI-BOARD assistance icon
2. **Given** a ticket with deploy icon visible, **When** user clicks the deploy icon, **Then** a confirmation modal appears with "Deploy Preview" title and "Deploy Preview" button
3. **Given** no other preview is currently active, **When** user confirms deployment in modal, **Then** a deployment job is created with PENDING status and GitHub workflow is triggered
4. **Given** another ticket already has an active preview, **When** user confirms deployment in modal, **Then** the modal warns that existing preview will be replaced and requires explicit confirmation
5. **Given** user cancels the confirmation modal, **When** modal is dismissed, **Then** no deployment job is created and ticket state is unchanged
6. **Given** user clicks any button in the confirmation modal (Cancel or Deploy Preview), **When** the button is clicked, **Then** click event propagation is stopped to prevent the ticket detail modal from opening

---

### User Story 3 - Monitor Deployment Progress (Priority: P2)

A project member triggers a deployment and wants to know when it completes. They see a visual indicator (job status badge with rocket icon and bounce animation) in the bottom job section while deployment is in progress. When deployment completes, the job status indicator becomes clickable to open the preview URL in a new browser tab.

**Why this priority**: Essential feedback for user confidence, but deployment can succeed without constant monitoring. Users can navigate away and return later.

**Independent Test**: Can be fully tested by creating a PENDING deployment job, verifying the loading indicator appears, then updating job status to COMPLETED and verifying the preview icon appears.

**Acceptance Scenarios**:

1. **Given** a deployment job with PENDING status, **When** user views the ticket card, **Then** a job status indicator with rocket icon and bounce animation appears in the bottom job section with purple/blue color
2. **Given** a deployment job transitions to RUNNING status, **When** user views the ticket card, **Then** the job status indicator continues showing rocket icon with bounce animation
3. **Given** a deployment job transitions to COMPLETED status and preview URL is set, **When** user views the ticket card, **Then** the job status indicator shows rocket icon (without animation) and becomes clickable to open the preview URL in a new browser tab
4. **Given** a deployment job transitions to FAILED or CANCELLED status, **When** user views the ticket card, **Then** the job status indicator is replaced by a deploy icon (retry button) allowing user to retry deployment

---

### User Story 4 - Handle Deployment Failures (Priority: P3)

A project member's deployment fails due to Vercel errors or configuration issues. They see a deploy icon (retry button) on the ticket card instead of the job status indicator, can retry the deployment, and see appropriate retry messaging in the confirmation modal.

**Why this priority**: Important for resilience but not core happy-path. Initial implementation can succeed with basic error display.

**Independent Test**: Can be fully tested by creating a FAILED deployment job, verifying retry button appears, and allowing user to trigger a new deployment attempt.

**Acceptance Scenarios**:

1. **Given** a deployment job with FAILED status, **When** user views the ticket card, **Then** a deploy icon (retry button) appears in the bottom job section instead of the job status indicator
2. **Given** a deployment job with CANCELLED status, **When** user views the ticket card, **Then** a deploy icon (retry button) appears in the bottom job section instead of the job status indicator
3. **Given** a failed or cancelled deployment, **When** user clicks the deploy icon (retry button), **Then** a confirmation modal appears with "Retry Preview" title and "Retry Deploy" button
4. **Given** user confirms retry in the modal, **When** confirmation is submitted, **Then** a new deployment job is created with PENDING status and GitHub workflow is triggered (previous failed job remains in history)
5. **Given** user clicks any button in the retry confirmation modal (Cancel or Retry Deploy), **When** the button is clicked, **Then** click event propagation is stopped to prevent the ticket detail modal from opening

---

### Edge Cases

- What happens when a user triggers deployment on a ticket while another deployment is in progress on a different ticket? (System must prevent concurrent deployments or queue them)
- How does the system handle deployment when the ticket's branch no longer exists or is out of sync with remote?
- What happens if the preview URL becomes invalid (Vercel project deleted, deployment expired)?
- How does the system handle network failures during workflow dispatch to GitHub Actions?
- What happens when a user navigates away from the board while deployment is in progress? (Polling should continue, status updates when user returns)
- How does the system handle tickets transitioning out of VERIFY stage while deployment is in progress? (Allow deployment to complete, but hide deploy icon on other stages)
- What happens if multiple users try to deploy different tickets simultaneously? (Single-preview constraint must be enforced transactionally)

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow users to manually trigger Vercel preview deployment for tickets in VERIFY stage with a COMPLETED job
- **FR-002**: System MUST store the preview deployment URL on the ticket record
- **FR-003**: System MUST display a clickable preview icon on ticket cards when a preview URL exists
- **FR-004**: System MUST open preview URLs in a new browser tab when icon is clicked
- **FR-005**: System MUST display a deploy icon on ticket cards in VERIFY stage with COMPLETED job and no active preview URL
- **FR-006**: System MUST show a confirmation modal before initiating deployment
- **FR-007**: System MUST enforce a single active preview deployment at a time across all tickets
- **FR-008**: System MUST warn users in confirmation modal when an existing preview will be replaced
- **FR-009**: System MUST create a Job record with PENDING status when deployment is triggered
- **FR-010**: System MUST dispatch a GitHub Actions workflow to perform the Vercel deployment
- **FR-011**: System MUST display deployment progress indicators while job is PENDING or RUNNING
- **FR-012**: System MUST update ticket with preview URL when deployment completes successfully
- **FR-013**: System MUST update job status to COMPLETED when deployment succeeds
- **FR-014**: System MUST update job status to FAILED when deployment fails
- **FR-015**: System MUST display error indicators when deployment fails
- **FR-016**: System MUST allow users to retry failed deployments
- **FR-017**: System MUST position deploy and preview indicators in the bottom job section of the ticket card, on the right side next to the AI-BOARD assistance icon (not in top badges section)
- **FR-018**: System MUST only show deploy functionality for tickets in VERIFY stage (not INBOX, SPECIFY, PLAN, BUILD, or SHIP)
- **FR-019**: System MUST authenticate with Vercel API using secure credentials stored in GitHub secrets
- **FR-020**: System MUST validate that ticket has an associated branch before allowing deployment
- **FR-021**: System MUST show a deploy button (instead of job status indicator) when deploy job status is FAILED or CANCELLED, allowing users to retry deployment
- **FR-022**: System MUST update the confirmation modal to show "Retry Preview" title and "Retry Deploy" button when user is retrying a failed or cancelled deployment
- **FR-023**: System MUST open preview URL in new browser tab when user clicks on a COMPLETED deploy job status indicator (rocket icon)
- **FR-024**: System MUST prevent click event propagation on all confirmation modal buttons (Cancel and Deploy/Retry) to prevent ticket detail modal from opening when clicking modal buttons

### Key Entities

- **Ticket**: Existing entity, now includes preview URL field to store Vercel deployment URL
- **Job**: Existing entity, now supports "deploy-preview" command type to track deployment workflow status
- **Project**: Existing entity, may need Vercel project ID configuration for deployment targeting
- **Deployment Preview**: Conceptual entity representing the active preview deployment (only one active across all tickets)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can trigger a preview deployment and see the preview URL within 5 minutes of clicking the deploy icon
- **SC-002**: Users can successfully access preview deployments without manual Vercel dashboard navigation
- **SC-003**: System prevents multiple concurrent preview deployments with 100% enforcement (no race conditions)
- **SC-004**: Deployment failures are visible to users within 30 seconds of workflow failure
- **SC-005**: Preview icon appears on ticket cards within 2 seconds of deployment completion (via job polling)
- **SC-006**: Users can complete the full deployment workflow (trigger → wait → access preview) in under 10 clicks
- **SC-007**: 95% of deployments complete successfully without user intervention (excluding branch/code errors)
- **SC-008**: Preview URLs remain accessible for at least 24 hours after deployment
