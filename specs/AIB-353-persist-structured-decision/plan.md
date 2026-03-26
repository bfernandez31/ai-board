# Implementation Plan: AIB-353 — Persist Structured Decision Points

**Branch**: `AIB-353-persist-structured-decision`
**Status**: Ready for implementation
**Workflow**: FULL

---

## Technical Context

| Aspect | Details |
|--------|---------|
| Database | No schema migration — `DecisionPointEvaluation` model already supports per-point structured data |
| AI Command | `.claude-plugin/commands/ai-board.compare.md` Step 10.5 needs `decisionPoints` field added |
| Validation | `lib/comparison/comparison-payload.ts` Zod schema needs optional `decisionPoints` array |
| Types | `lib/types/comparison.ts` `ComparisonReport` interface needs optional `decisionPoints` field |
| Persistence | `lib/comparison/comparison-record.ts` `buildDecisionPoints()` needs structured data path |
| UI | No changes — `components/comparison/comparison-decision-points.tsx` already renders per-point data |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly typed, no `any` |
| II. Component-Driven | PASS | No new components; existing UI already handles the data shape |
| III. Test-Driven | PASS | Integration tests for persistence, unit tests for mapping logic |
| IV. Security-First | PASS | Zod validation on all input; invalid ticket keys skipped not failed |
| V. Database Integrity | PASS | No schema changes; existing model supports the feature |
| VI. AI-First | PASS | No documentation files; changes are code and command template only |

## Gate Evaluation

- **No schema migration required**: PASS — existing `DecisionPointEvaluation` model is sufficient
- **Backward compatibility**: PASS — new field is optional with fallback to existing behavior
- **No new dependencies**: PASS — uses existing Zod, Prisma, TypeScript infrastructure

---

## Implementation Tasks

### Task 1: Add ReportDecisionPoint type to ComparisonReport interface

**File**: `lib/types/comparison.ts`
**User Stories**: US2
**Requirements**: FR-001

Add a new `ReportDecisionPoint` interface and an optional `decisionPoints` field to `ComparisonReport`:

```typescript
export interface ReportDecisionPointApproach {
  ticketKey: string;
  summary: string;
}

export interface ReportDecisionPoint {
  title: string;
  verdictTicketKey: string | null;
  verdictSummary: string;
  rationale: string;
  approaches: ReportDecisionPointApproach[];
}
```

Add to `ComparisonReport` interface:
```typescript
decisionPoints?: ReportDecisionPoint[];
```

**Test**: Unit test — verify type compiles and is assignable.

---

### Task 2: Extend Zod validation schema with decisionPoints

**File**: `lib/comparison/comparison-payload.ts`
**User Stories**: US2, US3
**Requirements**: FR-001, FR-003, FR-007

Add `reportDecisionPointSchema` and include it as an optional field in `serializedComparisonReportSchema`:

```typescript
const reportDecisionPointApproachSchema = z.object({
  ticketKey: z.string().min(1),
  summary: z.string().min(1),
});

const reportDecisionPointSchema = z.object({
  title: z.string().min(1),
  verdictTicketKey: z.string().nullable(),
  verdictSummary: z.string().min(1),
  rationale: z.string().min(1),
  approaches: z.array(reportDecisionPointApproachSchema),
});

// Add to serializedComparisonReportSchema:
decisionPoints: z.array(reportDecisionPointSchema).optional().default([]),
```

**Test**: Unit test — validate payloads with and without `decisionPoints`, verify defaults to `[]`.

---

### Task 3: Update buildDecisionPoints() to use structured data

**File**: `lib/comparison/comparison-record.ts`
**User Stories**: US2, US3
**Requirements**: FR-002, FR-003, FR-004, FR-007, FR-008

Modify `buildDecisionPoints()` (lines 143-169) to:

1. Check if `report.decisionPoints` exists and is non-empty
2. If yes: map each structured decision point to Prisma input, resolving `verdictTicketKey` → `verdictTicketId` via `ticketKeyToId`, and filtering invalid approach `ticketKey` references
3. If no: fall back to existing `matchingRequirements`-based derivation (current behavior, unchanged)

```typescript
function buildDecisionPoints(
  report: ComparisonReport,
  ticketKeyToId: Map<string, number>
): Prisma.DecisionPointEvaluationUncheckedCreateWithoutComparisonRecordInput[] {
  // Structured path: use AI-provided decision points when available
  if (report.decisionPoints && report.decisionPoints.length > 0) {
    return report.decisionPoints.map((dp, index) => ({
      title: dp.title,
      verdictTicketId: dp.verdictTicketKey
        ? (ticketKeyToId.get(dp.verdictTicketKey) ?? null)
        : null,
      verdictSummary: dp.verdictSummary,
      rationale: dp.rationale,
      participantApproaches: dp.approaches
        .filter((a) => ticketKeyToId.has(a.ticketKey))
        .map((a) => ({
          ticketId: ticketKeyToId.get(a.ticketKey),
          ticketKey: a.ticketKey,
          summary: a.summary,
        })),
      displayOrder: index,
    }));
  }

  // Fallback path: derive from matchingRequirements (existing behavior)
  const winnerTicketKey = getWinnerTicketKey(report);
  // ... existing code unchanged ...
}
```

**Test**: Integration test — persist a comparison with structured `decisionPoints` and verify each `DecisionPointEvaluation` record has distinct per-point data. Also test fallback when `decisionPoints` is absent.

---

### Task 4: Update AI comparison command template

**File**: `.claude-plugin/commands/ai-board.compare.md`
**User Stories**: US4
**Requirements**: FR-005

In Step 10.5 ("Write Comparison Data JSON"), add `decisionPoints` to the JSON schema specification. Add after the `warnings` field:

```
"decisionPoints": [
  {
    "title": "Decision area title from Step 7 analysis",
    "verdictTicketKey": "TICKET-KEY of the winning ticket for this decision, or null if tied",
    "verdictSummary": "One sentence explaining why this ticket won this specific decision point",
    "rationale": "Detailed reasoning for this decision point's verdict",
    "approaches": [
      {
        "ticketKey": "TICKET-KEY",
        "summary": "How this ticket addressed the architectural decision"
      }
    ]
  }
]
```

Add instruction: "Populate `decisionPoints` from the decision point analysis in Step 7. Each entry must have a unique title matching the decision points in the markdown report. The `verdictTicketKey` can differ per decision point — use the actual winner for each specific decision."

**Test**: Manual verification — review template for correctness.

---

## Testing Strategy

| Test Type | Scope | File Location |
|-----------|-------|---------------|
| Unit | `ReportDecisionPoint` Zod schema validation (valid, missing fields, null verdict, empty approaches) | `tests/unit/comparison-payload.test.ts` |
| Unit | `buildDecisionPoints()` mapping logic (structured path, fallback path, invalid keys) | `tests/unit/comparison-record.test.ts` |
| Integration | Full persistence flow with structured decision points via API | `tests/integration/comparison/` |
| Integration | Backward compatibility — persist without `decisionPoints` field | `tests/integration/comparison/` |

**Decision tree applied**:
- Zod schema validation = pure function → Unit test
- `buildDecisionPoints()` mapping = pure function → Unit test
- API persistence with DB = API + database → Integration test
- No browser-required features → No E2E tests

---

## Dependency Order

```
Task 1 (types) → Task 2 (validation) → Task 3 (persistence) → Task 4 (command template)
```

Tasks 1-3 form a dependency chain. Task 4 (command template) is independent but logically last since it's the producer of the data consumed by Tasks 1-3.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| AI doesn't produce well-formed `decisionPoints` | Medium | Zod validation catches malformed data; fallback path handles missing data |
| Existing comparisons break | Low | New field is optional; fallback preserves current behavior |
| AI hallucinates ticket keys in approaches | Low | FR-008: invalid keys are silently skipped |

## Artifacts

- [research.md](./research.md) — Research findings
- [data-model.md](./data-model.md) — Data model documentation
- [contracts/comparison-report-schema.md](./contracts/comparison-report-schema.md) — API contract extension
