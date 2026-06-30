# Contract: PR Diff API

**Endpoint**: `GET /api/projects/[projectId]/tickets/[id]/pr-diff`
**Auth**: session (project owner or member) via `verifyProjectAccess` / `verifyTicketAccess`,
**plus** the acting user's GitHub OAuth token (`createUserGitHubClient`).
**File**: `app/api/projects/[projectId]/tickets/[id]/pr-diff/route.ts`

This is the single live read powering the viewer. It performs **no mutation** and triggers **no
review computation** (FR-012, SC-002).

## Request

Path params:
- `projectId` — integer, validated with `ProjectIdSchema`.
- `id` — ticket id (numeric) or ticketKey; resolved with `resolveTicket`.

No body. No required query params. (Optional future: `?refresh=1` — out of scope v1.)

## Behavior (PR State Retrieval)

1. `verifyTicketAccess(ticketId)` → 401/403 on failure.
2. Resolve ticket; require `ticket.branch` (else `BRANCH_NOT_FOUND` 404).
3. `createUserGitHubClient(session.user.id)` + `requireRepoScope`. Missing token/scope →
   `AUTH_REQUIRED` (403) with actionable message (FR-017).
4. Resolve PR: `pulls.list({ owner, repo, head: "owner:branch", state: 'all', per_page: 50 })`,
   prefer `open`, else most recent by `updated_at`. None → **200** with `pr: null`,
   `layers: []`, `files: []` (NO_PR_FOUND empty state — not an error).
5. Fetch files: `pulls.listFiles` (paginated, capped at `GITHUB_FILES_CAP`); map to `FileChange`.
   Mark `binary` (no `patch`) and `patchTruncated` (oversized) ⇒ `truncated: true`.
6. Fetch inline comments: `pulls.listReviewComments` (paginated); map to `InlineComment` with
   `source`/`outdated` derivation; attach to files by `path` + current-line anchoring.
7. Load latest COMPLETED verify job for the ticket (`getLatestScoredVerifyJob` pattern); parse
   `layerDecomposition` + read `qualityScore`/synthesis for Overview.
8. Reconcile stored layers × current files → `ResolvedLayer[]` + synthetic "Additional changes".
9. Return `PrDiffResponse`.

All GitHub calls wrapped in `callWithRetry`; transient failures → `GITHUB_API_ERROR` (502/500).

## Responses

### 200 OK — `PrDiffResponse`

```json
{
  "pr": { "number": 542, "title": "AIB-879 diff viewer", "state": "open", "url": "https://github.com/o/r/pull/542" },
  "overview": { "pr": { "...": "..." }, "reviewSynthesis": "…", "qualityScore": 84, "qualityThreshold": "Good" },
  "layers": [
    { "id": "foundations", "title": "Foundations", "summary": "schema & contracts", "order": 1,
      "synthetic": false, "fileCount": 2, "commentCount": 1,
      "files": [ { "filename": "prisma/schema.prisma", "status": "modified", "additions": 3, "deletions": 0,
                   "patch": "@@ …", "binary": false, "patchTruncated": false,
                   "comments": [ { "id": 1, "source": "ai-board", "author": "ai-board[bot]", "line": 64, "body": "…", "outdated": false, "createdAt": "…" } ] } ] }
  ],
  "files": [ { "filename": "prisma/schema.prisma", "status": "modified", "additions": 3, "deletions": 0, "patch": "@@ …", "binary": false, "patchTruncated": false, "comments": [] } ],
  "truncated": false
}
```

### 200 OK — no PR (`pr: null`)
`{ "pr": null, "overview": { "pr": null, "reviewSynthesis": null, "qualityScore": null, "qualityThreshold": null }, "layers": [], "files": [], "truncated": false }`

### Error envelope (constitution "Error Handling"): `{ "error": string, "code": string }`

| Status | code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | bad `projectId`/`id` |
| 401 | `UNAUTHORIZED` | not signed in |
| 403 | `FORBIDDEN` | not owner/member |
| 403 | `AUTH_REQUIRED` | no GitHub token / missing `repo` scope (actionable) |
| 404 | `TICKET_NOT_FOUND` | ticket not in project |
| 404 | `BRANCH_NOT_FOUND` | ticket has no branch |
| 403 | `GITHUB_FORBIDDEN` | GitHub 403 reading the repo (actionable) |
| 500/502 | `GITHUB_API_ERROR` | transient/unknown GitHub failure |

## Notes
- Mirrors `app/api/projects/[projectId]/docs/diff/route.ts` error-mapping pattern; adds the
  `pr: null` empty-state (200) and `AUTH_REQUIRED`/`GITHUB_FORBIDDEN` codes.
- Test-mode short-circuit (`NODE_ENV==='test' || TEST_MODE || TEST_USER_ID`) returns a deterministic
  fixture (layers + files + comments incl. one outdated) — same convention as docs/diff.
