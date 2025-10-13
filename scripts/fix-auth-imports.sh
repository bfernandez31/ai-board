#!/bin/bash

# Fix auth imports for all E2E test files

echo "🔧 Fixing auth imports in E2E tests..."

# Files in tests/e2e/ root
for file in tests/e2e/*.spec.ts; do
  if [ -f "$file" ]; then
    echo "  Processing: $file"
    sed -i.bak "s|import { test, expect } from '@playwright/test';|import { test, expect } from './fixtures/auth';|g" "$file"
    rm -f "${file}.bak"
  fi
done

# Files in tests/e2e subdirectories
for file in tests/e2e/*/*.spec.ts; do
  if [ -f "$file" ]; then
    echo "  Processing: $file"
    sed -i.bak "s|import { test, expect } from '@playwright/test';|import { test, expect } from '../fixtures/auth';|g" "$file"
    rm -f "${file}.bak"
  fi
done

# Files in tests/e2e sub-subdirectories (if any)
for file in tests/e2e/*/*/*.spec.ts; do
  if [ -f "$file" ]; then
    echo "  Processing: $file"
    sed -i.bak "s|import { test, expect } from '@playwright/test';|import { test, expect } from '../../fixtures/auth';|g" "$file"
    rm -f "${file}.bak"
  fi
done

echo "✅ Auth imports fixed!"
