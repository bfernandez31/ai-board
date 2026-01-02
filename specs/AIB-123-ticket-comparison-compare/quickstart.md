# Quickstart: Ticket Comparison Implementation

**Feature**: AIB-123 - Ticket Comparison
**Date**: 2026-01-02

## Implementation Order

Execute in this sequence to minimize dependency conflicts:

### Phase 1: Core Library (lib/comparison/)

1. **ticket-reference-parser.ts**
   - Regex: `/#([A-Z0-9]{3,6}-\d+)/g`
   - Follow mention-parser.ts pattern
   - Export: `parseTicketReferences()`, `TICKET_REF_REGEX`

2. **similarity-algorithms.ts**
   - Implement: `levenshtein()`, `jaccard()`, `tfidf()`
   - Pure TypeScript, no external deps

3. **spec-parser.ts**
   - Use `remark` for AST parsing
   - Extract: requirements, scenarios, entities, keywords
   - Return structured `SpecSections` interface

4. **feature-alignment.ts**
   - Combine similarity algorithms
   - Weighted scoring (40% reqs, 30% scenarios, 20% entities, 10% keywords)
   - Return `FeatureAlignmentScore`

5. **constitution-scoring.ts**
   - Parse constitution.md sections
   - Binary pass/fail per principle
   - Return `ConstitutionComplianceScore`

6. **comparison-generator.ts**
   - Aggregate all analysis
   - Generate markdown report
   - Save to `specs/{branch}/comparisons/`

### Phase 2: API Routes

1. **app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts**
   - GET: List comparisons for ticket
   - Uses existing auth middleware

2. **app/api/projects/[projectId]/tickets/[id]/comparisons/check/route.ts**
   - GET: Quick existence check

3. **app/api/projects/[projectId]/tickets/[id]/comparisons/[filename]/route.ts**
   - GET: Fetch specific report content

### Phase 3: Claude Command

1. **.claude/commands/compare.md**
   - Parse ticket refs from comment
   - Validate tickets (same project, 1-5 limit)
   - Call comparison generator
   - Generate .ai-board-result.md

### Phase 4: UI Components

1. **components/comparison/types.ts**
   - Export all TypeScript interfaces

2. **components/comparison/comparison-viewer.tsx**
   - Extend DocumentationViewer pattern
   - Markdown rendering with react-markdown

3. **hooks/use-comparisons.ts**
   - TanStack Query hooks
   - `useComparisonCheck()`, `useComparisonList()`, `useComparisonReport()`

4. **Update ticket-detail-modal.tsx**
   - Add "Compare" button (conditional on hasComparisons)

### Phase 5: Tests

1. **tests/unit/comparison/**
   - ticket-reference-parser.test.ts
   - feature-alignment.test.ts
   - constitution-scoring.test.ts

2. **tests/integration/comparisons/**
   - comparison-api.test.ts

---

## Key Patterns to Follow

### Ticket Reference Parsing

```typescript
// lib/comparison/ticket-reference-parser.ts
export const TICKET_REF_REGEX = /#([A-Z0-9]{3,6}-\d+)/g;

export function parseTicketReferences(content: string): TicketReference[] {
  const refs: TicketReference[] = [];
  TICKET_REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TICKET_REF_REGEX.exec(content)) !== null) {
    refs.push({
      ticketKey: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return refs;
}
```

### Feature Alignment Scoring

```typescript
// lib/comparison/feature-alignment.ts
const WEIGHTS = {
  requirements: 0.4,
  scenarios: 0.3,
  entities: 0.2,
  keywords: 0.1,
};

export function calculateAlignment(
  spec1: SpecSections,
  spec2: SpecSections
): FeatureAlignmentScore {
  const dimensions = {
    requirements: compareRequirements(spec1.requirements, spec2.requirements),
    scenarios: compareScenarios(spec1.scenarios, spec2.scenarios),
    entities: compareEntities(spec1.entities, spec2.entities),
    keywords: compareKeywords(spec1.keywords, spec2.keywords),
  };

  const overall = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + dimensions[key] * weight,
    0
  );

  return {
    overall: Math.round(overall),
    dimensions,
    isAligned: overall >= 30,
    matchingRequirements: findMatches(spec1.requirements, spec2.requirements),
    matchingEntities: findMatches(spec1.entities, spec2.entities),
  };
}
```

### TanStack Query Hook

```typescript
// hooks/use-comparisons.ts
export function useComparisonCheck(projectId: number, ticketId: number) {
  return useQuery({
    queryKey: ['comparisons', 'check', projectId, ticketId],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticketId}/comparisons/check`
      );
      if (!response.ok) throw new Error('Failed to check comparisons');
      return response.json();
    },
    staleTime: 30_000, // Cache for 30 seconds
  });
}
```

### Claude Command Template

```markdown
# /compare Command

**Trigger**: `@ai-board /compare #KEY1 #KEY2 [#KEY3...]`
**Mode**: --ultrathink (32K token budget)

## Execution Steps

1. Parse ticket references from $ARGUMENTS
2. Validate tickets exist in same project (1-5 limit)
3. Resolve branches (database → pattern → merge)
4. Read spec.md and plan.md for each ticket
5. Calculate feature alignment score
6. Score constitution compliance
7. Extract job telemetry from database
8. Generate comparison report markdown
9. Save to specs/{branch}/comparisons/{timestamp}-vs-{keys}.md
10. Create .ai-board-result.md with SUCCESS status
```

---

## File Locations Summary

| File | Location |
|------|----------|
| Ticket parser | `lib/comparison/ticket-reference-parser.ts` |
| Similarity algos | `lib/comparison/similarity-algorithms.ts` |
| Spec parser | `lib/comparison/spec-parser.ts` |
| Alignment calc | `lib/comparison/feature-alignment.ts` |
| Constitution | `lib/comparison/constitution-scoring.ts` |
| Report gen | `lib/comparison/comparison-generator.ts` |
| API routes | `app/api/projects/[projectId]/tickets/[id]/comparisons/` |
| Claude command | `.claude/commands/compare.md` |
| UI components | `components/comparison/` |
| Query hooks | `hooks/use-comparisons.ts` |
| Types | `lib/types/comparison.ts` |
| Unit tests | `tests/unit/comparison/` |
| Integration tests | `tests/integration/comparisons/` |

---

## Validation Checklist

Before marking implementation complete:

- [x] Ticket reference parsing handles 1-5 references
- [x] Alignment score is 0-100%
- [x] Constitution scoring evaluates all 6 principles
- [x] Telemetry aggregation sums all ticket jobs
- [x] Reports stored in correct directory structure
- [x] "Compare" button only shows when comparisons exist
- [x] All API endpoints return proper error responses
- [x] Unit tests cover parsing and scoring logic
- [x] Integration tests cover API endpoints

**Validated**: 2026-01-02
