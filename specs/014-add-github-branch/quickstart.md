# Quickstart: GitHub Branch Tracking and Automation Flags

**Feature**: 014-add-github-branch
**Purpose**: Validate branch tracking and automation mode work end-to-end

## Prerequisites

- PostgreSQL database running (see DATABASE_URL in .env)
- Prisma migration applied: `npx prisma migrate dev`
- Next.js dev server running: `npm run dev`
- At least one Project exists in database

## Test Scenarios

### Scenario 1: Create Ticket with Default Values

**Objective**: Verify new tickets have branch=null and autoMode=false by default

```bash
# Create a test project (if needed)
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "Project for testing branch tracking",
    "githubOwner": "test-owner",
    "githubRepo": "test-repo"
  }'

# Note the project ID from response (e.g., id: 1)

# Create a ticket
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add branch tracking feature",
    "description": "Extend Ticket model with branch and autoMode fields",
    "projectId": 1
  }'
```

**Expected Response**:
```json
{
  "id": 123,
  "title": "Add branch tracking feature",
  "description": "Extend Ticket model with branch and autoMode fields",
  "stage": "INBOX",
  "version": 1,
  "projectId": 1,
  "branch": null,          ✓ Default: null (not set)
  "autoMode": false,        ✓ Default: false (manual mode)
  "createdAt": "2025-10-04T12:00:00Z",
  "updatedAt": "2025-10-04T12:00:00Z"
}
```

**Validation**:
- ✓ `branch` is `null` (not empty string)
- ✓ `autoMode` is `false`
- ✓ Response includes new fields alongside existing ones

---

### Scenario 2: Assign Branch via Workflow Script

**Objective**: Simulate `/specify` workflow assigning branch name to ticket

```bash
# Workflow script would call this after creating Git branch
curl -X PATCH http://localhost:3000/api/tickets/123/branch \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "014-add-github-branch"
  }'
```

**Expected Response**:
```json
{
  "id": 123,
  "branch": "014-add-github-branch",  ✓ Branch assigned
  "updatedAt": "2025-10-04T12:05:00Z"
}
```

**Validation**:
- ✓ Branch name successfully stored
- ✓ updatedAt timestamp updated
- ✓ Response contains only relevant fields (id, branch, updatedAt)

**Verify Persistence**:
```bash
# Query ticket to confirm branch persisted
curl http://localhost:3000/api/tickets/123
```

**Expected**:
```json
{
  "id": 123,
  "title": "Add branch tracking feature",
  "branch": "014-add-github-branch",  ✓ Persisted
  "autoMode": false,
  ...
}
```

---

### Scenario 3: Enable Automation Mode

**Objective**: User enables automation for ticket

```bash
# Update ticket to enable autoMode
curl -X PATCH http://localhost:3000/api/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{
    "autoMode": true
  }'
```

**Expected Response**:
```json
{
  "id": 123,
  "title": "Add branch tracking feature",
  "branch": "014-add-github-branch",
  "autoMode": true,         ✓ AutoMode enabled
  "updatedAt": "2025-10-04T12:10:00Z",
  ...
}
```

**Validation**:
- ✓ `autoMode` changed from `false` to `true`
- ✓ `branch` unchanged (still "014-add-github-branch")
- ✓ Other fields unchanged

---

### Scenario 4: Update Multiple Fields Atomically

**Objective**: Verify general PATCH endpoint handles multiple fields including new ones

```bash
# Update title, stage, and branch in single request
curl -X PATCH http://localhost:3000/api/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated: GitHub Integration",
    "stage": "SPECIFY",
    "branch": "014-github-integration-updated"
  }'
```

**Expected Response**:
```json
{
  "id": 123,
  "title": "Updated: GitHub Integration",    ✓ Title updated
  "stage": "SPECIFY",                        ✓ Stage updated
  "branch": "014-github-integration-updated", ✓ Branch updated
  "autoMode": true,                          ✓ AutoMode unchanged
  "updatedAt": "2025-10-04T12:15:00Z",
  ...
}
```

**Validation**:
- ✓ Multiple fields updated atomically
- ✓ Unchanged fields preserved (autoMode still true)
- ✓ Single database transaction

---

### Scenario 5: Clear Branch Assignment

**Objective**: Set branch back to null (clear assignment)

```bash
# Clear branch via specialized endpoint
curl -X PATCH http://localhost:3000/api/tickets/123/branch \
  -H "Content-Type: application/json" \
  -d '{
    "branch": null
  }'
```

**Expected Response**:
```json
{
  "id": 123,
  "branch": null,           ✓ Branch cleared
  "updatedAt": "2025-10-04T12:20:00Z"
}
```

**Validation**:
- ✓ Branch set to `null` (not empty string)
- ✓ Ticket reverts to "no branch assigned" state

---

### Scenario 6: Validation - Branch Too Long

**Objective**: Verify max length validation (200 chars)

```bash
# Attempt to set branch name longer than 200 characters
curl -X PATCH http://localhost:3000/api/tickets/123/branch \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "'"$(python3 -c "print('a' * 201)")"'"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "branch",
      "message": "String must contain at most 200 character(s)"
    }
  ]
}
```

**Validation**:
- ✓ Request rejected with 400 status
- ✓ Error message clearly indicates validation failure
- ✓ Branch not updated in database

---

### Scenario 7: Validation - Invalid AutoMode Type

**Objective**: Verify autoMode only accepts boolean

```bash
# Attempt to set autoMode to non-boolean value
curl -X PATCH http://localhost:3000/api/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{
    "autoMode": "yes"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "autoMode",
      "message": "Expected boolean, received string"
    }
  ]
}
```

**Validation**:
- ✓ Request rejected with 400 status
- ✓ Type validation works correctly
- ✓ AutoMode not updated with invalid value

---

### Scenario 8: Query Tickets by Branch Status

**Objective**: Filter tickets with/without branches assigned

```bash
# Query all tickets (will implement filtering later)
curl http://localhost:3000/api/tickets

# Verify response includes branch and autoMode fields
```

**Expected Response** (array):
```json
[
  {
    "id": 123,
    "title": "Updated: GitHub Integration",
    "branch": null,
    "autoMode": true,
    ...
  },
  {
    "id": 124,
    "title": "Another ticket",
    "branch": "124-another-feature",
    "autoMode": false,
    ...
  }
]
```

**Validation**:
- ✓ All tickets include branch and autoMode fields
- ✓ Null branches rendered correctly (not omitted)
- ✓ Boolean autoMode values correct

---

## Integration with /specify Workflow

**Real-World Usage**:

```bash
# 1. User creates ticket via UI (or API)
# Result: branch=null, autoMode=false

# 2. User runs: /specify "Add GitHub tracking"
# Workflow script (create-new-feature.sh) does:
#   - Creates Git branch: 014-add-github-tracking
#   - Initializes spec.md
#   - Calls API to update ticket:

curl -X PATCH http://localhost:3000/api/tickets/123/branch \
  -H "Content-Type: application/json" \
  -d '{"branch": "014-add-github-tracking"}'

# 3. (Optional) Enable automation if user wants hands-free workflow
curl -X PATCH http://localhost:3000/api/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{"autoMode": true}'

# 4. Automation scripts check autoMode before advancing stages
# Example script pseudocode:
# if (ticket.autoMode && specifyCommandSucceeded) {
#   updateTicket({ stage: 'SPECIFY' })
# }
```

---

## Success Criteria

All scenarios above must pass with expected responses:

- [x] **Scenario 1**: Ticket created with default values
- [x] **Scenario 2**: Branch assigned via specialized endpoint
- [x] **Scenario 3**: AutoMode toggled successfully
- [x] **Scenario 4**: Multiple fields updated atomically
- [x] **Scenario 5**: Branch cleared (set to null)
- [x] **Scenario 6**: Validation rejects branch too long
- [x] **Scenario 7**: Validation rejects invalid autoMode type
- [x] **Scenario 8**: Query returns tickets with new fields

---

## Cleanup

```bash
# Delete test ticket
curl -X DELETE http://localhost:3000/api/tickets/123

# Or reset database
npx prisma migrate reset --skip-seed
```

---

## Troubleshooting

**Issue**: Migration not applied
```bash
# Solution: Run migration
npx prisma migrate dev --name add_branch_tracking
npx prisma generate
```

**Issue**: Validation errors not working
```bash
# Solution: Verify Zod schemas in lib/validations/ticket.ts
# Ensure schemas match contracts/tickets-api.yml
```

**Issue**: Old Prisma client types
```bash
# Solution: Regenerate Prisma client
npx prisma generate
# Restart TypeScript server in IDE
```

**Issue**: 404 on /api/tickets/:id/branch
```bash
# Solution: Verify file exists at app/api/tickets/[id]/branch/route.ts
# Check Next.js dev server logs for routing errors
```

---

## Next Steps

After quickstart validation passes:
1. Run full Playwright E2E test suite: `npm run test:e2e`
2. Verify UI displays branch and autoMode (future task)
3. Integrate with actual /specify workflow scripts
4. Deploy to staging environment
5. Monitor API performance (<200ms response time goal)
