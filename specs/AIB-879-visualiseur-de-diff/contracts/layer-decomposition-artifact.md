# Contract: Layer Decomposition Artifact

The persisted snapshot emitted by the VERIFY code-review and stored on the verify `Job`.

## Storage
- Column: `Job.layerDecomposition String?` (nullable JSON string).
- Written **only** on `PATCH /api/jobs/[id]/status` with `status: "COMPLETED"`, inside the
  existing atomic conditional update (beside `qualityScore`). Absent field → no write.

## Transport marker (agent → workflow)
The `ai-board.code-review` command emits exactly one line, on its own line, **before** the
mandatory final `QUALITY_SCORE_JSON:` line (which must remain the absolute-last output):

```
LAYER_DECOMPOSITION_JSON:{"version":1,"computedAt":"<ISO8601>","layers":[{"id":"foundations","title":"Foundations","summary":"schema & contracts","order":1,"files":["prisma/schema.prisma"]}]}
```

`verify.yml` greps this marker independently (NOT `tail -1`), base64-encodes it, and includes
`layerDecomposition` in the COMPLETED PATCH payload.

## JSON schema (validated by Zod on read; tolerant parse like `parseQualityScoreDetails`)

```ts
{
  version: 1,
  computedAt: string,                  // ISO-8601
  layers: Array<{
    id: string,                        // stable slug
    title: string,
    summary: string,
    order: number,                     // 1-based, unique, ascending
    files: string[]                    // PR-relative paths at review time
  }>
}
```

## Invariants
- Parse failures / null → treated as "no decomposition" (viewer falls back to flat Files, FR-014).
- A file may appear in at most one layer (first wins on conflict).
- `order` defines dependency order; the viewer renders layers in ascending `order`.
- Snapshot semantics: files added after review are NOT in any layer → routed to synthetic
  "Additional changes" at view time (FR-015). Files removed after review simply drop out;
  empty layers are omitted without breaking ordering.
- Backward compatible: jobs predating this feature have `layerDecomposition = null`.

## PATCH payload addition (`/api/jobs/[id]/status`)
```json
{ "status": "COMPLETED", "qualityScore": 84, "qualityScoreDetails": "…", "layerDecomposition": "{…}" }
```
`layerDecomposition` is optional; validated as a string (JSON-parseable) when present.
