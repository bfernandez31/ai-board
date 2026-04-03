# Research: Health Scan — Review Quality Analysis

**Ticket**: AIB-497
**Date**: 2026-04-03

---

## R-001: Adding a New HealthScanType to the Existing Infrastructure

**Decision**: Add `REVIEW_QUALITY` to the `HealthScanType` Prisma enum and extend all type-level registries (`ACTIVE_SCAN_TYPES`, `ALL_MODULE_TYPES`, `MODULE_METADATA`, `SCAN_COMMAND_MAP`, score calculator, report schemas, ticket creation, dashboard grid, nightly workflow, health API response).

**Rationale**: The existing infrastructure follows a strict pattern — every scan type is registered in ~12 locations. Adding a new type requires touching all of them consistently. The discriminated union pattern in `report-schemas.ts` and `types.ts` provides type safety and validation.

**Alternatives considered**:
- Implementing as a standalone module outside the health system: Rejected — fragments the health dashboard and loses score aggregation.
- Adding as a sub-module of COMPLIANCE: Rejected — review quality is orthogonal to constitution compliance.

**Files requiring modification**:
1. `prisma/schema.prisma` — Add `REVIEW_QUALITY` to `HealthScanType` enum
2. `lib/health/types.ts` — Add to `ACTIVE_SCAN_TYPES`, `ALL_MODULE_TYPES`, `MODULE_METADATA`; add `ReviewQualityReport` type; extend `ScanReport` union; add `reviewQualityScore` to `HealthModuleStatus` pipeline
3. `lib/health/report-schemas.ts` — Add Zod schema for `ReviewQualityReport`; add to discriminated union
4. `lib/health/scan-commands.ts` — Add `REVIEW_QUALITY: 'health-review-quality'` to command map
5. `lib/health/ticket-creation.ts` — Add `groupReviewQualityIssues()` for `[Review Gap]` ticket creation
6. `lib/health/score-calculator.ts` — Include `reviewQualityScore` in global score calculation
7. `prisma/schema.prisma` (HealthScore model) — Add `reviewQualityScore Int?` and `lastReviewQualityScan DateTime?`
8. `app/api/projects/[projectId]/health/route.ts` — Add `reviewQuality` module to response
9. `components/health/health-dashboard.tsx` — Add `REVIEW_QUALITY` to `MODULE_GRID`
10. `components/health/health-module-card.tsx` — Add icon for Review Quality
11. `components/health/drawer/drawer-issues.tsx` — Add rendering for review quality findings
12. `.github/workflows/nightly-health.yml` — Add `REVIEW_QUALITY` to scan loop
13. `.github/workflows/health-scan.yml` — Add `REVIEW_QUALITY` case for LLM agent execution
14. `.claude-plugin/commands/ai-board.health-review-quality.md` — New Claude command for scan execution

---

## R-002: GitHub API — Fetching PR Review Comments from Multiple Sources

**Decision**: Use Octokit REST API to fetch both issue comments (`GET /repos/{owner}/{repo}/issues/{number}/comments`) and review comments (`GET /repos/{owner}/{repo}/pulls/{number}/comments`) for each merged PR. Filter by bot identity for source classification.

**Rationale**: GitHub stores PR comments in two locations: (1) issue comments (top-level, used by ai-board custom `### Code review`), and (2) pull request review comments (inline, used by Codex and Copilot bots). Both APIs must be queried.

**Source identification**:
- **ai-board custom**: Issue comments containing `### Code review` heading
- **Codex**: Review comments by `chatgpt-codex-connector[bot]`
- **Copilot**: Review comments by `Copilot` user/bot

**Alternatives considered**:
- GraphQL API for batch fetching: More efficient for many PRs but adds complexity; REST is already used throughout the codebase (`lib/github/`).
- Webhooks for real-time collection: Rejected — adds infrastructure; nightly batch is simpler and sufficient.

---

## R-003: PR Discovery — Finding FULL Workflow Merged PRs

**Decision**: Query the database for tickets with `workflowType: 'FULL'` and `stage: 'SHIP'` (completed), join with their branches, then use GitHub API to find merged PRs associated with those branches. Only process PRs merged after the last scan's `completedAt` timestamp.

**Rationale**: PR discovery must be database-driven (not purely GitHub API-driven) because the system needs to filter by workflow type, which is an ai-board concept not available in GitHub metadata.

**Alternatives considered**:
- Scanning all merged PRs via GitHub API then filtering: Rejected — wasteful API calls and requires reverse-mapping PRs to tickets.
- Using `headCommit` like other scans: Not applicable — review quality doesn't scan code; it scans PR comments.

---

## R-004: Cross-Referencing Algorithm for Missed Findings

**Decision**: For each PR, collect all findings from all three sources. For each Codex/Copilot finding, check if ai-board custom has a finding on the same file within a 5-line range. Unmatched Codex/Copilot findings are "missed" by ai-board.

**Rationale**: The 5-line tolerance handles cases where different reviewers identify the same issue but reference slightly different line numbers. This is conservative enough to avoid false deduplication.

**Implementation approach**:
1. Parse ai-board custom `### Code review` sections into structured findings (file, line, description)
2. Parse Codex/Copilot inline comments (file, line already structured in GitHub API response)
3. For each external finding, search ai-board findings for same file + line within ±5
4. Unmatched = missed finding

---

## R-005: Report JSON Structure for REVIEW_QUALITY

**Decision**: Use a discriminated union report type consistent with existing patterns, with additional fields for cumulative analysis and generated tickets.

**Rationale**: Must fit into existing `ScanReport` union, `parseScanReport()`, and drawer rendering pipeline.

**Structure**:
```typescript
interface ReviewQualityReport {
  type: 'REVIEW_QUALITY';
  summary: {
    prsAnalyzed: number;
    totalMissedFindings: number;
    coverageScore: number;
  };
  missedFindings: MissedFinding[];
  cumulativeAnalysis: {
    windowDays: number;
    recurringPatterns: RecurringPattern[];
  };
  generatedTickets: GeneratedTicket[];
}
```

---

## R-006: Cumulative Analysis — 30-Day Window Pattern Detection

**Decision**: After each scan, query the last 30 days of `REVIEW_QUALITY` scan reports from the database. Parse each report's `missedFindings`, aggregate by category across PRs, and flag categories appearing in 3+ distinct PRs as recurring patterns.

**Rationale**: Database-driven aggregation (not file-based) fits the existing `HealthScan` model. The 30-day window and 3-occurrence threshold were auto-resolved in the spec as CONSERVATIVE defaults.

**Deduplication for tickets**: Before creating a `[Review Gap]` ticket, query existing tickets with title matching `[Review Gap]` and the same category. Use `prisma.ticket.findFirst({ where: { title: { contains: category } } })`.

---

## R-007: Severity Assessment Heuristics

**Decision**: The LLM agent (Claude) assesses severity during scan execution based on runtime impact potential, using these guidelines:
- **high**: Could cause data loss, security vulnerability, or crash in production
- **medium**: Could cause incorrect behavior, poor UX, or performance degradation
- **low**: Code quality issue, missing optimization, or minor edge case

**Rationale**: LLM-based severity assessment aligns with how SECURITY and COMPLIANCE scans already work — the Claude agent analyzes findings and assigns severity. No need for a separate heuristic engine.

---

## R-008: Dashboard Integration — Card and Drawer Design

**Decision**: Follow the exact same pattern as existing module cards. Use `ClipboardCheck` (lucide-react) icon for Review Quality. The drawer reuses `drawer-issues.tsx` patterns but adds a "Cumulative Patterns" section with suggested rules.

**Rationale**: Consistency with existing 5-module dashboard. The 6th module fits in the 2-column grid (3 rows of 2).

**Alternatives considered**:
- Separate page for review quality: Rejected — breaks the unified health dashboard pattern.
- Expandable card instead of drawer: Rejected — inconsistent with other modules.
