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

### Next.js 16
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
  - Accessibility-focused text colors (`text-white` for optimal contrast on dark backgrounds)

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

### Recharts
- **Version**: 2.x
- **Purpose**: React charting library for analytics dashboard
- **Features Used**:
  - Area charts (cost over time)
  - Bar charts (horizontal and vertical)
  - Donut/Pie charts (workflow distribution, cache efficiency)
  - Responsive container
  - Custom tooltips
  - Dark mode theming via CSS variables
- **Integration**: Wraps D3.js with declarative React API
- **Customization**:
  - Colors use `hsl(var(--chart-N))` CSS variables for theme consistency
  - Chart titles styled with `text-white` Tailwind class for optimal contrast
  - Overview card titles styled with `text-white` for accessibility compliance

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
- **Purpose**: Markdown rendering in comments, ticket descriptions, and docs
- **Features Used**:
  - HTML escaping (XSS protection)
  - Custom components (mentions)
  - Link support with `target="_blank"` and `rel="noopener noreferrer"`
  - Code blocks (inline and block)
  - Bold, italic, headings
  - Lists (ordered and unordered)
  - Blockquotes
  - Prose styling for dark theme via Tailwind Typography

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

### Vitest
- **Version**: Latest stable
- **Purpose**: Unit, component, and integration testing
- **Commands**:
  - `bun run test:unit` - Unit and component tests
  - `bun run test:integration` - Integration tests (API, database)
- **Features Used**:
  - Fast test execution (~5ms unit, ~20ms component, ~50ms integration)
  - TypeScript support
  - Worker isolation (forks pool with 6 workers)
  - Mocking utilities (vi.mock for hooks and functions)
  - Coverage reporting
  - Environment switching (happy-dom for unit/component, node for integration)
- **Configuration**: `vitest.config.mts`

### React Testing Library (RTL)
- **Packages**:
  - `@testing-library/react` ^16.3.0
  - `@testing-library/dom` ^10.4.1
  - `@testing-library/react-hooks` ^8.0.1
- **Purpose**: Component testing with user-centric queries
- **Environment**: happy-dom (lightweight browser simulation)
- **Features Used**:
  - Semantic queries (getByRole, getByLabelText, getByPlaceholderText)
  - User event simulation (fireEvent, userEvent)
  - Async utilities (waitFor, findBy*)
  - Accessibility-focused testing
  - Provider wrapping (QueryClientProvider)
- **Integration**: Works seamlessly with Vitest and TanStack Query
- **Philosophy**: Test behavior, not implementation details

### Playwright
- **Version**: Latest stable
- **Purpose**: E2E testing (browser-required scenarios only)
- **Command**: `bun run test:e2e`
- **Features Used**:
  - Cross-browser testing (Chromium, Firefox, WebKit)
  - Real browser automation
  - Global setup/teardown
  - Worker isolation
  - Screenshots on failure
- **Use Cases**: OAuth flows, drag-and-drop, keyboard navigation, viewport testing
- **Configuration**: `playwright.config.ts`

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
  - Speed Insights (performance monitoring)
- **Limitations**: No long-lived connections (no WebSockets)

### Vercel Speed Insights
- **Package**: `@vercel/speed-insights` ^1.2.0
- **Purpose**: Real user monitoring (RUM) for web performance metrics
- **Integration**: `<SpeedInsights />` component in root layout
- **Metrics Tracked**:
  - First Contentful Paint (FCP)
  - Largest Contentful Paint (LCP)
  - First Input Delay (FID)
  - Cumulative Layout Shift (CLS)
  - Time to First Byte (TTFB)
- **Data Collection**: Automatic, no configuration required
- **Privacy**: GDPR-compliant, no personal data collected
- **Dashboard**: Available in Vercel project analytics

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
  - `test`: Run all tests (unit + integration + E2E)
  - `test:unit`: Run unit tests (Vitest)
  - `test:integration`: Run integration tests (Vitest)
  - `test:e2e`: Run E2E tests (Playwright)

## Version Matrix

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 16 | Framework |
| React | 18 | UI library |
| TypeScript | 5.6 | Type safety |
| Node.js | 22.20.0 LTS | Runtime |
| PostgreSQL | 14+ | Database |
| Prisma | 6.x | ORM |
| TanStack Query | 5.90.5 | State management |
| TailwindCSS | 3.4 | Styling |
| Recharts | 2.x | Chart library |
| Zod | 4.x | Validation |
| Playwright | Latest | E2E testing |
| Vitest | Latest | Unit/component/integration testing |
| @testing-library/react | ^16.3.0 | Component testing |
| @octokit/rest | ^22.0.0 | GitHub API |
| react-markdown | ^9.0.1 | Markdown rendering |
| date-fns | Latest | Date utilities |
| @vercel/speed-insights | ^1.2.0 | Performance monitoring |

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
