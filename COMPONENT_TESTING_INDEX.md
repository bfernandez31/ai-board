# Component Testing - Complete Documentation Index

This is your entry point for comprehensive component testing setup with React Testing Library, Vitest, and happy-dom.

## Where to Start

### If you have 5 minutes: Quick Start
- Read: **COMPONENT_TESTING_SETUP_SUMMARY.md** (Quick Reference section)
- Copy: One of the example tests from `tests/unit/examples/`
- Run: `bun run test:unit:watch`

### If you have 30 minutes: Complete Overview
1. Read: **COMPONENT_TESTING_README.md** (Overview and key findings)
2. Review: The three example test files
3. Skim: **COMPONENT_TESTING_GUIDE.md** Table of Contents

### If you have 2+ hours: Deep Dive
1. Read: **COMPONENT_TESTING_GUIDE.md** (Complete reference)
2. Study: All example test files
3. Reference: API documentation in COMPONENT_TESTING_SETUP_SUMMARY.md
4. Keep: COMPONENT_TESTING_GUIDE.md bookmarked for troubleshooting

## File Organization

### Documentation Files (Read These)

| File | Size | Purpose | Read Time |
|------|------|---------|-----------|
| **COMPONENT_TESTING_GUIDE.md** | 28KB | Complete reference with all details | 30-45 min |
| **COMPONENT_TESTING_README.md** | 15KB | Overview and research findings | 10-15 min |
| **COMPONENT_TESTING_SETUP_SUMMARY.md** | 13KB | Quick reference and cheat sheet | 5-10 min |
| **COMPONENT_TESTING_INDEX.md** | This | Navigation guide | 2-3 min |

### Reusable Code Files (Copy These)

| File | Size | Purpose |
|------|------|---------|
| **tests/fixtures/vitest/render-utils.tsx** | 2.6KB | Custom render function with providers |
| **tests/fixtures/vitest/next-mocks.ts** | 4.7KB | Next.js navigation mocks |
| **tests/fixtures/vitest/types.ts** | 8.1KB | TypeScript type definitions |
| **tests/fixtures/factories/mock-data.ts** | 8.4KB | Type-safe mock data factories |

### Example Test Files (Study These)

| File | Size | Focus |
|------|------|-------|
| **tests/unit/examples/component-with-query.test.tsx** | 4.4KB | TanStack Query patterns |
| **tests/unit/examples/component-with-next-router.test.tsx** | 5.1KB | Next.js routing patterns |
| **tests/unit/examples/using-factories.test.tsx** | 8.5KB | Mock data factory patterns |

## Quick Navigation by Topic

### Configuration & Setup
- Location: **COMPONENT_TESTING_GUIDE.md** → "Configuration & Setup"
- Current setup: Already configured in vitest.config.mts
- No changes needed!

### happy-dom vs jsdom
- Location: **COMPONENT_TESTING_GUIDE.md** → "happy-dom vs jsdom"
- Key finding: happy-dom is 2-10x faster, sufficient for 95% of tests
- Recommendation: Default to happy-dom, switch to jsdom only when needed

### TanStack Query Testing
- Location: **COMPONENT_TESTING_GUIDE.md** → "TanStack Query Testing"
- Example: **tests/unit/examples/component-with-query.test.tsx**
- Pattern: Fresh QueryClient per test, disable retries for tests

### Next.js Feature Testing
- Location: **COMPONENT_TESTING_GUIDE.md** → "Mocking Next.js Features"
- Example: **tests/unit/examples/component-with-next-router.test.tsx**
- Utilities: **tests/fixtures/vitest/next-mocks.ts**
- Pattern: Mock hooks (useRouter, useSearchParams, usePathname)

### Mock Data Factories
- Location: **COMPONENT_TESTING_GUIDE.md** → "Type-Safe Mock Data Factories"
- Example: **tests/unit/examples/using-factories.test.tsx**
- Utilities: **tests/fixtures/factories/mock-data.ts**
- Pattern: Use Partial<T> for type-safe overrides

### Test Utilities & Render Wrappers
- Location: **COMPONENT_TESTING_SETUP_SUMMARY.md** → "Test Utilities & Render Wrappers"
- Utilities: **tests/fixtures/vitest/render-utils.tsx**
- Usage: `import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils'`

### Troubleshooting
- Location: **COMPONENT_TESTING_GUIDE.md** → "Troubleshooting"
- Quick ref: **COMPONENT_TESTING_SETUP_SUMMARY.md** → "Troubleshooting Quick Reference"

## Copy-Paste Quick Reference

### Basic Component Test
```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

### With Mock Data
```typescript
import { mockTicket } from '@/tests/fixtures/factories/mock-data';

it('renders ticket', () => {
  const ticket = mockTicket({ title: 'Custom Title' });
  renderWithProviders(<TicketCard ticket={ticket} />);
  expect(screen.getByText('Custom Title')).toBeInTheDocument();
});
```

### With Next.js Router
```typescript
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));
```

### With TanStack Query
```typescript
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'test' }),
  } as Response)
);

renderWithProviders(<ComponentUsingQuery />);
await waitFor(() => {
  expect(screen.getByText('test')).toBeInTheDocument();
});
```

## Key Commands

```bash
# Run all unit tests
bun run test:unit

# Watch mode (recommended during development)
bun run test:unit:watch

# Visual UI with coverage
bun run test:unit:ui

# Run specific file
bun run test:unit -- component-with-query.test.tsx

# Run tests matching pattern
bun run test:unit -- --grep "renders correctly"
```

## Important Files Already in Project

The ai-board project is already well-configured:

- ✅ **vitest.config.mts** - Vitest configured with happy-dom for unit tests
- ✅ **package.json** - All testing dependencies installed
- ✅ **tsconfig.json** - TypeScript strict mode enabled
- ✅ **tests/unit/** - Unit test directory ready
- ✅ **tests/fixtures/vitest/** - Test fixtures directory (add files here)

No configuration changes needed!

## New Files Added

### Documentation (3 files)
- COMPONENT_TESTING_GUIDE.md
- COMPONENT_TESTING_README.md
- COMPONENT_TESTING_SETUP_SUMMARY.md

### Test Utilities (4 files)
- tests/fixtures/vitest/render-utils.tsx
- tests/fixtures/vitest/next-mocks.ts
- tests/fixtures/vitest/types.ts
- tests/fixtures/factories/mock-data.ts

### Examples (3 files)
- tests/unit/examples/component-with-query.test.tsx
- tests/unit/examples/component-with-next-router.test.tsx
- tests/unit/examples/using-factories.test.tsx

## How to Use This Guide

### Step 1: Understand the Setup
- Read: COMPONENT_TESTING_README.md → "Key Research Findings"
- Takes 10 minutes
- Gives you the "why" behind the setup

### Step 2: Learn the Patterns
- Study: The three example test files
- Takes 20 minutes
- Shows you real code patterns

### Step 3: Reference When Writing Tests
- Keep open: COMPONENT_TESTING_SETUP_SUMMARY.md
- Quick copy-paste for common patterns
- Use COMPONENT_TESTING_GUIDE.md for deep dives

### Step 4: Troubleshoot Issues
- Go to: COMPONENT_TESTING_GUIDE.md → "Troubleshooting"
- Or: COMPONENT_TESTING_SETUP_SUMMARY.md → "Troubleshooting Quick Reference"

## Research Sources

All information from authoritative sources:

- **TanStack Query Testing** - [Official Docs](https://tanstack.com/query/v3/docs/framework/react/guides/testing)
- **React Testing Library** - [Official Docs](https://testing-library.com/docs/react-testing-library/intro/)
- **Vitest Configuration** - [Official Docs](https://vitest.dev/config/)
- **Next.js Testing Patterns** - [DEV Community](https://dev.to/peterlidee/-mocking-usesearchparams-and-userouter-with-jest-in-next-13-nextnavigation-15bd)
- **TypeScript Factory Patterns** - [DEV Community](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9)
- **happy-dom vs jsdom** - [Vitest Discussion](https://github.com/vitest-dev/vitest/discussions/1607)

Full source list in COMPONENT_TESTING_GUIDE.md

## File Structure

```
/
├── COMPONENT_TESTING_INDEX.md              (This file - navigation)
├── COMPONENT_TESTING_GUIDE.md              (Complete reference - 28KB)
├── COMPONENT_TESTING_README.md             (Overview & findings - 15KB)
├── COMPONENT_TESTING_SETUP_SUMMARY.md      (Quick reference - 13KB)
│
├── tests/
│   ├── fixtures/
│   │   ├── vitest/
│   │   │   ├── render-utils.tsx            (NEW - custom render)
│   │   │   ├── next-mocks.ts               (NEW - Next.js mocks)
│   │   │   ├── types.ts                    (NEW - type definitions)
│   │   │   ├── setup.ts                    (existing - integration)
│   │   │   ├── api-client.ts               (existing - API client)
│   │   │   └── global-setup.ts             (existing - global setup)
│   │   │
│   │   └── factories/
│   │       └── mock-data.ts                (NEW - mock factories)
│   │
│   └── unit/
│       ├── examples/
│       │   ├── component-with-query.test.tsx       (NEW - query example)
│       │   ├── component-with-next-router.test.tsx (NEW - router example)
│       │   └── using-factories.test.tsx            (NEW - factory example)
│       │
│       ├── use-reduced-motion.test.ts              (existing)
│       ├── useJobPolling.test.ts                   (existing)
│       └── [other existing tests...]
│
└── vitest.config.mts                       (already configured - no changes)
```

## TypeScript Strict Mode

All code is fully compatible with TypeScript strict mode:
- ✅ Type-safe factories with Partial<T>
- ✅ All mocks properly typed
- ✅ No unnecessary `any` types
- ✅ Full IDE autocomplete support

## Performance Tips

1. **Use happy-dom by default** (already configured)
2. **Disable retries in tests** (render-utils.tsx handles this)
3. **Clear mocks between tests** (example tests show pattern)
4. **Use factories for data** (mock-data.ts provides this)
5. **Test behavior, not implementation** (examples demonstrate this)

## Next Steps

### Immediate (Today)
1. Read COMPONENT_TESTING_README.md (10 min)
2. Review example test files (20 min)
3. Copy render-utils.tsx to your project (already done)

### Short Term (This Week)
1. Write your first component test using examples as template
2. Run `bun run test:unit:watch`
3. Refer to COMPONENT_TESTING_SETUP_SUMMARY.md for patterns

### Long Term (Reference)
1. Keep COMPONENT_TESTING_GUIDE.md bookmarked
2. Use mock-data.ts for all test data
3. Use render-utils.tsx for all component tests
4. Refer to examples when adding new test patterns

## Support

For each type of question:

| Question | Answer Location |
|----------|-----------------|
| "How do I test a component with useQuery?" | COMPONENT_TESTING_GUIDE.md → TanStack Query Testing OR example file |
| "How do I mock Next.js router?" | COMPONENT_TESTING_GUIDE.md → Mocking Next.js Features OR example file |
| "How do I create test data?" | COMPONENT_TESTING_GUIDE.md → Type-Safe Mock Data Factories OR example file |
| "Why are we using happy-dom?" | COMPONENT_TESTING_GUIDE.md → happy-dom vs jsdom |
| "My test is failing with 'No QueryClient set'" | COMPONENT_TESTING_GUIDE.md → Troubleshooting |
| "What's the API for renderWithProviders?" | COMPONENT_TESTING_SETUP_SUMMARY.md → API Reference |
| "Show me an example" | tests/unit/examples/ - pick the one matching your use case |

## Summary

You now have:
- ✅ Complete documentation (4 files, 69KB)
- ✅ Ready-to-use test utilities (4 files)
- ✅ Working example tests (3 files)
- ✅ Type-safe mock data factories
- ✅ Next.js router mocking utilities
- ✅ Custom render wrapper with providers
- ✅ Full troubleshooting guide
- ✅ Best practices and patterns

Everything is in place to write high-quality component tests in TypeScript strict mode!

---

**Start here:** COMPONENT_TESTING_README.md (10 min read)
**Then read:** COMPONENT_TESTING_GUIDE.md (complete reference)
**Keep open:** COMPONENT_TESTING_SETUP_SUMMARY.md (quick reference)

Good luck with your component tests!
