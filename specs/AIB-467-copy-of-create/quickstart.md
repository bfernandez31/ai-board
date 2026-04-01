# Quickstart: Profile Settings Page (AIB-467)

## Overview
Add a read-only profile settings page at `/settings/profile` displaying user account information sourced from GitHub OAuth, and add "Profile" as the first item in all settings navigation menus.

## Implementation Order

### 1. API Endpoint — `/api/settings/profile`
- New GET endpoint in `app/api/settings/profile/route.ts`
- Fetches User with Account and Subscription relations
- Calls GitHub API to resolve username from `providerAccountId`
- Returns `ProfileResponse` shape (see contracts/api.md)

### 2. Profile Page — `/settings/profile`
- New page at `app/settings/profile/page.tsx`
- Client component (`"use client"`) following existing settings page patterns
- React Query hook for data fetching with loading skeleton
- Displays: avatar, name, email, GitHub link, registration date, plan
- Aurora theme styling consistent with other settings pages
- Responsive layout (mobile-first)

### 3. Navigation Updates
- `components/auth/user-menu.tsx` — Add "Profile" link as first settings item
- `components/layout/mobile-menu.tsx` — Add "Profile" link as first settings item

### 4. Tests
- **Integration test**: API endpoint returns correct profile data, handles missing subscription, handles GitHub API failure
- **Component test**: Profile page renders all fields, shows fallbacks for missing data, shows loading skeleton
- **Integration test**: Navigation components include "Profile" link in correct position

## Key Files to Create
- `app/api/settings/profile/route.ts`
- `app/settings/profile/page.tsx`

## Key Files to Modify
- `components/auth/user-menu.tsx`
- `components/layout/mobile-menu.tsx`

## Dependencies
- No new packages required
- No schema migrations
- Uses existing: `@/lib/db/users.ts`, `useSubscription` hook, shadcn/ui Avatar
