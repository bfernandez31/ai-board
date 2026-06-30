# Internal Process: PR State Retrieval (on viewer open)

A read-only retrieval executed by the PR-diff API route when the viewer opens. Mutates nothing.

## Inputs
- The ticket's `branch` and the project's `githubOwner`/`githubRepo` (from `verifyTicketAccess`).
- The acting user's GitHub OAuth authorization (`createUserGitHubClient`).

## Phases
1. **Authorize**: `verifyTicketAccess` (owner/member) → GitHub client for the acting user +
   `requireRepoScope`.
2. **Resolve PR**: `pulls.list({ head: "owner:branch", state: 'all' })`; prefer open, else latest.
   None → `pr: null` empty state.
3. **Fetch diff**: `pulls.listFiles` (paginated, `GITHUB_FILES_CAP`); map to `FileChange`, mark
   binary/oversized.
4. **Fetch comments**: `pulls.listReviewComments`; attribute source, anchor to current line, flag
   outdated; attach to files.
5. **Merge layers**: load latest COMPLETED verify job, parse `layerDecomposition`; reconcile with
   current files; unclassified → synthetic "Additional changes"; derive counters post-merge.
6. **Overview**: read `qualityScore`/threshold + review synthesis from the same verify job.

## Output
`PrDiffResponse` (Overview + layers + files + comments + `truncated`) for the current PR state.

## Error behavior
- Missing PR → `pr: null` (200), not an error.
- Missing GitHub authorization/scope → `AUTH_REQUIRED`/`GITHUB_FORBIDDEN` (actionable message).
- No stored decomposition → `layers: []` (client uses flat Files mode).
- Transient GitHub failure (after retry) → `GITHUB_API_ERROR`.
- No data is mutated under any path.

## Reporting contract
Synchronous HTTP response to the client; consumed by the `usePrDiff` TanStack Query hook
(lazy `enabled` on viewer open, fresh fetch — no aggressive polling).
