# Quickstart: Persist Comparison Data

**Branch**: `AIB-328-persist-comparison-data`

## What This Feature Does

Bridges the `/compare` command output with the database-backed comparison dashboard. After a comparison runs, structured JSON data is written alongside the markdown report, then the workflow POSTs it to a new API endpoint that persists it to the database.

## Three Changes Required

### 1. Compare Command — Write JSON Data File
**File**: `.claude/commands/ai-board.compare.md`

After the markdown report is generated (Step 10), add a new step that writes a JSON file containing the full `PersistComparisonInput` payload to the same comparisons directory.

### 2. API Endpoint — Accept and Persist Data
**File**: `app/api/projects/[projectId]/comparisons/route.ts`

Add a `POST` handler alongside the existing `GET`. The handler:
- Validates workflow token auth via `validateWorkflowAuth()`
- Parses and validates the JSON body with a Zod schema
- Calls `persistComparisonRecord()` from `lib/comparison/comparison-record.ts`
- Returns `{ id, generatedAt }` on success

### 3. Workflow — POST JSON to API
**File**: `.github/workflows/ai-board-assist.yml`

Add a step after the `/compare` command execution that:
- Finds the newest `.json` file in `specs/{branch}/comparisons/`
- POSTs its contents to `${APP_URL}/api/projects/${PROJECT_ID}/comparisons`
- Uses `Authorization: Bearer ${WORKFLOW_API_TOKEN}`
- Logs outcome, continues on failure

## Key Files

| File | Role |
|------|------|
| `.claude/commands/ai-board.compare.md` | Command that generates comparison + JSON |
| `app/api/projects/[projectId]/comparisons/route.ts` | GET (existing) + POST (new) endpoint |
| `.github/workflows/ai-board-assist.yml` | Workflow orchestration with persistence step |
| `lib/comparison/comparison-record.ts` | `persistComparisonRecord()` — existing DB layer |
| `lib/types/comparison.ts` | TypeScript types for comparison data |
| `app/lib/workflow-auth.ts` | `validateWorkflowAuth()` — auth helper |

## Testing Strategy

- **Integration test**: POST endpoint with valid/invalid payloads → verify DB records created
- **Integration test**: POST endpoint auth validation → verify 401 on missing/bad token
- **Unit test**: JSON file structure validation (Zod schema)
