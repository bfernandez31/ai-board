---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

0. **First-run constitution check**: Before proceeding, check if `.ai-board/memory/constitution.md` exists. If missing, copy the template:
   ```bash
   if [ ! -f ".ai-board/memory/constitution.md" ]; then
     mkdir -p .ai-board/memory
     cp "${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md" ".ai-board/memory/constitution.md"
     echo "Copied constitution template to .ai-board/memory/constitution.md"
   fi
   ```

1. **Setup**: Run `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Phase 1: Update agent context by running the agent script
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
   - Identify what interfaces the project exposes to users or other systems
   - Document the contract format appropriate for the project type
   - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
   - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Agent context update**:
   - Run `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/scripts/bash/update-agent-context.sh claude`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Testing Strategy (include in plan)

When defining the Testing section of the plan, use this decision tree to assign test types per user story:

1. Pure function with no React/API dependencies? → **Unit test** (`tests/unit/`)
2. React component with user interactions? → **Component test** (`tests/unit/components/`) with mocked hooks
3. API endpoint or database operation? → **Integration test** (`tests/integration/[domain]/`) with Vitest + Prisma
4. REQUIRES a real browser (OAuth, drag-drop, keyboard nav, viewport)? → **E2E test** (`tests/e2e/`) with Playwright
5. Unsure? → Default to **Integration test** (fastest full-stack feedback)

**Critical rules**:
- API tests use Vitest, NOT Playwright (10-20x faster)
- E2E is expensive (~5s each) — only for browser-required features
- Search existing tests FIRST — extend, don't duplicate
- RTL query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
