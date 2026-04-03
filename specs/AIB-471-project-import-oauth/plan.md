# Implementation Plan: Project Import — OAuth Repo Scope + Repo Picker + Creation Flow

**Ticket**: AIB-471
**Branch**: `AIB-471-project-import-oauth`
**Created**: 2026-04-02
**Status**: Ready for implementation

---

## Technical Context

### Current State
- OAuth requests `read:user user:email` scopes only (no repo access)
- `Account` model stores `access_token` and `scope` from NextAuth
- `Project` model has `githubOwner`, `githubRepo` with `@@unique` constraint, plus `config` (Json?) and `configSyncedAt`
- `syncProjectConfig()` fetches/validates `.ai-board/config.yml` from GitHub
- "Import Project" button exists in UI but is disabled
- No repo picker or GitHub repo listing functionality exists
- Project creation via `POST /api/projects` has quota enforcement with serializable transactions
- Existing `createGitHubClient()` uses server-level `GITHUB_TOKEN`; no user-token client exists

### Dependencies
- **Octokit** (already installed) — GitHub API client
- **NextAuth.js** (already configured) — OAuth re-authorization
- **Zod** (already installed) — Request validation
- **TanStack Query v5** (already installed) — Client-side data fetching
- **shadcn/ui Dialog** (already available) — Modal UI

### No Schema Migration Required
The `Project` and `Account` models already have all necessary fields. No `prisma migrate` needed.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code will be strict TypeScript with explicit types |
| II. Component-Driven | PASS | Uses shadcn/ui Dialog, follows feature folder structure |
| III. Test-Driven | PASS | Tests defined per user story (see Testing Strategy) |
| IV. Security-First | PASS | Zod validation on all inputs; tokens never exposed in responses; admin rights validated server-side |
| V. Database Integrity | PASS | No schema changes; uses existing unique constraint; serializable transactions for quota |
| V. Spec Guardrails | PASS | All 5 auto-resolved decisions documented with rationale and trade-offs |

---

## Architecture Overview

### New Files

```
lib/github/user-client.ts              # User-token Octokit + helpers
app/api/github/auth-status/route.ts     # GET — scope check
app/api/github/orgs/route.ts            # GET — user's orgs
app/api/github/repos/route.ts           # GET — repo listing
app/api/projects/import/route.ts        # POST — import project
components/projects/import-project-modal.tsx  # Main import modal
components/projects/repo-picker.tsx      # Search + filter + pagination
components/projects/repo-picker-item.tsx # Individual repo row
components/projects/reauth-prompt.tsx    # OAuth re-auth consent
```

### Modified Files

```
lib/auth.ts                             # Add 'repo' to OAuth scope
lib/config-sync.ts                      # Add optional accessToken param
components/projects/empty-projects-state.tsx  # Enable Import button
app/projects/page.tsx                   # Wire Import button + modal
```

---

## Implementation Plan

### Phase 1: OAuth Scope + Token Helpers

**Goal**: Enable `repo` scope and provide helpers to access user tokens.

#### 1.1 Update OAuth Scope
- **File**: `lib/auth.ts`
- **Change**: `scope: 'read:user user:email'` → `scope: 'read:user user:email repo'`
- **Impact**: New sign-ins get `repo` scope. Existing tokens unchanged until re-auth.

#### 1.2 Create User GitHub Client
- **New file**: `lib/github/user-client.ts`
- **Functions**:
  - `getGitHubAccessToken(userId: string): Promise<string | null>` — Queries `Account` for GitHub provider
  - `hasRepoScope(userId: string): Promise<boolean>` — Checks `Account.scope` includes `repo`
  - `createUserGitHubClient(userId: string): Promise<Octokit>` — Creates Octokit with user's token; throws if no token
  - `requireRepoScope(userId: string): Promise<void>` — Throws `MISSING_SCOPE` error if scope insufficient

### Phase 2: API Endpoints

**Goal**: Build the server-side API layer for GitHub data and project import.

#### 2.1 Auth Status Endpoint
- **New file**: `app/api/github/auth-status/route.ts`
- **Method**: GET
- **Logic**: `requireAuth()` → check Account exists → check scope → return `GitHubAuthStatus`
- **Contract**: See `contracts/api-endpoints.md`

#### 2.2 Organizations Endpoint
- **New file**: `app/api/github/orgs/route.ts`
- **Method**: GET
- **Logic**: `requireAuth()` → `requireRepoScope()` → `octokit.orgs.listForAuthenticatedUser()` → map to `GitHubOrg[]`

#### 2.3 Repos Endpoint
- **New file**: `app/api/github/repos/route.ts`
- **Method**: GET
- **Logic**:
  1. `requireAuth()` → `requireRepoScope()`
  2. Parse query params (page, per_page, sort, type, org, q)
  3. If `q` provided: use GitHub Search API (`octokit.search.repos`)
  4. If `org` provided: use `octokit.repos.listForOrg({ org, ... })`
  5. Otherwise: use `octokit.repos.listForAuthenticatedUser({ ... })`
  6. Batch-check which repos are already imported via `prisma.project.findMany`
  7. Map to `RepoPickerItem[]` with `isAlreadyImported` and `hasAdminAccess` flags
  8. Return paginated response

#### 2.4 Import Project Endpoint
- **New file**: `app/api/projects/import/route.ts`
- **Method**: POST
- **Logic**:
  1. `requireAuth()` → `requireRepoScope()`
  2. Validate body with Zod (`githubOwner`, `githubRepo`, optional `name`, `description`)
  3. Verify admin rights: `octokit.repos.get({ owner, repo })` → check `permissions.admin`
  4. Check subscription quota (reuse pattern from `POST /api/projects`)
  5. Create project in serializable transaction (reuse key generation logic)
  6. Auto-add AI-BOARD as project member (reuse existing pattern)
  7. Async config sync: `syncProjectConfig(project)` (non-blocking)
  8. Determine redirect: if config sync succeeds → `/projects/{id}`, else → `/projects/{id}/setup`
  9. Return `ImportProjectResponse`
  10. Handle P2002 unique constraint → 409 with existing project info

#### 2.5 Update Config Sync
- **File**: `lib/config-sync.ts`
- **Change**: Add optional `accessToken?: string` parameter to `syncProjectConfig()`
- **Impact**: When provided, creates Octokit with user token instead of server token; enables config fetch from repos the server token cannot access.

### Phase 3: UI Components

**Goal**: Build the repo picker modal and wire up the import flow.

#### 3.1 Re-auth Prompt Component
- **New file**: `components/projects/reauth-prompt.tsx`
- **Client component** (`"use client"`)
- **Props**: `onReauthorize: () => void`, `onDismiss: () => void`
- **UI**: Aurora-styled card explaining why `repo` scope is needed, with "Authorize GitHub Access" button and dismiss option
- **Action**: Button calls `signIn("github", { callbackUrl: window.location.href })`

#### 3.2 Repo Picker Item
- **New file**: `components/projects/repo-picker-item.tsx`
- **Client component**
- **Props**: `repo: RepoPickerItem`, `onSelect: (repo) => void`
- **UI**: Row with repo name, description (truncated), visibility badge, last push date, owner avatar
- **States**: Disabled + tooltip if `isAlreadyImported` or `!hasAdminAccess`

#### 3.3 Repo Picker
- **New file**: `components/projects/repo-picker.tsx`
- **Client component**
- **Features**:
  - Search input (debounced 300ms) → fetches `/api/github/repos?q=...`
  - Org filter dropdown → fetches orgs from `/api/github/orgs`, filters via `org` param
  - Pagination via "Load more" button or infinite scroll
  - Loading skeleton states
  - Empty states: no repos, no search results, zero repos
  - Error states: rate limit, network error
- **Data**: TanStack Query with `useQuery` for repos and orgs lists
- **Selection**: Single-select; calls `onSelect(repo)` prop

#### 3.4 Import Project Modal
- **New file**: `components/projects/import-project-modal.tsx`
- **Client component**
- **Props**: `open: boolean`, `onOpenChange: (open: boolean) => void`
- **Flow**:
  1. On open: fetch `/api/github/auth-status`
  2. If `!hasRepoScope`: render `ReauthPrompt`
  3. If `hasRepoScope`: render `RepoPicker`
  4. On repo select: show confirmation with repo details + optional name/description edit
  5. On confirm: `POST /api/projects/import` → `useMutation` with TanStack Query
  6. On success: invalidate projects query → `router.push(redirectTo)`
  7. On error: display inline error (quota, duplicate, permissions)
- **UI**: shadcn/ui `Dialog` with aurora-themed background

#### 3.5 Enable Import Button
- **File**: `components/projects/empty-projects-state.tsx`
- **Change**: Enable "Import Project" button; wire `onClick` to open `ImportProjectModal`
- **File**: `app/projects/page.tsx`
- **Change**: Add `ImportProjectModal` with state management; enable "Import Project" button in header area

---

## Testing Strategy

### Unit Tests (`tests/unit/`)

| Test | File | Covers |
|------|------|--------|
| `getGitHubAccessToken` returns token | `tests/unit/lib/github/user-client.test.ts` | Phase 1.2 |
| `hasRepoScope` detects missing scope | `tests/unit/lib/github/user-client.test.ts` | Phase 1.2 |
| `hasRepoScope` detects present scope | `tests/unit/lib/github/user-client.test.ts` | Phase 1.2 |
| Import request Zod validation | `tests/unit/lib/validations/import-project.test.ts` | Phase 2.4 |

**Decision**: Pure functions with no React/API dependencies → Unit test (Decision Tree #1)

### Component Tests (`tests/unit/components/`)

| Test | File | Covers |
|------|------|--------|
| ReauthPrompt renders explanation and button | `tests/unit/components/projects/reauth-prompt.test.tsx` | US-3, Phase 3.1 |
| RepoPickerItem shows repo details | `tests/unit/components/projects/repo-picker-item.test.tsx` | US-1, Phase 3.2 |
| RepoPickerItem disabled when already imported | `tests/unit/components/projects/repo-picker-item.test.tsx` | US-4, Phase 3.2 |
| RepoPickerItem disabled when no admin access | `tests/unit/components/projects/repo-picker-item.test.tsx` | US-1, Phase 3.2 |
| RepoPicker search filters results | `tests/unit/components/projects/repo-picker.test.tsx` | US-5, Phase 3.3 |
| RepoPicker org filter works | `tests/unit/components/projects/repo-picker.test.tsx` | US-5, Phase 3.3 |
| ImportProjectModal shows reauth when no scope | `tests/unit/components/projects/import-project-modal.test.tsx` | US-3, Phase 3.4 |
| ImportProjectModal shows picker when has scope | `tests/unit/components/projects/import-project-modal.test.tsx` | US-1, Phase 3.4 |

**Decision**: React components with user interactions → Component test with mocked hooks (Decision Tree #2)

### Integration Tests (`tests/integration/`)

| Test | File | Covers |
|------|------|--------|
| GET /api/github/auth-status returns scope info | `tests/integration/github/auth-status.test.ts` | US-3, Phase 2.1 |
| GET /api/github/repos returns paginated repos | `tests/integration/github/repos.test.ts` | US-1, US-5, Phase 2.3 |
| GET /api/github/repos with search query | `tests/integration/github/repos.test.ts` | US-5, Phase 2.3 |
| GET /api/github/repos 403 when no scope | `tests/integration/github/repos.test.ts` | US-3, Phase 2.3 |
| POST /api/projects/import creates project | `tests/integration/projects/import.test.ts` | US-1, Phase 2.4 |
| POST /api/projects/import with config sync | `tests/integration/projects/import.test.ts` | US-1, Phase 2.4 |
| POST /api/projects/import without config | `tests/integration/projects/import.test.ts` | US-2, Phase 2.4 |
| POST /api/projects/import 409 on duplicate | `tests/integration/projects/import.test.ts` | US-4, Phase 2.4 |
| POST /api/projects/import 403 no admin | `tests/integration/projects/import.test.ts` | US-1, Phase 2.4 |
| POST /api/projects/import 403 quota exceeded | `tests/integration/projects/import.test.ts` | FR-017, Phase 2.4 |

**Decision**: API endpoints with database operations → Integration test with Vitest + Prisma (Decision Tree #3)

### E2E Tests — None

**Decision**: No features in this ticket strictly require a real browser (no OAuth redirect, drag-drop, or viewport-dependent behavior that cannot be tested at integration level). The OAuth re-auth redirects to GitHub which cannot be tested in E2E without mocking the provider, making integration tests more appropriate. If the setup wizard (separate ticket) requires E2E, that will be addressed there.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing users confused by re-auth | Medium | Medium | Clear consent messaging in ReauthPrompt |
| GitHub rate limits during repo listing | Low | Medium | Display rate limit info; cache org list |
| Config sync fails for private repos | Low | High | Use user's token (not server token) for sync |
| Concurrent duplicate imports | Low | Medium | DB unique constraint + serializable transaction |
| Token revoked mid-import | Low | Low | Catch 401, redirect to re-auth |

---

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Feature Spec | `specs/AIB-471-project-import-oauth/spec.md` | Complete |
| Research | `specs/AIB-471-project-import-oauth/research.md` | Complete |
| Data Model | `specs/AIB-471-project-import-oauth/data-model.md` | Complete |
| API Contracts | `specs/AIB-471-project-import-oauth/contracts/api-endpoints.md` | Complete |
| Quickstart | `specs/AIB-471-project-import-oauth/quickstart.md` | Complete |
| Implementation Plan | `specs/AIB-471-project-import-oauth/plan.md` | Complete |
