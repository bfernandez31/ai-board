#!/bin/bash

# Script to update E2E tests to use authenticated fixture
# Updates all test files to import from ../fixtures/auth instead of @playwright/test
# and replace { page } with { authenticatedPage: page }

echo "🔄 Updating E2E tests to use authenticated fixture..."

# Find all .spec.ts files in tests/e2e directory
find tests/e2e -name "*.spec.ts" -type f | while read -r file; do
  echo "  Processing: $file"

  # Replace import statement
  sed -i.bak "s|import { test, expect } from '@playwright/test';|import { test, expect } from '../fixtures/auth';|g" "$file"

  # Replace { page } with { authenticatedPage: page }
  sed -i.bak "s|async ({ page })|async ({ authenticatedPage: page })|g" "$file"

  # Remove backup file
  rm "${file}.bak"
done

echo "✅ E2E tests updated successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Review changes: git diff tests/e2e"
echo "  2. Run tests: bun test"
echo "  3. Commit changes if tests pass"
