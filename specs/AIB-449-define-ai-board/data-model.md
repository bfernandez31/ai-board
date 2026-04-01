# Data Model: .ai-board/config.yml Schema & Validation

**Feature Branch**: `AIB-449-define-ai-board`
**Date**: 2026-04-01

## Entities

### ProjectConfig (Root)

The fully validated configuration object returned after successful parsing.

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `version` | `number` | Yes | — | Must equal `1` (only supported version) |
| `project` | `ProjectSection` | Yes | — | Object with required sub-fields |
| `runtime` | `RuntimeSection` | Yes | — | Object with required sub-fields |
| `services` | `ServiceConfig[]` | No | `[]` | Array of service entries |
| `commands` | `CommandsSection` | Yes | — | Object with required `install` |
| `env` | `Record<string, string>` | No | `{}` | Flat key-value map of strings |
| `agent` | `AgentSection` | No | `{ cli: "claude-code" }` | Object with optional sub-fields |

### ProjectSection

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `name` | `string` | Yes | — | Non-empty string |
| `language` | `ProjectLanguage` | Yes | — | Enum: `typescript`, `python`, `go`, `rust`, `java` |
| `framework` | `ProjectFramework` | No | `"none"` | Enum: `nextjs`, `express`, `fastapi`, `django`, `gin`, `none` |

### RuntimeSection

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `manager` | `PackageManager` | Yes | — | Enum: `bun`, `npm`, `yarn`, `pnpm`, `pip`, `poetry`, `cargo` |
| `manager_version` | `string` | No | `undefined` | Semver-like string when present |
| `node` | `string` | No | `undefined` | Version string (e.g., `"22"`, `"20.11.0"`) |
| `python` | `string` | No | `undefined` | Version string (e.g., `"3.11"`, `"3.12.1"`) |

### CommandsSection

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `install` | `string` | Yes | — | Non-empty string (shell command) |
| `build` | `string` | No | `undefined` | Shell command |
| `lint` | `string` | No | `undefined` | Shell command |
| `type_check` | `string` | No | `undefined` | Shell command |
| `test_unit` | `string` | No | `undefined` | Shell command |
| `test_integration` | `string` | No | `undefined` | Shell command |
| `test_e2e` | `string` | No | `undefined` | Shell command |

### ServiceConfig

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `type` | `ServiceType` | Yes | — | Enum: `postgres`, `redis`, `mysql`, `mongo` |
| `version` | `string` | Yes | — | Non-empty version string |
| `database` | `string` | No | `undefined` | Database name (applicable to `postgres`, `mysql`, `mongo`) |
| `username` | `string` | No | `undefined` | Service username |
| `password` | `string` | No | `undefined` | Service password |

### AgentSection

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `cli` | `AgentCli` | No | `"claude-code"` | Enum: `claude-code`, `codex` |
| `model` | `string` | No | `undefined` | Free-form string (not validated against fixed list) |

### ValidationError

Structured error object returned when validation fails.

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Dot-notation field path (e.g., `"project.language"`) |
| `type` | `ValidationErrorType` | Enum: `missing_required`, `invalid_value`, `invalid_type`, `unknown_field` |
| `value` | `unknown` | The invalid value provided (if any) |
| `message` | `string` | Human-readable error with fix guidance |

### ValidationWarning

Non-blocking warning for unknown fields.

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Dot-notation field path |
| `message` | `string` | Human-readable warning (e.g., "Unknown field 'comands' — did you mean 'commands'?") |

## Enums

| Enum | Values |
|------|--------|
| `ProjectLanguage` | `typescript`, `python`, `go`, `rust`, `java` |
| `ProjectFramework` | `nextjs`, `express`, `fastapi`, `django`, `gin`, `none` |
| `PackageManager` | `bun`, `npm`, `yarn`, `pnpm`, `pip`, `poetry`, `cargo` |
| `ServiceType` | `postgres`, `redis`, `mysql`, `mongo` |
| `AgentCli` | `claude-code`, `codex` |
| `ValidationErrorType` | `missing_required`, `invalid_value`, `invalid_type`, `unknown_field` |

## Relationships

```
ProjectConfig
├── 1:1 ProjectSection (required)
├── 1:1 RuntimeSection (required)
├── 1:N ServiceConfig[] (optional, 0..N)
├── 1:1 CommandsSection (required)
├── 1:1 Record<string, string> env (optional)
└── 1:1 AgentSection (optional, defaults applied)
```

## State Transitions

**ValidationResult**: A discriminated union:
- `{ success: true, data: ProjectConfig, warnings: ValidationWarning[] }`
- `{ success: false, errors: ValidationError[], warnings: ValidationWarning[] }`

No runtime state transitions — this is a stateless parse-and-validate operation.

## Notes

- **No database impact**: This feature is purely file-based. No Prisma schema changes.
- **Immutable output**: The `ProjectConfig` object is read-only after parsing — workflows consume it but never modify it.
- **Service credentials**: For CI/test environments only. Production credentials must never appear in this file.
