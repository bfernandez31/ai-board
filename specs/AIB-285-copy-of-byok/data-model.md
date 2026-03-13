# Data Model: BYOK - Bring Your Own API Key

**Branch**: `AIB-285-copy-of-byok` | **Date**: 2026-03-13

## New Entities

### ProjectAPIKey

Stores encrypted API keys associated with a project, one per provider.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Int | PK, auto-increment | Primary key |
| projectId | Int | FK -> Project.id, NOT NULL | Owning project |
| provider | APIProvider (enum) | NOT NULL | AI provider (ANTHROPIC, OPENAI) |
| encryptedKey | String (Text) | NOT NULL | AES-256-GCM encrypted key (base64: iv + ciphertext + authTag) |
| preview | String (VarChar(4)) | NOT NULL | Last 4 characters of plaintext key for masked display |
| createdAt | DateTime | NOT NULL, default now() | Record creation timestamp |
| updatedAt | DateTime | NOT NULL, @updatedAt | Last modification timestamp |

**Constraints**:
- `@@unique([projectId, provider])` - One key per provider per project
- `@@index([projectId])` - Fast lookup by project

**Relations**:
- `project: Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`
- Inverse: `Project.apiKeys: ProjectAPIKey[]`

### APIProvider (Enum)

```prisma
enum APIProvider {
  ANTHROPIC
  OPENAI
}
```

**Mapping to Agent enum**:
- `Agent.CLAUDE` -> `APIProvider.ANTHROPIC`
- `Agent.CODEX` -> `APIProvider.OPENAI`

## Prisma Schema Addition

```prisma
model ProjectAPIKey {
  id           Int         @id @default(autoincrement())
  projectId    Int
  provider     APIProvider
  encryptedKey String      @db.Text
  preview      String      @db.VarChar(4)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, provider])
  @@index([projectId])
}

enum APIProvider {
  ANTHROPIC
  OPENAI
}
```

**Project model update** (add relation):
```prisma
model Project {
  // ... existing fields ...
  apiKeys ProjectAPIKey[]
}
```

## State Transitions

API keys have simple CRUD lifecycle (no complex state machine):

```
[Not Configured] --save--> [Configured] --replace--> [Configured]
                                         --delete--> [Not Configured]
```

## Validation Rules

| Field | Validation | Source |
|-------|-----------|--------|
| provider | Must be valid APIProvider enum value | Zod schema |
| apiKey (input) | Trimmed, non-empty, format prefix check | FR-013 |
| apiKey (Anthropic) | Must start with `sk-ant-` | Edge case: format validation |
| apiKey (OpenAI) | Must start with `sk-` | Edge case: format validation |

## Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| ENCRYPTION_MASTER_KEY | String (64 hex chars = 32 bytes) | Master key for AES-256-GCM encryption/decryption |
