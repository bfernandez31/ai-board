# AI Board

Visual kanban board for AI-driven development using Spec-kit + Claude Code.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript strict mode
- **Styling**: TailwindCSS 3.x
- **Testing**: Playwright with MCP support
- **Database**: PostgreSQL via Prisma ORM (future)
- **AI**: Anthropic Claude API Sonnet 4.5 (future)
- **Deployment**: Vercel

## Prerequisites

- Node.js 18.17+ or 20.x+
- npm package manager
- Git

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers (if not already installed)
npx playwright install
```

### Development

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run test:e2e:ui` - Run Playwright tests with UI
- `npm run test:e2e:headed` - Run Playwright tests in headed mode

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
├── tests/                 # Playwright E2E tests
├── prisma/                # Prisma schema and migrations (future)
├── public/                # Static assets
└── .specify/              # Spec-kit configuration and templates
```

## Constitution

This project follows the [AI Board Constitution](.specify/memory/constitution.md) which defines 5 core principles:

1. **TypeScript-First Development** - Strict mode, explicit types
2. **Component-Driven Architecture** - shadcn/ui, feature-based folders
3. **Test-Driven Development** - Playwright E2E tests (non-negotiable)
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

### E2E Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

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
3. Ensure all tests pass: `npm run test:e2e`
4. Ensure types are valid: `npm run type-check`
5. Ensure linting passes: `npm run lint`
6. Create pull request

## License

Private repository - All rights reserved.

## Foundation Status

✅ Next.js 15 with TypeScript strict mode
✅ TailwindCSS configured
✅ Playwright E2E testing ready
✅ ESLint and Prettier configured
✅ Constitutional compliance verified
✅ Project structure established

**Ready for feature development!**