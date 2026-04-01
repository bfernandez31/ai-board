# Research: .ai-board/config.yml Schema & Validation

**Feature Branch**: `AIB-449-define-ai-board`
**Date**: 2026-04-01

## Research Questions & Findings

### RQ-1: YAML Parser Selection

**Decision**: Use the `yaml` package (v2.x) — the modern, maintained YAML 1.2 parser for Node.js.

**Rationale**:
- Full YAML 1.2 spec compliance (vs. `js-yaml` which is YAML 1.1)
- Built-in TypeScript types (no `@types/` needed)
- Detailed parse error messages with line/column numbers (supports FR-009)
- Active maintenance, small bundle size
- Used widely in the Node.js ecosystem (500k+ weekly downloads)

**Alternatives Considered**:
- `js-yaml`: YAML 1.1, no built-in TS types, less detailed error reporting. Rejected for inferior DX.
- Custom parser: Unnecessary complexity. Rejected.

### RQ-2: Validation Approach — Zod Schema

**Decision**: Use Zod v4 (already installed at v4.3.6) for schema definition and validation.

**Rationale**:
- Already the project standard — used in `lib/validations/` and `mcp-server/src/config.ts`
- Supports `.safeParse()` for collecting all errors (FR-008)
- Type inference via `z.infer<>` provides the typed config object (FR-015)
- Custom error messages with path context (FR-009)
- Enum validation for `language`, `framework`, `manager`, `cli` (FR-003 through FR-006)

**Alternatives Considered**:
- `ajv` (JSON Schema): Adds new dependency, different paradigm from project conventions. Rejected.
- Manual validation: Error-prone, no type inference. Rejected.

### RQ-3: File Location for New Code

**Decision**: Place schema and validation in `lib/validations/config.ts` (schema) and `lib/config-loader.ts` (file loading + YAML parsing).

**Rationale**:
- Follows existing project structure — `lib/validations/` houses all Zod schemas
- Separation of concerns: schema definition (pure, testable) vs. file I/O (side effects)
- Existing pattern in `mcp-server/src/config.ts` provides a proven loading pattern to follow
- Tests go in `tests/unit/config-schema.test.ts` (pure validation) — no DB or server needed

**Alternatives Considered**:
- Single file: Mixing I/O with schema reduces testability. Rejected.
- New `lib/config/` directory: Over-engineering for two files. Rejected for now — can refactor if scope grows.

### RQ-4: Error Handling Strategy

**Decision**: Two-layer error handling:
1. **YAML parse errors**: Catch `yaml` library errors, wrap with line/column info and "fix your YAML syntax" guidance.
2. **Schema validation errors**: Use Zod's `safeParse()` with custom error map to produce structured `ValidationError` objects per FR-009.

**Rationale**:
- YAML syntax errors and schema validation errors are fundamentally different — users need different guidance for each.
- Zod's error flattening produces field paths automatically (e.g., `project.language`).
- Collecting all errors (FR-008) is native to `safeParse()` — no custom accumulation needed.

**Alternatives Considered**:
- Single error type for both: Confuses syntax errors with semantic errors. Rejected.
- Fail-on-first: Explicitly rejected by FR-008.

### RQ-5: Unknown Fields / Forward Compatibility

**Decision**: Use Zod's `.passthrough()` on the root object, then post-validate to emit warnings for unknown keys.

**Rationale**:
- `.strict()` would reject unknown keys as errors — violates FR-014 (warnings only).
- `.passthrough()` allows unknown keys through, then a post-parse step can collect them and emit warnings.
- Supports forward compatibility as the schema evolves across versions.

**Alternatives Considered**:
- `.strip()`: Silently drops unknown keys — no warning feedback. Rejected (FR-014 requires warnings).
- `.strict()`: Fails on unknown keys. Rejected (FR-014 specifies warnings, not errors).

### RQ-6: Default Values for Optional Fields

**Decision**: Use Zod's `.default()` and `.optional()` to populate defaults in the parsed output.

**Rationale**:
- Zod's `.default()` fills missing fields during parse — the output type is always the full shape.
- This satisfies FR-015 (fully typed config with defaults populated).
- Optional commands default to `undefined` — workflows check `if (config.commands.lint)` to decide whether to skip.

**Defaults**:
- `project.framework`: `"none"`
- `runtime.node`: `undefined` (workflow uses its default)
- `runtime.python`: `undefined`
- `runtime.manager_version`: `undefined`
- `services`: `[]` (empty array)
- `env`: `{}` (empty object)
- `agent.cli`: `"claude-code"`
- `agent.model`: `undefined`
- Optional commands (`build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`): `undefined`

### RQ-7: No Database Impact

**Decision**: This feature is purely file-based — no Prisma schema changes needed.

**Rationale**:
- Config files are read from target repositories at workflow runtime.
- No config data is persisted in the ai-board database.
- The validation utility is a pure library function with no side effects beyond file reads.
