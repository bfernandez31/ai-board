# Research: Project Import — OAuth Repo Scope + Repo Picker + Creation Flow

**Ticket**: AIB-471
**Date**: 2026-04-02

---

## Research Task 1: OAuth Scope Requirements

**Question**: Does GitHub's OAuth scope model require `repo` for private repository content access? Is there a narrower alternative?

**Decision**: Use `repo` scope.

**Rationale**: GitHub's OAuth scope model has no narrower scope that covers:
- Listing private repositories
- Reading file contents from private repositories (needed for `.ai-board/config.yml` fetch)
- Checking user permission levels (admin/push) on repositories

The `public_repo` scope only covers public repos. Fine-grained tokens (GitHub Apps) are a different auth model entirely and not applicable to OAuth user tokens. `repo` is the correct and only viable scope.

**Alternatives Considered**:
- `public_repo` — Too narrow; excludes private repos.
- GitHub App installation tokens — Different auth model; would require significant architecture changes.

---

## Research Task 2: Token Storage — Account Model vs. UserCredential

**Question**: Should the GitHub OAuth token be stored in the existing `Account` model or via the `UserCredential` encryption system?

**Decision**: Use the existing `Account` model (NextAuth-managed).

**Rationale**: The `Account` model already stores `access_token` and `scope` fields populated by NextAuth's sign-in callback (`app/lib/auth/user-service.ts`). The `UserCredential` model is designed for AI provider credentials (Anthropic API keys/OAuth tokens) with AES-256-GCM encryption — it serves a different purpose and has a `@@unique([userId, provider])` constraint tied to `CredentialProvider` enum (currently only `ANTHROPIC`).

Reusing `Account` avoids:
- Duplicating secrets across storage locations
- Modifying the `CredentialProvider` enum (would require a migration)
- Conflating AI credentials with OAuth identity tokens

A helper function `getGitHubAccessToken(userId: string)` will query `Account` for the GitHub provider record.

**Alternatives Considered**:
- `UserCredential` with AES-256-GCM encryption — Overkill for an OAuth token already managed by NextAuth; would require schema changes.
- Server-side session storage — Tokens would be lost on session expiry.

---

## Research Task 3: Re-Authorization Flow for Scope Upgrade

**Question**: How should existing users without `repo` scope be prompted to re-authorize?

**Decision**: Detect missing scope via `Account.scope` field, then redirect to GitHub OAuth with updated scope parameter.

**Rationale**: The `Account` model stores the `scope` string returned by GitHub during OAuth. A server-side helper `hasRepoScope(userId)` checks if the stored scope includes `repo`. When missing:
1. The Import Project button triggers a check via a new API endpoint `GET /api/github/auth-status`.
2. If scope is insufficient, the frontend displays a consent explanation modal.
3. The "Re-authorize" button redirects to `/api/auth/signin/github` with the updated scope parameter, preserving a `callbackUrl` that returns the user to the import flow.

NextAuth's `signIn("github", { callbackUrl })` handles the redirect. On return, the Account record is updated with the new `access_token` and `scope` via the existing upsert in `user-service.ts`.

**Alternatives Considered**:
- Silent re-auth without explanation — Violates conservative policy; users need to understand why broader access is requested.
- Custom OAuth flow outside NextAuth — Unnecessary complexity; NextAuth handles re-authorization natively.

---

## Research Task 4: GitHub API for Repository Listing

**Question**: What is the best approach for listing user repositories with search, org filtering, and pagination?

**Decision**: Use the GitHub REST API via Octokit with the user's OAuth token (not the server-level `GITHUB_TOKEN`).

**Rationale**: The user's OAuth token (with `repo` scope) provides access to all repos the user can see, including private and organizational repos. Key endpoints:
- `GET /user/repos` — Lists all repos accessible to the authenticated user (supports `type`, `sort`, `per_page`, `page` params)
- `GET /user/orgs` — Lists user's organizations (for the org filter dropdown)
- `GET /repos/{owner}/{repo}` — Checks specific repo details and permissions

The existing `createGitHubClient()` in `app/lib/github/client.ts` uses `process.env.GITHUB_TOKEN` (server token). A new function `createUserGitHubClient(accessToken)` will create an Octokit instance with the user's token.

**Pagination**: GitHub returns `per_page` (max 100) with Link headers. Server-side pagination via cursor/page params forwarded from the client.

**Search**: GitHub's `/user/repos` does not support server-side text search. Options:
1. Client-side filtering of fetched pages — Simple but limited to loaded data.
2. GitHub Search API (`GET /search/repositories?q=user:{username}+{query}`) — Full-text search across name/description.

**Decision**: Use GitHub Search API for search queries, `/user/repos` for initial listing. This provides the best UX for users with many repos.

**Alternatives Considered**:
- Server-level `GITHUB_TOKEN` — Cannot see user's private repos or org repos they have access to.
- GraphQL API — More efficient for complex queries but adds complexity; REST is sufficient here.

---

## Research Task 5: Admin Rights Validation

**Question**: How to validate admin rights on a repository before import?

**Decision**: Use `GET /repos/{owner}/{repo}` response which includes a `permissions` object for the authenticated user.

**Rationale**: When authenticated with the user's token, `GET /repos/{owner}/{repo}` returns:
```json
{
  "permissions": {
    "admin": true,
    "push": true,
    "pull": true
  }
}
```

Check `permissions.admin === true` at selection time. This is a single API call that also provides repo metadata.

**Note from spec review**: Admin rights are needed for managing repo secrets (required for workflow dispatch). This is a hard requirement — `push` permission is insufficient.

**Alternatives Considered**:
- `GET /repos/{owner}/{repo}/collaborators/{username}/permission` — Returns permission level but requires admin access to call, creating a chicken-and-egg problem.

---

## Research Task 6: Duplicate Import Detection

**Question**: How to efficiently detect and display already-imported repos?

**Decision**: Query the `Project` table's `@@unique([githubOwner, githubRepo])` constraint.

**Rationale**: The Project model already enforces global uniqueness on `githubOwner` + `githubRepo`. Two approaches work together:
1. **At listing time**: Batch query `Project.findMany({ where: { OR: repos.map(r => ({ githubOwner: r.owner, githubRepo: r.name })) } })` to mark already-imported repos in the picker UI.
2. **At creation time**: The unique constraint prevents duplicates at the database level; catch the Prisma unique constraint error (`P2002`) and return a friendly message.

**Alternatives Considered**:
- In-memory Set check — Would miss concurrent imports; DB constraint is authoritative.

---

## Research Task 7: Config Fetch and Validation on Import

**Question**: Can the existing `syncProjectConfig()` be reused for import-time config processing?

**Decision**: Yes, reuse `syncProjectConfig()` directly.

**Rationale**: `syncProjectConfig()` in `lib/config-sync.ts` already:
1. Fetches `.ai-board/config.yml` from the repo's main branch
2. Parses YAML
3. Validates against the Zod schema
4. Strips the `env` section
5. Stores in `Project.config` with `configSyncedAt`

However, it uses the server-level `GITHUB_TOKEN`. For import, this works for repos the server token has access to. For external/private repos, we may need to pass the user's token. The current implementation creates an Octokit client internally — we should add an optional `accessToken` parameter to allow using the user's token.

**Alternatives Considered**:
- New config fetch function — Unnecessary duplication; a small parameter addition to `syncProjectConfig()` suffices.
