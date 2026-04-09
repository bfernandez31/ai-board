# Contract: Project Config Test Capability Profile

## Purpose

Defines the config fields the generic TESTS scan consumes from `.ai-board/config.yml` and from sanitized `Project.config`.

## Shape

```yaml
version: 1
project:
  name: my-app
  language: typescript
  framework: nextjs
runtime:
  manager: bun
commands:
  install: bun install
  lint: bun run lint
  type_check: bun run type-check
  test_unit: bun run test:unit
  test_integration: bun run test:integration
  test_e2e: bun run test:e2e
testCapabilities:
  framework: vitest
  primaryCommandKey: test_unit
  hasE2E: true
agent:
  cli: claude-code
```

## Required semantics

- `commands.install` remains required.
- `commands.test_unit`, `commands.test_integration`, and `commands.test_e2e` are optional and may all be absent.
- `testCapabilities.primaryCommandKey` must reference one configured command key. If null/absent, the TESTS scan must skip.
- `testCapabilities.framework` is informational and may be null/absent if command detection still succeeds.
- `testCapabilities.hasE2E` records whether end-to-end coverage was detected and does not itself control scan eligibility.

## Detection rules

- Stack detection populates command fields only when a defensible command is found.
- Ambiguous or conflicting repository signals must leave the relevant field absent.
- The stored config must remain secret-free; `env` contents and service passwords are stripped before DB persistence.
