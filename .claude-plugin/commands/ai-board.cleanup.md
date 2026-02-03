---
command: "/ai-board.cleanup"
description: "Holistic diff-based technical debt cleanup"
model: "opus"
allowed-tools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash", "TodoWrite"]
---

# Cleanup Command

> **Model**: Opus (deep analysis required)
> **Thinking**: Ultrathink (comprehensive codebase understanding)

Automated technical debt cleanup analyzing all changes since last cleanup.

## Input Payload

`$ARGUMENTS` contains a JSON payload with ticket info:
```json
{
  "ticketKey": "ABC-123"    // required: ticket identifier for branch naming
}
```

The `MERGE_POINT` environment variable contains the git SHA of the last cleanup merge point.

## Context Discovery

1. **CLAUDE.md** (auto-loaded) → Project stack, commands, conventions
2. **Read `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md`** → Project principles, non-negotiable rules
3. **Get merge point** → Use `$MERGE_POINT` env var (set by workflow)
4. **Locate cleanup-tasks.md** → In the specs directory (created by Phase 0)

## Workflow

### Phase 0: Branch Creation

1. Parse `$ARGUMENTS` JSON to extract `TICKET_KEY`
2. Create cleanup branch:
   ```bash
   ${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/scripts/bash/create-new-feature.sh --json --mode=cleanup --ticket-key="$TICKET_KEY" "Cleanup"
   ```
3. Parse JSON output for `BRANCH_NAME` and `SPEC_FILE`
4. Verify branch was created and cleanup-tasks.md exists in the spec directory

### Phase 1: Discovery

```bash
# Use MERGE_POINT from environment (set by workflow)
# Get full diff since merge point
git diff --name-only "$MERGE_POINT"..HEAD
```

Update `cleanup-tasks.md`:
- [x] T001: Merge point received from workflow
- [x] T002: Analyze diff since last cleanup

### Phase 2: Analysis

Analyze ALL changes since merge point:

**Dead Code Detection**:
- Unused exports (functions, types, components)
- Orphaned files not imported anywhere
- Deprecated code superseded by new implementations

**Project Impact**:
- Cross-module consistency
- Ripple effects from changes
- Performance implications

**Spec Synchronization**:
- Compare `specs/*/spec.md` with implementation
- Check `specs/*/plan.md` accuracy
- Verify CLAUDE.md is current

Update `cleanup-tasks.md`:
- [x] T003: Dead code detection
- [x] T004: Project impact assessment
- [x] T005: Spec synchronization check

### Phase 2.5: Temporary File Cleanup

Detect and delete files generated during debug/development sessions:

**Debug Documentation** (delete entire folders/files):
- `docs/troubleshooting/` - Session debug documentation
- `docs/*-setup.md` - One-time setup guides (belongs in specs)
- Files matching: `*SUMMARY*.md`, `*FIX*.md`, `*RÉSUMÉ*.md`, `*GUIDE*.md`

**One-shot Scripts** (delete after confirming not referenced):
- `scripts/fix-*.sh` - Migration scripts already applied
- `scripts/check-*.ts` - Debug inspection scripts
- `scripts/*-migration*.sh` - Completed migration scripts
- `scripts/validate-*.sh` - One-time validation scripts

**Detection Commands**:
```bash
# Find debug documentation
find docs -name "*.md" -type f | grep -iE "(fix|summary|résumé|guide|setup)"

# Find one-shot scripts
ls scripts/ | grep -iE "^(fix-|check-|.*migration|validate-)"
```

**Action**: Delete files directly (git preserves history). Update `cleanup-tasks.md`:
- [ ] T005.1: Delete debug documentation files
- [ ] T005.2: Delete one-shot scripts

### Phase 3: Fixes

For each issue found, add a task to `cleanup-tasks.md`:

```markdown
## Fixes
- [ ] T006: Remove unused UserValidator in lib/validators/
- [ ] T007: Consolidate duplicate error handling in API routes
- [ ] T008: Update spec.md for ticket ABC-123
```

**Apply fixes one at a time**:
1. Make change
2. Identify impacted tests only (NEVER run full test suite)
3. Run impacted tests
4. If pass → commit
5. If fail → revert
6. Update task in cleanup-tasks.md

### Phase 4: Validation

Run validation on impacted areas only:
- **Impacted tests only** (NEVER full test suite)
- Type check
- Lint

Update `cleanup-tasks.md`:
- [x] T099: Run impacted tests
- [x] T100: Type check
- [x] T101: Final review

## Safety Rules

**NEVER**:
- Run the full test suite (only impacted tests)
- Change behavior or business logic
- Modify API contracts
- Remove functionality still in use
- Leave codebase broken

**ALWAYS**:
- Read `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md` for project principles
- Use test/lint commands from CLAUDE.md
- Test after each change
- Revert if tests fail
- Update cleanup-tasks.md as you go

## Commit Messages

```bash
git commit -m "refactor: remove dead code from cleanup analysis

Removed:
- lib/old-validator.ts (unused)
- components/DeprecatedModal.tsx (not rendered)

Verified no usages in codebase."
```

## No Changes Needed

If codebase is clean:
1. Update cleanup-tasks.md with "No issues found"
2. Log: "Codebase is clean, no changes needed"
3. Exit gracefully

---

**Philosophy**: This command is project-agnostic. It reads CLAUDE.md (auto-loaded) for stack/commands and `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md` for project principles. Uses cleanup-tasks.md to track progress. No hardcoded commands or assumptions about the tech stack.
