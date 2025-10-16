# Data Model: Branch Link in Ticket Details

**Feature**: 033-link-to-branch
**Phase**: 1 - Design & Contracts
**Date**: 2025-10-16

## Summary

**No Data Model Changes Required**: This feature uses existing database fields without modifications.

## Existing Entities (Read-Only)

### Ticket Entity

**Purpose**: Stores ticket information including associated Git branch name

**Relevant Fields**:
- `id` (number): Unique ticket identifier
- `branch` (string | null): Git branch name associated with this ticket
- `stage` (Stage enum): Current workflow stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- `projectId` (number): Foreign key to Project

**Usage in Feature**:
- `ticket.branch`: Determines if branch link should be rendered (must be non-null/non-empty)
- `ticket.stage`: Controls visibility (link hidden when stage === 'SHIP')

**No Changes Needed**: All required fields already exist

---

### Project Entity

**Purpose**: Stores project configuration including GitHub repository information

**Relevant Fields**:
- `id` (number): Unique project identifier
- `githubOwner` (string): GitHub repository owner/organization (e.g., "facebook")
- `githubRepo` (string): GitHub repository name (e.g., "react")

**Usage in Feature**:
- Combined to construct GitHub branch URL: `https://github.com/{githubOwner}/{githubRepo}/tree/{branch}`

**No Changes Needed**: All required fields already exist

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Component: ticket-detail-modal.tsx                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Props Received:                                              │
│  ┌─────────────────────────────────────┐                    │
│  │ ticket: {                            │                    │
│  │   branch: string | null              │ ← From parent     │
│  │   stage: Stage                       │ ← From parent     │
│  │   project: {                         │ ← From parent     │
│  │     githubOwner: string              │                   │
│  │     githubRepo: string               │                   │
│  │   }                                  │                   │
│  │ }                                    │                   │
│  └─────────────────────────────────────┘                    │
│                         │                                    │
│                         ↓                                    │
│  ┌─────────────────────────────────────┐                    │
│  │ Visibility Logic:                   │                    │
│  │  - ticket.branch !== null           │                   │
│  │  - ticket.stage !== 'SHIP'          │                   │
│  │  - githubOwner && githubRepo exist  │                   │
│  └─────────────────────────────────────┘                    │
│                         │                                    │
│                         ↓                                    │
│  ┌─────────────────────────────────────┐                    │
│  │ URL Construction:                   │                    │
│  │  buildGitHubBranchUrl(              │                   │
│  │    owner,                            │                   │
│  │    repo,                             │                   │
│  │    encodeURIComponent(branch)        │                   │
│  │  )                                   │                   │
│  └─────────────────────────────────────┘                    │
│                         │                                    │
│                         ↓                                    │
│  ┌─────────────────────────────────────┐                    │
│  │ Render:                              │                   │
│  │  <a href={githubUrl}                 │                   │
│  │     target="_blank"                  │                   │
│  │     rel="noopener noreferrer">       │                   │
│  │    <GitBranch /> View in GitHub      │                   │
│  │  </a>                                │                   │
│  └─────────────────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Rules (Existing)

### Ticket.branch Validation (Prisma Schema)
- Type: `String?` (nullable)
- Max Length: 200 characters
- Validation: Applied at API level via Zod schema

### Project.githubOwner / githubRepo Validation (Prisma Schema)
- Type: `String` (required)
- Validation: Non-empty strings enforced at project creation

**Feature-Specific Validation** (Component-Level):
```typescript
// All checks must pass for link to render
const shouldRenderBranchLink = Boolean(
  ticket.branch &&                          // Branch exists
  ticket.branch.length > 0 &&               // Branch non-empty
  ticket.stage !== 'SHIP' &&                // Not in SHIP stage
  ticket.project?.githubOwner &&            // Owner exists
  ticket.project?.githubRepo                // Repo exists
);
```

---

## State Transitions (No Impact)

**Stage Transitions**: Ticket stage changes via existing API endpoints

**Feature Behavior**:
- **INBOX → SPECIFY**: Branch link appears if branch set during transition
- **SPECIFY → PLAN**: Branch link remains visible
- **PLAN → BUILD**: Branch link remains visible
- **BUILD → VERIFY**: Branch link remains visible
- **VERIFY → SHIP**: **Branch link disappears** (conditional rendering)

**Rollback Behavior**:
- **SHIP → VERIFY**: Branch link reappears if ticket still has branch value

---

## Relationships (No Changes)

```
┌──────────────┐         ┌──────────────┐
│   Project    │         │    Ticket    │
├──────────────┤         ├──────────────┤
│ id           │◄────────│ projectId    │
│ githubOwner  │   1:N   │ branch       │
│ githubRepo   │         │ stage        │
└──────────────┘         └──────────────┘
                                │
                                │ (Read-only for link rendering)
                                ↓
                         ┌──────────────┐
                         │  GitHub URL  │
                         ├──────────────┤
                         │ Constructed  │
                         │ on render    │
                         └──────────────┘
```

**No Foreign Key Changes**: Uses existing Ticket → Project relationship

---

## Indexing (No Changes)

**Existing Indexes** (already optimized):
- `Ticket.projectId`: Indexed for project-scoped queries
- `Project.id`: Primary key index

**No New Indexes Required**: Feature reads existing data without performance impact

---

## Migration Status

**No Migrations Required**: Zero database schema changes

**Verification**:
```bash
# Verify existing fields
npx prisma studio
# Check Ticket model has `branch` field (nullable string)
# Check Project model has `githubOwner` and `githubRepo` fields (required strings)
```

---

## TypeScript Interfaces

### Component Props Interface (Existing)

```typescript
// Already defined in ticket-detail-modal.tsx
interface TicketData {
  id: number;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;           // ← Used for branch link
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: 'FULL' | 'QUICK';
  createdAt: Date | string;
  updatedAt: Date | string;
  project?: {                      // ← Used for GitHub URL construction
    clarificationPolicy: ClarificationPolicy;
    githubOwner?: string;          // ← Optional in type (may be missing)
    githubRepo?: string;           // ← Optional in type (may be missing)
  };
}
```

### Helper Function Signature (New)

```typescript
/**
 * Constructs GitHub branch URL with proper encoding
 * @param owner - GitHub repository owner/organization
 * @param repo - GitHub repository name
 * @param branch - Git branch name (will be URL encoded)
 * @returns Fully qualified GitHub branch tree URL
 */
function buildGitHubBranchUrl(
  owner: string,
  repo: string,
  branch: string
): string;
```

---

## Data Access Patterns

### Read-Only Access
- Component receives `ticket` prop from parent (Board component)
- Parent fetches ticket data via existing API: `GET /api/projects/:projectId/tickets/:id`
- No additional queries needed for this feature

### No Write Operations
- Feature is purely presentational (renders link)
- No state changes to database
- No API calls initiated by feature

---

## Assumptions

1. **Branch field populated by workflows**: Assumes GitHub Actions workflows set `ticket.branch` via API
2. **Project configuration complete**: Assumes projects have valid `githubOwner` and `githubRepo` values
3. **Branch naming convention**: No assumptions made; handles any valid Git branch name
4. **SHIP stage semantics**: Assumes SHIP stage means "deployed and branch no longer needed"

---

## Future Considerations (Out of Scope)

### Potential Enhancements (Not Implemented)
1. **Branch existence validation**: Could add API check to verify branch still exists on GitHub
2. **Branch metadata**: Could display last commit info, author, or age
3. **PR association**: Could link to associated pull request if branch has one
4. **Branch deletion detection**: Could show "Branch deleted" message instead of link

**Decision**: Keep initial implementation simple and add enhancements based on user feedback
