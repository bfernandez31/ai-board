# Quickstart: BYOK - gestion des cles API utilisateur pour les agents AI

**Feature**: AIB-431-byok-gestion-des  
**Date**: 2026-03-31  
**Purpose**: Validate the planned user and workflow behavior before implementation tasks begin

## Prerequisites
- `bun run dev`
- PostgreSQL running with migrated schema
- Test users/projects available with one project owner and at least one project member
- `WORKFLOW_API_TOKEN` configured for workflow-authenticated API calls
- Provider verification environment ready for Anthropic credential checks

## Scenario 1: Save a Valid Anthropic Credential
**User Goal**: A signed-in user configures a usable Anthropic credential from personal settings.

1. Navigate to `/settings/ai-credentials`
2. Verify the page shows the existing masked credential state or an empty state
3. Open the save credential dialog
4. Select provider `Anthropic`
5. Select credential type `API key`
6. Enter label `Primary Anthropic`
7. Enter a syntactically valid secret
8. Verify the submit action remains disabled until required fields pass local validation
9. Submit the form
10. Verify the server confirms usability and the page returns to a masked summary view

**Expected Result**:
- The stored credential displays only masked preview, label, provider, type, readiness state, and timestamps
- The full secret is not shown again after save

## Scenario 2: Member Launch Uses Owner Credential
**User Goal**: A project member launches a workflow, but the project owner's credential is the only credential used.

1. Create or select a project whose owner has a `READY` Anthropic credential
2. Sign in as a non-owner project member
3. Trigger a workflow launch for that project
4. Observe the launch preparation request
5. Verify the workflow retrieves the owner credential through the internal workflow-only endpoint

**Expected Result**:
- Launch succeeds without using the member's own credential
- Workflow response indicates the owner credential auth mode that matches the owner's saved type

## Scenario 3: Block Launch When Owner Credential Is Missing
**User Goal**: A launch fails safely before any AI step when the owner credential is not usable.

1. Remove the project owner's Anthropic credential or mark it invalid
2. Trigger the same workflow launch from either the owner or a member account
3. Observe the launch response and UI feedback

**Expected Result**:
- No AI execution begins
- Response carries an actionable remediation message such as "Project owner must configure a valid Anthropic credential in Settings"
- No shared fallback credential is used

## Scenario 4: Replace Existing Credential
**User Goal**: A user rotates an Anthropic credential and the next workflow uses the new one.

1. Start with an existing `READY` Anthropic credential
2. Open the save credential dialog again
3. Change the label and secret value
4. Submit and pass verification
5. Launch a new workflow on an owned project

**Expected Result**:
- The masked summary reflects the replacement metadata
- The old credential is no longer used for future workflow retrieval
- The next launch resolves the new credential immediately

## Scenario 5: Delete Credential Without Re-Exposure
**User Goal**: A user removes a credential and cannot recover the old secret afterward.

1. Start with an existing `READY` credential visible in masked form
2. Trigger the delete action and confirm the destructive dialog
3. Reload `/settings/ai-credentials`
4. Attempt a workflow launch on an owned project

**Expected Result**:
- The settings page shows no active credential for Anthropic
- The previous secret is never displayed
- The next workflow launch is blocked before AI execution

## Validation Checklist
- [ ] Saving requires label, provider, type, and a format-valid secret
- [ ] Post-save views show only masked secret preview
- [ ] Only one active Anthropic credential exists per user
- [ ] Project members never substitute their own credential for a project owner's workflow
- [ ] Missing/invalid owner credentials block launches with remediation guidance
- [ ] Replacement and deletion affect the next workflow launch immediately
