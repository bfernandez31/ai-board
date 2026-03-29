# Feature Specification: Health Scan Commands for ai-board Plugin

**Feature Branch**: `AIB-378-copy-of-health`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "4 health scan commands (security, compliance, tests, spec-sync) that execute project health analyses and produce structured JSON reports, called by the health-scan workflow."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: All 4 commands share a common base JSON output structure (score, issues, commits, summary counts) with command-specific extensions
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 15 — multiple security/compliance keywords, zero conflicting signals)
- **Fallback Triggered?**: No — AUTO naturally resolved to CONSERVATIVE due to strong security/compliance signal
- **Trade-offs**:
  1. Strict shared schema ensures workflow integration reliability at the cost of per-command flexibility
  2. Uniform structure simplifies parsing and remediation ticket creation in the workflow
- **Reviewer Notes**: Verify the shared schema covers all fields the workflow expects to parse

---

- **Decision**: health-tests always runs a full test suite (no incremental mode), while the other 3 commands support incremental (baseCommit) scanning
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — tests must all pass regardless of what changed; partial test runs risk masking regressions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Full test runs are slower but guarantee complete regression coverage
  2. Incremental mode for security/compliance/spec-sync reduces scan time for frequent runs
- **Reviewer Notes**: Confirm that auto-fix commits during health-tests are acceptable on the target branch

---

- **Decision**: Auto-fix in health-tests commits fixes directly to the branch when successful; failed fixes are reported as non-fixable issues
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — auto-fix is explicitly required in the ticket description; CONSERVATIVE stance means each fix must be individually committed and verifiable
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Individual commits per fix provide clear traceability but may produce many small commits
  2. Failed auto-fixes are surfaced transparently so humans can intervene
- **Reviewer Notes**: Ensure auto-fix commits follow the project's commit conventions and do not bypass pre-commit hooks

---

- **Decision**: health-compliance reads constitution dynamically from the target project (not hardcoded to ai-board's constitution)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicitly stated in acceptance criteria; each project may have its own governance rules
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dynamic reading ensures each project is evaluated against its own standards
  2. Projects without a constitution file receive a graceful fallback (report that no constitution was found)
- **Reviewer Notes**: Verify fallback behavior when target project has no constitution.md or CLAUDE.md

---

- **Decision**: Severity levels are standardized: high (exploitable/critical), medium (potential risk), low (best practice violation) across all commands that report severity — lowercase to match the Zod schema in report-schemas.ts
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — consistent severity taxonomy aligns with OWASP and industry standards
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Standardized severities enable cross-command aggregation in the health dashboard
  2. Some compliance violations may not map cleanly to security severities
- **Reviewer Notes**: Confirm compliance uses pass/partial/fail per principle in addition to the shared severity model for issues

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Security Audit of Project Code (Priority: P1)

A project owner triggers a health scan to identify security vulnerabilities in their codebase. The system analyzes the code for injection risks, authentication flaws, exposed secrets, vulnerable dependencies, and OWASP Top 10 issues, then produces a structured report with actionable remediation guidance.

**Why this priority**: Security vulnerabilities represent the highest-risk category; early detection prevents exploitable code from reaching production.

**Independent Test**: Can be fully tested by running the security scan command against a repository with known vulnerabilities and verifying the JSON report correctly identifies them with file, line, severity, and fix recommendations.

**Acceptance Scenarios**:

1. **Given** a project repository with code, **When** the security scan runs without a baseCommit, **Then** it performs a full repository scan and produces a valid JSON report with a score (0-100), issues grouped by severity (high/medium/low), and each issue includes file path, line number, vulnerability description, and remediation recommendation.
2. **Given** a baseCommit parameter, **When** the security scan runs, **Then** it analyzes only the diff since that commit and reports issues found in the changed code.
3. **Given** no security issues are found, **When** the scan completes, **Then** the report returns a score of 100 with an empty issues list.

---

### User Story 2 - Automated Test Execution with Auto-Fix (Priority: P1)

A project owner triggers the tests health scan to run the full test suite, automatically fix failing tests where possible, and report the results. Successfully fixed tests are committed to the branch; unfixable failures are reported with detailed error information.

**Why this priority**: Passing tests are a prerequisite for code quality; auto-fix capability reduces manual intervention and accelerates the feedback loop.

**Independent Test**: Can be fully tested by running the tests scan against a project with known test failures (some fixable, some not) and verifying the JSON report accurately counts passed/failed/auto-fixed/non-fixable tests and that auto-fix commits appear on the branch.

**Acceptance Scenarios**:

1. **Given** a project with a test suite, **When** the tests scan runs, **Then** it detects the test command, executes all tests, and produces a JSON report with total, passed, failed, auto-fixed, and non-fixable counts.
2. **Given** a test failure with an obvious fix (e.g., missing import, wrong assertion value), **When** auto-fix is attempted, **Then** the fix is applied, the test is re-run to confirm it passes, and the fix is committed to the branch.
3. **Given** a test failure that cannot be automatically fixed, **When** auto-fix fails, **Then** the issue is reported as non-fixable with the test name, file, error message, and description of the attempted fix.
4. **Given** all tests pass on the first run, **When** the scan completes, **Then** the report shows a perfect score with zero failures and zero auto-fixes.

---

### User Story 3 - Compliance Verification Against Project Constitution (Priority: P2)

A project owner triggers a compliance scan to verify that the codebase adheres to the principles defined in the project's constitution. Each principle is evaluated independently with a pass/partial/fail status, and violations are reported with specific file and line references.

**Why this priority**: Compliance ensures code aligns with the project's governance rules; important for consistency but lower urgency than security or test failures.

**Independent Test**: Can be fully tested by running the compliance scan against a project with a known constitution and intentional violations, then verifying each principle's score and that violations reference the correct files and lines.

**Acceptance Scenarios**:

1. **Given** a project with a constitution.md file, **When** the compliance scan runs, **Then** it reads the constitution dynamically and evaluates the code against each declared principle, producing a JSON report with a global compliance score and per-principle scores (pass/partial/fail).
2. **Given** a baseCommit parameter, **When** the compliance scan runs, **Then** it analyzes only the diff and reports violations found in the changed code.
3. **Given** a project without a constitution.md file, **When** the compliance scan runs, **Then** it reports gracefully that no constitution was found and cannot evaluate compliance.
4. **Given** full compliance with all principles, **When** the scan completes, **Then** the report returns a score of 100 with all principles marked as "pass".

---

### User Story 4 - Specification Synchronization Check (Priority: P2)

A project owner triggers a spec-sync scan to verify that consolidated specifications in specs/specifications/ match the actual implementation. The scan identifies drift: features specified but missing/modified in code, code not covered by specs, and endpoints/models/behaviors that have diverged.

**Why this priority**: Spec-code synchronization prevents documentation rot and ensures specs remain a reliable source of truth for the planning workflow.

**Independent Test**: Can be fully tested by running the spec-sync scan against a project where specs intentionally differ from implementation and verifying the report identifies each drift with the correct spec name, drift description, and affected files.

**Acceptance Scenarios**:

1. **Given** a project with specs in specs/specifications/, **When** the spec-sync scan runs without a baseCommit, **Then** it compares every spec against the corresponding code and produces a JSON report with a synchronization score, per-spec status (synced/drifted), and drift details.
2. **Given** a baseCommit parameter, **When** the spec-sync scan runs, **Then** it identifies which specs are impacted by the diff and only evaluates those specs.
3. **Given** a spec that describes an endpoint not implemented in code, **When** the scan runs, **Then** the drift report identifies the missing implementation with the spec name and expected behavior.
4. **Given** all specs are synchronized with the code, **When** the scan completes, **Then** the report returns a perfect score with all specs marked as "synced".

---

### Edge Cases

- What happens when the target project has no test command detectable in package.json? → The tests scan reports an error issue indicating no test command was found.
- What happens when the baseCommit provided does not exist in the repository? → The scan falls back to a full repository scan and notes the fallback in the report.
- What happens when the target repository is empty or has no source files? → Each scan returns a score of 100 with zero issues and a summary noting no analyzable code was found.
- What happens when the constitution file references principles that have no corresponding code patterns? → The compliance scan marks those principles as "pass" (no violations detected) rather than "not applicable".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide 4 distinct health scan commands: health-security, health-compliance, health-tests, and health-spec-sync
- **FR-002**: All 4 commands MUST produce a valid, parsable JSON report with a common base structure: score (0-100), issues list, base commit reference, head commit reference, and issue counts by severity/category
- **FR-003**: health-security MUST analyze code for injection vulnerabilities (SQL, XSS, command), authentication/authorization flaws, exposed secrets, vulnerable dependencies, OWASP Top 10 coverage, input validation gaps, and error messages that leak sensitive information
- **FR-004**: health-security MUST support incremental scanning (diff from baseCommit) and full repository scanning
- **FR-005**: health-compliance MUST dynamically read the target project's constitution file (constitution.md or .ai-board/memory/constitution.md) and CLAUDE.md to evaluate code against declared principles
- **FR-006**: health-compliance MUST evaluate each principle independently with a pass/partial/fail score and list specific violations with file, line, and description
- **FR-007**: health-compliance MUST support incremental scanning (diff from baseCommit) and full repository scanning
- **FR-008**: health-tests MUST detect the project's test command from package.json or convention and execute the full test suite
- **FR-009**: health-tests MUST attempt automatic fixes for each failing test, re-run the test to verify the fix, and commit successful fixes to the branch
- **FR-010**: health-tests MUST report failed auto-fix attempts as non-fixable issues with the test name, file, error, and attempted fix description
- **FR-011**: health-tests MUST always run the complete test suite (no incremental mode)
- **FR-012**: health-spec-sync MUST compare consolidated specifications in specs/specifications/ against the actual codebase implementation
- **FR-013**: health-spec-sync MUST detect: features specified but absent/modified in code, code not covered by any spec, and endpoints/models/behaviors that have diverged from the spec
- **FR-014**: health-spec-sync MUST support incremental scanning (diff from baseCommit to identify impacted specs) and full analysis
- **FR-015**: Each issue reported by any command MUST include: severity or category, description, affected file(s) and line number(s), and an actionable remediation recommendation
- **FR-016**: The JSON output MUST be directly consumable by the health-scan workflow for status updates and remediation ticket creation

### Key Entities *(include if feature involves data)*

- **Health Report**: The structured JSON output from each scan command, containing a score, issue list, commit references, and summary counts. Each report is consumed by the health-scan workflow.
- **Issue**: An individual finding within a health report, characterized by severity/category, description, file location(s), line number(s), and a remediation recommendation.
- **Principle Evaluation** (compliance only): A per-principle assessment with status (pass/partial/fail) and associated violations.
- **Spec Status** (spec-sync only): A per-specification assessment with status (synced/drifted) and drift description when applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 4 commands produce valid JSON that the health-scan workflow can parse and process without errors in 100% of executions
- **SC-002**: The common output structure is consistent across all 4 commands — any consuming system can parse any report using the same base schema
- **SC-003**: Incremental scans (security, compliance, spec-sync) complete analysis of only the changed code when a baseCommit is provided, reducing scan scope proportionally to the diff size
- **SC-004**: health-tests successfully auto-fixes common test failures (e.g., import errors, assertion mismatches) and commits fixes to the branch without human intervention
- **SC-005**: health-compliance correctly identifies violations against dynamically-read constitution principles from any target project, not just the ai-board project itself
- **SC-006**: Every reported issue includes sufficient detail (file, line, description, recommendation) for a developer or AI agent to take corrective action without additional investigation
- **SC-007**: health-spec-sync correctly identifies specification drift in both directions: unimplemented specs and undocumented code
