# Phase 0 Research: AIB-743 Inbox Ticket Analysis

**Date**: 2026-04-27 · **Branch**: `AIB-743-inbox-ticket-analysis`

This document resolves all `NEEDS CLARIFICATION` from the technical context and inventories existing code that must be extended (not duplicated) for AIB-743.

---

## Decisions

### D1. Execution model: workflow dispatch + status PATCH (consistent with HealthScan)

- **Decision**: Run the 2-stage LLM pipeline in a new lightweight GitHub Actions workflow (`inbox-analysis.yml`). The Next.js API route creates a `TicketAnalysis` row in `running` status, dispatches the workflow, and returns immediately. The workflow runs an agent slash command (`ai-board.inbox-analysis`) and PATCHes the row to `success`/`cold_start`/`failed` with telemetry.
- **Rationale**: The platform invokes LLMs exclusively in workflows — no Anthropic SDK is in `package.json` and there is no in-process LLM precedent. HealthScan (`lib/health/scan-dispatch.ts`, `app/api/projects/[projectId]/health/scans/route.ts`, `health-scan.yml`) is a direct one-to-one match: status enum, PATCH endpoint, BYOK credential resolution, workflow token auth, dispatch-then-rollback on error. Reusing this pattern yields zero new architectural surface.
- **Alternatives considered**:
  - *In-process Anthropic SDK call*: rejected. Adds a new SDK dependency, a new credential decryption code path on the request hot path, and a new failure surface (long-running HTTP). Constitution's Component-Driven Architecture and the platform's "all LLM in workflows" invariant override the SLO ambition.
  - *Reuse the existing `Job` model*: rejected. `Job` is keyed to ticket pipeline commands (`specify`, `plan`, `implement`, ...) and drives stage transitions. Conflating analysis with pipeline jobs would couple the panel to job UI (jobs timeline, stage badges) and risks regressing existing flows (FR-026).
- **SLO note**: Spec FR-004 / SC-001 sets a 10 s p95 target. Workflow cold-start adds ≈10–20 s baseline. The new `inbox-analysis.yml` is intentionally minimal (no target-repo checkout, no service containers, no setup-bun) to keep startup near the GH Actions floor (~8–12 s). End-to-end p95 is realistically **15–25 s**. Plan flags this as a known constraint to revisit post-ship rather than redesigning the platform's LLM execution model in this ticket.

### D2. Rate limit storage: derive from `TicketAnalysis` rows, no new table

- **Decision**: Enforce "10 successful analyses per user per rolling hour" by counting `TicketAnalysis` rows where `userId = X AND status IN ('success','cold_start') AND endedAt > now() - interval '1 hour'`. Reject the 11th in the API route with HTTP 429 and a body naming the soonest reset time (oldest qualifying row's `endedAt + 1 hour`).
- **Rationale**: The data already lives on the analysis row (per FR-022 we persist `userId`, `status`, `endedAt`). A separate `AnalysisRateBudget` model would be a duplicate source of truth that drifts. The spec's "AnalysisRateBudget" entity is satisfied by an indexed query, not a physical table. Failed runs naturally don't count — they have status `failed`, excluded by the WHERE clause.
- **Alternatives considered**:
  - *In-memory token bucket à la `lib/tokens/rate-limit.ts`*: rejected. Per-instance only (Vercel multi-instance), loses state on cold start, cannot scope per-user durably.
  - *New `AnalysisRateBudget` model*: rejected. Adds write-on-success + reset cron + drift risk. The query against `TicketAnalysis` is O(1) on `(userId, status, endedAt)` with the right index.
- **Index needed**: `@@index([userId, status, endedAt])` on `TicketAnalysis`.

### D3. Cost estimate (button label) from a static USD reference table

- **Decision**: New module `lib/analysis/cost-table.ts` exports `estimateAnalysisCostUsd(agent: Agent, model: string | null): { lowerUsd: number; upperUsd: number }`. Keys are `(agent.cli, agent.model)` from project config; falls back to the configured default model when `model` is absent. The 2-stage pipeline's expected token cost is encoded as a static range. Returned by `GET /api/projects/:projectId/tickets/:id/analysis/eligibility`.
- **Rationale**: Spec is explicit that the pre-click figure is a coarse estimate, not a measured cost. A static table is easy to audit, cheap to maintain, and doesn't require a live model-pricing API. The post-run measured cost is independently captured on the row from workflow telemetry (`costUsd`).
- **Alternatives considered**: dynamic provider pricing API (out-of-scope, unreliable); subscription-plan-based table (wrong axis — cost depends on model, not tier).

### D4. Stack/operating-context extract: bounded fields from `project.config` JSON

- **Decision**: New helper `lib/analysis/stack-extract.ts` exports `extractStackContext(config: ProjectConfig): StackContext` returning `{ language, framework, services: ServiceSummary[], testingFramework, e2e, e2eFramework, agent: { cli, model } }`. Each `ServiceSummary` is `{ type, version }` (no credentials). The full extract is stored on the analysis row's `stackSnapshot` JSON column for audit and re-prompting.
- **Rationale**: `project.config` is already a parsed object available via `lib/config-loader.ts`. The extract is generic across stacks (CLAUDE.md "Forbidden — no UI libs ... use shadcn/ui ... Forbidden — no ORMs besides Prisma" reasoning is encoded in the *prompt template*, not this extract). Cap is implicit: the extract is small (≤300 tokens); if the services list ever grows, deterministic truncation by service array length is straightforward.
- **Alternatives considered**: passing the entire `config` JSON (rejected — token bloat, exposes `commands` shell strings); passing only `language + framework` (rejected — loses test framework signal needed for QUICK/FULL recommendation justification).
- **Missing-field handling**: Each field is independently optional; `extractStackContext` returns `null`/`[]` for absent fields. The prompt template skips empty fields ("Stack: language=Python; framework=(unspecified)").

### D5. Anchor retrieval algorithm

- **Decision**: New module `lib/analysis/anchor-retrieval.ts` exports `selectAnchors(projectId, predictedDomains, scoringHints)`. Steps:
  1. `prisma.ticketOutcome.findMany({ where: { projectId, partial: false }, include: { ticket: { select: { ticketKey: true } } } })` — index `[projectId, partial]` already exists.
  2. Score each row: `domainOverlap = |predictedDomains ∩ row.domains|`; tie-breaker `tagOverlap = (touchedDbSchema, touchedTests, touchedCi) bitcount` against scoping pass hints; final tie-breaker = `shippedAt DESC`.
  3. Filter to `domainOverlap >= 1`. Sort by `(domainOverlap DESC, tagOverlap DESC, shippedAt DESC)`. Take top 5.
  4. If qualifying count < 3 → return `{ anchors: [], coldStart: true, reason: 'insufficient_comparable_history' }`.
  5. Project each anchor to `{ ticketId, ticketKey, frictionFree, qualityScore, overlapStrength }` for both prompt input and panel display.
- **Rationale**: Re-uses `TicketOutcome` schema as-is (FR-012 confirms structural-domain + semantic-tag overlap). No free-form text similarity (FR-013). Indexed query is fast even with thousands of historical outcomes.
- **Reused**: `prisma.ticketOutcome` (table from AIB-742), no new fields needed on `TicketOutcome`.

### D6. Stale-detection (description-changed banner)

- **Decision**: New helper `lib/analysis/stale-check.ts` exports `isStale(ticket: { title, description }, snapshot: { titleSnapshot, descriptionSnapshot }): boolean`. Compares `normalize(title + '\n' + description)` against `normalize(titleSnapshot + '\n' + descriptionSnapshot)` where `normalize(s) = s.replace(/\s+/g, ' ').trim()`. Returns `true` iff strings differ. Comments are not considered.
- **Rationale**: Whitespace tolerance per AUTO-CONSERVATIVE decision (block 8 in spec). Title + description match the analysis input verbatim. Centralised so the panel renderer and the API both use one comparison.
- **Where called**: panel render path (in `useAnalysis` hook → render `<DescriptionChangedBanner />`); the re-analyze POST handler does NOT enforce staleness (user may re-run on identical text — rate limit governs spend).

### D7. Recommendation, friction-risk, and quality-gate range come from the grounded LLM pass — no rule engine

- **Decision**: The grounded estimation pass (LLM stage 2) produces a JSON envelope conforming to `AnalysisOutputSchema` (Zod). Schema validates ranges (lower ≤ upper, scope warnings ≤ 5, anchor IDs ⊆ those passed in). Validation failure → mark row `failed` with reason `invalid_model_output`. No deterministic rule engine derives the recommendation.
- **Rationale**: Spec FR-017 demands "expected" ranges with a justification; rules over 5 anchors would be a brittle re-implementation of what the model already does well. Validation enforces the auditable invariants without dictating internal heuristics.
- **Schema location**: `lib/analysis/output-schema.ts` — used by both the workflow status PATCH (server-side validation) and the panel renderer (typed component props).

### D8. Rule-set version

- **Decision**: New constant `ANALYSIS_RULE_SET_VERSION = 1` in `lib/analysis/types.ts`. Stamped on every persisted row. Bumping it is a deliberate code change tied to prompt-template changes that materially shift recommendation outputs.
- **Rationale**: Mirrors `RULE_SET_VERSION` in `lib/outcomes/types.ts`. Future calibration work (Why Now in spec) needs to filter rows by the rule set that produced them.

### D9. Concurrency: allow concurrent runs

- **Decision**: No DB-level guard against two concurrent `running` rows for the same ticket. Each row is independent; the panel always reads the latest row (`orderBy: { createdAt: 'desc' }, take: 1`). Both rows count against the user's budget on success.
- **Rationale**: Spec edge case explicitly allows this. A guard would force serialisation across tabs — annoying and unnecessary given the tiny per-run cost.

### D10. Test layout

- **Decision**: Follow `tests/integration/health/` and `tests/integration/outcomes/` layout. New folder `tests/integration/analysis/` with one file per concern: `trigger-analysis.test.ts`, `analysis-status.test.ts`, `cold-start.test.ts`, `rate-limit.test.ts`, `stale-banner.test.ts`, `anchor-filtering.test.ts`. Unit tests in `tests/unit/analysis/` for `anchor-retrieval`, `stale-check`, `stack-extract`, `cost-table`, `output-schema`.
- **Rationale**: Constitution III: "Search existing tests FIRST — extend, don't duplicate." No existing file covers analysis; unrelated concerns would be mixed if appended to an existing health/outcome file. New folder is justified by domain isolation.

---

## Existing Files (audit — extend, don't duplicate)

### Source — to read & extend

| Path | Role | Action |
|---|---|---|
| `prisma/schema.prisma` | Schema source of truth (Ticket, Project, User, TicketOutcome, HealthScan, UserCredential, Stage enum) | **Add**: `TicketAnalysis` model + `TicketAnalysisStatus` enum + `Ticket.analyses` relation + `User.ticketAnalyses` relation. |
| `lib/db/auth-helpers.ts` | `verifyTicketAccess`, `verifyProjectAccess` | **Reuse as-is** (FR-020). |
| `lib/db/client.ts` | Prisma client singleton | **Reuse as-is**. |
| `lib/outcomes/types.ts` | `RULE_SET_VERSION`, `QUALITY_THRESHOLD_FRICTION_FREE` | **Read** for parallel naming; new `lib/analysis/types.ts` mirrors structure. |
| `lib/outcomes/serialize.ts` | `serializeOutcome(row, opts)` | **Pattern reference** for serialiser; new `lib/analysis/serialize.ts`. |
| `lib/health/scan-dispatch.ts` | Dispatch HealthScan workflow with credential resolution | **Pattern reference** for `lib/analysis/dispatch-analysis.ts` (D1). |
| `app/api/projects/[projectId]/health/scans/route.ts` | POST trigger + PENDING row + dispatch-then-rollback | **Pattern reference** for `app/api/projects/[projectId]/tickets/[id]/analysis/route.ts`. |
| `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` | Workflow PATCH endpoint with state-transition validation | **Pattern reference** for `app/api/projects/[projectId]/tickets/[id]/analysis/[analysisId]/status/route.ts`. |
| `app/api/jobs/[id]/status/route.ts` | Workflow token auth + state machine | **Pattern reference** (idempotency, transitions). |
| `app/lib/auth/workflow-auth.ts` | `validateWorkflowAuth(request)` | **Reuse as-is**. |
| `lib/ai-credentials/workflow.ts` | `getOwnerCredential(projectId, provider)`, `getMissingCredentialError` | **Reuse as-is**. Workflow YAML resolves owner credential the same way HealthScan does. |
| `lib/config-loader.ts` + `lib/validations/config.ts` | Project config parsing & Zod schema | **Read** for `extractStackContext` input typing. |
| `lib/config-sync.ts` | `ensureFreshConfig(project)` | **Reuse as-is** before dispatch (D1). |
| `lib/workflows/service-inputs.ts` | `getProjectServiceInputs(project)` for workflow inputs | Not needed — analysis workflow does not provision service containers. |
| `lib/outcomes/persist.ts` | TicketOutcome insert + Zod invariants | **Pattern reference** for `lib/analysis/persist.ts` invariants. |
| `lib/outcomes/stack-indicator-lookup.ts` | `deriveSemanticTags(files, config)` | Not used in analysis (no diff to inspect); kept as reference for the prompt template's tag vocabulary. |
| `lib/billing/usage.ts` (verify presence) or `lib/billing/plans.ts` | Subscription / usage hooks | **Read only** — no usage-banner integration in v1 per scope. |
| `components/board/ticket-detail-modal.tsx` | Main ticket detail UI | **Modify**: insert `<InboxAnalysisPanel />` inside `TabsContent value="details"` gated on `localTicket.stage === 'INBOX'` (and also for non-INBOX read-only display per FR-002). |
| `components/ticket/quality-score-section.tsx` | Collapsible card + Aurora B+ styling | **Pattern reference** for `components/ticket/inbox-analysis-panel.tsx`. |
| `components/board/retro-spec-banner.tsx` | Dismissible banner with `role="alert" aria-live="polite"` | **Pattern reference** for `components/ticket/description-changed-banner.tsx`. |
| `app/lib/hooks/queries/useTicketJobs.ts` | TanStack Query hook with conditional polling | **Pattern reference** for `app/lib/hooks/queries/useTicketAnalysis.ts`. |
| `app/lib/hooks/useJobPolling.ts` | Polling cadence pattern (2 s active, 30 s idle) | **Pattern reference** for analysis polling (2 s while `running`, off when terminal). |
| `lib/utils/field-edit-permissions.ts` | `canEditDescriptionAndPolicy(stage)` | **Pattern reference** for `isAnalysisTriggerable(stage)` helper (returns `stage === 'INBOX'`). |
| `.github/workflows/health-scan.yml` | Lightweight LLM-only scan workflow (non-TESTS path) | **Pattern reference** for the new `.github/workflows/inbox-analysis.yml`. |
| `.claude-plugin/commands/` (registry of slash commands) | Existing agent commands | **Add**: `ai-board.inbox-analysis` skill + command file. |

### Source — new files (verified no existing equivalent)

| New path | Reason no existing covers |
|---|---|
| `lib/analysis/types.ts` | No existing analysis-domain types module. |
| `lib/analysis/cost-table.ts` | No existing static USD pricing table; `lib/billing/plans.ts` is subscription tiers, different axis. |
| `lib/analysis/stack-extract.ts` | `lib/config-loader.ts` parses but does not project to a prompt-bounded subset. |
| `lib/analysis/anchor-retrieval.ts` | `lib/analytics/queries.ts` queries outcomes but only for analytics aggregations, not domain-overlap scoring. |
| `lib/analysis/stale-check.ts` | No existing whitespace-tolerant ticket-snapshot diff. |
| `lib/analysis/output-schema.ts` | No existing Zod schema for the analysis output envelope. |
| `lib/analysis/persist.ts` | Mirrors `lib/outcomes/persist.ts` but for `TicketAnalysis`. |
| `lib/analysis/serialize.ts` | Mirrors `lib/outcomes/serialize.ts`. |
| `lib/analysis/dispatch-analysis.ts` | Mirrors `lib/health/scan-dispatch.ts` for the new workflow. |
| `app/api/projects/[projectId]/tickets/[id]/analysis/route.ts` | New POST trigger + GET latest. |
| `app/api/projects/[projectId]/tickets/[id]/analysis/[analysisId]/status/route.ts` | New workflow PATCH endpoint. |
| `app/api/projects/[projectId]/tickets/[id]/analysis/eligibility/route.ts` | New GET for pre-click button label (cost range + rate-limit remaining). |
| `app/lib/hooks/queries/useTicketAnalysis.ts` | New TanStack hook with conditional polling. |
| `components/ticket/inbox-analysis-panel.tsx` | New panel component. |
| `components/ticket/inbox-analysis-button.tsx` | New trigger button with USD label. |
| `components/ticket/description-changed-banner.tsx` | New banner. |
| `components/ticket/anchor-citation-list.tsx` | New anchor list rendering. |
| `.github/workflows/inbox-analysis.yml` | New minimal workflow (no checkout-target, no service containers). |
| `.claude-plugin/commands/inbox-analysis.md` | New slash command spec. |
| `.claude-plugin/skills/inbox-analysis/SKILL.md` | New skill (2-stage pipeline orchestration). |
| `prisma/migrations/<timestamp>_add_ticket_analysis/migration.sql` | Generated migration. |

### Tests — to extend

| Path | Coverage today | Plan for AIB-743 |
|---|---|---|
| `tests/unit/components/ticket-detail-modal.test.tsx` | Modal rendering, tabs, INBOX gating | **Extend**: `<InboxAnalysisPanel />` shows for INBOX, hides for SPECIFY+; persisted analysis remains readable post-INBOX. |
| `tests/integration/outcomes/api-outcomes.test.ts` | TicketOutcome listing / filters | **Reuse pattern only**. New file `tests/integration/analysis/anchor-filtering.test.ts` covers anchor selection over outcomes — different concern (overlap scoring + access filtering). |
| `tests/integration/jobs/status.test.ts` (per agent report) | Workflow PATCH auth + idempotency | **Reuse pattern only**. New `tests/integration/analysis/analysis-status.test.ts`. |
| `tests/unit/auth-helpers.test.ts` | `verifyTicketAccess` etc. | **Reuse as-is** — no new auth path. |

### Tests — new files

| New path | Concern |
|---|---|
| `tests/unit/analysis/cost-table.test.ts` | Lookup by `(cli, model)`; default model fallback; unknown model surfaces a sensible default range. |
| `tests/unit/analysis/stack-extract.test.ts` | Extract shape; missing fields gracefully omitted; no `commands` leakage. |
| `tests/unit/analysis/anchor-retrieval.test.ts` | Domain overlap scoring; tag tie-breaker; recency tie-breaker; cold-start when <3. |
| `tests/unit/analysis/stale-check.test.ts` | Whitespace tolerance; revert clears; comments excluded (input doesn't include comments). |
| `tests/unit/analysis/output-schema.test.ts` | Zod validation rejects lower>upper, >5 warnings, unknown anchor IDs. |
| `tests/unit/components/inbox-analysis-panel.test.tsx` | Renders cold-start; renders full panel; renders running placeholder; renders failed state with retry. |
| `tests/unit/components/description-changed-banner.test.tsx` | Visible on stale; suppressed during run; ARIA live region announced. |
| `tests/unit/components/anchor-citation-list.test.tsx` | Anchor link target; "no score" label for null qualityScore; degraded entry for missing ticket. |
| `tests/integration/analysis/trigger-analysis.test.ts` | POST creates `running` row + dispatches workflow (mocked); INBOX gating; access control. |
| `tests/integration/analysis/analysis-status.test.ts` | PATCH state transitions + idempotency + workflow token auth. |
| `tests/integration/analysis/cold-start.test.ts` | <3 anchors → cold-start row; numeric ranges absent; scope warnings present. |
| `tests/integration/analysis/rate-limit.test.ts` | 10 successes within hour → 11th rejected with reset time; failed runs don't consume budget. |
| `tests/integration/analysis/stale-banner.test.ts` | Edits trigger banner; revert clears; comments don't trigger. |
| `tests/integration/analysis/anchor-filtering.test.ts` | User without access to anchor ticket sees no leaked metadata. |
| `tests/integration/analysis/append-only.test.ts` | Re-analyze creates a new row; previous row preserved unchanged. |
| `tests/e2e/inbox-analysis.spec.ts` | Single happy-path E2E (Story 1) — keyboard navigation, screen-reader labels, link click navigates to anchor. |

---

## Patterns to Follow (extracted from reference implementations)

The following patterns MUST be applied in AIB-743 implementations. References include file paths and the line ranges read.

### P1. Dispatch-then-rollback on failure (from `app/api/projects/[projectId]/health/scans/route.ts:85-115`)

When the API route creates a DB row and then dispatches an external workflow:
1. Create the `TicketAnalysis` row in `running` status (DB write committed before dispatch).
2. Wrap the workflow dispatch in try/catch.
3. On dispatch failure → `prisma.ticketAnalysis.update({ where: { id }, data: { status: 'failed', errorReason: 'dispatch_failed', errorMessage: ... }})` BEFORE re-throwing to the caller.
4. The HTTP response surfaces 5xx; the row is consistent (no orphaned `running` rows). Constitution V (Database Integrity, "if external call fails after a DB mutation, the DB state must remain consistent") is satisfied.

### P2. Workflow token auth + state-transition validation (from `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts:62-80`)

The PATCH `/status` endpoint MUST:
1. Call `validateWorkflowAuth(request)` first; on failure return `401 Unauthorized` (no info leak).
2. Validate the scanId/analysisId param shape.
3. Look up the row; if status is terminal (`success`, `cold_start`, `failed`), return 200 idempotently (no-op) — match HealthScan PATCH idempotency.
4. Use a `VALID_TRANSITIONS` map identical in shape to `health/scans/[scanId]/status/route.ts:24-30`:
   ```
   running → success | cold_start | failed
   success | cold_start | failed → []  (terminal)
   ```
5. Validate the body with Zod; on `success`/`cold_start` it MUST contain a full `AnalysisOutputSchema` payload + telemetry; on `failed` it MUST contain `errorReason` + optional `errorMessage`.

### P3. Credential resolution in workflow YAML (from `health-scan.yml:213-253`)

The new `inbox-analysis.yml` MUST resolve the owner's stored AI credential identically to HealthScan:
1. Curl `GET /api/internal/credentials?projectId=…&provider=ANTHROPIC` with `Authorization: Bearer ${WORKFLOW_API_TOKEN}`.
2. `::add-mask::` the credential value to prevent log leakage.
3. Export to `GITHUB_ENV` via heredoc-bounded variable so multi-line credentials (auth.json) are preserved.
4. Fall back to repository secrets if the BYOK fetch returns non-200.

This is **non-negotiable security parity** with HealthScan (constitution IV: "All secrets in environment variables, never committed to git"; FR-020 access control parity).

### P4. Append-only persistence (from `lib/outcomes/persist.ts`, AIB-742 doctrine)

`TicketAnalysis` rows MUST never be `UPDATE`d after reaching a terminal status. The PATCH `/status` is the **only** allowed write that transitions status, and it asserts `status = 'running'` in the WHERE clause to avoid races (UPDATE … WHERE id = ? AND status = 'running'; check `count = 1`). The append-only test (`tests/integration/analysis/append-only.test.ts`) sets up a row, transitions it, attempts to re-PATCH, and verifies the row is unchanged.

### P5. TanStack Query polling pattern (from `app/lib/hooks/useJobPolling.ts:17-140` + `useTicketJobs.ts:21-52`)

`useTicketAnalysis(projectId, ticketId)`:
1. `queryKey: ['analysis', projectId, ticketId]`.
2. Fetches `GET /api/projects/:projectId/tickets/:id/analysis` (latest row + eligibility metadata).
3. `refetchInterval: data?.latest?.status === 'running' ? 2000 : false`.
4. `staleTime: 5_000`, `gcTime: 600_000`.
5. After a `running → terminal` transition, `queryClient.invalidateQueries(['analysis', ...])` once and stop polling.
6. Conditional `enabled` only when ticket is loaded.

### P6. INBOX gating without breaking read-after-stage-transition (constitution: Component-Driven Architecture)

The button is gated on `ticket.stage === 'INBOX'`, but the panel itself renders whenever `latestAnalysis !== null` (read-only after stage transition per FR-002). The component takes a `triggerable: boolean` prop derived from `lib/utils/field-edit-permissions.ts`-style helper `isAnalysisTriggerable(stage)`.

### P7. Aurora B+ styling for the panel and banner (from CLAUDE.md + `quality-score-section.tsx:67-156`)

Use `aurora-bg-card-blue`, `aurora-border-glow` etc. utility classes from `globals.css` for the panel surface. **Never** hardcode hex/rgb. Friction-risk colour cues use Tailwind palette classes (`text-amber-500`, `text-red-500`) per CLAUDE.md exception for fixed-contrast badges. Each colour MUST be paired with a text label for accessibility (FR-025, constitution IV: "WCAG AA").

### P8. Static class strings only (from CLAUDE.md "Tailwind Classes")

Helpers like `riskBadgeClasses(risk: 'low'|'medium'|'high')` MUST `return` complete literal class strings via a `switch`/object lookup — never construct via template literals or `.replace()`. Tailwind's purger discards constructed strings.

### P9. Zod constraints match Prisma column constraints (constitution IV)

`AnalysisInputSnapshotSchema` MUST mirror Prisma column constraints: `titleSnapshot z.string().max(100)` (matches `Ticket.title @db.VarChar(100)`), `descriptionSnapshot z.string().max(10_000)`. The snapshot is captured at trigger time from the live ticket — never trust client-supplied values.

### P10. Test-file colocation for new domain (constitution III: "Search existing tests FIRST")

`tests/integration/analysis/` is a new folder because no existing folder covers analysis (verified). Co-locating analysis tests with `tests/integration/health/` would mix unrelated state machines. The folder boundary is justified.

---

## Resolved Technical Context

| Field | Value |
|---|---|
| Language/Version | TypeScript 5.9 strict, Node.js 22.20.0 |
| Primary Dependencies | Next.js 16 (App Router), React 18, Prisma 6.19.x, NextAuth.js, TanStack Query 5.95.2, Zod 4.3.6, shadcn/ui + Radix, Tailwind 3.4 |
| Storage | PostgreSQL 14+ via Prisma; new `TicketAnalysis` table (append-only) |
| Testing | Vitest (unit + integration), Playwright (single E2E for accessibility happy-path) |
| Target Platform | Linux Vercel serverless + GitHub Actions runners |
| Project Type | Web (Next.js full-stack monorepo) |
| Performance Goals | Trigger API < 500 ms; panel render after persisted row < 200 ms; analysis end-to-end p95 ≈ 15–25 s (workflow-dispatched, see D1 SLO note) |
| Constraints | Append-only writes; FR-020 access parity; FR-026 no regression on existing flows; CLAUDE.md commit rules (no `--no-verify`) |
| Scale/Scope | ≤ 10 successful runs / user / hour; bounded by rate limit; expected steady state < 1 k rows / project / month |
