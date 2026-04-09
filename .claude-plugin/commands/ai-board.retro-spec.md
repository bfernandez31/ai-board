# Retro-Spec: Generate Project Specifications

Analyze the codebase in the current working directory and generate project specifications. Write output files to `specs/specifications/`.

## Inputs

Parse the following from the command arguments:
- `--depth=QUICK|STANDARD|COMPREHENSIVE` (required): Controls breadth and detail of generated specs
- `--external-docs=<path>` (optional): Path to a file containing fetched external documentation
- `--context="<text>"` (optional): Additional context from the project owner

## Analysis Phases

### Phase 1: Codebase Analysis
1. Read the file tree structure (focus on source directories, ignore node_modules, dist, build, .git)
2. Identify tech stack from `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `Gemfile`, framework config files, etc.
3. Read `.ai-board/config.yml` for project metadata if present
4. Read `CLAUDE.md` or `AGENTS.md` for development conventions if present
5. Read `.ai-board/memory/constitution.md` for project constitution if present

### Phase 2: Context Integration
1. If `--external-docs` path is provided and file exists, read and parse the content
2. If `--context` is provided, factor the additional context into the analysis
3. Cross-reference codebase findings with any external information

### Phase 3: Spec Generation

Generate files based on the `--depth` level. Each level includes all content from lower levels.

#### QUICK Depth
Generate only:
- `specs/specifications/overview.md` — Project overview, purpose, tech stack, high-level architecture summary

#### STANDARD Depth (includes QUICK content)
Generate:
- `specs/specifications/overview.md` — Project overview with expanded detail
- `specs/specifications/architecture.md` — System architecture, component relationships, data flow diagrams
- `specs/specifications/endpoints.md` — API endpoint catalog with request/response schemas
- `specs/specifications/data-model.md` — Database entities, relationships, constraints, key fields
- `specs/specifications/workflows.md` — Key workflows, processes, and automation

#### COMPREHENSIVE Depth (includes STANDARD content)
Generate all STANDARD files with deeper detail, plus:
- `specs/specifications/functional-spec.md` — Feature-by-feature functional specifications
- `specs/specifications/technical-spec.md` — Technical implementation details, patterns, conventions
- `specs/specifications/schemas.md` — Full API request/response schemas with examples
- `specs/specifications/entities.md` — Detailed entity documentation with state machines
- `specs/specifications/testing.md` — Test strategy, coverage, patterns, test infrastructure

### Phase 4: Output
1. Create `specs/specifications/` directory if it doesn't exist
2. Write all generated files
3. If files already exist in `specs/specifications/`, overwrite them (reflect current codebase state)

## Quality Requirements

- Generated specs MUST reference real file paths from the codebase
- Generated specs MUST accurately describe the actual tech stack and architecture
- Generated specs MUST NOT hallucinate features, endpoints, or entities that don't exist in the code
- Each file must use consistent markdown format with clear section headers
- Depth levels MUST be additive (each level includes all content from lower levels)

## Error Handling

- If a specific analysis step fails (e.g., parsing a config file), log a warning and continue with available information
- Do not write partial results on catastrophic failure — propagate the error
- Missing optional files (CLAUDE.md, constitution.md, external docs) should not cause failure
