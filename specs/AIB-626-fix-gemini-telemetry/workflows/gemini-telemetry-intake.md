# Workflow Artifact: Gemini Telemetry Intake and Normalization

## Workflow Definition

### Input

- normalized Gemini batch payload
- workflow bearer token
- target `jobId`

### Phases

1. Validate workflow auth.
2. Validate Gemini payload schema.
3. Resolve the referenced job.
4. Normalize Gemini usage categories into shared job telemetry fields.
5. Merge tools and usage without double-counting repeated result payloads.
6. Persist updated job telemetry for analytics.

## Callback / Reporting Contract

- `200` on accepted merge
- `404` when job does not exist
- `400` when payload shape is invalid
- `401` on invalid workflow auth

## Error behavior

- Invalid or unmatchable events must not mutate unrelated jobs.
- Recoverable delayed telemetry may complete the job record later.
