# Retro-Spec: Generate Project Specifications

Analyze the codebase in the current working directory and generate comprehensive project specifications. Write output files to `specs/specifications/`.

**Arguments**: Parse the following from the command arguments:
- `--depth=QUICK|STANDARD|COMPREHENSIVE` (required): Control breadth and detail of generated specs
- `--external-docs=<path>` (optional): Path to a file containing fetched external documentation
- `--context="<text>"` (optional): Additional context from the project owner

Make a todo list first, then follow these steps precisely:

---

## Phase 0: Static Discovery (Haiku agent)

Launch a Haiku agent to build a **Project Brief** — a structured summary of the codebase that all downstream agents will consume. The agent MUST NOT generate prose or specs; it collects raw facts only.

Instruct the agent to:

1. **Map the file tree.** Run `find` or `ls -R` on source directories. Ignore `node_modules`, `dist`, `build`, `.git`, `__pycache__`, `.venv`, `vendor`, `target`. Return the tree as a flat list of paths grouped by top-level directory.

2. **Detect the tech stack.** Read dependency manifests (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`, `Gemfile`, `pom.xml`, `build.gradle`, `composer.json`, etc.). Return:
   - Language(s) and version(s)
   - Framework(s) and version(s)
   - Key libraries (ORM, test runner, UI framework, HTTP client, etc.)

3. **Detect the data layer.** Search for schema definitions — ORM schema files, SQL migrations, GraphQL `.graphql`/`.gql` files, JSON Schema, Protobuf `.proto`, TypeORM entities, Mongoose models, etc. Return the list of schema source files found (paths only).

4. **Detect API surfaces.** Search for route definitions — framework-specific patterns (Express `router.get`, FastAPI `@app.get`, Spring `@GetMapping`, Rails `routes.rb`, Next.js `app/api/`, etc.). Return the list of files containing route definitions (paths only).

5. **Detect automation.** Search for CI/CD configs (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`, `Dockerfile`, `docker-compose.yml`, `Makefile`, scripts in `bin/`, `scripts/`, etc.). Return the list of files found (paths only).

6. **Detect testing infrastructure.** Search for test config files (vitest/jest/pytest/rspec/go test configs) and test directories (`tests/`, `test/`, `__tests__/`, `spec/`). Return test framework, config file paths, and test directory paths.

7. **Read project conventions.** Read these files if they exist and return their content verbatim:
   - `CLAUDE.md` or `AGENTS.md` (development conventions)
   - `.ai-board/config.yml` (project metadata)
   - `.ai-board/memory/constitution.md` (project principles)
   - Any `CONTRIBUTING.md` or `ARCHITECTURE.md`

8. **Integrate external context.** If `--external-docs=<path>` was provided, read the file and append its content to the brief. If `--context="<text>"` was provided, append it as-is.

The agent MUST return the brief as a single structured document using this format:

```
## File Tree
<grouped file list>

## Tech Stack
- Language: ...
- Framework: ...
- Key Libraries: ...

## Data Layer
- Schema source files: <paths>

## API Surfaces
- Route definition files: <paths>

## Automation
- CI/CD and infra files: <paths>

## Testing Infrastructure
- Framework: ...
- Config files: <paths>
- Test directories: <paths>

## Project Conventions
<verbatim content of convention files, or "None found">

## External Context
<external docs content and/or user context, or "None provided">
```

**Gate**: If the brief is empty or the agent fails, stop and report the error. Do not proceed.

---

## Phase 1: Specialist Agents (parallel Sonnet agents)

Using the Project Brief from Phase 0, launch specialist agents **in parallel**. Each agent receives the full brief plus targeted instructions. Each agent MUST read source files directly to produce accurate specs — the brief provides orientation, not a substitute for reading code.

The number of agents depends on the `--depth` level:

### QUICK Depth — 1 agent

Launch **1 Sonnet agent: Overview**.

### STANDARD Depth — 4 parallel agents

Launch all 4 agents in a single parallel dispatch:

- **a. Architecture Agent**
- **b. Data Model Agent**
- **c. API Agent**
- **d. Automation Agent**

### COMPREHENSIVE Depth — 6 parallel agents

Launch all 6 agents in a single parallel dispatch:

- **a. Architecture Agent**
- **b. Data Model Agent**
- **c. API Agent**
- **d. Automation Agent**
- **e. Features Agent**
- **f. Testing Agent**

---

### Agent Specifications

#### Overview Agent (QUICK+)

Instruct the agent to generate `overview.md`:

> Using the Project Brief below, generate a project overview specification.
>
> Read the main entry points, config files, and key source directories to understand the project's purpose and structure.
>
> Produce a markdown document with these sections:
>
> 1. **Project Summary** — What the project does, who it's for, core value proposition. 2-3 paragraphs max.
> 2. **Tech Stack** — Table with columns: Category, Technology, Version, Role. Cover language, framework, database, ORM, UI, testing, deployment.
> 3. **Architecture Overview** — High-level description of the system architecture. Include a Mermaid `graph TB` diagram showing the main components and their relationships (max 12 nodes).
> 4. **Directory Structure** — Annotated tree of key directories with one-line descriptions of each.
> 5. **Development Setup** — Commands to install, run, test, build (extract from package.json scripts, Makefile, README, etc.).
> 6. **Key Conventions** — Summarize conventions from CLAUDE.md/AGENTS.md/constitution if present.
>
> At STANDARD+ depth, also add:
> 7. **System Context Diagram** — Mermaid `C4Context` diagram showing the system, its users, and external dependencies.
>
> At COMPREHENSIVE depth, also add:
> 8. **Component Inventory** — Table listing every major module/package with: name, path, responsibility, dependencies, public surface area.
>
> Requirements:
> - Every file path referenced MUST exist in the Project Brief's file tree.
> - Every technology listed MUST appear in the detected tech stack.
> - Mermaid diagrams MUST use max 12 nodes. Prefer clarity over completeness.
> - Start the document with a Table of Contents linking to each section.

For QUICK depth, this is the only agent. After it completes, skip to Phase 2 (Validation).

---

#### Architecture Agent (STANDARD+)

Instruct the agent to generate `architecture.md`:

> Using the Project Brief below, generate an architecture specification.
>
> Read the main source directories, entry points, middleware, configuration, and key modules to map the system architecture.
>
> Produce a markdown document with these sections:
>
> 1. **Architecture Style** — Identify the architectural pattern(s) used (monolith, microservices, serverless, MVC, hexagonal, event-driven, etc.) with evidence from the codebase.
> 2. **Component Diagram** — Mermaid `graph TB` diagram showing all major components, their boundaries, and communication paths. Use subgraphs to group related components.
> 3. **Data Flow** — Mermaid `sequenceDiagram` showing the primary data flow through the system (e.g., a typical user request from entry to response).
> 4. **Layer Breakdown** — For each architectural layer identified (presentation, business logic, data access, infrastructure), list the directories/files that belong to it and describe their responsibilities.
> 5. **External Dependencies** — Table of external services, APIs, and infrastructure the system depends on (databases, caches, message queues, third-party APIs, etc.).
> 6. **Cross-Cutting Concerns** — Describe how authentication, authorization, error handling, logging, and configuration are implemented. Reference specific files.
>
> At COMPREHENSIVE depth, also add:
> 7. **Dependency Graph** — Mermaid `graph LR` showing inter-module dependencies (which modules import from which).
> 8. **Architectural Decisions** — List key design decisions observable in the code (e.g., "uses server-side rendering", "polling instead of websockets") with the evidence that supports each.
>
> Requirements:
> - Every component in diagrams MUST correspond to real directories or files.
> - Mermaid diagrams: max 12 nodes per diagram. Split into multiple diagrams if needed.
> - Start the document with a Table of Contents linking to each section.

---

#### Data Model Agent (STANDARD+)

Instruct the agent to generate `data-model.md`:

> Using the Project Brief below, generate a data model specification.
>
> Read ALL schema source files listed in the brief's Data Layer section. If no schema files are found, search for model definitions in the source code (classes, structs, interfaces that represent domain entities).
>
> Produce a markdown document with these sections:
>
> 1. **Data Layer Overview** — What database/storage technology is used, how schemas are defined (ORM, raw SQL, etc.), where schema files live.
> 2. **Entity-Relationship Diagram** — Mermaid `erDiagram` showing all entities and their relationships. If there are more than 12 entities, split into domain-grouped diagrams.
> 3. **Entity Catalog** — For each entity/model, a subsection with:
>    - Table name / collection name
>    - Fields: name, type, constraints (required, unique, default, etc.)
>    - Relationships: type (1:1, 1:N, N:M), target entity, foreign key
>    - Indexes if discoverable
> 4. **Enums and Constants** — List all enums/constants used in the data layer with their values and purpose.
>
> At COMPREHENSIVE depth, also add:
> 5. **State Machines** — For entities with status/state fields, generate Mermaid `stateDiagram-v2` showing valid state transitions. Read the source code to identify transition logic.
> 6. **Migration History** — If migration files exist, summarize the evolution of the schema (key changes, not every migration).
> 7. **Data Integrity Rules** — Document validation rules, cascade behaviors, and business constraints enforced at the data layer.
>
> Requirements:
> - Every entity MUST correspond to a real model/table defined in the codebase.
> - Every field listed MUST exist in the schema source files.
> - ER diagrams: max 12 entities per diagram. Group by domain if splitting.
> - Start the document with a Table of Contents linking to each section.

---

#### API Agent (STANDARD+)

Instruct the agent to generate `endpoints.md`:

> Using the Project Brief below, generate an API specification.
>
> Read ALL route definition files listed in the brief's API Surfaces section. For each file, extract route definitions, HTTP methods, path parameters, query parameters, request bodies, and response shapes.
>
> Produce a markdown document with these sections:
>
> 1. **API Overview** — API style (REST, GraphQL, gRPC, tRPC, etc.), base URL pattern, authentication mechanism, common headers/middleware.
> 2. **Endpoint Catalog** — Group endpoints by resource or domain. For each endpoint:
>    - Method + Path (e.g., `GET /api/users/:id`)
>    - Purpose (one-line description)
>    - Auth required: yes/no
>    - Path/query parameters
>    - Request body shape (if applicable)
>    - Response shape (success + error)
>    - Source file + line reference
> 3. **Authentication & Authorization** — How auth works, middleware chain, role/permission model.
> 4. **Error Handling** — Common error response format, status codes used, error types.
>
> At COMPREHENSIVE depth, also add:
> 5. **Request/Response Schemas** — Full TypeScript/JSON Schema/Protobuf definitions for every request and response type. Reference source files.
> 6. **API Flow Diagrams** — Mermaid `sequenceDiagram` for 2-3 key API workflows showing the full request lifecycle (client → middleware → handler → database → response).
>
> If no API surfaces are detected in the brief, generate a minimal document stating "No API surface detected" with an explanation of what was searched for.
>
> Requirements:
> - Every endpoint listed MUST exist in the route definition files.
> - Every schema MUST be extracted from actual source code, not invented.
> - Start the document with a Table of Contents linking to each section.

---

#### Automation Agent (STANDARD+)

Instruct the agent to generate `workflows.md`:

> Using the Project Brief below, generate a workflows and automation specification.
>
> Read ALL automation files listed in the brief's Automation section. Also read scripts, Makefiles, and any orchestration configuration.
>
> Produce a markdown document with these sections:
>
> 1. **Automation Overview** — What CI/CD platform is used, deployment strategy, infrastructure-as-code tools.
> 2. **Workflow Catalog** — For each workflow/pipeline found:
>    - Name and trigger (push, PR, schedule, manual, etc.)
>    - Purpose (one-line description)
>    - Steps/stages summary
>    - Key inputs/outputs/secrets
>    - Source file reference
> 3. **Workflow Diagrams** — Mermaid `graph LR` diagram for each non-trivial workflow showing the step sequence. For workflows with conditional branches, use decision nodes.
> 4. **Scripts & Commands** — Catalog of utility scripts (`bin/`, `scripts/`, Makefile targets, package.json scripts) with purpose and usage.
> 5. **Infrastructure** — Docker, container orchestration, cloud config if present.
>
> At COMPREHENSIVE depth, also add:
> 6. **Deployment Pipeline** — End-to-end Mermaid `graph LR` showing the full path from code commit to production, including all gates and environments.
> 7. **Environment Configuration** — Environment variables, secrets, and config files required, with descriptions (never include actual secret values).
>
> If no automation files are detected in the brief, generate a minimal document stating "No automation detected" with an explanation of what was searched for.
>
> Requirements:
> - Every workflow listed MUST correspond to a real file in the codebase.
> - Mermaid diagrams: max 12 nodes per diagram.
> - Start the document with a Table of Contents linking to each section.

---

#### Features Agent (COMPREHENSIVE only)

Instruct the agent to generate `features.md`:

> Using the Project Brief below, generate a functional specification.
>
> Read the source code — pages, views, controllers, services, handlers — to identify the user-facing and system features. Cluster features by business domain.
>
> Produce a markdown document with these sections:
>
> 1. **Feature Map** — Mermaid `graph TB` showing feature domains and their relationships (max 12 nodes).
> 2. **Feature Catalog** — For each feature/domain:
>    - Name and description
>    - User-facing behavior (what the user sees/does)
>    - System behavior (what happens behind the scenes)
>    - Key source files involved
>    - Dependencies on other features
> 3. **User Journeys** — Mermaid `sequenceDiagram` for 3-5 key user workflows showing the interaction between user, frontend, backend, and external services.
> 4. **State Machines** — For any feature with stateful behavior (e.g., order status, ticket lifecycle, user onboarding), generate Mermaid `stateDiagram-v2` diagrams.
> 5. **Business Rules** — List non-obvious business rules discovered in the code (validation logic, access control rules, calculation formulas, etc.) with source file references.
>
> Requirements:
> - Every feature MUST be evidenced by actual source code.
> - Every user journey MUST reflect real code paths.
> - Start the document with a Table of Contents linking to each section.

---

#### Testing Agent (COMPREHENSIVE only)

Instruct the agent to generate `testing.md`:

> Using the Project Brief below, generate a testing specification.
>
> Read the test configuration files, test directories, and a representative sample of test files (at least 5-10 test files across different directories).
>
> Produce a markdown document with these sections:
>
> 1. **Testing Overview** — Test framework(s), test runner, configuration, how to run tests.
> 2. **Test Architecture** — Mermaid `graph TB` showing the testing layers (unit, integration, E2E, etc.) and which directories/tools cover each layer.
> 3. **Test Catalog** — Table with columns: Test Type, Directory, Framework, Count (approximate), Purpose.
> 4. **Testing Patterns** — Document the testing patterns used in the codebase:
>    - How mocking/stubbing is done
>    - Test data setup (fixtures, factories, seeds)
>    - Authentication in tests
>    - Database handling in tests (in-memory, test DB, mocks)
> 5. **Coverage** — If coverage config exists, document the coverage thresholds and how to generate reports.
> 6. **Test Commands** — Table of all test-related commands with descriptions.
>
> Requirements:
> - Every pattern described MUST be evidenced by real test files (cite file paths).
> - Start the document with a Table of Contents linking to each section.

---

## Phase 2: Validation (parallel Haiku agents)

After all specialist agents complete, launch **parallel Haiku validation agents** — one per generated spec file. Each agent receives:
- The generated spec content
- The Project Brief from Phase 0

Instruct each validation agent to:

> Cross-check this generated specification against the Project Brief. Verify:
>
> 1. **File paths** — Every file path referenced in the spec MUST appear in the Project Brief's file tree. Flag any path that does not exist.
> 2. **Technologies** — Every technology, framework, or library mentioned MUST appear in the detected tech stack. Flag any that were invented.
> 3. **Entities/Models** — Every entity, model, or table name MUST correspond to a schema source file in the brief. Flag any that were hallucinated.
> 4. **Endpoints** — Every API endpoint MUST correspond to a route definition file in the brief. Flag any that were invented.
> 5. **Mermaid diagrams** — Check that diagram nodes reference real components/entities from the codebase, not generic placeholders.
>
> Return one of:
> - `PASS` — No issues found.
> - `CORRECTIONS: <list of specific corrections to apply>` — List each issue with the exact text to remove or replace.

For each agent that returns `CORRECTIONS`, apply the corrections to the spec content before writing the file. Remove hallucinated items silently. Do NOT add new content — only remove or fix inaccurate references.

---

## Phase 3: Assembly & Output

1. **Create** the `specs/specifications/` directory if it does not exist.

2. **Generate the index.** Create `specs/specifications/index.md` with:
   - Project name and generation date
   - Depth level used
   - Table of Contents linking to every generated spec file, with a one-line description of each:
     ```markdown
     ## Specifications Index
     
     | Document | Description |
     |----------|-------------|
     | [Overview](overview.md) | Project summary, tech stack, architecture overview |
     | [Architecture](architecture.md) | System architecture, components, data flow |
     | ... | ... |
     
     ---
     *Generated by retro-spec at depth STANDARD on 2025-01-15*
     ```

3. **Write all spec files.** Overwrite existing files — the specs reflect the current codebase state.

4. **Write the Overview.** For STANDARD and COMPREHENSIVE depths, merge the Overview Agent's output with cross-references to the other spec files. Add a "Detailed Specifications" section at the end of `overview.md` linking to each companion file.

5. **Report to user.** Output a summary listing:
   - Number of files generated
   - File paths written
   - Any corrections applied during validation
   - Any spec files that were skipped (e.g., "No API surface detected")

---

## Agent Model Selection

- **Phase 0** (Static Discovery): Haiku — fast extraction, no generation needed
- **Phase 1** (Specialist Agents): Sonnet — balanced quality/speed for spec generation
- **Phase 2** (Validation): Haiku — fast cross-checking, no generation needed

---

## Depth Summary

| Depth | Agents | Output Files |
|-------|--------|--------------|
| QUICK | 1 (Overview) | `index.md`, `overview.md` |
| STANDARD | 4 (Architecture, Data Model, API, Automation) + Overview | `index.md`, `overview.md`, `architecture.md`, `data-model.md`, `endpoints.md`, `workflows.md` |
| COMPREHENSIVE | 6 (all above + Features, Testing) + Overview | `index.md`, `overview.md`, `architecture.md`, `data-model.md`, `endpoints.md`, `workflows.md`, `features.md`, `testing.md` |

---

## Quality Requirements

- Generated specs MUST reference real file paths from the codebase — validated in Phase 2.
- Generated specs MUST accurately describe the actual tech stack and architecture.
- Generated specs MUST NOT hallucinate features, endpoints, or entities that do not exist in the code.
- Every spec file MUST start with a Table of Contents with anchor links to each section.
- Every Mermaid diagram MUST use max 12 nodes. Split into multiple diagrams if more nodes are needed.
- Depth levels MUST be additive — each level includes all content from lower levels.

## Error Handling

- If Phase 0 fails entirely, stop and report the error. Do not proceed to Phase 1.
- If a specialist agent fails, write the other specs normally and report which spec could not be generated.
- If a validation agent fails, write the spec without validation and note it was unvalidated in the output summary.
- Missing optional files (`CLAUDE.md`, `constitution.md`, external docs) MUST NOT cause failure.
