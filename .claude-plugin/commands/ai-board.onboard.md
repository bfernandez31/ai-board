Review the imported repository and generate onboarding guidance that is specific to the actual codebase.

Required outputs:
- `CLAUDE.md`: project-specific guidance with real commands, architecture notes, testing conventions, and repository constraints
- `AGENTS.md`: short entry point that directs agents to the generated guidance files
- `.ai-board/memory/constitution.md`: project constitution that preserves AI Board baseline rigor for security, testing, and data integrity while reflecting observed repository conventions

Rules:
- Inspect the repository directly before writing guidance
- Do not invent commands, frameworks, or services that are not supported by repository evidence
- Preserve deterministic onboarding outputs that already exist
- Write concise, operational guidance rather than boilerplate explanation
- Prefer facts grounded in repository files and detected analysis
