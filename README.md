# AI Board

Visual kanban board for AI-driven development using Spec-kit + Claude Code.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript strict mode
- **Styling**: TailwindCSS 3.x
- **Testing**: Hybrid strategy with Vitest (unit tests) and Playwright (integration/E2E tests)
- **Database**: PostgreSQL via Prisma ORM (future)
- **AI**: Anthropic Claude API Sonnet 4.5 (future)
- **Deployment**: Vercel

## Prerequisites

- Node.js 22.20.0 LTS
- Bun 1.x (package manager)
- Git

## Getting Started

### Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Install Playwright browsers (if not already installed)
bunx playwright install
```

### Development

```bash
# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Create production build
- `bun run start` - Start production server
- `bun run lint` - Run ESLint
- `bun run type-check` - Run TypeScript type checking
- `bun run format` - Format code with Prettier
- `bun run format:check` - Check code formatting
- `bun test` - Run all tests (unit + E2E)
- `bun run test:unit` - Run Vitest unit tests
- `bun run test:e2e` - Run Playwright E2E tests
- `bun run test:e2e:ui` - Run Playwright tests with UI
- `bun run test:e2e:headed` - Run Playwright tests in headed mode

## Project Structure

```
ai-board/
├── app/                    # Next.js App Router pages and layouts
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   └── globals.css        # Global styles
├── components/            # Reusable React components (feature-based)
├── lib/                   # Shared utilities and helper functions
├── tests/                 # Test files
│   ├── unit/             # Vitest unit tests (~1ms per test)
│   ├── integration/      # Playwright integration tests
│   └── e2e/              # Playwright E2E tests
├── prisma/                # Prisma schema and migrations (future)
├── public/                # Static assets
└── .specify/              # Spec-kit configuration and templates
```

## Constitution

This project follows the [AI Board Constitution](.ai-board/memory/constitution.md) which defines 5 core principles:

1. **TypeScript-First Development** - Strict mode, explicit types
2. **Component-Driven Architecture** - shadcn/ui, feature-based folders
3. **Test-Driven Development** - Hybrid testing strategy: Vitest for unit tests (~1ms), Playwright for integration/E2E tests (non-negotiable)
4. **Security-First Design** - Input validation, secure queries, secrets management
5. **Database Integrity** - Prisma migrations, transactions, soft deletes

## Development Workflow

This project uses [Spec-kit](https://github.com/anthropics/spec-kit) for specification-driven development:

```bash
# Create a new feature specification
/specify [feature description]

# Create implementation plan
/plan

# Generate tasks
/tasks

# Implement feature
# Follow tasks.md in specs/[feature-number]-[feature-name]/
```

## Testing

This project uses a **hybrid testing strategy** for optimal speed and coverage:

- **Vitest**: Unit tests for pure utility functions (~1ms per test, instant feedback)
- **Playwright**: Integration and E2E tests for component behavior and user flows (~500ms-2s per test)

### Unit Tests (Vitest)

```bash
# Run unit tests
bun run test:unit

# Run unit tests in watch mode
bun run test:unit:watch

# Run unit tests with UI
bun run test:unit:ui
```

### Integration & E2E Tests (Playwright)

```bash
# Run all tests (unit + E2E)
bun test

# Run E2E tests only
bun run test:e2e

# Run tests in UI mode
bun run test:e2e:ui

# Run tests in headed mode (see browser)
bun run test:e2e:headed
```

### Test Selection Guidelines

- **Use Vitest when**: Testing pure functions, no DOM/browser needed, isolated business logic
- **Use Playwright when**: Testing component rendering, user interactions, API integration, critical user flows

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Required variables (for future features):
- `DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `GITHUB_TOKEN` - GitHub CLI authentication

## Deployment

The project is configured for deployment on Vercel:

1. Push to GitHub
2. Import repository in Vercel
3. Configure environment variables
4. Deploy

Main branch auto-deploys to production. Pull requests create preview deployments.

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Follow the spec-kit workflow
3. Ensure all tests pass: `bun test`
4. Ensure types are valid: `bun run type-check`
5. Ensure linting passes: `bun run lint`
6. Create pull request

## License

Private repository - All rights reserved.

## Foundation Status

✅ Next.js 15 with TypeScript strict mode
✅ TailwindCSS configured
✅ Hybrid testing strategy (Vitest + Playwright)
✅ ESLint and Prettier configured
✅ Constitutional compliance verified
✅ Project structure established

**Ready for feature development!**