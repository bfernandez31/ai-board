# Data Model: BYOK - Bring Your Own API Key

**Date**: 2026-03-13 | **Branch**: `AIB-247-byok-bring-your`

## New Enum: ApiKeyProvider

```prisma
enum ApiKeyProvider {
  ANTHROPIC
  OPENAI
}
```

**Purpose**: Enumerates supported AI providers for API key storage.

## New Model: ProjectApiKey

```prisma
model ProjectApiKey {
  id           Int            @id @default(autoincrement())
  projectId    Int
  provider     ApiKeyProvider
  encryptedKey String         @db.VarChar(500) // AES-256-GCM encrypted: "iv:authTag:ciphertext" (hex)
  preview      String         @db.VarChar(4)   // Last 4 chars of plaintext key
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, provider]) // One key per provider per project
  @@index([projectId])
}
```

### Field Details

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PK, auto-increment | Record identifier |
| `projectId` | Int | FK → Project.id, cascade delete | Parent project |
| `provider` | ApiKeyProvider | Enum | AI provider (ANTHROPIC, OPENAI) |
| `encryptedKey` | String(500) | Not null | AES-256-GCM encrypted value in format `iv:authTag:ciphertext` (hex-encoded) |
| `preview` | String(4) | Not null | Last 4 characters of plaintext key for masked display |
| `createdAt` | DateTime | Default now() | Record creation timestamp |
| `updatedAt` | DateTime | @updatedAt | Last modification timestamp |

### Constraints

- **Unique**: `[projectId, provider]` — one key per provider per project
- **Index**: `[projectId]` — fast lookup by project
- **Cascade Delete**: When project is deleted, keys are deleted

### Relationships

- `ProjectApiKey` → `Project`: Many-to-one (a project can have up to N keys, one per provider)
- `Project` model needs a new relation field: `apiKeys ProjectApiKey[]`

## Schema Changes to Existing Models

### Project (add relation)

```prisma
model Project {
  // ... existing fields ...
  apiKeys ProjectApiKey[]  // NEW: BYOK API keys
}
```

## Validation Rules

### API Key Format Validation

| Provider | Prefix | Min Length | Pattern |
|----------|--------|-----------|---------|
| ANTHROPIC | `sk-ant-` | 20 | Starts with `sk-ant-`, alphanumeric + hyphens + underscores |
| OPENAI | `sk-` | 20 | Starts with `sk-` but NOT `sk-ant-`, alphanumeric + hyphens + underscores |

### Encryption Format

- **Input**: Plaintext API key string
- **Output**: `{iv}:{authTag}:{ciphertext}` where each segment is hex-encoded
- **IV**: 12 bytes (24 hex chars)
- **Auth Tag**: 16 bytes (32 hex chars)
- **Ciphertext**: Variable length based on key size

## State Transitions

```
No Key Configured
    │
    ▼ (POST /api-keys with valid key)
Key Configured (encrypted, preview stored)
    │           │
    │           ▼ (POST /api-keys with new key)
    │       Key Replaced (old deleted, new encrypted)
    │
    ▼ (DELETE /api-keys/[provider])
No Key Configured
```

## Migration Notes

- New migration: `add_project_api_keys`
- No data migration needed (new table, no existing data)
- New environment variable required: `API_KEY_ENCRYPTION_KEY` (64 hex chars = 32 bytes)
