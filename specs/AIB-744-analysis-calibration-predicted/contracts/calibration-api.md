# API Contract: Calibration Drift Dashboard

**Branch**: `AIB-744-analysis-calibration-predicted` · **Date**: 2026-04-30
**Spec**: `specs/AIB-744-analysis-calibration-predicted/spec.md`

One new HTTP endpoint. Owner-only via the existing `verifyProjectOwnership` helper. Read-only — no PUT/PATCH/DELETE/POST.

---

## `GET /api/projects/:projectId/calibration`

Returns the project owner's drift dashboard payload — confusion matrix, distributions, recommendation panel, and adoption counter — for the most recent 30 calibration rows in the project.

### Authorization

| Caller | Response |
|---|---|
| Authenticated as project owner | `200` with `CalibrationDashboardData` |
| Authenticated as project member (not owner) | `404 { "error": "Not found" }` |
| Authenticated as a user without project access | `404 { "error": "Not found" }` (indistinguishable from member-without-access) |
| Unauthenticated | `401 { "error": "Unauthorized" }` |

The 404 path collapses two distinct underlying failures (`Project not found` and `Unauthorized` from `verifyProjectOwnership`) to a single response shape — required for SC-007 (no leak that the dashboard exists for the project).

### Request

- **Method**: `GET`
- **Path**: `/api/projects/:projectId/calibration`
- **Path params**: `projectId` (integer, required, > 0)
- **Query params**: none in v1. (A future `window` query param is anticipated by the spec — out of scope here.)
- **Headers**: standard session cookie OR `Authorization: Bearer <PAT>` per `lib/db/auth-helpers.ts:30`.
- **Body**: none

### Response — `200 OK`

Content-Type: `application/json`

```ts
interface CalibrationDashboardData {
  // Window context
  windowSize: number;          // number of rows in the response (≤ 30)
  totalRows: number;           // total calibration rows in the project (for "30 of N")
  warmingUp: boolean;          // true iff totalRows < 30

  // Friction confusion matrix on the binary "predicted clean" / "actual frictionFree" classification.
  // Counts across the windowed rows; partial rows always contribute to friction (per FR-011).
  confusionMatrix: {
    truePositive: number;      // predicted clean, actual frictionFree
    trueNegative: number;      // predicted friction, actual not frictionFree
    falsePositive: number;     // predicted clean, actual not frictionFree
    falseNegative: number;     // predicted friction, actual frictionFree
    precisionLowRisk: number | null;  // TP / (TP + FP), null when (TP+FP)=0
    recallLowRisk: number | null;     // TP / (TP + FN), null when (TP+FN)=0
    total: number;             // TP + TN + FP + FN
  };

  // Hit/miss/n_a distributions for quality and cost. Counts sum to windowSize.
  qualityDistribution: VerdictDistribution;
  costDistribution: VerdictDistribution;

  // Recommendation panel — two independent rates over the window.
  // Denominators exclude `n_a` (recommendation axes are always populated, so denominator == windowSize).
  recommendation: {
    matchedRate: number | null;          // count(matched=true) / windowSize, null when windowSize=0
    frictionAlignedRate: number | null;  // count(frictionAligned=true) / windowSize, null when windowSize=0
    counts: {
      matched: number;
      frictionAligned: number;
    };
  };

  // Adoption — independent of the 30-row window (FR-016).
  adoption: {
    analyzed: number;             // count of distinct tickets in project with ≥1 TicketAnalysis row of any status
    sinceFeatureAvailable: number; // count of tickets created on/after MIN(TicketAnalysis.createdAt) for project
    ratio: number | null;         // analyzed / sinceFeatureAvailable, null when sinceFeatureAvailable=0
  };

  // Generation timestamp (ISO 8601, UTC).
  generatedAt: string;
}

interface VerdictDistribution {
  hit: number;
  miss: number;
  na: number;                  // 'n_a' renamed to 'na' for JSON ergonomics
  total: number;               // hit + miss + na (== windowSize when no future axes are added)
  hitRate: number | null;      // hit / (hit + miss); null when (hit + miss) = 0
}
```

#### Example response

```json
{
  "windowSize": 30,
  "totalRows": 47,
  "warmingUp": false,
  "confusionMatrix": {
    "truePositive": 14,
    "trueNegative": 8,
    "falsePositive": 5,
    "falseNegative": 3,
    "precisionLowRisk": 0.7368421052631579,
    "recallLowRisk": 0.8235294117647058,
    "total": 30
  },
  "qualityDistribution": {
    "hit": 12,
    "miss": 6,
    "na": 12,
    "total": 30,
    "hitRate": 0.6666666666666666
  },
  "costDistribution": {
    "hit": 22,
    "miss": 7,
    "na": 1,
    "total": 30,
    "hitRate": 0.7586206896551724
  },
  "recommendation": {
    "matchedRate": 0.7666666666666667,
    "frictionAlignedRate": 0.6,
    "counts": { "matched": 23, "frictionAligned": 18 }
  },
  "adoption": {
    "analyzed": 89,
    "sinceFeatureAvailable": 142,
    "ratio": 0.6267605633802817
  },
  "generatedAt": "2026-05-12T14:32:11.000Z"
}
```

#### Empty-state response (project has zero calibration rows)

```json
{
  "windowSize": 0,
  "totalRows": 0,
  "warmingUp": true,
  "confusionMatrix": {
    "truePositive": 0,
    "trueNegative": 0,
    "falsePositive": 0,
    "falseNegative": 0,
    "precisionLowRisk": null,
    "recallLowRisk": null,
    "total": 0
  },
  "qualityDistribution": { "hit": 0, "miss": 0, "na": 0, "total": 0, "hitRate": null },
  "costDistribution":    { "hit": 0, "miss": 0, "na": 0, "total": 0, "hitRate": null },
  "recommendation": {
    "matchedRate": null,
    "frictionAlignedRate": null,
    "counts": { "matched": 0, "frictionAligned": 0 }
  },
  "adoption": { "analyzed": 0, "sinceFeatureAvailable": 0, "ratio": null },
  "generatedAt": "2026-05-12T14:32:11.000Z"
}
```

The component renders the "still warming up" indicator whenever `warmingUp === true`, regardless of whether `totalRows` is 0 or 1..29.

### Error responses

| Status | Body | Triggered by |
|---|---|---|
| `400` | `{ "error": "Invalid project ID" }` | `Number.isNaN(projectId) \|\| projectId <= 0` |
| `401` | `{ "error": "Unauthorized" }` | No session and no Bearer token |
| `404` | `{ "error": "Not found" }` | `verifyProjectOwnership` threw `Project not found` (project doesn't exist OR caller is not the owner) |
| `500` | `{ "error": "Internal server error" }` | Unhandled — caught at the bottom of the route's try/catch, logged with `[calibration-api]` prefix |

### Implementation contract

The route MUST:
1. Parse `projectId` from the path; return `400` on invalid input (constitution §IV — input validation).
2. Call `await verifyProjectOwnership(projectId, request)` — re-uses the existing owner-only gate (P3 in `research.md`). The helper itself handles both session and PAT authentication.
3. Map `Error('Project not found')` to `404 { error: 'Not found' }`.
4. Map `Error('Unauthorized')` (raised by `requireAuth` for unauthenticated callers) to `401 { error: 'Unauthorized' }`. Note: collapse to `404` instead **only** when `verifyProjectOwnership` throws `'Project not found'` — i.e. authenticated-but-not-owner is `404` (indistinguishability), but unauthenticated stays `401` (standard auth handling).
5. Call `await getCalibrationDashboard(projectId)` from `lib/calibration/queries.ts`.
6. Return `NextResponse.json(data, { status: 200 })`.
7. Wrap everything in a single try/catch; log uncaught errors with `console.error('[calibration-api]', error)` before returning `500`.

The route MUST NOT:
- Trigger any recomputation, LLM call, or write (FR-017).
- Expose calibration rows on individual ticket pages or to non-owners (FR-021).
- Accept query parameters that change the rule-set version, window size, or any computed verdict (read-only on inputs as well as outputs).

### Polling cadence

Clients (the dashboard component via TanStack Query) poll this endpoint every **15 seconds** with `staleTime: 10000`, matching the existing analytics dashboard (`components/analytics/analytics-dashboard.tsx:99`). FR-017 mandates the 15s cadence; the constitution's state-management rules (CLAUDE.md "client-side polling" line) document it as the platform convention.

### Cache headers

`NextResponse.json()` returns the platform default — no `Cache-Control: max-age` overrides. The dashboard's freshness comes from polling, not from HTTP caching.

---

## Out-of-scope endpoints

Documented here so a future ticket can pick them up without re-deriving the API surface:

- `GET /api/projects/:projectId/calibration/raw` — return the raw 30 calibration rows for owner debugging. **Not added in v1**: spec §FR-021 limits surface to owners and forbids ticket-level exposure; the dashboard payload above is sufficient for the headline use case.
- `POST /api/projects/:projectId/calibration/repair` — owner-initiated re-pair of a single ticket whose calibration failed. **Out of scope per spec** ("a subsequent owner-initiated re-pair is out of scope for this feature").
- `GET /api/projects/:projectId/tickets/:ticketId/calibration` — per-ticket calibration. **Forbidden by FR-021**.
