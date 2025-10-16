# API Contracts

**Feature**: 033-link-to-branch

## Summary

**No API contracts required**: This feature is purely client-side and uses existing API endpoints without modifications.

## Existing API Endpoints (Read-Only)

### GET /api/projects/:projectId/tickets/:id

**Used By**: Board component (parent of ticket-detail-modal)

**Purpose**: Fetches ticket data including branch field

**Response Schema** (Relevant Fields):
```typescript
{
  id: number;
  branch: string | null;
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP';
  project: {
    githubOwner: string;
    githubRepo: string;
  };
}
```

**No Changes**: Feature reads existing response fields

---

## External Integrations

### GitHub Branch URL (Read-Only)

**Pattern**: `https://github.com/{owner}/{repo}/tree/{branch}`

**Method**: External link (not an API call)

**Security**: Uses `rel="noopener noreferrer"` for security

**No Authentication Required**: Public GitHub repositories work without auth; private repositories use user's GitHub session

