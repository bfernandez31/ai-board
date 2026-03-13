# Research: BYOK - Bring Your Own API Key

**Branch**: `AIB-285-copy-of-byok` | **Date**: 2026-03-13

## Research Tasks & Findings

### 1. Encryption Algorithm for API Key Storage at Rest

**Decision**: AES-256-GCM via Node.js built-in `crypto` module

**Rationale**:
- AES-256-GCM provides authenticated encryption (confidentiality + integrity + authenticity)
- Node.js `crypto` module is battle-tested, requires no additional dependencies
- GCM mode produces an authentication tag that prevents tampering
- Each encryption generates a unique IV (initialization vector), ensuring identical plaintext produces different ciphertext

**Alternatives Considered**:
- **tweetnacl/libsodium**: Higher-level API but adds an external dependency (forbidden without justification per constitution)
- **AES-256-CBC + HMAC**: Two-step process, more error-prone; GCM combines both
- **One-way hashing** (like PAT system): Not viable; API keys must be decryptable for workflow dispatch

**Implementation Details**:
- Master key stored as `ENCRYPTION_MASTER_KEY` environment variable (32-byte hex string)
- Each encrypted record stores: `iv` (12 bytes), `ciphertext`, `authTag` (16 bytes)
- All stored as a single concatenated base64 string in the `encryptedKey` column

### 2. API Key Validation Endpoints

**Decision**: Use lightweight model-listing endpoints for each provider

**Rationale**:
- Both providers offer low-cost/free endpoints that validate authentication without consuming tokens
- Anthropic: `POST /v1/messages` with `max_tokens: 1` and a minimal prompt (cheapest validation)
- OpenAI: `GET /v1/models` (free, no token cost, validates API key)

**Alternatives Considered**:
- **Format-only validation** (prefix check): Insufficient; doesn't verify the key actually works
- **Full model call**: Wasteful; consumes real tokens for validation
- **Provider-specific auth endpoints**: Neither provider offers a dedicated "validate key" endpoint

**Implementation Details**:
- Anthropic key format: starts with `sk-ant-api03-` (validate prefix before API call)
- OpenAI key format: starts with `sk-` (validate prefix before API call)
- Validation timeout: 10 seconds
- On network failure: allow save with warning (per FR-014)

### 3. Passing API Keys to GitHub Workflows

**Decision**: Pass decrypted API keys as workflow dispatch inputs

**Rationale**:
- GitHub Actions automatically masks values passed as inputs when `::add-mask::` is used
- Workflow inputs are encrypted in transit (GitHub API uses HTTPS)
- Simpler than managing GitHub repository secrets programmatically (which requires separate API calls and permissions)
- Keys are available immediately in the workflow run without additional secret management

**Alternatives Considered**:
- **GitHub repository secrets API**: Complex lifecycle management (create/update/delete), requires additional GitHub permissions, race conditions with concurrent workflows
- **Encrypted file in repo**: Leaks to version history, complex key management
- **External secret manager** (Vault, AWS SSM): Over-engineering; adds infrastructure dependency

**Implementation Details**:
- Decrypt API keys server-side before dispatch
- Pass as `anthropic_api_key` and `openai_api_key` inputs
- Workflows use `::add-mask::${{ inputs.anthropic_api_key }}` to prevent log exposure
- For projects without BYOK keys (ai-board self-management), pass empty string; workflow falls back to repo secrets

### 4. Backward Compatibility for Self-Managed Projects

**Decision**: Conditional key injection with empty-string fallback

**Rationale**:
- When `ProjectAPIKey` records don't exist for a project, pass empty strings in workflow inputs
- Workflows check if the input is non-empty; if so, use it. Otherwise, fall back to repository secrets (`${{ secrets.ANTHROPIC_API_KEY }}`)
- Zero changes needed to existing ai-board workflow behavior

**Implementation Details**:
- No migration of existing projects required
- Detection logic: `SELECT * FROM ProjectAPIKey WHERE projectId = ?` - empty result means no BYOK
- Workflow YAML conditional: `${{ inputs.anthropic_api_key || secrets.ANTHROPIC_API_KEY }}`

### 5. Project Settings UI Pattern

**Decision**: New `APIKeysCard` component following existing settings card pattern

**Rationale**:
- Existing settings cards (`ClarificationPolicyCard`, `DefaultAgentCard`) provide a proven pattern
- Consistent UX for project owners
- Card-based layout allows showing both providers in a single section

**Implementation Details**:
- Separate API routes for key management (not reusing the project PATCH endpoint)
- Masked display: `sk-****{last4}` format
- Status indicators for members (non-owners): "Configured" / "Not configured"
- Owner-only actions: Add, Test, Replace, Delete

### 6. Database Model Design

**Decision**: New `ProjectAPIKey` model with `APIProvider` enum

**Rationale**:
- Separate model (not columns on Project) allows clean per-provider management
- Unique constraint on `[projectId, provider]` enforces one key per provider per project
- `APIProvider` enum (ANTHROPIC, OPENAI) is separate from existing `Agent` enum (CLAUDE, CODEX) because they represent different concepts
- Mapping needed: Agent.CLAUDE -> APIProvider.ANTHROPIC, Agent.CODEX -> APIProvider.OPENAI

**Implementation Details**:
- Fields: `id`, `projectId`, `provider`, `encryptedKey`, `preview`, `createdAt`, `updatedAt`
- `preview`: last 4 characters of plaintext key for masked display
- Cascade delete from Project ensures cleanup
