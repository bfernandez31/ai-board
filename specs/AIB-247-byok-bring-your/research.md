# Research: BYOK - Bring Your Own API Key

**Date**: 2026-03-13 | **Branch**: `AIB-247-byok-bring-your`

## Research Area 1: AES-256-GCM Encryption for API Key Storage

**Decision**: Use Node.js native `crypto` module with AES-256-GCM authenticated encryption.

**Rationale**:
- AES-256-GCM provides both confidentiality and integrity (authenticated encryption)
- Node.js `crypto` module is built-in, no external dependencies needed (aligns with constitution's forbidden dependencies)
- GCM mode produces an authentication tag that detects tampering
- Industry standard for encrypting secrets at rest

**Implementation Details**:
- Encryption key: 32-byte (256-bit) key from `process.env.API_KEY_ENCRYPTION_KEY` (hex-encoded, 64 chars)
- IV (Initialization Vector): 12 bytes, randomly generated per encryption operation via `crypto.randomBytes(12)`
- Auth tag: 16 bytes, produced by GCM mode
- Storage format: `iv:authTag:ciphertext` (all hex-encoded, concatenated with `:` separator)
- Decrypt: Split stored value by `:`, reconstruct IV + authTag + ciphertext, decrypt with same key

**Alternatives Considered**:
- **External library (libsodium/tweetnacl)**: Adds dependency, violates constitution's minimalism. Rejected.
- **AWS KMS / Vault**: Over-engineered for current scale, adds infrastructure dependency. Rejected.
- **Hash-only (like PersonalAccessToken)**: Cannot decrypt for workflow use. Rejected — BYOK requires decryption.

**Key Rotation Strategy**:
- Environment variable rotation: Update `API_KEY_ENCRYPTION_KEY`, re-encrypt all stored keys via migration script
- Not a user-facing feature; operational concern as noted in spec edge cases

## Research Area 2: Provider API Validation Endpoints

**Decision**: Use lightweight provider-specific endpoints to validate API keys.

**Rationale**:
- Real-time validation chosen per CONSERVATIVE spec policy
- Each provider has lightweight endpoints that confirm key validity without incurring significant cost

**Provider Validation**:

| Provider | Endpoint | Method | Purpose |
|----------|----------|--------|---------|
| Anthropic | `https://api.anthropic.com/v1/messages` | POST (minimal) | Send minimal request; 401 = invalid key, 200/400 = valid key |
| OpenAI | `https://api.openai.com/v1/models` | GET | List models; 401 = invalid key, 200 = valid key |

**Anthropic Validation**:
- POST to `/v1/messages` with `x-api-key` header, `anthropic-version: 2023-06-01`
- Minimal body: `{ model: "claude-sonnet-4-20250514", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }`
- Response: 401 = invalid, 400 (invalid model) or 200 = key is valid
- Alternative: Use a cheaper check — send an invalid request body and check for 401 vs 400. A 400 "invalid request" means the key authenticated successfully.

**OpenAI Validation**:
- GET to `/v1/models` with `Authorization: Bearer sk-...` header
- Response: 401 = invalid, 200 = valid

**Format Validation (Pre-API check)**:
- Anthropic: Must start with `sk-ant-` (current format)
- OpenAI: Must start with `sk-` (and NOT `sk-ant-`)

**Alternatives Considered**:
- **Format-only validation**: Fast but accepts revoked keys. Rejected per CONSERVATIVE policy.
- **Full message generation**: Works but wasteful (costs tokens). Rejected — use minimal/invalid requests.

## Research Area 3: Workflow Key Injection

**Decision**: Decrypt API key server-side and pass as workflow input string.

**Rationale**:
- Existing workflow dispatch pattern (`lib/workflows/transition.ts`) passes all inputs as strings
- GitHub Actions workflow inputs are strings — encryption at this layer adds complexity without benefit since GitHub encrypts secrets in transit
- The key is already encrypted at rest in PostgreSQL; decryption happens only at dispatch time

**Implementation**:
1. Before `octokit.actions.createWorkflowDispatch()`, look up `ProjectApiKey` for the project
2. Decrypt the relevant provider key (based on `ticket.project.defaultAgent` or workflow requirement)
3. Add to `workflowInputs`: `anthropicApiKey` or `openaiApiKey`
4. Workflow YAML receives as `${{ github.event.inputs.anthropicApiKey }}` and sets as env var

**Security Considerations**:
- GitHub Actions inputs are NOT masked by default in logs — workflows must use `::add-mask::` to mask the key value
- Keys are transmitted over HTTPS (GitHub API)
- Keys are visible in workflow dispatch event payload to repo admins — acceptable for BYOK (user's own key, user's own repo)

**Alternatives Considered**:
- **GitHub repository secrets**: Would require dynamically creating/updating secrets via API — complex, rate-limited. Rejected.
- **Encrypted payload + in-workflow decrypt**: Requires sharing encryption key with workflows — adds operational complexity. Rejected.

## Research Area 4: Authorization & Access Control

**Decision**: Use existing `verifyProjectOwnership()` for mutation endpoints, `verifyProjectAccess()` for read (masked) endpoints.

**Rationale**:
- Spec FR-009: Only project owners can add/update/delete/test keys
- Spec FR-010: Members can see masked key status
- Existing auth helpers in `lib/auth.ts` provide exactly these two access levels

**Implementation**:
- `POST /api/projects/[projectId]/api-keys` → `verifyProjectOwnership(projectId)`
- `DELETE /api/projects/[projectId]/api-keys/[provider]` → `verifyProjectOwnership(projectId)`
- `POST /api/projects/[projectId]/api-keys/[provider]/validate` → `verifyProjectOwnership(projectId)`
- `GET /api/projects/[projectId]/api-keys` → `verifyProjectAccess(projectId)` (returns masked data only)

## Research Area 5: UI Integration Pattern

**Decision**: Follow existing settings card pattern (`clarification-policy-card.tsx`, `default-agent-card.tsx`).

**Rationale**:
- Consistent UX with existing settings page
- Proven pattern: useState for form, fetch for API calls, router.refresh() for revalidation
- shadcn/ui components (Card, Input, Button, Badge, Alert) available

**UI Design**:
- New `ApiKeysCard` component added to project settings page
- Two provider sections (Anthropic, OpenAI) each with:
  - Status indicator (configured/not configured)
  - Masked preview when configured (e.g., "sk-ant-...a1b2")
  - Input field for adding/replacing key
  - "Save" button, "Test" button (when saved), "Remove" button (when saved)
- Non-owners see read-only status (configured/not configured, no input fields)

## Research Area 6: Billing Tier Integration

**Decision**: Check for configured API keys at workflow dispatch time; FREE plan requires BYOK.

**Rationale**:
- Existing billing system in `lib/billing/plans.ts` already states "BYOK API key required" for FREE plan
- Spec FR-008: Block workflow when required key is missing
- Future: Paid plans may provide platform keys (out of scope)

**Implementation**:
- At workflow dispatch in `lib/workflows/transition.ts`:
  1. Look up user's effective plan
  2. If FREE plan → require ProjectApiKey for the relevant provider
  3. If PRO/TEAM plan → use platform key fallback (future) or require BYOK (initial implementation treats all plans the same for now)
  4. If no key found → throw error, block workflow with actionable message
- For initial implementation: All plans require BYOK (simplest, safest). Platform key logic deferred to separate ticket.
