# Quickstart: View and Edit the Constitution

**Feature Branch**: `AIB-103-view-and-edit`
**Date**: 2025-12-11

## Prerequisites

- Node.js 22.20.0 with bun package manager
- PostgreSQL 14+ running locally
- GitHub Personal Access Token (GH_PAT) configured
- Project with valid `githubOwner` and `githubRepo` configured

## Getting Started

### 1. Checkout the feature branch

```bash
git checkout AIB-103-view-and-edit
```

### 2. Install dependencies

```bash
bun install
```

### 3. Run the development server

```bash
bun run dev
```

### 4. Access the feature

1. Navigate to a project's settings page: `http://localhost:3000/projects/{projectId}/settings`
2. Click the "Constitution" button to open the viewer
3. View, edit, or browse history of the constitution file

## Key Files

### API Routes

| File | Purpose |
|------|---------|
| `app/api/projects/[projectId]/constitution/route.ts` | GET/PUT constitution content |
| `app/api/projects/[projectId]/constitution/history/route.ts` | GET commit history |
| `app/api/projects/[projectId]/constitution/diff/route.ts` | GET commit diff |

### Components

| File | Purpose |
|------|---------|
| `components/settings/constitution-card.tsx` | Settings card with open button |
| `components/settings/constitution-viewer.tsx` | Modal with view/edit/history tabs |

### Utilities

| File | Purpose |
|------|---------|
| `lib/github/constitution-fetcher.ts` | GitHub API client for constitution file |
| `lib/hooks/use-constitution.ts` | TanStack Query hook for content |
| `lib/hooks/use-constitution-history.ts` | TanStack Query hooks for history/diff |

### Tests

| File | Purpose |
|------|---------|
| `tests/e2e/constitution.spec.ts` | Playwright E2E tests |
| `tests/unit/constitution-validation.test.ts` | Vitest unit tests |

## Testing

### Run unit tests

```bash
bun run test:unit
```

### Run E2E tests

```bash
bun run test:e2e
```

### Run specific test file

```bash
# Unit tests
bun run test:unit constitution

# E2E tests
bun run test:e2e tests/e2e/constitution.spec.ts
```

## API Usage

### Get constitution content

```bash
curl -X GET http://localhost:3000/api/projects/1/constitution \
  -H "Cookie: next-auth.session-token=..."
```

### Update constitution

```bash
curl -X PUT http://localhost:3000/api/projects/1/constitution \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"content": "# Updated Constitution\n\nNew content here..."}'
```

### Get history

```bash
curl -X GET http://localhost:3000/api/projects/1/constitution/history \
  -H "Cookie: next-auth.session-token=..."
```

### Get diff

```bash
curl -X GET "http://localhost:3000/api/projects/1/constitution/diff?sha=abc123..." \
  -H "Cookie: next-auth.session-token=..."
```

## Troubleshooting

### "Constitution file not found"

The project's repository doesn't have a `.specify/memory/constitution.md` file. Create one using:

```bash
# In the target repository
/speckit.constitution
```

### "Forbidden - user lacks project access"

Ensure you're authenticated and are either the project owner or a member. Check project membership in the database.

### GitHub rate limiting

If you see 403 errors mentioning rate limits, wait 60 seconds or authenticate with a GitHub token with higher rate limits.

## Related Documentation

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Research Notes](./research.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/api.yaml)
