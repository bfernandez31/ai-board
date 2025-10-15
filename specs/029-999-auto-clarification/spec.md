# Feature Specification: Auto-Clarification Resolution System

**Feature Branch**: `029-999-auto-clarification`
**Created**: 2025-01-14
**Status**: Draft
**Input**: User description: "999 Auto clarification Rédiger la spécification détaillée de l'auto-résolution des clarifications décrite dans specs/vision/auto-resolution-clarifications.md (enum Prisma, API GET/PATCH, UI badges + select, workflow GitHub Actions, logique /specify, tests & doc)."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Implementation scope includes complete integration across database, API, UI, workflows, and /specify command
- **Policy Applied**: AUTO (analyzing technical implementation feature)
- **Confidence**: High (0.85) - clear technical scope with detailed vision document reference
- **Fallback Triggered?**: No - confidence above 0.5 threshold
- **Trade-offs**:
  1. Comprehensive implementation provides immediate value but requires ~5.5 days development time
  2. Phased approach allows iterative delivery and validation at each layer
- **Reviewer Notes**: Verify GitHub Actions workflow integration complexity and /specify command modifications don't break existing functionality

- **Decision**: Database schema uses enum with NOT NULL default for Project, nullable for Ticket
- **Policy Applied**: CONSERVATIVE (data integrity critical)
- **Confidence**: High (0.9) - follows established database design patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. NOT NULL with default ensures every project has defined policy
  2. Nullable ticket field enables clear inheritance semantics
- **Reviewer Notes**: Validate migration strategy for existing projects (will default to AUTO)

- **Decision**: UI displays policy badges with icons and clear visual hierarchy
- **Policy Applied**: CONSERVATIVE (user experience and clarity critical)
- **Confidence**: High (0.85) - follows UX best practices
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Visual indicators improve discoverability but add UI complexity
  2. Board view shows badges only for overrides to reduce clutter
- **Reviewer Notes**: Validate icon choices and color scheme with design system

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Project Default Policy (Priority: P1)

As a project owner, I want to set a default clarification policy for my project so that all new tickets automatically use an appropriate resolution strategy without manual configuration.

**Why this priority**: Core functionality enabling the entire auto-resolution system. Without project-level defaults, users must configure every ticket individually.

**Independent Test**: Can be fully tested by creating a project, setting its clarification policy via settings UI, creating a new ticket, and verifying the ticket inherits the policy correctly. Delivers immediate value by establishing project-wide defaults.

**Acceptance Scenarios**:

1. **Given** I'm on the project settings page, **When** I select "CONSERVATIVE" from the clarification policy dropdown, **Then** the project's default policy is updated and all new tickets inherit CONSERVATIVE
2. **Given** I have set my project policy to "PRAGMATIC", **When** I create a new ticket without specifying a policy, **Then** the ticket inherits PRAGMATIC from the project
3. **Given** I have not configured a project policy, **When** I view the project settings, **Then** the policy defaults to "AUTO" (system default)

---

### User Story 2 - Override Ticket Policy (Priority: P1)

As a developer, I want to override the clarification policy for specific tickets so that sensitive features use CONSERVATIVE while internal tools use PRAGMATIC, regardless of the project default.

**Why this priority**: Enables granular control for exceptional cases. Essential for mixed-criticality projects (e.g., payment features alongside admin tools).

**Independent Test**: Can be tested by creating a ticket, setting a ticket-specific policy override different from the project default, and verifying the override takes precedence. Delivers value by allowing fine-grained control.

**Acceptance Scenarios**:

1. **Given** my project uses "AUTO" by default, **When** I create a ticket "Add payment processing" and set its policy to "CONSERVATIVE", **Then** this ticket uses CONSERVATIVE while other tickets use AUTO
2. **Given** I have a ticket with a "CONSERVATIVE" override, **When** I edit the ticket and set the policy to null (empty), **Then** the ticket reverts to using the project default
3. **Given** I'm viewing a ticket on the board, **When** the ticket has a policy override, **Then** I see a small badge (🛡️/⚡/🤖) in the top-right corner

---

### User Story 3 - Automatic Spec Generation with Policy (Priority: P1)

As a user, when I transition a ticket to SPECIFY stage, I want the system to automatically generate a complete specification using the effective clarification policy so that I don't have to answer 5-10 questions manually.

**Why this priority**: Core value proposition - reduces specification time from 10-15 minutes to 3-5 minutes and eliminates manual interaction.

**Independent Test**: Can be tested by creating a ticket with a clarification policy, transitioning to SPECIFY, and verifying the generated spec contains no `[NEEDS CLARIFICATION]` markers and includes an "Auto-Resolved Decisions" section. Delivers immediate time savings.

**Acceptance Scenarios**:

1. **Given** I have a ticket with effective policy "CONSERVATIVE", **When** I transition the ticket to SPECIFY stage, **Then** the GitHub Actions workflow generates a spec without `[NEEDS CLARIFICATION]` markers and includes conservative resolutions
2. **Given** the workflow runs with policy "PRAGMATIC", **When** the spec is generated, **Then** ambiguities are resolved with simple, fast-to-implement choices
3. **Given** the workflow detects "payment" keywords with "AUTO" policy, **When** the spec is generated, **Then** the AUTO policy applies CONSERVATIVE guidelines and documents the context detection

---

### User Story 4 - Review Auto-Resolved Decisions (Priority: P2)

As a reviewer, I want to see which clarifications were automatically resolved and why, so that I can validate the decisions before implementation begins.

**Why this priority**: Ensures transparency and enables review workflow. Secondary to actual generation but critical for team collaboration.

**Independent Test**: Can be tested by generating a spec with auto-resolution and verifying the "Auto-Resolved Decisions" section contains clear rationales for each decision. Delivers value by maintaining audit trail.

**Acceptance Scenarios**:

1. **Given** a spec was generated with "CONSERVATIVE" policy, **When** I open the spec file, **Then** I see an "Auto-Resolved Decisions" section listing each ambiguity resolved with rationale
2. **Given** I'm reviewing auto-resolved decisions, **When** I examine the rationales, **Then** each rationale clearly explains why the policy chose this specific resolution
3. **Given** the AUTO policy detected multiple keywords, **When** I view the decisions section, **Then** I see the detected context and confidence score with any fallback triggers

---

### User Story 5 - Policy Indicators on Board View (Priority: P3)

As a team member browsing the Kanban board, I want to quickly identify tickets with policy overrides so that I understand which features have special clarification requirements.

**Why this priority**: Improves team awareness but not essential for functionality. Visual enhancement that adds value for multi-ticket management.

**Independent Test**: Can be tested by creating tickets with and without policy overrides, viewing the board, and verifying only overrides show badges. Delivers value by improving visibility without clutter.

**Acceptance Scenarios**:

1. **Given** I'm viewing the project board, **When** I look at tickets with policy overrides, **Then** I see small icon badges (🛡️/⚡/🤖) in the top-right corner
2. **Given** I'm viewing tickets that inherit the project default, **When** I look at the board, **Then** these tickets have no policy badge (avoiding clutter)
3. **Given** I hover over a policy badge on the board, **When** the tooltip appears, **Then** it shows the full policy name (e.g., "CONSERVATIVE")

---

### User Story 6 - Edit Policy via Ticket Detail View (Priority: P3)

As a ticket owner, I want to easily change the clarification policy from the ticket detail view so that I can adjust the resolution strategy after creation.

**Why this priority**: Convenience feature for managing existing tickets. Less critical than initial configuration.

**Independent Test**: Can be tested by opening a ticket detail view, clicking the policy edit button, changing the policy, and verifying the update persists. Delivers value by enabling easy policy management.

**Acceptance Scenarios**:

1. **Given** I'm viewing a ticket detail page, **When** I click the "Edit Policy" button, **Then** a dialog opens with a select dropdown showing current policy
2. **Given** the policy edit dialog is open, **When** I select a new policy and click "Save", **Then** the ticket's policy is updated and the badge reflects the change
3. **Given** I want to revert to the project default, **When** I select "Use project default" option and save, **Then** the ticket's policy is set to null and the badge shows "(default)"

---

### Edge Cases

- What happens when a user transitions a ticket with "INTERACTIVE" policy to SPECIFY stage?
  - System generates spec with `[NEEDS CLARIFICATION]` markers (preserves current behavior for backward compatibility)
  - No "Auto-Resolved Decisions" section is added
  - Job completes successfully but spec requires manual clarification in future phase

- What happens when AUTO policy detects conflicting keywords (e.g., "admin payment dashboard")?
  - AUTO fallback to CONSERVATIVE when confidence < 0.5
  - Logs the conflict in "Auto-Resolved Decisions" with confidence score
  - Reviewer notes indicate which keywords triggered which signals

- What happens when project or ticket policy is changed after spec generation?
  - Policy changes do not retroactively affect existing specs
  - Only future SPECIFY transitions use the new policy
  - Existing specs maintain their "Auto-Resolved Decisions" section with original policy

- What happens when /specify command receives malformed JSON?
  - Command falls back to INTERACTIVE mode (plain text handling)
  - Treats entire $ARGUMENTS as featureDescription
  - Generates spec with `[NEEDS CLARIFICATION]` markers

- What happens when database migration runs on existing projects?
  - All existing projects receive default "AUTO" policy
  - All existing tickets receive null policy (inherit from project)
  - No specs are regenerated; only future transitions use new policies

- What happens when GitHub Actions workflow fails to fetch policy?
  - Workflow logs error and defaults to "AUTO" policy
  - Job continues with system default to prevent blocking
  - Error is logged for debugging but doesn't halt spec generation

## Requirements *(mandatory)*

### Functional Requirements

#### Database & Schema

- **FR-001**: System MUST define a `ClarificationPolicy` enum with values: AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE
- **FR-002**: Project model MUST have a `clarificationPolicy` field (NOT NULL, default: 'AUTO')
- **FR-003**: Ticket model MUST have a `clarificationPolicy` field (NULLABLE, default: null)
- **FR-004**: System MUST use hierarchical resolution: `ticket.clarificationPolicy ?? project.clarificationPolicy ?? 'AUTO'`
- **FR-005**: Database migration MUST preserve existing data and apply defaults to all existing projects

#### API Endpoints

- **FR-006**: GET `/api/projects/:id` MUST include `clarificationPolicy` field in response
- **FR-007**: GET `/api/projects/:projectId/tickets/:ticketId` MUST include nested `project.clarificationPolicy` for client-side resolution
- **FR-008**: PATCH `/api/projects/:id` MUST allow updating `clarificationPolicy` field with enum validation
- **FR-009**: PATCH `/api/projects/:projectId/tickets/:ticketId` MUST allow updating `clarificationPolicy` field (including null for reset)
- **FR-010**: API MUST validate policy values using Zod schema (enum + null for tickets)
- **FR-011**: API MUST return 400 error for invalid policy values

#### User Interface

- **FR-012**: Project settings page MUST display a "Default Clarification Policy" select with 3 options: AUTO (🤖), CONSERVATIVE (🛡️), PRAGMATIC (⚡)
- **FR-013**: Ticket creation modal MUST include optional "Clarification Policy" field with "Use project default" option
- **FR-014**: Ticket detail view MUST display policy badge showing effective policy with visual distinction between override and default
- **FR-015**: Ticket detail view MUST provide "Edit Policy" button opening dialog with policy select
- **FR-016**: Board view (Kanban) MUST display small icon badge on tickets with policy overrides only (not on tickets inheriting default)
- **FR-017**: All policy selects MUST include help text explaining each policy's philosophy
- **FR-018**: Policy badges MUST use consistent icons: 🤖 (AUTO), 🛡️ (CONSERVATIVE), ⚡ (PRAGMATIC)

#### GitHub Actions Workflow

- **FR-019**: Workflow MUST include step "Get effective clarification policy" that fetches ticket with nested project
- **FR-020**: Workflow MUST resolve effective policy using hierarchical logic: ticket ?? project ?? 'AUTO'
- **FR-021**: Workflow MUST log the policy source ("ticket-level", "project-level", or "system default")
- **FR-022**: Workflow MUST pass effective policy to /specify command via JSON payload
- **FR-023**: Workflow MUST construct JSON payload: `{"featureDescription":"...","clarificationPolicy":"..."}`

#### /specify Command Extension

- **FR-024**: /specify command MUST parse JSON payload to extract `featureDescription` and optional `clarificationPolicy`
- **FR-025**: /specify command MUST support legacy plain text input (fallback to INTERACTIVE mode)
- **FR-026**: /specify command MUST compute effective policy from JSON metadata (ticket ?? project ?? AUTO)
- **FR-027**: /specify command MUST apply conditional logic based on policy:
  - INTERACTIVE → generate spec with `[NEEDS CLARIFICATION]` markers
  - AUTO/CONSERVATIVE/PRAGMATIC → resolve ambiguities inline using policy guidelines
- **FR-028**: /specify command MUST implement AUTO policy context detection using keyword matching
- **FR-029**: /specify command MUST implement AUTO policy confidence scoring (0.0-1.0 scale)
- **FR-030**: /specify command MUST fallback AUTO to CONSERVATIVE when confidence < 0.5 or conflicting signals detected
- **FR-031**: /specify command MUST generate "Auto-Resolved Decisions" section for AUTO/CONSERVATIVE/PRAGMATIC modes
- **FR-032**: /specify command MUST document each resolution with: decision, rationale, policy applied, confidence (for AUTO), fallback triggered (for AUTO), trade-offs, reviewer notes

#### Auto-Resolution Guidelines

- **FR-033**: CONSERVATIVE policy MUST apply security and quality first principles (see Decision Matrix)
- **FR-034**: PRAGMATIC policy MUST apply speed and simplicity first principles (see Decision Matrix)
- **FR-035**: AUTO policy MUST detect sensitive keywords (payment, auth, PII, compliance) → apply CONSERVATIVE
- **FR-036**: AUTO policy MUST detect internal keywords (admin, internal, tool, debug) → apply PRAGMATIC
- **FR-037**: AUTO policy MUST compute confidence score based on signal weights and conflicts
- **FR-038**: System MUST provide decision matrix for common ambiguity types (15+ categories documented in vision)

### Key Entities

- **ClarificationPolicy**: Enum defining resolution strategies
  - Values: AUTO (context-aware), CONSERVATIVE (security-first), PRAGMATIC (speed-first), INTERACTIVE (manual)
  - Used by Project and Ticket models

- **Project**: Enhanced with clarification policy configuration
  - `clarificationPolicy` (ClarificationPolicy, NOT NULL, default: AUTO): Default policy for all tickets
  - Provides project-wide resolution strategy

- **Ticket**: Enhanced with optional policy override
  - `clarificationPolicy` (ClarificationPolicy, NULLABLE): Optional override of project policy
  - null value means inherit from project
  - Enables fine-grained control for exceptional cases

- **Auto-Resolved Decision**: Documented resolution in generated spec
  - Decision: What ambiguity was resolved
  - Rationale: Why this choice was made based on policy
  - Policy Applied: Which policy drove the decision (AUTO may delegate to CONSERVATIVE/PRAGMATIC)
  - Confidence: Numeric score for AUTO decisions
  - Trade-offs: Impacts on scope, quality, timeline
  - Reviewer Notes: What humans must validate

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Specification generation time reduces from 10-15 minutes to 3-5 minutes (measured via GitHub Actions workflow duration)
- **SC-002**: GitHub Actions cost reduces from ~$0.50 to ~$0.05 per feature (measured via workflow minutes consumed)
- **SC-003**: 95% of generated specs contain no remaining `[NEEDS CLARIFICATION]` markers when using AUTO/CONSERVATIVE/PRAGMATIC policies
- **SC-004**: 100% of auto-generated specs include "Auto-Resolved Decisions" section with documented rationales
- **SC-005**: Database migration completes successfully with zero data loss on dev and production environments
- **SC-006**: API endpoints respond within 200ms p95 for policy read operations
- **SC-007**: UI policy selects function correctly in project settings, ticket creation, and ticket detail views across desktop and mobile
- **SC-008**: GitHub Actions workflow correctly resolves hierarchical policy (ticket > project > system default) in 100% of test cases
- **SC-009**: AUTO policy context detection achieves >85% accuracy on test dataset of 50+ feature descriptions
- **SC-010**: E2E test coverage achieves ≥80% for all policy workflows (creation, override, inheritance, spec generation)
- **SC-011**: Documentation is complete and accessible for users (policy explanations) and developers (implementation guide)
- **SC-012**: Zero breaking changes to existing ticket transition workflows for users not using clarification policies

## Implementation Details

### Database Schema Changes

#### Prisma Schema Modifications

```prisma
enum ClarificationPolicy {
  AUTO          // Context-aware (system default)
  CONSERVATIVE  // Security & quality first
  PRAGMATIC     // Speed & simplicity first
  INTERACTIVE   // Manual clarification (future)
}

model Project {
  id                   Int                  @id @default(autoincrement())
  name                 String
  clarificationPolicy  ClarificationPolicy  @default(AUTO) @map("clarification_policy")
  // ... existing fields
}

model Ticket {
  id                   Int                  @id @default(autoincrement())
  title                String
  clarificationPolicy  ClarificationPolicy? @map("clarification_policy")
  // ... existing fields
}
```

#### SQL Migration

```sql
-- Create enum
CREATE TYPE "ClarificationPolicy" AS ENUM ('AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE');

-- Add project column with default
ALTER TABLE "projects"
ADD COLUMN "clarification_policy" "ClarificationPolicy"
NOT NULL DEFAULT 'AUTO';

-- Add nullable ticket column
ALTER TABLE "tickets"
ADD COLUMN "clarification_policy" "ClarificationPolicy";

-- Create index for filtering (optional optimization)
CREATE INDEX "idx_tickets_clarification_policy" ON "tickets"("clarification_policy");
```

### API Response Schemas

#### GET `/api/projects/:id`

```typescript
{
  id: number;
  name: string;
  clarificationPolicy: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE';
  // ... other fields
}
```

#### GET `/api/projects/:projectId/tickets/:ticketId`

```typescript
{
  id: number;
  title: string;
  stage: string;
  clarificationPolicy: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE' | null;
  project: {
    id: number;
    name: string;
    clarificationPolicy: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE';
  };
  // ... other fields
}
```

#### Effective Policy Resolution (Client-Side)

```typescript
const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy ?? 'AUTO';
```

### Zod Validation Schemas

#### Project Update Schema

```typescript
const projectUpdateSchema = z.object({
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).optional(),
  // ... other fields
});
```

#### Ticket Update Schema

```typescript
const ticketUpdateSchema = z.object({
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).nullable().optional(),
  // ... other fields
});
```

### GitHub Actions Workflow Integration

#### Step 1: Fetch Effective Policy

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
```

#### Step 2: Run /specify with Policy

```yaml
- name: Run /specify with effective policy
  run: |
    claude --slash-command '/specify {"featureDescription":"'"${{ env.FEATURE_DESCRIPTION }}"'","clarificationPolicy":"'"${{ steps.get_policy.outputs.policy }}"'"}'
```

### /specify Command Logic

#### JSON Payload Parsing

```markdown
**STEP 1: PARSE COMMAND PAYLOAD**

Extract feature description and policy from `$ARGUMENTS`:
- If payload begins with `{`, parse as JSON
- Required field: `featureDescription` (string)
- Optional field: `clarificationPolicy` (enum string)
- If JSON parse fails OR payload is plain text → set POLICY = 'INTERACTIVE'
- If clarificationPolicy missing from JSON → set POLICY = 'AUTO'
- Normalize policy to uppercase enum value
```

#### Conditional Resolution Mode

```markdown
**STEP 2: DETERMINE RESOLUTION MODE**

IF POLICY = "INTERACTIVE":
  → Use current behavior: generate spec with [NEEDS CLARIFICATION: ...] markers
  → Skip auto-resolution guidelines
  → Do NOT add "Auto-Resolved Decisions" section

IF POLICY = "AUTO" OR "CONSERVATIVE" OR "PRAGMATIC":
  → Apply auto-resolution guidelines
  → DO NOT use [NEEDS CLARIFICATION] markers
  → Generate "Auto-Resolved Decisions" section with rationales
```

#### AUTO Policy Context Detection

```markdown
**STEP 3: AUTO POLICY CONTEXT DETECTION** (if POLICY = "AUTO")

Analyze FEATURE_DESCRIPTION for keywords:

SENSITIVE KEYWORDS → Apply CONSERVATIVE:
- Security: "payment", "financial", "bank", "transaction", "auth", "login", "password", "security"
- Data: "personal data", "PII", "sensitive", "GDPR", "encryption"
- Compliance: "PCI-DSS", "HIPAA", "SOC2", "audit", "compliance", "regulatory"
- Weight: +3 per keyword detected

INTERNAL KEYWORDS → Apply PRAGMATIC:
- Admin: "admin", "internal", "tool", "debug"
- Prototyping: "prototype", "MVP", "exploratory", "temporary"
- Weight: -2 per keyword detected

SCALABILITY KEYWORDS → Apply CONSERVATIVE:
- "millions of users", "high traffic", "mission critical", "SLA"
- Weight: +2 per keyword detected

COMPUTE CONFIDENCE:
- netScore = Σ(weights)
- absScore = |netScore|
- IF absScore >= 5 AND conflicting_buckets <= 1 → confidence = 0.9 (High)
- ELSE IF absScore >= 3 → confidence = 0.6 (Medium)
- ELSE → confidence = 0.3 (Low)

APPLY FALLBACK:
- IF confidence < 0.5 OR conflicting_buckets >= 2 → fallback to CONSERVATIVE
- Log fallback trigger in "Auto-Resolved Decisions" section

selectedPolicy = CONSERVATIVE if netScore >= 0 else PRAGMATIC
```

#### Resolution Guidelines Application

```markdown
**STEP 4: APPLY RESOLUTION GUIDELINES**

When POLICY = "CONSERVATIVE":
Apply security & quality first principles:
- Data retention → Short period (30-90 days) unless compliance requires longer
- Required fields → Strict validation, all fields required by default
- Error handling → Detailed errors with recovery options
- File/content limits → Conservative limits (e.g., 10MB for uploads)
- Timeout durations → Short timeouts (30s-1min, fail fast)
- [... complete decision matrix from vision document ...]

When POLICY = "PRAGMATIC":
Apply speed & simplicity first principles:
- Data retention → Keep indefinitely (simpler logic)
- Required fields → Permissive, make fields optional with smart defaults
- Error handling → Simple error message
- File/content limits → No limits (always attempt)
- [... complete decision matrix from vision document ...]
```

#### Auto-Resolved Decisions Section Generation

```markdown
**STEP 5: GENERATE AUTO-RESOLVED DECISIONS SECTION**

After "## Requirements" section, add:

## Auto-Resolved Decisions

*Policy: [CONSERVATIVE | PRAGMATIC | AUTO]*
*Applied on: [CURRENT_DATE]*

[IF POLICY = AUTO]
*Detected Context*: [list keywords detected]
*Confidence Score*: [0.0-1.0]
*Selected Strategy*: [CONSERVATIVE | PRAGMATIC]
[IF fallback triggered]
*Fallback Triggered*: Yes - [reason: low confidence / conflicting signals]
[END IF]
[END IF]

The following ambiguities were automatically resolved based on the configured policy:

- **[Ambiguity Topic]**: [Decision made]
  *Rationale*: [Explanation based on policy guidelines]
  [IF POLICY = AUTO]*Confidence*: [score | high/medium/low][END IF]
  *Trade-offs*: [List impacts on scope, quality, timeline]
  *Reviewer Notes*: [What humans must validate]

[Repeat for each resolution]
```

### UI Component Specifications

#### Project Settings - Clarification Policy Card

**Location**: `/projects/:id/settings`

**Component Structure**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Default Clarification Policy</CardTitle>
    <CardDescription>
      Applied to all new tickets unless overridden at ticket level
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Select value={project.clarificationPolicy} onValueChange={handleUpdate}>
      <SelectItem value="AUTO">
        🤖 AUTO - Context-aware decisions (default)
      </SelectItem>
      <SelectItem value="CONSERVATIVE">
        🛡️ CONSERVATIVE - Security & quality first
      </SelectItem>
      <SelectItem value="PRAGMATIC">
        ⚡ PRAGMATIC - Speed & simplicity first
      </SelectItem>
    </Select>
    <HelpText>
      AUTO: Claude analyzes the context and chooses the appropriate approach
      CONSERVATIVE: Prioritizes security, scalability, and long-term maintainability
      PRAGMATIC: Prioritizes simplicity and speed to market
    </HelpText>
  </CardContent>
</Card>
```

#### Ticket Creation Modal - Policy Field

**Component Structure**:
```tsx
<FormField name="clarificationPolicy" label="Clarification Policy (optional)">
  <Select value={formData.clarificationPolicy} onValueChange={handleChange}>
    <SelectItem value="">
      Use project default ({project.clarificationPolicy})
    </SelectItem>
    <SelectItem value="AUTO">🤖 AUTO</SelectItem>
    <SelectItem value="CONSERVATIVE">🛡️ CONSERVATIVE</SelectItem>
    <SelectItem value="PRAGMATIC">⚡ PRAGMATIC</SelectItem>
  </Select>
  <HelpText>
    Override project policy for this specific ticket. Leave empty to use project default.
  </HelpText>
</FormField>
```

#### Ticket Detail View - Policy Badge & Edit

**Component Structure**:
```tsx
<div className="flex items-center gap-2">
  {ticket.clarificationPolicy ? (
    <Badge variant="secondary">
      {getPolicyIcon(ticket.clarificationPolicy)} {ticket.clarificationPolicy}
    </Badge>
  ) : (
    <Badge variant="outline">
      {getPolicyIcon(effectivePolicy)} {effectivePolicy} (default)
    </Badge>
  )}
  <Button variant="ghost" size="sm" onClick={openEditDialog}>
    Edit Policy
  </Button>
</div>

<Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Clarification Policy</DialogTitle>
    </DialogHeader>
    <Select value={selectedPolicy} onValueChange={setSelectedPolicy}>
      <SelectItem value="">Use project default ({project.clarificationPolicy})</SelectItem>
      <SelectItem value="AUTO">🤖 AUTO</SelectItem>
      <SelectItem value="CONSERVATIVE">🛡️ CONSERVATIVE</SelectItem>
      <SelectItem value="PRAGMATIC">⚡ PRAGMATIC</SelectItem>
    </Select>
    <DialogFooter>
      <Button onClick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Board View - Policy Badge (Overrides Only)

**Component Structure**:
```tsx
<TicketCard>
  {ticket.clarificationPolicy && (
    <Badge className="absolute top-2 right-2" size="sm">
      <Tooltip content={ticket.clarificationPolicy}>
        {getPolicyIcon(ticket.clarificationPolicy)}
      </Tooltip>
    </Badge>
  )}
  {/* ... rest of card content */}
</TicketCard>
```

### Testing Strategy

#### Unit Tests

- **Database Layer**:
  - Test Prisma enum validation
  - Test default values (Project: AUTO, Ticket: null)
  - Test migration rollback safety

- **API Layer**:
  - Test GET endpoints return policy fields
  - Test PATCH endpoints validate enum values
  - Test PATCH endpoints accept null for ticket reset
  - Test Zod schema validation (valid/invalid values)
  - Test 400 errors for invalid policy values

- **Client-Side Resolution**:
  - Test hierarchical resolution logic: ticket ?? project ?? AUTO
  - Test edge cases: both null, ticket override, project default

#### Integration Tests

- **API Integration**:
  - Test GET project includes clarificationPolicy
  - Test GET ticket includes nested project.clarificationPolicy
  - Test PATCH project updates policy
  - Test PATCH ticket updates policy (including null reset)

- **Workflow Integration**:
  - Test workflow fetches ticket with nested project
  - Test workflow resolves effective policy correctly
  - Test workflow constructs JSON payload for /specify
  - Test workflow logs policy source

#### E2E Tests (Playwright)

- **UI Flows**:
  - Test project settings: change policy → save → verify persistence
  - Test ticket creation: set override → submit → verify in database
  - Test ticket detail: edit policy → save → verify badge update
  - Test board view: verify badge displays for overrides only
  - Test policy reset: set to null → verify inheritance

- **Complete Workflow**:
  - Test CONSERVATIVE flow: create ticket → transition to SPECIFY → verify spec has no markers
  - Test PRAGMATIC flow: create ticket → transition to SPECIFY → verify simple resolutions
  - Test AUTO flow: create "payment" ticket → verify CONSERVATIVE applied
  - Test AUTO flow: create "admin" ticket → verify PRAGMATIC applied
  - Test hierarchy: project=AUTO, ticket=CONSERVATIVE → verify ticket override wins

- **Edge Cases**:
  - Test INTERACTIVE mode: verify markers preserved
  - Test malformed JSON: verify fallback to INTERACTIVE
  - Test AUTO low confidence: verify fallback to CONSERVATIVE

#### Test Data Sets

**AUTO Policy Context Detection Dataset** (50+ samples):
- Payment features: "Add Stripe integration", "Process credit card payments"
- Auth features: "Implement OAuth login", "Add password reset flow"
- Admin features: "Create admin dashboard", "Add debug logging panel"
- Internal tools: "Build deployment automation", "Add developer console"
- Mixed keywords: "Admin payment reconciliation tool" (conflicting signals)
- Neutral features: "Display user profile page", "Add search functionality"

### Documentation Requirements

#### User Documentation

- **Policy Overview**: Explain AUTO, CONSERVATIVE, PRAGMATIC philosophies
- **When to Use Each Policy**: Decision guide with examples
- **Configuration Guide**: How to set project and ticket policies
- **Understanding Auto-Resolved Decisions**: How to review generated specs
- **Best Practices**: Project policy strategies for different team types

#### Developer Documentation

- **Architecture Overview**: Hierarchical resolution, database schema, API contracts
- **Resolution Guidelines**: Complete decision matrix for all ambiguity types
- **Extending Policies**: How to add custom resolution rules (future phase)
- **Testing Guide**: How to test policy workflows and auto-resolution
- **Migration Guide**: Database migration steps and rollback procedures

### Performance Targets

- **Database Operations**: <50ms for policy read/write operations
- **API Endpoints**: <200ms p95 response time for policy queries
- **UI Interactions**: <100ms for policy select updates (optimistic UI)
- **Workflow Execution**: 3-5 minutes total for SPECIFY with auto-resolution
- **AUTO Context Detection**: <500ms for keyword analysis and confidence scoring

### Security Considerations

- **Authorization**: Policy updates require project ownership validation
- **Validation**: All policy values validated via Zod schemas (enum + null)
- **Default Safety**: System default (AUTO) provides reasonable fallback
- **Audit Trail**: All policy changes logged via updatedAt timestamps
- **No Sensitive Data**: Policy values are enum strings (no user data exposure)

### Backward Compatibility

- **Existing Projects**: Receive AUTO default (safe, context-aware)
- **Existing Tickets**: Receive null (inherit from project)
- **Existing Specs**: Not affected by policy changes (immutable)
- **INTERACTIVE Mode**: Preserved for future manual clarification feature
- **Plain Text /specify**: Continues to work (fallback to INTERACTIVE)

### Future Extensions

#### Phase 7: Custom Resolution Rules

Allow project-level custom rules for fine-grained control:
```json
{
  "overrides": {
    "auth": "CONSERVATIVE",
    "performance": "PRAGMATIC"
  },
  "keywords": {
    "payment": "CONSERVATIVE",
    "admin": "PRAGMATIC"
  }
}
```

#### Phase 8: Full INTERACTIVE Mode

Implement manual clarification workflow:
- Job status: NEEDS_CLARIFICATION
- Frontend displays questions sequentially
- /clarify workflow applies answers
- Preserves Q&A in spec "Clarifications" section

#### Phase 9: Learning System

Learn from user modifications to improve AUTO policy:
- Track post-spec manual edits
- Identify patterns in user corrections
- Adjust AUTO heuristics based on project history
- Suggest policies based on past choices

## Implementation Phases

### Phase 1: Database Schema (~0.5 day)

**Tasks**:
1. Create `ClarificationPolicy` enum in Prisma schema
2. Add `Project.clarificationPolicy` field (NOT NULL, default: AUTO)
3. Add `Ticket.clarificationPolicy` field (NULLABLE)
4. Generate Prisma migration
5. Test migration on dev database
6. Verify backward compatibility

**Deliverables**:
- Validated SQL migration
- Updated Prisma schema
- Migration rollback tested

---

### Phase 2: Backend API (~1 day)

**Tasks**:
1. Enhance GET `/api/projects/:id` to expose `clarificationPolicy`
2. Enhance GET `/api/projects/:projectId/tickets/:ticketId` with nested project policy
3. Update PATCH `/api/projects/:id` to allow policy updates
4. Update PATCH `/api/projects/:projectId/tickets/:ticketId` to allow policy updates
5. Create Zod validation schemas for policy values
6. Write unit tests for API endpoints
7. Write integration tests for policy CRUD

**Deliverables**:
- 4 functional API endpoints
- Zod validation schemas
- API test coverage ≥80%

---

### Phase 3: Frontend UI (~1.5 days)

**3.1 Project Settings** (~0.3 day):
- Card "Default Clarification Policy"
- Select with 3 options + icons
- Help text and tooltips

**3.2 Ticket Creation Modal** (~0.3 day):
- Optional "Clarification Policy" field
- "Use project default" option
- Help text

**3.3 Ticket Detail View** (~0.5 day):
- Policy badge (override vs default styling)
- Edit policy dialog
- Reset to default functionality

**3.4 Board View** (~0.4 day):
- Icon badge on tickets with overrides
- Tooltip on hover
- No badge for inherited policies

**Deliverables**:
- 4 functional UI components
- Responsive design (mobile + desktop)
- Consistent design system integration

---

### Phase 4: GitHub Actions Workflow (~1 day)

**Tasks**:
1. Add step "Get effective clarification policy"
2. Implement hierarchical resolution logic (ticket ?? project ?? AUTO)
3. API call to fetch ticket with nested project
4. Policy source logging
5. Construct JSON payload for /specify
6. Remove /clarify check logic (workflow simplification)
7. Test workflow with all 3 policies

**Deliverables**:
- Simplified workflow (1 run instead of 2-7)
- Clear policy source logging
- Tests covering all policy modes

---

### Phase 5: /specify Command Extension (~1.5 days)

**Tasks**:
1. Parse JSON payload from $ARGUMENTS
2. Extract featureDescription and clarificationPolicy
3. Implement conditional logic (INTERACTIVE vs AUTO/CONSERVATIVE/PRAGMATIC)
4. Implement AUTO context detection (keyword matching)
5. Implement AUTO confidence scoring
6. Implement AUTO fallback to CONSERVATIVE
7. Apply CONSERVATIVE resolution guidelines
8. Apply PRAGMATIC resolution guidelines
9. Generate "Auto-Resolved Decisions" section
10. Test with spec-kit locally

**Deliverables**:
- Enhanced /specify command
- Complete resolution guidelines implemented
- Tests with 50+ feature descriptions

---

### Phase 6: Testing & Documentation (~1 day)

**E2E Tests**:
1. Test policy hierarchy (ticket > project > system)
2. Test CONSERVATIVE workflow (secure resolutions)
3. Test PRAGMATIC workflow (simple resolutions)
4. Test AUTO workflow (context detection)
5. Test INTERACTIVE workflow (markers preserved)
6. Test UI flows (create, edit, reset policies)
7. Test complete workflow (ticket → job → spec)

**Documentation**:
1. Update CLAUDE.md with clarification policies section
2. Write user guide (policy selection, configuration)
3. Write developer guide (extension, testing)
4. Create resolution examples per policy
5. Document AUTO context detection keywords

**Deliverables**:
- E2E test coverage ≥80%
- Complete user documentation
- Technical developer documentation
- Policy decision examples

---

## Total Estimation: 5.5 Days

- Phase 1 (Database): 0.5 days
- Phase 2 (API): 1 day
- Phase 3 (UI): 1.5 days
- Phase 4 (Workflow): 1 day
- Phase 5 (/specify): 1.5 days
- Phase 6 (Testing & Docs): 1 day

**Total**: 6.5 days (conservative estimate)
**Optimistic**: 5.5 days (assuming no blockers)
