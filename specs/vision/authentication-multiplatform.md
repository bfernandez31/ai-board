# Authentication Multi-Provider & Multi-Platform Git Support

**Vision document pour l'authentification utilisateur et le support multi-plateformes Git**

Dernière mise à jour: 2025-10-12

## 📋 Table des Matières

1. [Vue d'Ensemble](#-vue-densemble)
2. [Authentification Multi-Provider](#-authentification-multi-provider)
3. [Support Multi-Plateformes Git](#-support-multi-plateformes-git)
4. [Modèle de Données](#-modèle-de-données)
5. [Sécurité & Isolation](#-sécurité--isolation)
6. [Plan d'Implémentation](#-plan-dimplémentation)
7. [Configuration & Déploiement](#-configuration--déploiement)
8. [Impact sur Architecture](#-impact-sur-architecture)

## 🎯 Vue d'Ensemble

### Objectifs

**Objectif Principal**: Ajouter l'authentification utilisateur avec support multi-provider et préparer l'architecture pour supporter plusieurs plateformes Git (GitHub, GitLab, Bitbucket).

**Pourquoi maintenant ?**
- Isolation multi-utilisateurs nécessaire pour production
- Architecture extensible dès le départ évite refactoring coûteux
- Support multi-plateformes = avantage concurrentiel

**MVP Scope**:
- ✅ Authentification GitHub OAuth uniquement
- ✅ Projets GitHub uniquement
- ✅ Modèle de données extensible (prêt pour autres providers)
- ⏳ UI basique connexion/déconnexion
- ⏳ Protection routes et API

**Future Extensions**:
- Phase 2: Google OAuth (connexion alternative)
- Phase 3: GitLab projects + CI
- Phase 4: Bitbucket projects + Pipelines

### Architecture High-Level

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ SignIn UI  │  │  User Menu   │  │ Provider Select  │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Middleware (Auth Protection)               │
│  Check session → Verify userId → Inject user context        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              NextAuth (Auth.js v5) + Prisma Adapter          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  GitHub  │  │  Google  │  │  GitLab  │  │Bitbucket │   │
│  │  OAuth   │  │  OAuth   │  │  OAuth   │  │  OAuth   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  User   │←─│ Account  │  │ Session  │  │ Project  │    │
│  │         │  │(GitHub)  │  │          │  │(GitHub)  │    │
│  │         │←─│(Google)  │  │          │  │(GitLab)  │    │
│  │         │←─│(GitLab)  │  │          │  │(Bitbucket)│   │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            Git Client Abstraction (Unified API)              │
│  getGitClient(project) → Octokit | Gitlab | Bitbucket       │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Authentification Multi-Provider

### NextAuth (Auth.js v5) Architecture

**Pourquoi NextAuth ?**
- ✅ **80+ providers** out-of-the-box (GitHub, Google, GitLab, Bitbucket, etc.)
- ✅ **Vercel optimized**: Edge runtime, zero-config deployment
- ✅ **Prisma adapter**: Integration native avec notre DB
- ✅ **NextJS 15 compatible**: App Router support
- ✅ **Security best practices**: PKCE, CSRF protection, encrypted sessions
- ✅ **Token management**: Automatic refresh, secure storage

### Configuration NextAuth

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import GitLab from "next-auth/providers/gitlab"
import Bitbucket from "next-auth/providers/bitbucket"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // Phase 1 (MVP)
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // Request repo access for GitHub API
      authorization: {
        params: {
          scope: "read:user user:email repo"
        }
      }
    }),

    // Phase 2 (Google login alternative)
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),

    // Phase 3 (GitLab projects support)
    GitLab({
      clientId: process.env.GITLAB_ID!,
      clientSecret: process.env.GITLAB_SECRET!,
      authorization: {
        params: {
          scope: "read_user read_api read_repository write_repository"
        }
      }
    }),

    // Phase 4 (Bitbucket projects support)
    Bitbucket({
      clientId: process.env.BITBUCKET_ID!,
      clientSecret: process.env.BITBUCKET_SECRET!,
    }),
  ],

  callbacks: {
    // Inject userId into session for easy access
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },

    // Store access token for Git API calls
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.provider = account.provider
      }
      return token
    }
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: "database", // Secure server-side sessions
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
})

export { handlers as GET, handlers as POST }
```

### Middleware Protection

```typescript
// middleware.ts
import { auth } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isPublicApi = req.nextUrl.pathname === '/api/health'

  // Allow public routes
  if (isAuthPage || isPublicApi) {
    return NextResponse.next()
  }

  // Redirect to signin if not authenticated
  if (!isAuthenticated) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Protect all routes except public ones
    '/((?!api/health|_next/static|_next/image|favicon.ico).*)',
  ]
}
```

### UI Components

#### Sign In Page

```tsx
// app/auth/signin/page.tsx
import { signIn } from "@/app/api/auth/[...nextauth]/route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Welcome to AI Board</CardTitle>
          <CardDescription>
            Sign in with your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phase 1: GitHub only */}
          <form action={async () => {
            "use server"
            await signIn("github", {
              redirectTo: searchParams.callbackUrl || "/projects"
            })
          }}>
            <Button type="submit" className="w-full" variant="default">
              <GitHubIcon className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
          </form>

          {/* Phase 2: Add Google */}
          <form action={async () => {
            "use server"
            await signIn("google", {
              redirectTo: searchParams.callbackUrl || "/projects"
            })
          }}>
            <Button type="submit" className="w-full" variant="outline">
              <GoogleIcon className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>
          </form>

          {/* Phase 3+: GitLab, Bitbucket */}
        </CardContent>
      </Card>
    </div>
  )
}
```

#### User Menu Component

```tsx
// components/auth/user-menu.tsx
"use client"

import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, Settings, User } from "lucide-react"

export function UserMenu() {
  const { data: session } = useSession()

  if (!session?.user) return null

  const initials = session.user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarImage src={session.user.image || undefined} alt={session.user.name || ''} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-red-600"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## 🌐 Support Multi-Plateformes Git

### Architecture Extensible

**Principe**: Abstraction du client Git pour supporter GitHub, GitLab, Bitbucket de manière unifiée.

```typescript
// lib/git/types.ts
export enum GitProvider {
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  BITBUCKET = 'BITBUCKET',
}

export interface GitClient {
  // Repository operations
  getRepository(owner: string, repo: string): Promise<Repository>
  createBranch(owner: string, repo: string, branch: string, from: string): Promise<Branch>

  // File operations
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<FileContent>
  createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch: string): Promise<Commit>

  // Workflow/CI operations
  dispatchWorkflow(owner: string, repo: string, workflow: string, inputs: Record<string, string>): Promise<void>
  getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun>

  // Pull Request operations
  createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<PullRequest>
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest>
}
```

### Client Factory Pattern

```typescript
// lib/git/client-factory.ts
import { Octokit } from '@octokit/rest'
import { Gitlab } from '@gitbeaker/rest'
import { Bitbucket } from 'bitbucket'
import { GitHubClient } from './clients/github'
import { GitLabClient } from './clients/gitlab'
import { BitbucketClient } from './clients/bitbucket'

export async function getGitClient(
  provider: GitProvider,
  accessToken: string
): Promise<GitClient> {
  switch (provider) {
    case GitProvider.GITHUB:
      const octokit = new Octokit({ auth: accessToken })
      return new GitHubClient(octokit)

    case GitProvider.GITLAB:
      const gitlab = new Gitlab({ token: accessToken })
      return new GitLabClient(gitlab)

    case GitProvider.BITBUCKET:
      const bitbucket = new Bitbucket({ auth: { token: accessToken } })
      return new BitbucketClient(bitbucket)

    default:
      throw new Error(`Unsupported git provider: ${provider}`)
  }
}
```

### GitHub Client Implementation

```typescript
// lib/git/clients/github.ts
import { Octokit } from '@octokit/rest'
import { GitClient } from '../types'

export class GitHubClient implements GitClient {
  constructor(private octokit: Octokit) {}

  async getRepository(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({ owner, repo })
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      defaultBranch: data.default_branch,
    }
  }

  async createBranch(owner: string, repo: string, branch: string, from: string) {
    // Get the SHA of the source branch
    const { data: ref } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${from}`,
    })

    // Create new branch
    const { data } = await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: ref.object.sha,
    })

    return {
      name: branch,
      sha: data.object.sha,
    }
  }

  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflow: string,
    inputs: Record<string, string>
  ) {
    await this.octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflow,
      ref: 'main',
      inputs,
    })
  }

  // ... other methods
}
```

### GitLab Client Implementation

```typescript
// lib/git/clients/gitlab.ts
import { Gitlab } from '@gitbeaker/rest'
import { GitClient } from '../types'

export class GitLabClient implements GitClient {
  constructor(private gitlab: Gitlab) {}

  async getRepository(owner: string, repo: string) {
    const projectPath = `${owner}/${repo}`
    const project = await this.gitlab.Projects.show(projectPath)
    return {
      id: project.id,
      name: project.name,
      fullName: project.path_with_namespace,
      url: project.web_url,
      defaultBranch: project.default_branch,
    }
  }

  async createBranch(owner: string, repo: string, branch: string, from: string) {
    const projectPath = `${owner}/${repo}`
    const newBranch = await this.gitlab.Branches.create(
      projectPath,
      branch,
      from
    )
    return {
      name: newBranch.name,
      sha: newBranch.commit.id,
    }
  }

  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflow: string,
    inputs: Record<string, string>
  ) {
    // GitLab uses pipeline triggers
    const projectPath = `${owner}/${repo}`
    await this.gitlab.PipelineTriggerTokens.trigger(
      projectPath,
      process.env.GITLAB_TRIGGER_TOKEN!,
      'main',
      inputs
    )
  }

  // ... other methods
}
```

### Workflow Abstraction

**Problem**: GitHub Actions, GitLab CI, Bitbucket Pipelines have different syntaxes.

**Solution**: Template-based workflow generation per platform.

```typescript
// lib/workflows/generator.ts
export function generateWorkflowConfig(
  provider: GitProvider,
  command: string
): string {
  switch (provider) {
    case GitProvider.GITHUB:
      return generateGitHubActionsYAML(command)

    case GitProvider.GITLAB:
      return generateGitLabCIYAML(command)

    case GitProvider.BITBUCKET:
      return generateBitbucketPipelinesYAML(command)
  }
}

function generateGitHubActionsYAML(command: string): string {
  return `
name: AI Board - ${command}
on:
  workflow_dispatch:
    inputs:
      ticket_id:
        required: true
      branch:
        required: false
jobs:
  execute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Execute command
        run: |
          claude-code /${command}
`
}

function generateGitLabCIYAML(command: string): string {
  return `
${command}:
  stage: build
  script:
    - claude-code /${command}
  only:
    - triggers
  variables:
    TICKET_ID: "$TICKET_ID"
    BRANCH: "$BRANCH"
`
}
```

## 💾 Modèle de Données

### Schema Prisma Complet

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// Authentication Models (NextAuth)
// ============================================

enum AuthProvider {
  GITHUB
  GOOGLE
  GITLAB
  BITBUCKET
}

model User {
  id            Int       @id @default(autoincrement())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?   // Avatar URL

  // Relations
  accounts      Account[]
  sessions      Session[]
  projects      Project[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
}

model Account {
  id                String       @id @default(cuid())
  userId            Int
  type              String       // "oauth"
  provider          AuthProvider
  providerAccountId String       // GitHub ID, GitLab ID, etc.

  // OAuth tokens
  refresh_token     String?      @db.Text
  access_token      String?      @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?      @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       Int
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// Application Models
// ============================================

enum GitProvider {
  GITHUB
  GITLAB
  BITBUCKET
}

enum Stage {
  INBOX
  SPECIFY
  PLAN
  BUILD
  VERIFY
  SHIP
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

model Project {
  id          Int         @id @default(autoincrement())
  name        String      @db.VarChar(100)
  description String      @db.VarChar(1000)

  // Git configuration (multi-platform)
  gitProvider GitProvider @default(GITHUB)
  gitOwner    String      @db.VarChar(100)
  gitRepo     String      @db.VarChar(100)

  // User ownership
  userId      Int
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Relations
  tickets     Ticket[]

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  // Unique constraint per platform
  @@unique([gitProvider, gitOwner, gitRepo])
  @@index([userId])
  @@index([gitProvider, gitOwner, gitRepo])
}

model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  stage       Stage    @default(INBOX)
  version     Int      @default(1)
  branch      String?  @db.VarChar(200)
  autoMode    Boolean  @default(false)

  // Project relation
  projectId   Int
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Relations
  jobs        Job[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([stage])
  @@index([updatedAt])
  @@index([projectId])
}

model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  branch      String?   @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?   @db.Text
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([ticketId])
  @@index([status])
  @@index([startedAt])
}
```

### Migration Strategy

#### Step 1: Create Auth Tables

```sql
-- Migration: 001_add_authentication.sql

-- Create User table
CREATE TABLE "User" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "emailVerified" TIMESTAMP,
  "image" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL
);

-- Create Account table (OAuth)
CREATE TYPE "AuthProvider" AS ENUM ('GITHUB', 'GOOGLE', 'GITLAB', 'BITBUCKET');

CREATE TABLE "Account" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" VARCHAR(50),
  "scope" VARCHAR(500),
  "id_token" TEXT,
  "session_state" VARCHAR(255),
  UNIQUE("provider", "providerAccountId")
);

CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- Create Session table
CREATE TABLE "Session" (
  "id" VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" VARCHAR(500) UNIQUE NOT NULL,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires" TIMESTAMP NOT NULL
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- Create VerificationToken table
CREATE TABLE "VerificationToken" (
  "identifier" VARCHAR(255) NOT NULL,
  "token" VARCHAR(500) UNIQUE NOT NULL,
  "expires" TIMESTAMP NOT NULL,
  UNIQUE("identifier", "token")
);
```

#### Step 2: Add userId to Project

```sql
-- Migration: 002_add_project_user.sql

-- Add userId column (nullable for existing data)
ALTER TABLE "Project" ADD COLUMN "userId" INTEGER;

-- Create default user for existing projects
INSERT INTO "User" ("email", "name", "createdAt", "updatedAt")
VALUES ('admin@aiboard.local', 'Default Admin', NOW(), NOW())
ON CONFLICT ("email") DO NOTHING;

-- Assign existing projects to default user
UPDATE "Project"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'admin@aiboard.local')
WHERE "userId" IS NULL;

-- Make userId required
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;

-- Add foreign key
ALTER TABLE "Project"
ADD CONSTRAINT "Project_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add index
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
```

#### Step 3: Add GitProvider to Project

```sql
-- Migration: 003_add_git_provider.sql

-- Create GitProvider enum
CREATE TYPE "GitProvider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET');

-- Add gitProvider column (default GITHUB)
ALTER TABLE "Project" ADD COLUMN "gitProvider" "GitProvider" DEFAULT 'GITHUB' NOT NULL;

-- Rename columns for clarity
ALTER TABLE "Project" RENAME COLUMN "githubOwner" TO "gitOwner";
ALTER TABLE "Project" RENAME COLUMN "githubRepo" TO "gitRepo";

-- Update unique constraint to include provider
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_githubOwner_githubRepo_key";
ALTER TABLE "Project" ADD CONSTRAINT "Project_gitProvider_gitOwner_gitRepo_key"
UNIQUE ("gitProvider", "gitOwner", "gitRepo");

-- Add composite index
CREATE INDEX "Project_gitProvider_gitOwner_gitRepo_idx"
ON "Project"("gitProvider", "gitOwner", "gitRepo");
```

### Data Access Layer with Isolation

```typescript
// lib/db/projects.ts
import { auth } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

/**
 * Get all projects for the current user
 * Automatically filters by userId from session
 */
export async function getUserProjects() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  return prisma.project.findMany({
    where: {
      userId: session.user.id
    },
    include: {
      tickets: {
        orderBy: { updatedAt: 'desc' },
        take: 5 // Recent tickets preview
      }
    },
    orderBy: { updatedAt: 'desc' }
  })
}

/**
 * Get a project by ID
 * Verifies ownership before returning
 */
export async function getProject(projectId: number) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      tickets: {
        orderBy: { updatedAt: 'desc' }
      }
    }
  })

  // Verify ownership
  if (!project || project.userId !== session.user.id) {
    throw new Error('Project not found or unauthorized')
  }

  return project
}

/**
 * Create a project for the current user
 */
export async function createProject(data: {
  name: string
  description: string
  gitProvider: GitProvider
  gitOwner: string
  gitRepo: string
}) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  return prisma.project.create({
    data: {
      ...data,
      userId: session.user.id
    }
  })
}
```

## 🔒 Sécurité & Isolation

### 1. Authentication Security

**Token Storage**:
- ✅ `access_token` stored encrypted in database (Prisma adapter)
- ✅ Session tokens use `httpOnly` cookies (CSRF protection)
- ✅ No tokens in localStorage or client-side storage

**Session Management**:
- ✅ Database sessions (not JWT) for instant revocation
- ✅ 30-day expiration with automatic refresh
- ✅ Session invalidation on password change

**OAuth Security**:
- ✅ PKCE (Proof Key for Code Exchange) enabled
- ✅ State parameter for CSRF protection
- ✅ Redirect URI validation
- ✅ Scope minimal principle (only required permissions)

### 2. Authorization & Isolation

**Multi-Tenant Isolation**:
```typescript
// Every DB query MUST include userId filter
const projects = await prisma.project.findMany({
  where: {
    userId: session.user.id // ← MANDATORY
  }
})

// API middleware automatically injects userId
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  // session.user.id guaranteed to be set
  const projects = await getUserProjects(session.user.id)
  return Response.json(projects)
}
```

**Row-Level Security (RLS) Pattern**:
```typescript
// lib/auth/rls.ts

/**
 * Verify user owns the resource or throw 404
 * Always use 404 (not 403) to prevent resource enumeration
 */
export async function verifyProjectOwnership(projectId: number, userId: number) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: userId
    }
  })

  if (!project) {
    throw new Error('Project not found') // Returns 404
  }

  return project
}

// Usage in API route
const project = await verifyProjectOwnership(
  params.projectId,
  session.user.id
)
```

### 3. API Security

**Rate Limiting** (Vercel Edge Middleware):
```typescript
// middleware.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10s
})

export async function middleware(request: Request) {
  // Rate limit by user IP
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  return NextResponse.next()
}
```

**Input Validation** (Zod):
```typescript
// app/api/projects/route.ts
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  gitProvider: z.enum(['GITHUB', 'GITLAB', 'BITBUCKET']),
  gitOwner: z.string().min(1).max(100),
  gitRepo: z.string().min(1).max(100),
})

export async function POST(request: Request) {
  const json = await request.json()

  // Validate input
  const result = createProjectSchema.safeParse(json)
  if (!result.success) {
    return Response.json(
      { error: 'Invalid input', details: result.error },
      { status: 400 }
    )
  }

  // Create project (userId automatically injected)
  const project = await createProject(result.data)
  return Response.json(project, { status: 201 })
}
```

### 4. Future: Role-Based Access Control (RBAC)

**Multi-User Projects** (Phase 5+):

```prisma
enum ProjectRole {
  OWNER       // Full control
  ADMIN       // Manage settings, invite users
  EDITOR      // Create/edit tickets
  VIEWER      // Read-only access
}

model ProjectMember {
  id        Int         @id @default(autoincrement())
  projectId Int
  userId    Int
  role      ProjectRole @default(VIEWER)

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([userId])
}

// Project.members      ProjectMember[]
// User.projectMembers  ProjectMember[]
```

## 🚀 Plan d'Implémentation

### Phase 1: MVP - GitHub Auth Only (Week 1-2)

**Temps estimé**: 16-24h

**Objectifs**:
- ✅ Authentification GitHub OAuth fonctionnelle
- ✅ Isolation multi-utilisateurs
- ✅ Protection routes et API
- ✅ UI basique connexion/déconnexion

**Tasks**:

1. **Setup NextAuth** (4h)
   - [ ] Install dependencies: `next-auth`, `@auth/prisma-adapter`
   - [ ] Configure GitHub OAuth App
   - [ ] Create `app/api/auth/[...nextauth]/route.ts`
   - [ ] Add environment variables

2. **Database Migration** (3h)
   - [ ] Create Prisma schema for User, Account, Session
   - [ ] Generate migration SQL
   - [ ] Create default admin user
   - [ ] Add userId to Project model
   - [ ] Migrate existing projects

3. **Middleware Protection** (2h)
   - [ ] Create `middleware.ts` for auth check
   - [ ] Configure route protection
   - [ ] Add redirect logic

4. **UI Components** (4h)
   - [ ] Create sign-in page (`/auth/signin`)
   - [ ] Create user menu component
   - [ ] Update header with user menu
   - [ ] Add sign-out functionality

5. **API Updates** (5h)
   - [ ] Update all API routes to check auth
   - [ ] Add userId filtering to DB queries
   - [ ] Create data access layer (`lib/db/projects.ts`)
   - [ ] Add ownership verification helpers

6. **Testing** (3h)
   - [ ] E2E tests with mocked auth
   - [ ] Test isolation between users
   - [ ] Test API protection
   - [ ] Test redirect flows

7. **Documentation** (2h)
   - [ ] Update README with auth setup
   - [ ] Document environment variables
   - [ ] Create deployment guide

### Phase 2: Google Auth Alternative (Week 3)

**Temps estimé**: 4-6h

**Objectifs**:
- ✅ Support Google OAuth
- ✅ Allow users to link multiple accounts
- ✅ UI improvements

**Tasks**:

1. **Google OAuth Setup** (2h)
   - [ ] Create Google Cloud OAuth credentials
   - [ ] Add Google provider to NextAuth config
   - [ ] Update environment variables
   - [ ] Test Google sign-in flow

2. **UI Updates** (2h)
   - [ ] Add Google button to sign-in page
   - [ ] Update user menu for multiple accounts
   - [ ] Create account management page

3. **Testing** (2h)
   - [ ] Test Google OAuth flow
   - [ ] Test account linking
   - [ ] Test switching between accounts

### Phase 3: GitLab Projects Support (Week 4-5)

**Temps estimé**: 20-30h

**Objectifs**:
- ✅ Support GitLab projects
- ✅ GitLab CI pipeline generation
- ✅ Git client abstraction

**Tasks**:

1. **Database Updates** (3h)
   - [ ] Add GitProvider enum to schema
   - [ ] Migrate Project model
   - [ ] Update unique constraints
   - [ ] Add indexes

2. **Git Client Abstraction** (8h)
   - [ ] Create `GitClient` interface
   - [ ] Implement `GitHubClient`
   - [ ] Implement `GitLabClient`
   - [ ] Create client factory
   - [ ] Update workflow dispatcher

3. **GitLab OAuth** (3h)
   - [ ] Add GitLab provider to NextAuth
   - [ ] Configure scopes
   - [ ] Test authentication

4. **Workflow Generation** (6h)
   - [ ] Create GitLab CI template
   - [ ] Implement workflow generator
   - [ ] Test pipeline dispatch
   - [ ] Update job status webhooks

5. **UI Updates** (4h)
   - [ ] Add GitLab option to sign-in
   - [ ] Add provider selector on project creation
   - [ ] Update project list with provider badges
   - [ ] Add GitLab icon/logo

6. **Testing** (6h)
   - [ ] Test GitLab OAuth
   - [ ] Test GitLab project creation
   - [ ] Test GitLab CI dispatch
   - [ ] E2E tests

### Phase 4: Bitbucket Support (Week 6-7)

**Temps estimé**: 15-20h

**Objectifs**:
- ✅ Support Bitbucket projects
- ✅ Bitbucket Pipelines integration
- ✅ Complete multi-platform support

**Tasks**:

1. **Bitbucket OAuth** (3h)
   - [ ] Add Bitbucket provider to NextAuth
   - [ ] Configure OAuth app
   - [ ] Test authentication

2. **Bitbucket Client** (6h)
   - [ ] Implement `BitbucketClient`
   - [ ] Test repository operations
   - [ ] Test pipeline dispatch

3. **Bitbucket Pipelines** (4h)
   - [ ] Create Bitbucket Pipelines template
   - [ ] Update workflow generator
   - [ ] Test pipeline execution

4. **UI Updates** (2h)
   - [ ] Add Bitbucket to sign-in
   - [ ] Add Bitbucket to provider selector
   - [ ] Add Bitbucket branding

5. **Testing & Documentation** (5h)
   - [ ] Comprehensive testing
   - [ ] Update documentation
   - [ ] Create migration guide

## ⚙️ Configuration & Déploiement

### Environment Variables

```bash
# .env.local (Development)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aiboard"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# GitHub OAuth (Phase 1)
GITHUB_ID="your_github_oauth_app_client_id"
GITHUB_SECRET="your_github_oauth_app_client_secret"

# Google OAuth (Phase 2)
GOOGLE_ID="your_google_oauth_client_id"
GOOGLE_SECRET="your_google_oauth_client_secret"

# GitLab OAuth (Phase 3)
GITLAB_ID="your_gitlab_oauth_app_id"
GITLAB_SECRET="your_gitlab_oauth_secret"

# Bitbucket OAuth (Phase 4)
BITBUCKET_ID="your_bitbucket_oauth_key"
BITBUCKET_SECRET="your_bitbucket_oauth_secret"

# Rate Limiting (Optional)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

### OAuth App Setup

#### GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: AI Board (Development)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret
5. For production, create separate app with `https://yourdomain.com` URLs

#### Google OAuth App

1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure consent screen
6. Fill in:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret

#### GitLab OAuth App

1. Go to https://gitlab.com/-/profile/applications
2. Fill in:
   - **Name**: AI Board
   - **Redirect URI**: `http://localhost:3000/api/auth/callback/gitlab`
   - **Scopes**: `read_user`, `read_api`, `read_repository`, `write_repository`
3. Copy Application ID and Secret

#### Bitbucket OAuth App

1. Go to https://bitbucket.org/account/settings/app-passwords/
2. Create app password with:
   - **Repositories**: Read, Write
   - **Pull requests**: Read, Write
3. Or create OAuth consumer:
   - Go to workspace settings → OAuth consumers
   - Add consumer with callback URL
   - Copy Key and Secret

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add GITHUB_ID production
vercel env add GITHUB_SECRET production
# ... add all other variables

# Deploy
vercel --prod
```

**Vercel Environment Variables UI**:
- Go to Project Settings → Environment Variables
- Add all variables from `.env.local`
- Set `NEXTAUTH_URL` to production domain (e.g., `https://aiboard.vercel.app`)

### Database Migration in Production

```bash
# Using Prisma Migrate
npx prisma migrate deploy

# Or using SQL directly
psql $DATABASE_URL -f prisma/migrations/001_add_authentication.sql
psql $DATABASE_URL -f prisma/migrations/002_add_project_user.sql
psql $DATABASE_URL -f prisma/migrations/003_add_git_provider.sql
```

## 📊 Impact sur Architecture

### Breaking Changes

**API Routes**:
- ✅ All API routes now require authentication
- ✅ All routes must filter by `userId`
- ⚠️ Public endpoints need explicit opt-out

**Database Schema**:
- ⚠️ **Breaking**: `Project` model requires `userId`
- ⚠️ Existing projects must be migrated to default user
- ✅ Future-proof: GitProvider extensible

**Frontend**:
- ✅ All pages require authentication (except `/auth/*`)
- ✅ User context available via `useSession()`
- ⚠️ Protected routes need `SessionProvider`

### Backward Compatibility

**Migration Strategy**:
1. Create default admin user
2. Assign all existing projects to admin
3. Gradual rollout to real users
4. Data export/import scripts for safety

**Rollback Plan**:
- Keep migrations reversible
- Backup database before migration
- Feature flag for authentication (optional)

### Performance Impact

**Session Lookup**: +5-10ms per request (database session)
**OAuth Handshake**: One-time cost (1-2s)
**Token Storage**: Minimal (encrypted in DB)

**Optimization**:
- Session caching (Redis)
- JWT strategy for read-only routes
- Edge middleware for auth checks

## 📈 Future Enhancements

### Phase 5: RBAC (Role-Based Access Control)

- Multi-user projects (owner/admin/editor/viewer)
- Team workspaces
- Project invitations
- Audit logs

### Phase 6: Advanced Features

- SSO (SAML, OIDC) for enterprise
- 2FA (Two-Factor Authentication)
- API tokens for CI/CD
- Webhooks for external integrations

### Phase 7: Self-Hosted Git

- Support self-hosted GitLab/GitHub Enterprise
- Custom Git server integration
- VPN/Private network support

## 🎯 Success Metrics

**Phase 1 Success Criteria**:
- ✅ 100% authentication coverage on protected routes
- ✅ 0 cross-user data leaks
- ✅ <50ms auth middleware overhead
- ✅ >95% OAuth success rate

**Phase 3 Success Criteria**:
- ✅ Support 3 Git providers (GitHub, GitLab, Bitbucket)
- ✅ Unified Git client interface
- ✅ <5% workflow dispatch failures

## 📚 References

- [NextAuth.js Documentation](https://next-auth.js.org)
- [Prisma Adapter](https://authjs.dev/reference/adapter/prisma)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitLab OAuth](https://docs.gitlab.com/ee/integration/oauth_provider.html)
- [Bitbucket OAuth](https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Questions? Besoin de clarifications?**

Ce document couvre l'ensemble de l'architecture d'authentification multi-provider et support multi-plateformes Git. N'hésite pas à ouvrir une issue pour discuter de points spécifiques !
