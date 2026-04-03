# Contract: Extended Rollback Transitions

## POST /api/projects/:projectId/tickets/:id/transition (Extended)

The existing transition endpoint is extended to support additional rollback transitions. No new endpoint is created (per FR-012).

### New Valid Rollback Transitions

| targetStage | From Stage | Workflow Type | Conditions |
|-------------|-----------|---------------|------------|
| INBOX | SPECIFY | FULL | Last job FAILED/CANCELLED |
| SPECIFY | PLAN | FULL | Last job FAILED/CANCELLED |
| PLAN | BUILD | FULL | Last job FAILED/CANCELLED |
| BUILD | VERIFY | FULL | Last job FAILED/CANCELLED |

**Existing transitions (unchanged)**:
- INBOX from BUILD (QUICK workflow, FAILED/CANCELLED)
- PLAN from VERIFY (FULL workflow, COMPLETED/FAILED/CANCELLED)

### Transition Behaviors

#### SPECIFY → INBOX
```json
// Request
{ "targetStage": "INBOX" }

// Server actions:
// 1. Delete branch via GitHub API (if ticket.branch is not null)
// 2. Update ticket: stage=INBOX, branch=null, workflowType=FULL, version=1
// 3. Delete the failed/cancelled job

// Response: 200
{ "id": 123, "stage": "INBOX", "workflowType": "FULL", "branch": null, "version": 1 }
```

#### PLAN → SPECIFY
```json
// Request
{ "targetStage": "SPECIFY" }

// Server actions:
// 1. No git action (re-running specify will overwrite partial plan)
// 2. Update ticket: stage=SPECIFY, version=increment
// 3. Delete the failed/cancelled job

// Response: 200
{ "id": 123, "stage": "SPECIFY", "version": 3 }
```

#### BUILD → PLAN
```json
// Request
{ "targetStage": "PLAN" }

// Server actions:
// 1. Create rollback-reset job
// 2. Dispatch rollback-reset.yml workflow (with backup tag creation)
// 3. Update ticket: stage=PLAN, previewUrl=null, version=increment
// 4. Delete the failed/cancelled build job

// Response: 200
{ "id": 123, "stage": "PLAN", "version": 4, "resetJobId": 789 }
```

#### VERIFY → BUILD
```json
// Request
{ "targetStage": "BUILD" }

// Server actions:
// 1. No git action (re-running verify is the intent)
// 2. Update ticket: stage=BUILD, version=increment
// 3. Delete the failed/cancelled verify job

// Response: 200
{ "id": 123, "stage": "BUILD", "version": 5 }
```

### Error Responses

All rollback transitions share these error responses:

| Status | Condition |
|--------|-----------|
| 400 | Invalid transition (stage/target mismatch) |
| 400 | Active job in RUNNING/PENDING state |
| 400 | Workflow type mismatch |
| 403 | Not authorized (not owner/member) |
| 404 | Ticket not found |
