# Quickstart: BYOK - Bring Your Own API Key

**Feature**: AIB-283-byok-bring-your  
**Date**: 2026-03-13

## Implementation Order

### Phase 1: Schema and shared types
1. Add `AiProvider`, `AiCredentialValidationStatus`, and `WorkflowCredentialSource` enums to `prisma/schema.prisma`.
2. Add `ProjectAiCredential` and `JobAiCredentialSnapshot` models plus `Project`/`Job` relations.
3. Run `bunx prisma generate` after the schema change.
4. Create `app/lib/types/ai-credentials.ts` for response and domain types.

### Phase 2: Security and provider services
5. Create `app/lib/security/project-ai-credentials.ts` for encrypt/decrypt helpers using a server-only master key.
6. Create `app/lib/services/ai-provider-validation.ts` for Anthropic/OpenAI validation probes and safe error mapping.
7. Create `app/lib/services/workflow-provider-requirements.ts` for command/agent -> provider resolution.
8. Create `app/lib/services/ai-credential-service.ts` for save/list/delete/revalidate/snapshot orchestration.

### Phase 3: API surface
9. Add `app/lib/schemas/ai-credentials.ts` for request validation.
10. Implement `GET /api/projects/[projectId]/ai-credentials`.
11. Implement `PUT` and `DELETE /api/projects/[projectId]/ai-credentials/[provider]`.
12. Implement `POST /api/projects/[projectId]/ai-credentials/[provider]/validate`.
13. Implement workflow-only `GET /api/projects/[projectId]/jobs/[jobId]/provider-credentials`.

### Phase 4: UI integration
14. Create `components/settings/ai-provider-status-row.tsx`.
15. Create `components/settings/ai-credentials-card.tsx`.
16. Wire the card into `app/projects/[projectId]/settings/page.tsx`, preserving existing settings cards.
17. Ensure owner-only actions and member-only read states are rendered distinctly.

### Phase 5: Workflow gating and runtime consumption
18. Extend `lib/workflows/transition.ts` to resolve provider requirements before dispatch.
19. Persist job credential snapshots before workflow dispatch and clean up the pending job if gating fails.
20. Extend `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` error contract for BYOK gating failures.
21. Update `.github/scripts/run-agent.sh` to accept `ANTHROPIC_API_KEY` for Claude and `OPENAI_API_KEY` for Codex BYOK runs.
22. Update workflow YAML files to fetch job-scoped provider credentials at runtime and export them only for the current job process.

### Phase 6: Verification
23. Add unit tests for crypto helpers and provider requirement resolution.
24. Add component tests for the settings card owner/member states and masked rendering.
25. Add backend integration tests for credential CRUD/validation and transition blocking.
26. Run `bun run type-check`, `bun run lint`, and targeted test suites.

## Key Patterns To Follow

### Project settings card pattern
Reference: `components/settings/default-agent-card.tsx`

- Keep the BYOK UI as a card rendered on the existing project settings page.
- Use shadcn/ui card, dialog, input, button, and badge primitives.
- Use `router.refresh()` after owner mutations so the server component page reflects fresh status.

### Project API authorization pattern
Reference: `app/api/projects/[projectId]/route.ts`

- Parse `projectId` from route params.
- Use Zod request parsing.
- Map `Unauthorized` and `Project not found` consistently.
- For owner-only mutations, call `verifyProjectOwnership(projectId)`.

### Workflow-authenticated endpoint pattern
Reference: `app/api/projects/[projectId]/tickets/[id]/preview-url/route.ts`

- Accept only workflow bearer-token auth.
- Verify the workflow token before reading any credential snapshot.
- Return structured errors with stable codes.

### Transition gating pattern
Reference: `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` and `lib/workflows/transition.ts`

- Keep launch blocking in server-side transition flow before GitHub dispatch.
- Return a BYOK-specific error payload naming every missing or invalid provider.
- Do not create a queued workflow that is guaranteed to fail later.

## Testing Strategy

Following the `/ai-board:testing` skill:

| Test Type | Location | Coverage |
|-----------|----------|----------|
| Unit | `tests/unit/project-ai-credentials.test.ts` | encryption/decryption, masking, constant-time comparisons where relevant |
| Unit | `tests/unit/ai-provider-requirements.test.ts` | command/agent -> provider requirement mapping |
| Component | `tests/unit/components/ai-credentials-card.test.tsx` | owner actions, member read-only state, masked suffix rendering, validation messaging |
| Backend Integration | `tests/integration/projects/ai-credentials.test.ts` | credential CRUD, owner/member authorization, validation result persistence |
| Backend Integration | `tests/integration/tickets/transition-byok.test.ts` | workflow launch blocked for missing/invalid providers and allowed when valid |

No E2E test is planned for the first implementation because the feature risk is in API/auth/workflow orchestration, not browser-only behavior.

## Files To Reference

| File | Why |
|------|-----|
| `app/projects/[projectId]/settings/page.tsx` | Existing settings page composition |
| `components/settings/default-agent-card.tsx` | Settings card mutation pattern |
| `app/api/projects/[projectId]/route.ts` | Project API error/validation pattern |
| `lib/workflows/transition.ts` | Existing workflow dispatch path to extend |
| `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` | Current transition route and error handling |
| `.github/scripts/run-agent.sh` | Current CLAUDE/CODEX auth behavior |
| `.github/workflows/speckit.yml` | Workflow environment and runtime setup |
| `lib/tokens/generate.ts` | Existing crypto utility style |
| `tests/integration/projects/settings.test.ts` | Existing project settings integration suite to extend |

## Required Environment Additions

- `PROJECT_CREDENTIAL_ENCRYPTION_KEY`: 32-byte base64 or hex-encoded server secret used only on the app server for BYOK encryption/decryption.

Do not store project BYOK secrets in `.env` files; this key is only the master encryption material.
