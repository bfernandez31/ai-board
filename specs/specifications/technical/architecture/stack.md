# Technology Stack Reference

## Runtime & Framework

### Node.js 22.20.0 LTS
- **Version**: 22.20.0 (Long-Term Support)
- **Purpose**: Server runtime environment
- **Features Used**: ESM modules, modern JavaScript features
- **Environment**: Development, test, production, GitHub Actions

### TypeScript 5.6
- **Mode**: Strict mode enabled
- **Purpose**: Type safety across frontend and backend
- **Configuration**: tsconfig.json in project root
- **Build**: Next.js handles TypeScript compilation

### Next.js 15
- **Router**: App Router (RSC - React Server Components)
- **Rendering**: Server-side rendering + static generation
- **API Routes**: RESTful endpoints in `app/api/` directory
- **Middleware**: NextAuth.js authentication
- **Features Used**:
  - Dynamic routes: `[projectId]`, `[id]`
  - Server components for data fetching
  - Client components for interactivity

### React 18
- **Mode**: Concurrent mode
- **Components**: Functional components with hooks
- **Features Used**:
  - Suspense boundaries
  - Error boundaries
  - useEffect, useState, useMemo, useCallback hooks
  - Custom hooks for business logic

## Database & ORM

### PostgreSQL 14+
- **Version**: 14 or higher
- **Connection**: Via Prisma connection pooler
- **Features Used**:
  - JSONB columns (ticket attachments)
  - Composite indexes for performance
  - Foreign key constraints with cascade delete
  - Enum types for type safety
  - Transaction support

### Prisma 6.x
- **Version**: 6.x (exact version in package.json)
- **Purpose**: Type-safe ORM with schema migrations
- **Schema**: `prisma/schema.prisma`
- **Features Used**:
  - Schema migrations (`prisma migrate`)
  - Type-safe queries
  - Transaction API
  - Cascade delete
  - Seed scripts

## UI & Styling

### TailwindCSS 3.4
- **Version**: 3.4.x
- **Purpose**: Utility-first CSS framework
- **Theme**: Custom dark theme (zinc palette)
- **Configuration**: `tailwind.config.ts`
- **Features Used**:
  - Custom color palette
  - Responsive breakpoints (sm, md, lg)
  - Dark mode support
  - Custom utilities

### shadcn/ui
- **Base**: Radix UI primitives
- **Components Used**:
  - Dialog (modals)
  - Button
  - Badge
  - Tabs
  - Select
  - Tooltip
  - Input/Textarea
- **Customization**: Tailwind variants in `components/ui/`

### Radix UI
- **Version**: Latest stable
- **Purpose**: Accessible component primitives
- **Features Used**:
  - Compound components
  - ARIA-compliant patterns
  - Keyboard navigation
  - Focus management

### lucide-react
- **Version**: Latest stable
- **Purpose**: Icon library
- **Icons Used**: 50+ icons across application
- **Format**: React components with SVG

## State Management

### TanStack Query v5.90.5
- **Version**: 5.90.5
- **Purpose**: Server state management
- **Features Used**:
  - Query caching with intelligent invalidation
  - Optimistic updates with rollback
  - Request deduplication
  - Polling with auto-stop
  - Mutations with onMutate/onError/onSuccess
- **Configuration**: Query client in `app/lib/hooks/queries/`

### Query Key Factory
- **Location**: `app/lib/query-keys.ts`
- **Pattern**: Hierarchical keys for cache invalidation
- **Example**: `['projects', projectId, 'tickets', ticketId, 'comments']`

## Data Fetching & Validation

### Zod 4.x
- **Version**: 4.x (exact version in package.json)
- **Purpose**: Schema validation (client and server)
- **Schemas**: `app/lib/schemas/`
- **Features Used**:
  - Enum validation
  - String length constraints
  - Type inference for TypeScript
  - Custom error messages
  - Nullable/optional fields

### React Query Hooks
- **Queries**: `useTickets`, `useComments`, `useJobPolling`
- **Mutations**: `useCreateTicket`, `useUpdateTicket`, `useCreateComment`, `useDeleteComment`
- **Pattern**: Custom hooks wrapping TanStack Query

## Authentication

### NextAuth.js
- **Version**: Latest stable (v4)
- **Strategy**: Session-based authentication
- **Providers**: GitHub OAuth (production), mock (dev/test)
- **Storage**: Database sessions (PostgreSQL)
- **Features Used**:
  - OAuth integration
  - Session callbacks
  - JWT callbacks
  - Custom pages (`/auth/signin`)
  - Middleware for protected routes

### Test Authentication
- **Mode**: Mock authentication when `NODE_ENV !== 'production'`
- **Test User**: `test@e2e.local`
- **Pattern**: Auto-login in development and E2E tests
- **Security Model**: Same validation, simplified auth flow

## Drag & Drop

### @dnd-kit
- **Packages**:
  - `@dnd-kit/core`: Core drag-and-drop functionality
  - `@dnd-kit/sortable`: Sortable list utilities
- **Features Used**:
  - Touch device support
  - Drag overlays (ghost preview)
  - Collision detection
  - Accessibility (keyboard navigation)
- **Performance**: Optimistic UI updates with rollback

## GitHub Integration

### Octokit (@octokit/rest)
- **Version**: ^22.0.0
- **Purpose**: GitHub API client
- **Features Used**:
  - Workflow dispatch (`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`)
  - Authentication via GITHUB_TOKEN
  - Error handling (401, 403, 404, rate limits)
- **Location**: `app/lib/workflows/dispatch.ts`

## Markdown & Syntax Highlighting

### react-markdown
- **Version**: ^9.0.1
- **Purpose**: Markdown rendering in comments and docs
- **Features Used**:
  - HTML escaping (XSS protection)
  - Custom components (mentions)
  - Link support
  - Code blocks

### react-syntax-highlighter
- **Version**: ^15.5.0
- **Purpose**: Code syntax highlighting in markdown
- **Theme**: Dark theme matching application
- **Languages**: JavaScript, TypeScript, JSON, YAML, Bash

## Image Management

### Cloudinary SDK
- **Package**: `cloudinary` (Node.js SDK v2)
- **Purpose**: Image CDN for ticket attachments
- **Features Used**:
  - Upload API (buffer → public URL)
  - Delete API (cleanup on replace/remove)
  - Folder organization (`ai-board/tickets/{ticketId}/`)
  - Public HTTPS URLs for global access
- **Limits**: 25GB storage, 25GB bandwidth (free tier)
- **Configuration**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Testing

### Playwright
- **Version**: Latest stable
- **Purpose**: E2E and API contract testing
- **Command**: `npx playwright test`
- **Features Used**:
  - Cross-browser testing (Chromium, Firefox, WebKit)
  - API testing (`request` fixture)
  - Global setup/teardown
  - Test isolation
  - Screenshots on failure
- **Configuration**: `playwright.config.ts`

### Vitest
- **Version**: Latest stable
- **Purpose**: Unit testing
- **Command**: `bun test`
- **Features Used**:
  - Fast test execution
  - TypeScript support
  - Mocking utilities
  - Coverage reporting

## Date/Time

### date-fns
- **Version**: Latest stable
- **Purpose**: Date formatting and manipulation
- **Features Used**:
  - Relative timestamps ("2 hours ago")
  - Date formatting (ISO 8601)
  - Locale support

## Development Tools

### ESLint
- **Version**: Next.js default configuration
- **Purpose**: Code quality and consistency
- **Rules**: Next.js recommended + TypeScript rules
- **Command**: `bun run lint`

### TypeScript Compiler
- **Purpose**: Type checking without compilation
- **Command**: `bun run type-check`
- **Configuration**: `tsconfig.json`

### Bun (Optional)
- **Purpose**: Fast JavaScript runtime (alternative to npm)
- **Features**: Package manager, test runner, bundler
- **Commands**: `bun install`, `bun test`, `bun run dev`

## CI/CD & Automation

### GitHub Actions
- **Workflow Files**: `.github/workflows/*.yml`
- **Runners**: Ubuntu-latest (cloud-hosted)
- **Features Used**:
  - Workflow dispatch triggers
  - Secrets management
  - Environment variables
  - Job dependencies
  - Conditional execution
  - Matrix builds (not currently used)

### Claude Code CLI
- **Version**: Latest stable
- **Installation**: Global via npm (`npm install -g @anthropic-ai/claude-code`)
- **Purpose**: AI-powered code generation and specification
- **Commands**:
  - `/speckit.specify`: Generate specifications
  - `/speckit.plan`: Generate implementation plans
  - `/speckit.tasks`: Generate task breakdowns
  - `/speckit.implement`: Execute implementation
  - `/quick-impl`: Fast-track simple changes

## Deployment

### Vercel Platform
- **Features Used**:
  - Serverless functions (API routes)
  - Edge network (CDN)
  - Environment variables
  - Preview deployments
  - Production deployments
  - Build caching
- **Limitations**: No long-lived connections (no WebSockets)

### Environment Variables
- **Development**: `.env.local`
- **Production**: Vercel dashboard
- **Required**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `NEXTAUTH_SECRET`: NextAuth session secret
  - `NEXTAUTH_URL`: Application URL
  - `GITHUB_ID`: GitHub OAuth app ID
  - `GITHUB_SECRET`: GitHub OAuth app secret
  - `ANTHROPIC_API_KEY`: Claude API key
  - `WORKFLOW_API_TOKEN`: GitHub Actions authentication
  - `CLOUDINARY_CLOUD_NAME`: Cloudinary account
  - `CLOUDINARY_API_KEY`: Cloudinary API key
  - `CLOUDINARY_API_SECRET`: Cloudinary API secret

## Package Management

### npm/Bun
- **Lock File**: `package-lock.json` or `bun.lockb`
- **Scripts**:
  - `dev`: Start development server
  - `build`: Production build
  - `start`: Start production server
  - `lint`: Run ESLint
  - `type-check`: TypeScript type checking
  - `test`: Run all tests
  - `test:unit`: Run unit tests (Vitest)
  - `test:e2e`: Run E2E tests (Playwright)

## Version Matrix

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 15 | Framework |
| React | 18 | UI library |
| TypeScript | 5.6 | Type safety |
| Node.js | 22.20.0 LTS | Runtime |
| PostgreSQL | 14+ | Database |
| Prisma | 6.x | ORM |
| TanStack Query | 5.90.5 | State management |
| TailwindCSS | 3.4 | Styling |
| Zod | 4.x | Validation |
| Playwright | Latest | E2E testing |
| Vitest | Latest | Unit testing |
| @octokit/rest | ^22.0.0 | GitHub API |
| react-markdown | ^9.0.1 | Markdown rendering |
| date-fns | Latest | Date utilities |

## Browser Support

### Desktop
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile
- Mobile Safari (iOS 14+)
- Mobile Chrome (Android 10+)

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| API Response (p95) | <100ms | Varies by query |
| Polling Interval | 2s | 2s (exact) |
| Database Query (indexed) | <50ms | Varies by complexity |
| Page Load (FCP) | <2s | Not measured |
| Time to Interactive | <3s | Not measured |
| Workflow Timeout | 120min | 120min (max) |

## Dependency Management

### Update Strategy
- Minor/patch updates: Monthly review
- Major updates: Quarterly with testing
- Security patches: Immediate
- Lock files committed to repository

### Vulnerability Scanning
- Automated: Dependabot (GitHub)
- Manual: `npm audit` before releases
- Policy: Zero high/critical vulnerabilities in production
