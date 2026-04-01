# Data Model: Profile Settings Page (AIB-467)

## Entities (Existing — No Schema Changes)

### User (read-only access)
| Field | Type | Usage |
|-------|------|-------|
| `id` | String | Primary key (GitHub numeric ID as string) |
| `name` | String? | Display name (fallback: GitHub username stored during OAuth) |
| `email` | String | Email address |
| `image` | String? | Avatar URL from GitHub |
| `createdAt` | DateTime | Registration date |

### Account (read-only access)
| Field | Type | Usage |
|-------|------|-------|
| `provider` | String | "github" |
| `providerAccountId` | String | GitHub numeric user ID |
| `access_token` | String? | Used for GitHub API call to fetch username |

### Subscription (read-only access)
| Field | Type | Usage |
|-------|------|-------|
| `plan` | SubscriptionPlan | FREE / PRO / TEAM |
| `status` | SubscriptionStatus | Current subscription status |

## Derived Data (API Response)

### ProfileResponse
| Field | Type | Source | Fallback |
|-------|------|--------|----------|
| `name` | string | `user.name` | GitHub username from API |
| `email` | string | `user.email` | "Not available" |
| `image` | string \| null | `user.image` | null (triggers initials fallback) |
| `githubUsername` | string \| null | GitHub API via `account.providerAccountId` | null |
| `githubProfileUrl` | string \| null | `https://github.com/{githubUsername}` | null |
| `createdAt` | string (ISO) | `user.createdAt` | — |
| `plan` | string | `subscription.plan` | "FREE" |

## Relationships
```
User (1) ──── (N) Account [filtered to provider="github"]
User (1) ──── (0..1) Subscription
```

## Validation Rules
- No write operations — all data is read-only
- GitHub API call failure is non-fatal — githubUsername returns null
- Missing subscription defaults to FREE plan
