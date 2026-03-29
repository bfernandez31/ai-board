# Feature Specification: Health Dashboard - 4 Health Scan Commands

**Feature Branch**: `AIB-373-health-dashboard-4`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "4 nouvelles commandes du plugin ai-board qui executent les analyses de sante projet"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Output JSON format — align with existing `report-schemas.ts` Zod discriminated union rather than the flat format described in the ticket
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 9) — security/compliance keywords dominate, no conflicting signals
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE with high confidence
- **Trade-offs**:
  1. Ensures seamless integration with existing dashboard, API endpoints, and Zod validation
  2. Command output must be transformed from raw scan results into the typed report structure before storage
- **Reviewer Notes**: Verify that the existing `parseScanReport()` function in `lib/health/report-schemas.ts` correctly handles all fields the commands will produce

---

- **Decision**: Auto-fix commit strategy for health-tests — each successful fix is committed individually with a descriptive message
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 9) — test integrity requires traceable, atomic commits
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Individual commits provide clear traceability and easy rollback per fix
  2. May produce multiple small commits on the branch during a single scan
- **Reviewer Notes**: Confirm that committing during a scan does not interfere with concurrent workflows on the same branch

---

- **Decision**: Constitution file discovery — commands read `.ai-board/memory/constitution.md` first, falling back to `.claude-plugin/memory/constitution.md`
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 9) — compliance scanning must use the project-specific constitution
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Project-level constitution takes precedence, ensuring project-specific principles are enforced
  2. Fallback to plugin constitution ensures scans never fail due to missing file
- **Reviewer Notes**: Validate fallback behavior when neither constitution file exists (should produce a clear error in report, not crash)

---

- **Decision**: Severity classification for compliance issues — map constitution principle violations to HIGH/MEDIUM/LOW based on principle criticality
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 9) — security and data-integrity principles warrant HIGH severity
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Security-First and Database-Integrity violations are HIGH; style violations are LOW
  2. Consistent with security scan severity model
- **Reviewer Notes**: Review severity mapping against the 7 constitution principles to ensure appropriate classification

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Security Audit via Workflow (Priority: P1)

A project owner triggers a security health scan from the dashboard. The workflow dispatches the `health-security` command which analyzes the repository for OWASP Top 10 vulnerabilities and produces a structured report with actionable findings.

**Why this priority**: Security vulnerabilities are the highest-risk issues; detecting them is the primary value of the health scan system.

**Independent Test**: Can be fully tested by running the security command against a repository with known vulnerabilities (e.g., hardcoded secrets, unvalidated inputs) and verifying the JSON report contains the expected issues with correct severity, file, and line references.

**Acceptance Scenarios**:

1. **Given** a repository with no `--base-commit` argument, **When** the security scan runs, **Then** it performs a full repository scan and outputs valid JSON with a score (0-100), issues array, and summary
2. **Given** a `--base-commit` SHA, **When** the security scan runs, **Then** only files changed since that commit are analyzed and the report reflects only those changes
3. **Given** a clean repository with no security issues, **When** the scan completes, **Then** the score is 100 and the issues array is empty
4. **Given** a file with a hardcoded API key, **When** the scan runs, **Then** an issue with severity HIGH, category "sensitive-data", and the exact file path and line number is reported

---

### User Story 2 - Compliance Verification Against Constitution (Priority: P1)

A project owner triggers a compliance scan. The command reads the project's constitution and CLAUDE.md, then evaluates the codebase against each declared principle, producing a per-principle compliance report.

**Why this priority**: Ensuring code follows project governance rules is essential for AI-first development consistency.

**Independent Test**: Can be tested by running the compliance command against a repository with known constitution violations (e.g., `any` type usage, hardcoded hex colors) and verifying each violation maps to the correct constitution principle.

**Acceptance Scenarios**:

1. **Given** a project with `.ai-board/memory/constitution.md`, **When** the compliance scan runs, **Then** it reads that file (not the plugin default) and evaluates code against its principles
2. **Given** no project-level constitution exists, **When** the scan runs, **Then** it falls back to `.claude-plugin/memory/constitution.md`
3. **Given** a file using `any` type in strict TypeScript mode, **When** the scan runs, **Then** an issue with category "TypeScript-First" is reported with the file and line
4. **Given** a `--base-commit` SHA, **When** the scan runs, **Then** only changed files since that commit are evaluated

---

### User Story 3 - Test Execution with Auto-Fix (Priority: P1)

A project owner triggers a test health scan. The command detects and runs the project's test suite, identifies failures, attempts automatic fixes, and reports results including which tests were fixed and which remain broken.

**Why this priority**: Automated test repair reduces manual intervention and keeps the project in a deployable state.

**Independent Test**: Can be tested by introducing a deliberate test failure (e.g., wrong expected value), running the test command, and verifying the auto-fix corrects it and commits the change.

**Acceptance Scenarios**:

1. **Given** a project with a test command in `package.json`, **When** the test scan runs, **Then** it detects and executes the correct test command
2. **Given** a failing test with an obvious fix (e.g., outdated assertion), **When** the scan runs, **Then** it fixes the test, re-runs it to confirm the fix, and commits the change
3. **Given** a failing test requiring architectural changes, **When** the scan runs, **Then** it reports the test as non-fixable with a clear reason
4. **Given** all tests pass, **When** the scan completes, **Then** the score is 100, issuesFixed is 0, and no non-fixable issues are reported
5. **Given** any scan run, **When** it completes, **Then** the output includes total tests count, pass count, fail count, auto-fixed count, and non-fixable count

---

### User Story 4 - Specification Synchronization Check (Priority: P2)

A project owner triggers a spec sync scan. The command reads consolidated specifications from `specs/specifications/` and compares them against the actual codebase to detect drift between documented behavior and implementation.

**Why this priority**: Spec drift leads to incorrect documentation and misaligned development; detecting it ensures specs remain a reliable source of truth.

**Independent Test**: Can be tested by modifying a documented API endpoint without updating the spec, then running the scan and verifying it detects the drift.

**Acceptance Scenarios**:

1. **Given** a fully synchronized codebase and specs, **When** the scan runs, **Then** all specs show status "synced" and the score is 100
2. **Given** an API endpoint that exists in code but not in specs, **When** the scan runs, **Then** a drift entry is reported for the relevant spec with a description of the missing documentation
3. **Given** a spec describing a data model field that was removed from the actual schema, **When** the scan runs, **Then** a drift entry identifies the spec and describes the discrepancy
4. **Given** a `--base-commit` SHA, **When** the scan runs, **Then** only specs impacted by the changed files are evaluated

---

### Edge Cases

- What happens when the test command cannot be detected (no `package.json`, no conventional test scripts)? → Report score 0 with an error-level issue explaining no test command was found
- What happens when `--base-commit` refers to a commit that doesn't exist in the repository? → Report an error issue and fall back to full scan
- What happens when the constitution file is empty or malformed? → Report score 0 with an issue describing the parsing failure
- What happens when no spec files exist in `specs/specifications/`? → Report score 100 (nothing to be out of sync) with a summary noting no specs were found
- What happens when a scan is interrupted mid-execution? → The workflow marks the scan as FAILED with the error message from the interrupted process

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each command MUST produce a valid JSON object to stdout that conforms to the existing health scan report schema and passes automated validation
- **FR-002**: Each command MUST accept optional `--base-commit <SHA>` and `--head-commit <SHA>` arguments for incremental scanning
- **FR-003**: When `--base-commit` is provided, security, compliance, and spec-sync commands MUST analyze only the diff between base and head commits
- **FR-004**: When `--base-commit` is not provided, commands MUST perform a full repository scan
- **FR-005**: The health-tests command MUST always perform a full test run regardless of `--base-commit` (no incremental mode for tests)
- **FR-006**: The health-security command MUST detect injection vulnerabilities (SQL, XSS, command), exposed secrets, missing auth checks, insecure dependencies, and OWASP Top 10 patterns
- **FR-007**: The health-compliance command MUST dynamically read the project's constitution file (`.ai-board/memory/constitution.md` with fallback to `.claude-plugin/memory/constitution.md`) and evaluate code against each declared principle
- **FR-008**: The health-tests command MUST detect the project's test command from `package.json` scripts or conventions, execute it, and report results
- **FR-009**: For each failing test, the health-tests command MUST attempt an automatic fix, re-run the specific test, and commit the fix if successful
- **FR-010**: If an auto-fix attempt fails, the test MUST be reported as non-fixable with the original error and reason the fix failed
- **FR-011**: The health-spec-sync command MUST read specs from `specs/specifications/` and compare each against the corresponding implementation code
- **FR-012**: The health-spec-sync command MUST detect: features specified but absent in code, code present without spec coverage, and behavioral divergence between spec and implementation
- **FR-013**: Each issue reported MUST include the file path and line number where the issue was found (when applicable), along with an actionable description
- **FR-014**: The score (0-100) MUST reflect the overall health: 100 means no issues found, lower scores proportional to issue count and severity
- **FR-015**: Commands MUST output ONLY the JSON object to stdout — no additional text, logs, or formatting

### Key Entities *(include if feature involves data)*

- **Health Scan Report**: The JSON output produced by each command, containing score, issues, and scan metadata — stored in the `HealthScan.report` column as a JSON string
- **Report Issue**: An individual finding with severity, description, file location, and category — used to generate remediation tickets
- **Spec Sync Entry**: A per-specification status record indicating whether a spec is synchronized with code or has drifted — includes drift description when applicable

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 4 commands produce JSON output that passes the existing schema validation without modification to the validation rules
- **SC-002**: Security scan identifies at least 90% of intentionally planted vulnerabilities in a test repository (injection, exposed secrets, missing auth)
- **SC-003**: Compliance scan correctly maps violations to the specific constitution principle being violated for 100% of detected issues
- **SC-004**: Test scan auto-fix success rate is at least 50% for simple failures (wrong assertions, import path changes, renamed functions)
- **SC-005**: Spec sync correctly identifies drift for 100% of deliberately desynchronized specifications
- **SC-006**: Incremental scans (with `--base-commit`) complete in less than half the time of full scans on the same repository
- **SC-007**: Each reported issue includes sufficient context (file, line, description) for a developer to locate and understand the problem without additional investigation
- **SC-008**: The workflow can parse and store command output, trigger remediation ticket creation, and update scan status without manual intervention
