# Clarification Policies

## Overview

This domain covers the auto-clarification resolution system that automates specification generation by applying policy-driven decision-making to ambiguous requirements. The system eliminates the need for manual question-answering during spec generation.

**Current Capabilities**:
- Project-level default clarification policies
- Ticket-level policy overrides
- Hierarchical policy resolution (ticket > project > system default)
- AUTO policy with context-aware detection
- Policy-driven specification generation

---

## Clarification Policy System

**Purpose**: Users need to control how Claude resolves ambiguities during specification generation. The clarification policy system provides three strategies (AUTO, CONSERVATIVE, PRAGMATIC) that automatically resolve unclear requirements based on project needs, eliminating 5-10 manual questions per ticket.

### What It Does

The system provides policy-based automatic clarification resolution:

**Three Policy Strategies**:
- **AUTO** 🤖: Context-aware decisions (system default)
  - Detects sensitive keywords (payment, auth, PII) → applies CONSERVATIVE
  - Detects internal keywords (admin, debug, tool) → applies PRAGMATIC
  - Computes confidence score (0.0-1.0) based on detected signals
  - Falls back to CONSERVATIVE when confidence < 0.5 or conflicting signals

- **CONSERVATIVE** 🛡️: Security & quality first
  - Prioritizes security, scalability, and long-term maintainability
  - Strict validation, detailed error handling, short timeouts
  - Example: Short data retention (30-90 days), all fields required by default

- **PRAGMATIC** ⚡: Speed & simplicity first
  - Prioritizes simplicity and speed to market
  - Permissive validation, simple error messages, no artificial limits
  - Example: Keep data indefinitely, make fields optional with smart defaults

**Hierarchical Resolution**:
```
Effective Policy = ticket.clarificationPolicy ?? project.clarificationPolicy ?? 'AUTO'
```

**Time Savings**:
- **Before**: 10-15 minutes per spec (5-10 questions × 2 minutes each)
- **After**: 3-5 minutes per spec (automated resolution)
- **Cost Reduction**: ~$0.50 → ~$0.05 per feature (90% GitHub Actions savings)

### Requirements

**Policy Configuration**:
- Project settings include "Default Clarification Policy" selector
- Ticket creation includes optional "Clarification Policy" override
- Ticket detail view displays effective policy with edit capability
- Board view shows icon badges for tickets with policy overrides

**AUTO Policy Detection**:
- Keyword matching across title and description
- Sensitive keywords (payment, auth, PII, compliance) → CONSERVATIVE
- Internal keywords (admin, debug, tool, prototype) → PRAGMATIC
- Scalability keywords (millions of users, SLA) → CONSERVATIVE
- Confidence scoring: High (0.9), Medium (0.6), Low (0.3)
- Fallback to CONSERVATIVE when confidence < 0.5

**Specification Generation**:
- CONSERVATIVE/PRAGMATIC/AUTO policies generate complete specs without `[NEEDS CLARIFICATION]` markers
- INTERACTIVE policy preserves markers for future manual clarification phase
- All auto-resolved decisions documented in "Auto-Resolved Decisions" section
- Each decision includes: decision, rationale, policy applied, confidence (AUTO), trade-offs, reviewer notes

**UI Indicators**:
- Project settings: Select with 3 policy options + help text
- Ticket badges: Show effective policy with visual distinction
- Board badges: Small icons (🤖/🛡️/⚡) for overrides only
- Policy tooltips explain each strategy's philosophy

### Data Model

**ClarificationPolicy Enum**:
- Values: `AUTO`, `CONSERVATIVE`, `PRAGMATIC`, `INTERACTIVE`
- Used by Project and Ticket models

**Project Entity** (enhanced):
- `clarificationPolicy`: ClarificationPolicy enum, NOT NULL, default: `AUTO`
- Provides project-wide default policy for all tickets

**Ticket Entity** (enhanced):
- `clarificationPolicy`: ClarificationPolicy enum, NULLABLE
- null value means inherit from project
- Enables fine-grained control for exceptional cases

**Effective Policy Resolution**:
```typescript
const effectivePolicy = ticket.clarificationPolicy ??
                        ticket.project.clarificationPolicy ??
                        'AUTO';
```

---

## Workflow Integration

**Purpose**: The GitHub Actions workflow must apply the effective clarification policy when generating specifications. This ensures Claude resolves ambiguities according to the configured strategy rather than prompting with questions.

### What It Does

The workflow fetches and applies the effective policy during spec generation:

**Policy Resolution Flow**:
1. Workflow fetches ticket with nested project data
2. Workflow computes effective policy: `ticket ?? project ?? AUTO`
3. Workflow logs policy source ("ticket-level", "project-level", or "system default")
4. Workflow constructs JSON payload with policy
5. Workflow passes JSON to `/specify` command

**JSON Payload Structure**:
```json
{
  "featureDescription": "...",
  "clarificationPolicy": "AUTO" | "CONSERVATIVE" | "PRAGMATIC" | "INTERACTIVE"
}
```

**Command Execution**:
- `/speckit.specify` receives JSON with both description and policy
- Falls back to INTERACTIVE mode if JSON parsing fails
- Falls back to AUTO if `clarificationPolicy` field missing
- Applies policy-specific resolution guidelines during spec generation

### Requirements

**Workflow Steps**:
1. **Get effective clarification policy**: Fetch ticket, extract policies, resolve hierarchy
2. **Run /specify with policy**: Construct JSON payload, execute claude command

**API Integration**:
- GET `/api/projects/:projectId/tickets/:ticketId` includes `project.clarificationPolicy`
- Workflow validates both ticket and project policy fields exist
- Error handling: defaults to AUTO if fetch fails

**Logging**:
- Log detected policy source
- Log final effective policy used
- Include policy in workflow summary

### Data Model

**Workflow Output**:
```bash
echo "Using ticket-level policy: CONSERVATIVE"
echo "policy=CONSERVATIVE" >> $GITHUB_OUTPUT
```

**Claude Command**:
```bash
claude /speckit.specify '{"featureDescription":"...","clarificationPolicy":"CONSERVATIVE"}'
```

---

## /specify Command Enhancement

**Purpose**: The `/specify` command must parse the clarification policy and apply appropriate resolution strategies. This enables automated resolution of ambiguities without manual intervention.

### What It Does

The command parses policy and applies resolution guidelines:

**JSON Payload Parsing**:
- Detects JSON format (payload begins with `{`)
- Extracts `featureDescription` (required) and `clarificationPolicy` (optional)
- Defaults to INTERACTIVE for plain text input (backward compatibility)
- Defaults to AUTO if policy field missing

**Conditional Resolution Mode**:
- **INTERACTIVE**: Generate spec with `[NEEDS CLARIFICATION]` markers (current behavior)
- **AUTO/CONSERVATIVE/PRAGMATIC**: Apply resolution guidelines, generate complete spec

**AUTO Policy Context Detection**:
- Analyzes feature description for keywords
- Computes weighted score: sensitive keywords (+3), internal keywords (-2), scalability (+2)
- Calculates confidence based on score magnitude and conflicting signals
- Selects CONSERVATIVE if score ≥ 0, PRAGMATIC if score < 0
- Falls back to CONSERVATIVE if confidence < 0.5 or conflicting buckets ≥ 2

**Resolution Guidelines Application**:
- **CONSERVATIVE**: Security & quality first (strict validation, short timeouts, detailed errors)
- **PRAGMATIC**: Speed & simplicity first (permissive validation, no limits, simple errors)
- Complete decision matrix covers 15+ ambiguity categories

**Auto-Resolved Decisions Section**:
- Generated after Requirements section
- Documents each resolved ambiguity with rationale
- Includes policy applied, confidence (AUTO), trade-offs, reviewer notes
- Provides audit trail for review workflow

### Requirements

**Parsing Logic**:
- Detect JSON format by checking first character
- Handle malformed JSON → fallback to INTERACTIVE
- Support legacy plain text input
- Normalize policy to uppercase enum value

**AUTO Detection Algorithm**:
```
1. Extract keywords from feature description
2. Compute netScore = Σ(keyword weights)
3. Compute absScore = |netScore|
4. IF absScore >= 5 AND conflicting_buckets <= 1 → confidence = 0.9
5. ELSE IF absScore >= 3 → confidence = 0.6
6. ELSE → confidence = 0.3
7. IF confidence < 0.5 OR conflicting_buckets >= 2 → fallback to CONSERVATIVE
8. selectedPolicy = CONSERVATIVE if netScore >= 0 else PRAGMATIC
```

**Resolution Guidelines**:
- Data retention: CONSERVATIVE (30-90 days), PRAGMATIC (indefinitely)
- Required fields: CONSERVATIVE (all required), PRAGMATIC (optional with defaults)
- Error handling: CONSERVATIVE (detailed with recovery), PRAGMATIC (simple message)
- File limits: CONSERVATIVE (10MB), PRAGMATIC (no limits)
- Timeout durations: CONSERVATIVE (30s-1min), PRAGMATIC (longer)

**Documentation Format**:
```markdown
## Auto-Resolved Decisions

*Policy: CONSERVATIVE*
*Applied on: 2025-10-15*

- **[Ambiguity Topic]**: [Decision made]
  *Rationale*: [Explanation based on policy guidelines]
  *Trade-offs*: [Impacts on scope, quality, timeline]
  *Reviewer Notes*: [What humans must validate]
```

### Data Model

**Parsed Payload**:
```typescript
interface SpecifyPayload {
  featureDescription: string;  // Required
  clarificationPolicy?: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE';
}
```

**AUTO Detection Result**:
```typescript
interface AutoDetectionResult {
  detectedKeywords: string[];
  netScore: number;
  confidence: number;  // 0.0-1.0
  selectedPolicy: 'CONSERVATIVE' | 'PRAGMATIC';
  fallbackTriggered: boolean;
  fallbackReason?: string;
}
```

---

## API Enhancements

**Purpose**: API endpoints must expose and allow updates to clarification policy fields for both projects and tickets. This enables UI configuration and programmatic access.

### What It Does

The system extends existing APIs with policy fields:

**Project API** (`/api/projects/:id`):
- GET includes `clarificationPolicy` field
- PATCH allows updating `clarificationPolicy` with enum validation
- Zod schema validates: `z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE'])`

**Ticket API** (`/api/projects/:projectId/tickets/:ticketId`):
- GET includes `clarificationPolicy` (nullable) and nested `project.clarificationPolicy`
- PATCH allows updating `clarificationPolicy` (including null for reset)
- Zod schema validates: `z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).nullable()`

**Validation**:
- Invalid enum values return 400 error
- Null accepted for tickets (inheritance)
- Null rejected for projects (must have explicit policy)

### Requirements

**GET Responses**:
- Project: Include `clarificationPolicy` field (string enum)
- Ticket: Include both `clarificationPolicy` (nullable) and `project.clarificationPolicy`
- Enable client-side hierarchical resolution

**PATCH Requests**:
- Accept `clarificationPolicy` in request body
- Validate using Zod schemas
- Return updated policy in response
- Increment version for optimistic concurrency control

**Error Handling**:
- 400: Invalid enum value with Zod validation errors
- 404: Project or ticket not found
- 403: Unauthorized access (existing project ownership validation)

### Data Model

**Project GET Response**:
```typescript
{
  id: number;
  name: string;
  clarificationPolicy: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE';
  // ... other fields
}
```

**Ticket GET Response**:
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

**Zod Schemas**:
```typescript
// Project update
const projectUpdateSchema = z.object({
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).optional(),
  // ... other fields
});

// Ticket update
const ticketUpdateSchema = z.object({
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).nullable().optional(),
  // ... other fields
});
```

---

## Current State Summary

### Available Features

**Policy Configuration**:
- ✅ Project-level default policy (NOT NULL, default: AUTO)
- ✅ Ticket-level policy override (NULLABLE, inherits when null)
- ✅ Hierarchical resolution (ticket > project > system default)
- ✅ Three policy strategies (AUTO, CONSERVATIVE, PRAGMATIC)
- ✅ INTERACTIVE mode placeholder for future manual clarification

**AUTO Policy Intelligence**:
- ✅ Context-aware keyword detection
- ✅ Confidence scoring (0.0-1.0 scale)
- ✅ Fallback to CONSERVATIVE when uncertain
- ✅ Sensitive keyword detection (payment, auth, PII, compliance)
- ✅ Internal keyword detection (admin, debug, tool, prototype)
- ✅ Scalability keyword detection (millions of users, SLA)

**Specification Generation**:
- ✅ Policy-driven resolution guidelines
- ✅ Complete specs without `[NEEDS CLARIFICATION]` markers
- ✅ Auto-Resolved Decisions section with rationales
- ✅ Decision matrix for 15+ ambiguity categories
- ✅ Trade-off documentation and reviewer notes

**API Integration**:
- ✅ GET endpoints include clarification policy fields
- ✅ PATCH endpoints validate and update policies
- ✅ Zod schema validation for enum values
- ✅ Null handling for ticket policy reset

**Workflow Integration**:
- ✅ Effective policy resolution in GitHub Actions
- ✅ JSON payload construction with policy
- ✅ Policy source logging (ticket/project/system)
- ✅ Backward compatibility with plain text input

**UI Components**:
- ✅ Project settings policy selector
- ✅ Ticket creation policy field (optional)
- ✅ Ticket detail policy badge and edit dialog
- ✅ Board view policy badges (overrides only)
- ✅ Consistent icons (🤖 AUTO, 🛡️ CONSERVATIVE, ⚡ PRAGMATIC)

### User Workflows

**Configuring Project Default Policy**:
1. User navigates to project settings
2. User selects "CONSERVATIVE" from clarification policy dropdown
3. System updates project default policy
4. All new tickets inherit CONSERVATIVE policy

**Overriding Ticket Policy**:
1. User creates ticket for payment feature
2. User sets ticket-level policy to "CONSERVATIVE"
3. System stores override in ticket.clarificationPolicy
4. Ticket uses CONSERVATIVE regardless of project default

**Automatic Spec Generation with Policy**:
1. User creates ticket "Add payment processing" (inherits project AUTO policy)
2. User transitions ticket to SPECIFY stage
3. System resolves effective policy: AUTO → detects "payment" → applies CONSERVATIVE
4. Workflow generates complete spec with conservative resolutions
5. Spec includes "Auto-Resolved Decisions" section documenting choices
6. User reviews decisions before implementation

**Policy Reset**:
1. User opens ticket detail with CONSERVATIVE override
2. User clicks "Edit Policy" button
3. User selects "Use project default" option
4. System sets ticket.clarificationPolicy to null
5. Ticket now inherits project default (e.g., AUTO)

### Business Rules

**Policy Hierarchy**:
- Ticket-level policy overrides project policy
- Project policy overrides system default
- System default is AUTO (context-aware)
- null ticket policy means inherit from project

**AUTO Policy Behavior**:
- Sensitive features (payment, auth, PII) → CONSERVATIVE
- Internal features (admin, debug, tool) → PRAGMATIC
- Neutral features → CONSERVATIVE (safe default)
- Low confidence or conflicting signals → fallback to CONSERVATIVE

**Specification Generation**:
- CONSERVATIVE: Security-first with strict validation
- PRAGMATIC: Speed-first with simple implementations
- AUTO: Context-aware selection between CONSERVATIVE and PRAGMATIC
- INTERACTIVE: Preserves `[NEEDS CLARIFICATION]` markers (future phase)

**Policy Changes**:
- Policy changes do not retroactively affect existing specs
- Only future SPECIFY transitions use new policy
- Existing specs maintain original "Auto-Resolved Decisions" section

**Backward Compatibility**:
- Existing projects receive AUTO default during migration
- Existing tickets receive null (inherit from project)
- Plain text `/specify` input continues to work (INTERACTIVE mode)
- INTERACTIVE mode preserves current behavior with markers

### Technical Details

**Database**:
- PostgreSQL via Prisma ORM
- Enum: ClarificationPolicy (AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE)
- Project.clarificationPolicy: NOT NULL, default AUTO
- Ticket.clarificationPolicy: NULLABLE (inheritance)
- Migration adds enum and columns with defaults

**API Validation**:
- Zod schemas for enum validation
- Project: enum required (no null)
- Ticket: enum or null allowed
- 400 errors for invalid values

**Workflow Integration**:
- Bash script extracts policies using jq
- Resolves hierarchy with conditional logic
- Constructs JSON payload for claude command
- Logs policy source for debugging

**/specify Command**:
- JSON parsing with fallback to INTERACTIVE
- AUTO detection algorithm with confidence scoring
- Resolution guidelines for CONSERVATIVE and PRAGMATIC
- Auto-Resolved Decisions section generation

**UI Components**:
- shadcn/ui Select components
- Radix UI Dialog for edit modal
- Badge components for policy display
- Icons: 🤖 (AUTO), 🛡️ (CONSERVATIVE), ⚡ (PRAGMATIC)

**Performance**:
- Policy resolution: <50ms (no complex queries)
- AUTO detection: <500ms (keyword analysis)
- No impact on existing workflows (additive changes)
