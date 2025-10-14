# Auto-Resolution System for Spec Clarifications

**Created**: 2025-01-14
**Status**: Vision Document
**Estimation**: 5.5 days development

---

## 1. Overview

### Current Problem

The spec-kit workflow separates spec generation (`/specify`) from ambiguity clarification (`/clarify`):

1. `/specify` generates a spec with `[NEEDS CLARIFICATION: ...]` markers
2. User must then run `/clarify` which asks up to 5 interactive questions
3. Each question requires a roundtrip user → GitHub Actions workflow
4. Total time: 10-15 minutes, cost: ~$0.50 in GitHub Actions

**Limitations**:
- ❌ Slow workflow (multiple interactions)
- ❌ Complex infrastructure (intermediate states, webhooks)
- ❌ Expensive in GitHub Actions resources
- ❌ User friction (waiting between questions)

### Proposed Solution

Allow `/specify` to automatically resolve ambiguities according to a **clarification policy** configured per project and/or ticket.

**Benefits**:
- ✅ Single workflow (3-5 minutes instead of 10-15)
- ✅ 10x cheaper (~$0.05 vs $0.50)
- ✅ Zero interaction required for auto policies
- ✅ Flexibility: policy at project AND ticket level
- ✅ Backward compatible: INTERACTIVE mode preserves current behavior

---

## 2. Hierarchical Resolution Architecture

### Resolution Principle

```
effectivePolicy = ticket.clarificationPolicy ?? project.clarificationPolicy ?? 'AUTO'
```

**Hierarchy**:
1. **Ticket Policy** (if defined) → MAX priority (override for specific cases)
2. **Project Policy** (fallback) → Default for all tickets in project
3. **System Default: AUTO** → Ultimate fallback if nothing configured

### Use Cases

**Project with Mixed Policies**:
```
Project: AUTO (intelligent default)
  ├─ Ticket #1 "Add payment processing"
  │  └─ Policy: CONSERVATIVE (override - sensitive data)
  │
  ├─ Ticket #2 "Add admin debug panel"
  │  └─ Policy: PRAGMATIC (override - internal tool, speed)
  │
  └─ Ticket #3 "Add user profile page"
     └─ Policy: null (inherits AUTO from project)
```

**Secure Project with Exception**:
```
Project: CONSERVATIVE (quality/security by default)
  ├─ Ticket #1 "Add OAuth login"
  │  └─ Policy: null (inherits CONSERVATIVE - compliant)
  │
  └─ Ticket #2 "Add color picker for admin"
     └─ Policy: PRAGMATIC (override - need speed)
```

**Fast Prototype**:
```
Project: PRAGMATIC (rapid delivery)
  └─ All tickets: null (inherit PRAGMATIC)
```

---

## 3. The 3 Clarification Policies

### 🤖 AUTO - Context-Aware Intelligence

**Philosophy**: Claude analyzes context and automatically chooses the right approach.

**Context Detection**:
- **Sensitive keywords** → CONSERVATIVE
  - "payment", "financial", "bank", "transaction"
  - "auth", "login", "password", "security"
  - "personal data", "PII", "sensitive"

- **Internal keywords** → PRAGMATIC
  - "admin", "internal", "tool", "debug"
  - "prototype", "MVP", "exploratory"

- **Compliance indicators** → CONSERVATIVE
  - "GDPR", "PCI-DSS", "HIPAA", "SOC2"
  - "audit", "compliance", "regulatory"

**Scalability mentioned**:
- "millions of users", "high traffic" → CONSERVATIVE
- "prototype", "small team" → PRAGMATIC

#### Confidence Scoring Mechanics

AUTO assigns each detected signal a weight and derives both the recommended policy and a confidence score (0.0–1.0). The confidence score determines whether the decision can stand or must fall back to CONSERVATIVE.

| Signal Bucket              | Examples (non-exhaustive)                  | Weight | Policy Bias |
|----------------------------|-------------------------------------------|--------|-------------|
| Sensitive / Compliance     | payment, auth, PII, GDPR, PCI-DSS, audit  | +3     | CONSERVATIVE|
| Scalability / Reliability  | millions of users, mission critical, SLA  | +2     | CONSERVATIVE|
| Neutral Feature Context    | user-facing UI, general CRUD              | +1     | CONSERVATIVE|
| Internal / Speed Keywords  | admin, internal, prototype, MVP          | -2     | PRAGMATIC   |
| Explicit Speed Directive   | "optimize for speed", "temporary"       | -3     | PRAGMATIC   |

**Computation**:

```
netScore = Σ(weight for each signal)
absScore = |netScore|

if absScore >= 5 and conflicting buckets <= 1:
    confidence = 0.9 (High)
elif absScore >= 3:
    confidence = 0.6 (Medium)
else:
    confidence = 0.3 (Low)

selectedPolicy =
    CONSERVATIVE if netScore >= 0
    PRAGMATIC if netScore < 0 (unless manual override)
```

**Fallback Rules**:
- If `confidence < 0.5` OR there are ≥2 conflicting signal buckets (e.g., both compliance and prototype), AUTO MUST default to CONSERVATIVE and log the conflict in the `Auto-Resolved Decisions` section.
- Ticket overrides (if present) always win, independent of score.
- Medium confidence decisions require a reviewer note identifying assumptions to validate.

**Resolution Examples**:

**Feature: "User Login System"**
```
Detected context: "user-facing" + "auth" → CONSERVATIVE
Resolutions:
- Auth method: OAuth 2.0 with SSO support
- Password storage: bcrypt with cost factor 12
- Session management: JWT with 15-minute expiry
- MFA: Mandatory for all users
```

**Feature: "Admin Dashboard Analytics"**
```
Detected context: "admin" + "internal" → PRAGMATIC
Resolutions:
- Auth method: Email/password (simple)
- Data retention: Indefinite (simpler logic)
- Performance target: p95 < 2s (acceptable for internal)
```

**Feature: "Payment Processing"**
```
Detected context: "payment" (strong trigger) → CONSERVATIVE (forced)
Resolutions:
- Data retention: 7 years (PCI-DSS compliance)
- Encryption: At rest and in transit (required)
- Audit logs: Comprehensive logging (mandatory)
- Error handling: Idempotent operations (critical)
```

---

### 🛡️ CONSERVATIVE - Security & Quality First

**Philosophy**: Senior developer thinking long-term, scalability, security.

**Mindset**: "Better safe than sorry"

**Use Cases**:
- Applications handling sensitive data (finance, health, personal data)
- Projects that will scale (growing startup)
- Critical systems (payments, auth, infrastructure)
- Regulated environments (GDPR, HIPAA, PCI-DSS)

**Resolution Principles**:

**Authentication & Security**:
- Auth methods → OAuth 2.0, SSO, mandatory MFA
- Password storage → bcrypt cost factor 12+
- Session management → Short-lived JWT (15min) + refresh tokens
- Access control → Role-based + principle of least privilege
- Encryption → At rest and in transit (TLS 1.3)

**Data Management**:
- Data retention → Short (30-90 days) except compliance
- Backup strategy → 3-2-1 rule (3 copies, 2 media, 1 offsite)
- Data deletion → Hard delete + audit trail
- PII handling → Encryption, anonymization, right to erasure

**Performance & Scalability**:
- Performance targets → Aggressive (p95 < 500ms)
- Caching strategy → Multi-layer (Redis, CDN)
- Database → PostgreSQL with replication
- Scaling → Horizontal + anticipated sharding

**Error Handling & Observability**:
- Logging → Structured (JSON), centralized
- Monitoring → Proactive (Prometheus, Grafana)
- Alerting → Multi-channel, automatic escalation
- Error messages → Detailed but no sensitive info leaks

**Testing & Quality**:
- Test coverage → ≥80% unit, ≥70% integration
- Load testing → Anticipate 3x current load
- Security testing → OWASP Top 10, penetration testing
- Documentation → Comprehensive, always up-to-date

**Characteristics**:
- ✅ Battle-tested solutions (OAuth, PostgreSQL, Redis)
- ✅ Industry standards (REST, JSON, JWT)
- ✅ Anticipates scalability (cache, queues, sharding)
- ⚠️ Longer initial dev time
- ⚠️ Higher technical complexity

---

### ⚡ PRAGMATIC - Speed & Simplicity First

**Philosophy**: Startup mode, MVP mindset, "good enough for now".

**Mindset**: "Ship fast, iterate later"

**Use Cases**:
- Prototypes and MVPs
- Internal tools (low audience, full control)
- Exploratory features (hypothesis validation)
- Projects with tight deadlines
- Side projects / learning projects

**Resolution Principles**:

**Authentication & Security**:
- Auth methods → Simple email/password
- Password storage → bcrypt (default cost)
- Session management → Server-side sessions (simple)
- Access control → Basic roles (admin/user)
- Encryption → HTTPS only (TLS offloaded to proxy)

**Data Management**:
- Data retention → Indefinite (fewer edge cases)
- Backup strategy → Daily snapshots (simple)
- Data deletion → Soft delete (easier rollback)
- PII handling → Standard encryption

**Performance & Scalability**:
- Performance targets → Realistic (p95 < 2s for MVP)
- Caching strategy → In-memory (simple)
- Database → SQLite or PostgreSQL single instance
- Scaling → Vertical (upgrade server when needed)

**Error Handling & Observability**:
- Logging → Console logs + file rotation
- Monitoring → Basic (uptime checks)
- Alerting → Email notifications
- Error messages → User-friendly, simple

**Testing & Quality**:
- Test coverage → Critical paths only (~50%)
- Load testing → Deferred until needed
- Security testing → Standard best practices
- Documentation → Essential only, inline comments

**Characteristics**:
- ✅ Simple and direct solutions
- ✅ Avoids over-engineering ("YAGNI")
- ✅ Fast iterations (ship in days)
- ⚠️ Potential technical debt
- ⚠️ Possible future migrations

---

## 4. Decision Matrix by Ambiguity Type

**Important**: These decisions are **functional and business-oriented**, not technical implementation choices. Policies guide responses to the same types of questions that `/clarify` would ask.

### Examples of Real Clarifications (from existing specs)

**Spec #027 - Display Project Specifications**:
```
Q: Which markdown file should be displayed?
A: /specs/specifications/README.md

Q: What happens when no README.md file exists?
A: Always show icon - assume README.md will always exist

Q: Should there be navigation back to project board?
A: No - user can use browser back button

Q: How to handle markdown files with invalid formatting?
A: Show error message "Unable to render specifications"

Q: Should there be a maximum file size limit?
A: No limit - always attempt to render regardless of size
```

**Spec #020 - Real-Time Job Status Updates**:
```
Q: What real-time update mechanism should be used?
A: WebSocket connection

Q: When multiple jobs exist, which status to display?
A: Most recent active job (PENDING/RUNNING priority)

Q: How long should terminal statuses remain visible?
A: Persist indefinitely until new job starts

Q: Minimum display time for rapid status changes?
A: 500ms minimum per status

Q: FAILED vs CANCELLED visual distinction?
A: FAILED uses error red, CANCELLED uses neutral gray
```

**Spec #013 - Add Job Model**:
```
Q: Should system retain all job records or limit to recent N?
A: Retain all job records indefinitely

Q: Should jobs have maximum execution timeout?
A: Set timeout with configurable duration per command type

Q: Should branch/commitSha be required or optional?
A: Both optional - nullable when Git metadata unavailable

Q: What happens when ticket deleted while job running?
A: Job immediately cancelled and marked as failed

Q: How to handle very large log content?
A: Store full logs but compress or move to external storage
```

---

### Functional Resolution Matrix

| Business Ambiguity | CONSERVATIVE | PRAGMATIC | AUTO (Context) |
|-------------------|--------------|-----------|----------------|
| **Data retention** | Short period (30-90 days) to minimize risk | Keep indefinitely (simpler logic) | Payment/PII → Short; Internal → Indefinite |
| **Required vs Optional fields** | Strict validation, all fields required | Permissive, make fields optional with defaults | Critical data → Required; Nice-to-have → Optional |
| **Error handling behavior** | Show detailed errors with recovery options | Show simple error message | User-facing → Detailed; Internal → Simple |
| **File/content size limits** | Set conservative limits (e.g., 10MB) | No limits (always attempt) | Public upload → Limit; Internal → No limit |
| **Timeout durations** | Short timeouts (30s-1min, fail fast) | Long timeouts (5-10min, permissive) | Critical ops → Short; Batch jobs → Long |
| **Empty state handling** | Hide element when empty (cleaner UI) | Show placeholder/message always | User-facing list → Placeholder; Admin → Hide |
| **Multi-item display** | Show most recent/relevant only | Show all items (unlimited) | High volume → Limit to recent; Low volume → All |
| **Validation strictness** | Strict (block invalid input) | Permissive (allow with warning) | Financial data → Strict; Text fields → Permissive |
| **Default values** | Require explicit user choice (no defaults) | Provide smart defaults | Security settings → Explicit; Preferences → Defaults |
| **Confirmation prompts** | Confirm before destructive actions | Immediate action with undo toast | Delete/modify → Confirm; Reorderable → Undo |
| **Real-time updates** | WebSocket for instant updates | Polling every N seconds (simpler) | Collaborative → WebSocket; Status → Polling |
| **Display duration** | Minimum display time (prevent flicker) | No minimum (instant updates) | Status changes → Minimum 500ms; Static → Instant |
| **Cascade delete behavior** | Soft delete with retention period | Hard delete immediately | User data → Soft; System data → Hard |
| **Null/missing data display** | Show "N/A" or placeholder text | Hide field entirely | Optional field → Hide; Expected field → "N/A" |
| **Navigation behavior** | Explicit navigation controls | Use browser back/forward | Multi-step → Controls; Simple view → Browser |

---

### Resolution Principles by Policy

**CONSERVATIVE**:
- **Prudent and strict** choices
- Prefers security over convenience
- Anticipates edge cases
- Strong validation and explicit error handling
- **Example**: "Require confirmation before delete + show affected items count"

**PRAGMATIC**:
- **Simple and permissive** choices
- Prefers speed over perfection
- Assumes happy path
- Relaxed validation and minimal error handling
- **Example**: "Delete immediately with undo toast (5s)"

**AUTO**:
- **Context detection** then applies CONSERVATIVE or PRAGMATIC
- Sensitive keywords (payment, auth, PII) → CONSERVATIVE
- Internal keywords (admin, debug, tool) → PRAGMATIC
- Fallback: Analyze feature criticality

---

### Complete Resolution Examples

**Feature: "Display Project Specifications"**

**Ambiguity**: "What happens when README.md file doesn't exist?"

- **CONSERVATIVE**: Show error message "Specifications not found" with link to create one
  - *Rationale*: Explicit error handling, guides user to fix issue

- **PRAGMATIC**: Always show icon, assume README.md exists
  - *Rationale*: Simpler logic, fewer edge cases to handle

- **AUTO**: Detects "user-facing documentation" → **PRAGMATIC**
  - *Rationale*: Internal tool context, developers will create README as needed

---

**Feature: "Real-Time Job Status Updates"**

**Ambiguity**: "Minimum display time for status changes?"

- **CONSERVATIVE**: 500ms minimum display duration
  - *Rationale*: Prevents flicker, ensures users register state changes

- **PRAGMATIC**: No minimum, instant updates
  - *Rationale*: Simpler implementation, trusts fast updates are good

- **AUTO**: Detects "user-facing status display" → **CONSERVATIVE**
  - *Rationale*: UX quality matters for user-facing features

---

**Feature: "Add Job Model"**

**Ambiguity**: "Should branch/commitSha be required or optional?"

- **CONSERVATIVE**: Required fields with validation
  - *Rationale*: Ensures data completeness for debugging and traceability

- **PRAGMATIC**: Optional/nullable fields
  - *Rationale*: Simpler job creation, handles cases where Git metadata unavailable

- **AUTO**: Detects "tracking/debugging context" → **PRAGMATIC**
  - *Rationale*: Flexibility more important than strict data requirements

---

## 5. Database Schema Modifications

### Prisma Schema

**ClarificationPolicy Enum**:
```
AUTO          // Context-aware (system default)
CONSERVATIVE  // Security & quality first
PRAGMATIC     // Speed & simplicity first
INTERACTIVE   // Manual clarification (future)
```

**Project Model**:
- Add `clarificationPolicy` field (NOT NULL, default: 'AUTO')
- Default policy for all project tickets

**Ticket Model**:
- Add `clarificationPolicy` field (NULLABLE, default: null)
- Optional override of project policy
- If null → inherits project policy

### SQL Migration

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
```

---

## 6. API Endpoints

### GET `/api/projects/:id`

**Enhanced response**:
```json
{
  "id": 1,
  "name": "AI Board",
  "clarificationPolicy": "AUTO"
}
```

### GET `/api/projects/:projectId/tickets/:ticketId`

**Enhanced response with nested project**:
```json
{
  "id": 42,
  "title": "Add payment processing",
  "stage": "INBOX",
  "clarificationPolicy": "CONSERVATIVE",  // Ticket override
  "project": {
    "id": 1,
    "clarificationPolicy": "AUTO"  // Project default
  }
}
```

**Effective policy resolution in client**:
```typescript
const effectivePolicy = ticket.clarificationPolicy ?? ticket.project.clarificationPolicy ?? 'AUTO';
```

### PATCH `/api/projects/:id`

**Request body**:
```json
{
  "clarificationPolicy": "CONSERVATIVE"
}
```

### PATCH `/api/projects/:projectId/tickets/:ticketId`

**Request body**:
```json
{
  "clarificationPolicy": "CONSERVATIVE"  // or null to reset
}
```

**Zod validation**:
- Accepts enum values + null
- Null means "reset to project default"

---

## 7. Frontend UX

### 7.1 Project Settings

**Location**: `/projects/:id/settings`

**UI Component**: Card "Default Clarification Policy"

**Description**: "Applied to all new tickets unless overridden at ticket level"

**Select Options**:
- 🤖 AUTO - Context-aware decisions (default)
- 🛡️ CONSERVATIVE - Security & quality first
- ⚡ PRAGMATIC - Speed & simplicity first

**Tooltip/Help Text**:
- AUTO: "Claude analyzes the context and chooses the appropriate approach"
- CONSERVATIVE: "Prioritizes security, scalability, and long-term maintainability"
- PRAGMATIC: "Prioritizes simplicity and speed to market"

---

### 7.2 Ticket Creation Modal

**Field**: "Clarification Policy (optional)"

**Default**: `null` (empty select)

**Select Options**:
- "" (empty) → Use project default (${project.clarificationPolicy})
- 🤖 AUTO
- 🛡️ CONSERVATIVE
- ⚡ PRAGMATIC

**Help Text**: "Override project policy for this specific ticket. Leave empty to use project default."

---

### 7.3 Ticket Detail View

**Badge Display**:
- If `ticket.clarificationPolicy !== null`:
  - Badge with icon + name (e.g., "🛡️ CONSERVATIVE")
  - Distinctive color per policy

- If `ticket.clarificationPolicy === null`:
  - Badge with "(default)" (e.g., "🤖 AUTO (default)")
  - Neutral color

**Edit Button**: Opens dialog to modify policy

**Dialog Content**:
- Select with current value
- Option "Use project default" (set to null)
- "Save" button

---

### 7.4 Board View (Kanban)

**Visual Indicator on TicketCard**:

- **If ticket has override** (policy !== null):
  - Small badge in top-right corner of ticket
  - Icon only (space efficiency): 🛡️ / ⚡ / 🤖
  - Tooltip on hover showing full name

- **If ticket inherits from project** (policy === null):
  - No badge (avoids visual clutter)
  - All tickets without badge use project policy

**Rationale**: Makes exceptions (overrides) visible without cluttering the interface.

---

## 8. GitHub Actions Workflow

### 8.1 Fetch Effective Policy

**Step**: "Get effective clarification policy"

**Logic**:
1. Fetch ticket data with `include: { project: true }`
2. Extract `ticket.clarificationPolicy` (may be null)
3. Extract `project.clarificationPolicy` (fallback)
4. Resolution: `ticket_policy ?? project_policy ?? 'AUTO'`
5. Output: `policy=CONSERVATIVE`

**Logging**:
- "Using ticket-level policy: CONSERVATIVE" (if override)
- "Using project-level policy: AUTO" (if inherits)
- "Using system default: AUTO" (if nothing configured)

---

### 8.2 Pass Policy to /specify

**Step**: "Run /specify with effective policy"

**Command**:
```bash
claude --slash-command '/specify {"featureDescription":"'"$DESCRIPTION"'","clarificationPolicy":"'"${{ steps.get_policy.outputs.policy }}"'""}'
```

**Input /specify**:
- Parse JSON payload for `featureDescription` and optional `clarificationPolicy`
- Use provided `clarificationPolicy` directly; if absent, default to AUTO (fallback to INTERACTIVE when payload not JSON)

---

### 8.3 Workflow Simplification

**Before (with separate /clarify)**:
1. Run /specify → generates spec with [NEEDS CLARIFICATION]
2. Check if clarification needed
3. If yes → Job status NEEDS_CLARIFICATION
4. Wait for user answers (multiple rounds)
5. Run /clarify --continue for each answer
6. Job status COMPLETED

**After (with auto-resolution)**:
1. Get effective policy
2. Run `/specify {"featureDescription":...,"clarificationPolicy":"..."}` → generates complete spec
3. Job status COMPLETED

**Gain**:
- 1 workflow instead of 2-7
- 3-5 minutes instead of 10-15
- Zero user interaction for AUTO/CONSERVATIVE/PRAGMATIC

---

## 9. `/specify` Command Extension

### 9.1 Parse JSON Payload

**Input Format**:
```bash
/specify {"featureDescription":"Add user authentication","clarificationPolicy":"CONSERVATIVE"}
```

**Parsing in `$ARGUMENTS`**:
- Detect JSON payload (leading `{`).
- Extract `featureDescription` (required) and optional `clarificationPolicy` field.
- Use provided `clarificationPolicy` as the effective policy; if missing ➜ default to `AUTO` (or `INTERACTIVE` when payload is plain text).

---

### 9.2 Conditional Logic

**IF effective policy = INTERACTIVE** (no metadata provided):
- Current behavior preserved
- Generate spec with `[NEEDS CLARIFICATION: ...]` markers
- User will need to run `/clarify` next (future feature)

**IF effective policy = AUTO | CONSERVATIVE | PRAGMATIC**:
- DO NOT use `[NEEDS CLARIFICATION]`
- Resolve ambiguities inline according to policy guidelines
- Add "## Auto-Resolved Decisions" section with justifications

---

### 9.3 "Auto-Resolved Decisions" Section

**Placement**: After "## Requirements" section

**Content**:
- Header with applied policy and date
- List of resolved ambiguities
- For each resolution: decision + rationale

**Format**:
```markdown
## Auto-Resolved Decisions

*Policy: CONSERVATIVE*
*Applied on: 2025-01-14*

The following ambiguities were automatically resolved based on the configured policy:

- **Authentication Method**: OAuth 2.0 with SSO support
  *Rationale*: Industry standard, enhanced security, supports enterprise use cases

- **Data Retention**: 90-day retention with archival
  *Rationale*: GDPR compliant, balances legal requirements with performance

- **Performance Target**: p95 latency < 500ms
  *Rationale*: Ensures competitive UX, anticipates traffic growth
```

**Benefits**:
- ✅ Decision traceability
- ✅ Explicit justifications
- ✅ Facilitates review and audit
- ✅ Allows challenging/adjusting if needed

---

### 9.4 Resolution Guidelines by Policy

**Included in `/specify` prompt**:

Complete resolution guidelines for each policy (see sections 3.2 and 3.3) should be integrated into the `/specify.md` command prompt.

**Format**:
- Section "## Policy-Based Resolution Guidelines"
- Subsections per policy (CONSERVATIVE, PRAGMATIC, AUTO)
- Decision matrix for each common ambiguity type

---

### 9.5 Detailed Modifications to `.claude/commands/specify.md`

#### Current Command Structure
```markdown
---
description: Create or update the feature specification from a natural language feature description.
---

User input: $ARGUMENTS

Given that feature description, do this:

1. Run `.specify/scripts/bash/create-new-feature.sh --json "$ARGUMENTS"`
2. Load `.specify/templates/spec-template.md`
3. Write specification to SPEC_FILE
4. Report completion
```

#### Enhanced Command Structure

**Step 1: Parse Command Payload**

Add parsing logic at the beginning of the command:

```markdown
---
description: Create or update the feature specification from a natural language feature description.
---

User input: $ARGUMENTS

**STEP 1: PARSE COMMAND PAYLOAD**

Extract feature description and policy metadata from `$ARGUMENTS`:
- If payload begins with `{`, parse as JSON.
- Required field: `featureDescription` (string).
- Optional fields: `ticket.clarificationPolicy`, `project.clarificationPolicy`.
- Normalize policies to uppercase enum values (AUTO, CONSERVATIVE, PRAGMATIC, INTERACTIVE).
- Compute derived variables:
  - `TICKET_POLICY`
  - `PROJECT_POLICY`
  - `POLICY = TICKET_POLICY ?? PROJECT_POLICY ?? 'AUTO'`
- If payload is plain text (legacy usage), set `POLICY = 'INTERACTIVE'` and treat entire string as `FEATURE_DESCRIPTION`.

Example parsing:
- Input JSON: `{"featureDescription":"Add user authentication","clarificationPolicy":"CONSERVATIVE"}`
- POLICY = "CONSERVATIVE"
- FEATURE_DESCRIPTION = "Add user authentication"
```

**Step 2: Conditional Resolution Logic**

Add conditional logic for different policy modes:

```markdown
**STEP 2: DETERMINE RESOLUTION MODE**

IF POLICY = "INTERACTIVE":
  → Use current behavior: generate spec with [NEEDS CLARIFICATION: ...] markers
  → Skip to Step 6 (write spec normally)

IF POLICY = "AUTO" OR "CONSERVATIVE" OR "PRAGMATIC":
  → Apply auto-resolution guidelines below
  → DO NOT use [NEEDS CLARIFICATION] markers
  → Document resolutions in "Auto-Resolved Decisions" section
```

**Step 3: Auto-Resolution Guidelines**

Add comprehensive guidelines for each policy:

```markdown
**STEP 3: AUTO-RESOLUTION GUIDELINES**

When POLICY = "AUTO":
1. Analyze FEATURE_DESCRIPTION for context keywords
2. Security/Financial triggers → Apply CONSERVATIVE guidelines
   - Keywords: "payment", "financial", "bank", "transaction", "auth", "login", "password", "security", "personal data", "PII", "sensitive"
   - Compliance: "GDPR", "PCI-DSS", "HIPAA", "SOC2", "audit", "compliance", "regulatory"
3. Internal/Admin triggers → Apply PRAGMATIC guidelines
   - Keywords: "admin", "internal", "tool", "debug", "prototype", "MVP", "exploratory"
4. If no clear trigger → Apply PRAGMATIC (default fallback)
5. Log context detection: "AUTO policy detected [keyword] → applying [CONSERVATIVE/PRAGMATIC]"

When POLICY = "CONSERVATIVE":
Apply security & quality first principles:
- Data retention → Short period (30-90 days) unless compliance requires longer
- Required fields → Strict validation, all fields required by default
- Error handling → Detailed errors with recovery options
- File/content limits → Conservative limits (e.g., 10MB for uploads)
- Timeout durations → Short timeouts (30s-1min, fail fast)
- Empty states → Hide element when empty (cleaner UI)
- Multi-item display → Show most recent/relevant only
- Validation → Strict (block invalid input)
- Default values → Require explicit user choice (no defaults for critical settings)
- Confirmation prompts → Confirm before destructive actions
- Real-time updates → WebSocket for instant updates
- Display duration → Minimum display time (e.g., 500ms to prevent flicker)
- Cascade delete → Soft delete with retention period
- Null/missing data → Show "N/A" or placeholder text
- Navigation → Explicit navigation controls

When POLICY = "PRAGMATIC":
Apply speed & simplicity first principles:
- Data retention → Keep indefinitely (simpler logic)
- Required fields → Permissive, make fields optional with smart defaults
- Error handling → Simple error message
- File/content limits → No limits (always attempt)
- Timeout durations → Long timeouts (5-10min, permissive)
- Empty states → Show placeholder/message always
- Multi-item display → Show all items (unlimited)
- Validation → Permissive (allow with warning)
- Default values → Provide smart defaults
- Confirmation prompts → Immediate action with undo toast
- Real-time updates → Polling every N seconds (simpler)
- Display duration → No minimum (instant updates)
- Cascade delete → Hard delete immediately
- Null/missing data → Hide field entirely
- Navigation → Use browser back/forward
```

**Step 4: Functional Decision Matrix**

Include the complete decision matrix in the command:

```markdown
**STEP 4: FUNCTIONAL DECISION MATRIX**

For each ambiguity type, resolve according to policy:

| Ambiguity Type | CONSERVATIVE | PRAGMATIC |
|----------------|--------------|-----------|
| Data retention | Short period (30-90 days) to minimize risk | Keep indefinitely (simpler logic) |
| Required vs Optional fields | Strict validation, all fields required | Permissive, optional with defaults |
| Error handling behavior | Detailed errors with recovery options | Simple error message |
| File/content size limits | Conservative limits (e.g., 10MB) | No limits (always attempt) |
| Timeout durations | Short (30s-1min, fail fast) | Long (5-10min, permissive) |
| Empty state handling | Hide element when empty | Show placeholder/message always |
| Multi-item display | Show most recent/relevant only | Show all items (unlimited) |
| Validation strictness | Strict (block invalid input) | Permissive (allow with warning) |
| Default values | Require explicit choice | Provide smart defaults |
| Confirmation prompts | Confirm before destructive actions | Immediate action with undo toast |
| Real-time updates | WebSocket for instant updates | Polling every N seconds (simpler) |
| Display duration | Minimum time (e.g., 500ms) | No minimum (instant updates) |
| Cascade delete behavior | Soft delete with retention | Hard delete immediately |
| Null/missing data display | Show "N/A" or placeholder | Hide field entirely |
| Navigation behavior | Explicit navigation controls | Use browser back/forward |

Examples of resolution:
- "What happens when file doesn't exist?"
  - CONSERVATIVE: Show error message "File not found" with link to create
  - PRAGMATIC: Assume file exists, simpler logic

- "Should there be a minimum display time for status changes?"
  - CONSERVATIVE: 500ms minimum to prevent flicker
  - PRAGMATIC: No minimum, instant updates

- "Should branch field be required or optional?"
  - CONSERVATIVE: Required with validation
  - PRAGMATIC: Optional/nullable for flexibility
```

**Step 5: Generate Auto-Resolved Decisions Section**

Add instructions for the new section:

```markdown
**STEP 5: GENERATE AUTO-RESOLVED DECISIONS SECTION**

After writing the "## Requirements" section, add:

## Auto-Resolved Decisions

*Policy: [POLICY VALUE]*
*Applied on: [CURRENT DATE]*

The following ambiguities were automatically resolved based on the configured policy:

- **[Ambiguity Topic]**: [Decision made]
  *Rationale*: [Explanation based on policy guidelines]

- **[Ambiguity Topic]**: [Decision made]
  *Rationale*: [Explanation based on policy guidelines]

Example for CONSERVATIVE policy:
```markdown
## Auto-Resolved Decisions

*Policy: CONSERVATIVE*
*Applied on: 2025-01-14*

The following ambiguities were automatically resolved based on the configured policy:

- **Data Retention**: 90-day retention with automatic archival
  *Rationale*: Balances legal requirements with performance, GDPR compliant

- **Error Handling**: Detailed error messages with recovery suggestions
  *Rationale*: Enhances user experience and reduces support burden

- **Timeout Duration**: 30-second timeout for API calls
  *Rationale*: Fail-fast approach ensures system responsiveness
```

Example for PRAGMATIC policy:
```markdown
## Auto-Resolved Decisions

*Policy: PRAGMATIC*
*Applied on: 2025-01-14*

The following ambiguities were automatically resolved based on the configured policy:

- **Data Retention**: Indefinite retention
  *Rationale*: Simpler implementation, fewer edge cases to handle

- **File Size Limits**: No size limits
  *Rationale*: Always attempt to process, handle errors gracefully if needed

- **Validation**: Permissive validation with warnings
  *Rationale*: Faster development, allows flexibility for users
```
```

**Step 6: Modified Execution Steps**

Update the execution steps to be conditional:

```markdown
**STEP 6: EXECUTE SPECIFICATION GENERATION**

1. Parse the slash-command payload (JSON) to extract `featureDescription` and optional `clarificationPolicy`.
2. Run `.specify/scripts/bash/create-new-feature.sh --json "$featureDescription"`.
3. Load `.specify/templates/spec-template.md`.
4. Resolve the effective policy: use provided `clarificationPolicy` if present; otherwise default to `AUTO` (or `INTERACTIVE` when payload is plain text).
5. **CONDITIONAL WRITING**:

   IF POLICY = "INTERACTIVE":
     - Write spec using template guidelines
     - Use [NEEDS CLARIFICATION: specific question] markers for ambiguities
     - Follow template's "For AI Generation" section (mark ambiguities)

   IF POLICY = "AUTO" OR "CONSERVATIVE" OR "PRAGMATIC":
     - Write spec WITHOUT [NEEDS CLARIFICATION] markers
     - Apply resolution guidelines from Step 3 (including AUTO scoring & fallbacks)
     - Use decision matrix from Step 4
     - Generate Auto-Resolved Decisions section from Step 5
     - Document all automatic decisions with rationales, confidence, and trade-offs

6. Write specification to SPEC_FILE and ensure Auto-Resolved Decisions section is populated (or explicitly `- None`).
7. Report completion with policy used and reference the Auto-Resolved Decisions summary.

Example payload:

```bash
/specify {"featureDescription":"Add admin debug panel","clarificationPolicy":"PRAGMATIC"}
```
```

#### Complete Enhanced Command Example

```markdown
---
description: Create or update the feature specification from a natural language feature description.
---

User input: $ARGUMENTS

**STEP 1: PARSE COMMAND PAYLOAD**
[... parsing logic as above ...]

**STEP 2: DETERMINE RESOLUTION MODE**
[... conditional logic as above ...]

**STEP 3: AUTO-RESOLUTION GUIDELINES**
[... complete guidelines as above ...]

**STEP 4: FUNCTIONAL DECISION MATRIX**
[... complete matrix as above ...]

**STEP 5: GENERATE AUTO-RESOLVED DECISIONS SECTION**
[... section format as above ...]

**STEP 6: EXECUTE SPECIFICATION GENERATION**
[... modified execution as above ...]
```

#### Testing the Enhanced Command

Test cases to validate implementation:

1. **Test INTERACTIVE (default)**: `./specify "Add user authentication"`
   - Should generate spec with [NEEDS CLARIFICATION] markers
   - Preserves current behavior

2. **Test CONSERVATIVE**: `./specify '{"featureDescription":"Add payment processing","clarificationPolicy":"CONSERVATIVE"}'`
   - Should generate spec WITHOUT [NEEDS CLARIFICATION]
   - Should include "Auto-Resolved Decisions" section
   - Decisions should follow CONSERVATIVE guidelines

3. **Test PRAGMATIC**: `./specify '{"featureDescription":"Add admin dashboard","clarificationPolicy":"PRAGMATIC"}'`
   - Should generate spec WITHOUT [NEEDS CLARIFICATION]
   - Should include "Auto-Resolved Decisions" section
   - Decisions should follow PRAGMATIC guidelines

4. **Test AUTO with payment context**: `./specify '{"featureDescription":"Add payment processing","clarificationPolicy":"AUTO"}'`
   - Should detect "payment" keyword
   - Should apply CONSERVATIVE guidelines
   - Should log context detection

5. **Test AUTO with admin context**: `./specify '{"featureDescription":"Add admin debug panel","clarificationPolicy":"AUTO"}'`
   - Should detect "admin" keyword
   - Should apply PRAGMATIC guidelines
   - Should log context detection

---

## 10. Implementation Plan

### Phase 1: Database Schema (~0.5 day)

**Tasks**:
1. Create `ClarificationPolicy` enum in Prisma schema
2. Add `Project.clarificationPolicy` field (NOT NULL, default: 'AUTO')
3. Add `Ticket.clarificationPolicy` field (NULLABLE)
4. Generate Prisma migration
5. Test migration on dev DB

**Deliverables**:
- Validated SQL migration
- Updated Prisma schema
- Verified backward compatibility

---

### Phase 2: Backend API (~1 day)

**Tasks**:
1. GET `/api/projects/:id` exposes `clarificationPolicy`
2. GET `/api/projects/:id/tickets/:id` with nested `project.clarificationPolicy`
3. PATCH `/api/projects/:id` allows policy update
4. PATCH `/api/tickets/:id` allows policy update/reset (nullable)
5. Zod validation for enum values + null
6. Unit tests for API endpoints

**Deliverables**:
- 4 functional endpoints
- Complete Zod validation
- API test coverage ≥80%

---

### Phase 3: Frontend UI (~1.5 days)

**3.1 Project Settings** (~0.3 day):
- Card "Default Clarification Policy"
- Select with 3 options + icons
- Description and help text

**3.2 Ticket Creation Modal** (~0.3 day):
- Optional "Clarification Policy" field
- Select with "Use project default" option
- Explanatory help text

**3.3 Ticket Detail View** (~0.5 day):
- Badge displaying effective policy
- Visual distinction override vs default
- Edit policy dialog
- Reset to project default button

**3.4 Board View** (~0.4 day):
- Optional badge on TicketCard if override
- Icon only (space efficient)
- Tooltip on hover

**Deliverables**:
- 4 functional UI components
- Cohesive design system
- Responsive mobile/desktop

---

### Phase 4: GitHub Actions Workflow (~1 day)

**Tasks**:
1. Step "Get effective policy" with hierarchical resolution
2. API call to `/api/tickets/:id` (include project)
3. Resolution logic: ticket ?? project ?? 'AUTO'
4. Policy source logging
5. Embed ticket/project policy metadata in JSON payload sent to /specify
6. Remove /clarify check logic (simplification)
7. Test workflow with different policies

**Deliverables**:
- Simplified workflow (1 run instead of 2-7)
- Clear logging of policy used
- Tests on 3 main policies

---

### Phase 5: `/specify` Command Extension (~1.5 days)

**Tasks**:
1. Parse JSON payload for `featureDescription`, `ticket.clarificationPolicy`, `project.clarificationPolicy`
2. Compute effective policy (ticket override → project default → AUTO)
3. Conditional logic (INTERACTIVE vs AUTO/CONSERVATIVE/PRAGMATIC)
4. Implement resolution guidelines per policy (including AUTO scoring/fallback)
5. Generate "Auto-Resolved Decisions" section
6. Context detection for AUTO policy (keywords)
7. Local tests with spec-kit

**Deliverables**:
- Extended `/specify` command functional
- Validated resolution guidelines
- Tests with different feature descriptions

---

### Phase 6: Testing & Documentation (~1 day)

**E2E Tests**:
1. Test hierarchy: ticket override > project default > system default
2. Test CONSERVATIVE policy: spec with secure resolutions
3. Test PRAGMATIC policy: spec with simple resolutions
4. Test AUTO policy: context detection (payment → conservative, admin → pragmatic)
5. Test INTERACTIVE policy: current behavior preserved (with markers)
6. Test UI: ticket creation, policy edit, reset policy
7. Test complete workflow: ticket creation → job → spec generated

**Documentation**:
1. Update `CLAUDE.md` with clarification policies section
2. Resolution examples per policy
3. User guide: when to use which policy
4. Developer guide: how to extend guidelines

**Deliverables**:
- E2E test coverage ≥80%
- Complete user documentation
- Technical developer documentation

---

## 11. Comparison with Interactive Solution

### Interactive Architecture (Not Implemented)

**Flow**:
1. /specify generates spec with [NEEDS CLARIFICATION]
2. Job status → NEEDS_CLARIFICATION
3. Frontend displays questions one by one
4. User answers → webhook triggers workflow
5. /clarify --continue applies answer
6. Repeat for 5 questions max
7. Job status → COMPLETED

**Complexity**:
- Intermediate states (NEEDS_CLARIFICATION)
- Bidirectional webhooks
- Frontend polling
- 5-7 workflows triggered
- Modal dialog with stepper

### Auto-Resolution Architecture (Proposed)

**Flow**:
1. Get effective policy
2. `/specify {"featureDescription":...,"clarificationPolicy":"..."}` generates complete spec
3. Job status → COMPLETED

**Simplicity**:
- No intermediate state
- Single workflow
- Zero user interaction
- Simple project/ticket configuration

---

### Detailed Comparison

| Criterion | Interactive | Auto-Resolution |
|-----------|-------------|-----------------|
| **GitHub Workflows** | 2-7 runs | 1 run |
| **Total time** | 10-15 min | 3-5 min |
| **GitHub Actions cost** | ~$0.50 | ~$0.05 |
| **User interactions** | 5-10 questions | 0 (config 1x) |
| **Backend complexity** | High (states, webhooks) | Minimal (1 DB field) |
| **Frontend complexity** | Medium (dialog, polling) | Simple (settings UI) |
| **Maintainability** | Difficult | Very simple |
| **Flexibility** | Fine (question by question) | Coarse (3 policies) |
| **Traceability** | Questions/answers in spec | Rationales in spec |
| **Pedagogy** | Explicit (asks questions) | Implicit (documented decisions) |

---

### When to Use Each Approach?

**Auto-Resolution (90% of cases)**:
- ✅ Projects with clear philosophy (startup, enterprise, etc.)
- ✅ Standard features (auth, CRUD, dashboards)
- ✅ Teams wanting rapid delivery
- ✅ Projects with established patterns

**Interactive (10% of cases)**:
- 🎓 Complex features requiring fine-grained thought
- 🎓 Ambiguous contexts (new business domain)
- 🎓 Decisions with high business impact
- 🎓 Team learning (pedagogical)

---

## 12. Limitations and Trade-offs

### Limitations of Auto-Resolution

**Less granularity**:
- Only 3 policies (vs infinite questions)
- Some nuances may be lost
- User doesn't see questions explicitly

**Context dependence**:
- AUTO policy may misidentify context
- Keyword detection not infallible
- Requires clear feature descriptions

**Over/Under-engineering**:
- CONSERVATIVE policy may over-complicate MVPs
- PRAGMATIC policy may neglect critical aspects
- Manual adjustment sometimes needed post-spec

---

### Accepted Trade-offs

**Speed gain vs Granularity**:
- 3-5 min vs 10-15 min = acceptable
- 3 policies vs unlimited questions = sufficient for 90% of cases

**Simplicity vs Flexibility**:
- Simple configuration (1 select) vs complex dialog = preferable
- Established patterns (CONSERVATIVE/PRAGMATIC) vs custom = scalable

**Automation vs Control**:
- Automatic decisions vs manual validation = justified for time savings
- Documented rationales = sufficient transparency

---

## 13. Future Extensions

### 13.1 Custom Rules (Phase 7+)

Allow fine-grained overrides at project level:

**Example**:
```json
{
  "overrides": {
    "auth": "CONSERVATIVE",      // Force conservative for auth
    "performance": "PRAGMATIC",  // Force pragmatic for perf
    "data_retention": "AUTO"     // Let AUTO decide
  },
  "keywords": {
    "payment": "CONSERVATIVE",   // If "payment" → conservative
    "admin": "PRAGMATIC"         // If "admin" → pragmatic
  }
}
```

---

### 13.2 Full INTERACTIVE Mode (Phase 8+)

Implement complete interactive workflow for complex cases:

**Architecture**:
- INTERACTIVE policy at ticket level
- Job status NEEDS_CLARIFICATION
- Frontend displays questions sequentially
- /clarify workflow applies answers
- "Clarifications" section with Q&A

**Estimated complexity**: +5 additional dev days

---

### 13.3 Learning System (Phase 9+)

Learn from user choices to refine AUTO policy:

**Concept**:
- Track manual post-spec modifications
- Identify patterns (e.g., user often changes auth method)
- Adjust AUTO heuristics accordingly
- Suggestions "Based on your past choices, we recommend CONSERVATIVE for this feature"

---

## 14. Success Metrics

### Performance Metrics

**Spec generation time**:
- Before: 10-15 minutes (specify + clarify)
- Target: 3-5 minutes (specify with auto-resolution)
- Measure: GitHub Actions workflow duration (start → completed)

**GitHub Actions cost**:
- Before: ~$0.50 per feature (7 workflows)
- Target: ~$0.05 per feature (1 workflow)
- Measure: Minutes consumed per job

---

### Adoption Metrics

**Policy usage rate**:
- Target: 70% of projects configure a custom policy (non-AUTO)
- Measure: % projects with policy != AUTO

**Policy distribution**:
- Target: 40% AUTO, 35% CONSERVATIVE, 25% PRAGMATIC
- Measure: Distribution of values in DB

**Ticket-level overrides**:
- Target: 20% of tickets have policy override
- Measure: % tickets with clarificationPolicy != null

---

### Quality Metrics

**Complete specs generated**:
- Target: 95% of specs without remaining [NEEDS CLARIFICATION]
- Measure: Scan generated specs

**User satisfaction**:
- Target: 80% satisfaction with auto-resolution
- Measure: Post-implementation survey

**Manual post-spec revisions**:
- Target: <30% of specs require manual adjustments
- Measure: Number of post-/specify commits on spec.md

---

## 15. Risks and Mitigations

### Risk 1: Poorly Calibrated AUTO Policy

**Description**: Context detection misses keywords and applies wrong policy.

**Impact**: Spec with inappropriate resolutions (over/under-engineering).

**Probability**: Medium

**Mitigation**:
1. Test context detection with dataset of 50+ real feature descriptions
2. Conservative fallback: if doubt → ask for more info or choose CONSERVATIVE
3. Allow review and post-generation edit (always possible)
4. Learning system in future phase to improve heuristics

---

### Risk 2: User Resistance (Loss of Control)

**Description**: Users prefer explicit questions vs automatic decisions.

**Impact**: Feature non-adoption, rollback requests.

**Probability**: Low to Medium

**Mitigation**:
1. Keep INTERACTIVE policy available (current behavior)
2. Transparent and documented "Auto-Resolved Decisions" section
3. Allow manual spec editing post-generation
4. Clear communication: "3x time savings, always modifiable"

---

### Risk 3: Outdated Guidelines

**Description**: Best practices evolve (e.g., bcrypt → argon2), guidelines become outdated.

**Impact**: Specs generated with outdated recommendations.

**Probability**: Low (timeline: 1-2 years)

**Mitigation**:
1. Versioned guidelines documentation
2. Quarterly review of recommendations
3. Override possibility via custom rules (future phase)
4. Community can propose updates via PRs

---

### Risk 4: Spec Template Complexity

**Description**: Deep upstream spec-kit template modifications break compatibility.

**Impact**: Conflicts during spec-kit updates, requires refactor.

**Probability**: Medium

**Mitigation**:
1. Custom extension decoupled from core template
2. "Auto-Resolved Decisions" section is additive (no template modification)
3. Monitor upstream spec-kit releases
4. Regression tests during updates

---

## 16. Final Decision

### Retained Approach

**Auto-Resolution with Ticket > Project Hierarchy** for the following reasons:

1. **Exceptional ROI**: 10x faster, 10x cheaper
2. **Technical simplicity**: 1 DB field, 1 workflow, zero complex state
3. **Maximum flexibility**: Policy at ticket AND project level
4. **Backward compatible**: INTERACTIVE mode preserves current behavior
5. **Extensible**: Custom rules and learning system in future phases

### Not Implemented (For Now)

**Full INTERACTIVE Mode**:
- Deferred to phase 8+ (if requested by users)
- High complexity, marginal benefit for 90% of cases
- Fallback: manual post-spec editing is sufficient

**Custom Rules**:
- Deferred to phase 7+ (if patterns emerge)
- 3 policies cover majority of needs
- Premature over-engineering

---

## 17. Next Steps

### Pre-Implementation Validation

1. **Review with stakeholders**: Validate approach and priorities
2. **Prototype UI mockups**: Validate UX with users
3. **Test guidelines locally**: Validate resolutions with spec-kit
4. **Final estimation**: Confirm 5.5 days timeline

### Start Phase 1

- [ ] Create feature branch `feature/auto-resolution-clarifications`
- [ ] Setup Prisma migration (enum + columns)
- [ ] Implement hierarchical resolution backend
- [ ] Daily standups for progress tracking

---

**Document Status**: ✅ Vision Complete - Ready for Implementation
