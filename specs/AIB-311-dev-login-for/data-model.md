# Data Model: Dev Login for Preview Environments

## Schema Changes

**None required.** The existing `User` model already supports all fields needed for Credentials-based login. No new tables, columns, or migrations are needed.

## Entity Usage

### User (existing)

| Field | Dev Login Behavior |
|-------|-------------------|
| `id` | Deterministic: `SHA-256(email.toLowerCase())` truncated to 24 chars |
| `email` | From form input, normalized to lowercase |
| `name` | Derived from email prefix (part before `@`) |
| `emailVerified` | Set to `new Date()` on creation |
| `image` | `null` (no avatar from Credentials login) |
| `updatedAt` | Set on every login (upsert update) |

### Account (existing)

**Not created** for Credentials logins. The Account model links OAuth providers to users. Credentials-based users have no OAuth account record, which is acceptable — the Account table is only used for OAuth token storage and refresh.

### Session (existing)

**Not directly created.** JWT strategy (production) stores session in a signed cookie — no database Session record. In test mode (database strategy), NextAuth's PrismaAdapter handles Session creation automatically.

## State Transitions

No new state transitions. The user either exists (update `updatedAt`) or doesn't (create with all fields).

## Validation Rules

| Field | Rule |
|-------|------|
| `email` | Required, valid email format, normalized to lowercase |
| `secret` | Required, compared against `DEV_LOGIN_SECRET` via timing-safe comparison |

## Cross-Entity Impacts

- Users created via Dev Login can own projects, create tickets, and use all features identically to GitHub OAuth users
- If a user later signs in via GitHub OAuth with the same email, the existing user record is updated (name, image overwritten with GitHub profile data) — this is correct behavior per the existing `createOrUpdateUser` logic
