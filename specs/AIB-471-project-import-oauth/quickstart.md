# Quickstart: Project Import — OAuth Repo Scope + Repo Picker + Creation Flow

**Ticket**: AIB-471
**Date**: 2026-04-02

---

## Prerequisites

- Dev server running: `bun run dev`
- GitHub OAuth app configured with `GITHUB_ID` and `GITHUB_SECRET` in `.env.local`
- PostgreSQL running with seeded data: `bunx prisma db seed`

## Implementation Order

### 1. Update OAuth Scope

**File**: `lib/auth.ts`
**Change**: Add `repo` to the GitHub OAuth `scope` parameter.

```
scope: 'read:user user:email repo'
```

### 2. Add GitHub Token Helper

**New file**: `lib/github/user-client.ts`
**Purpose**: Functions to retrieve user's GitHub token and create an authenticated Octokit client.

Key functions:
- `getGitHubAccessToken(userId)` — Query Account model for GitHub provider token
- `hasRepoScope(userId)` — Check if stored scope includes `repo`
- `createUserGitHubClient(userId)` — Create Octokit with user's token

### 3. Build API Endpoints

Build in this order (each depends on the previous):

1. `app/api/github/auth-status/route.ts` — GET, checks scope
2. `app/api/github/orgs/route.ts` — GET, lists user's orgs
3. `app/api/github/repos/route.ts` — GET, lists repos with pagination/search
4. `app/api/projects/import/route.ts` — POST, creates project from repo

### 4. Build UI Components

1. `components/projects/import-project-modal.tsx` — Main modal with repo picker
2. `components/projects/repo-picker.tsx` — Search, filter, pagination
3. `components/projects/repo-picker-item.tsx` — Individual repo row
4. `components/projects/reauth-prompt.tsx` — OAuth scope upgrade prompt

### 5. Enable Import Button

**Files**: `components/projects/empty-projects-state.tsx`, `app/projects/page.tsx`
**Change**: Wire up the "Import Project" button to open the import modal.

## Verification

```bash
bun run type-check    # Must pass
bun run lint          # Must pass
bun run test:unit     # Run unit tests
bun run test:integration  # Run integration tests
```

## Key Files to Read Before Implementing

| File | Why |
|------|-----|
| `lib/auth.ts` | OAuth config, `requireAuth()` |
| `app/lib/auth/user-service.ts` | Account upsert on sign-in |
| `lib/config-sync.ts` | Config fetch/validate/store logic |
| `app/api/projects/route.ts` | Existing project creation + quota enforcement |
| `components/projects/empty-projects-state.tsx` | Current disabled button UI |
| `lib/billing/plans.ts` | Plan limits |
| `prisma/schema.prisma` | Project, Account models |
