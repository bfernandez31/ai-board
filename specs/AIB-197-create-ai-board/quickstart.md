# Quickstart: ai-board Claude Code Plugin

**Branch**: `AIB-197-create-ai-board` | **Date**: 2026-02-01

## Integration Scenarios

This document describes integration scenarios for the ai-board Claude Code plugin from an AI agent perspective.

### Scenario 1: Plugin Installation on Managed Project

**Context**: A project without ai-board plugin needs AI-powered development workflows.

**Integration Flow**:
1. Plugin is installed via Claude Code plugin system
2. Commands become available under `ai-board.*` namespace
3. If `.specify/memory/constitution.md` is missing, first command execution copies template
4. GitHub workflows reference `ai-board.*` commands

**Verification Points**:
- All 17 commands accessible via `/ai-board.*`
- Scripts execute from `${CLAUDE_PLUGIN_ROOT}/scripts/`
- Templates load from `${CLAUDE_PLUGIN_ROOT}/templates/`
- Constitution template copied on first workflow run

### Scenario 2: Specification Workflow Execution

**Context**: GitHub workflow triggers `speckit.yml` for SPECIFY stage.

**Integration Flow**:
1. Workflow invokes `claude --dangerously-skip-permissions "/ai-board.specify $payload"`
2. Command reads spec template from `${CLAUDE_PLUGIN_ROOT}/templates/spec-template.md`
3. Command runs `${CLAUDE_PLUGIN_ROOT}/scripts/bash/create-new-feature.sh`
4. Specification generated in `specs/{ticket-key}/spec.md`

**Command Chain**:
```
ai-board.specify → ai-board.plan → ai-board.tasks → ai-board.implement
```

**Verification Points**:
- Scripts resolve correctly via `${CLAUDE_PLUGIN_ROOT}`
- JSON output from scripts parsed correctly
- Spec file created in correct location

### Scenario 3: Quick Implementation Workflow

**Context**: Simple task triggers `quick-impl.yml` for direct INBOX→BUILD.

**Integration Flow**:
1. Workflow invokes `claude --dangerously-skip-permissions "/ai-board.quick-impl ..."`
2. Command runs `${CLAUDE_PLUGIN_ROOT}/scripts/bash/create-new-feature.sh`
3. Implementation proceeds without spec/plan phases
4. Branch created with changes

**Verification Points**:
- Skip spec/plan phases confirmed
- Branch naming follows convention
- Implementation uses project constitution

### Scenario 4: Verify Workflow Execution

**Context**: `verify.yml` workflow runs tests and creates PR.

**Integration Flow**:
1. Workflow invokes `claude --dangerously-skip-permissions "/ai-board.verify"`
2. Command executes test suite
3. On failure, command attempts auto-fix
4. PR created via `${CLAUDE_PLUGIN_ROOT}/scripts/bash/create-pr-and-transition.sh`

**Verification Points**:
- Tests execute with correct commands (`bun run test`)
- Failures analyzed and fixes attempted
- PR creation script runs successfully

### Scenario 5: AI-Board Assist (Comment Response)

**Context**: User mentions `@ai-board` in comment on ticket.

**Integration Flow**:
1. Webhook triggers `ai-board-assist.yml`
2. Workflow invokes `claude --dangerously-skip-permissions "/ai-board-assist ..."`
3. Assistant analyzes comment context
4. Response generated based on current stage

**Stage-Specific Behavior**:
| Stage | Command Suffix | Focus |
|-------|---------------|-------|
| SPECIFY | comment-specify | Requirements clarification |
| PLAN | comment-plan | Design questions |
| BUILD | comment-build | Implementation guidance |
| VERIFY | comment-verify | Testing assistance |

## Path Resolution Contract

All plugin resources accessed via `${CLAUDE_PLUGIN_ROOT}`:

```bash
# Scripts
${CLAUDE_PLUGIN_ROOT}/scripts/bash/common.sh
${CLAUDE_PLUGIN_ROOT}/scripts/bash/create-new-feature.sh
${CLAUDE_PLUGIN_ROOT}/scripts/analyze-slow-tests.js

# Templates
${CLAUDE_PLUGIN_ROOT}/templates/spec-template.md
${CLAUDE_PLUGIN_ROOT}/templates/plan-template.md

# Memory
${CLAUDE_PLUGIN_ROOT}/memory/constitution.md
```

## Workflow Update Contract

GitHub workflows must update command invocations:

| Workflow | Before | After |
|----------|--------|-------|
| speckit.yml | `/speckit.specify` | `/ai-board.specify` |
| speckit.yml | `/speckit.plan` | `/ai-board.plan` |
| speckit.yml | `/speckit.tasks` | `/ai-board.tasks` |
| speckit.yml | `/speckit.implement` | `/ai-board.implement` |
| speckit.yml | `/speckit.clarify` | `/ai-board.clarify` |
| quick-impl.yml | `/quick-impl` | `/ai-board.quick-impl` |
| cleanup.yml | `/cleanup` | `/ai-board.cleanup` |
| verify.yml | `/verify` | `/ai-board.verify` |
| iterate.yml | `/iterate-verify` | `/ai-board.iterate-verify` |

## First-Run Constitution Check

Commands that check for constitution.md:

```bash
# In ai-board.specify and ai-board.plan
if [ ! -f ".specify/memory/constitution.md" ]; then
  mkdir -p .specify/memory
  cp "${CLAUDE_PLUGIN_ROOT}/memory/constitution.md" ".specify/memory/constitution.md"
  echo "Copied constitution template to .specify/memory/constitution.md"
fi
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Script not found | Incorrect plugin path | Verify `${CLAUDE_PLUGIN_ROOT}` resolves correctly |
| Template missing | Plugin incomplete | Reinstall plugin |
| Command not found | Plugin not installed | Install via `claude plugin install ai-board` |
| Constitution not created | Directory permissions | Check `.specify/memory/` writable |
