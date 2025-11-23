---
command: "/iterate-verify"
category: "Verification"
purpose: "Apply targeted fixes during VERIFY stage without changing ticket state"
---

# Iterate-Verify Command

You are applying minor fixes discovered during the VERIFY stage. The ticket remains in VERIFY throughout this process.

## Context

This command is executed when:
- Testing has revealed minor issues that need fixing
- The changes are small enough to handle automatically (< 30% divergence)
- The ticket should remain in VERIFY stage while fixes are applied

## Environment Variables

- `TICKET_ID`: The ticket ID (e.g., "897")
- `BRANCH`: Git branch name (e.g., "051-897-rollback-quick")
- `PROJECT_ID`: Project ID (e.g., "3")
- `ISSUES`: JSON array of issues to fix (passed via arguments)

## Rules and Constraints

### CRITICAL Rules
1. **Ticket STAYS in VERIFY** - Do not change stage or suggest stage changes
2. **MINIMAL changes only** - Fix specific issues, no scope creep
3. **Preserve existing work** - This is iteration, not rework
4. **Update ALL documentation** - Both branch specs and global specifications
5. **No architecture changes** - Structural changes require going back to PLAN

### Scope Limitations
- ✅ Fix validation issues
- ✅ Correct error messages
- ✅ Adjust UI elements
- ✅ Fix integration issues
- ✅ Performance optimizations (minor)
- ❌ Change data models
- ❌ Modify API contracts substantially
- ❌ Alter user workflows
- ❌ Add new features

## Process

### Step 1: Read Project Context
```bash
# Read constitution for project standards
Read .specify/memory/constitution.md

# Read current branch specifications
Read specs/$BRANCH/spec.md
Read specs/$BRANCH/plan.md
Read specs/$BRANCH/tasks.md
```

### Step 2: Analyze Issues
Parse the ISSUES environment variable to understand what needs fixing:
- Validation problems
- UI/UX issues
- Integration bugs
- Performance issues
- Error handling

### Step 3: Apply Targeted Fixes
Make minimal code changes to address the specific issues:
- Fix only what's listed in ISSUES
- Maintain existing patterns and conventions
- Follow constitution guidelines
- Keep changes surgical and focused

### Step 4: Update Branch Specifications
Update `specs/$BRANCH/` files if the fixes change behavior:
- **spec.md**: Update if acceptance criteria affected
- **plan.md**: Update if implementation approach changed
- **tasks.md**: Mark iteration tasks as complete

### Step 5: Update Global Specifications
Sync changes to `specs/specifications/`:
- **functional/**: If user-facing behavior changed
- **technical/**: If implementation details changed
- **CLAUDE.md**: If new patterns introduced

### Step 6: Validate Consistency
Ensure all documentation remains aligned:
- Branch specs match implementation
- Global specs reflect current state
- No contradictions between documents

## Example Execution

### Input Issues
```json
[
  "Missing email validation on signup form",
  "Error message shows technical details to user",
  "Submit button misaligned on mobile"
]
```

### Expected Actions
1. Add email validation to signup form component
2. Update error handler to show user-friendly messages
3. Fix CSS for mobile button alignment
4. Update specs/$BRANCH/spec.md acceptance criteria
5. Update specs/specifications/functional/02-forms.md
6. Commit with clear message about iteration

## Output

### Success Case
Create a summary of changes made:
```markdown
✅ Iteration completed successfully

Fixed issues:
- Added email validation to signup form
- Improved error messages for users
- Fixed mobile button alignment

Updated documentation:
- specs/$BRANCH/spec.md: Updated validation requirements
- specs/specifications/functional/06-user-interface.md: Added mobile considerations

All changes are minor and align with original specifications.
```

### Failure Case
If changes would be too large:
```markdown
❌ Cannot iterate - changes too substantial

The requested fixes would require:
- Data model changes
- API contract modifications
- Workflow alterations

These exceed the scope of VERIFY iteration.
Recommendation: Move ticket back to PLAN stage.
```

## Important Notes

1. **Stay in VERIFY**: Never suggest or implement stage changes
2. **Keep it small**: If changes seem large, report instead of implementing
3. **Document everything**: Every change must be reflected in documentation
4. **Test mindset**: You're fixing test failures, not adding features
5. **Preserve context**: Don't regenerate specs, only update what changed