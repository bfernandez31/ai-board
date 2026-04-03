# Research: AIB-486 Compliance Fix 2

## Research Task 1: Zod `.strict()` vs `.passthrough()` behavior

### Decision: Replace `.passthrough()` with `.strict()` on `ProjectConfigSchema`

### Rationale
- `.passthrough()` allows unknown keys to pass through validation and appear in the output — this directly violates Constitution §IV ("Validate ALL user inputs before processing").
- `.strict()` causes Zod to return a `ZodError` with `unrecognized_keys` issues when unknown fields are present, rejecting the input entirely.
- The existing `collectUnknownFieldWarnings()` function currently detects unknown fields and produces warnings. With `.strict()`, Zod itself will reject unknown fields at the schema level. The `collectUnknownFieldWarnings()` function can be retained for informational messages, but enforcement now happens via Zod.

### Alternatives Considered
1. **`.strip()`** — silently removes unknown keys. Rejected because it hides user errors (typos) instead of surfacing them.
2. **Keep `.passthrough()` + elevate warnings to errors manually** — more code, duplicates what `.strict()` does natively.

### Implementation Notes
- When `.strict()` is used, Zod produces issues with `code: 'unrecognized_keys'` containing a `keys` array of the unknown field names.
- The `mapZodErrors()` function needs a new case to handle `unrecognized_keys` issues and map them to `unknown_field` `ValidationError` entries.
- Nested section schemas (`ProjectSectionSchema`, `RuntimeSectionSchema`, `CommandsSectionSchema`, `AgentSectionSchema`) should also use `.strict()` to catch unknown fields within sections (e.g., `runtime.extra`).

---

## Research Task 2: Service credential stripping pattern

### Decision: Strip `username` and `password` from service entries in `config-sync.ts`, following the existing `env` stripping pattern

### Rationale
- `lib/config-sync.ts` already strips the `env` section at line 135: `const { env: _env, ...configWithoutEnv } = validation.data;`
- Service credentials should be stripped at the same location, after validation but before DB storage.
- A helper function `stripServiceCredentials()` in `lib/validations/config.ts` provides a clean, testable unit.

### Alternatives Considered
1. **Strip in the Zod schema via `.transform()`** — Rejected because credentials need to be validated (correct types) but not persisted. Transform would alter the validated type, complicating the schema.
2. **Strip at API response layer only** — Rejected because credentials would still be stored in DB, violating the "never expose sensitive data" rule.
3. **Remove `username`/`password` from `ServiceConfigSchema` entirely** — Rejected because the schema should validate that these fields, if present, are strings. Removing them would cause `.strict()` to reject configs with credentials, which is overly restrictive — users should be able to have credentials in their YAML source.

### Implementation Notes
- The `ServiceConfigSchema` keeps `username` and `password` as optional string fields for validation.
- After validation succeeds, `stripServiceCredentials()` creates a new services array with those fields omitted via destructuring.
- The stripping happens in `config-sync.ts` alongside the existing `env` stripping, before the DB write.
- The API response in the sync route already returns `result.config`, so stripping before storage also strips from the response.

---

## Research Task 3: Impact on existing tests

### Decision: Update existing test expectations; do not duplicate tests

### Rationale
- `tests/unit/config-schema.test.ts` has a "unknown fields produce warnings" section that expects `success: true` with warnings. After `.strict()`, these must expect `success: false` with errors of type `unknown_field`.
- The `fullConfig()` helper includes `username: 'postgres', password: 'postgres'` in services — this is fine for validation tests (schema still accepts these fields), but integration tests must verify they're stripped from stored/returned config.
- `tests/integration/projects/config-sync.test.ts` needs new tests for credential stripping in the DB-stored config.

### Alternatives Considered
- Creating entirely new test files — Rejected; extending existing files follows the "extend, don't duplicate" rule from CLAUDE.md.
