# Data Model: Code Simplifier and PR Review

**Branch**: `AIB-169-add-code-simplifier` | **Date**: 2026-01-21

## Summary

This feature does not introduce new database entities or modify existing data models. The implementation consists of:

1. **Command Files** - Markdown files defining Claude Code command behavior
2. **Workflow Steps** - YAML steps in GitHub Actions workflow
3. **Runtime Artifacts** - Temporary files generated during workflow execution

## Runtime Artifacts (Non-Persistent)

### Code Simplifier Output

```typescript
// Generated during workflow execution, not stored in database
interface SimplificationReport {
  filesAnalyzed: number;
  filesModified: number;
  changes: SimplificationChange[];
  testsRun: number;
  testsPassed: boolean;
}

interface SimplificationChange {
  file: string;
  lineRange: string;
  type: 'nested-ternary' | 'redundant-abstraction' | 'complex-boolean' | 'callback-nesting' | 'indirection';
  before: string;  // snippet
  after: string;   // snippet
}
```

### Code Review Output

```typescript
// Used for PR comment generation, not stored in database
interface ReviewReport {
  prNumber: number;
  filesReviewed: number;
  issues: ReviewIssue[];
  constitutionCompliance: ComplianceCheck[];
  claudeMdAlignment: ComplianceCheck[];
}

interface ReviewIssue {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  description: string;
  confidence: number;  // 0-100, only issues ≥80 reported
  suggestion?: string;
}

interface ComplianceCheck {
  principle: string;
  status: 'compliant' | 'violation' | 'not-applicable';
  notes?: string;
}
```

## Existing Models (Unchanged)

The following existing models are used but not modified:

- **Job**: Tracks workflow execution status (PENDING → RUNNING → COMPLETED|FAILED|CANCELLED)
- **Ticket**: Reference for branch and PR information
- **Comment**: PR review comments are posted via existing comment API

## No Schema Changes Required

This feature operates entirely within the workflow execution context and does not require Prisma schema modifications.
