# Phase 0 Research: Ticket Comparison Feature

**Feature**: AIB-123 - Ticket Comparison
**Date**: 2026-01-02
**Status**: Complete

## Research Summary

This document consolidates research findings from Phase 0 planning to inform the Phase 1 design artifacts.

---

## 1. Ticket Key Reference Parsing

### Decision
Use regex pattern `/#([A-Z0-9]{3,6}-\d+)/g` to extract ticket key references from comment text.

### Rationale
- Matches existing ticket key format validation: `/^[A-Z0-9]{3,6}-\d+$/`
- Follows established mention parsing pattern from `/app/lib/utils/mention-parser.ts`
- Simple prefix (`#`) is intuitive and avoids conflicts with mention syntax (`@[userId:name]`)

### Alternatives Considered
- **URL-based references**: Rejected - overly verbose for in-comment usage
- **Numeric ID references**: Rejected - not user-friendly, requires looking up IDs
- **Auto-linking without prefix**: Rejected - could match unintended text

### Implementation Pattern
```typescript
// Based on existing MENTION_REGEX pattern
const TICKET_REF_REGEX = /#([A-Z0-9]{3,6}-\d+)/g;

export function parseTicketReferences(content: string): TicketReference[] {
  const refs: TicketReference[] = [];
  TICKET_REF_REGEX.lastIndex = 0; // Critical: reset for global regex
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

---

## 2. Feature Alignment Calculation

### Decision
Use hybrid scoring algorithm with weighted dimensions: requirements (40%), user scenarios (30%), entities (20%), keywords (10%).

### Rationale
- Functional requirements are the strongest indicator of feature overlap
- Multi-dimensional approach captures different types of similarity
- Pure TypeScript implementation keeps bundle size small (no NLP libraries)
- 30% threshold from spec provides meaningful cutoff for unrelated tickets

### Alternatives Considered
- **ML-based embeddings**: Rejected - adds heavy dependencies, overkill for structured markdown
- **Simple keyword overlap**: Rejected - misses structural similarity
- **LLM-based analysis**: Rejected - slow, expensive for frequent comparisons

### Spec Structure for Comparison
Specs follow consistent structure with extractable sections:
- `## User Scenarios & Testing` - User stories with priority (P1/P2/P3)
- `## Requirements` - Functional requirements (FR-001, FR-002, etc.)
- `### Key Entities` - Data models and relationships
- `### Acceptance Scenarios` - Given/When/Then criteria

### Similarity Algorithms
Implement in pure TypeScript (~160 lines total):
- **Jaccard Index**: Set-based similarity for keywords and entities
- **Levenshtein Distance**: String similarity for requirement matching
- **TF-IDF**: Term weighting for document comparison

---

## 3. Branch and Merge Handling

### Decision
Implement three-tier resolution strategy: (1) database lookup, (2) branch pattern search, (3) merge commit analysis.

### Rationale
- Database lookup is fastest for active tickets
- Branch pattern fallback handles renamed/orphaned branches
- Merge commit analysis recovers data from deleted branches
- Graceful degradation ensures partial results over failure

### Alternatives Considered
- **Fail on missing branch**: Rejected - poor user experience
- **Cache all branch data**: Rejected - stale data, storage overhead
- **Require branches exist**: Rejected - restricts comparison to active tickets only

### Resolution Strategy
```
1. Database Lookup (Primary)
   → Query ticket.branch from Prisma
   → If exists: git diff main...{branch}

2. Branch Pattern Search (Fallback 1)
   → git branch -a | grep "{ticketKey}"
   → If found: use matched branch

3. Merge Commit Analysis (Fallback 2)
   → git log --merges --grep="{ticketKey}" --format="%H" -1
   → If found: analyze from merge commit
   → git diff {parent1}..{parent2}

4. Unavailable (Final Fallback)
   → Report "Branch unavailable - may be deleted"
   → Include in comparison with limited data
```

### Git Commands Reference
| Command | Purpose |
|---------|---------|
| `git merge-base --is-ancestor` | Check if branch merged |
| `git log --merges --grep="{key}"` | Find merge commit |
| `git diff main...{branch}` | Get branch changes |
| `git show {sha}` | Analyze commit |

---

## 4. Constitution Compliance Scoring

### Decision
Checklist-based scoring against constitution.md sections with binary pass/fail per principle.

### Rationale
- Constitution already defines non-negotiable rules as testable items
- Binary scoring is objective and consistent
- Aligns with spec decision to use checklist approach
- Per-principle breakdown provides actionable feedback

### Alternatives Considered
- **Weighted scoring**: Rejected - all constitution rules are non-negotiable
- **LLM-based assessment**: Rejected - inconsistent, expensive
- **Code-only analysis**: Rejected - misses design compliance

### Constitution Principles to Check
1. **TypeScript-First**: Strict mode, no `any`, explicit types
2. **Component-Driven**: shadcn/ui usage, feature folders, Server Components
3. **Test-Driven**: Testing trophy architecture, test coverage
4. **Security-First**: Zod validation, Prisma queries, no exposed secrets
5. **Database Integrity**: Migrations, transactions, soft deletes
6. **AI-First Model**: No human docs, spec-driven implementation

### Scoring Formula
```typescript
complianceScore = (passedPrinciples / totalPrinciples) * 100
// Example: 5/6 = 83.3%
```

---

## 5. Job Telemetry Extraction

### Decision
Extract telemetry from existing Job model fields via Prisma aggregation.

### Rationale
- All required metrics already stored in database
- No additional instrumentation needed
- Prisma provides type-safe queries

### Alternatives Considered
- **Real-time telemetry fetch**: Rejected - data already in database
- **OpenTelemetry aggregation**: Rejected - adds complexity, data already stored

### Available Telemetry Fields (from Prisma schema)
```typescript
interface JobTelemetry {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}
```

### Aggregation Query Pattern
```typescript
const telemetry = await prisma.job.aggregate({
  where: { ticketId },
  _sum: {
    inputTokens: true,
    outputTokens: true,
    costUsd: true,
    durationMs: true,
  },
});
```

---

## 6. Comparison Report Storage

### Decision
Store as markdown files in `specs/{branch}/comparisons/{timestamp}-vs-{keys}.md`.

### Rationale
- Follows existing documentation pattern (spec.md, plan.md)
- Enables git history for audit trail
- Reuses DocumentationViewer component
- Timestamp-based naming preserves comparison history

### Alternatives Considered
- **Database storage**: Rejected - doesn't leverage git history, adds schema complexity
- **Single report per ticket**: Rejected - loses history, overwrites previous comparisons
- **JSON format**: Rejected - harder to read, can't use markdown viewer

### Filename Pattern
```
{YYYYMMDD}-{HHMMSS}-vs-{KEY1}-{KEY2}[-{KEY3}...].md
Example: 20260102-143000-vs-AIB-124-AIB-125.md
```

### Directory Structure
```
specs/AIB-123-ticket-comparison/
├── spec.md
├── plan.md
└── comparisons/
    ├── 20260102-100000-vs-AIB-124-AIB-125.md
    └── 20260102-150000-vs-AIB-126.md
```

---

## 7. UI Integration Patterns

### Decision
Extend existing DocumentationViewer with comparison-specific rendering; add "Compare" button in ticket detail modal.

### Rationale
- Reuses proven component architecture
- Maintains consistent user experience
- Follows shadcn/ui patterns from constitution
- Button visibility controlled by comparison existence

### DocumentationViewer Pattern (from existing code)
- Generic modal for markdown content
- TanStack Query hooks for data fetching
- History and diff viewing support
- Permission-based edit mode

### Button Visibility Logic
```typescript
const hasComparisons = await checkComparisonExists(ticketId, branch);
// Show "Compare" button only when comparisons exist
// Tooltip explains how to create comparison if button not visible
```

---

## 8. Workflow Integration

### Decision
Extend ai-board-assist workflow with new `/compare` Claude command; use `--ultrathink` mode for deep analysis.

### Rationale
- Reuses existing workflow infrastructure
- Leverages established authentication and telemetry
- 32K token budget enables thorough cross-ticket analysis
- Response posted as comment with link to full report

### Alternatives Considered
- **New dedicated workflow**: Rejected - duplicates infrastructure
- **Client-side comparison**: Rejected - can't access git/specs
- **Background job without Claude**: Rejected - misses intelligent analysis

### Workflow Trigger Pattern
```
User posts: @ai-board /compare #AIB-124 #AIB-125

1. Comment handler detects @ai-board mention
2. Creates comment-{stage} job (PENDING)
3. Dispatches ai-board-assist.yml workflow
4. Claude executes /compare command with --ultrathink
5. Generates comparison report in specs/{branch}/comparisons/
6. Posts summary comment with link
7. Job marked COMPLETED
```

---

## Dependencies Analysis

### No New Dependencies Required
All functionality can be implemented with existing stack:
- `remark` v15.0.1 - Markdown AST parsing (already installed)
- `zod` v4.1.11 - Input validation (already installed)
- `date-fns` v4.1.0 - Timestamp formatting (already installed)

### Pure TypeScript Implementations Needed
- Levenshtein distance (~50 lines)
- Jaccard index (~30 lines)
- TF-IDF normalization (~80 lines)
- Spec section parser (~100 lines)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Merged/deleted branches | Three-tier resolution strategy with graceful degradation |
| Inconsistent spec formats | Remark AST parsing handles structural variations |
| Slow comparison generation | 5-minute timeout; Claude --ultrathink mode optimized for analysis |
| Feature alignment false positives | 30% threshold with cost-only fallback for low alignment |

---

## Next Steps (Phase 1)

1. Create `data-model.md` with entity definitions
2. Create `contracts/comparison-api.yaml` with OpenAPI spec
3. Create `quickstart.md` with implementation reference
4. Update agent context via `.specify/scripts/bash/update-agent-context.sh`
