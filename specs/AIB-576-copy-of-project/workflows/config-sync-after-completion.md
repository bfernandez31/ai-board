# Workflow Design: Config Synchronization After Completion

## Purpose

Finalize onboarding by re-syncing the project configuration into application state after the onboarding workflow reports success.

## Workflow Definition

### Trigger

Internal application step executed during successful setup callback handling.

### Inputs

| Input | Source |
|-------|--------|
| `projectId` | Route parameter / attempt relation |
| `githubOwner` | `Project` |
| `githubRepo` | `Project` |
| `artifactSummary` | Callback payload |

### Execution steps

1. Load the project tied to the setup attempt.
2. Call `syncProjectConfig()` with the project’s repo coordinates.
3. If sync succeeds:
   - persist final attempt status `COMPLETED`
   - leave `artifactSummary` attached for UI review
4. If sync fails:
   - persist final attempt status `FAILED`
   - set `failureCode=CONFIG_SYNC_FAILED`
   - preserve the returned `artifactSummary` so the owner can understand partial progress

## Agent Command Specification

No new external agent command is required. This process reuses the existing application-side `lib/config-sync.ts` implementation, which remains the authority on whether the repository now contains valid synced configuration.

## Callback / Reporting Contract

- Success response to the workflow callback should reflect the final persisted state after sync, not the pre-sync callback input.
- The UI contract must allow a failed sync to show both:
  - why the project is still not onboarded
  - which files were already created or preserved by the workflow
- Once sync succeeds, subsequent visits to `/projects/:projectId` and `/projects/:projectId/board` must bypass setup automatically.
