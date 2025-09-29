# Research: Project Foundation Bootstrap

**Feature**: 001-initialize-the-ai
**Date**: 2025-09-30
**Status**: Complete

## Research Topics

### 1. Next.js 15 App Router Best Practices

**Decision**: Use `create-next-app` with TypeScript and App Router enabled

**Rationale**:
- Official CLI ensures correct configuration
- App Router is the recommended approach for Next.js 15
- TypeScript support is first-class
- Includes optimal defaults for production

**Command**:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

**Alternatives Considered**:
- Manual setup: Rejected - error-prone, misses optimizations
- Pages Router: Rejected - deprecated pattern, App Router is future
- Template repositories: Rejected - unnecessary complexity for foundation

**References**:
- Next.js 15 documentation: https://nextjs.org/docs
- App Router migration guide: https://nextjs.org/docs/app/building-your-application/upgrading

### 2. TypeScript Strict Mode Setup

**Decision**: Enable all strict checks in tsconfig.json

**Rationale**:
- Catches bugs at compile time
- Enforces type safety (Constitution Principle I)
- Better IDE support and refactoring
- No runtime overhead

**Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Alternatives Considered**:
- Gradual strictness: Rejected - Constitution requires strict from start
- Relaxed mode: Rejected - defeats TypeScript purpose

**References**:
- TypeScript Handbook: https://www.typescriptlang.org/tsconfig#strict
- Next.js TypeScript: https://nextjs.org/docs/app/building-your-application/configuring/typescript

### 3. Playwright + MCP Integration

**Decision**: Install Playwright with MCP server support

**Rationale**:
- Cross-browser testing (Chrome, Firefox, Safari)
- MCP integration enables AI-assisted testing
- Constitutional requirement (Principle III)
- Industry standard for E2E tests

**Installation**:
```bash
npm install -D @playwright/test @playwright/mcp
npx playwright install
```

**Configuration** (playwright.config.ts):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Alternatives Considered**:
- Jest + React Testing Library: Rejected - unit tests, not E2E
- Cypress: Rejected - Playwright has better MCP support
- Selenium: Rejected - outdated, complex setup

**References**:
- Playwright docs: https://playwright.dev
- Playwright MCP: https://github.com/microsoft/playwright-mcp

### 4. TailwindCSS + shadcn/ui Preparation

**Decision**: Install TailwindCSS 3.x, prepare for shadcn/ui (future feature)

**Rationale**:
- TailwindCSS is constitutional requirement
- shadcn/ui requires TailwindCSS as foundation
- Utility-first CSS reduces custom styling
- Excellent developer experience

**Installation**:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Configuration** (tailwind.config.ts):
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

**shadcn/ui Setup** (deferred to future feature):
- Will use `npx shadcn-ui@latest init` when needed
- Foundation just ensures TailwindCSS is ready

**Alternatives Considered**:
- CSS Modules: Rejected - Constitution mandates TailwindCSS
- Styled Components: Rejected - not in constitutional stack
- Plain CSS: Rejected - poor maintainability

**References**:
- TailwindCSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com

### 5. Vercel Deployment Configuration

**Decision**: Configure for Vercel deployment (main branch auto-deploy)

**Rationale**:
- Next.js optimized for Vercel
- Zero-config deployment
- Preview deployments for PRs
- Constitutional hosting requirement

**Configuration**:
- Vercel automatically detects Next.js projects
- No vercel.json needed for basic setup
- Build command: `next build`
- Output directory: `.next`

**Environment Variables**:
- Use Vercel dashboard for production secrets
- `.env.local` for local development
- `.env.example` committed as template

**Build Settings**:
```json
{
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Alternatives Considered**:
- Self-hosted: Rejected - Constitution specifies Vercel
- Netlify: Rejected - Next.js ISR not fully supported
- AWS Amplify: Rejected - more complex, not required

**References**:
- Vercel Next.js docs: https://vercel.com/docs/frameworks/nextjs
- Vercel CLI: https://vercel.com/docs/cli

## Summary of Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Project Init | create-next-app with App Router | Official CLI, optimal defaults |
| TypeScript | Strict mode enabled | Constitution Principle I |
| Testing | Playwright with MCP | Cross-browser E2E, AI integration |
| Styling | TailwindCSS 3.x | Constitution requirement, shadcn/ui ready |
| Deployment | Vercel with auto-deploy | Next.js optimized, zero config |
| Package Manager | npm | Default, no special requirements |
| Node Version | 18.17+ or 20.x+ | Next.js 15 requirement |

## Dependencies

**Production**:
- next@15.x
- react@18.x
- react-dom@18.x

**Development**:
- typescript@5.x
- @types/node@20.x
- @types/react@18.x
- @types/react-dom@18.x
- eslint@8.x
- eslint-config-next@15.x
- tailwindcss@3.x
- postcss@8.x
- autoprefixer@10.x
- @playwright/test@latest
- @playwright/mcp@latest

**Future** (not installed in foundation):
- @prisma/client
- prisma
- @dnd-kit/core
- @dnd-kit/sortable
- zod
- @anthropic-ai/sdk

## Environment Variables

**Required** (future features):
- `DATABASE_URL`: PostgreSQL connection string
- `ANTHROPIC_API_KEY`: Claude API key
- `GITHUB_TOKEN`: GitHub CLI authentication

**Optional**:
- `NODE_ENV`: production|development|test
- `PORT`: Development server port (default: 3000)

**Setup**:
`.env.example`:
```
# Database (future)
DATABASE_URL="postgresql://user:password@localhost:5432/ai-board"

# AI Integration (future)
ANTHROPIC_API_KEY="sk-ant-..."

# GitHub Integration (future)
GITHUB_TOKEN="ghp_..."
```

## Next Steps

Research complete. Proceed to Phase 1 (Design & Contracts).