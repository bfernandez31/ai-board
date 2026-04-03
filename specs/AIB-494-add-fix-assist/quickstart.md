# Quickstart: /fix Assist Command

**Branch**: `AIB-494-add-fix-assist` | **Date**: 2026-04-03

## Implementation Order

### Step 1: Command File (`.claude-plugin/commands/ai-board.fix.md`)

Create the Claude command file that defines the `/fix` behavior. This is the core implementation — the Claude agent reads this file and executes the defined steps at workflow runtime.

**Key sections to include**:
- Frontmatter with command metadata
- Critical output rules (mention format, character limit, result file)
- Environment variable documentation
- Step-by-step process: parse args → fetch reviews → parse findings → deduplicate → filter → fix → validate → commit → push → write result
- Review source parsing instructions (ai-board, Codex, Copilot formats)
- Pertinence filtering criteria for Codex/Copilot
- Error handling for each failure mode
- Summary comment format

**Reference**: Pattern from `.claude-plugin/commands/ai-board.assist.md` (output rules) and `.claude-plugin/commands/ai-board.code-review.md` (PR interaction via `gh`).

### Step 2: Workflow Routing (`.github/workflows/ai-board-assist.yml`)

Add a new `elif` block in the command routing section (after `/review`, before the `else` fallback) that:
1. Detects `/fix` in `$COMMENT`
2. Validates stage is VERIFY
3. Looks up PR number via `gh pr list --head "$BRANCH"`
4. Extracts arguments after `/fix`
5. Invokes `run-agent.sh "CLAUDE" "ai-board.fix" "$PR_NUMBER $ARGS"`

**Reference**: Lines 349-385 of `ai-board-assist.yml` (existing `/compare` and `/review` routing).

### Step 3: Command Autocomplete (`app/lib/data/ai-board-commands.ts`)

Add `/fix` entry to the `AI_BOARD_COMMANDS` array so it appears in the comment autocomplete dropdown.

### Step 4: Tests

1. **Unit tests** for pure functions (if any are extracted):
   - Finding number parsing from arguments
   - Deduplication logic
   - Pertinence filtering rules

2. **Integration tests** for the workflow routing:
   - Verify `/fix` command is recognized and routed
   - Verify stage validation rejects non-VERIFY stages
   - Verify error handling for missing PR

## Key Patterns to Follow

| Pattern | Example Source |
|---------|---------------|
| Command file structure | `.claude-plugin/commands/ai-board.assist.md` |
| PR interaction via `gh` CLI | `.claude-plugin/commands/ai-board.code-review.md` |
| Workflow command routing | `.github/workflows/ai-board-assist.yml:349-385` |
| Result file format | `specs/*/. ai-board-result.md` |
| Autocomplete registration | `app/lib/data/ai-board-commands.ts` |
| Iterate pattern (minor fixes) | `.claude-plugin/commands/ai-board.iterate.md` |

## Verification Checklist

- [ ] `/fix` command file exists at `.claude-plugin/commands/ai-board.fix.md`
- [ ] Workflow routes `/fix` correctly with stage and PR validation
- [ ] `/fix` appears in comment autocomplete
- [ ] Type-check passes: `bun run type-check`
- [ ] Lint passes: `bun run lint`
- [ ] Tests pass: `bun run test:unit`
