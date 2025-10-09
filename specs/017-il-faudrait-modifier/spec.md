# Feature Specification: E2E Test Data Isolation with [e2e] Prefixes

**Feature Branch**: `017-il-faudrait-modifier`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "il faudrait modifier les tests pour que chaque ticket genere par les tests ai un titre qui commence par [e2e]. tous les anciens tests doit fonctionner. il ne faut plus supprimer toute la base lors des tests mais plutot supprimer les tickets qui ont [e2e] parei lpour la creation de projet, fait un projet qui a un nom avec [e2e] et applique la meme mecanique de netoyage. le but c'est de conserver ce aui n'est pas fait par les tests. et de ne pas polluer les données par ceux des tests."

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature clearly specified: modify E2E tests for selective data cleanup
2. Extract key concepts from description
   → Actors: E2E test suite, test data, production/manual data
   → Actions: prefix test data, selective cleanup, preserve non-test data
   → Data: tickets with [e2e] prefix, projects with [e2e] prefix
   → Constraints: all existing tests must continue working, no database-wide cleanup
3. For each unclear aspect:
   → All aspects clearly defined
4. Fill User Scenarios & Testing section
   → Clear test isolation workflow defined
5. Generate Functional Requirements
   → All requirements testable
6. Identify Key Entities
   → Tickets and Projects entities involved
7. Run Review Checklist
   → No implementation details, all requirements clear
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a developer running E2E tests, I need test data to be isolated from real application data so that:
- Tests can run safely without destroying manual or production data
- Test data is automatically cleaned up without manual intervention
- Real data persists across test runs without pollution from test artifacts

### Acceptance Scenarios
1. **Given** an E2E test creates a ticket, **When** the ticket is created, **Then** the ticket title MUST start with `[e2e]`
2. **Given** an E2E test creates a project, **When** the project is created, **Then** the project name MUST start with `[e2e]`
3. **Given** tickets and projects exist with `[e2e]` prefix, **When** test cleanup runs, **Then** ONLY entities with `[e2e]` prefix are deleted
4. **Given** tickets and projects exist WITHOUT `[e2e]` prefix, **When** test cleanup runs, **Then** these entities MUST be preserved
5. **Given** all existing E2E tests, **When** tests are run with new prefix system, **Then** all tests MUST pass without modification to test logic (only setup/teardown changes)
6. **Given** manual data exists in database, **When** E2E tests run, **Then** manual data MUST remain unchanged after test completion

### Edge Cases
- What happens when a test fails mid-execution and cleanup doesn't run normally?
- How does the system handle concurrent test runs with the same `[e2e]` prefix?
- What happens if someone manually creates data with `[e2e]` prefix outside of tests?
- How are orphaned test entities handled if cleanup fails?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: E2E tests MUST prefix all created ticket titles with `[e2e]`
- **FR-002**: E2E tests MUST prefix all created project names with `[e2e]`
- **FR-003**: Test cleanup mechanism MUST delete ONLY tickets with `[e2e]` prefix in their title
- **FR-004**: Test cleanup mechanism MUST delete ONLY projects with `[e2e]` prefix in their name
- **FR-005**: Test cleanup mechanism MUST NOT perform database-wide deletion operations
- **FR-006**: System MUST preserve all tickets without `[e2e]` prefix during test cleanup
- **FR-007**: System MUST preserve all projects without `[e2e]` prefix during test cleanup
- **FR-008**: All existing E2E tests MUST continue to pass with the new prefix system
- **FR-009**: Test cleanup MUST run before test execution to ensure clean starting state
- **FR-010**: Test cleanup MUST run after test execution to prevent test data pollution
- **FR-011**: The `[e2e]` prefix format MUST be consistent across all test-generated entities

### Key Entities
- **Ticket**: Test-generated tickets identified by `[e2e]` prefix in title attribute; subject to selective cleanup
- **Project**: Test-generated projects identified by `[e2e]` prefix in name attribute; subject to selective cleanup

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (none found)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
