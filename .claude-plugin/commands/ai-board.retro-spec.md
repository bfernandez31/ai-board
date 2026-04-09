# Retro-Spec: Generate Project Specifications

You are an AI agent tasked with analyzing an existing codebase and generating project specifications.

## Inputs

Parse these from the command arguments:
- `--depth <quick|standard|comprehensive>` (required) — Determines scope of generated specs
- `--docs-path <path>` (optional) — Path to fetched external documentation file
- `--additional-context "<text>"` (optional) — Free-text context from the user

## Execution

### Phase 1: Codebase Analysis

1. Read project root for structure indicators:
   - `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, etc.
   - Identify language, framework, and build system

2. Read configuration files:
   - `.ai-board/config.yml` for stack detection results
   - `CLAUDE.md` / `AGENTS.md` for existing guidance
   - `.ai-board/memory/constitution.md` if present

3. Scan source directories for key patterns:
   - Entry points (main files, index files, app files)
   - Routes/endpoints (API handlers, controllers)
   - Models/entities (database models, schemas)
   - Tests (test directories, test files)
   - Configuration (env files, config directories)

### Phase 2: Context Gathering

1. If `--docs-path` is provided, read the external documentation file
2. If `--additional-context` is provided, incorporate as generation context
3. Build a mental model of:
   - Project purpose and domain
   - Architecture and component relationships
   - Data flow and API surface
   - Test coverage and patterns

### Phase 3: Specification Generation

Generate specifications in `specs/specifications/` based on the depth level:

#### Quick Depth
Create only:
- `specs/specifications/overview.md` — Project purpose, tech stack, high-level architecture, key directories

#### Standard Depth
Create:
- `specs/specifications/overview.md` — Project purpose, tech stack summary
- `specs/specifications/architecture.md` — Component architecture, data flow, key design decisions
- `specs/specifications/api-endpoints.md` — API routes with methods, auth, request/response shapes
- `specs/specifications/data-model.md` — Database entities, relationships, key fields

#### Comprehensive Depth
Create everything from Standard, plus:
- `specs/specifications/functional/` — Feature-by-feature functional specifications (one file per major feature)
- `specs/specifications/technical/` — Implementation details, state management, integrations
- Cross-references between documents using relative links

### Phase 4: Validation

1. Verify all generated files exist and are non-empty
2. Ensure no placeholder content remains (no `TODO`, `TBD`, `[PLACEHOLDER]`)
3. Output a summary of generated files to stdout

## Output Format

Write files directly to the working directory under `specs/specifications/`. The workflow handles git commit and push.

Print a summary at the end:
```
=== Retro-Spec Generation Complete ===
Depth: <depth>
Files generated:
  - specs/specifications/overview.md
  - specs/specifications/architecture.md
  - ...
```

## Quality Guidelines

- Be specific and accurate — reference actual file paths, function names, and patterns found in the code
- Don't speculate about features not present in the code
- Use Markdown formatting consistently
- Include code examples from the actual codebase where relevant
- Keep each document focused and well-structured with clear headings
- For API endpoints, include actual route paths, HTTP methods, and parameter types found in the code

## Error Handling

- If the codebase is empty or unreadable, fail with a descriptive error message
- If generation partially fails, fail entirely (do not leave partial specs)
- Report errors clearly to stdout so the workflow can capture them
