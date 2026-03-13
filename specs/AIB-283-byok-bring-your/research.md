# Research: BYOK - Bring Your Own API Key

**Feature**: AIB-283-byok-bring-your  
**Date**: 2026-03-13

## Decision 1: Store project provider keys as encrypted plaintext, not hashes

**Decision**: Persist Anthropic and OpenAI project credentials as encrypted blobs using server-side symmetric encryption, with masked last-four metadata stored alongside validation metadata.

**Rationale**:
- Workflow jobs must eventually use the real provider secret, so one-way hashing like personal access tokens is insufficient.
- Encryptable storage keeps the application compliant with the spec requirement that plaintext is not retrievable through routine data access.
- A dedicated server-side encryption helper keeps secret handling centralized and auditable.

**Alternatives considered**:
- Reuse PAT-style hash-only storage: rejected because workflow execution cannot reconstruct the secret.
- Store provider keys only in GitHub Actions secrets: rejected because credentials are per-project, user-managed, and must support runtime rotation/deletion from the app.
- Pass raw secrets in workflow dispatch inputs: rejected because workflow inputs are too visible and risky for long-lived secrets.

## Decision 2: Capture launch-time credential snapshots per job

**Decision**: When a workflow launch is approved, copy each required provider credential into a `JobAiCredentialSnapshot` record in the same launch transaction.

**Rationale**:
- The spec explicitly requires key replacement/deletion to affect only future launches.
- Job-scoped snapshots remove race conditions between workflow queue time and owner rotation/removal.
- Workflow execution can fetch only the snapshot tied to its job, which narrows blast radius and simplifies authorization.

**Alternatives considered**:
- Read the latest project credential during workflow execution: rejected because in-flight jobs would see rotated/deleted credentials unpredictably.
- Store credential snapshots in workflow environment files only: rejected because the app still needs an auditable source of truth for retries and runtime retrieval.

## Decision 3: Retrieve workflow credentials through a workflow-token endpoint

**Decision**: Add a workflow-only API endpoint that returns decrypted job-scoped credential snapshots for the authenticated workflow job.

**Rationale**:
- GitHub Actions secrets cannot be created dynamically per project/job at dispatch time from the app.
- Existing workflows already authenticate back to the app with `WORKFLOW_API_TOKEN`, so this is consistent with current job-status update patterns.
- A runtime fetch avoids putting secrets in workflow dispatch metadata, logs, or persisted GitHub workflow input history.

**Alternatives considered**:
- Embed secrets in workflow dispatch inputs: rejected due to exposure risk.
- Persist every project credential in repository/org secrets: rejected because the platform is multi-project and BYOK is managed from the product, not from GitHub settings.
- Require workflows to decrypt secrets locally: rejected because the decryption key should remain server-side.

## Decision 4: Extend current agent auth model to support BYOK provider keys directly

**Decision**: Update runtime agent authentication so Claude workflows accept `ANTHROPIC_API_KEY` and Codex workflows accept `OPENAI_API_KEY`, with BYOK values coming from the workflow credential endpoint.

**Rationale**:
- Current workflows rely on `CLAUDE_CODE_OAUTH_TOKEN` and `CODEX_AUTH_JSON`, but the feature spec explicitly asks owners to provide Anthropic and OpenAI API keys.
- Codex already supports `OPENAI_API_KEY` in `run-agent.sh`; Claude support needs to be expanded to accept API-key auth for BYOK runs.
- This keeps the UX aligned with the requested provider model and avoids forcing users to provide CLI-specific opaque auth artifacts.

**Alternatives considered**:
- Ask users for Claude Code OAuth tokens / Codex auth JSON: rejected because it contradicts the spec and is less product-friendly.
- Translate provider API keys into GitHub repository secrets before each run: rejected because it creates extra secret propagation paths and cleanup risk.

## Decision 5: Centralize provider-requirement resolution from workflow command + effective agent

**Decision**: Build a single requirement resolver that maps launch context to required providers. For the current system, Claude-based commands require `ANTHROPIC`, Codex-based commands require `OPENAI`, and the resolver remains array-based for future multi-provider workflows.

**Rationale**:
- Existing transition logic already resolves an effective agent before workflow dispatch.
- A centralized resolver avoids scattering provider checks across routes and workflows.
- Array-based requirements satisfy the spec’s future-facing requirement that a workflow may need one or multiple providers.

**Alternatives considered**:
- Hardcode checks directly in each workflow transition branch: rejected because it duplicates logic and complicates future multi-provider support.
- Infer requirements only in GitHub workflow YAML: rejected because the spec requires blocking before the workflow starts.

## Decision 6: Validate saved credentials with provider-safe probes and sanitized error mapping

**Decision**: Implement provider-specific validation adapters that make a minimal authenticated probe, classify the result into `VALID`, `INVALID`, or `ERROR`, and store only provider-safe guidance.

**Rationale**:
- The spec requires actionable guidance without leaking raw provider payloads.
- Validation should be explicit and repeatable after save, after rotation, and when owners suspect revocation/quota issues.
- A normalized result model lets workflow gating and settings UI share the same state.

**Alternatives considered**:
- Trust format-only validation: rejected because revoked or quota-blocked keys would still appear usable.
- Surface raw provider responses: rejected because they may contain sensitive or low-signal details and violate secrecy requirements.
- Validate only during workflow launch: rejected because owners need explicit feedback in settings before launching.

## Decision 7: Use backend integration tests as the primary verification layer

**Decision**: Cover the feature mainly with Vitest backend integration tests, plus small unit/component suites for crypto helpers and settings UI state.

**Rationale**:
- The core risk is API/auth/database/workflow interaction, which matches the repo’s Testing Trophy guidance for backend integration tests.
- No browser-only behavior is required; project settings interactions can be exercised in component tests without Playwright.
- This keeps the plan aligned with the mandated `/ai-board:testing` skill.

**Alternatives considered**:
- Playwright end-to-end coverage for the full settings flow: rejected for initial rollout because it adds cost without browser-exclusive value.
- Unit-test-only approach: rejected because authorization, Prisma persistence, and workflow gating are the highest-risk surfaces.
