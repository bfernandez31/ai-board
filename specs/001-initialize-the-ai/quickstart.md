# Quickstart: Project Foundation Validation

**Feature**: 001-initialize-the-ai
**Date**: 2025-09-30
**Purpose**: Validate that the project foundation is correctly initialized

## Prerequisites

- Node.js 18.17+ or 20.x+ installed
- npm package manager
- Git repository initialized
- Internet connection for dependency installation

## Validation Steps

### 1. Verify Project Structure

**Expected Outcome**: All required directories and files exist

```bash
# Check core directories
ls -la app components lib tests prisma public

# Check configuration files
ls -la tsconfig.json next.config.js playwright.config.ts tailwind.config.ts .eslintrc.json
```

**Success Criteria**:
- ✅ `/app` directory exists with `layout.tsx`, `page.tsx`, `globals.css`
- ✅ `/components`, `/lib`, `/tests`, `/prisma`, `/public` directories exist
- ✅ Configuration files present and valid JSON/TypeScript

### 2. Install Dependencies

**Expected Outcome**: All dependencies install without errors

```bash
npm install
```

**Success Criteria**:
- ✅ No installation errors
- ✅ `node_modules` directory created
- ✅ `package-lock.json` generated

### 3. TypeScript Type Check

**Expected Outcome**: Zero TypeScript errors with strict mode

```bash
npx tsc --noEmit
```

**Success Criteria**:
- ✅ Compilation succeeds
- ✅ No type errors reported
- ✅ Strict mode enabled (verify in tsconfig.json: `"strict": true`)

### 4. Linting Check

**Expected Outcome**: Zero ESLint warnings or errors

```bash
npm run lint
```

**Success Criteria**:
- ✅ Linting completes
- ✅ No errors reported
- ✅ No warnings reported

### 5. Start Development Server

**Expected Outcome**: Server starts and homepage renders

```bash
npm run dev
```

**Success Criteria**:
- ✅ Server starts on http://localhost:3000
- ✅ No runtime errors in console
- ✅ Open browser to http://localhost:3000
- ✅ Page loads successfully (displays foundation confirmation)

**Visual Verification**:
- Page should render without errors
- No console errors in browser DevTools
- Hot reload works (edit `app/page.tsx`, see changes immediately)

### 6. Production Build

**Expected Outcome**: Production build completes successfully

```bash
npm run build
```

**Success Criteria**:
- ✅ Build completes without errors
- ✅ `.next` directory created with optimized bundles
- ✅ Static pages generated
- ✅ Build output shows bundle sizes

**Expected Output Pattern**:
```
Route (app)                              Size     First Load JS
┌ ○ /                                    ###      ### kB
└ ○ /api/...                            ###      ### kB
```

### 7. Playwright Test Execution

**Expected Outcome**: Foundation test passes

```bash
# Install browsers (one-time)
npx playwright install

# Run tests
npm run test:e2e
```

**Success Criteria**:
- ✅ Test suite runs
- ✅ Foundation test passes
- ✅ No test failures
- ✅ HTML report generated

**Test Coverage**:
- Homepage loads successfully
- No JavaScript errors
- Page title is correct
- Basic navigation works

### 8. Environment Variables

**Expected Outcome**: Environment variable management is configured

```bash
# Check for .env.example
cat .env.example

# Verify .gitignore includes env files
grep -E "\.env" .gitignore
```

**Success Criteria**:
- ✅ `.env.example` exists with template variables
- ✅ `.env.local` in `.gitignore`
- ✅ `.env` in `.gitignore`
- ✅ No secrets committed to repository

## Automated Validation Script

Create `scripts/validate-foundation.sh`:

```bash
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
npx playwright install --with-deps
npm run test:e2e && echo "✅ E2E tests pass"

echo ""
echo "✨ Foundation validation complete! All checks passed."
echo "🚀 Ready to start feature development."
```

**Usage**:
```bash
chmod +x scripts/validate-foundation.sh
./scripts/validate-foundation.sh
```

## Troubleshooting

### TypeScript Errors

**Issue**: Type errors during `tsc --noEmit`
**Solution**:
1. Check `tsconfig.json` has correct configuration
2. Verify all type definitions installed (`@types/*` packages)
3. Review error messages for missing types

### Build Failures

**Issue**: `npm run build` fails
**Solution**:
1. Check for syntax errors in source files
2. Verify all imports are valid
3. Ensure no circular dependencies
4. Check Next.js 15 compatibility of dependencies

### Playwright Installation Issues

**Issue**: Browser installation fails
**Solution**:
```bash
# Force reinstall browsers
npx playwright install --force

# Install system dependencies (Linux)
npx playwright install-deps
```

### Port Already in Use

**Issue**: Dev server fails to start (port 3000 busy)
**Solution**:
```bash
# Use different port
PORT=3001 npm run dev

# Or kill process on port 3000
lsof -ti:3000 | xargs kill
```

## Success Confirmation

**All validation steps must pass** before proceeding to feature development.

**Final Checklist**:
- [ ] Project structure matches plan.md specification
- [ ] TypeScript strict mode enabled and passes
- [ ] ESLint zero warnings
- [ ] Development server runs without errors
- [ ] Production build completes successfully
- [ ] Playwright tests pass
- [ ] Environment variables properly configured
- [ ] README.md documents setup steps

**Next Steps**: Proceed to `/tasks` command to generate implementation tasks.

## Manual Testing Scenarios

### Scenario 1: Homepage Load
1. Start dev server (`npm run dev`)
2. Open http://localhost:3000
3. Verify page loads without console errors
4. Check page displays "AI Board - Foundation Ready" (or similar)

### Scenario 2: Hot Reload
1. With dev server running
2. Edit `app/page.tsx` (change text)
3. Save file
4. Verify browser updates automatically (< 1 second)

### Scenario 3: TypeScript Enforcement
1. Add code with intentional type error: `const x: string = 123;`
2. Run `npx tsc --noEmit`
3. Verify error is caught: "Type 'number' is not assignable to type 'string'"
4. Remove error before committing

### Scenario 4: Build Output
1. Run `npm run build`
2. Check `.next/` directory created
3. Verify static files in `.next/static`
4. Check bundle size is reasonable (< 500KB initial JS)

## Performance Benchmarks

**Baseline Metrics** (empty application):
- Development server start: < 5 seconds
- Hot reload: < 1 second
- Production build: < 30 seconds
- Initial page load (local): < 500ms
- Lighthouse score: > 90

These metrics establish baseline performance for future optimization.