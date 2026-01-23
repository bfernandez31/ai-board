# Data Model: Personal Access Tokens

**Feature Branch**: `AIB-173-personal-access-tokens`
**Date**: 2026-01-23

## Entity Definitions

### PersonalAccessToken

Represents a user's API authentication credential for external tool access.

#### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | Int | PK, auto-increment | Unique identifier |
| `userId` | String | FK → User.id, NOT NULL | Owner of the token |
| `name` | String | VARCHAR(100), NOT NULL | User-provided label (e.g., "My MCP Server") |
| `hash` | String | VARCHAR(64), NOT NULL | SHA-256 hash of salt+token (hex encoded) |
| `salt` | String | VARCHAR(32), NOT NULL | 16-byte random salt (hex encoded) |
| `preview` | String | VARCHAR(4), NOT NULL | Last 4 characters of token for display |
| `lastUsedAt` | DateTime | NULL | Timestamp of last successful authentication |
| `createdAt` | DateTime | NOT NULL, default now() | Token creation timestamp |

#### Relationships

- **User** (N:1): Each token belongs to exactly one user
- Cascade delete: Token deleted when owning User deleted

#### Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| Primary | `id` | Unique lookup |
| Unique | `(userId, hash)` | Prevent duplicate tokens per user |
| Index | `userId` | List tokens by user |
| Index | `preview` | Fast pre-filter during validation |

#### Prisma Schema

```prisma
model PersonalAccessToken {
  id         Int       @id @default(autoincrement())
  userId     String
  name       String    @db.VarChar(100)
  hash       String    @db.VarChar(64)
  salt       String    @db.VarChar(32)
  preview    String    @db.VarChar(4)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, hash])
  @@index([userId])
  @@index([preview])
}
```

---

### User (Extended)

Add relation to PersonalAccessToken model.

#### New Relationship

```prisma
model User {
  // ... existing fields ...
  personalAccessTokens PersonalAccessToken[]
}
```

---

## Validation Rules

### Token Name
- **Required**: Yes
- **Length**: 1-100 characters
- **Format**: Any UTF-8 string
- **Uniqueness**: Not required (users may reuse names like "CI Pipeline")

### Token Generation
- **Format**: `pat_{64-hex-chars}` (68 total characters)
- **Entropy**: 32 bytes (256 bits) from `crypto.randomBytes()`
- **Salt**: 16 bytes (32 hex chars) per token

### Token Validation
- **Header**: `Authorization: Bearer pat_xxxxx...`
- **Lookup**: Filter by preview (last 4 chars), then verify hash
- **Hash check**: `sha256(salt + token)` with constant-time comparison

---

## State Transitions

PersonalAccessToken is stateless (no explicit state field). Lifecycle:

```
[Created] ──(used)──> [Active with lastUsedAt]
    │                        │
    └───────(delete)─────────┴──> [Deleted]
```

### Operations

| Operation | Effect | Trigger |
|-----------|--------|---------|
| Create | Insert new token record | User generates token in UI |
| Use | Update `lastUsedAt` timestamp | Successful API authentication |
| Delete | Remove record | User revokes token in UI |
| Cascade Delete | Remove all user tokens | User account deleted |

---

## Query Patterns

### List User's Tokens
```sql
SELECT id, name, preview, lastUsedAt, createdAt
FROM PersonalAccessToken
WHERE userId = ?
ORDER BY createdAt DESC;
```

### Validate Token
```sql
-- Step 1: Find candidates by preview
SELECT id, userId, hash, salt
FROM PersonalAccessToken
WHERE preview = ?;

-- Step 2: Verify hash in application layer
-- Step 3: Update lastUsedAt on success
UPDATE PersonalAccessToken
SET lastUsedAt = NOW()
WHERE id = ?;
```

### Delete Token
```sql
DELETE FROM PersonalAccessToken
WHERE id = ? AND userId = ?;
```

---

## Security Considerations

### Stored Data
- **Never stored**: Plain-text token
- **Stored but protected**: Hash (irreversible without token)
- **Stored for UX**: Preview (last 4 chars only)

### Token Display
- Full token shown **once** at creation
- List view shows: name, preview, createdAt, lastUsedAt
- No way to retrieve full token after creation

### Rate Limiting (Application Layer)
- 60 requests/minute/IP for validation endpoints
- Prevents brute-force token guessing
