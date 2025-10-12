# Authentication Implementation Checklist

**Checklist détaillée pour implémenter l'authentification GitHub OAuth (Phase 1 MVP)**

Dernière mise à jour: 2025-10-12

## 📋 Overview

Cette checklist couvre **Phase 1** de `authentication-multiplatform.md` : authentification GitHub OAuth uniquement avec isolation multi-utilisateurs.

**Temps estimé** : 16-24h développement + 4h déploiement

**Prérequis** :
- Repository GitHub `ai-board` configuré
- Vercel account créé
- Neon account créé

---

## ✅ Phase 1: Setup & Configuration (4-6h)

### 1.1 Install Dependencies (30 min)

- [ ] Installer NextAuth v5 beta
  ```bash
  npm install next-auth@beta @auth/prisma-adapter
  ```

- [ ] Vérifier dépendances existantes
  ```bash
  # Devrait être déjà installé
  npm list @prisma/client prisma
  ```

- [ ] Commit dependencies
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: add next-auth and prisma adapter"
  ```

**Résultat attendu** : `package.json` contient `next-auth@5.x` et `@auth/prisma-adapter@^2.x`

---

### 1.2 Create GitHub OAuth Apps (1h)

#### Development OAuth App

- [ ] Aller sur https://github.com/settings/developers
- [ ] Cliquer "New OAuth App"
- [ ] Remplir formulaire :
  - Application name: `AI Board (Development)`
  - Homepage URL: `http://localhost:3000`
  - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- [ ] Copier **Client ID** (format: `Ov23liABC...`)
- [ ] Générer **Client Secret** (⚠️ copier immédiatement, ne s'affiche qu'une fois)
- [ ] Sauvegarder dans `.env.local` :
  ```bash
  GITHUB_ID="Ov23liABC..."
  GITHUB_SECRET="abc123..."
  ```

#### Production OAuth App (pour plus tard)

- [ ] Répéter les étapes ci-dessus avec :
  - Application name: `AI Board (Production)`
  - Homepage URL: `https://your-app.vercel.app` (⚠️ URL exacte après déploiement)
  - Callback URL: `https://your-app.vercel.app/api/auth/callback/github`
- [ ] Sauvegarder credentials séparément (pour Vercel env vars)

**Résultat attendu** : 2 OAuth Apps créées, credentials sauvegardés

---

### 1.3 Generate Secrets (15 min)

- [ ] Générer `NEXTAUTH_SECRET`
  ```bash
  openssl rand -base64 32
  ```

- [ ] Copier output dans `.env.local`
  ```bash
  NEXTAUTH_SECRET="YourRandomSecretHere=="
  ```

- [ ] Générer un deuxième secret pour production (sauvegarder séparément)

**Résultat attendu** : 2 secrets générés (dev + prod)

---

### 1.4 Configure Environment Variables (30 min)

- [ ] Créer/modifier `.env.local` avec toutes les variables :
  ```bash
  # Database
  DATABASE_URL="postgresql://user:password@localhost:5432/ai-board"

  # NextAuth
  NEXTAUTH_URL="http://localhost:3000"
  NEXTAUTH_SECRET="YourRandomSecretHere=="

  # GitHub OAuth (Development)
  GITHUB_ID="Ov23liABC..."
  GITHUB_SECRET="dev_secret..."

  # GitHub Integration (existing)
  GITHUB_TOKEN="ghp_..."
  GITHUB_OWNER="your-username"
  GITHUB_REPO="ai-board"

  # Anthropic API (existing)
  ANTHROPIC_API_KEY="sk-ant-..."

  # Optional
  NODE_ENV="development"
  ```

- [ ] Vérifier `.env.example` est à jour (pour documentation)
- [ ] Vérifier `.gitignore` contient `.env.local`

**Résultat attendu** : Toutes variables d'environnement configurées localement

---

## ✅ Phase 2: Database Migration (3-4h)

### 2.1 Update Prisma Schema (1h)

- [ ] Ouvrir `prisma/schema.prisma`

- [ ] Ajouter enum AuthProvider :
  ```prisma
  enum AuthProvider {
    GITHUB
    GOOGLE
    GITLAB
    BITBUCKET
  }
  ```

- [ ] Ajouter modèle User :
  ```prisma
  model User {
    id            Int       @id @default(autoincrement())
    name          String?
    email         String    @unique
    emailVerified DateTime?
    image         String?

    accounts      Account[]
    sessions      Session[]
    projects      Project[]

    createdAt     DateTime  @default(now())
    updatedAt     DateTime  @updatedAt

    @@index([email])
  }
  ```

- [ ] Ajouter modèles Account, Session, VerificationToken (voir `authentication-multiplatform.md` lignes 595-674)

- [ ] Modifier modèle Project :
  ```prisma
  model Project {
    // ... existing fields ...

    userId      Int
    user        User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId])
  }
  ```

- [ ] Vérifier schema complet avec `npx prisma format`

**Résultat attendu** : Schema Prisma contient auth tables + userId sur Project

---

### 2.2 Generate Migration (30 min)

- [ ] Générer migration :
  ```bash
  npx prisma migrate dev --name add_authentication
  ```

- [ ] Vérifier fichier de migration créé : `prisma/migrations/XXX_add_authentication/migration.sql`

- [ ] Vérifier migration inclut :
  - Table `User`
  - Table `Account`
  - Table `Session`
  - Table `VerificationToken`
  - Colonne `userId` sur `Project` (nullable)
  - Index sur `User.email`, `Account.userId`, `Session.userId`, `Project.userId`

- [ ] Regénérer Prisma Client :
  ```bash
  npx prisma generate
  ```

**Résultat attendu** : Migration créée, Prisma Client mis à jour

---

### 2.3 Seed Default Admin User (1h)

- [ ] Créer `prisma/seed-auth.ts` :
  ```typescript
  import { PrismaClient } from '@prisma/client'

  const prisma = new PrismaClient()

  async function main() {
    // Create default admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@ai-board.local' },
      update: {},
      create: {
        email: 'admin@ai-board.local',
        name: 'Admin User',
        emailVerified: new Date(),
      },
    })

    console.log('✅ Default admin user created:', admin.email)

    // Assign existing projects to admin
    const result = await prisma.project.updateMany({
      where: { userId: null },
      data: { userId: admin.id },
    })

    console.log(`✅ Assigned ${result.count} projects to admin user`)
  }

  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
  ```

- [ ] Exécuter seed :
  ```bash
  npx tsx prisma/seed-auth.ts
  ```

- [ ] Vérifier user créé dans database :
  ```bash
  psql $DATABASE_URL -c "SELECT * FROM \"User\";"
  ```

**Résultat attendu** : User admin créé, projets existants assignés

---

### 2.4 Make userId Required (30 min)

- [ ] Créer migration pour rendre `userId` NOT NULL :
  ```bash
  npx prisma migrate dev --name make_userid_required
  ```

- [ ] Migration devrait contenir :
  ```sql
  ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;
  ```

- [ ] Vérifier contrainte appliquée :
  ```bash
  psql $DATABASE_URL -c "\d \"Project\";"
  # userId | integer | not null
  ```

**Résultat attendu** : `userId` est NOT NULL sur Project

---

## ✅ Phase 3: NextAuth Implementation (5-6h)

### 3.1 Create Auth API Route (1.5h)

- [ ] Créer dossier : `app/api/auth/[...nextauth]/`

- [ ] Créer `route.ts` :
  ```typescript
  import NextAuth from "next-auth"
  import { PrismaAdapter } from "@auth/prisma-adapter"
  import GitHub from "next-auth/providers/github"
  import { prisma } from "@/lib/db/client"

  export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),

    providers: [
      GitHub({
        clientId: process.env.GITHUB_ID!,
        clientSecret: process.env.GITHUB_SECRET!,
        authorization: {
          params: {
            scope: "read:user user:email"
          }
        }
      }),
    ],

    callbacks: {
      async session({ session, user }) {
        session.user.id = user.id
        return session
      },
    },

    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    },

    session: {
      strategy: "database",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
  })

  export { handlers as GET, handlers as POST }
  ```

- [ ] Exporter `auth` helper depuis `route.ts`

- [ ] Vérifier types TypeScript :
  ```bash
  npx tsc --noEmit
  ```

**Résultat attendu** : API route créée, pas d'erreurs TypeScript

---

### 3.2 Create Middleware Protection (1h)

- [ ] Créer `middleware.ts` à la racine :
  ```typescript
  import { auth } from "@/app/api/auth/[...nextauth]/route"
  import { NextResponse } from "next/server"

  export default auth((req) => {
    const isAuthenticated = !!req.auth
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
    const isPublicApi = req.nextUrl.pathname === '/api/health'

    if (isAuthPage || isPublicApi) {
      return NextResponse.next()
    }

    if (!isAuthenticated) {
      const signInUrl = new URL('/auth/signin', req.url)
      signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
      return NextResponse.redirect(signInUrl)
    }

    return NextResponse.next()
  })

  export const config = {
    matcher: [
      '/((?!api/health|_next/static|_next/image|favicon.ico).*)',
    ]
  }
  ```

- [ ] Tester protection :
  ```bash
  npm run dev
  # Naviguer vers http://localhost:3000
  # Devrait rediriger vers /auth/signin
  ```

**Résultat attendu** : Routes protégées, redirection vers sign-in fonctionne

---

### 3.3 Create Sign-In Page (1.5h)

- [ ] Créer dossier : `app/auth/signin/`

- [ ] Créer `page.tsx` :
  ```typescript
  import { signIn } from "@/app/api/auth/[...nextauth]/route"
  import { Button } from "@/components/ui/button"
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
  import { Github } from "lucide-react"

  export default function SignInPage({
    searchParams,
  }: {
    searchParams: { callbackUrl?: string }
  }) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to AI Board</CardTitle>
            <CardDescription>
              Sign in with your GitHub account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={async () => {
              "use server"
              await signIn("github", {
                redirectTo: searchParams.callbackUrl || "/projects"
              })
            }}>
              <Button type="submit" className="w-full" size="lg">
                <Github className="mr-2 h-5 w-5" />
                Continue with GitHub
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }
  ```

- [ ] Tester sign-in flow localement :
  - Naviguer vers http://localhost:3000
  - Vérifier redirection vers /auth/signin
  - Cliquer "Continue with GitHub"
  - Autoriser app (si première fois)
  - Vérifier redirection vers /projects

**Résultat attendu** : Sign-in page fonctionne, OAuth GitHub réussit

---

### 3.4 Create User Menu Component (1h)

- [ ] Créer `components/auth/user-menu.tsx` :
  ```typescript
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
  import { LogOut, User } from "lucide-react"

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

          <DropdownMenuItem
            className="text-red-600 cursor-pointer"
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

- [ ] Ajouter `UserMenu` au header principal (ex: `app/components/header.tsx`)

- [ ] Wrapper app avec `SessionProvider` dans `app/layout.tsx` :
  ```typescript
  import { SessionProvider } from "next-auth/react"

  export default function RootLayout({ children }) {
    return (
      <html>
        <body>
          <SessionProvider>
            {children}
          </SessionProvider>
        </body>
      </html>
    )
  }
  ```

- [ ] Tester user menu : vérifier avatar, nom, email, sign out

**Résultat attendu** : User menu affiche infos user, sign out fonctionne

---

## ✅ Phase 4: API Routes Update (5-6h)

### 4.1 Create Data Access Layer (2h)

- [ ] Créer `lib/db/users.ts` :
  ```typescript
  import { auth } from "@/app/api/auth/[...nextauth]/route"
  import { prisma } from "@/lib/db/client"

  export async function getCurrentUser() {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }
    return session.user
  }

  export async function requireAuth() {
    const user = await getCurrentUser()
    return user.id as number
  }
  ```

- [ ] Créer `lib/db/projects.ts` :
  ```typescript
  import { auth } from "@/app/api/auth/[...nextauth]/route"
  import { prisma } from "@/lib/db/client"
  import { requireAuth } from "./users"

  export async function getUserProjects() {
    const userId = await requireAuth()

    return prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  export async function getProject(projectId: number) {
    const userId = await requireAuth()

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId, // ← CRITICAL: filter by userId
      },
      include: {
        tickets: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    })

    if (!project) {
      throw new Error('Project not found') // Returns 404
    }

    return project
  }

  export async function createProject(data: {
    name: string
    description: string
    githubOwner: string
    githubRepo: string
  }) {
    const userId = await requireAuth()

    return prisma.project.create({
      data: {
        ...data,
        userId, // ← CRITICAL: inject userId
      },
    })
  }
  ```

- [ ] Créer helper `lib/db/tickets.ts` avec même pattern

**Résultat attendu** : Data access layer avec userId filtering automatique

---

### 4.2 Update Project API Routes (1.5h)

- [ ] Modifier `app/api/projects/route.ts` :
  ```typescript
  import { NextResponse } from 'next/server'
  import { getUserProjects } from '@/lib/db/projects'

  export async function GET() {
    try {
      const projects = await getUserProjects() // ← userId filtering
      return NextResponse.json(projects)
    } catch (error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
  }
  ```

- [ ] Modifier `app/api/projects/[projectId]/route.ts` avec `getProject()`

- [ ] Modifier toutes routes project pour utiliser data access layer

**Résultat attendu** : API routes filtrent par userId, retournent 401 si non auth

---

### 4.3 Update Ticket API Routes (1.5h)

- [ ] Modifier `app/api/projects/[projectId]/tickets/route.ts`

- [ ] Modifier `app/api/projects/[projectId]/tickets/[id]/route.ts`

- [ ] Modifier `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`

- [ ] Ajouter ownership verification avant toute opération :
  ```typescript
  // Vérifie que le project appartient à l'utilisateur
  const project = await getProject(projectId)
  ```

**Résultat attendu** : Isolation complète, cross-user data leaks impossibles

---

## ✅ Phase 5: Testing (3-4h)

### 5.1 Update E2E Tests (2h)

- [ ] Créer helper `tests/helpers/auth.ts` :
  ```typescript
  import { test as base } from '@playwright/test'

  export const test = base.extend({
    // Mock authenticated session
    context: async ({ context }, use) => {
      await context.addCookies([
        {
          name: 'next-auth.session-token',
          value: 'mock-session-token',
          domain: 'localhost',
          path: '/',
          httpOnly: true,
        },
      ])
      await use(context)
    },
  })
  ```

- [ ] Modifier tests existants pour utiliser `test` from `auth.ts`

- [ ] Ajouter test d'isolation :
  ```typescript
  test('users cannot see each other\'s projects', async ({ page }) => {
    // Create project as user A
    await createProject({ name: 'Project A', userId: 1 })

    // Login as user B
    await loginAs(page, 2)

    // Verify Project A is NOT visible
    await page.goto('/projects')
    await expect(page.locator('text=Project A')).not.toBeVisible()
  })
  ```

**Résultat attendu** : E2E tests passent avec auth mockée

---

### 5.2 Manual Testing (1h)

- [ ] Tester OAuth flow complet :
  1. Naviguer vers http://localhost:3000
  2. Redirection vers /auth/signin
  3. Sign in avec GitHub
  4. Redirection vers /projects
  5. Vérifier user menu

- [ ] Tester isolation multi-user :
  1. Se connecter avec compte GitHub A
  2. Créer projet "Project A"
  3. Se déconnecter
  4. Se connecter avec compte GitHub B
  5. Vérifier Project A n'est PAS visible
  6. Créer "Project B"
  7. Se reconnecter avec A
  8. Vérifier Project B n'est PAS visible

- [ ] Tester API protection :
  ```bash
  # Sans auth → 401
  curl http://localhost:3000/api/projects
  ```

**Résultat attendu** : Isolation parfaite, OAuth fonctionne, API protégée

---

## ✅ Phase 6: Deployment (4h)

Voir guide complet : [mvp-with-auth-deployment.md](./mvp-with-auth-deployment.md)

### 6.1 Setup Neon Database (1h)

- [ ] Créer compte Neon : https://neon.tech
- [ ] Créer projet PostgreSQL "ai-board-production"
- [ ] Copier connection string
- [ ] Run migrations :
  ```bash
  DATABASE_URL="postgresql://..." npx prisma migrate deploy
  ```
- [ ] Seed admin user en production

### 6.2 Deploy to Vercel (1h)

- [ ] Link project : `vercel link`
- [ ] Configure environment variables (via dashboard ou CLI)
- [ ] Deploy : `vercel --prod`
- [ ] Copier URL de production

### 6.3 Update Production OAuth App (30 min)

- [ ] Mettre à jour GitHub OAuth App (Production) :
  - Homepage URL → URL Vercel
  - Callback URL → `https://your-app.vercel.app/api/auth/callback/github`
- [ ] Update `NEXTAUTH_URL` dans Vercel env vars
- [ ] Redeploy : `vercel --prod`

### 6.4 Test Production (1h)

- [ ] Tester OAuth flow en production
- [ ] Créer test project
- [ ] Vérifier transition ticket → workflow GitHub Actions
- [ ] Vérifier isolation multi-user

**Résultat attendu** : Application déployée, auth fonctionne en production

---

## ✅ Phase 7: Documentation (2h)

### 7.1 Update README (30 min)

- [ ] Ajouter section "Authentication Setup"
- [ ] Documenter GitHub OAuth App setup
- [ ] Ajouter environment variables requises
- [ ] Lien vers guides détaillés

### 7.2 Create Deployment Guide (1h)

- [ ] Vérifier `mvp-with-auth-deployment.md` est complet
- [ ] Ajouter troubleshooting commun
- [ ] Documenter rollback procedure

### 7.3 Update CLAUDE.md (30 min)

- [ ] Ajouter note sur authentification requise
- [ ] Documenter data access patterns
- [ ] Update API endpoint examples

---

## 🎯 Validation Finale

### Checklist de Validation

- [ ] ✅ OAuth GitHub fonctionne (dev + prod)
- [ ] ✅ Middleware protège toutes routes
- [ ] ✅ Isolation multi-user parfaite (0 cross-user leaks)
- [ ] ✅ API routes filtrent par userId
- [ ] ✅ E2E tests passent
- [ ] ✅ Application déployée en production
- [ ] ✅ Performance < 50ms overhead auth
- [ ] ✅ OAuth success rate > 95%

### Metrics de Succès (Phase 1)

**Sécurité** :
- [ ] 100% authentication coverage
- [ ] 0 cross-user data leaks (vérifié par tests)
- [ ] Session cookies `httpOnly` + `secure`

**Performance** :
- [ ] Auth middleware overhead < 50ms
- [ ] OAuth handshake < 2s
- [ ] Session lookup < 10ms (database)

**Qualité** :
- [ ] OAuth success rate > 95%
- [ ] 0 TypeScript errors
- [ ] E2E test pass rate 100%

**Documentation** :
- [ ] README à jour
- [ ] Deployment guide complet
- [ ] Troubleshooting documented

---

## 📚 Ressources

- [NextAuth.js v5 Docs](https://authjs.dev)
- [Prisma Adapter](https://authjs.dev/reference/adapter/prisma)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [authentication-multiplatform.md](./authentication-multiplatform.md) (vision complète)
- [mvp-with-auth-deployment.md](./mvp-with-auth-deployment.md) (guide déploiement)

---

**Temps Total Estimé** : 16-24h dev + 4h déploiement = **20-28h**

**Prêt pour Phase 2 ?** Voir `authentication-multiplatform.md` pour Google OAuth, GitLab, Bitbucket support.
