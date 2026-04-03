# Data Model: Project Import — OAuth Repo Scope + Repo Picker + Creation Flow

**Ticket**: AIB-471
**Date**: 2026-04-02

---

## Existing Entities (No Schema Changes Required)

### Project

The `Project` model already has all required fields for repo import:

| Field | Type | Notes |
|-------|------|-------|
| `githubOwner` | `String @db.VarChar(100)` | Repo owner (user or org) |
| `githubRepo` | `String @db.VarChar(100)` | Repository name |
| `config` | `Json?` | Parsed `.ai-board/config.yml` (env stripped) |
| `configSyncedAt` | `DateTime?` | Last config sync timestamp |

**Constraints**: `@@unique([githubOwner, githubRepo])` — enforces global duplicate prevention (FR-014).

### Account (NextAuth)

| Field | Type | Notes |
|-------|------|-------|
| `access_token` | `String?` | GitHub OAuth token |
| `scope` | `String?` | OAuth scopes granted (e.g., `"read:user,user:email,repo"`) |

**No schema migration needed** — both models already have the required fields.

---

## New TypeScript Interfaces

### GitHubRepo (API response shape)

```typescript
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;         // "owner/repo"
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  pushed_at: string | null;  // ISO 8601
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}
```

### GitHubOrg (for org filter)

```typescript
interface GitHubOrg {
  login: string;
  avatar_url: string;
}
```

### RepoPickerItem (frontend display)

```typescript
interface RepoPickerItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar: string;
  description: string | null;
  isPrivate: boolean;
  pushedAt: string | null;
  hasAdminAccess: boolean;
  isAlreadyImported: boolean;
  existingProjectId?: number;
}
```

### ImportProjectRequest

```typescript
interface ImportProjectRequest {
  githubOwner: string;
  githubRepo: string;
  name?: string;          // Defaults to repo name
  description?: string;   // Defaults to repo description or empty
}
```

### ImportProjectResponse

```typescript
interface ImportProjectResponse {
  project: {
    id: number;
    name: string;
    key: string;
    githubOwner: string;
    githubRepo: string;
    hasConfig: boolean;
  };
  redirectTo: string;     // "/projects/{id}" or "/projects/{id}/setup"
}
```

### AuthStatus

```typescript
interface GitHubAuthStatus {
  hasGitHubAccount: boolean;
  hasRepoScope: boolean;
  reauthorizeUrl?: string;
}
```

---

## State Transitions

### Import Flow States

```
[No Project]
  → Check auth status (has repo scope?)
    → No: Show re-auth prompt → Re-authorize → Return to import
    → Yes: Open repo picker
      → Select repo → Validate admin rights
        → No admin: Show error, stay in picker
        → Has admin: Check duplicate
          → Duplicate: Show error with existing project link
          → Unique: Create project → Sync config
            → Config found + valid: Redirect to /projects/{id}
            → Config missing/invalid: Redirect to /projects/{id}/setup
```

---

## Validation Rules

| Field | Rule | Source |
|-------|------|--------|
| `githubOwner` | Non-empty string, max 100 chars | Prisma schema |
| `githubRepo` | Non-empty string, max 100 chars | Prisma schema |
| `name` | 1-255 chars (defaults to repo name) | Existing createProjectSchema |
| `description` | String (defaults to repo description) | Existing createProjectSchema |
| `key` | 3-6 uppercase alphanumeric, auto-generated | Existing key generation logic |
| Admin rights | `permissions.admin === true` on GitHub repo | FR-009 |
| Uniqueness | `(githubOwner, githubRepo)` globally unique | DB constraint |
| Quota | User's project count < plan limit | Existing quota logic |
