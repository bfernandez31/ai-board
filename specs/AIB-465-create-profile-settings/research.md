# Research: Create Profile Settings Page

**Feature**: AIB-465 | **Date**: 2026-04-01

## Research Topic 1: GitHub Username Retrieval

**Question**: How to display the user's GitHub username and link to their profile, given that the `login` field is not persisted in the database?

**Decision**: Resolve the GitHub username server-side in the profile API endpoint using the GitHub API with the stored `access_token` from the Account record.

**Rationale**:
- The Account model stores `providerAccountId` (GitHub numeric ID) and `access_token`
- The `user-service.ts` captures `profile.login` during OAuth but stores it as `User.name` (falling back: `profile.name || profile.login`), so the raw login is not reliably stored
- A single `GET https://api.github.com/user` call using the stored access token returns the current `login` and `html_url`
- This is a settings page with low traffic — one API call per page load is acceptable
- The access token is already stored and available; no new secrets needed

**Alternatives considered**:
1. **Add `githubLogin` column to User model** — Rejected: requires a Prisma migration for a single display field on a low-traffic page; over-engineering for a read-only feature
2. **Use `providerAccountId` to construct URL** — Rejected: GitHub does not support `github.com/user/12345` URL format for browser navigation
3. **Parse `User.name` as GitHub login** — Rejected: unreliable since `name` prefers the display name (`profile.name`) over login when available
4. **Client-side GitHub API call** — Rejected: would expose the access token to the browser

**Fallback**: If the GitHub API call fails (token expired, rate limit), display the user's name without the GitHub link, with a note that the linked account info is temporarily unavailable.

## Research Topic 2: Data Fetching Pattern for Profile Page

**Question**: Should the profile page be a Server Component or Client Component? What data fetching pattern to use?

**Decision**: Client component with TanStack Query fetching from a dedicated `GET /api/settings/profile` endpoint, consistent with the billing settings page pattern.

**Rationale**:
- Existing settings pages (billing, tokens, credentials) all use the client component pattern with `"use client"`
- Billing page uses TanStack Query for subscription data fetching
- A dedicated API endpoint centralizes the data assembly (User + Account + Subscription + GitHub API call) server-side
- TanStack Query provides loading/error states and caching out of the box

**Alternatives considered**:
1. **Server Component with direct Prisma queries** — Rejected: breaks consistency with other settings pages; would require different error handling patterns
2. **Use existing `useSession()` data only** — Rejected: session only contains `id`, `name`, `email`, `image` — missing GitHub username, registration date, and subscription plan

## Research Topic 3: Settings Navigation Structure

**Question**: How is settings navigation currently structured, and where should "Profile" be added?

**Decision**: Add "Profile" as the first item in both `user-menu.tsx` (desktop dropdown) and `mobile-menu.tsx` (mobile sheet), before the existing Billing/Tokens/Credentials links.

**Rationale**:
- There is no dedicated settings sidebar/layout — navigation to settings pages is through the user avatar dropdown menu (desktop) and hamburger sheet menu (mobile)
- The spec requires Profile as the first settings item (FR-008)
- Both menus currently list: Billing → API Tokens → AI Credentials
- Adding Profile before Billing maintains logical ordering: identity first, then functional settings
- Uses `User` icon from lucide-react for the Profile menu item (consistent with other icon usage)

**Alternatives considered**:
1. **Create a settings layout with sidebar navigation** — Rejected: scope creep beyond this ticket; other settings pages don't have a shared layout
2. **Add only to desktop menu** — Rejected: violates responsive requirement (FR-011); mobile users need the same navigation

## Research Topic 4: Avatar Fallback Handling

**Question**: How should the profile page handle missing or failed avatar images?

**Decision**: Use the existing shadcn/ui `Avatar` + `AvatarFallback` pattern already established in `user-menu.tsx` and `mobile-menu.tsx`.

**Rationale**:
- `AvatarImage` with `AvatarFallback` automatically shows fallback when image fails to load
- Fallback displays user initials (from name) or `??` if name is also missing
- Pattern already proven in the codebase — no new code needed for this behavior
- Satisfies FR-010 (graceful handling of missing avatar)

**Alternatives considered**:
1. **Custom error handling with `onError` callback** — Rejected: `AvatarFallback` already handles this natively
2. **Generic user icon as fallback** — Rejected: initials are more personal and already established as the convention

## Research Topic 5: Subscription Plan Display

**Question**: How to display the current plan when the user may not have a Subscription record?

**Decision**: Default to "Free" when no Subscription record exists, with a link to `/settings/billing`.

**Rationale**:
- The Subscription model defaults to `FREE` plan, but users without a Subscription record at all should also show as Free
- The billing page already handles this pattern (`subscription?.plan ?? 'FREE'` in billing page)
- Plan display includes a link to billing settings for upgrade path (FR-006)
- Consistent with the edge case specified in the feature spec

**Alternatives considered**:
1. **Hide plan section when no subscription** — Rejected: spec explicitly requires plan display (FR-006)
2. **Show "No plan" or "Unknown"** — Rejected: confusing UX; FREE is the effective plan for users without a subscription
