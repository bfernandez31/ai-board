---
command: "/sync-specifications"
category: "Documentation"
purpose: "Synchronize branch specifications with global project documentation"
---

# Sync-Specifications Command

Synchronizes changes from a feature branch's specifications to the global project documentation in `specs/specifications/`.

## Purpose

This command ensures that after implementation or iteration:
1. Global functional specifications reflect new user-facing behaviors
2. Global technical documentation includes implementation details
3. CLAUDE.md is updated with any new patterns or conventions
4. All documentation remains consistent and current

## Arguments

- `--branch`: The feature branch (e.g., "051-897-feature")
- `--source`: Source directory (default: specs/$BRANCH/)
- `--target`: Target directory (default: specs/specifications/)

## Process

### Step 1: Analyze Changes
Read and compare:
- Source: `specs/$BRANCH/spec.md`, `plan.md`, `tasks.md`
- Target: `specs/specifications/functional/`, `technical/`

### Step 2: Extract Updates

#### From spec.md → functional/
- New user stories → Update relevant functional docs
- Changed acceptance criteria → Update behavior descriptions
- New UI/UX elements → Update interface documentation
- Modified workflows → Update process documentation

#### From plan.md → technical/
- Architecture changes → `technical/architecture/`
- API modifications → `technical/api/`
- New integrations → `technical/implementation/`
- Performance improvements → `technical/quality/`

#### From implementation → CLAUDE.md
- New patterns discovered
- Technology additions
- Convention changes
- Best practices learned

### Step 3: Update Global Documentation

Update the appropriate files in `specs/specifications/`:

```
specs/specifications/
├── functional/
│   ├── 01-kanban-board.md     # Core board functionality
│   ├── 02-ticket-management.md # Ticket operations
│   ├── 03-collaboration.md     # Team features
│   ├── 04-automation.md        # AI/workflows
│   ├── 05-projects.md          # Multi-project
│   └── 06-user-interface.md    # UI/UX patterns
└── technical/
    ├── architecture/           # System design
    ├── api/                    # Endpoints & contracts
    ├── implementation/         # Code patterns
    └── quality/                # Testing & deployment
```

### Step 4: Maintain Consistency

Ensure:
- No contradictions between documents
- Terminology is consistent
- Cross-references are updated
- Version history is noted where applicable

## Rules

1. **Append, don't replace**: Add new information to existing sections
2. **Preserve structure**: Maintain existing document organization
3. **Keep context**: Don't remove historical information unless obsolete
4. **Update timestamps**: Note when sections are updated
5. **Link sources**: Reference the ticket/branch that introduced changes

## Example Updates

### Functional Update
```markdown
<!-- In functional/02-ticket-management.md -->

### Ticket State Transitions

Tickets can move between stages following these rules:

**Updated (Ticket #897)**: Quick workflow tickets can now be rolled back to INBOX,
which resets their workflow type to FULL and clears the branch.
```

### Technical Update
```markdown
<!-- In technical/implementation/state-management.md -->

### Job Management

**Iteration Jobs (Added in #897)**:
A new job type `iterate` handles minor fixes during VERIFY stage without
changing ticket state. This enables rapid iteration on testing feedback.

```typescript
command: 'specify' | 'plan' | 'implement' | 'verify' | 'iterate'
```
```

### CLAUDE.md Update
```markdown
## Commands

\`\`\`bash
bun run dev          # Start dev server
bun run test         # Run all tests
bun run test:e2e     # Playwright tests
bun run test:unit    # Vitest tests
bun run type-check   # TypeScript check
bun run iterate      # Run verify iteration (new)
\`\`\`
```

## Output

Log what was updated:
```markdown
📚 Specifications synchronized

Updated files:
- functional/02-ticket-management.md: Added rollback behavior
- functional/04-automation.md: Added iterate workflow
- technical/api/endpoints.md: New /api/jobs/iterate endpoint
- CLAUDE.md: Added iterate command

All documentation is now consistent with branch: 051-897-feature
```