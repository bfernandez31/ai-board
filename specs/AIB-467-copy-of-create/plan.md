# Implementation Plan: Profile Settings Page (AIB-467)

**Feature Branch**: `AIB-467-copy-of-create`
**Spec**: [spec.md](./spec.md)
**Status**: Ready for implementation

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Route** | `/settings/profile` (new page) |
| **API** | `GET /api/settings/profile` (new endpoint) |
| **Data sources** | User, Account (GitHub OAuth), Subscription |
| **Component type** | Client component (`"use client"`) |
| **State management** | React Query for data fetching |
| **Styling** | Aurora theme, shadcn/ui, Tailwind semantic tokens |
| **Auth** | NextAuth session / PAT via `requireAuth()` |
| **Schema changes** | None |
| **New dependencies** | None |

### Key Design Decision: GitHub Username

The Account model stores `providerAccountId` (numeric GitHub ID) but not the GitHub username (`login`). The API endpoint will call `GET https://api.github.com/user/{id}` server-side using the stored `access_token` to resolve the username. This avoids schema changes while providing accurate data. See [research.md](./research.md) for full analysis.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new files in strict TypeScript with explicit types |
| II. Component-Driven | PASS | shadcn/ui components, client component with `"use client"`, feature folder structure |
| III. Test-Driven | PASS | Integration + component tests planned (see Testing Strategy) |
| IV. Security-First | PASS | Auth check via `requireAuth()`, no sensitive data exposed, Prisma parameterized queries |
| V. Database Integrity | PASS | Read-only queries, no schema changes |
| V. Spec Clarification | PASS | Auto-resolved decisions documented in spec with trade-offs |

---

## Implementation Phases

### Phase 1: API Endpoint

**Create** `app/api/settings/profile/route.ts`

```
GET /api/settings/profile
├── requireAuth(request) → userId
├── prisma.user.findUnique({
│     where: { id: userId },
│     include: {
│       accounts: { where: { provider: "github" }, take: 1 },
│       subscription: { select: { plan: true } }
│     }
│   })
├── If account.access_token exists:
│     fetch(`https://api.github.com/user/${account.providerAccountId}`, {
│       headers: { Authorization: `Bearer ${access_token}` }
│     }) → { login }
├── Return ProfileResponse (see contracts/api.md)
└── Error handling: 401 unauth, 500 server error
```

**Key details**:
- GitHub API call wrapped in try-catch — failure returns null for username fields
- Missing subscription defaults to "FREE"
- Missing name falls back to GitHub username, then "Unknown"
- Missing email shows "Not available"

### Phase 2: Profile Page Component

**Create** `app/settings/profile/page.tsx`

Layout follows existing settings page pattern:
```
<div className="max-w-4xl mx-auto space-y-6 p-6">
  <!-- Header: User icon + "Profile" title + description -->
  <!-- Aurora info box with account overview -->
  <!-- Profile fields grid -->
    - Avatar (circular, large) with initials fallback
    - Display Name
    - Email
    - GitHub Account (username as link)
    - Member Since (formatted date)
    - Current Plan (with link to /settings/billing)
</div>
```

**Data fetching**: React Query hook calling `/api/settings/profile`
**Loading state**: Skeleton matching the profile layout
**Responsive**: Stack on mobile, grid on desktop

### Phase 3: Navigation Updates

**Modify** `components/auth/user-menu.tsx`:
- Add `User` icon import from lucide-react
- Add Profile `<DropdownMenuItem>` as first item after the separator (before Billing)
- Link to `/settings/profile`

**Modify** `components/layout/mobile-menu.tsx`:
- Add `User` icon import from lucide-react
- Add Profile `<Link>` as first settings item (before Billing)
- Same click handler pattern: `onClick={() => setOpen(false)}`

**Final navigation order** in both components:
1. Profile (`/settings/profile`)
2. Billing (`/settings/billing`)
3. API Tokens (`/settings/tokens`)
4. AI Credentials (`/settings/credentials`)

---

## Testing Strategy

### Integration Tests (`tests/integration/settings/`)

**File**: `profile-api.test.ts`

| Test | Type | What it verifies |
|------|------|-----------------|
| Returns full profile for authenticated user | Integration | All fields populated correctly |
| Returns FREE plan when no subscription exists | Integration | Default plan fallback |
| Returns null GitHub username when API fails | Integration | Graceful degradation |
| Returns 401 for unauthenticated request | Integration | Auth guard |
| Returns fallback name when user.name is null | Integration | Name fallback chain |

### Component Tests (`tests/unit/components/settings/`)

**File**: `profile-page.test.tsx`

| Test | Type | What it verifies |
|------|------|-----------------|
| Renders all profile fields | Component (RTL) | Avatar, name, email, GitHub link, date, plan displayed |
| Shows initials fallback when no avatar | Component (RTL) | AvatarFallback rendered |
| Shows "Not available" for null email | Component (RTL) | Edge case handling |
| Shows loading skeleton during fetch | Component (RTL) | Loading state UX |
| GitHub username links to correct profile URL | Component (RTL) | Link href correct |
| Plan links to billing settings | Component (RTL) | Navigation link correct |

### Navigation Tests (`tests/unit/components/`)

**File**: `navigation-profile-link.test.tsx`

| Test | Type | What it verifies |
|------|------|-----------------|
| UserMenu shows Profile as first settings item | Component (RTL) | Menu order correct |
| MobileMenu shows Profile as first settings item | Component (RTL) | Menu order correct |

### Test Decision Rationale
- **No E2E tests**: Page is read-only with no browser-specific interactions (no drag-drop, OAuth, viewport-dependent logic). Component + integration tests provide full coverage.
- **API tests as integration** (not E2E): Per constitution, API tests use Vitest.
- **RTL query priority**: `getByRole` for links/headings, `getByText` for display values.

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `app/api/settings/profile/route.ts` | Profile data API endpoint |
| `app/settings/profile/page.tsx` | Profile settings page component |
| `tests/integration/settings/profile-api.test.ts` | API integration tests |
| `tests/unit/components/settings/profile-page.test.tsx` | Component tests |
| `tests/unit/components/navigation-profile-link.test.tsx` | Navigation tests |

### Modified Files
| File | Change |
|------|--------|
| `components/auth/user-menu.tsx` | Add Profile link as first settings item |
| `components/layout/mobile-menu.tsx` | Add Profile link as first settings item |

### No Changes Required
- `prisma/schema.prisma` — no new models or fields
- `lib/auth.ts` — existing auth helpers sufficient
- `app/globals.css` — existing aurora utilities sufficient

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GitHub API rate limiting | Authenticated requests get 5,000/hr; profile loads are infrequent |
| GitHub API downtime | Graceful fallback: githubUsername returns null, UI shows "GitHub connected" without username |
| Stale access_token in Account | GitHub OAuth tokens don't expire unless revoked; if token is invalid, fallback to null username |

---

## Dependencies Between Phases

```
Phase 1 (API) ──→ Phase 2 (Page) ──→ Phase 3 (Navigation)
                                  └──→ Tests (can run in parallel with Phase 3)
```

Phase 1 must complete first (page depends on API). Phase 2 and 3 can be developed in parallel but Phase 3 is trivial. Tests can be written alongside Phases 2-3.
