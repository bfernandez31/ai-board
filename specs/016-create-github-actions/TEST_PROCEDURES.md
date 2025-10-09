# Test Procedures Reference

This document references the test procedures defined in quickstart.md for TDD implementation.

**Important**: All Claude commands are executed with `--dangerously-skip-permissions` flag to enable non-interactive execution in GitHub Actions CI/CD environment.

## Phase 3.2: Tests First (TDD)

### T003: Test 1 - Specify Command Test Procedure
**Reference**: quickstart.md lines 28-63
**Status**: Documented ✓
**Description**: Create a new feature specification
**Expected Initial State**: Workflow fails (no implementation yet)
**Test Data**:
- ticket_id: `TEST-001`
- ticketTitle: `Test Authentication Feature`
- ticketDescription: `Add user authentication with email and password...`
- branch: (empty)
- command: `specify`

### T004: Test 2 - Plan Command Test Procedure
**Reference**: quickstart.md lines 67-102
**Status**: Documented ✓
**Description**: Generate implementation plan for existing specification
**Prerequisites**: Test 1 branch exists
**Expected Initial State**: Workflow fails (command not implemented)
**Test Data**:
- ticket_id: `TEST-001`
- branch: `TEST-001-test-authentication`
- command: `plan`

### T005: Test 3 - Task Command Test Procedure
**Reference**: quickstart.md lines 104-122
**Status**: Documented ✓
**Description**: Generate tasks from implementation plan
**Prerequisites**: Test 2 planning artifacts exist
**Expected Initial State**: Workflow fails (command not implemented)
**Test Data**:
- ticket_id: `TEST-001`
- branch: `TEST-001-test-authentication`
- command: `task`

### T006: Test 4 - Implement Command Test Procedure
**Reference**: quickstart.md lines 124-145
**Status**: Documented ✓
**Description**: Execute implementation tasks
**Prerequisites**: Test 3 tasks.md exists
**Expected Initial State**: Workflow fails (command not implemented)
**Test Data**:
- ticket_id: `TEST-001`
- branch: `TEST-001-test-authentication`
- command: `implement`

### T007: Test 5 - Clarify Command Test Procedure
**Reference**: quickstart.md lines 147-177
**Status**: Documented ✓
**Description**: Update specification with clarifications
**Prerequisites**: Specification with clarification needs
**Expected Initial State**: Workflow fails (command not implemented)
**Test Data**:
- ticket_id: `TEST-001`
- branch: `TEST-001-test-authentication`
- command: `clarify`
- answers_json:
```json
{
  "auth_method": "email/password with bcrypt hashing",
  "session_duration": "7 days",
  "password_requirements": "min 8 chars, 1 uppercase, 1 number"
}
```

### T008: Test 6 - Missing Branch Error Test
**Reference**: quickstart.md lines 183-195
**Status**: Documented ✓
**Description**: Verify error handling when branch not provided for non-specify command
**Expected Initial State**: Error handling not yet implemented
**Test Data**:
- command: `plan`
- branch: (empty)
**Expected Result**: Workflow fails with clear error message

### T009: Test 7 - Invalid API Key Error Test
**Reference**: quickstart.md lines 197-213
**Status**: Documented ✓
**Description**: Verify error handling for missing/invalid ANTHROPIC_API_KEY
**Expected Initial State**: Error handling not yet implemented
**Test Data**: Any command with ANTHROPIC_API_KEY secret removed
**Expected Result**: Authentication error, secret not exposed in logs

### T010: Test 8 - No Changes Scenario Test
**Reference**: quickstart.md lines 215-235
**Status**: Documented ✓
**Description**: Verify workflow handles re-running same command without changes
**Expected Initial State**: Git logic not yet implemented
**Test Data**: Run `plan` command twice on same branch
**Expected Result**: Success with "No changes to commit" message, no empty commit

### T011: Test 9 - Git Push Conflict Error Test
**Reference**: quickstart.md lines 237-252
**Status**: Documented ✓
**Description**: Verify error handling for diverged branches
**Expected Initial State**: Error handling not yet implemented
**Test Data**: Locally modify and push to branch, then trigger workflow
**Expected Result**: Workflow fails during push step with conflict error

---

## TDD Approach

All test procedures are fully documented in quickstart.md. The workflow implementation (Phase 3.3) should:

1. ✅ Implement workflow structure (T012-T019)
2. ✅ Add environment setup (T020-T025)
3. ✅ Implement command execution (T026-T031)
4. ✅ Add git operations (T032-T036)
5. ✅ Add status reporting (T037-T039)
6. ✅ Verify security requirements (T040-T042)

After implementation, execute all test procedures from quickstart.md to verify functionality.

---

**Status**: All test procedures documented. Ready for Phase 3.3 (Core Implementation).
