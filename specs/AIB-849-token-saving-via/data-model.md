# Data Model: Token saving via RTK + unified per-ticket Run settings

**Feature**: AIB-849 | **Date**: 2026-06-03 | **Source of truth**: `prisma/schema.prisma`

## Schema Changes

### Enum: `TokenSavingOutcome` (new)
```prisma
enum TokenSavingOutcome {
  ACTIVE      // Effective value ON, RTK installed + hook activated successfully
  INACTIVE    // Effective value OFF, or agent non-Claude (no install attempted)
  FELL_BACK   // Effective value ON but install/activation failed; run continued without RTK
}
```
Placed alongside existing enums (near `JobStatus`, schema L359-395).

### `Project` (modify) — L29-… (project block, near L123-124)
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `tokenSaving` | `Boolean` | `false` | Project-level default, owner-editable (US1, FR-001). Non-nullable, mirrors `clarificationPolicy`/`defaultAgent` being non-nullable defaults. |

### `Ticket` (modify) — near L196-197
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `tokenSaving` | `Boolean?` | `null` | Per-ticket override (FR-002). `null` = Inherit, `true` = Force ON, `false` = Force OFF. Mirrors nullable `clarificationPolicy`/`agent` overrides. |

### `Job` (modify) — L29-83 block
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `tokenSavingOutcome` | `TokenSavingOutcome?` | `null` | Per-job record (FR-008, SC-004). `null` = not yet reported (e.g. legacy/PENDING jobs); resolves to ACTIVE/INACTIVE/FELL_BACK once the runner reports. |

> **Migration**: `bunx prisma migrate dev` to add the enum + three columns, then `bunx prisma generate`. All additions are nullable or defaulted — no backfill required (constitution V: no optional fields without default/null handling — satisfied).

## Effective Value (computed, not stored)

```ts
// lib/workflows/transition.ts
export function resolveEffectiveTokenSaving(ticket: TicketWithProject): boolean {
  return ticket.tokenSaving ?? ticket.project.tokenSaving;
}
```
`??` falls through only on `null` — `false` (Force OFF) wins over a `true` project default (FR-003). Used at dispatch time to set the `tokenSaving` workflow input for Claude standard/quick/verify stages.

## Validation Rules

| Field | Rule | Where |
|-------|------|-------|
| `Project.tokenSaving` | boolean; only project **owner** may change (`verifyProjectOwnership`) | `projectUpdateSchema` (`app/lib/schemas/clarification-policy.ts`); `app/api/projects/[projectId]/route.ts` |
| `Ticket.tokenSaving` | boolean \| null; editable **only when no RUNNING/PENDING job exists** on the ticket; NOT gated by INBOX stage | new `tokenSavingOverrideSchema`; `app/api/projects/[projectId]/tickets/[id]/token-saving/route.ts` |
| `Job.tokenSavingOutcome` | one of ACTIVE/INACTIVE/FELL_BACK; workflow-token auth; first-write-wins | `jobStatusUpdateSchema` (`app/lib/job-update-validator.ts`); `app/api/jobs/[id]/status/route.ts` |

## State Transitions

### Ticket override (three-state)
```
Inherit (null) ⇄ Force ON (true) ⇄ Force OFF (false)
```
Any transition allowed at any stage **iff** no active run; switching back to `null` restores project-default behavior (FR-015, Edge Case "Inherit toggling").

### Job outcome (set once per run, by the runner)
```
                effective OFF / non-Claude agent ─────────────▶ INACTIVE
(run start) ──▶ effective ON & Claude ──▶ RTK install+activate ─┬─ ok ──▶ ACTIVE
                                                                └─ fail ▶ FELL_BACK
```
Reported via the RUNNING status PATCH; never changes afterward (run-in-progress immutability, Edge Case "Setting changed mid-run").

## Relationships (unchanged)
- `Ticket.projectId → Project` (inheritance source for `tokenSaving`).
- `Job.ticketId → Ticket`, `Job.projectId → Project` (outcome recorded per job; telemetry fields at schema L46-59 reused unchanged for savings measurement — FR-009).

## Reused Entities (no change)
- **Per-job token telemetry** — `Job.inputTokens`, `cacheReadTokens`, `cacheCreationTokens`, `peakContextTokens`, `avgContextTokens`, `turnCount` (schema L46-59). Used as-is to quantify savings (FR-009, SC-002); no new estimation fields.
