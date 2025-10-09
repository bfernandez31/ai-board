# Research: GitHub Actions Spec-Kit Workflow

**Feature**: 016-create-github-actions
**Date**: 2025-10-09
**Status**: Complete

## Research Questions

### 1. GitHub Actions Workflow Dispatch Best Practices

**Question**: What is the optimal way to trigger workflows manually with user inputs?

**Decision**: Use `workflow_dispatch` trigger with typed inputs

**Rationale**:
- Provides built-in UI in GitHub Actions tab for manual execution
- Supports input validation (string, boolean, choice types)
- Integrates seamlessly with GitHub permissions and secrets
- Allows conditional logic based on input values
- No external API calls required

**Alternatives Considered**:
- **Repository Dispatch Events**: Requires external API calls, less user-friendly, no built-in UI
- **Workflow Call**: Designed for reusable workflows from other workflows, not manual triggering
- **Schedule + Manual Trigger**: Overly complex, mixes automated and manual concerns

**References**:
- GitHub Docs: Manually running a workflow (workflow_dispatch)
- GitHub Actions Input Types: string, boolean, choice, environment

---

### 2. Claude Code CLI Installation and Authentication

**Question**: How to install and authenticate Claude Code CLI in GitHub Actions runner?

**Decision**: Install globally via `npm install -g @anthropic-ai/claude-code` and authenticate using `ANTHROPIC_API_KEY` environment variable

**Rationale**:
- Global npm installation makes `claude` command available in PATH
- Claude CLI automatically detects `ANTHROPIC_API_KEY` environment variable
- No interactive authentication required (headless execution)
- Compatible with Ubuntu runners (Node.js pre-installed)
- Official installation method per Anthropic documentation

**Alternatives Considered**:
- **Local Installation**: Requires package.json in repository, adds dependency management overhead
- **npx Execution**: Each command slower due to package download, no caching benefit
- **Docker Container**: Unnecessary complexity for single CLI tool

**Implementation**:
```bash
npm install -g @anthropic-ai/claude-code
export ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}
claude --version  # Verify installation
```

**References**:
- Claude Code CLI documentation
- GitHub Actions environment variables

---

### 3. Git Commit Identity for Bot Accounts

**Question**: What identity should automated commits use?

**Decision**: Configure git user as `ai-board[bot] <bot@ai-board.app>`

**Rationale**:
- Square bracket notation `[bot]` follows GitHub bot naming conventions
- Clearly distinguishes automated commits from human commits in git history
- Email domain matches project namespace for consistency
- Prevents git errors requiring user.name and user.email configuration
- Allows filtering automated commits in git log

**Alternatives Considered**:
- **GitHub Actions Bot**: Uses `github-actions[bot]@users.noreply.github.com` (generic, not project-specific)
- **Generic "bot" name**: Less clear, doesn't indicate which system created commit
- **Human Developer Identity**: Misleading, obscures automation provenance

**Implementation**:
```bash
git config --global user.name "ai-board[bot]"
git config --global user.email "bot@ai-board.app"
```

**References**:
- GitHub Bot Account Conventions
- Git commit authorship best practices

---

### 4. Handling Optional Branch Parameter

**Question**: How should the workflow handle branch parameter for different commands?

**Decision**: Branch is optional for `specify` command (created by script), effectively required for other commands

**Rationale**:
- `specify` command runs `.specify/scripts/bash/create-new-feature.sh` which creates and checks out new branch
- Other commands (`plan`, `task`, `implement`, `clarify`) operate on existing feature branch
- Workflow checks out branch if provided, otherwise uses current branch (repository default)
- Prevents workflow failure when branch doesn't exist yet (specify case)

**Alternatives Considered**:
- **Always Required**: Would break specify workflow which creates branch
- **Always Optional**: Would cause confusion for plan/task/implement without explicit branch
- **Separate Workflows**: Unnecessary duplication for single parameter difference

**Implementation Logic**:
```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ inputs.branch || github.ref }}
    fetch-depth: 0
```

**Edge Cases**:
- If branch not provided for non-specify commands: workflow runs on default branch (likely main), commits fail to push to main (protected)
- If branch provided for specify: script creates branch with that name, checkout succeeds

---

### 5. Error Handling and Status Reporting

**Question**: How should the workflow report success and failure states?

**Decision**: Use Unix exit codes with emoji indicators (✅ success, ❌ failure)

**Rationale**:
- Exit code 0 = success, non-zero = failure (standard Unix convention)
- Emoji indicators provide instant visual feedback in logs
- GitHub Actions automatically detects exit codes for workflow status
- Clear separation between normal output and status messages
- Human-readable for debugging in GitHub Actions UI

**Alternatives Considered**:
- **JSON Output**: Machine-readable but harder for humans to read in logs
- **Markdown Comments**: Requires additional GitHub API calls, slower
- **Annotations**: Limited to file-level feedback, not suitable for workflow status

**Implementation**:
```bash
# Success case
echo "✅ Spec-kit command '${{ inputs.command }}' completed successfully"
echo "📍 Branch: ${{ inputs.branch }}"
echo "🎫 Ticket: ${{ inputs.ticket_id }}"

# Failure case
echo "❌ Spec-kit command '${{ inputs.command }}' failed"
echo "📋 Check logs above for error details"
exit 1
```

**References**:
- GitHub Actions exit code handling
- Shell script best practices

---

### 6. Clarify Command Answers Handling

**Question**: How to pass JSON answers to `/clarify` command securely?

**Decision**: Write `answers_json` input to `clarifications.json` file, then pass file path to `claude /clarify --answers clarifications.json`

**Rationale**:
- Claude CLI expects file path for `--answers` flag (not inline JSON)
- Writing to file prevents command-line injection attacks from malicious JSON
- File-based approach handles multi-line JSON and special characters safely
- Temporary file is committed with clarifications (preserves history)
- Avoids shell escaping complexity

**Alternatives Considered**:
- **Inline JSON**: High risk of shell injection, complex escaping required
- **Base64 Encoding**: Adds complexity, still requires decoding to file
- **Environment Variable**: Limited size, same injection risks

**Implementation**:
```bash
if [ "${{ inputs.command }}" = "clarify" ]; then
  echo '${{ inputs.answers_json }}' > clarifications.json
  claude /clarify --answers clarifications.json
fi
```

**Security Considerations**:
- Input validation handled by GitHub Actions (string type)
- File write is safe (controlled environment, no user access)
- File committed to git (transparent, auditable)

---

## Technology Stack Summary

**Required Technologies**:
- **GitHub Actions**: ubuntu-latest runner, workflow_dispatch trigger
- **Node.js 22.20.0**: Via actions/setup-node@v4
- **Python 3.11**: Via actions/setup-python@v5 (optional for spec-kit)
- **Claude Code CLI**: @anthropic-ai/claude-code npm package
- **Git 2.x**: Pre-installed on ubuntu-latest
- **Bash 5.x**: Default shell for ubuntu-latest

**External Dependencies**:
- **Anthropic API**: Claude Code CLI backend (requires ANTHROPIC_API_KEY)
- **GitHub API**: Default GITHUB_TOKEN for git operations
- **Spec-Kit Scripts**: Existing `.specify/scripts/bash/create-new-feature.sh`

**No Additional Dependencies Required**: All other tools pre-installed on GitHub Actions runners

---

## Integration Points

### 1. Spec-Kit Script Integration
- **Script**: `.specify/scripts/bash/create-new-feature.sh`
- **Usage**: Called during `specify` command to create feature branch
- **Input**: Ticket description passed as `--json` argument
- **Output**: JSON with BRANCH_NAME, SPEC_FILE, FEATURE_NUM
- **Dependency**: Script must exist in repository

### 2. Claude Code CLI Integration
- **Commands**: `/specify`, `/plan`, `/task`, `/implement`, `/clarify`
- **Working Directory**: Repository root (checked out to feature branch)
- **Output**: Files written to current directory (specs/, src/, etc.)
- **Authentication**: ANTHROPIC_API_KEY environment variable

### 3. Git Integration
- **Authentication**: GITHUB_TOKEN secret (automatic)
- **Operations**: checkout, add, commit, push
- **Branch Management**: Create (via script), switch, push to origin
- **Commit Format**: `feat(ticket-<id>): <command> - automated spec-kit execution`

---

## Constraints and Limitations

### Performance Constraints
- **Timeout**: 120 minutes maximum execution (GitHub Actions limit configurable up to 360 minutes)
- **Runner Resources**: Standard ubuntu-latest (2-core CPU, 7GB RAM)
- **Network**: Dependent on Anthropic API response times
- **Storage**: 14GB available disk space on runner

### Security Constraints
- **Secrets Exposure**: Must not log ANTHROPIC_API_KEY or GITHUB_TOKEN
- **Input Validation**: Rely on GitHub Actions input types (string, choice)
- **Branch Protection**: Cannot push to protected branches (main)

### Workflow Constraints
- **Manual Dispatch Only**: No automatic triggers (per requirements)
- **Sequential Execution**: Commands run one at a time (no parallelization)
- **Ephemeral Environment**: Runner state lost after workflow completion

---

## Open Questions Resolved

All technical unknowns from requirements have been resolved:

✅ **Workflow trigger mechanism**: workflow_dispatch with typed inputs
✅ **CLI installation**: Global npm install
✅ **Authentication**: Environment variable (ANTHROPIC_API_KEY)
✅ **Git identity**: ai-board[bot] with project-specific email
✅ **Branch handling**: Optional for specify, required context for others
✅ **Error reporting**: Exit codes with emoji indicators
✅ **Clarify answers**: File-based approach (clarifications.json)

**No remaining NEEDS CLARIFICATION items**

---

## Recommendations

### Implementation Priorities
1. **Core Workflow Structure**: Start with workflow_dispatch and input definitions (FR-001 to FR-005)
2. **Environment Setup**: Add checkout, Node.js, Python, CLI installation steps (FR-006 to FR-011)
3. **Command Execution**: Implement case statement for command routing (FR-012 to FR-017)
4. **Git Operations**: Add staging, commit, push logic (FR-018 to FR-022)
5. **Status Reporting**: Add success/failure messages (FR-023 to FR-025)

### Testing Strategy
1. Test specify command first (creates branch, generates spec.md)
2. Test plan command on created branch (generates plan.md, tasks.md)
3. Test error scenarios (missing secrets, invalid branch, git conflicts)
4. Test clarify command with sample answers JSON
5. Validate all commands produce correct git commits with ai-board[bot] author

### Monitoring and Debugging
- Use GitHub Actions logs for all debugging (stdout/stderr captured)
- Add `set -x` to bash steps for command-level debugging if needed
- Verify secrets are properly masked in logs (never show ANTHROPIC_API_KEY)
- Check git history for commit author and message format

---

**Status**: Research complete, ready for Phase 1 (Design & Contracts)
