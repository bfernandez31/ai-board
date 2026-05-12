# API Endpoints Reference

Complete REST API documentation with authentication, request/response formats, and error handling.

## Documents in This Section

- [Projects](./projects.md) — Project CRUD, Project Setup, GitHub, Project Member endpoints
- [Tickets](./tickets.md) — Ticket CRUD and Ticket Lookup endpoints
- [Comments, Timeline & Attachments](./comments.md) — Ticket activity endpoints
- [Notifications](./notifications.md) — In-app and Push notification endpoints
- [Jobs & Telemetry](./jobs.md) — Job status polling and telemetry ingestion endpoints
- [Analytics & Activity](./analytics.md) — Analytics dashboard and activity feed endpoints
- [Documentation & Comparison](./documentation.md) — Documentation, Comparison, Constitution endpoints
- [Health](./health.md) — Health dashboard endpoints
- [Billing](./billing.md) — Billing, subscription, and usage endpoints
- [Account, Settings & Credentials](./account.md) — Settings, Account, Token, Credential endpoints
- [Admin Insights](./admin-insights.md) — `/admin/insights` page and Claude Code `/insights` workflow endpoints
- [Admin Home](./admin-home.md) — `/admin` dashboard snapshot endpoint and scheduled-workflow cron-marker callback

## Authentication

All API endpoints require authentication via NextAuth.js session cookies except where noted.

**Primary Authentication**: Session cookie (set automatically by NextAuth.js)
**Optional API Authentication**: Bearer PAT on request-aware endpoints that call `requireAuth(request)` or equivalent helpers
**Unauthenticated**: 401 Unauthorized
**Unauthorized Access**: 403 Forbidden (user is neither project owner nor member)

**Preview Credentials Login**:
- Preview deployments can expose the built-in NextAuth credentials callback at `POST /api/auth/callback/credentials`
- This flow is internal to sign-in and is available only when preview-login environment gating is enabled
- Failed credentials submissions redirect to `/auth/signin?error=dev-login`

**Test Override**:
- `x-test-user-id` is a test-only override header for automated tests
- Test support lives in server-side request handling, not in the public sign-in UI

**Authorization Pattern**:
- All project-scoped endpoints validate "owner OR member" access
- Owner check performed first for performance (no database join needed)
- Member check performed via ProjectMember table join if not owner
- Non-members receive 403 Forbidden (API) or 404 Not Found (pages)

**Workflow Endpoints**: Require Bearer token authentication
```
Authorization: Bearer <WORKFLOW_API_TOKEN>
```

## Base URL

**Development**: `http://localhost:3000`
**Production**: `https://ai-board.vercel.app` (example)


## Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": "Short error message",
  "message": "Detailed explanation",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TRANSITION` | Sequential stage transition violated |
| `JOB_NOT_COMPLETED` | Job status blocks transition |
| `MISSING_JOB` | Expected job not found (data integrity issue) |
| `ROLLBACK_NOT_ALLOWED` | Rollback conditions not met (wrong workflow type or job status) |
| `DISPATCH_FAILED_AFTER_MUTATION` | Rollback-reset dispatch failed after DB stage transition succeeded (500) |
| `VERSION_CONFLICT` | Optimistic concurrency control conflict |
| `INVALID_TOKEN` | Workflow authentication failed |
| `VALIDATION_ERROR` | Zod schema validation failed |
| `PLAN_LIMIT` | Action blocked because user has reached their plan quota (403) |

### HTTP Status Codes

| Code | Usage |
|------|-------|
| `200` | Success (GET, PATCH) |
| `201` | Created (POST) |
| `204` | No Content (DELETE) |
| `400` | Bad Request (validation, invalid transition) |
| `401` | Unauthorized (authentication failed) |
| `403` | Forbidden (authorization failed) |
| `404` | Not Found (resource doesn't exist) |
| `409` | Conflict (version mismatch) |
| `413` | Payload Too Large (file upload) |
| `500` | Internal Server Error |


## Rate Limiting

Currently no rate limiting implemented. Future enhancement may add:
- Per-user request limits
- Per-IP request limits
- Workflow endpoint protection


## Pagination

Scan history (`GET /api/projects/[projectId]/health/scans`) and activity feed (`GET /api/projects/:projectId/activity`) use cursor-based pagination. All other endpoints return complete result sets.
