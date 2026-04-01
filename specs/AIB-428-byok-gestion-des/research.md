# Research: BYOK - User API Key Management

**Branch**: `AIB-428-byok-gestion-des` | **Date**: 2026-03-31

## R1: AES-256-GCM Encryption for Credential Storage

**Decision**: Use Node.js native `crypto` module with AES-256-GCM for symmetric encryption of credentials at rest.

**Rationale**:
- AES-256-GCM provides authenticated encryption (confidentiality + integrity) in a single operation
- Node.js `crypto.createCipheriv` / `crypto.createDecipheriv` are battle-tested, zero-dependency
- GCM mode produces a 16-byte authentication tag that prevents tampering
- 12-byte random IV (nonce) per encryption ensures unique ciphertexts even for identical inputs
- The project already uses `crypto` for token generation (`lib/tokens/generate.ts`), so this is consistent

**Alternatives considered**:
- **libsodium (sodium-native)**: More ergonomic API but adds a native dependency; overkill for this use case
- **AWS KMS / envelope encryption**: Better for key rotation but adds external dependency and latency; deferred to future iteration as noted in spec auto-resolved decision
- **bcrypt/scrypt hashing**: Not applicable — we need reversible encryption, not one-way hashing

**Implementation details**:
- Master key: 32-byte hex string in `CREDENTIAL_ENCRYPTION_KEY` env var (256 bits)
- IV: 12 bytes, randomly generated per encryption, stored alongside ciphertext
- Auth tag: 16 bytes, extracted from cipher and stored alongside ciphertext
- Storage format: Store IV, auth tag, and ciphertext as separate database columns (not concatenated blob) for clarity

## R2: Credential Validation Against Anthropic API

**Decision**: Validate API keys by calling the Anthropic `/v1/messages` endpoint with a minimal request; validate OAuth tokens by calling `/v1/models` (list models).

**Rationale**:
- Anthropic does not provide a dedicated "validate key" endpoint
- A minimal messages request (`max_tokens: 1`, short prompt) costs < 0.001 cents and confirms the key works
- For OAuth tokens, listing models is a read-only operation that confirms token validity
- Client-side format validation (`sk-ant-` prefix for API keys) catches typos before server round-trip

**Alternatives considered**:
- **Skip server-side validation**: Unacceptable — users would only discover invalid keys when workflows fail
- **HEAD request to Anthropic**: Not supported by Anthropic API
- **Validate only on first workflow use**: Poor UX — delayed error after credential setup

**Implementation details**:
- API key format regex: `/^sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}$/` (Anthropic API key v3 format)
- OAuth token validation: Call `GET https://api.anthropic.com/v1/models` with Bearer token
- Timeout: 10 seconds for validation call
- Error distinction: Separate "invalid key" (401/403) from "provider unreachable" (network error/timeout)

## R3: Workflow Credential Injection Pattern

**Decision**: Workflows retrieve the credential via a new internal API endpoint (`GET /api/internal/credentials?projectId=X`) authenticated by `WORKFLOW_API_TOKEN`, then set the appropriate env var before executing Claude commands.

**Rationale**:
- Credentials must NOT be passed as workflow dispatch inputs (GitHub stores inputs in logs)
- The existing pattern of workflows calling back to the app via `WORKFLOW_API_TOKEN` auth is well-established (used for job status updates, comments)
- The workflow already has `APP_URL` and `WORKFLOW_API_TOKEN` as env vars
- Retrieving at workflow runtime ensures the latest credential is always used

**Alternatives considered**:
- **GitHub encrypted secrets per-user**: GitHub Actions secrets are repo-level, not user-level; doesn't work for multi-user
- **Pass credential as encrypted workflow input**: Still visible in GitHub Actions logs as input; encryption adds complexity
- **Store credential in GitHub environment**: Same repo-level limitation

**Implementation details**:
- Endpoint: `GET /api/internal/credentials?projectId={id}&type={API_KEY|OAUTH_TOKEN}`
- Auth: Bearer token matching `WORKFLOW_API_TOKEN` (same as job status endpoint)
- Response: `{ envVar: "ANTHROPIC_API_KEY", value: "sk-ant-..." }` — decrypted, plain text, HTTPS only
- Workflow integration: `curl` call at workflow start, before Claude commands, exports env var
- The endpoint resolves projectId → project.userId → UserCredential

## R4: One Credential Per Provider Per User Model

**Decision**: Enforce a unique constraint `(userId, provider)` in the database. Creating a credential for an existing provider replaces (upserts) the old one.

**Rationale**:
- Simplest model that meets requirements — no key selection UI needed
- Matches spec auto-resolved decision (CONSERVATIVE: avoid key sprawl)
- The `preview` field (last 4 chars) provides enough identification for the UI
- Future expansion to per-project keys only requires relaxing the unique constraint

**Alternatives considered**:
- **Multiple keys per provider**: Adds UI complexity for key selection; no user request for this
- **Per-project keys**: Deferred — spec explicitly chose per-user model for launch

## R5: Team/Multi-Member Credential Resolution

**Decision**: When a workflow runs for a project, always use the project owner's credential (`project.userId → UserCredential`). Team members who trigger workflows do not need their own credentials.

**Rationale**:
- Spec auto-resolved decision: project owner bears AI costs
- Simple authorization: no need to check triggering user's credentials
- Consistent behavior regardless of who triggers the workflow
- The `verifyProjectAccess` helper already resolves project ownership

**Alternatives considered**:
- **Use triggering user's credential**: Adds complexity; who pays for @ai-board mentions?
- **Fallback chain (triggering user → owner)**: Unpredictable cost attribution
- **Project-level credential**: Already rejected in spec (one credential per user, not per project)

## R6: Credential Display and Security

**Decision**: Store only the last 4 characters of the credential in a separate `preview` column. Never return the encrypted value or full credential to the client.

**Rationale**:
- Follows the same pattern as `PersonalAccessToken.preview` in the existing codebase
- The `preview` field is populated at creation time and is the only credential-related data sent to the frontend
- The encrypted value, IV, and auth tag columns are excluded from all client-facing queries

**Alternatives considered**:
- **Derive preview from encrypted value on read**: Requires decryption on every list request; wasteful
- **Show no preview at all**: Poor UX — users can't distinguish credentials

## R7: Settings UI Architecture

**Decision**: Create a new settings page at `/settings/credentials` following the existing `/settings/tokens` pattern, using shadcn/ui form components with TanStack Query for state management.

**Rationale**:
- `/settings/tokens` is the closest existing analog — same user-level settings pattern
- Uses existing layout and navigation structure
- TanStack Query provides optimistic updates for create/delete operations
- shadcn/ui `Card`, `Input`, `Select`, `Button`, and `Dialog` components cover all UI needs

**Alternatives considered**:
- **Embed in project settings**: Spec says credentials are per-user, not per-project
- **Modal-only (no dedicated page)**: Insufficient for manage/test/replace flows
