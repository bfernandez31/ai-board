# Enums

## Enums

### CredentialProvider

AI provider identifier for BYOK credentials.

```prisma
enum CredentialProvider {
  ANTHROPIC
  OPENAI
  MISTRAL
  GOOGLE
}
```

Extensible enumeration — new providers can be added without structural schema changes.

### CredentialType

```prisma
enum CredentialType {
  API_KEY      // Provider API key (e.g., sk-ant-api03-... for Anthropic, sk-... for OpenAI)
  OAUTH_TOKEN  // OAuth bearer token (e.g., Claude Code OAuth, Codex license token)
}
```

**Env var mapping** (by provider + type):
- `ANTHROPIC:API_KEY` → `ANTHROPIC_API_KEY`
- `ANTHROPIC:OAUTH_TOKEN` → `CLAUDE_CODE_OAUTH_TOKEN`
- `OPENAI:API_KEY` → `OPENAI_API_KEY`
- `OPENAI:OAUTH_TOKEN` → `OPENAI_API_KEY`
- `MISTRAL:API_KEY` → `MISTRAL_API_KEY`
- `GOOGLE:API_KEY` → `GOOGLE_API_KEY`
- `GOOGLE:OAUTH_TOKEN` → `GEMINI_OAUTH_JSON`

**Provider constraints**:
- `ANTHROPIC`: supports `API_KEY` and `OAUTH_TOKEN`
- `OPENAI`: supports `API_KEY` and `OAUTH_TOKEN`
- `MISTRAL`: supports `API_KEY` only
- `GOOGLE`: supports `API_KEY` and `OAUTH_TOKEN`

### CredentialReadiness

Verification state of a stored credential.

```prisma
enum CredentialReadiness {
  PENDING_VERIFICATION  // Created or replaced, not yet verified
  READY                 // Last verification succeeded
  ACTION_REQUIRED       // Last verification failed — user must act
}
```

| Value | Description | Transition To |
|-------|-------------|---------------|
| `PENDING_VERIFICATION` | Credential just stored, unverified | `READY`, `ACTION_REQUIRED` |
| `READY` | Provider confirmed the credential is valid | `ACTION_REQUIRED` (if re-test fails) |
| `ACTION_REQUIRED` | Provider rejected or could not verify | `PENDING_VERIFICATION` (on replace) |

### CaptureStatus

State of the log artifact captured for a terminated job.

```prisma
enum CaptureStatus {
  CAPTURED     // Transcript artifact uploaded and referenced by artifactKey
  UNAVAILABLE  // Capture, redaction, or upload failed after bounded retry
  PRUNED       // Retention pruning removed the artifact; preview retained until row pruned next cycle
}
```

| Value | Description | Writable? |
|-------|-------------|-----------|
| `CAPTURED` | Artifact stored in Vercel Blob, `rawUrl` populated on read | Yes, via `POST /api/jobs/:id/logs` |
| `UNAVAILABLE` | Runner could not complete capture after bounded retry (3 attempts, 1/2/4s) | Yes |
| `PRUNED` | Server-side only — set by retention pruner to mark an artifact-less row for deletion in the next cycle | Server-only |

### HealthScanType

```prisma
enum HealthScanType {
  SECURITY
  COMPLIANCE
  TESTS
  SPEC_SYNC
  REVIEW_QUALITY
}
```

Only the 5 active types above are stored as `HealthScan` records. Quality Gate is a passive module derived from existing `Job` records.

### HealthScanStatus

```prisma
enum HealthScanStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
}
```

| Value | Description | Transitions To |
|-------|-------------|----------------|
| PENDING | Scan created, workflow dispatched | RUNNING, FAILED |
| RUNNING | Workflow executing scan | COMPLETED, FAILED, SKIPPED |
| COMPLETED | Scan finished with results | Terminal |
| FAILED | Scan encountered an error | Terminal |
| SKIPPED | Agent detected nothing to evaluate; null score | Terminal |

---

### SetupJobDepth

Enum constraining the depth level for retro-spec generation jobs.

```prisma
enum SetupJobDepth {
  QUICK
  STANDARD
  COMPREHENSIVE
}
```

| Value | Description |
|-------|-------------|
| `QUICK` | Project overview and high-level architecture |
| `STANDARD` | Architecture, APIs, data model, and workflows |
| `COMPREHENSIVE` | Full functional and technical specifications |

---

### SetupJobCommand

Discriminator enum that identifies the type of setup job.

```prisma
enum SetupJobCommand {
  ONBOARD     // Initial project onboarding — creates config.yml and CLAUDE.md
  RETRO_SPEC  // Spec generation for existing codebases — creates specs/specifications/
}
```

| Value | Description | Requires |
|-------|-------------|----------|
| `ONBOARD` | Runs the onboarding workflow to bootstrap a new project | `configSyncedAt` must be null |
| `RETRO_SPEC` | Runs the retro-spec workflow to generate specifications for an existing codebase | `configSyncedAt` must be set |

---

### SetupJobStatus

Lifecycle states for a `ProjectSetupJob`.

```prisma
enum SetupJobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}
```

| Value | Description | Terminal? | Transitions To |
|-------|-------------|-----------|----------------|
| PENDING | Job created, workflow dispatch initiated | No | RUNNING |
| RUNNING | Workflow reported start | No | COMPLETED, FAILED |
| COMPLETED | Workflow reported success; config sync triggered | Yes | COMPLETED (idempotent) |
| FAILED | Workflow reported failure; error persisted | Yes | FAILED (idempotent) |

`CANCELLED` is omitted — setup jobs have no cancellation UX; a stalled job can be resolved by retrying (creating a new job).

---

## Core Enums

### Stage

Workflow stages for tickets.

```prisma
enum Stage {
  INBOX   // Initial stage for new tickets
  SPECIFY // Specification generation
  PLAN    // Planning and task breakdown
  BUILD   // Implementation
  VERIFY  // Review and testing
  SHIP    // Completed and deployed
  CLOSED  // Closed without shipping (terminal)
}
```

**Transitions**:
- Sequential progression only (one stage forward)
- Rollback paths (FULL workflow): SPECIFY → INBOX, PLAN → SPECIFY, BUILD → PLAN, VERIFY → BUILD, VERIFY → PLAN
- Rollback paths (QUICK workflow): BUILD → INBOX (quick-impl failed/cancelled)
- Alternative resolution: VERIFY → CLOSED (close without shipping)
- No skipping stages
- Initial: INBOX
- Terminal: SHIP, CLOSED

### JobStatus

Workflow execution states.

```prisma
enum JobStatus {
  PENDING   // Created, not yet started
  RUNNING   // Currently executing
  COMPLETED // Finished successfully
  FAILED    // Encountered error
  CANCELLED // Manually terminated
}
```

**State Machine**:
- PENDING → RUNNING
- RUNNING → COMPLETED | FAILED | CANCELLED
- Terminal states: COMPLETED, FAILED, CANCELLED

### TokenSavingOutcome

Per-job record of whether RTK output compression was active during a run.

```prisma
enum TokenSavingOutcome {
  ACTIVE     // Effective value ON for a Claude run; RTK installed + PreToolUse hook activated successfully
  INACTIVE   // Effective value OFF, or agent non-Claude (no install attempted)
  FELL_BACK  // Effective value ON but install/activation failed; run continued without RTK
}
```

| Value | Description |
|-------|-------------|
| `ACTIVE` | Token saving on and working — command outputs are being compressed before entering context |
| `INACTIVE` | Token saving off, or the run used a non-Claude agent that ignores the setting |
| `FELL_BACK` | Token saving was requested but the tool could not install or activate; the run proceeded uncompressed |

**Usage**:
- Stored on `Job.tokenSavingOutcome` (nullable; `null` for legacy/PENDING jobs that never reported)
- Reported by the runner on the RUNNING status PATCH, first-write-wins; never changes afterward
- Surfaced in job details so two runs can be compared without guessing whether the setting applied; `FELL_BACK` is rendered visually distinct from `INACTIVE`

### WorkflowType

Workflow path tracking.

```prisma
enum WorkflowType {
  FULL  // Standard workflow (INBOX → SPECIFY → PLAN → BUILD)
  QUICK // Quick-implementation (INBOX → BUILD)
  CLEAN // Historical only — creation path removed; retained for existing tickets
}
```

**Usage**:
- Set during first BUILD transition
- Immutable after initial setting
- Determines visual badge (⚡ Quick)
- CLEAN is retained in the enum for historical tickets but can no longer be created

### AuthProvider

Authentication provider used for account linking.

```prisma
enum AuthProvider {
  GITHUB
  GOOGLE
  GITLAB
  BITBUCKET
}
```

### ClarificationPolicy

Spec generation decision-making strategy.

```prisma
enum ClarificationPolicy {
  AUTO          // Context-aware (system default)
  CONSERVATIVE  // Security & quality first
  PRAGMATIC     // Speed & simplicity first
  INTERACTIVE   // Manual clarification (future)
}
```

**Hierarchy**:
- Ticket policy overrides project policy
- Project policy overrides system default (AUTO)
- Null ticket policy means inherit from project

### Agent

AI agent that executes workflow automation for a ticket or project.

```prisma
enum Agent {
  CLAUDE   // Anthropic Claude (default)
  CODEX    // OpenAI Codex
  MISTRAL  // Mistral vibe CLI
  GEMINI   // Google Gemini CLI
}
```

**Agent-to-provider mapping**: `CLAUDE` → `ANTHROPIC`, `CODEX` → `OPENAI`, `MISTRAL` → `MISTRAL`, `GEMINI` → `GOOGLE`

**Hierarchy**:
- Ticket `agent` overrides project `defaultAgent`
- Null ticket `agent` means inherit from project `defaultAgent`
- New projects default to `CLAUDE`

**Resolution**:
```typescript
// app/lib/utils/agent-resolution.ts
import type { Agent } from '@prisma/client';

export function resolveEffectiveAgent(
  ticketAgent: Agent | null,
  projectDefaultAgent: Agent
): Agent {
  return ticketAgent ?? projectDefaultAgent;
}
```

### SubscriptionPlan

```prisma
enum SubscriptionPlan {
  FREE  // No payment required; limited to 1 project, 5 tickets/month
  PRO   // $15/month; unlimited projects and tickets
  TEAM  // $30/month; Pro features + members + advanced analytics
}
```

### SubscriptionStatus

```prisma
enum SubscriptionStatus {
  ACTIVE     // Paid and current
  TRIALING   // Within free trial period
  PAST_DUE   // Payment failed; grace period active
  CANCELED   // Subscription ended
  INCOMPLETE // Initial payment incomplete
}
```

### InsightsRunStatus

Lifecycle states for an `InsightsReport` row (Claude Code `/insights` analysis run).

```prisma
enum InsightsRunStatus {
  RUNNING
  COMPLETED
  FAILED
}
```

| Value | Description | Terminal? | Transitions To |
|-------|-------------|-----------|----------------|
| `RUNNING` | Row inserted by trigger; workflow dispatched; awaiting terminal callback or orphan reconciliation | No | `COMPLETED`, `FAILED` |
| `COMPLETED` | Workflow PATCHed success AND server-side output validation passed | Yes | — |
| `FAILED` | Workflow PATCHed failure, server-side output validation rejected the artifact, dispatch failed (rollback), or orphan reconciliation timed the row out | Yes | — |

Terminal rows are immutable. All transitions use the atomic guard `WHERE id = ? AND status = 'RUNNING'`; late callbacks against an already-terminal row are no-ops. A FAILED run does not advance the previous-successful-run high-water mark used by period semantics.

### WebhookOutcomeStatus

Outcome of one inbound provider-webhook delivery, recorded by the webhook handler after the idempotency claim succeeds. Drives the Admin Home dashboard's webhook-error alert.

```prisma
enum WebhookOutcomeStatus {
  SUCCESS
  FAILURE
}
```

Stripe re-deliveries of a failed event arrive with the same `event.id`; each delivery produces one additional `FAILURE` row, so the alert's "1+ failure in last 24 h" rule already covers the "retries exhausted" case without a third status value.

### CriticalCron

Allowlist of scheduled workflows whose freshness is monitored by the Admin Home dashboard. Each value maps to one `CronRun` row (keyed on `cron`); the dashboard alerts when `lastSuccessAt < now()-36h` or no row exists.

```prisma
enum CriticalCron {
  NIGHTLY_LOG_PRUNE
  NIGHTLY_HEALTH_SCANS
  BILLING_RECONCILE
}
```

The TypeScript-side registry in `lib/admin/cron/registry.ts` mirrors this enum with `{ key, label, thresholdHours }` so the UI can render human-readable names without depending on the raw enum string.

### NotificationType

Discriminator on `Notification` rows. Determines which sibling fields are populated and how the client renders the row.

```prisma
enum NotificationType {
  MENTION
  TICKET_DELETED
  TICKET_MERGED
}
```

| Value | Trigger | Required fields | Optional fields |
|-------|---------|-----------------|-----------------|
| `MENTION` | `@user` syntax in a comment | `commentId`, `ticketId` | — |
| `TICKET_DELETED` | Bulk delete of an INBOX ticket the actor did not create | `ticketKeySnapshot` (durable identifier) | `ticketId` (cleared to NULL after source-ticket delete) |
| `TICKET_MERGED` | Bulk merge source-ticket absorption (actor ≠ source creator) | `ticketKeySnapshot`, `mergedIntoTicketId` (surviving base) | `ticketId` (cleared to NULL after source-ticket delete) |

`MENTION` is the schema default so existing notification rows are unaffected by the introduction of new types.

### TicketAnalysisStatus

Lifecycle of an inbox ticket analysis run.

```prisma
enum TicketAnalysisStatus {
  running
  success
  cold_start
  failed
}
```

| Value | Description | Terminal? | Transitions To |
|-------|-------------|-----------|----------------|
| `running` | Row inserted by POST trigger; workflow dispatched | No | `success`, `cold_start`, `failed` |
| `success` | Grounded estimation produced a valid panel payload; telemetry recorded | Yes | — |
| `cold_start` | Fewer than 3 comparable past outcomes available; panel renders qualitative-only view with scope warnings; telemetry recorded | Yes | — |
| `failed` | Scoping or grounded LLM call failed, dispatch failed, credential missing, model output invalid, or workflow timed out; telemetry NULL (the rate-limit query relies on this signal so failures do not consume budget) | Yes | — |

Terminal rows are immutable. The single allowed transition is enforced by the PATCH handler with `WHERE id = ? AND status = 'running'`; PATCH on a row already terminal is idempotent (200, no DB write).

