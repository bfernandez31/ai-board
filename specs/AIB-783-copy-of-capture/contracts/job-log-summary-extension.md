# Contract: POST /api/jobs/:id/logs (extension for raw artifact metadata)

**Existing endpoint.** Extended in this feature; behavior for callers that omit the new fields is unchanged.

## Schema additions to `JobLogSubmissionSchema` (`app/lib/logs/schema.ts`)
Two new optional fields added to `baseSubmission`:

```ts
const baseSubmission = z.object({
  captureStatus: CaptureStatusWriteSchema,
  preview: z.string().min(1).max(PREVIEW_INPUT_MAX_CHARS),
  schemaVersion: z.literal(SCHEMA_VERSION),
  eventCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  artifactKey: z.string().max(300).optional(),
  artifactSize: z.number().int().positive().optional(),
  rawArtifactKey: z.string().max(300).optional(),       // NEW
  rawArtifactSize: z.number().int().positive().optional(), // NEW
});
```

## Validation rules added (NEW refine())
A second `refine()` is appended to the existing chain (P4 in research.md):
- If either `rawArtifactKey` or `rawArtifactSize` is present, BOTH MUST be present. If both absent, the row's raw fields stay null.
- Unlike the normalized pair, raw is **not** tied to `captureStatus`. A submission with `captureStatus === 'UNAVAILABLE'` MUST NOT include raw fields (no raw without normalized). A submission with `captureStatus === 'CAPTURED'` MAY include raw fields (Claude success path) or omit them (Claude no-data, Claude raw-failure, non-Claude all collapse here).

```ts
.refine(
  (data) => {
    const hasKey = data.rawArtifactKey !== undefined;
    const hasSize = data.rawArtifactSize !== undefined;
    if (hasKey !== hasSize) return false;
    if (hasKey && data.captureStatus !== 'CAPTURED') return false;
    return true;
  },
  {
    message:
      'rawArtifactKey and rawArtifactSize must be set together, and only when captureStatus is CAPTURED',
    path: ['rawArtifactKey'],
  }
)
```

## Handler change (`app/api/jobs/[id]/logs/route.ts`)
The `data` object passed to `prisma.jobLog.upsert` gains:
```ts
rawArtifactKey: submission.rawArtifactKey ?? null,
rawArtifactSize: submission.rawArtifactSize ?? null,
```
Both `create` and `update` paths use the same `data` object — preserves single-upsert atomicity (P5 in research.md).

## Response change
The 200 response is extended to optionally surface the raw URL:
```ts
return NextResponse.json({
  captureStatus,
  preview,
  schemaVersion,
  eventCount,
  errorCount,
  artifactSize,
  capturedAt,
  rawUrl,                // existing — normalized
  rawArtifactSize: row.rawArtifactSize, // NEW
  rawNativeUrl: row.rawArtifactKey      // NEW
    ? buildJobLogRawNativeUrl(job.projectId, job.ticketId, jobId)
    : null,
}, { status: 200, headers: { 'Cache-Control': 'no-store' } });
```

## Backwards compatibility
- Old runners (no raw fields) continue to work — their submissions parse cleanly because both new fields are optional.
- Old API consumers ignore `rawArtifactSize` and `rawNativeUrl` (additive response).
