# Quickstart: BYOK Implementation

**Branch**: `AIB-247-byok-bring-your` | **Date**: 2026-03-13

## Prerequisites

- `API_KEY_ENCRYPTION_KEY` environment variable (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Prisma migration applied (`bunx prisma migrate dev`)

## Implementation Order

### Step 1: Database Schema

1. Add `ApiKeyProvider` enum and `ProjectApiKey` model to `prisma/schema.prisma`
2. Add `apiKeys` relation to `Project` model
3. Run `bunx prisma migrate dev --name add_project_api_keys`

### Step 2: Encryption Utilities

1. Create `lib/crypto/encryption.ts` with:
   - `encrypt(plaintext: string): string` — AES-256-GCM, returns `iv:authTag:ciphertext`
   - `decrypt(encrypted: string): string` — Reverse operation
   - Key from `process.env.API_KEY_ENCRYPTION_KEY`

### Step 3: Format Validation

1. Create `lib/validation/api-key-formats.ts` with:
   - `validateApiKeyFormat(provider: ApiKeyProvider, key: string): { valid: boolean; error?: string }`
   - Anthropic: prefix `sk-ant-`, min length 20
   - OpenAI: prefix `sk-` (not `sk-ant-`), min length 20

### Step 4: Database Operations

1. Create `lib/db/api-keys.ts` with:
   - `getApiKeysByProject(projectId: number): Promise<ApiKeyStatus[]>`
   - `saveApiKey(projectId: number, provider: ApiKeyProvider, encryptedKey: string, preview: string): Promise<ProjectApiKey>`
   - `deleteApiKey(projectId: number, provider: ApiKeyProvider): Promise<void>`
   - `getEncryptedKey(projectId: number, provider: ApiKeyProvider): Promise<string | null>`

### Step 5: API Routes

1. `app/api/projects/[projectId]/api-keys/route.ts` — GET (list), POST (save/replace)
2. `app/api/projects/[projectId]/api-keys/[provider]/route.ts` — DELETE
3. `app/api/projects/[projectId]/api-keys/[provider]/validate/route.ts` — POST (test)

### Step 6: UI Component

1. Create `components/settings/api-keys-card.tsx`
2. Add to project settings page at `app/projects/[projectId]/settings/page.tsx`

### Step 7: Workflow Integration

1. Update `lib/workflows/transition.ts` to retrieve and inject decrypted API keys
2. Update workflow YAML files to accept and mask API key inputs

### Step 8: Tests

1. Unit: `tests/unit/crypto-encryption.test.ts`, `tests/unit/api-key-formats.test.ts`
2. Integration: `tests/integration/api-keys/crud.test.ts`
3. Component: `tests/unit/components/api-keys-card.test.tsx`

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Add ProjectApiKey model |
| `lib/crypto/encryption.ts` | AES-256-GCM encrypt/decrypt |
| `lib/validation/api-key-formats.ts` | Provider format validation |
| `lib/db/api-keys.ts` | Database CRUD operations |
| `app/api/projects/[projectId]/api-keys/route.ts` | List + Save endpoints |
| `app/api/projects/[projectId]/api-keys/[provider]/route.ts` | Delete endpoint |
| `app/api/projects/[projectId]/api-keys/[provider]/validate/route.ts` | Validation endpoint |
| `components/settings/api-keys-card.tsx` | Settings UI card |
| `lib/workflows/transition.ts` | Workflow key injection (modify) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY_ENCRYPTION_KEY` | Yes | 32-byte hex-encoded key for AES-256-GCM (64 hex chars) |
