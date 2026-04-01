# Quickstart: .ai-board/config.yml Schema & Validation

**Feature Branch**: `AIB-449-define-ai-board`

## Prerequisites

- Node.js 22+ with Bun installed
- ai-board repository cloned

## Setup

```bash
# Install the new YAML dependency
bun add yaml
```

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/validations/config.ts` | Zod schema definitions for config.yml |
| `lib/config-loader.ts` | File I/O: read YAML, parse, validate, return result |
| `tests/unit/config-schema.test.ts` | Unit tests for schema validation (pure functions) |
| `tests/unit/config-loader.test.ts` | Unit tests for file loading (mocked fs) |

## Quick Validation Example

```typescript
import { validateConfig } from '@/lib/validations/config';
import { loadConfig } from '@/lib/config-loader';

// Option 1: Validate a raw object (useful in tests)
const result = validateConfig({
  version: 1,
  project: { name: 'my-app', language: 'typescript' },
  runtime: { manager: 'bun' },
  commands: { install: 'bun install' },
});

if (result.success) {
  console.log(result.data.project.name); // "my-app"
  console.log(result.data.agent.cli);    // "claude-code" (default)
} else {
  console.log(result.errors); // ValidationError[]
}

// Option 2: Load from a target repository path
const result2 = await loadConfig('/path/to/target-repo');
```

## Example Config File

Create `.ai-board/config.yml` in a target repository:

```yaml
version: 1

project:
  name: my-app
  language: typescript
  framework: nextjs

runtime:
  manager: bun
  node: "22"

services:
  - type: postgres
    version: "14"
    database: myapp_test
    username: postgres
    password: postgres

commands:
  install: bun install
  build: bun run build
  lint: bun run lint
  type_check: bun run type-check
  test_unit: bun run test:unit
  test_integration: bun run test:integration
  test_e2e: bun run test:e2e

env:
  NODE_ENV: test
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/myapp_test

agent:
  cli: claude-code
  model: claude-sonnet-4-6
```

## Minimal Config (required fields only)

```yaml
version: 1

project:
  name: my-app
  language: python

runtime:
  manager: pip

commands:
  install: pip install -r requirements.txt
```

## Testing

```bash
# Run unit tests for this feature
bun run test:unit tests/unit/config-schema.test.ts
bun run test:unit tests/unit/config-loader.test.ts
```
