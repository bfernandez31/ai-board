# Research: Health Scan Commands

**Branch**: `AIB-378-copy-of-health` | **Date**: 2026-03-29

## Research Questions & Findings

### 1. How do Claude Code commands receive arguments and produce output?

**Decision**: Commands are markdown instruction files that Claude Code executes as prompts. Arguments are passed inline (e.g., `--base-commit abc123`). Output is whatever the AI writes to stdout.

**Rationale**: The existing `run-agent.sh` script wraps Claude Code CLI execution, passing command name and arguments. The AI follows the markdown instructions and outputs the requested format. The workflow captures stdout as the JSON report.

**Alternatives considered**:
- Executable TypeScript scripts: Rejected — commands are AI-driven analysis, not deterministic code
- Hybrid approach (AI + script post-processing): Adds complexity without benefit since the workflow already validates output

### 2. How does the workflow parse command output into the typed report schema?

**Decision**: The workflow extracts the JSON object from stdout, wraps it with the `type` discriminator field, and validates against `report-schemas.ts` Zod schemas.

**Rationale**: Existing `parseScanReport()` in `lib/health/report-schemas.ts` already handles type injection — if the parsed object lacks a `type` field, it injects it from the `scanType` parameter. This means commands do NOT need to include the `type` field in their output; the workflow adds it.

**Alternatives considered**:
- Requiring commands to output the `type` field: Adds coupling between command files and TypeScript types
- Separate parsing per scan type: Unnecessary — discriminated union with auto-injection handles all cases

### 3. What is the exact output format each command must produce?

**Decision**: Each command outputs a JSON object with `score`, `issuesFound`, `issuesFixed`, `report` (scan-specific), `tokensUsed`, and `costUsd` fields. The `report` field varies by scan type but follows the structure defined in the command markdown files.

**Rationale**: The workflow extracts `score`, `issuesFound`, `issuesFixed` for the status callback, and passes the full `report` object for storage. The `report` field maps to the corresponding `ScanReport` type after the workflow adds the `type` discriminator.

**Alternatives considered**: None — format is dictated by the existing workflow and type system.

### 4. How does health-tests detect and run the project's test command?

**Decision**: health-tests reads `package.json` scripts to identify the test command. Priority: `test:unit` > `test` > `vitest` > `jest`. Falls back to `bun run test` if none explicitly configured.

**Rationale**: The command instruction file directs the AI to inspect `package.json` and use the appropriate test runner. This covers the vast majority of JavaScript/TypeScript projects. The AI can also detect non-JS test setups (Python pytest, Rust cargo test) from project files.

**Alternatives considered**:
- Hardcoded `bun run test:unit`: Too specific to ai-board; commands must work on any target repo
- Requiring a `test` script: Some projects use non-standard names

### 5. How does health-tests auto-fix and commit?

**Decision**: For each failing test, the AI analyzes the error, attempts a fix, re-runs the specific test to verify, and commits the fix individually. Failed fix attempts are reported as `nonFixable`.

**Rationale**: Individual commits provide traceability (spec decision). Re-running after fix ensures the fix actually works. The AI's judgment determines fixability — obvious fixes (wrong import, stale snapshot, assertion value) vs architectural issues.

**Alternatives considered**:
- Batch all fixes into one commit: Less traceable, harder to revert individual fixes
- No auto-fix: Explicitly rejected by spec — auto-fix is a core requirement

### 6. How does health-compliance locate the constitution?

**Decision**: Check paths in order: `.ai-board/memory/constitution.md` > `.claude-plugin/memory/constitution.md` > `CLAUDE.md`. If none found, report gracefully with score 0.

**Rationale**: The spec requires dynamic reading from the target project. The two constitution paths cover the standard locations. CLAUDE.md serves as a fallback for projects that embed governance rules there.

**Alternatives considered**:
- Only checking `.ai-board/memory/constitution.md`: Misses projects using the plugin structure
- Requiring constitution: Spec explicitly requires graceful fallback

### 7. How does health-spec-sync compare specs to implementation?

**Decision**: Read each file in `specs/specifications/`, extract declared endpoints/models/behaviors, then search the codebase for corresponding implementations. Report drift when specs describe something not found in code or vice versa.

**Rationale**: The AI reads spec files and uses codebase search to find matching implementations. This is inherently an AI-judgment task — pattern matching between natural language specs and code.

**Alternatives considered**:
- AST-based comparison: Too rigid; specs describe behavior, not exact code structure
- Schema-only comparison: Misses behavioral requirements described in prose

### 8. How does incremental scanning work with baseCommit?

**Decision**: When `--base-commit` is provided, the command runs `git diff <base-commit>..HEAD` to get changed files, then limits analysis to those files only. When absent, scans the entire repository.

**Rationale**: Incremental scanning reduces scope proportionally to diff size (SC-003). The AI uses `git diff` output to identify which files changed and focuses analysis there.

**Alternatives considered**:
- Scanning all files but only reporting issues in changed lines: More thorough but slower; doesn't match the "analyze only the diff" spec language
- Using `git log` for file list: Less precise than diff for identifying actual changes
