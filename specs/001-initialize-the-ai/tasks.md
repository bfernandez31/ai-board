# Tasks: Project Foundation Bootstrap

**Input**: Design documents from `/Users/b.fernandez/Workspace/ai-board/specs/001-initialize-the-ai/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅ (N/A), quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Implementation plan loaded
   → ✅ Extracted: Next.js 15, TypeScript strict, TailwindCSS, Playwright
2. Load optional design documents:
   → ✅ research.md: Setup commands and configurations identified
   → ✅ data-model.md: No entities (foundation only)
   → ✅ quickstart.md: Validation scenarios extracted
   → ⚠️  contracts/: Not applicable (no API endpoints in foundation)
3. Generate tasks by category:
   → ✅ Setup: Next.js initialization, dependency installation
   → ✅ Configuration: TypeScript strict, ESLint, Prettier, Playwright
   → ✅ Structure: Directory creation, placeholder files
   → ✅ Validation: Foundation tests, build verification
   → ✅ Documentation: README with setup instructions
4. Apply task rules:
   → ✅ Configuration files marked [P] (different files)
   → ✅ Validation sequential (depends on setup completion)
   → ✅ No TDD for foundation (infrastructure setup)
5. Number tasks sequentially (T001, T002...)
   → ✅ 18 tasks generated
6. Generate dependency graph
   → ✅ Dependencies documented below
7. Create parallel execution examples
   → ✅ Parallel examples provided
8. Validate task completeness:
   → ✅ All setup steps covered
   → ✅ All configuration files included
   → ✅ All validation steps from quickstart.md
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
**Project Type**: Web application (Next.js App Router - unified structure)
- All paths relative to repository root: `/Users/b.fernandez/Workspace/ai-board/`
- App Router structure: `/app`, `/components`, `/lib`, `/tests`

---

## Phase 3.1: Project Initialization

### T001 - Initialize Next.js 15 project with TypeScript and TailwindCSS
**Description**: Run `create-next-app` to bootstrap the Next.js 15 project with App Router, TypeScript, TailwindCSS, and ESLint.

**Command**:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

**Expected Output**:
- `/app` directory with `layout.tsx`, `page.tsx`, `globals.css`
- `/public` directory for static assets
- Configuration files: `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.json`
- `package.json` with Next.js 15, React 18, TailwindCSS dependencies
- `.gitignore` with standard Next.js exclusions

**Verification**: Run `ls -la` and confirm all expected files and directories exist

---

## Phase 3.2: TypeScript Strict Configuration

### T002 - Configure TypeScript strict mode with additional checks
**Description**: Update `tsconfig.json` to enable strict mode and additional type safety checks as specified in research.md.

**File**: `tsconfig.json`

**Changes**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    // ... keep other Next.js defaults
  }
}
```

**Verification**: Run `npx tsc --noEmit` and confirm zero errors

---

## Phase 3.3: Additional Configuration Files (Parallel)

### T003 [P] - Install and configure Playwright with MCP support
**Description**: Install Playwright and create configuration file for E2E testing with MCP integration.

**Commands**:
```bash
npm install -D @playwright/test
npx playwright install
```

**File**: `playwright.config.ts`

**Content**: Configuration as specified in research.md with test directory `./tests`, base URL `http://localhost:3000`, and projects for chromium, firefox, webkit.

**Verification**: Run `npx playwright --version` and confirm installation

### T004 [P] - Create environment variable template
**Description**: Create `.env.example` with template variables for future features.

**File**: `.env.example`

**Content**:
```env
# Database (future)
DATABASE_URL="postgresql://user:password@localhost:5432/ai-board"

# AI Integration (future)
ANTHROPIC_API_KEY="sk-ant-..."

# GitHub Integration (future)
GITHUB_TOKEN="ghp_..."

# Optional
NODE_ENV="development"
PORT="3000"
```

**Verification**: Confirm file exists and is tracked by git

### T005 [P] - Update .gitignore for environment files
**Description**: Verify `.gitignore` includes all environment variable files and add any missing entries.

**File**: `.gitignore`

**Ensure Present**:
```
.env
.env.local
.env*.local
```

**Verification**: Run `grep -E "\.env" .gitignore` and confirm entries exist

---

## Phase 3.4: Directory Structure Creation (Parallel)

### T006 [P] - Create component directory structure
**Description**: Create `/components` directory with `.gitkeep` for feature-based component organization.

**Command**:
```bash
mkdir -p components
touch components/.gitkeep
```

**Verification**: Run `ls -la components` and confirm `.gitkeep` exists

### T007 [P] - Create lib directory for utilities
**Description**: Create `/lib` directory with `.gitkeep` for shared utility functions.

**Command**:
```bash
mkdir -p lib
touch lib/.gitkeep
```

**Verification**: Run `ls -la lib` and confirm `.gitkeep` exists

### T008 [P] - Create tests directory for Playwright E2E tests
**Description**: Create `/tests` directory for Playwright test files.

**Command**:
```bash
mkdir -p tests
```

**Verification**: Run `ls -la tests` and confirm directory exists

### T009 [P] - Create prisma directory for future database
**Description**: Create `/prisma` directory with `.gitkeep` for future Prisma schema.

**Command**:
```bash
mkdir -p prisma
touch prisma/.gitkeep
```

**Verification**: Run `ls -la prisma` and confirm `.gitkeep` exists

### T010 [P] - Create API routes directory
**Description**: Create `/app/api` directory with `.gitkeep` for future API endpoints.

**Command**:
```bash
mkdir -p app/api
touch app/api/.gitkeep
```

**Verification**: Run `ls -la app/api` and confirm `.gitkeep` exists

---

## Phase 3.5: Homepage Customization

### T011 - Update homepage with foundation confirmation message
**Description**: Modify `/app/page.tsx` to display "AI Board - Foundation Ready" message confirming successful initialization.

**File**: `app/page.tsx`

**Content**: Simple page with:
- Page title: "AI Board"
- Main heading: "Foundation Ready"
- Subtext: "Next.js 15 + TypeScript + TailwindCSS + Playwright configured"
- List of constitutional compliance: TypeScript strict, Component structure, Testing ready, Security configured, Database ready

**Verification**: Start dev server (`npm run dev`) and open http://localhost:3000

---

## Phase 3.6: Foundation Validation Test

### T012 - Create Playwright foundation validation test
**Description**: Create E2E test that validates foundation setup per quickstart.md validation steps.

**File**: `tests/foundation.spec.ts`

**Test Coverage**:
1. Homepage loads successfully (status 200)
2. Page displays "Foundation Ready" text
3. No JavaScript errors in console
4. Page title is "AI Board" or similar

**Example Test**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Foundation Validation', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Foundation Ready');
    await expect(page).toHaveTitle(/AI Board/);
  });

  test('no console errors on homepage', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto('/');
    expect(consoleErrors).toHaveLength(0);
  });
});
```

**Verification**: Run `npx playwright test` and confirm tests pass

---

## Phase 3.7: Package.json Scripts

### T013 - Add custom npm scripts to package.json
**Description**: Add convenient scripts for testing and validation to `package.json`.

**File**: `package.json`

**Add Scripts**:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

**Verification**: Run `npm run --list` and confirm all scripts are available

---

## Phase 3.8: Prettier Configuration (Optional but Recommended)

### T014 [P] - Install and configure Prettier for code formatting
**Description**: Install Prettier and create configuration file aligned with ESLint.

**Commands**:
```bash
npm install -D prettier eslint-config-prettier
```

**File**: `.prettierrc`

**Content**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

**File**: `.prettierignore`

**Content**:
```
.next
node_modules
out
dist
build
*.lock
```

**Update**: `.eslintrc.json` to extend `prettier` config

**Verification**: Run `npm run format:check` and confirm no errors

---

## Phase 3.9: Documentation

### T015 - Create comprehensive README.md
**Description**: Create README.md with project overview, setup instructions, development commands, and constitution reference.

**File**: `README.md`

**Content Structure**:
1. **Project Title**: AI Board
2. **Description**: Visual kanban board for AI-driven development using Spec-kit + Claude Code
3. **Tech Stack**: Next.js 15, TypeScript, TailwindCSS, Playwright, Prisma
4. **Prerequisites**: Node.js 22.20.0 LTS, npm
5. **Setup Instructions**:
   - Clone repository
   - Install dependencies: `npm install`
   - Run dev server: `npm run dev`
6. **Available Scripts**: Document all npm scripts
7. **Project Structure**: Brief overview of directories
8. **Constitution**: Link to `.specify/memory/constitution.md`
9. **Development Workflow**: Reference to spec-kit commands
10. **Testing**: How to run Playwright tests

**Verification**: Read README.md and confirm all information is accurate

---

## Phase 3.10: Final Validation

### T016 - Run TypeScript type check
**Description**: Execute TypeScript compiler to verify zero type errors with strict mode.

**Command**:
```bash
npx tsc --noEmit
```

**Expected Output**: No errors

**If Errors**: Fix type errors before proceeding

### T017 - Run ESLint check
**Description**: Execute ESLint to verify zero warnings or errors.

**Command**:
```bash
npm run lint
```

**Expected Output**: No errors or warnings

**If Warnings**: Fix linting issues before proceeding

### T018 - Execute production build
**Description**: Run production build to verify successful compilation and bundle generation.

**Command**:
```bash
npm run build
```

**Expected Output**:
- Build completes successfully
- `.next` directory created
- Bundle size report displayed
- Initial bundle < 500KB

**Verification**: Check for build errors and bundle size

---

## Dependencies

**Sequential Dependencies**:
- T001 (initialize) must complete before all other tasks
- T002-T010 depend on T001
- T011 depends on T001 (needs app/page.tsx to exist)
- T012 depends on T003, T011 (needs Playwright installed and homepage created)
- T013 depends on T001 (needs package.json)
- T015 depends on all setup tasks (documents final structure)
- T016-T018 depend on all previous tasks (final validation)

**Parallel Opportunities**:
- T003, T004, T005 can run in parallel (different files)
- T006, T007, T008, T009, T010 can run in parallel (different directories)
- T014 can run in parallel with other configuration tasks

**Critical Path**: T001 → T002 → T011 → T012 → T016 → T017 → T018

---

## Parallel Execution Examples

### Batch 1: Configuration Files (After T001)
```bash
# Run these tasks concurrently:
# T003 - Playwright installation
npm install -D @playwright/test && npx playwright install

# T004 - Create .env.example
cat > .env.example << 'EOF'
DATABASE_URL="postgresql://user:password@localhost:5432/ai-board"
ANTHROPIC_API_KEY="sk-ant-..."
GITHUB_TOKEN="ghp_..."
NODE_ENV="development"
PORT="3000"
EOF

# T005 - Verify .gitignore
grep -E "\.env" .gitignore
```

### Batch 2: Directory Structure (After T001)
```bash
# Run these tasks concurrently:
# T006-T010
mkdir -p components lib tests prisma app/api
touch components/.gitkeep lib/.gitkeep prisma/.gitkeep app/api/.gitkeep
```

### Batch 3: Final Validation (After T015)
```bash
# Run these sequentially:
npm run type-check && npm run lint && npm run build
```

---

## Task Execution Order

**Recommended Sequence**:
1. **T001** - Initialize project (CRITICAL - blocks everything)
2. **T002** - Configure TypeScript strict mode
3. **Parallel Batch 1**: T003, T004, T005 (configuration files)
4. **Parallel Batch 2**: T006, T007, T008, T009, T010 (directories)
5. **T011** - Update homepage
6. **T012** - Create foundation test
7. **T013** - Add npm scripts
8. **T014** - Configure Prettier (optional, can be parallel with T013)
9. **T015** - Create README
10. **Validation Sequence**: T016 → T017 → T018

**Estimated Time**: 45-60 minutes for full setup

---

## Completion Checklist

After all tasks complete, verify:
- [ ] All directories exist (app, components, lib, tests, prisma, public)
- [ ] TypeScript strict mode enabled and passes (`npx tsc --noEmit`)
- [ ] ESLint passes with zero warnings (`npm run lint`)
- [ ] Development server starts successfully (`npm run dev`)
- [ ] Homepage displays "Foundation Ready" message
- [ ] Production build completes (`npm run build`)
- [ ] Playwright tests pass (`npm run test:e2e`)
- [ ] README.md documents setup and usage
- [ ] .env.example provides environment variable template
- [ ] .gitignore excludes sensitive files
- [ ] All constitution principles satisfied

**Ready for Feature Development**: ✅ When all checkboxes complete

---

## Notes

**No TDD for Foundation**: Unlike feature development, foundation setup doesn't follow strict TDD since we're configuring infrastructure, not implementing features.

**Future Features**: This foundation prepares for:
- Kanban board UI (will use shadcn/ui components)
- Drag-and-drop functionality (@dnd-kit integration)
- AI integration (Claude API)
- Database models (Prisma schema)
- GitHub operations (gh CLI integration)

**Constitution Compliance**: Every task aligns with AI Board Constitution v1.0.0 principles:
- TypeScript strict mode (Principle I)
- Component-driven structure (Principle II)
- Playwright testing ready (Principle III)
- Security-first environment variables (Principle IV)
- Prisma preparation (Principle V)

---

*Generated from implementation plan at `/Users/b.fernandez/Workspace/ai-board/specs/001-initialize-the-ai/plan.md`*