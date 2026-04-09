# Contract: config.yml Testing Section

## Schema

```yaml
# Version 1 config.yml — testing extensions
version: 1

project:
  name: "example-project"
  language: typescript
  framework: nextjs

testing:                            # NEW SECTION
  framework: vitest                 # Test framework identifier
  e2e: true                        # E2E framework detected
  e2e_framework: playwright        # E2E framework name (optional)

commands:
  install: "bun install"
  test: "bun run test"             # NEW: primary test command
  test_unit: "bun run test:unit"   # Existing: granular unit
  test_integration: "bun run test:integration"  # Existing: granular integration
  test_e2e: "bun run test:e2e"     # Existing: granular E2E
  type_check: "bun run type-check" # NEW: auto-detected
  lint: "bun run lint"             # NEW: auto-detected
  dev_server: "bun run dev"        # NEW: dev server for int/E2E tests
```

## Supported `testing.framework` Values

| Value | Language | JSON Reporter Flag | Parser |
|-------|----------|--------------------|--------|
| `vitest` | JS/TS | `--reporter=json --outputFile=<path>` | vitest JSON (`.testResults[].assertionResults[]`) |
| `jest` | JS/TS | `--json --outputFile=<path>` | jest JSON (same schema as vitest) |
| `pytest` | Python | `--tb=short -q` (text) or `--junitxml=<path>` (XML) | Line-based or JUnit XML |
| `cargo-test` | Rust | `-- -Z unstable-options --format json` (nightly) or text | Line-based (`test result: X passed; Y failed`) |
| `go-test` | Go | `-json` | Go test JSON (one JSON object per line) |
| `rspec` | Ruby | `--format json --out <path>` | RSpec JSON (`.examples[].status`) |
| `phpunit` | PHP | `--log-junit <path>` | JUnit XML |

## Command Resolution Priority

```
1. commands.test_unit / test_integration / test_e2e  (granular — preferred)
2. commands.test                                       (single command — fallback)
3. (neither present)                                   → SKIPPED
```

## Test Command Inference Rules (detect-stack.sh)

| Language | Detection Source | Inferred `commands.test` |
|----------|-----------------|--------------------------|
| JS/TS (bun) | `package.json` scripts.test | `bun run test` |
| JS/TS (npm) | `package.json` scripts.test | `npm test` |
| JS/TS (yarn) | `package.json` scripts.test | `yarn test` |
| JS/TS (pnpm) | `package.json` scripts.test | `pnpm test` |
| Python | pytest in deps | `pytest` |
| Rust | Cargo.toml exists | `cargo test` |
| Go | go.mod exists | `go test ./...` |
| Ruby | rspec in Gemfile | `bundle exec rspec` |
| PHP | phpunit in composer.json | `./vendor/bin/phpunit` |
| Java/Kotlin (maven) | pom.xml | `mvn test` |
| Java/Kotlin (gradle) | build.gradle | `gradle test` |
