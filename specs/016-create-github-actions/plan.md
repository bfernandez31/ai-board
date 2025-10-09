# Implementation Plan: GitHub Actions Spec-Kit Workflow

**Branch**: `016-create-github-actions` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-create-github-actions/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Add GitHub Actions workflow file (`.github/workflows/speckit.yml`) that enables manual execution of spec-kit commands (specify, plan, task, implement, clarify) in ephemeral runner environments. The workflow accepts ticket information and command type, executes the spec-kit command via Claude Code CLI, commits results with ai-board[bot] author, and pushes to the feature branch. This provides zero-infrastructure execution environment with built-in logging and monitoring.

## Technical Context
**Language/Version**: YAML (GitHub Actions Workflow Syntax 2.0), Shell (Bash 5.x)
**Primary Dependencies**:
- GitHub Actions (ubuntu-latest runner)
- Node.js 22.20.0 + Claude Code CLI (@anthropic-ai/claude-code)
- Python 3.11 (optional spec-kit dependency)
- Git 2.x (version control)
**Storage**: N/A (workflow operates on repository files)
**Testing**: Workflow execution testing via manual dispatch
**Target Platform**: GitHub Actions cloud runners (ubuntu-latest)
**Project Type**: web (Next.js frontend + backend API)
**Performance Goals**: Complete workflow execution within 120-minute timeout
**Constraints**:
- Manual workflow_dispatch only (no automatic triggers)
- Secrets must not be exposed in logs
- Git operations must use ai-board[bot] identity
**Scale/Scope**: Single workflow file supporting 5 command types

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development
**Status**: ✅ PASS - N/A for this feature
**Justification**: This feature creates GitHub Actions YAML workflow file and shell scripts. No TypeScript code is involved.

### II. Component-Driven Architecture
**Status**: ✅ PASS - N/A for this feature
**Justification**: This feature is infrastructure (CI/CD workflow), not application code. No UI components or Next.js routes are created.

### III. Test-Driven Development
**Status**: ⚠️ PARTIAL - Workflow testing via manual execution
**Approach**:
- Workflow correctness validated through manual dispatch testing
- Each command type (specify, plan, task, implement, clarify) tested individually
- Success/failure reporting validated via GitHub Actions logs
- No Playwright tests applicable for workflow infrastructure

### IV. Security-First Design
**Status**: ✅ PASS
**Compliance**:
- ANTHROPIC_API_KEY and GITHUB_TOKEN stored as GitHub Secrets (FR-026, FR-027)
- Secrets not exposed in logs or outputs (FR-028)
- Input validation handled by workflow_dispatch input types
- No raw SQL or database operations in this feature

### V. Database Integrity
**Status**: ✅ PASS - N/A for this feature
**Justification**: This feature does not interact with database. All operations are file-system and Git-based.

## Project Structure

### Documentation (this feature)
```
specs/016-create-github-actions/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   └── workflow-schema.yml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
.github/
└── workflows/
    └── speckit.yml      # Main workflow file (new)

.specify/
├── scripts/
│   └── bash/
│       └── create-new-feature.sh  # Referenced by workflow
└── templates/
    └── (existing templates)
```

**Structure Decision**: This feature adds a single workflow file to the existing `.github/workflows/` directory in the repository root. The workflow references existing `.specify/scripts/` for branch creation during the "specify" command execution. No changes to application source structure (app/, components/, lib/, etc.) are required.

## Phase 0: Outline & Research

### Research Tasks

1. **GitHub Actions Workflow Dispatch Best Practices**
   - Decision: Use `workflow_dispatch` with typed inputs
   - Rationale: Provides manual control with type validation and UI integration
   - Alternatives: Repository dispatch events (requires API calls, less user-friendly)

2. **Claude Code CLI Installation and Authentication**
   - Decision: Install via `npm install -g @anthropic-ai/claude-code` and authenticate via `ANTHROPIC_API_KEY` environment variable
   - Rationale: Official CLI installation method, supports headless execution
   - Alternatives: Local installation (requires package.json changes)

3. **Git Commit Identity for Bot Accounts**
   - Decision: Configure git user as `ai-board[bot] <bot@ai-board.app>`
   - Rationale: Distinguishes automated commits, follows GitHub bot naming conventions
   - Alternatives: Generic bot name (less clear provenance)

4. **Handling Optional Branch Parameter**
   - Decision: Branch optional for specify (created by script), required for other commands
   - Rationale: Specify creates new branch via `.specify/scripts/bash/create-new-feature.sh`, other commands operate on existing branch
   - Alternatives: Always require branch (would break specify workflow)

5. **Error Handling and Status Reporting**
   - Decision: Use exit codes with emoji indicators (✅ success, ❌ failure)
   - Rationale: Clear visual feedback in logs, standard Unix exit code conventions
   - Alternatives: JSON output (harder to read in logs)

6. **Clarify Command Answers Handling**
   - Decision: Write `answers_json` to `clarifications.json` file before running `/clarify`
   - Rationale: Claude CLI expects file path for answers, prevents command-line injection
   - Alternatives: Inline JSON (risky with special characters)

### Research Findings

**GitHub Actions Runner Environment**:
- Ubuntu-latest provides Node.js, Python, Git pre-installed
- Actions marketplace provides setup-node@v4 and setup-python@v5 for version control
- Default GITHUB_TOKEN has repository write permissions for commits/pushes
- Workflow timeout default is 360 minutes, reduced to 120 for resource efficiency

**Spec-Kit Command Execution**:
- `/specify` requires ticket description as argument
- `/plan`, `/task`, `/implement` operate on current directory (must be on feature branch)
- `/clarify` accepts `--answers` flag pointing to JSON file
- All commands output to current working directory

**Git Operations Best Practices**:
- Use `git diff --staged --quiet` to detect no-change scenarios
- Configure git user before first commit to avoid identity errors
- Use `git add .` to stage all changes (specs, code, configs)
- Push with `origin <branch>` to explicit remote

**Output**: See research.md for complete findings

## Phase 1: Design & Contracts

### Data Model
This feature does not introduce application data models. Workflow operates on:
- **Input Parameters**: Defined in workflow YAML schema
- **File Artifacts**: Generated by spec-kit commands (spec.md, plan.md, tasks.md, etc.)
- **Git Metadata**: Commit messages, author identity, branch names

See data-model.md for complete structure.

### API Contracts
This feature does not create REST/GraphQL APIs. The contract is the GitHub Actions workflow schema:
- **Input Contract**: workflow_dispatch inputs (see contracts/workflow-schema.yml)
- **Output Contract**: Git commits with conventional commit format
- **Status Contract**: Exit codes and log messages

See contracts/ directory for YAML schemas.

### Integration Points
- **GitHub Actions API**: Workflow dispatch trigger
- **Claude Code CLI**: Command execution via shell
- **Git Protocol**: Commit and push operations
- **Spec-Kit Scripts**: Branch creation via `.specify/scripts/bash/create-new-feature.sh`

### Testing Strategy
1. **Manual Workflow Testing**: Trigger workflow from GitHub UI for each command type
2. **Log Validation**: Verify success/failure messages appear correctly
3. **Git History Verification**: Check commits have correct author and message format
4. **Branch Creation Testing**: Verify specify command creates branch via script
5. **Error Scenario Testing**: Test invalid inputs, missing secrets, git conflicts

See quickstart.md for testing procedures.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from workflow requirements (FR-001 through FR-028)
- Group tasks by workflow section: configuration, setup, execution, git operations, status reporting
- Each functional requirement maps to one or more implementation tasks

**Task Categories**:
1. **Workflow Structure** (FR-001 to FR-005): YAML file creation, input definitions, job configuration
2. **Environment Setup** (FR-006 to FR-011): Checkout, Node.js/Python setup, CLI installation, git config
3. **Command Execution** (FR-012 to FR-017): Case statement for command routing, Claude CLI invocation
4. **Git Operations** (FR-018 to FR-022): Stage, commit, push with proper identity
5. **Status Reporting** (FR-023 to FR-025): Success/failure messages with indicators
6. **Testing & Validation**: Manual workflow dispatch tests for each command type

**Ordering Strategy**:
- TDD order: Manual test procedures before implementation
- Dependency order: Workflow structure → setup → execution → git → status
- Mark [P] for sections that can be developed independently (e.g., different command cases)

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (create .github/workflows/speckit.yml following tasks.md)
**Phase 5**: Validation (manual workflow dispatch testing, log verification, git history check)

## Complexity Tracking
*No constitutional violations requiring justification*

This feature operates entirely in infrastructure layer (GitHub Actions) and does not involve application code (TypeScript, React, Prisma). All applicable constitutional principles (Security-First Design) are satisfied.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (N/A - no deviations)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
