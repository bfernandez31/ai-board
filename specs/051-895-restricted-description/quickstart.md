# Quickstart: Stage-Based Ticket Editing Restrictions

**Feature**: Restricted Ticket Editing by Stage
**Date**: 2025-10-24
**Complexity**: Low (no schema changes, extends existing patterns)

## 5-Minute Overview

### What This Feature Does

Prevents users from editing ticket description and clarification policy fields after tickets leave the INBOX stage. This ensures specification stability during active development while allowing free editing during initial requirements gathering.

**User-Facing Behavior**:
- **INBOX stage**: Description field is editable, policy edit button is visible
- **All other stages** (SPECIFY, PLAN, BUILD, VERIFY, SHIP): Description is read-only text, policy button is hidden
- **Stage rollback**: If ticket returns to INBOX, editing is re-enabled

### Key Files to Modify

1. **Server-side validation** (highest priority):
   - `/app/api/projects/[projectId]/tickets/[id]/route.ts` - Add stage validation before update

2. **Client-side UI**:
   - `/components/board/ticket-detail-modal.tsx` - Conditional rendering for description field
   - `/components/tickets/policy-edit-dialog.tsx` - Hide policy button in non-INBOX stages

3. **Validation utility**:
   - `/app/lib/utils/stage-validation.ts` (new file) - Pure function for stage check

4. **Tests**:
   - `/tests/unit/stage-validation.test.ts` (new) - Vitest unit tests
   - `/tests/integration/ticket-editing.spec.ts` (new) - Playwright UI tests
   - `/tests/e2e/stage-based-restrictions.spec.ts` (new) - Playwright E2E tests

## Implementation Checklist

### Phase 1: Server-Side Validation (30 minutes)

- [ ] Create `/app/lib/utils/stage-validation.ts` with `canEditDescriptionAndPolicy(stage: Stage)` function
- [ ] Write Vitest unit tests in `/tests/unit/stage-validation.test.ts` (RED phase)
- [ ] Implement function to pass tests (GREEN phase)
- [ ] Add validation to PATCH handler in `/app/api/projects/[projectId]/tickets/[id]/route.ts`:
  ```typescript
  // After version check, before Prisma update
  if ((description !== undefined || clarificationPolicy !== undefined)
      && currentTicket.stage !== 'INBOX') {
    return NextResponse.json(
      { error: 'Description and clarification policy can only be updated in INBOX stage',
        code: 'INVALID_STAGE_FOR_EDIT' },
      { status: 400 }
    );
  }
  ```
- [ ] Test API manually with curl/Postman: attempt description update in SPECIFY stage → verify 400 error

### Phase 2: Client-Side UI (45 minutes)

- [ ] Find existing ticket detail modal component (search for `TicketDetailModal` or similar)
- [ ] Add stage check: `const isInboxStage = ticket.stage === 'INBOX';`
- [ ] Replace editable Textarea with conditional rendering:
  ```tsx
  {isInboxStage ? (
    <Textarea value={description} onChange={handleChange} />
  ) : (
    <div className="text-sm text-zinc-400">{description}</div>
  )}
  ```
- [ ] Find policy edit button component (search for `PolicyEditDialog` or `Settings` icon)
- [ ] Wrap policy button in conditional: `{isInboxStage && <PolicyEditButton />}`
- [ ] Write Playwright integration tests in `/tests/integration/ticket-editing.spec.ts` (RED phase)
- [ ] Verify UI updates (GREEN phase)
- [ ] Test manually in browser: create INBOX ticket, edit description, transition to SPECIFY, verify read-only

### Phase 3: E2E Validation (30 minutes)

- [ ] Write Playwright E2E tests in `/tests/e2e/stage-based-restrictions.spec.ts`:
  - Test 1: Edit description in INBOX → success
  - Test 2: Transition to SPECIFY → attempt edit via UI → verify disabled
  - Test 3: Transition back to INBOX → verify editing re-enabled
- [ ] Run full test suite: `bun test` (must pass all tests)
- [ ] Fix any failures (refactor while keeping tests green)

### Phase 4: Edge Cases (15 minutes)

- [ ] Test concurrent edit scenario: User A editing INBOX, User B transitions to SPECIFY → User A save fails with 400
- [ ] Test stage rollback: SPECIFY → INBOX → verify UI updates to editable
- [ ] Test real-time polling: Open ticket in two browsers, transition in one, verify other updates within 2 seconds

## Quick Testing Commands

```bash
# Unit tests (fast feedback, ~1ms per test)
bun run test:unit tests/unit/stage-validation.test.ts

# Integration tests (component behavior, ~500ms per test)
bun run test:e2e tests/integration/ticket-editing.spec.ts

# E2E tests (full workflow, ~2s per test)
bun run test:e2e tests/e2e/stage-based-restrictions.spec.ts

# All tests
bun test
```

## Manual Testing Checklist

### Happy Path
- [ ] Create ticket in INBOX
- [ ] Edit description → save → verify success
- [ ] Edit policy → save → verify success
- [ ] Transition to SPECIFY
- [ ] Verify description is read-only text (not Textarea)
- [ ] Verify policy button is hidden
- [ ] Attempt to edit via API (curl) → verify 400 error

### Edge Cases
- [ ] Transition from SPECIFY back to INBOX → verify editing re-enabled
- [ ] Open ticket in two browsers → transition in one → verify other updates within 2s
- [ ] Concurrent edit: User A editing, User B transitions → verify User A gets 400 error and rollback
- [ ] Edit title in non-INBOX stage → verify success (title NOT restricted)

### Error Scenarios
- [ ] Version conflict (two users editing simultaneously) → verify 409 error takes precedence
- [ ] Invalid stage enum in API request → verify 400 validation error
- [ ] Unauthenticated request → verify 401 error
- [ ] Wrong project ID → verify 403 error

## Common Pitfalls

### Pitfall 1: Client-Side Validation Only
**Problem**: Implementing conditional rendering without server-side validation
**Risk**: Security vulnerability - API can be bypassed with direct HTTP requests
**Solution**: ALWAYS implement server-side validation first (Phase 1), then client-side UI (Phase 2)

### Pitfall 2: Forgetting Stage Rollback
**Problem**: Not testing SPECIFY → INBOX transition
**Risk**: Users can't re-enable editing after returning to INBOX
**Solution**: Test stage rollback scenario in E2E tests (Phase 3, Test 3)

### Pitfall 3: Breaking Title Edits
**Problem**: Accidentally restricting title field (out of scope)
**Risk**: Users can't edit titles in non-INBOX stages (breaking existing functionality)
**Solution**: Only validate description and clarificationPolicy fields, not title

### Pitfall 4: Ignoring Version Conflicts
**Problem**: Stage validation error overrides version conflict error
**Risk**: User sees wrong error message, unclear why save failed
**Solution**: Check version BEFORE checking stage (existing code order is correct)

### Pitfall 5: Creating Duplicate Test Files
**Problem**: Creating new test files without searching for existing ones
**Risk**: Duplicate test coverage, inconsistent test patterns
**Solution**: ALWAYS search first: `npx grep -r "ticket.*edit" tests/` before creating new test files

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interaction                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ticket Detail Modal UI                        │
│  - Conditional Rendering: isInboxStage ? Textarea : ReadOnly    │
│  - Policy Button: {isInboxStage && <Button />}                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│            TanStack Query Mutation (useUpdateTicket)             │
│  - Optimistic Update: Apply changes to cache immediately         │
│  - onError: Rollback cache on 400/409 errors                    │
│  - onSuccess: Invalidate queries, refetch latest data            │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│         API Route: PATCH /api/projects/[id]/tickets/[id]         │
│  1. Authentication (verifyProjectOwnership)                      │
│  2. Parse request body (Zod validation)                          │
│  3. Fetch current ticket (with version)                          │
│  4. Check version conflict (409 if mismatch)                     │
│  5. ★ NEW: Check stage validation (400 if not INBOX)            │
│  6. Execute Prisma update (atomic transaction)                   │
│  7. Return updated ticket                                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                         │
│  - No schema changes required                                    │
│  - Uses existing fields: stage, description, clarificationPolicy │
│  - Version field for optimistic concurrency control              │
└─────────────────────────────────────────────────────────────────┘
```

## Success Criteria

**Feature is complete when**:
1. ✅ All unit tests pass (`bun run test:unit`)
2. ✅ All integration tests pass (`bun run test:e2e tests/integration/`)
3. ✅ All E2E tests pass (`bun run test:e2e tests/e2e/`)
4. ✅ Manual testing checklist completed
5. ✅ API returns 400 error for description/policy updates in non-INBOX stages
6. ✅ UI correctly shows read-only description and hides policy button in non-INBOX stages
7. ✅ Real-time polling updates UI when stage changes (within 2 seconds)
8. ✅ Optimistic updates work correctly with rollback on 400 errors

## Estimated Timeline

**Total**: 2 hours (Red-Green-Refactor cycle)
- Phase 1 (Server-side): 30 minutes
- Phase 2 (Client-side): 45 minutes
- Phase 3 (E2E tests): 30 minutes
- Phase 4 (Edge cases): 15 minutes

**Complexity**: Low (no database migrations, extends existing patterns)

## Reference Documentation

- **Spec**: `/specs/051-895-restricted-description/spec.md`
- **Plan**: `/specs/051-895-restricted-description/plan.md`
- **Research**: `/specs/051-895-restricted-description/research.md`
- **Data Model**: `/specs/051-895-restricted-description/data-model.md`
- **API Contract**: `/specs/051-895-restricted-description/contracts/api.md`
- **Constitution**: `.specify/memory/constitution.md` (Principles I-VI)

## Next Steps After Implementation

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Execute `/speckit.implement` to start implementation with Claude
3. Create pull request with generated documentation
4. Deploy to staging environment
5. Verify with product team before merging to main
