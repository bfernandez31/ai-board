# Landing Page Marketing - Specification de Conception

## 🎯 Vue d'Ensemble

Créer une page d'accueil marketing style Vercel.com pour les visiteurs non connectés, avec un design moderne, vendeur et cohérent avec le thème sombre de l'application.

## 📋 Contexte Technique

### État Actuel
- **Route actuelle** : `/app/page.tsx` redirige automatiquement vers `/projects`
- **Header existant** : Composant `Header` dans `/components/layout/header.tsx`
- **Thème** : Catppuccin Mocha (fond sombre `#1e1e2e`)
- **Couleur primaire** : Violet `#8B5CF6` (--primary-violet)
- **Authentification** : NextAuth.js avec session-based auth

### Architecture Actuelle
```
app/
  layout.tsx (inclut <Header />)
  page.tsx (redirect vers /projects)
  globals.css (Catppuccin Mocha theme)
components/
  layout/header.tsx
  auth/user-menu.tsx
```

## 🎨 Spécifications de Design

### 1. Comportement Conditionnel de la Page d'Accueil

**Route** : `/` (`app/page.tsx`)

**Logique de Redirection** :
```typescript
// Si utilisateur connecté → redirect /projects
// Si utilisateur non connecté → afficher landing page marketing
```

### 2. Structure de la Landing Page

Inspirée de Vercel.com, la page doit contenir les sections suivantes dans l'ordre :

#### A. Hero Section (Au-dessus du pli)
**Hauteur** : `min-h-screen` (viewport complet)
**Layout** : Centré verticalement et horizontalement

**Contenu** :
- **Titre principal** (H1) :
  - Texte : "Build Better Software with AI-Powered Workflows"
  - Taille : `text-6xl md:text-7xl lg:text-8xl`
  - Font-weight : `font-bold`
  - Couleur : Gradient violet → bleu (`bg-gradient-to-r from-[#8B5CF6] via-[#6366F1] to-[#3B82F6]`)
  - Effect : `bg-clip-text text-transparent`

- **Sous-titre** (P) :
  - Texte : "Transform GitHub issues into actionable tasks with automated workflows, AI-driven specifications, and visual kanban boards."
  - Taille : `text-xl md:text-2xl`
  - Couleur : `text-[hsl(var(--ctp-subtext-0))]`
  - Max-width : `max-w-3xl`
  - Margin-top : `mt-6`

- **CTA Buttons** :
  - Container : `flex gap-4 mt-10`
  - **Bouton primaire** :
    - Texte : "Get Started Free"
    - Variant : `default` (violet)
    - Size : `lg`
    - Icon : Aucun
  - **Bouton secondaire** :
    - Texte : "View Demo"
    - Variant : `outline`
    - Size : `lg`
    - Icon : `Play` (lucide-react) à gauche

- **Visual Element** :
  - Screenshot de l'application (kanban board)
  - Position : En dessous des CTA (`mt-16`)
  - Style : Bordure arrondie, ombre portée violette
  - Classes : `rounded-xl shadow-2xl shadow-[#8B5CF6]/20 border border-[hsl(var(--ctp-surface-0))]`
  - Dimensions : `max-w-6xl w-full`

#### B. Features Grid Section
**Padding** : `py-32`
**Background** : `bg-[#1e1e2e]` (même que body)

**Contenu** :
- **Section Header** :
  - Surtitle : "Features"
  - Couleur : Violet `text-[#8B5CF6]`
  - Taille : `text-sm font-semibold uppercase tracking-wide`
  - Title : "Everything you need to ship faster"
  - Taille : `text-4xl md:text-5xl font-bold`
  - Couleur : `text-[hsl(var(--ctp-text))]`

- **Grid de Features** :
  - Layout : `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16`
  - **6 Feature Cards** :

    **Card 1 - AI-Powered Specifications**
    - Icon : `Sparkles` (lucide-react) - Violet
    - Titre : "AI-Powered Specifications"
    - Description : "Automatically generate detailed specifications from simple issue descriptions using Claude AI."

    **Card 2 - Visual Kanban Board**
    - Icon : `LayoutGrid` (lucide-react) - Bleu
    - Titre : "Visual Kanban Board"
    - Description : "Track your workflow from inbox to production with an intuitive drag-and-drop interface."

    **Card 3 - GitHub Integration**
    - Icon : `Github` (lucide-react) - Vert
    - Titre : "Seamless GitHub Integration"
    - Description : "Sync tickets, branches, and workflows directly with your GitHub repository."

    **Card 4 - Automated Workflows**
    - Icon : `Zap` (lucide-react) - Jaune
    - Titre : "Automated Workflows"
    - Description : "Let GitHub Actions handle specification, planning, and implementation automatically."

    **Card 5 - Image Attachments**
    - Icon : `Image` (lucide-react) - Rose
    - Titre : "Rich Image Support"
    - Description : "Attach mockups and screenshots to tickets with Cloudinary CDN integration."

    **Card 6 - Real-time Updates**
    - Icon : `RefreshCw` (lucide-react) - Cyan
    - Titre : "Real-time Status Tracking"
    - Description : "Watch job progress in real-time with automatic polling and status indicators."

**Structure de Feature Card** :
```tsx
<div className="bg-[hsl(var(--ctp-mantle))] p-8 rounded-lg border border-[hsl(var(--ctp-surface-0))] hover:border-[#8B5CF6]/50 transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/10">
  <Icon className="w-12 h-12 mb-4" style={{ color: iconColor }} />
  <h3 className="text-xl font-semibold mb-3 text-[hsl(var(--ctp-text))]">{title}</h3>
  <p className="text-[hsl(var(--ctp-subtext-0))]">{description}</p>
</div>
```

#### C. Workflow Visualization Section
**Padding** : `py-32`
**Background** : Légèrement plus sombre `bg-[hsl(var(--ctp-mantle))]`

**Contenu** :
- **Section Header** :
  - Surtitle : "Workflow"
  - Title : "From Idea to Production in Minutes"

- **Workflow Steps** :
  - Layout : Timeline verticale (mobile) / horizontale (desktop)
  - **5 Étapes** :

    1. **INBOX** → "Create ticket from GitHub issue"
    2. **SPECIFY** → "AI generates detailed specification"
    3. **PLAN** → "Automated implementation planning"
    4. **BUILD** → "Development with branch tracking"
    5. **VERIFY** → "Testing and deployment"

**Structure de Workflow Step** :
- Icône de l'étape (Badge avec le nom de la colonne)
- Connecteur visuel (ligne/flèche)
- Titre de l'action
- Description courte
- Couleur de l'icône correspondant aux couleurs des colonnes du kanban

#### D. Social Proof Section (Optionnel)
**Padding** : `py-24`
**Background** : `bg-[#1e1e2e]`

**Contenu** :
- Citation testimonial
- Stats (nombre de projets, tickets traités, etc.)
- Logo GitHub (partenariat/intégration)

#### E. CTA Final Section
**Padding** : `py-32`
**Background** : Gradient subtil violet

**Contenu** :
- Titre : "Ready to accelerate your development?"
- Sous-titre : "Join developers using AI-powered workflows"
- CTA : "Get Started Free" (même style que hero)

### 3. Header Modifications

**Comportement actuel du Header** :
- Affiché sur toutes les pages sauf `/auth/*`
- Contient : Logo + Titre + Project Info + User Menu

**Modifications requises** :
- **Sur landing page (non connecté)** :
  - Afficher : Logo + Titre
  - Ajouter : Navigation links → "Features" | "Workflow" | "Pricing" (scroll vers sections)
  - Remplacer User Menu par : Bouton "Sign In"

- **Sur autres pages (connecté)** :
  - Comportement actuel conservé

**Logique conditionnelle** :
```typescript
// Dans Header component
const { data: session } = useSession();
const isLandingPage = pathname === '/' && !session;

if (isLandingPage) {
  // Render marketing header variant
} else {
  // Render app header variant
}
```

### 4. Thème et Couleurs

**Palette Catppuccin Mocha (déjà définie)** :
- Background : `#1e1e2e` (--ctp-base)
- Mantle : `#181825` (--ctp-mantle)
- Text : `#cdd6f4` (--ctp-text)
- Subtext : `#a6adc8` (--ctp-subtext-0)
- Primary : `#8B5CF6` (--primary-violet)

**Couleurs d'accents pour icons** :
- Violet : `#8B5CF6` (AI, principal)
- Bleu : `#89b4fa` (--ctp-blue)
- Vert : `#a6e3a1` (--ctp-green)
- Jaune : `#f9e2af` (--ctp-yellow)
- Rose : `#f5c2e7` (--ctp-pink)
- Cyan : `#89dceb` (--ctp-sky)

### 5. Responsive Design

**Breakpoints Tailwind** :
- Mobile : < 768px
- Tablet : 768px - 1024px
- Desktop : > 1024px

**Adaptations** :
- Hero title : `text-6xl` → `md:text-7xl` → `lg:text-8xl`
- Features grid : `grid-cols-1` → `md:grid-cols-2` → `lg:grid-cols-3`
- Workflow : Vertical → `md:horizontal`
- Padding sections : `py-16` → `md:py-24` → `lg:py-32`

### 6. Animations et Interactions

**Hover Effects** :
- Feature cards : Border color change + shadow glow
- CTA buttons : Scale transform `hover:scale-105`
- Links : Color transition `transition-colors duration-200`

**Scroll Animations (Optionnel)** :
- Fade-in au scroll avec Intersection Observer
- Parallax subtil sur hero background

### 7. Accessibilité

**Requirements** :
- Tous les boutons ont des labels clairs
- Images ont des `alt` descriptifs
- Contrast ratio WCAG AA minimum
- Navigation au clavier fonctionnelle
- Focus indicators visibles

## 📁 Structure des Fichiers à Créer/Modifier

### Fichiers à Créer
```
app/
  landing/
    page.tsx                          # Landing page component
components/
  landing/
    hero-section.tsx                  # Hero section
    features-grid.tsx                 # Features grid
    workflow-section.tsx              # Workflow visualization
    cta-section.tsx                   # Final CTA
    feature-card.tsx                  # Reusable feature card
```

### Fichiers à Modifier
```
app/
  page.tsx                            # Logique conditionnelle redirect vs landing
components/
  layout/
    header.tsx                        # Variante marketing header
```

## 🔧 Spécifications Techniques

### Dependencies Requises
- Toutes les dépendances existent déjà :
  - `next` (App Router)
  - `next-auth` (session management)
  - `lucide-react` (icons)
  - `tailwindcss` (styling)
  - `@/components/ui/*` (shadcn/ui components)

### API Requirements
**Aucune nouvelle API nécessaire**

La logique d'authentification utilise NextAuth.js existant :
```typescript
import { useSession } from 'next-auth/react';
const { data: session } = useSession();
```

### Performance Considerations
- Images optimisées avec Next.js `<Image>` component
- Lazy loading des sections below-the-fold
- CSS minifié avec Tailwind purge
- Screenshot en WebP avec fallback PNG

## 📸 Assets Nécessaires

### Images à Créer/Obtenir
1. **Hero Screenshot** : `public/landing/hero-screenshot.png`
   - Screenshot du kanban board en action
   - Résolution : 2400x1600px
   - Format : WebP + PNG fallback

2. **Workflow Icons** (optionnel si lucide-react suffit)
   - Utiliser les icons lucide-react existants

### Texte Marketing

**Hero Section** :
- Headline : "Build Better Software with AI-Powered Workflows"
- Subheadline : "Transform GitHub issues into actionable tasks with automated workflows, AI-driven specifications, and visual kanban boards."

**Features** :
- Voir section Features Grid ci-dessus

**CTA** :
- Primary : "Get Started Free"
- Secondary : "View Demo"
- Final : "Start Building Today"

## ✅ Critères d'Acceptation

### Fonctionnels
- [ ] Visiteurs non connectés voient la landing page sur `/`
- [ ] Utilisateurs connectés sont redirigés vers `/projects`
- [ ] Header affiche la variante marketing pour non-connectés
- [ ] Header conserve le comportement normal pour connectés
- [ ] Tous les liens de navigation fonctionnent (scroll ou redirect)
- [ ] Bouton "Sign In" redirige vers `/auth/signin`

### Visuels
- [ ] Fond sombre cohérent avec l'application (`#1e1e2e`)
- [ ] Palette de couleurs Catppuccin Mocha respectée
- [ ] Gradient violet sur titre principal
- [ ] 6 feature cards affichées en grid responsive
- [ ] Workflow timeline visible et compréhensible
- [ ] Hover effects fonctionnels sur tous les éléments interactifs

### Responsive
- [ ] Layout mobile fonctionnel (< 768px)
- [ ] Layout tablet optimal (768-1024px)
- [ ] Layout desktop parfait (> 1024px)
- [ ] Pas de scroll horizontal sur aucun breakpoint
- [ ] Images responsive et optimisées

### Performance
- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Lighthouse score > 90

### Accessibilité
- [ ] Navigation au clavier complète
- [ ] Screen readers supportés
- [ ] Contrast ratio WCAG AA
- [ ] Focus indicators visibles
- [ ] Tous les liens ont des labels descriptifs

## 🚀 Phases d'Implémentation Suggérées

### Phase 1 : Structure et Routing
1. Modifier `app/page.tsx` avec logique conditionnelle
2. Créer structure de dossiers `app/landing/` et `components/landing/`
3. Implémenter redirection basée sur session

### Phase 2 : Header Variant
1. Modifier `components/layout/header.tsx`
2. Ajouter logique conditionnelle pour variante marketing
3. Créer navigation links vers sections

### Phase 3 : Hero Section
1. Créer `components/landing/hero-section.tsx`
2. Implémenter titre avec gradient
3. Ajouter CTA buttons
4. Intégrer screenshot placeholder

### Phase 4 : Features Grid
1. Créer `components/landing/feature-card.tsx`
2. Créer `components/landing/features-grid.tsx`
3. Implémenter les 6 feature cards avec icons

### Phase 5 : Workflow Section
1. Créer `components/landing/workflow-section.tsx`
2. Implémenter timeline responsive
3. Ajouter visual connectors

### Phase 6 : Final CTA & Polish
1. Créer `components/landing/cta-section.tsx`
2. Ajouter animations hover
3. Optimiser images
4. Tests responsive
5. Audit accessibilité

## 📝 Notes Additionnelles

### Inspiration Vercel.com
**Éléments à reproduire** :
- Grande typo avec gradient
- Grid de features avec hover effects
- Sections généreusement espacées
- CTA proéminents et clairs
- Fond sombre élégant
- Micro-interactions subtiles

**Différences avec Vercel** :
- Pas de fond blanc (rester sur thème sombre)
- Pas d'animations 3D complexes (garder simple)
- Focus sur workflow AI (USP de l'app)

### Considérations UX
- **Clarté du message** : Expliquer immédiatement la valeur (AI + GitHub + Kanban)
- **Conversion** : CTA visibles et sans friction
- **Crédibilité** : Screenshots réels de l'app, pas de mockups
- **Rapidité** : Moins de 3 sections de scroll avant CTA final

### SEO (Future Enhancement)
- Meta tags Open Graph
- Schema.org markup
- Sitemap entry
- robots.txt configuration

---

**Statut** : Prêt pour spécification avec `/speckit.specify`
**Version** : 1.0
**Dernière mise à jour** : 2025-10-21
