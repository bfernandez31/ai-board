# Quickstart: Persist comparison data to database via workflow

## Goal

Implement a workflow-only persistence bridge for `/compare` that preserves the existing markdown artifact and creates a durable comparison record when `comparison-data.json` is available.

## Implementation Order

1. Extend compare generation
   - Update [`/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts`](/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts) to serialize `comparison-data.json` beside the markdown output.
   - Generate a stable `compareRunKey` per compare run.
   - Keep markdown success independent from JSON serialization success.

2. Add request/schema helpers
   - Define a shared Zod schema and TS types for the persistence request body.
   - Ensure request parsing can reject stale, malformed, or incomplete JSON before any DB writes.

3. Add workflow-only POST route
   - Extend [`/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`](/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts) with `POST`.
   - Verify workflow bearer auth first.
   - Resolve the source ticket and participant tickets in project scope.
   - Delegate durable writes to the existing comparison persistence service.

4. Add idempotency handling
   - Treat repeated submissions with the same `compareRunKey` as the same compare run.
   - Keep separate runs with different keys as independent history entries.

5. Update the workflow
   - Extend [`/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml`](/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml) after `/compare` execution.
   - If `specs/$BRANCH/comparisons/comparison-data.json` is missing, log a skip and continue.
   - If present, `curl` or equivalent POSTs it to the persistence endpoint with `Authorization: Bearer $WORKFLOW_API_TOKEN`.
   - Delete `comparison-data.json` before `git add "specs/$BRANCH/"`.
   - Log `created`, `duplicate`, validation failure, and server failure distinctly, but do not fail the overall compare workflow if markdown succeeded.

6. Add tests
   - Unit tests for JSON artifact generation and idempotency helpers.
   - Integration tests for `POST /comparisons` success, invalid auth, invalid payload, missing ticket, and duplicate retry behavior.
   - Extend comparison read-side integration coverage if needed to confirm the persisted record is visible through the dashboard APIs.

## Manual Verification

1. Run `/compare` on a ticket with at least one participant.
2. Confirm a markdown report still appears under `specs/<branch>/comparisons/`.
3. Confirm `comparison-data.json` is produced in the same directory when serialization succeeds.
4. Submit the JSON artifact to `POST /api/projects/{projectId}/tickets/{ticketId}/comparisons` with workflow bearer auth.
5. Verify the response returns a durable comparison ID.
6. Verify `GET /api/projects/{projectId}/tickets/{ticketId}/comparisons` includes the new record.
7. Re-submit the same JSON payload and verify idempotent handling.
8. Force JSON absence or API failure and verify the compare workflow still reports markdown success.

## Verification Commands

```bash
bun run test:unit
bun run test:integration -- comparisons
bun run type-check
bun run lint
```

## Expected Failure Modes

- Missing `comparison-data.json`: workflow logs `skipped`, compare remains successful.
- Malformed JSON: endpoint returns `400`, database unchanged, workflow logs categorized failure.
- Wrong project/ticket scope: endpoint returns `404` or `400`, no durable record created.
- Persistence service failure: endpoint returns `500`, workflow logs failure and still completes compare successfully if markdown exists.
