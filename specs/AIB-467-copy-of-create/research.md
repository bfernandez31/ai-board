# Research: Profile Settings Page (AIB-467)

## Research Task 1: GitHub Username Retrieval

**Question**: The spec states GitHub username is sourced from the Account model, but the Account model only stores `providerAccountId` (numeric GitHub ID), not the `login` (username). How do we get the GitHub username?

**Decision**: Derive GitHub username from the `user.image` URL is not reliable. Instead, call the GitHub API endpoint `GET https://api.github.com/user/{id}` using the stored `providerAccountId` to fetch the username at profile load time. The API endpoint will make this call server-side and cache the result.

**Rationale**:
- No schema migration required — avoids touching the User/Account models
- GitHub API is rate-limited at 5,000 requests/hour for authenticated requests (using stored access_token), which is more than sufficient for profile page loads
- The username is fetched once per profile page visit and cached client-side via React Query
- Fallback: if the GitHub API call fails, display the providerAccountId as a link to `https://github.com/` with a "GitHub profile" label

**Alternatives considered**:
1. Add `githubLogin` field to User model — requires migration, breaks "no new fields" spec constraint
2. Store `login` in Account model — schema change, Account model is NextAuth-managed
3. Parse from avatar URL — unreliable, avatar URLs use numeric IDs not usernames

## Research Task 2: Existing Settings Page Patterns

**Decision**: Follow the established client component pattern with React Query data fetching, matching the billing/tokens/credentials pages.

**Rationale**:
- All three existing settings pages are `"use client"` components
- They share a consistent layout: `max-w-4xl` container, `space-y-6`, icon+title header, `aurora-bg-subtle` info sections
- No shared settings layout component exists — each page is self-contained
- Navigation links are hardcoded in both `user-menu.tsx` and `mobile-menu.tsx`

**Alternatives considered**:
1. Server Component — would avoid loading state but breaks the established pattern
2. Shared settings layout — would be nice but out of scope for this ticket

## Research Task 3: Avatar Fallback Pattern

**Decision**: Reuse the existing `Avatar` component from `@/components/ui/avatar` (shadcn/ui) with the same initials fallback pattern used in `user-menu.tsx` and `mobile-menu.tsx`.

**Rationale**: Consistent with existing code. Initials are derived from `user.name?.split(' ').map(n => n[0]).join('').toUpperCase()` with `'??'` fallback.

**Alternatives considered**: Custom avatar component — unnecessary, shadcn/ui Avatar already supports `AvatarFallback`.

## Research Task 4: Subscription Plan Display

**Decision**: Use the existing `/api/billing/subscription` endpoint to fetch the current plan, reusing the `useSubscription` hook already available.

**Rationale**: The billing subscription endpoint already returns `plan` (FREE/PRO/TEAM) and `status`. No new API needed for this data.

## Research Task 5: Date Formatting

**Decision**: Use `Intl.DateTimeFormat` for human-readable date formatting (e.g., "April 1, 2026") rather than adding a date library.

**Rationale**: Built-in browser API, no additional dependency needed. Matches spec requirement for human-readable dates.
