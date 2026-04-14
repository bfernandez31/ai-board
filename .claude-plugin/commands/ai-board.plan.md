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
   - Phase 1: Generate data-model.md, contracts/
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

3. **Discover existing files** (MANDATORY):
   - Identify all modules/domains that will be impacted by this feature
   - Scan the codebase for existing source and test files in those domains using `Glob` with domain keywords
   - Record findings in `research.md` under an **"Existing Files"** section:
     - Exact path, what it covers, whether to extend or create new
     - For test files specifically: enforces constitution "Search existing tests FIRST — extend, don't duplicate"
   - This inventory is REQUIRED before the Implementation Phases and Testing Strategy sections can be written
   - The plan MUST reference real file paths from this discovery — never invent file names. If a file needs to be modified, use its actual path. If a new file is needed, verify no existing file already covers that responsibility.

4. **Extract patterns from reference files** (MANDATORY when the feature creates new code that parallels existing code):
   - For each file marked as "Pattern reference" or "Reuse as-is", READ the actual implementation and extract:
     - **Error handling patterns**: How does the existing code handle failures? (try/catch, rollback, cleanup on error, retry logic). New code performing similar operations MUST follow the same error recovery strategy.
     - **Security patterns**: How are secrets, tokens, and credentials handled? (environment variables vs inputs, encryption, auth headers). New code MUST NOT introduce weaker security patterns than the reference.
     - **State management patterns**: How does the existing code handle state transitions? (atomic updates, ordering of operations, race condition guards). New code MUST follow the same defensive patterns.
   - Record findings in `research.md` under a **"Patterns to Follow"** section with concrete examples from the reference code (include file path and line numbers).
   - The implementation phases and tasks MUST explicitly reference these patterns where applicable — not just "follow existing patterns" but "follow the dispatch-then-rollback pattern from transition.ts:336".

5. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md (with Existing Files, Patterns to Follow sections) with all NEEDS CLARIFICATION resolved

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

3. **Define workflow/agent artifacts** (if spec includes Internal Processes):
   - For each internal process described in the spec, design:
     - Workflow definition (inputs, steps, environment requirements)
     - Agent command specification (arguments, functional phases, output format)
     - Callback/reporting contract (how the process reports status back to the app)
   - Output to `SPECS_DIR/workflows/` subdirectory
   - Each artifact should be a separate markdown file (e.g., `workflows/onboard-workflow.md`, `workflows/onboard-command.md`)

4. **Agent context update**:
   - Run `${CLAUDE_PLUGIN_ROOT:-./.claude-plugin}/scripts/bash/update-agent-context.sh claude`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, /workflows/* (if applicable), agent-specific file

## Testing Strategy (include in plan)

Follow the testing strategy defined in the project's constitution. Use the "Existing Files" inventory from Phase 0 to determine which test files to extend. Create a new test file ONLY when no existing file covers the domain, or when adding would mix unrelated concerns.

## Key rules

- Use paths relative to repository root (e.g. `specs/AIB-123/plan.md`, NOT absolute paths like `/home/runner/...`)
- ERROR on gate failures or unresolved clarifications
