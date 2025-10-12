# MVP Deployment Guide - Authentication-First Approach

**Guide complet pour déployer AI Board avec authentification GitHub OAuth intégrée dès le MVP.**

Dernière mise à jour: 2025-10-12

## 📋 Table des Matières

1. [Vue d'Ensemble](#-vue-densemble)
2. [Prérequis](#-prérequis)
3. [Setup GitHub OAuth](#-setup-github-oauth)
4. [Configuration Locale](#-configuration-locale)
5. [Database Setup (Neon)](#-database-setup-neon)
6. [Déploiement Vercel](#-déploiement-vercel)
7. [Tests Post-Déploiement](#-tests-post-déploiement)
8. [Troubleshooting](#-troubleshooting)

## 🎯 Vue d'Ensemble

### Pourquoi Auth-First ?

**Avantages** :
- ✅ Architecture finale dès V1 (pas de migration post-déploiement)
- ✅ Multi-user ready jour 1
- ✅ Sécurité by design
- ✅ Évite breaking changes futurs

**Inconvénients** :
- ⏱️ +8-16h de développement initial
- 🔧 Configuration OAuth requise

**ROI** : +8-16h maintenant, évite 20-30h de migration ultérieure

### Stack Technique

- **Auth** : NextAuth.js v5 (Auth.js) avec Prisma Adapter
- **Provider MVP** : GitHub OAuth uniquement
- **Session** : Database sessions (secure, révocables)
- **Database** : PostgreSQL (Neon) avec tables NextAuth

### Architecture

```
User → Sign In (GitHub OAuth) → NextAuth → Database Session
                                    ↓
                            Middleware Protection
                                    ↓
                        Protected Routes + API
                                    ↓
                        userId Filtering (Isolation)
```

## 🔧 Prérequis

### Comptes Requis

1. **GitHub Account** (gratuit)
   - Pour OAuth App (dev + prod)
   - Pour repository et GitHub Actions

2. **Vercel Account** (gratuit)
   - Plan Hobby : $0
   - Déploiements illimités
   - 100 GB bandwidth/mois

3. **Neon Account** (gratuit)
   - PostgreSQL managed
   - Plan Free : $0
   - 0.5 GB storage, 10 GB transfer/mois

### Outils Locaux

```bash
# Node.js 22.20.0 LTS
node --version  # v22.20.0

# npm ou pnpm
npm --version

# Git
git --version

# Vercel CLI (optionnel mais recommandé)
npm install -g vercel
```

## 🔑 Setup GitHub OAuth

### OAuth App pour Développement

**Étape 1** : Créer OAuth App

1. Aller sur https://github.com/settings/developers
2. Cliquer **"New OAuth App"**
3. Remplir le formulaire :
   - **Application name** : `AI Board (Development)`
   - **Homepage URL** : `http://localhost:3000`
   - **Authorization callback URL** : `http://localhost:3000/api/auth/callback/github`
4. Cliquer **"Register application"**

**Étape 2** : Récupérer les credentials

1. Copier **Client ID** (format: `Ov23liABC123...`)
2. Cliquer **"Generate a new client secret"**
3. Copier **Client Secret** (⚠️ ne s'affiche qu'une fois !)

**Étape 3** : Sauvegarder dans `.env.local`

```bash
# GitHub OAuth (Development)
GITHUB_ID="Ov23liABC123..."
GITHUB_SECRET="1234567890abcdef..."
```

### OAuth App pour Production

**Répéter les étapes ci-dessus** avec les URLs de production :

1. Créer une **deuxième** OAuth App
2. Remplir le formulaire :
   - **Application name** : `AI Board (Production)`
   - **Homepage URL** : `https://your-app.vercel.app` (⚠️ sera fourni par Vercel)
   - **Authorization callback URL** : `https://your-app.vercel.app/api/auth/callback/github`
3. Copier Client ID et Secret (pour configuration Vercel plus tard)

**Note** : Il est recommandé d'avoir 2 OAuth Apps séparées (dev + prod) pour éviter les conflits de callback URLs.

## 💻 Configuration Locale

### 1. Install Dependencies

```bash
# NextAuth + Prisma Adapter
npm install next-auth@beta @auth/prisma-adapter

# Déjà installé (vérifier package.json)
# - @prisma/client
# - prisma
```

**Version requise** : `next-auth@5.x` (beta, compatible Next.js 15)

### 2. Environment Variables

Créer/modifier `.env.local` :

```bash
# Database (local development)
DATABASE_URL="postgresql://user:password@localhost:5432/ai-board"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-command-below"

# GitHub OAuth (Development)
GITHUB_ID="Ov23liABC123..."
GITHUB_SECRET="1234567890abcdef..."

# GitHub Integration (existing)
GITHUB_TOKEN="ghp_..."
GITHUB_OWNER="your-username"
GITHUB_REPO="ai-board"

# Anthropic API (existing)
ANTHROPIC_API_KEY="sk-ant-..."

# Node Environment
NODE_ENV="development"
```

**Générer NEXTAUTH_SECRET** :

```bash
openssl rand -base64 32
# Output: YourRandomSecretHere123456789==
```

### 3. Update Prisma Schema

Le schema est déjà défini dans `authentication-multiplatform.md`. Vérifier `prisma/schema.prisma` contient :

```prisma
// Authentication Models (NextAuth)
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
  image         String?

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
  type              String
  provider          AuthProvider
  providerAccountId String

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

// Update existing Project model
model Project {
  // ... existing fields ...
  userId      Int
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### 4. Generate Migration

```bash
# Créer la migration
npx prisma migrate dev --name add_authentication

# Génère automatiquement :
# - prisma/migrations/XXX_add_authentication/migration.sql
# - Met à jour Prisma Client
```

**Migration automatique** :
- Créé tables User, Account, Session, VerificationToken
- Ajoute userId sur Project (nullable temporairement)
- Crée user admin par défaut
- Assigne projets existants à admin
- Rend userId NOT NULL

### 5. Seed Default Admin User

Créer `prisma/seed-auth.ts` :

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create default admin user for existing projects
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

  // Assign all projects without userId to admin
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

```bash
# Exécuter le seed
npx tsx prisma/seed-auth.ts
```

### 6. Local Testing

```bash
# Start dev server
npm run dev

# Tester :
# 1. http://localhost:3000 → redirige vers /auth/signin
# 2. Cliquer "Sign in with GitHub"
# 3. Autoriser l'app GitHub
# 4. Redirection vers /projects (authentifié)
# 5. Vérifier user menu en haut à droite
```

## 🗄️ Database Setup (Neon)

### 1. Créer Compte Neon

1. Aller sur https://neon.tech
2. Sign up (gratuit, pas de carte requise)
3. Confirmer email

### 2. Créer Projet PostgreSQL

1. Cliquer **"Create a project"**
2. Remplir :
   - **Project name** : `ai-board-production`
   - **Region** : Choisir le plus proche (ex: Europe - Frankfurt)
   - **PostgreSQL version** : 16 (latest)
3. Cliquer **"Create project"**

### 3. Récupérer Connection String

1. Dans le dashboard Neon, copier **Connection string**
2. Format : `postgresql://user:password@host.neon.tech/dbname?sslmode=require`

**Important** : Sauvegarder cette string pour Vercel !

### 4. Run Migrations en Production

**Option A** : Via Prisma CLI (recommandé)

```bash
# Set production DATABASE_URL temporairement
export DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# Run migrations
npx prisma migrate deploy

# Seed admin user
npx tsx prisma/seed-auth.ts

# Unset variable
unset DATABASE_URL
```

**Option B** : Via Neon SQL Editor (manuel)

1. Dans Neon dashboard → SQL Editor
2. Copier/coller le contenu de `prisma/migrations/XXX_add_authentication/migration.sql`
3. Exécuter
4. Copier/coller seed script (convertir TypeScript en SQL)

### 5. Vérifier Tables

```bash
# Connexion psql (optionnel)
psql "postgresql://user:pass@host.neon.tech/db?sslmode=require"

# Lister tables
\dt

# Devrait afficher :
# - User
# - Account
# - Session
# - VerificationToken
# - Project (avec userId)
# - Ticket
# - Job
```

## 🚀 Déploiement Vercel

### 1. Install Vercel CLI (optionnel)

```bash
npm install -g vercel
vercel login
```

### 2. Link Project

**Option A** : Via Vercel CLI

```bash
# Dans le dossier ai-board/
vercel link

# Suivre les prompts :
# - Link to existing project? → Yes (si déjà créé) ou No
# - Project name → ai-board
# - Directory → ./
```

**Option B** : Via Vercel Dashboard

1. Aller sur https://vercel.com/new
2. Importer le repository GitHub `bfernandez31/ai-board`
3. Configure project settings (voir ci-dessous)

### 3. Configure Environment Variables

**Via Vercel Dashboard** (Settings → Environment Variables) :

```bash
# Database (Neon)
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=YourRandomSecretHere123456789==

# GitHub OAuth (Production credentials)
GITHUB_ID=Ov23liPROD123...
GITHUB_SECRET=prod_secret_here...

# GitHub Integration (existing)
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=bfernandez31
GITHUB_REPO=ai-board

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-...

# Node Environment
NODE_ENV=production
```

**Important** :
- Utiliser les credentials **Production** GitHub OAuth App
- `NEXTAUTH_URL` doit correspondre exactement au domaine Vercel
- Ne PAS commit ces variables dans git

**Via Vercel CLI** :

```bash
# Set variables interactivement
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add GITHUB_ID production
vercel env add GITHUB_SECRET production
# ... etc
```

### 4. Deploy

**Option A** : Via Git Push (auto-deploy)

```bash
git push origin main
# Vercel détecte le push et déploie automatiquement
```

**Option B** : Via Vercel CLI

```bash
# Deploy to production
vercel --prod

# Output :
# ✅ Deployed to production: https://ai-board-xyz.vercel.app
```

### 5. Update GitHub OAuth Callback URL

**CRITICAL** : Après le premier déploiement Vercel :

1. Copier l'URL Vercel (ex: `https://ai-board-xyz.vercel.app`)
2. Aller sur GitHub OAuth App (Production)
3. Mettre à jour **Authorization callback URL** :
   - `https://ai-board-xyz.vercel.app/api/auth/callback/github`
4. Mettre à jour **Homepage URL** :
   - `https://ai-board-xyz.vercel.app`
5. Sauvegarder

### 6. Update NEXTAUTH_URL

Si l'URL Vercel a changé :

1. Dashboard Vercel → Settings → Environment Variables
2. Modifier `NEXTAUTH_URL` → `https://ai-board-xyz.vercel.app`
3. Redéployer (Deployments → Redeploy)

## ✅ Tests Post-Déploiement

### 1. Test OAuth Flow

```bash
# 1. Ouvrir l'app en production
open https://ai-board-xyz.vercel.app

# 2. Devrait rediriger vers /auth/signin
# 3. Cliquer "Sign in with GitHub"
# 4. Autoriser l'app (si première fois)
# 5. Vérifier redirection vers /projects
```

**Résultat attendu** :
- ✅ Redirection GitHub fonctionne
- ✅ OAuth callback réussit
- ✅ Session créée
- ✅ User menu visible (avatar + nom)

### 2. Test Multi-User Isolation

```bash
# 1. Se connecter avec compte GitHub A
# 2. Créer un projet "Project A"
# 3. Se déconnecter
# 4. Se connecter avec compte GitHub B
# 5. Vérifier : Project A n'est PAS visible
# 6. Créer "Project B"
# 7. Se reconnecter avec compte A
# 8. Vérifier : Project B n'est PAS visible
```

**Résultat attendu** :
- ✅ Isolation parfaite entre utilisateurs
- ✅ Chaque user voit uniquement ses projets

### 3. Test Workflow GitHub Actions

```bash
# 1. Créer un ticket
# 2. Drag vers SPECIFY
# 3. Vérifier GitHub Actions se déclenche
# 4. Attendre completion (~2-5 min)
# 5. Vérifier spec.md créé dans repository
```

**Résultat attendu** :
- ✅ Workflow dispatch fonctionne
- ✅ Job status mis à jour
- ✅ Spec généré correctement

### 4. Test Performance

```bash
# Vérifier temps de réponse
curl -w "@curl-format.txt" -o /dev/null -s https://ai-board-xyz.vercel.app

# Devrait afficher :
# time_total: < 1s (acceptable)
# time_starttransfer: < 500ms (bon)
```

## 🔧 Troubleshooting

### OAuth Errors

#### Error: "The redirect_uri MUST match the registered callback URL"

**Cause** : Callback URL mismatch entre GitHub OAuth App et NEXTAUTH_URL

**Solution** :
```bash
# 1. Vérifier NEXTAUTH_URL dans Vercel
echo $NEXTAUTH_URL  # Doit correspondre au domaine Vercel

# 2. Vérifier GitHub OAuth App callback URL
# https://github.com/settings/developers
# Doit être : https://your-app.vercel.app/api/auth/callback/github

# 3. Les deux doivent être identiques (HTTPS, même domaine)
```

#### Error: "Client authentication failed"

**Cause** : GITHUB_ID ou GITHUB_SECRET incorrect

**Solution** :
```bash
# 1. Vérifier les credentials dans Vercel
# 2. Regénérer Client Secret si nécessaire
# 3. Mettre à jour Vercel env vars
# 4. Redéployer
```

### Database Errors

#### Error: "P2002: Unique constraint failed on fields: email"

**Cause** : User déjà existant (email dupliqué)

**Solution** :
```sql
-- Connexion à Neon database
-- Supprimer user en double (ATTENTION : perte de données)
DELETE FROM "User" WHERE email = 'duplicate@example.com';
```

#### Error: "Can't reach database server"

**Cause** : DATABASE_URL invalide ou Neon database en pause

**Solution** :
```bash
# 1. Vérifier DATABASE_URL format
# Doit contenir : ?sslmode=require

# 2. Tester connexion
psql "$DATABASE_URL" -c "SELECT NOW();"

# 3. Si database en pause (free tier)
# Attendre 1-2s, Neon réveille automatiquement
```

### Deployment Errors

#### Error: "Missing required environment variable: NEXTAUTH_SECRET"

**Cause** : Variable non définie dans Vercel

**Solution** :
```bash
# Ajouter via CLI
vercel env add NEXTAUTH_SECRET production

# Ou via Dashboard
# Settings → Environment Variables → Add
```

#### Error: "Build failed: TypeScript errors"

**Cause** : Erreurs de compilation TypeScript

**Solution** :
```bash
# Tester build localement
npm run build

# Fix errors
npm run type-check

# Commit et push
git add .
git commit -m "fix: resolve TypeScript errors"
git push origin main
```

### Session Issues

#### Issue: User logged out après refresh

**Cause** : Session expirée ou cookie config incorrect

**Solution** :
```typescript
// Vérifier app/api/auth/[...nextauth]/route.ts
session: {
  strategy: "database",
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60, // 24 hours
},

cookies: {
  sessionToken: {
    name: `__Secure-next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true, // HTTPS only in production
    },
  },
},
```

## 📊 Monitoring & Maintenance

### Vercel Analytics (optionnel)

```bash
# Enable analytics
vercel analytics enable

# View metrics
# Dashboard → Analytics
# - Page views
# - Unique visitors
# - Performance scores
```

### Database Monitoring (Neon)

1. Dashboard Neon → Monitoring
2. Vérifier :
   - **Storage usage** (< 0.5 GB sur free tier)
   - **Query performance** (< 100ms median)
   - **Connection count** (< 100 sur free tier)

### Cost Tracking

**Free Tier Limits** :
- ✅ Vercel : Unlimited deploys, 100 GB bandwidth/mois
- ✅ Neon : 0.5 GB storage, 10 GB transfer/mois
- ✅ GitHub Actions : 2000 min/mois
- 💰 Anthropic API : Pay-as-you-go (~$5-20/mois)

**Total MVP Cost** : $5-20/mois (uniquement API Claude)

## 🎯 Next Steps

Après déploiement MVP réussi :

1. **Monitoring** : Setup Sentry ou LogRocket (optionnel)
2. **Custom Domain** : Configurer domaine personnalisé dans Vercel
3. **Phase 2 Auth** : Ajouter Google OAuth (voir `authentication-multiplatform.md`)
4. **Phase 3 Git** : Support GitLab/Bitbucket (voir `authentication-multiplatform.md`)

## 📚 Références

- [NextAuth.js v5 Docs](https://authjs.dev)
- [Vercel Deployment Docs](https://vercel.com/docs)
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)

---

**Besoin d'aide ?** Ouvre une issue sur le repository avec le tag `deployment` !
