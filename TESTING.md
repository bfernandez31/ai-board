# Testing Guide

## Environment Setup for Tests

### E2E Tests (without GitHub API)

Most E2E tests should run without actually calling GitHub API. To configure:

1. Create `.env.test.local`:
```bash
# Test environment - skips GitHub API calls
GITHUB_TOKEN=ghp_test_token_placeholder
```

2. Run tests normally:
```bash
npx playwright test
```

The test server will use `NODE_ENV=test` and load `.env.test.local`, which contains a placeholder token. GitHub API calls will be skipped.

### Integration Tests (with real GitHub API)

To test actual GitHub workflow dispatch:

1. Ensure `.env.local` has your real GitHub token:
```bash
GITHUB_TOKEN=ghp_your_real_token_here
```

2. Run tests with development environment:
```bash
NODE_ENV=development npx playwright test tests/your-integration-test.spec.ts
```

Or create a separate Playwright config file for integration tests.

## Environment File Priority

Next.js loads environment files in this order (later files override earlier):

1. `.env` - Default values
2. `.env.local` - Local overrides (gitignored)
3. `.env.test.local` - Test environment overrides (when NODE_ENV=test)

## Current Setup

- **Regular E2E tests**: Use `.env.test.local` with placeholder token
- **Manual testing**: Use `.env.local` with real token
- **Integration tests**: Use `NODE_ENV=development` to use `.env.local`
