# Command Specification: Project Guidance Generation

## Proposed Entry Points

- Command file: `/home/runner/work/ai-board/ai-board/target/.claude-plugin/commands/ai-board.onboard.md`
- Runner: `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`

## Inputs

- Checked-out target repository path
- Deterministic analysis summary path
- Selected agent (`CLAUDE` or `CODEX`)
- Output directory for generated artifacts
- Existing-file manifest so protected files can be preserved

## Behavior

1. Read the deterministic analysis summary first.
2. Inspect repository code and structure directly.
3. Generate project-specific guidance artifacts only for files that are missing or machine-managed.
4. Preserve existing:
   - `CLAUDE.md`
   - `AGENTS.md`
   - `.ai-board/memory/constitution.md`
5. Return a structured artifact manifest listing created, preserved, and missing guidance artifacts.

## Expected Artifacts

- `CLAUDE.md` when absent
- `AGENTS.md` when absent
- `.ai-board/memory/constitution.md` when absent
- generated command/script bundles needed for AI Board onboarding

## Partial-Success Contract

- If this command fails after deterministic outputs already exist, the workflow must:
  - keep the deterministic outputs
  - commit them
  - mark the final callback `partial=true`
  - record guidance files in `artifactSummary.missing`

## Failure Rules

- Guidance failure must not erase deterministic artifacts already prepared.
- The command should return a concise log tail suitable for persistence on `ProjectSetupJob.logs`.
