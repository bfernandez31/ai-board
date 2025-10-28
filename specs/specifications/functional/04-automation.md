# Automation - Functional Specification

## Purpose

The automation system enables AI-powered workflows that automatically generate specifications, plans, and implementations when tickets move through workflow stages.

## Workflow Jobs

### Job Creation

A job is created each time a ticket transitions between stages:

- **INBOX → SPECIFY**: Creates specification generation job
- **SPECIFY → PLAN**: Creates planning job
- **PLAN → BUILD**: Creates implementation job
- **INBOX → BUILD**: Creates quick implementation job (bypasses specification and planning)

### Job Status Lifecycle

Jobs progress through status states:

1. **PENDING**: Job created, waiting to start
2. **RUNNING**: GitHub Actions workflow executing
3. **COMPLETED**: Workflow finished successfully
4. **FAILED**: Workflow encountered error
5. **CANCELLED**: Workflow manually stopped

### Job Tracking

Users can monitor job progress:

- Job status displays in ticket detail view
- Status updates automatically every 2 seconds via polling
- Visual indicators show current state (pending, running, completed, failed)
- Polling stops automatically when job reaches terminal state
- Board automatically refreshes when job completes and ticket stage changes

### Job Restrictions

**Concurrent Job Prevention**:
- Only one job can run per ticket at a time
- New stage transitions blocked while job is PENDING or RUNNING
- Clear error message explains job must complete first
- AI-BOARD mentions disabled during active jobs

**Validation**:
- System checks for active jobs before creating new job
- Race condition protection prevents concurrent job creation
- Optimistic concurrency control ensures data consistency

## Specification Generation

### Automatic Trigger

When ticket moves from INBOX to SPECIFY stage:

1. System creates job record (PENDING status)
2. GitHub Actions workflow dispatches
3. Workflow creates Git feature branch
4. AI generates specification based on ticket title and description
5. Specification written to specs/{num}-{description}/spec.md
6. Changes committed and pushed to branch
7. Ticket branch field updated with branch name
8. Job status updates to COMPLETED

### Specification Content

Generated specifications include:

- **User Scenarios**: Primary user story and acceptance scenarios
- **Functional Requirements**: Detailed, testable requirements
- **Key Entities**: Data models and relationships
- **Auto-Resolved Decisions**: Clarifications made by AI with rationale

### Clarification Policies

Specifications can be generated using different resolution strategies:

**AUTO (Context-Aware)**:
- Analyzes ticket description for keywords
- Applies CONSERVATIVE for sensitive features (payment, auth, security)
- Applies PRAGMATIC for internal tools (admin, debug)
- Falls back to CONSERVATIVE when confidence is low
- Documents context detection in specification

**CONSERVATIVE (Security-First)**:
- Prioritizes security and quality
- Short data retention periods
- Strict field validation
- Detailed error handling
- Conservative limits and timeouts

**PRAGMATIC (Speed-First)**:
- Prioritizes simplicity and speed
- Permissive validation
- Simple error messages
- No artificial limits
- Fast time-to-market

**INTERACTIVE (Manual)**:
- Generates specification with [NEEDS CLARIFICATION] markers
- Preserves existing behavior for manual clarification
- Future feature: Interactive question-answer workflow

### Policy Configuration

**Project Default**:
- Each project has a default clarification policy
- Defaults to AUTO if not configured
- Applies to all new tickets in the project

**Ticket Override**:
- Individual tickets can override project default
- Enables fine-grained control for exceptional cases
- Setting to null reverts to project default

**Hierarchical Resolution**:
- Effective policy = ticket policy ?? project policy ?? AUTO
- Ticket-level override takes precedence
- Project-level default applies when ticket has no override
- System default (AUTO) applies if neither is set

## Planning Generation

### Automatic Trigger

When ticket moves from SPECIFY to PLAN stage:

1. System validates specification exists
2. Creates planning job
3. GitHub Actions workflow executes
4. AI reads spec.md and generates plan.md
5. AI generates tasks.md with implementation steps
6. Changes committed to feature branch
7. Job status updates to COMPLETED

### Planning Content

Generated plans include:

- **Implementation Approach**: Technical strategy and architecture
- **Component Design**: Detailed component specifications
- **Task Breakdown**: Step-by-step implementation tasks
- **Testing Strategy**: Unit, integration, and E2E test requirements

### Consistency Enforcement

When planning is generated:
- Plan must align with specification requirements
- Tasks must implement all functional requirements
- No requirements can be dropped or modified
- AI ensures consistency across all three documents (spec.md, plan.md, tasks.md)

## Implementation Execution

### Normal Implementation (PLAN → BUILD)

When ticket moves from PLAN to BUILD stage:

1. System validates plan and tasks exist
2. Creates implementation job
3. Workflow executes /implement command
4. AI reads spec.md, plan.md, and tasks.md
5. AI implements features according to plan
6. Code changes committed to feature branch
7. Job status updates to COMPLETED

### Quick Implementation (INBOX → BUILD)

When ticket moves directly from INBOX to BUILD:

**Confirmation Required**:
- Warning modal appears before transition
- Modal explains trade-offs: speed vs. documentation
- User must explicitly confirm or cancel

**Workflow Differences**:
- Bypasses specification and planning stages
- Creates minimal spec.md with only title and description
- Executes /quick-impl command instead of /implement
- AI implements based solely on title and description context
- No formal requirements or planning documents

**Use Cases**:
- Bug fixes (typos, small corrections)
- UI tweaks (styling, spacing)
- Simple refactoring (renaming, organization)
- Documentation updates

**Not Recommended For**:
- Complex features requiring architecture
- Changes affecting multiple modules
- New APIs or database changes
- Features requiring detailed planning

## Branch Management

### Branch Creation

Workflows automatically create Git feature branches:

**Branch Naming**:
- Format: `{num}-{description}`
- Example: `042-ticket-comments-context`
- Number: Zero-padded 3-digit ticket number
- Description: Kebab-case slug from ticket title (first 3 words)

**Branch Lifecycle**:
1. Workflow checks out main branch
2. Script creates new feature branch
3. All changes committed to feature branch
4. Branch name stored in ticket.branch field
5. Subsequent workflows use existing branch

### Branch Updates

Each workflow stage adds to the same branch:
- SPECIFY: Creates specs/{num}-{description}/spec.md
- PLAN: Adds plan.md and tasks.md to specs directory
- BUILD: Adds implementation code to project
- AI-BOARD comments: Modifies existing spec/plan files

**Atomic Commits**:
- Each workflow stage creates one commit
- All file changes in stage committed together
- No partial commits or incomplete states
- Clear commit messages describe changes

## Workflow Execution

### GitHub Actions Integration

Workflows execute on GitHub Actions infrastructure:

**Workflow Files**:
- `.github/workflows/speckit.yml`: Normal workflow (SPECIFY → PLAN → BUILD)
- `.github/workflows/quick-impl.yml`: Quick implementation (INBOX → BUILD)
- `.github/workflows/ai-board-assist.yml`: AI-BOARD comment responses

**Inputs**:
- Ticket ID, title, description
- Project ID for context
- Job ID for status tracking
- Branch name (empty for new branches)
- User information (for AI-BOARD mentions)
- Comment content (for AI-BOARD requests)

**Authentication**:
- GitHub token for repository access
- API token for status updates
- Anthropic API key for Claude access

### Workflow Timeouts

**Default Limits**:
- Maximum execution time: 120 minutes
- Typical execution: 2-5 minutes for specification
- Network timeout: 15 seconds for API calls

**Timeout Behavior**:
- Workflow fails if execution exceeds limit
- Job status updates to FAILED
- User receives no response (GitHub Actions timeout)
- User can retry by creating new stage transition

## Error Handling

### Workflow Failures

When workflows encounter errors:

**Job Status**:
- Status updates to FAILED
- Timestamp records failure time
- User sees error indicator in UI

**Error Messages**:
- User-friendly error descriptions
- Link to GitHub Actions logs for details
- Suggestion to use alternative workflow if applicable

**Recovery**:
- User can view error details
- User can retry by creating new transition
- Failed jobs don't block future operations

### Network Failures

**API Timeouts**:
- 15-second timeout for ticket creation
- Network error displays retry option
- Clear messaging explains failure

**Optimistic Updates**:
- UI updates immediately (optimistic)
- Rollback occurs if API call fails
- User sees current database state after rollback

## Test Environment Behavior

### Test Ticket Detection

Tickets with "[e2e]" prefix in title:
- Workflows execute but skip expensive Claude CLI steps
- Post skip message comment
- Update job status to COMPLETED
- No Claude API calls logged
- Enables fast test execution without API costs

### Test Data Isolation

Test workflows maintain separation:
- Test tickets identified by [e2e] prefix
- Production workflows unaffected by test execution
- API credits not consumed for test tickets
