# Data Model: Create Profile Settings Page

**Feature**: AIB-465 | **Date**: 2026-04-01

## Overview

This feature uses **existing models only** — no new entities, fields, or migrations are required. The profile page assembles a read-only view from three existing Prisma models.

## Entities Used

### User (existing — no changes)

| Field | Type | Profile Usage |
|-------|------|---------------|
| `id` | String (PK) | Internal — not displayed |
| `name` | String? | Display name (FR-002). Fallback: email or "Not set" when null |
| `email` | String (unique) | Email address display (FR-003) |
| `image` | String? | Avatar URL from GitHub (FR-001). Fallback: initials via AvatarFallback |
| `createdAt` | DateTime | Registration date, formatted locale-aware (FR-005) |

### Account (existing — no changes)

| Field | Type | Profile Usage |
|-------|------|---------------|
| `provider` | String | Filter for `github` provider |
| `providerAccountId` | String | GitHub numeric user ID — used for API lookup |
| `access_token` | String? | Used server-side to call GitHub API for username resolution |

**Query filter**: `provider = 'github'` AND `userId = currentUser.id`

### Subscription (existing — no changes)

| Field | Type | Profile Usage |
|-------|------|---------------|
| `plan` | SubscriptionPlan enum | Current plan display: FREE / PRO / TEAM (FR-006) |
| `status` | SubscriptionStatus enum | Used to determine effective plan (with grace period) |

**Relationship**: One-to-one with User via `userId`. May not exist — defaults to FREE.

## Data Flow

```
Browser                          Server (API Route)                    External
  │                                    │                                  │
  │  GET /api/settings/profile         │                                  │
  │ ──────────────────────────────────>│                                  │
  │                                    │  requireAuth()                   │
  │                                    │  prisma.user.findUnique({        │
  │                                    │    include: {                    │
  │                                    │      accounts: { where:          │
  │                                    │        { provider: 'github' }},  │
  │                                    │      subscription: true          │
  │                                    │    }                             │
  │                                    │  })                              │
  │                                    │                                  │
  │                                    │  GET api.github.com/user         │
  │                                    │  (Authorization: token ...)      │
  │                                    │ ────────────────────────────────>│
  │                                    │<────────────────────────────────│
  │                                    │  { login, html_url }            │
  │                                    │                                  │
  │  { name, email, image, createdAt,  │                                  │
  │    githubUsername, githubUrl,       │                                  │
  │    plan }                          │                                  │
  │<──────────────────────────────────│                                  │
```

## Response Shape

```typescript
interface ProfileResponse {
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;           // ISO 8601 datetime
  githubUsername: string | null; // Resolved from GitHub API
  githubUrl: string | null;     // e.g., "https://github.com/octocat"
  plan: 'FREE' | 'PRO' | 'TEAM';
}
```

## Validation Rules

- **Authentication**: Required — unauthenticated requests return 401
- **No input validation needed**: GET-only endpoint with no request body or query params
- **Output sanitization**: No sensitive fields (tokens, IDs, Stripe data) included in response

## State Transitions

N/A — This is a read-only display feature with no state mutations.
