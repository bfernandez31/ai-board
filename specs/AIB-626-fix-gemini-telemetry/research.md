# Research: Fix Gemini Telemetry: Native Telemetry Parsing and Cost Estimation

**Branch**: `AIB-626-fix-gemini-telemetry`
**Created**: 2026-04-13

## Resolved Unknowns

### 1. Gemini telemetry source of truth

- Decision: Treat Gemini's native `stream-json` output captured by `.github/scripts/run-agent.sh` as the authoritative ingestion source for Gemini usage and tool telemetry, then normalize it in `POST /api/telemetry/v1/logs`.
- Rationale: The runner already captures Gemini JSONL output and posts a batch payload, but it only extracts `inputTokens`, `outputTokens`, `durationMs`, and `toolsUsed`. Extending that path is lower risk than introducing a second Gemini-only ingestion channel.
- Alternatives considered:
  - Add a separate Gemini-only API endpoint. Rejected because the existing telemetry route already centralizes auth, validation, and merge semantics.
  - Reconstruct Gemini usage after completion from logs only. Rejected because FR-001 requires native telemetry rather than manual reconstruction.

### 2. Handling thinking and cache usage categories

- Decision: Extend the normalized Gemini batch contract to carry distinct usage buckets for input, output, thinking, cache-read, and cache-write/cache-creation whenever the CLI emits them, and keep those categories separate through merge and pricing logic.
- Rationale: The current `Job` schema has separate cache fields but no thinking field. The plan therefore needs either an additive schema extension for thinking tokens or an explicit documented blocker if the implementation tries to collapse them. The spec forbids conflating thinking and cache usage.
- Alternatives considered:
  - Fold thinking into `outputTokens`. Rejected because it violates FR-003 and FR-007.
  - Ignore thinking until a later ticket. Rejected because it would leave the telemetry defect unresolved.

### 3. Gemini cost-estimation strategy

- Decision: Add Gemini-specific pricing logic alongside the existing OpenAI and Mistral estimators in `app/api/telemetry/v1/logs/route.ts`, with model-family coverage for Gemini 2.5 Pro, 2.5 Flash, and 2.0 Flash and an explicit unavailable-cost path for unknown models.
- Rationale: The route already owns provider-specific estimation for Codex and Mistral. Keeping Gemini pricing there preserves one server-side accounting path and makes backward-compatibility regression testing straightforward.
- Alternatives considered:
  - Compute Gemini pricing in the workflow runner. Rejected because pricing tables belong in app-controlled server logic, not in workflow shell scripts.
  - Default unknown Gemini models to a fallback price. Rejected because FR-011 requires preserving visibility while marking cost unavailable.

### 4. Merge semantics for delayed or repeated Gemini events

- Decision: Preserve the existing additive merge path in `updateJobMetrics()` for true delta telemetry, but add Gemini-aware guards so repeated final-result payloads cannot double-count usage.
- Rationale: The current route assumes OTLP batches are deltas and batch JSON is merged additively. Gemini runner output is currently sent once post-execution, but the spec explicitly requires tolerance for delayed or repeated events.
- Alternatives considered:
  - Treat every Gemini batch as authoritative replacement. Rejected because it would diverge from existing telemetry handling and create race risk if partial events arrive first.
  - Accept double-counting risk. Rejected because it violates FR-012.

### 5. Authoritative analytics agent filter source

- Decision: Derive analytics filter options from centralized supported-agent definitions plus real project job history, instead of hardcoding the agent list inside analytics queries.
- Rationale: `lib/analytics/queries.ts` currently contains a fixed `['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']` loop. That satisfies current agents, but FR-010 requires analytics to read from the authoritative supported-agent source rather than a manually maintained duplicate.
- Alternatives considered:
  - Keep updating the analytics list manually. Rejected because the spec specifically calls this out as the maintenance defect.

## Existing Files

### Telemetry ingestion and normalization domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` | OTLP ingestion for Claude/Codex plus batch ingestion for Mistral/Gemini, merge path, pricing helpers | Extend |
| `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` | Gemini CLI invocation, stream-json capture, batch payload construction | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts` | Terminal-state handling and duration backfill when telemetry is missing | Reuse as pattern reference |
| `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` | `Job` telemetry fields and agent enums | Extend |

### Analytics and agent-filter domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts` | Effective-agent filtering, available-agent option generation, aggregate queries | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts` | Analytics payload typing and agent filter unions | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts` | Shared labels, defaults, and analytics helper functions | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts` | Analytics filter validation and response boundary | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx` | Agent filter UI rendering from server-provided options | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-resolution.ts` | Shared supported-agent definitions and workflow support rules | Reuse as pattern reference |
| `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/agent.ts` | Zod agent schema wrappers | Reuse as pattern reference |

### Existing test files to extend first

| File | Coverage today | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` | Cross-agent telemetry ingestion, accumulation, and backward-compatibility coverage | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts` | Analytics filter handling, effective-agent aggregation, available-agent options | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx` | Analytics filter rendering and empty-state behavior | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts` | Shared agent support rules including Gemini workflow eligibility | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts` | Agent enum/schema coverage | Extend |

## Patterns to Follow

### 1. Telemetry route auth, validation, and structured failure pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:61`, `:72`, `:102`, `:213`
- Error handling pattern:
  - Validate workflow auth first and return `401` immediately on failure.
  - Parse and schema-validate before mutating the database.
  - Return structured `400` responses for invalid JSON or invalid telemetry shape.
  - Log contextual server errors and return a generic `500` only for unexpected failures.
- Security pattern:
  - All telemetry writes stay behind `validateWorkflowAuth()`.
  - Logs include context, not secrets or raw auth headers.
- State-management pattern:
  - Mutation happens only after route-level validation completes.

### 2. Additive telemetry merge and tool dedupe pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:257-330`
- Error handling pattern:
  - Re-read the `Job` before update and return `404` if it no longer exists.
- Security pattern:
  - Only selected telemetry fields are read and updated.
- State-management pattern:
  - Merge token and duration counts additively.
  - Merge `toolsUsed` with set semantics and stable sort order.
  - Update `model` only when the current telemetry batch provides one.
- Implementation implication:
  - Gemini repeat-event handling must either preserve this additive path for deltas or add a duplicate-suppression guard before this merge path runs.

### 3. Cost-estimation ownership pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:338-374`, `:411-424`
- Error handling pattern:
  - Route-side pricing is conditional and provider-aware.
  - `costStatus='UNAVAILABLE'` suppresses estimation instead of forcing a zero price.
- Security pattern:
  - Pricing tables are server-local constants, not client or workflow inputs.
- State-management pattern:
  - Provider-specific estimators are invoked only when usage exists and pricing is considered available.
- Implementation implication:
  - Gemini pricing should follow this same server-side estimator pattern, with separate category-level pricing for thinking and cache usage.

### 4. Runner secret materialization and non-blocking telemetry reporting pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:423-431`, `:434-465`, `:467-507`
- Error handling pattern:
  - Gemini CLI invocation captures exit code separately from telemetry collection.
  - Telemetry POST is non-blocking relative to workflow success/failure.
- Security pattern:
  - OAuth material is restored to `~/.gemini/oauth.json` with `chmod 600`.
  - Auth headers are read from workflow env vars and never printed.
- State-management pattern:
  - Runtime writes the raw stream to `GEMINI_STREAM_FILE`, then performs a single translation step into API payload shape.
- Implementation implication:
  - Native Gemini parsing should be added inside `collect_gemini_telemetry()` rather than by scraping logs later elsewhere.

### 5. Missing-telemetry duration backfill pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts:231-239`
- Error handling pattern:
  - Backfill duration only after terminal-state persistence succeeds.
- Security pattern:
  - No extra external calls are introduced during fallback handling.
- State-management pattern:
  - Use wall-clock duration only when telemetry did not provide duration.
- Implementation implication:
  - Gemini jobs with partial telemetry should keep this fallback for duration while leaving unavailable token categories explicit rather than fabricated.

### 6. Effective-agent filtering and option generation pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts:50-68`, `:189-247`
- Error handling pattern:
  - Analytics filters are normalized at the API boundary before query execution.
- Security pattern:
  - Access control remains in the analytics route via `verifyProjectAccess()`.
- State-management pattern:
  - Effective agent is `ticket.agent ?? project.defaultAgent`.
  - Option counts are derived from job-backed ticket history, not from raw enum membership alone.
- Implementation implication:
  - Replace the hardcoded analytics loop with a shared authoritative supported-agent source.

### 7. Filter UI consumes server-provided options pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx:138-157`
- Error handling pattern:
  - The UI renders from `analytics?.availableAgents ?? initialData.availableAgents`, so the server remains authoritative.
- Security pattern:
  - No agent list is inferred client-side from uncontrolled input.
- State-management pattern:
  - Search params mirror the selected filter state, but the options themselves come from the API response.
- Implementation implication:
  - Once the server option source is fixed, the UI should not need a separate hardcoded Gemini patch.

## Source Notes

- The repo already contains a prior Gemini planning artifact at `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/` describing stream-json telemetry and unavailable-cost semantics. This ticket narrows that earlier broader design to the remaining telemetry/parity defects.
