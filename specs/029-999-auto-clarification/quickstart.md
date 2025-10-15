# Quickstart Guide: Auto-Clarification Resolution System

**Feature**: 029-999-auto-clarification
**Date**: 2025-01-14
**For**: Developers implementing the feature

## Overview

This guide provides step-by-step instructions for implementing the auto-clarification resolution system. Follow the phases in order to ensure proper integration across all layers.

## Prerequisites

- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ running locally or accessible
- Prisma CLI installed (`npm install -g prisma`)
- Claude Code access (for /specify command testing)
- GitHub repository access (for workflow integration)

## Implementation Phases

### Phase 1: Database Schema (0.5 day)

**Goal**: Add `ClarificationPolicy` enum and schema fields

**Steps**:

1. **Update Prisma schema** (`prisma/schema.prisma`):
   ```prisma
   enum ClarificationPolicy {
     AUTO
     CONSERVATIVE
     PRAGMATIC
     INTERACTIVE
   }

   model Project {
     // ... existing fields
     clarificationPolicy ClarificationPolicy @default(AUTO) @map("clarification_policy")
   }

   model Ticket {
     // ... existing fields
     clarificationPolicy ClarificationPolicy? @map("clarification_policy")
   }
   ```

2. **Generate migration**:
   ```bash
   npx prisma migrate dev --name add_clarification_policy
   ```

3. **Verify migration**:
   ```bash
   # Check database
   psql ai_board_dev -c "SELECT * FROM projects LIMIT 1;"
   # Verify clarification_policy column exists with 'AUTO' default

   psql ai_board_dev -c "SELECT * FROM tickets LIMIT 1;"
   # Verify clarification_policy column exists (nullable)
   ```

4. **Test rollback** (optional):
   ```bash
   npx prisma migrate reset
   npx prisma migrate dev
   ```

**Validation**:
- [ ] `ClarificationPolicy` enum created in database
- [ ] `projects.clarification_policy` exists (NOT NULL, default AUTO)
- [ ] `tickets.clarification_policy` exists (NULLABLE)
- [ ] Existing projects have AUTO value
- [ ] Existing tickets have null value
- [ ] TypeScript types regenerated (`@prisma/client` includes enum)

---

### Phase 2: Backend API (1 day)

**Goal**: Expose policy fields via REST API with Zod validation

**Steps**:

1. **Create Zod schemas** (`app/lib/schemas/clarification-policy.ts`):
   ```typescript
   import { z } from 'zod';
   import { ClarificationPolicy } from '@prisma/client';

   export const projectUpdateSchema = z.object({
     clarificationPolicy: z.nativeEnum(ClarificationPolicy).optional(),
   }).partial();

   export const ticketUpdateSchema = z.object({
     clarificationPolicy: z.nativeEnum(ClarificationPolicy).nullable().optional(),
     version: z.number().int().optional(),
   }).partial();
   ```

2. **Update GET `/api/projects/[id]/route.ts`**:
   ```typescript
   // Ensure response includes clarificationPolicy
   const project = await prisma.project.findUnique({
     where: { id: parseInt(params.id) },
     select: {
       id: true,
       name: true,
       clarificationPolicy: true, // ← Add this
       // ... other fields
     },
   });
   ```

3. **Update PATCH `/api/projects/[id]/route.ts`**:
   ```typescript
   import { projectUpdateSchema } from '@/app/lib/schemas/clarification-policy';

   export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
     try {
       const body = await request.json();
       const validated = projectUpdateSchema.parse(body);

       const updated = await prisma.project.update({
         where: { id: parseInt(params.id) },
         data: validated,
       });

       return NextResponse.json(updated);
     } catch (error) {
       if (error instanceof z.ZodError) {
         return NextResponse.json(
           { error: 'Validation failed', details: error.errors },
           { status: 400 }
         );
       }
       // ... other error handling
     }
   }
   ```

4. **Update GET `/api/projects/[projectId]/tickets/[ticketId]/route.ts`**:
   ```typescript
   // Include nested project for effective policy resolution
   const ticket = await prisma.ticket.findUnique({
     where: { id: parseInt(params.ticketId) },
     include: {
       project: {
         select: {
           id: true,
           name: true,
           clarificationPolicy: true, // ← Add this
         },
       },
     },
   });
   ```

5. **Update PATCH `/api/projects/[projectId]/tickets/[ticketId]/route.ts`**:
   ```typescript
   import { ticketUpdateSchema } from '@/app/lib/schemas/clarification-policy';

   export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; ticketId: string } }) {
     try {
       const body = await request.json();
       const validated = ticketUpdateSchema.parse(body);

       const updated = await prisma.ticket.update({
         where: { id: parseInt(params.ticketId) },
         data: validated,
       });

       return NextResponse.json(updated);
     } catch (error) {
       if (error instanceof z.ZodError) {
         return NextResponse.json(
           { error: 'Validation failed', details: error.errors },
           { status: 400 }
         );
       }
       // ... other error handling
     }
   }
   ```

6. **Write integration tests** (`tests/api/clarification-policy-api.spec.ts`):
   ```typescript
   test('GET /api/projects/:id returns clarificationPolicy', async ({ request }) => {
     const response = await request.get(`/api/projects/1`);
     const project = await response.json();
     expect(project.clarificationPolicy).toBe('AUTO');
   });

   test('PATCH /api/projects/:id updates clarificationPolicy', async ({ request }) => {
     const response = await request.patch(`/api/projects/1`, {
       data: { clarificationPolicy: 'CONSERVATIVE' },
     });
     const project = await response.json();
     expect(project.clarificationPolicy).toBe('CONSERVATIVE');
   });

   test('PATCH /api/tickets/:id accepts null clarificationPolicy', async ({ request }) => {
     const response = await request.patch(`/api/projects/1/tickets/1`, {
       data: { clarificationPolicy: null, version: 1 },
     });
     const ticket = await response.json();
     expect(ticket.clarificationPolicy).toBeNull();
   });
   ```

**Validation**:
- [ ] GET project returns `clarificationPolicy` field
- [ ] PATCH project accepts enum values (AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE)
- [ ] PATCH project rejects invalid values (400 error with Zod details)
- [ ] GET ticket includes nested `project.clarificationPolicy`
- [ ] PATCH ticket accepts enum values OR null
- [ ] PATCH ticket rejects invalid values (400 error)
- [ ] Integration tests pass (100% API coverage)

---

### Phase 3: Frontend UI (1.5 days)

**Goal**: Add policy configuration UI across project settings, ticket forms, and board view

**Steps**:

1. **Create utility functions** (`app/lib/utils/policy-icons.ts`):
   ```typescript
   import { ClarificationPolicy } from '@prisma/client';

   export function getPolicyIcon(policy: ClarificationPolicy): string {
     const icons: Record<ClarificationPolicy, string> = {
       [ClarificationPolicy.AUTO]: '🤖',
       [ClarificationPolicy.CONSERVATIVE]: '🛡️',
       [ClarificationPolicy.PRAGMATIC]: '⚡',
       [ClarificationPolicy.INTERACTIVE]: '💬',
     };
     return icons[policy];
   }

   export function getPolicyLabel(policy: ClarificationPolicy): string {
     return policy; // or customize labels
   }
   ```

2. **Create policy resolution utility** (`app/lib/utils/policy-resolution.ts`):
   ```typescript
   import { ClarificationPolicy, Ticket, Project } from '@prisma/client';

   type TicketWithProject = Ticket & { project: Project };

   export function resolveEffectivePolicy(ticket: TicketWithProject): ClarificationPolicy {
     return ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;
   }
   ```

3. **Project settings card** (`components/settings/clarification-policy-card.tsx`):
   ```typescript
   'use client';

   import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
   import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
   import { ClarificationPolicy } from '@prisma/client';
   import { getPolicyIcon } from '@/app/lib/utils/policy-icons';

   export function ClarificationPolicyCard({ project }: { project: Project }) {
     async function handlePolicyChange(newPolicy: ClarificationPolicy) {
       await fetch(`/api/projects/${project.id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ clarificationPolicy: newPolicy }),
       });
       // Revalidate or refetch
     }

     return (
       <Card>
         <CardHeader>
           <CardTitle>Default Clarification Policy</CardTitle>
           <CardDescription>
             Applied to all new tickets unless overridden at ticket level
           </CardDescription>
         </CardHeader>
         <CardContent>
           <Select value={project.clarificationPolicy} onValueChange={handlePolicyChange}>
             <SelectTrigger>
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="AUTO">
                 {getPolicyIcon(ClarificationPolicy.AUTO)} AUTO - Context-aware
               </SelectItem>
               <SelectItem value="CONSERVATIVE">
                 {getPolicyIcon(ClarificationPolicy.CONSERVATIVE)} CONSERVATIVE - Security first
               </SelectItem>
               <SelectItem value="PRAGMATIC">
                 {getPolicyIcon(ClarificationPolicy.PRAGMATIC)} PRAGMATIC - Speed first
               </SelectItem>
             </SelectContent>
           </Select>
         </CardContent>
       </Card>
     );
   }
   ```

4. **Ticket creation modal enhancement** (`components/tickets/create-ticket-modal.tsx`):
   - Add optional policy select field
   - Include "Use project default" option (value: "")
   - Pass policy to API on submit

5. **Ticket detail view enhancement** (`components/tickets/ticket-detail-view.tsx`):
   - Display policy badge (override vs default styling)
   - Add "Edit Policy" dialog
   - Implement reset to null functionality

6. **Board view badge** (`components/board/ticket-card.tsx`):
   ```typescript
   {ticket.clarificationPolicy && (
     <Badge className="absolute top-2 right-2" size="sm">
       <Tooltip content={ticket.clarificationPolicy}>
         {getPolicyIcon(ticket.clarificationPolicy)}
       </Tooltip>
     </Badge>
   )}
   ```

7. **Write E2E tests** (`tests/e2e/clarification-policy.spec.ts`):
   ```typescript
   test('user can set project default policy', async ({ page }) => {
     await page.goto('/projects/1/settings');
     await page.getByLabel('Default Clarification Policy').selectOption('CONSERVATIVE');
     await expect(page.getByText('CONSERVATIVE')).toBeVisible();
   });

   test('user can override ticket policy', async ({ page }) => {
     await page.goto('/projects/1/tickets/1');
     await page.getByRole('button', { name: 'Edit Policy' }).click();
     await page.getByLabel('Clarification Policy').selectOption('CONSERVATIVE');
     await page.getByRole('button', { name: 'Save' }).click();
     await expect(page.getByText('🛡️')).toBeVisible();
   });
   ```

**Validation**:
- [ ] Project settings display policy select
- [ ] Project settings update persists to database
- [ ] Ticket creation modal includes optional policy field
- [ ] Ticket detail view shows policy badge
- [ ] Ticket detail view allows policy editing
- [ ] Board view shows badge for overrides only
- [ ] E2E tests pass (100% UI flow coverage)

---

### Phase 4: GitHub Actions Workflow (1 day)

**Goal**: Fetch effective policy and pass to /specify command

**Steps**:

1. **Update workflow** (`.github/workflows/ticket-workflow.yml`):
   ```yaml
   - name: Get effective clarification policy
     id: get_policy
     run: |
       # Fetch ticket with nested project
       TICKET_DATA=$(curl -s "${{ secrets.API_URL }}/api/projects/${{ env.PROJECT_ID }}/tickets/${{ env.TICKET_ID }}")

       # Extract policies using jq
       TICKET_POLICY=$(echo "$TICKET_DATA" | jq -r '.clarificationPolicy // "null"')
       PROJECT_POLICY=$(echo "$TICKET_DATA" | jq -r '.project.clarificationPolicy // "AUTO"')

       # Resolve effective policy
       if [ "$TICKET_POLICY" != "null" ]; then
         EFFECTIVE_POLICY="$TICKET_POLICY"
         echo "Using ticket-level policy: $EFFECTIVE_POLICY"
       else
         EFFECTIVE_POLICY="$PROJECT_POLICY"
         echo "Using project-level policy: $EFFECTIVE_POLICY"
       fi

       echo "policy=$EFFECTIVE_POLICY" >> $GITHUB_OUTPUT

   - name: Run /specify with effective policy
     run: |
       # Construct JSON payload
       PAYLOAD=$(cat <<'EOF'
       {
         "featureDescription": "${{ env.FEATURE_DESCRIPTION }}",
         "clarificationPolicy": "${{ steps.get_policy.outputs.policy }}"
       }
       EOF
       )

       # Pass to Claude Code
       claude --slash-command "/specify $PAYLOAD"
   ```

2. **Test workflow locally**:
   ```bash
   # Mock API response
   echo '{"clarificationPolicy":"CONSERVATIVE","project":{"clarificationPolicy":"AUTO"}}' > test-ticket.json

   # Test jq extraction
   TICKET_POLICY=$(cat test-ticket.json | jq -r '.clarificationPolicy // "null"')
   PROJECT_POLICY=$(cat test-ticket.json | jq -r '.project.clarificationPolicy // "AUTO"')

   # Verify resolution
   if [ "$TICKET_POLICY" != "null" ]; then
     echo "Using ticket: $TICKET_POLICY"
   else
     echo "Using project: $PROJECT_POLICY"
   fi
   ```

**Validation**:
- [ ] Workflow fetches ticket with nested project
- [ ] Workflow extracts policies using jq
- [ ] Workflow resolves effective policy correctly
- [ ] Workflow logs policy source
- [ ] Workflow constructs valid JSON payload
- [ ] Workflow passes payload to /specify command

---

### Phase 5: /specify Command Extension (1.5 days)

**Goal**: Parse JSON payload and apply policy-based resolution

**Steps**:

1. **Update command** (`.claude/commands/specify.md`):
   ```markdown
   ## STEP 1: PARSE COMMAND PAYLOAD

   Extract feature description and policy from `$ARGUMENTS`:

   - If payload begins with `{`, parse as JSON
   - Extract `featureDescription` (required) and `clarificationPolicy` (optional)
   - If JSON parse fails OR payload is plain text → POLICY = 'INTERACTIVE'
   - If clarificationPolicy missing from JSON → POLICY = 'AUTO'

   ## STEP 2: DETERMINE RESOLUTION MODE

   IF POLICY = "INTERACTIVE":
     → Use current behavior: generate spec with [NEEDS CLARIFICATION: ...] markers
     → Skip auto-resolution guidelines

   IF POLICY = "AUTO" OR "CONSERVATIVE" OR "PRAGMATIC":
     → Apply auto-resolution guidelines
     → DO NOT use [NEEDS CLARIFICATION] markers
     → Generate "Auto-Resolved Decisions" section

   ## STEP 3: AUTO POLICY CONTEXT DETECTION (if POLICY = "AUTO")

   Analyze FEATURE_DESCRIPTION for keywords:
   - SENSITIVE keywords → Apply CONSERVATIVE
   - INTERNAL keywords → Apply PRAGMATIC
   - Compute confidence score
   - Fallback to CONSERVATIVE if confidence < 0.5

   ## STEP 4: APPLY RESOLUTION GUIDELINES

   When POLICY = "CONSERVATIVE":
     - Data retention → Short period (30-90 days)
     - Required fields → Strict validation
     - Error handling → Detailed errors with recovery
     - [... complete decision matrix ...]

   When POLICY = "PRAGMATIC":
     - Data retention → Keep indefinitely
     - Required fields → Permissive with smart defaults
     - Error handling → Simple error message
     - [... complete decision matrix ...]

   ## STEP 5: GENERATE AUTO-RESOLVED DECISIONS SECTION

   After "## Requirements" section, add markdown section with:
   - Policy applied (AUTO/CONSERVATIVE/PRAGMATIC)
   - Detected context (for AUTO)
   - Confidence score (for AUTO)
   - Fallback triggered (for AUTO)
   - List of decisions with rationales
   ```

2. **Test command locally**:
   ```bash
   # Test JSON mode
   claude --slash-command '/specify {"featureDescription":"Add payment processing","clarificationPolicy":"CONSERVATIVE"}'

   # Test plain text mode (backward compat)
   claude --slash-command '/specify Add admin dashboard'

   # Test AUTO mode
   claude --slash-command '/specify {"featureDescription":"Add credit card payment","clarificationPolicy":"AUTO"}'
   ```

3. **Write unit tests** (`tests/unit/auto-context-detection.test.ts`):
   ```typescript
   import { detectAutoPolicy } from '@/app/lib/utils/auto-context-detection';

   test('detects CONSERVATIVE for payment keywords', () => {
     const result = detectAutoPolicy('Add credit card payment processing');
     expect(result.selectedPolicy).toBe('CONSERVATIVE');
     expect(result.confidence).toBeGreaterThan(0.5);
   });

   test('detects PRAGMATIC for admin keywords', () => {
     const result = detectAutoPolicy('Create internal admin dashboard');
     expect(result.selectedPolicy).toBe('PRAGMATIC');
   });

   test('fallback to CONSERVATIVE on conflicting signals', () => {
     const result = detectAutoPolicy('Admin payment reconciliation tool');
     expect(result.selectedPolicy).toBe('CONSERVATIVE');
     expect(result.fallbackTriggered).toBe(true);
   });
   ```

**Validation**:
- [ ] Command parses JSON payload correctly
- [ ] Command handles plain text fallback
- [ ] Command detects AUTO policy keywords
- [ ] Command applies CONSERVATIVE guidelines correctly
- [ ] Command applies PRAGMATIC guidelines correctly
- [ ] Command generates Auto-Resolved Decisions section
- [ ] Unit tests pass (50+ test cases for context detection)

---

### Phase 6: Testing & Documentation (1 day)

**Goal**: Comprehensive test coverage and user/developer documentation

**Steps**:

1. **E2E workflow tests** (`tests/e2e/auto-resolution.spec.ts`):
   ```typescript
   test('CONSERVATIVE workflow generates secure spec', async ({ page }) => {
     // Create ticket with CONSERVATIVE policy
     // Transition to SPECIFY
     // Verify spec has no [NEEDS CLARIFICATION] markers
     // Verify Auto-Resolved Decisions section exists
   });

   test('AUTO workflow detects payment context', async ({ page }) => {
     // Create ticket with description "Add Stripe payment"
     // Set policy to AUTO
     // Transition to SPECIFY
     // Verify spec applied CONSERVATIVE (detected sensitive keyword)
   });
   ```

2. **Update CLAUDE.md**:
   - Add "Clarification Policies" section
   - Document policy enum values
   - Document hierarchical resolution
   - Document API endpoints
   - Document UI components
   - Document workflow integration

3. **Write user guide** (in CLAUDE.md or separate docs):
   - When to use each policy
   - How to configure project defaults
   - How to override ticket policies
   - How to review Auto-Resolved Decisions

4. **Write developer guide**:
   - Extension points for custom policies
   - Testing strategy
   - Migration procedure

**Validation**:
- [ ] E2E test coverage ≥80%
- [ ] All critical paths tested
- [ ] CLAUDE.md updated
- [ ] User guide complete
- [ ] Developer guide complete

---

## Testing Checklist

### Unit Tests
- [ ] Policy resolution logic (ticket ?? project ?? AUTO)
- [ ] AUTO context detection (keywords, confidence, fallback)
- [ ] Zod schema validation (enum values, null handling)

### Integration Tests
- [ ] GET project returns clarificationPolicy
- [ ] PATCH project updates policy
- [ ] GET ticket includes nested project.clarificationPolicy
- [ ] PATCH ticket updates policy (including null)
- [ ] API rejects invalid enum values (400 error)

### E2E Tests
- [ ] Project settings: change policy → persist
- [ ] Ticket creation: set override → persist
- [ ] Ticket detail: edit policy → persist
- [ ] Board view: verify badge displays for overrides only
- [ ] CONSERVATIVE workflow: secure spec generation
- [ ] PRAGMATIC workflow: simple spec generation
- [ ] AUTO workflow: context detection + CONSERVATIVE/PRAGMATIC selection
- [ ] INTERACTIVE workflow: markers preserved (backward compat)

### Manual Tests
- [ ] Migration runs cleanly on dev database
- [ ] UI components responsive (mobile + desktop)
- [ ] Tooltips display correctly
- [ ] Policy badges consistent across views
- [ ] GitHub Actions workflow logs policy source

---

## Rollback Procedure

If critical issues arise post-deployment:

1. **Revert code changes**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Rollback database migration**:
   ```sql
   -- Drop indexes
   DROP INDEX IF EXISTS "tickets_clarification_policy_idx";

   -- Drop columns
   ALTER TABLE "tickets" DROP COLUMN IF EXISTS "clarification_policy";
   ALTER TABLE "projects" DROP COLUMN IF EXISTS "clarification_policy";

   -- Drop enum
   DROP TYPE IF EXISTS "ClarificationPolicy";
   ```

3. **Verify system stability**:
   - Test existing ticket transitions
   - Verify no errors in logs
   - Monitor API response times

---

## Success Metrics

Post-deployment, verify:

- [ ] Spec generation time reduced to 3-5min (from 10-15min)
- [ ] 95% of specs have no [NEEDS CLARIFICATION] markers
- [ ] 100% of specs include Auto-Resolved Decisions section
- [ ] API response times <200ms p95
- [ ] No breaking changes to existing workflows
- [ ] E2E test coverage ≥80%

---

## Troubleshooting

### Issue: Migration fails with "enum already exists"
**Solution**: Check if enum was partially created, drop manually:
```sql
DROP TYPE IF EXISTS "ClarificationPolicy";
```
Then re-run migration.

### Issue: API returns 500 on PATCH project
**Solution**: Check Zod validation errors in logs. Verify enum import:
```typescript
import { ClarificationPolicy } from '@prisma/client';
```

### Issue: Workflow fails to parse JSON payload
**Solution**: Test payload construction locally:
```bash
PAYLOAD='{"featureDescription":"test","clarificationPolicy":"AUTO"}'
echo "$PAYLOAD" | jq .
```

### Issue: AUTO policy always fallbacks to CONSERVATIVE
**Solution**: Check keyword detection logic. Verify confidence threshold (0.5). Add debug logging:
```typescript
console.log('Detected keywords:', detectedKeywords);
console.log('Confidence:', confidence);
```

---

## Next Steps

After completing all phases:

1. Deploy to staging environment
2. Run full test suite
3. Perform manual QA (policy workflows, spec generation)
4. Deploy to production
5. Monitor metrics (spec generation time, error rates)
6. Iterate based on user feedback
