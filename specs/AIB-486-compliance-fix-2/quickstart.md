# Quickstart: AIB-486 Compliance Fix 2

## What This Changes

Two security compliance fixes in the project config validation and sync pipeline:

1. **Service credentials stripped** — `username` and `password` fields in `services[]` are removed before storing config in the database and before returning in API responses.
2. **Unknown fields rejected** — Config files with unrecognized fields now fail validation with descriptive errors instead of silently passing through.

## Files to Modify

| File | Change |
|------|--------|
| `lib/validations/config.ts` | `.passthrough()` → `.strict()` on root + section schemas; add `stripServiceCredentials()` export; handle `unrecognized_keys` in `mapZodErrors()` |
| `lib/config-sync.ts` | Call `stripServiceCredentials()` after validation, before DB write |
| `tests/unit/config-schema.test.ts` | Update unknown-field tests (expect errors, not warnings); add credential stripping unit tests |
| `tests/integration/projects/config-sync.test.ts` | Add tests verifying credentials absent from stored config |

## Implementation Order

1. Add `.strict()` to all section schemas and root schema in `config.ts`
2. Add `unrecognized_keys` handling in `mapZodErrors()`
3. Add `stripServiceCredentials()` function in `config.ts`
4. Update `config-sync.ts` to strip credentials alongside `env`
5. Update unit tests
6. Update integration tests
7. Run `bun run type-check && bun run lint && bun run test:unit`

## Verification

```bash
bun run type-check        # No type errors
bun run lint              # No lint errors
bun run test:unit tests/unit/config-schema.test.ts   # All pass
bun run test:integration tests/integration/projects/config-sync.test.ts  # All pass
```
