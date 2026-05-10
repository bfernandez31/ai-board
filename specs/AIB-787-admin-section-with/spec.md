# Feature Specification: Admin section with Claude Code Insights report

**Feature Branch**: `AIB-787-admin-section-with`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: User description: "Admin section with Claude Code Insights report"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Report storage location (Blob vs DB)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (aligned with existing artifact storage patterns)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Blob storage provides better scalability for large HTML reports
  2. Consistent with how other artifacts are stored in the system
- **Reviewer Notes**: Verify blob storage integration matches existing patterns; confirm metadata storage in DB

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Access Admin Insights Page (Priority: P1)

An authorized admin user navigates to `/admin/insights` to view the latest Claude Code Insights report.

**Why this priority**: This is the core value proposition - admins need to see usage patterns and meta-feedback to improve the platform.

**Independent Test**: Can be fully tested by navigating to the page and verifying the report renders correctly with metadata.

**Acceptance Scenarios**:

1. **Given** user is authorized and reports exist, **When** they navigate to `/admin/insights`, **Then** they see the latest report rendered inline with metadata header
2. **Given** user is unauthorized, **When** they attempt to access `/admin/insights`, **Then** they receive a clear "not allowed" response

---

### User Story 2 - Run New Analysis (Priority: P1)

An authorized admin user clicks "Run new analysis" to generate a fresh insights report when new tickets have shipped.

**Why this priority**: Critical for keeping insights current and actionable.

**Independent Test**: Can be tested by triggering analysis, verifying job execution, and confirming new report appears.

**Acceptance Scenarios**:

1. **Given** new tickets have shipped since last run, **When** user clicks "Run new analysis", **Then** background job starts and new report becomes latest
2. **Given** no new tickets since last run, **When** user clicks "Run new analysis", **Then** system shows friendly refusal message

---

### User Story 3 - View Past Reports (Priority: P2)

An authorized admin user selects a previous report from the list to view historical insights.

**Why this priority**: Important for tracking trends over time but not critical for initial value.

**Independent Test**: Can be tested by selecting past report and verifying it renders correctly.

**Acceptance Scenarios**:

1. **Given** multiple reports exist, **When** user selects a past report, **Then** that specific report renders with its metadata
2. **Given** user is viewing a past report, **When** they return to latest, **Then** current report is shown

---

### Edge Cases

- What happens when analysis job fails? (Shows error state, allows retry)
- How does system handle concurrent trigger attempts? (Prevents double-trigger with clear messaging)
- What if no reports exist yet? (Shows empty state with option to run first analysis)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST restrict `/admin` access to config-defined allowlist of users
- **FR-002**: System MUST render the latest Claude Code Insights report inline at `/admin/insights`
- **FR-003**: System MUST display report metadata including generation date, period analyzed, and coverage stats
- **FR-004**: System MUST provide "Run new analysis" button that triggers background job when new tickets exist
- **FR-005**: System MUST prevent analysis trigger when no new shipped tickets exist since last run
- **FR-006**: System MUST show running state during job execution with no double-trigger possible
- **FR-007**: System MUST store reports as read-only artifacts with chronological access
- **FR-008**: System MUST include only Claude Code agent sessions in analysis (filter out other agents)
- **FR-009**: System MUST make analyzed scope explicit in report header

### Key Entities

- **Insights Report**: HTML document containing analysis results, generation timestamp, period covered, session count, ticket count
- **Admin User**: User entity with allowlist status (config-driven, no DB schema)
- **Analysis Job**: Background process that fetches sessions, runs analyzer, persists report
- **Session Artifact**: Raw Claude Code session data used as analyzer input

### Internal Processes

- **Insights Analysis Job**: Triggered manually from UI, analyzes Claude Code sessions to produce HTML report
  - **Input**: Raw Claude session artifacts since last successful run (or all-time for first run)
  - **Phases**:
    1. Pre-flight check for new shipped tickets
    2. Session artifact download
    3. Claude Code `/insights` analyzer execution
    4. HTML report persistence to blob storage
    5. Metadata storage to database
  - **Output**: HTML report artifact and metadata record
  - **Error behavior**: Shows user-friendly error message, job is not retryable automatically, partial results discarded

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Authorized users can view latest insights report within 5 seconds of page load
- **SC-002**: Analysis job completes successfully for datasets up to 10,000 sessions
- **SC-003**: 95% of analysis triggers complete without errors when new tickets exist
- **SC-004**: Unauthorized access attempts receive clear denial response within 1 second
- **SC-005**: Report header clearly shows analyzed scope (session count, ticket count, date range)