# Unit Tests

Pure functions with no side effects, React dependencies, or API calls.

## When to Use

- Utility functions (`lib/utils/`)
- Validators (`lib/validators/`)
- Formatters (`lib/format-*.ts`)
- Pure business logic
- State machine logic (without DB)

## Location

```
tests/unit/[feature].test.ts
tests/unit/[domain]/[feature].test.ts
```

## Environment

- **Vitest** with `happy-dom`
- Fast (~1ms per test)
- No network, no database

## Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/utils/my-function';

describe('myFunction', () => {
  it('handles basic case', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });

  it('handles edge case', () => {
    expect(myFunction('')).toBeNull();
  });

  it('throws on invalid input', () => {
    expect(() => myFunction(null)).toThrow('Invalid input');
  });
});
```

## Examples from ai-board

```typescript
// tests/unit/ticket-validation.test.ts
import { validateTicketTitle } from '@/lib/validators/ticket';

describe('validateTicketTitle', () => {
  it('accepts valid title', () => {
    expect(validateTicketTitle('Fix bug')).toBe(true);
  });

  it('rejects empty title', () => {
    expect(validateTicketTitle('')).toBe(false);
  });
});
```

```typescript
// tests/unit/format-timestamp.test.ts
import { formatTimestamp } from '@/lib/format-timestamp';

describe('formatTimestamp', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatTimestamp(date)).toBe('Jan 15, 2024');
  });
});
```

## Best Practices

1. **One assertion concept per test** - Test one behavior
2. **Descriptive test names** - `it('returns null when input is empty')`
3. **Arrange-Act-Assert** - Clear structure
4. **No mocks needed** - Pure functions don't need mocking
5. **Test edge cases** - Empty, null, undefined, boundary values
