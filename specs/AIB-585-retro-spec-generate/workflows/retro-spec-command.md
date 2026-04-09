# Agent Command: ai-board.retro-spec

## Overview

LLM-powered analysis command that generates project specifications by analyzing the codebase, configuration files, and optional external documentation. Executed within the `retro-spec.yml` workflow.

## Inputs

| Input | Source | Required | Description |
|-------|--------|----------|-------------|
| Codebase | Cloned target repo | Yes | Full repository file tree |
| `config.yml` | `.ai-board/config.yml` | Yes | Project configuration |
| Agent context | `CLAUDE.md` or equivalent | If exists | Agent-specific instructions |
| `constitution.md` | `.ai-board/memory/constitution.md` | If exists | Project constitution |
| `depth` | Workflow input | Yes | `QUICK`, `STANDARD`, or `COMPREHENSIVE` |
| External docs | Fetched by workflow | No | Content from user-provided documentation URL |
| Additional context | Workflow input | No | Free text from user |

## Output

Generated files written to `specs/specifications/` directory:

### QUICK Depth
- `overview.md` — Project overview, purpose, tech stack, high-level architecture

### STANDARD Depth (includes QUICK)
- `overview.md` — Project overview with more detail
- `architecture.md` — System architecture, component relationships, data flow
- `endpoints.md` — API endpoint catalog with request/response schemas
- `data-model.md` — Database entities, relationships, constraints
- `workflows.md` — Key workflows and processes

### COMPREHENSIVE Depth (includes STANDARD)
- All STANDARD files with deeper detail
- `functional-spec.md` — Feature-by-feature functional specifications
- `technical-spec.md` — Technical implementation details, patterns, conventions
- `schemas.md` — Full API request/response schemas with examples
- `entities.md` — Detailed entity documentation with state machines
- `testing.md` — Test strategy, coverage, patterns

## Execution Phases

### Phase 1: Codebase Analysis
1. Read file tree structure
2. Identify tech stack from `package.json`, config files, framework markers
3. Read `config.yml` for project metadata
4. Read agent context files for development conventions

### Phase 2: Context Integration
1. If external docs provided, parse and extract relevant information
2. If additional context provided, factor into analysis
3. Cross-reference codebase findings with external information

### Phase 3: Spec Generation
1. Generate spec files matching the selected depth level
2. Each file follows consistent markdown format with clear sections
3. Reference actual file paths and code patterns from the codebase
4. Include accurate entity/API/workflow descriptions

### Phase 4: Output
1. Write generated files to `specs/specifications/` directory
2. Overwrite existing spec files if present (reflect current codebase state)

## Error Behavior

- Propagates all errors to the workflow for status reporting
- Does not write partial results on failure
- If a specific analysis step fails (e.g., parsing a config file), logs warning and continues with available information

## Quality Expectations

- Generated specs MUST reference real file paths from the codebase
- Generated specs MUST accurately describe the actual tech stack and architecture
- Generated specs MUST NOT hallucinate features, endpoints, or entities that don't exist
- Depth levels MUST be additive (each level includes all content from lower levels)
