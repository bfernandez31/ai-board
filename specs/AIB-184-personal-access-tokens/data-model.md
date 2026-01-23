# Data Model: Personal Access Tokens

**Feature**: AIB-184-personal-access-tokens
**Date**: 2026-01-23

## Entities

### PersonalAccessToken (New)

Represents a user's API access credential for external tool authentication.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | Int | @id @default(autoincrement()) | Primary key |
| userId | String | Foreign key to User.id | Owner of the token |
| name | String | @db.VarChar(50) | User-provided label (1-50 chars) |
| tokenHash | String | @db.VarChar(255) | bcrypt hash of plain token |
| tokenPreview | String | @db.VarChar(4) | Last 4 chars of plain token |
| createdAt | DateTime | @default(now()) | Token creation timestamp |
| lastUsedAt | DateTime? | Nullable | Last successful authentication |

**Relationships**:
- `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`

**Indices**:
- `@@index([userId])` - Fast lookup of user's tokens
- `@@index([tokenHash])` - Fast validation during authentication

### User (Existing - Extended)

Add relation to PersonalAccessToken:

| New Relation | Type | Description |
|--------------|------|-------------|
| personalAccessTokens | PersonalAccessToken[] | User's API tokens (0-10) |

## Prisma Schema Addition

```prisma
model PersonalAccessToken {
  id           Int       @id @default(autoincrement())
  userId       String
  name         String    @db.VarChar(50)
  tokenHash    String    @db.VarChar(255)
  tokenPreview String    @db.VarChar(4)
  createdAt    DateTime  @default(now())
  lastUsedAt   DateTime?

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
}
```

Update User model:
```prisma
model User {
  // ... existing fields
  personalAccessTokens  PersonalAccessToken[]
}
```

## Validation Rules

### Token Name
- Minimum: 1 character (non-empty)
- Maximum: 50 characters
- Allowed: Any printable characters (no restrictions on special chars)
- Uniqueness: Not required (duplicates allowed per user)

### Token Value (Plain)
- Format: `pat_` + 32 hex characters
- Total length: 36 characters
- Generation: `crypto.randomBytes(16).toString('hex')`
- Display: Shown once on creation, never retrievable again

### Token Hash
- Algorithm: bcrypt
- Cost factor: 12
- Storage: ~60 character hash string

### Token Preview
- Length: 4 characters
- Content: Last 4 chars of plain token
- Purpose: User identification of tokens

### Per-User Limit
- Maximum: 10 tokens per user
- Enforcement: API-level check before creation

## State Transitions

PersonalAccessToken has no complex state machine. It exists in one of two states:

```
[Created] ──(revoke)──> [Deleted]
```

- **Created**: Token exists and can be used for authentication
- **Deleted**: Token is permanently removed (hard delete, not soft delete)

No intermediate states (active/inactive, suspended, etc.) - keeping it simple.

## Query Patterns

### Get User's Tokens
```typescript
prisma.personalAccessToken.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  select: { id, name, tokenPreview, createdAt, lastUsedAt }
})
```

### Validate Token
```typescript
// Find all user tokens, then compare hash in application
// (bcrypt comparison is CPU-intensive, can't be done in SQL)
const tokens = await prisma.personalAccessToken.findMany({
  where: { tokenHash: candidateHash }, // Index lookup
  select: { id, userId, tokenHash }
})
// Then: await bcrypt.compare(plainToken, token.tokenHash)
```

Note: For bcrypt, we cannot do direct hash comparison in SQL. The approach is:
1. Hash the incoming token with bcrypt
2. Query by exact tokenHash match (since bcrypt produces deterministic output for same input+salt)

Actually, bcrypt hashes include the salt, so each hash is different. Correct approach:
1. Extract userId from some context OR iterate all tokens (expensive)
2. Better: Store a fast hash (SHA-256) for lookup, bcrypt for verification

**Revised Approach** (two-tier hashing):
- Store `tokenLookup`: SHA-256 hash of plain token (for fast index lookup)
- Store `tokenHash`: bcrypt hash of plain token (for security verification)

Updated schema:
```prisma
model PersonalAccessToken {
  id            Int       @id @default(autoincrement())
  userId        String
  name          String    @db.VarChar(50)
  tokenLookup   String    @unique @db.VarChar(64)  // SHA-256 hex (for fast DB lookup)
  tokenHash     String    @db.VarChar(255)         // bcrypt (for verification)
  tokenPreview  String    @db.VarChar(4)
  createdAt     DateTime  @default(now())
  lastUsedAt    DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### Validate Token (Revised)
```typescript
// 1. Fast lookup by SHA-256
const tokenLookup = crypto.createHash('sha256').update(plainToken).digest('hex')
const token = await prisma.personalAccessToken.findUnique({
  where: { tokenLookup },
  select: { id, userId, tokenHash }
})

// 2. Verify with bcrypt (if found)
if (token && await bcrypt.compare(plainToken, token.tokenHash)) {
  // Valid token - return userId
}
```

### Create Token
```typescript
const plainToken = `pat_${crypto.randomBytes(16).toString('hex')}`
const tokenLookup = crypto.createHash('sha256').update(plainToken).digest('hex')
const tokenHash = await bcrypt.hash(plainToken, 12)
const tokenPreview = plainToken.slice(-4)

const created = await prisma.personalAccessToken.create({
  data: { userId, name, tokenLookup, tokenHash, tokenPreview }
})

// Return plainToken to user ONCE - never stored or retrievable
```

### Delete Token
```typescript
await prisma.personalAccessToken.delete({
  where: { id, userId } // Ensure user owns the token
})
```

### Count User's Tokens
```typescript
const count = await prisma.personalAccessToken.count({
  where: { userId }
})
// Reject if count >= 10
```

### Update Last Used
```typescript
// Fire-and-forget update after successful auth
prisma.personalAccessToken.update({
  where: { id: tokenId },
  data: { lastUsedAt: new Date() }
}).catch(console.error) // Don't block request on this
```

## Final Schema

```prisma
model PersonalAccessToken {
  id            Int       @id @default(autoincrement())
  userId        String
  name          String    @db.VarChar(50)
  tokenLookup   String    @unique @db.VarChar(64)  // SHA-256 for fast lookup
  tokenHash     String    @db.VarChar(255)         // bcrypt for verification
  tokenPreview  String    @db.VarChar(4)
  createdAt     DateTime  @default(now())
  lastUsedAt    DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
