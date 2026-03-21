# Research: Persist Comparison Data to Database via Workflow

**Date**: 2026-03-21 | **Branch**: `AIB-328-persist-comparison-data`

## Research Tasks

### R1: How does the existing `/compare` command produce output?

**Decision**: The `/compare` command (`.claude/commands/ai-board.compare.md`) generates a markdown report at `specs/{branch}/comparisons/{timestamp}-vs-{keys}.md` and a result file at `specs/{branch}/.ai-board-result.md`. It does NOT currently produce structured JSON output.

**Rationale**: The command builds a `ComparisonReport` object internally (matching `lib/types/comparison.ts`) but only serializes it to markdown. Adding a parallel JSON write of the same data object is non-disruptive — the JSON file is an additive artifact.

**Alternatives considered**:
- Extracting data from the markdown report post-hoc: Rejected — fragile regex parsing, lossy (markdown doesn't preserve all numeric fields).
- Having the workflow call the comparison logic directly: Rejected — the workflow runs in a shell context with no access to TypeScript runtime.

### R2: What is the exact input contract for `persistGeneratedComparisonArtifacts()`?

**Decision**: The function at `lib/comparison/comparison-generator.ts:387` expects:
```typescript
{
  projectId: number;
  sourceTicket: { id, ticketKey, title, stage, workflowType, agent };
  participants: Array<{ id, ticketKey, title, stage, workflowType, agent }>;
  branch: string;
  report: ComparisonReport;
}
```
However, the NEW endpoint should call `persistComparisonRecord()` directly (from `lib/comparison/comparison-record.ts:28`) which expects `PersistComparisonInput` — the same fields plus `markdownPath`.

**Rationale**: `persistGeneratedComparisonArtifacts()` also generates markdown (redundant since the command already wrote it). The endpoint should call `persistComparisonRecord()` directly with the `markdownPath` included in the JSON payload.

**Alternatives considered**:
- Calling `persistGeneratedComparisonArtifacts()` from the endpoint: Rejected — it regenerates markdown unnecessarily.

### R3: How should the JSON file be structured for the workflow→API boundary?

**Decision**: The JSON file written by the `/compare` command will contain the full `PersistComparisonInput` shape: `{ projectId, sourceTicket, participants, markdownPath, report }`. The workflow reads this file and POSTs it directly to the API endpoint without transformation.

**Rationale**: Strict contract (per spec auto-resolved decision) — the JSON schema exactly mirrors what `persistComparisonRecord()` expects. No intermediate transformation reduces the risk of data loss or drift.

**Alternatives considered**:
- Loosely coupled JSON with workflow-side transformation: Rejected per spec decision — strict contract prevents silent data loss.

### R4: What authentication pattern should the new endpoint use?

**Decision**: Workflow token authentication via `Authorization: Bearer ${WORKFLOW_API_TOKEN}` header, validated by `validateWorkflowAuth()` from `app/lib/workflow-auth.ts`. No session-based or project-level access verification needed.

**Rationale**: This is the established pattern for all workflow-to-API communication (job status updates, ticket transitions, preview URL updates). Workflows are trusted automated callers. Adding project access verification would be redundant and would complicate the workflow shell script.

**Alternatives considered**:
- Session-based auth: Not applicable — workflows don't have user sessions.
- Project-level access check in addition to token: Rejected per spec auto-resolved decision — redundant for trusted workflows.

### R5: Where should the new POST endpoint live?

**Decision**: Add a POST handler to the existing `app/api/projects/[projectId]/comparisons/route.ts` file, alongside the existing GET handler.

**Rationale**: RESTful convention — creating a comparison resource at the collection endpoint. The existing file already handles project-level comparison queries. Adding POST here maintains consistency.

**Alternatives considered**:
- Separate endpoint (e.g., `/api/comparisons/persist`): Rejected — breaks REST conventions and creates unnecessary fragmentation.
- Ticket-level endpoint (`/api/projects/:id/tickets/:id/comparisons`): Rejected — the comparison involves multiple tickets; project-level is the natural collection.

### R6: How should the workflow integrate the persistence step?

**Decision**: Add a new step in `.github/workflows/ai-board-assist.yml` after the `/compare` command completes and before the commit step. The step:
1. Searches for `*.json` files in `specs/{branch}/comparisons/`
2. If found, reads the newest JSON file and POSTs it to the API
3. Logs success/failure
4. Continues regardless of outcome (graceful degradation)

**Rationale**: The workflow already has the `WORKFLOW_API_TOKEN` and `APP_URL` environment variables. The persistence step is isolated — failures don't affect the markdown artifact or workflow success.

**Alternatives considered**:
- Inline persistence in the Claude command: Rejected — commands don't have API access from the shell environment.
- Separate workflow triggered by file creation: Rejected — over-engineered for a single POST call.

### R7: How should the `/compare` command write the JSON data?

**Decision**: After generating the markdown report, the command writes a JSON file with the same timestamp-based naming convention: `{timestamp}-vs-{keys}.json` in the same `specs/{branch}/comparisons/` directory. The JSON contains the full `PersistComparisonInput` payload. If JSON writing fails, the command logs a warning and continues.

**Rationale**: Co-locating JSON with markdown keeps artifacts together. Same naming convention enables easy correlation. Failure isolation ensures the primary markdown artifact is never disrupted.

**Alternatives considered**:
- Writing JSON to a temp directory: Rejected — harder for the workflow to locate and correlates poorly with the markdown artifact.
- Writing JSON to `.ai-board-result.md` metadata: Rejected — mixing concerns; the result file is for status reporting, not data persistence.
