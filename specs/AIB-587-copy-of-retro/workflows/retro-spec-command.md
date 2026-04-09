# Agent Command: ai-board.retro-spec

**Purpose**: Analyze an existing codebase and generate project specifications scaled to the requested depth.

---

## Command File Location

`.claude-plugin/commands/ai-board.retro-spec.md`

## Inputs

| Argument | Required | Description |
|----------|----------|-------------|
| `--depth` | Yes | One of: `quick`, `standard`, `comprehensive` |
| `--docs-path` | No | Path to fetched external documentation file |
| `--additional-context` | No | Free-text context from the user |

## Execution Phases

### Phase 1: Codebase Analysis
- Read project root for structure (package.json, Cargo.toml, go.mod, etc.)
- Read `.ai-board/config.yml` for stack detection results
- Read `CLAUDE.md` / `AGENTS.md` for existing guidance
- Read `.ai-board/memory/constitution.md` if present
- Scan source directories for key patterns (entry points, routes, models, tests)

### Phase 2: Context Gathering
- If `--docs-path` provided, read external documentation
- If `--additional-context` provided, incorporate as generation context
- Build a mental model of: purpose, architecture, data flow, API surface, test coverage

### Phase 3: Specification Generation

**Quick depth** → `specs/specifications/`:
- `overview.md` — Project purpose, tech stack, high-level architecture, key directories

**Standard depth** → `specs/specifications/`:
- `overview.md` — Project purpose, tech stack summary
- `architecture.md` — Component architecture, data flow, key design decisions
- `api-endpoints.md` — API routes with methods, auth, request/response shapes
- `data-model.md` — Database entities, relationships, key fields

**Comprehensive depth** → `specs/specifications/`:
- Everything from Standard, plus:
- `functional/` — Feature-by-feature functional specifications
- `technical/` — Implementation details, state management, integrations
- Cross-references between documents

### Phase 4: Validation
- Verify all generated files exist and are non-empty
- Ensure no placeholder content remains
- Output summary of generated files to stdout (for workflow to capture)

## Output

Generated files are written directly to the working directory under `specs/specifications/`. The workflow handles git commit and push.

## Error Handling
- If codebase is empty or unreadable → fail with descriptive message
- If generation partially fails → fail entirely (no partial commits per spec requirement)
