# Research: Health Dashboard — Scan Detail Drawer

**Branch**: `AIB-371-health-dashboard-drawer` | **Date**: 2026-03-29

## Research Topics

### 1. Report JSON Schema per Module Type

**Decision**: Define a typed `ScanReport` union type with per-module discriminated variants. Each variant shares a common `issues` array and `generatedTickets` array but uses module-specific grouping keys.

**Rationale**: The `HealthScan.report` field is a nullable `String` in Prisma. The drawer needs structured data to render grouped issues. A discriminated union (keyed on scan type) gives TypeScript exhaustive checking while remaining flexible per module.

**Alternatives Considered**:
- **Flat array of issues**: Rejected — loses module-specific grouping metadata (e.g., severity for Security vs. principle for Compliance).
- **Separate DB columns per module**: Rejected — over-normalized, the `report` JSON field is already in place and flexible enough.

**Schema Design**:
```typescript
// Common structures
interface ReportIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  file?: string;
  line?: number;
  category?: string; // module-specific grouping key
}

interface GeneratedTicket {
  ticketKey: string;  // e.g., "AIB-123"
  stage: string;      // e.g., "INBOX", "BUILD"
}

// Per-module report shapes
interface SecurityReport {
  type: 'SECURITY';
  issues: ReportIssue[];           // grouped by severity
  generatedTickets: GeneratedTicket[];
}

interface ComplianceReport {
  type: 'COMPLIANCE';
  issues: ReportIssue[];           // category = constitution principle
  generatedTickets: GeneratedTicket[];
}

interface TestsReport {
  type: 'TESTS';
  autoFixed: ReportIssue[];        // auto-fixed test issues
  nonFixable: ReportIssue[];       // non-fixable test issues
  generatedTickets: GeneratedTicket[];
}

interface SpecSyncReport {
  type: 'SPEC_SYNC';
  specs: { specPath: string; status: 'synced' | 'drifted'; drift?: string }[];
  generatedTickets: GeneratedTicket[];
}

// Passive modules (derived, not from scan)
interface QualityGateReport {
  type: 'QUALITY_GATE';
  dimensions: { name: string; score: number | null }[];
  recentTickets: { ticketKey: string; score: number | null }[];
}

interface LastCleanReport {
  type: 'LAST_CLEAN';
  filesCleaned: number;
  remainingIssues: number;
  summary: string;
}

type ScanReport = SecurityReport | ComplianceReport | TestsReport | SpecSyncReport | QualityGateReport | LastCleanReport;
```

### 2. Sheet Component Sizing for Content Density

**Decision**: Override the default `sm:max-w-sm` Sheet width to `sm:max-w-lg` (32rem / 512px) for the drawer to accommodate the content density (issue lists, file paths, ticket links, history).

**Rationale**: The default Sheet is 384px (`sm:max-w-sm`) which is too narrow for displaying file paths, line numbers, and grouped issue lists. 512px provides breathing room without dominating the dashboard on wide screens.

**Alternatives Considered**:
- **Full-width Sheet (`sm:max-w-xl`)**: Rejected — too wide, obscures the dashboard completely.
- **Default width**: Rejected — file paths get truncated, content feels cramped.

### 3. Drawer Trigger Mechanism (Click on Card)

**Decision**: Make the entire module card clickable (except the scan trigger button) to open the drawer. Use `onClick` on the card root `<div>` with `stopPropagation` on the scan button.

**Rationale**: The spec says "clicks on a module card" — the card itself is the trigger, not a separate button. The scan button already handles its own click, so `stopPropagation` prevents the drawer from opening when triggering a scan.

**Alternatives Considered**:
- **Separate "View Details" button**: Rejected — adds UI clutter when the card is already a natural click target.
- **SheetTrigger wrapping**: Rejected — can't easily wrap the card without restructuring; controlled state (`open`/`onOpenChange`) is more flexible.

### 4. Scan History Pagination UX in Drawer

**Decision**: Use a "Load more" button at the bottom of the history list rather than infinite scroll.

**Rationale**: The drawer is a constrained scroll container. Infinite scroll in a nested scrollable can cause UX issues (scroll hijacking, unclear where list ends). A "Load more" button gives explicit user control and is simpler to implement with cursor-based pagination.

**Alternatives Considered**:
- **Infinite scroll (IntersectionObserver)**: Rejected — complex scroll container nesting, potential UX confusion.
- **Full pagination with page numbers**: Rejected — overkill for a history list in a drawer.

### 5. Drawer Content Refresh on Live Scan Completion

**Decision**: The drawer will share the same `useHealthPolling` data already used by the dashboard. When a scan completes, the polling updates the health data, which triggers a re-render of the drawer. For the individual scan report, a separate query fetches the latest scan for the selected module and invalidates on health data change.

**Rationale**: Reuses the existing 2s polling mechanism. No new WebSocket or SSE needed. The drawer reads from the same query cache.

**Alternatives Considered**:
- **Separate polling in drawer**: Rejected — redundant network requests; the dashboard already polls.
- **WebSocket push**: Rejected — over-engineered for this use case; polling is already in place.

### 6. Quality Gate and Last Clean Data Sources

**Decision**: Quality Gate and Last Clean modules don't have `HealthScan.report` records with the same structure. Their drawer content will be derived from:
- **Quality Gate**: Latest verify job's `qualityScore` breakdown (fetched via the existing health endpoint which already derives this) plus recent SHIP tickets.
- **Last Clean**: Latest cleanup job metadata (already in the health endpoint response via `lastCleanDate` and `jobId`). A new optional API parameter or a lightweight fetch to `/api/projects/{projectId}/jobs/{jobId}` provides cleanup details.

**Rationale**: Passive modules don't run scans — they aggregate data from other workflows. The drawer needs to fetch their data differently than active scan modules.

### 7. Fallback for Legacy/Malformed Reports

**Decision**: Use `safeParse` (Zod) on the report JSON. If parsing fails or the report is null/empty, render a fallback message: "Report data unavailable" for completed scans, or "No report generated" for failed scans.

**Rationale**: The spec explicitly requires graceful handling (FR-012). Existing scans may have unstructured or null reports. Zod validation at render time catches malformed data without crashing.
