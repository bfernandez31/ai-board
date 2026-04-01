# Quickstart: Create Profile Settings Page

**Feature**: AIB-465 | **Date**: 2026-04-01

## What This Feature Does

Adds a read-only `/settings/profile` page that displays user account information from GitHub OAuth: avatar, display name, email, linked GitHub account, registration date, and current subscription plan. It is the first item in the settings navigation menu.

## Key Files to Create

| File | Purpose |
|------|---------|
| `app/api/settings/profile/route.ts` | API endpoint — assembles profile data from User + Account + Subscription + GitHub API |
| `app/settings/profile/page.tsx` | Profile settings page — client component fetching from API via TanStack Query |
| `components/settings/profile-info.tsx` | Profile display component — avatar, field rows, plan badge with billing link |

## Key Files to Modify

| File | Change |
|------|--------|
| `components/auth/user-menu.tsx` | Add "Profile" as first settings menu item (before Billing) |
| `components/layout/mobile-menu.tsx` | Add "Profile" as first settings link (before Billing) |

## Implementation Order

1. **API endpoint** (`route.ts`) — No dependencies, can start immediately
2. **Profile component** (`profile-info.tsx`) — Can build in parallel with API using mock data
3. **Profile page** (`page.tsx`) — Depends on API + component
4. **Navigation updates** (`user-menu.tsx`, `mobile-menu.tsx`) — Independent, can be done in parallel with page
5. **Tests** — After implementation is complete

## Patterns to Follow

- **Settings page layout**: Copy structure from `app/settings/billing/page.tsx` (container, header with icon, content sections)
- **Data fetching**: TanStack Query with `useQuery` hook, similar to `useSubscription` pattern
- **Auth check**: Use `requireAuth()` from `lib/db/users.ts` in the API route
- **Avatar**: Use shadcn/ui `Avatar` + `AvatarImage` + `AvatarFallback` (same as `user-menu.tsx`)
- **Navigation item**: Use lucide-react `User` icon, `Link` component to `/settings/profile`

## Testing Approach

- **Integration test**: `tests/integration/settings/profile.test.ts` — Test API endpoint returns correct data, handles auth, handles missing subscription
- **Component test**: `tests/unit/components/profile-info.test.tsx` — Test renders all fields, handles null name, handles null avatar
- **No E2E tests**: No browser-required features (no OAuth flow, no drag-drop, no viewport-dependent JS)

## Dependencies

No new packages required. All dependencies already in the project:
- `next-auth/react` (useSession)
- `@tanstack/react-query` (useQuery)
- `@/components/ui/*` (shadcn/ui components)
- `lucide-react` (User icon)
- `@prisma/client` (database queries)
