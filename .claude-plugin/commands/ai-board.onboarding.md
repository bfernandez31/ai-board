# AI Board Onboarding

Generate or refine onboarding artifacts for an imported repository.

Required outputs:
- `.ai-board/config.yml`
- `.ai-board/memory/constitution.md`
- `CLAUDE.md` or `AGENTS.md` updates when safe

Rules:
- Preserve an existing primary instruction file.
- Do not overwrite repository-specific governance without incorporating current context.
- Keep generated instructions consistent with the detected runtime and commands.
