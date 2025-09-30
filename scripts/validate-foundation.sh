#!/bin/bash
set -e

echo "🔍 Validating AI Board Foundation..."

echo "1️⃣ Checking project structure..."
test -d app && test -d components && test -d lib && test -d tests && echo "✅ Directories exist"

echo "2️⃣ Installing dependencies..."
npm install --silent

echo "3️⃣ Type checking..."
npx tsc --noEmit && echo "✅ TypeScript strict mode passes"

echo "4️⃣ Linting..."
npm run lint && echo "✅ ESLint passes"

echo "5️⃣ Building production..."
npm run build && echo "✅ Production build succeeds"

echo "6️⃣ Running Playwright tests..."
npm run test:e2e && echo "✅ E2E tests pass"

echo ""
echo "✨ Foundation validation complete! All checks passed."
echo "🚀 Ready to start feature development."