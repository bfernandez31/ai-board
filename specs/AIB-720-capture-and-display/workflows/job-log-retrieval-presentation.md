# Job Log Retrieval Presentation

1. `GET /api/projects/:projectId/tickets/:ticketId/jobs` returns existing telemetry plus log metadata:
   - `logAvailability`
   - `logCapturedAt`
   - `logRetainedUntil`
   - `logPrunedAt`
   - `logSummary`
2. `GET /api/projects/:projectId/tickets/:ticketId/timeline` enriches completed job events with the same preview-safe log summary fields.
3. The stats surface and timeline render a compact headline plus the latest important events instead of inlining the full transcript.
4. `View full logs` opens a nested dialog inside the ticket detail modal and fetches `GET /api/projects/:projectId/jobs/:jobId/logs` on demand.
5. The dialog shows retained events in execution order and preserves summary-only audit states for `PARTIAL`, `UNAVAILABLE`, and `PRUNED`.

Authorization:
- Timeline/job preview routes follow the existing project-member ticket access rules.
- Full-detail retrieval also requires project access and verifies the job belongs to the requested project.
