# Data Model: Dev Login for Preview Environments

**Date**: 2026-03-18 | **Feature**: AIB-313

## Existing Persistent Entities

### User

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` | Yes | Reused for existing users; new dev-login-only users get `crypto.randomUUID()` |
| `email` | `string` | Yes | Unique identifier used to match returning users |
| `name` | `string?` | No | Can default from the email local part when dev-login creates a new user |
| `emailVerified` | `DateTime?` | No | Set on successful dev-login creation/update so the session behaves like an authenticated user |

**Validation rules**:
- Email must pass Zod email validation before provisioning
- Email lookup should use normalized casing and trimmed input

### Account

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | `string` | Yes | References `User.id` |
| `type` | `string` | Yes | `credentials` for dev-login records |
| `provider` | `string` | Yes | `credentials` |
| `providerAccountId` | `string` | Yes | Normalized email to make the linkage stable per user |

**Validation rules**:
- Upsert on `[provider, providerAccountId]`
- Must always point to the same `User` matched by email

### Session

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | `string` | Yes | Must use the same database user id produced by the credentials flow |
| `expires` | `DateTime` | Yes | Managed by NextAuth session strategy |

**Behavior**:
- JWT strategy outside test mode
- Database session strategy in test mode
- Both rely on the auth pipeline returning the correct `user.id`

## Derived Configuration Entity

### Dev Login Configuration

This feature uses deployment environment variables rather than a database table.

| Field | Source | Required | Purpose |
|-------|--------|----------|---------|
| `enabled` | `DEV_LOGIN_ENABLED` | Yes | Explicit feature toggle |
| `secret` | `DEV_LOGIN_SECRET` | Yes when enabled | Shared preview secret |
| `environment` | `VERCEL_ENV` | Yes | Must be `preview` for availability |

**Derived rule**:

```
devLoginAvailable =
  VERCEL_ENV === "preview" &&
  DEV_LOGIN_ENABLED === "true" &&
  DEV_LOGIN_SECRET is non-empty
```

## Auth Payload Model

### DevLoginCredentialsInput

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | `string` | Yes | Trimmed, normalized, valid email |
| `secret` | `string` | Yes | Non-empty string, compared against configured shared secret |
| `redirectTo` | `string` | No | Defaults to `/projects` |

### DevLoginAuthResult

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` | Yes | Database user id |
| `email` | `string` | Yes | Normalized email |
| `name` | `string` | Yes | Existing or derived display name |

## Relationships

```
Dev Login Configuration (env)
  └─ enables Credentials authorize flow
      └─ validates DevLoginCredentialsInput
          └─ finds or creates User by email
              └─ upserts Account(provider="credentials")
                  └─ returns DevLoginAuthResult
                      └─ creates Authenticated Session
```

## State Transitions

### Sign-In Attempt

| State | Trigger | Next State |
|-------|---------|------------|
| `disabled` | Dev login not available | `rejected` |
| `awaiting-input` | User opens preview sign-in page | `validating` |
| `validating` | Email/secret submitted | `rejected` or `provisioned` |
| `provisioned` | User created or reused successfully | `authenticated` |
| `rejected` | Validation or secret mismatch fails | `awaiting-input` |
| `authenticated` | Session established | Redirect to `/projects` |

## Data Integrity Notes

- Successful first-time dev-login provisioning should run in a Prisma transaction so `User` and `Account` stay consistent.
- Invalid attempts must not create `User`, `Account`, or `Session` rows.
- Existing users created through GitHub must retain the same `User.id`; dev login attaches to that identity instead of creating a duplicate account.
