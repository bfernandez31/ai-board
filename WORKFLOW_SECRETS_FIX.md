# Correction des Secrets pour les Tests dans les Workflows GitHub

## 🎯 Problème Résolu

Les tests dans les workflows GitHub Actions échouaient silencieusement car les variables d'environnement nécessaires n'étaient pas disponibles.

### Symptômes
- Tests API GitHub qui échouent avec erreur 500 "GITHUB_TOKEN not set"
- Tests d'upload d'images qui échouent sans Cloudinary credentials
- Tests NextAuth qui échouent sans NEXTAUTH_SECRET

## ✅ Solution Implémentée

### 1. Fichier Template `.env.test`
- **Créé** : `.env.test` - Template avec placeholders pour les secrets
- **Contenu** : Toutes les variables nécessaires aux tests
- **Commité** : Oui (pas de vraies credentials, seulement des placeholders)

### 2. Script de Setup
- **Créé** : `.github/scripts/setup-test-env.sh`
- **Rôle** : Copie `.env.test` vers `.env` et injecte les secrets GitHub
- **Exécution** : Automatique dans tous les workflows avant les tests

### 3. Workflows Modifiés

Tous les workflows suivants ont été mis à jour :

#### ✅ `verify.yml`
- Ajout step "Setup Test Environment" après "Configure Git"
- Injection des secrets : GITHUB_TOKEN, CLOUDINARY_*

#### ✅ `speckit.yml`
- Ajout step "Setup Test Environment" après "Configure Git"
- Injection des secrets : GITHUB_TOKEN, CLOUDINARY_*

#### ✅ `quick-impl.yml`
- Ajout step "Setup Test Environment" après "Configure Git"
- Injection des secrets : GITHUB_TOKEN, CLOUDINARY_*

#### ✅ `ai-board-assist.yml`
- Ajout step "Setup Test Environment" après "Configure Git"
- Injection des secrets : GITHUB_TOKEN, CLOUDINARY_*

#### ⏭️ `auto-ship.yml`
- Pas de modification (ne lance pas de tests)

### 4. Documentation
- **Créé** : `.github/SECRETS.md` - Guide complet des secrets requis
- **Contenu** : Liste de tous les secrets, comment les obtenir, troubleshooting

## 📋 Actions Requises

### Étape 1 : Configurer les Secrets GitHub

Aller dans **Settings → Secrets and variables → Actions → Repository secrets** et ajouter :

#### Secrets Déjà Configurés (à vérifier)
- ✅ `CLAUDE_CODE_OAUTH_TOKEN`
- ✅ `WORKFLOW_API_TOKEN`
- ✅ `GH_PAT`

#### Nouveaux Secrets à Ajouter
- ⚠️ `GITHUB_TOKEN` - Personal Access Token avec scopes `repo` + `workflow`
- ⚠️ `CLOUDINARY_CLOUD_NAME` - Cloud name depuis dashboard Cloudinary
- ⚠️ `CLOUDINARY_API_KEY` - API key depuis dashboard Cloudinary
- ⚠️ `CLOUDINARY_API_SECRET` - API secret depuis dashboard Cloudinary

### Étape 2 : Vérifier la Variable APP_URL

Aller dans **Settings → Secrets and variables → Actions → Variables** :
- ✅ `APP_URL` devrait déjà exister

### Étape 3 : Tester les Workflows

1. **Commit et push** les changements :
   ```bash
   git add .
   git commit -m "fix: add environment setup for workflow tests"
   git push
   ```

2. **Déclencher un workflow** pour tester (exemple avec un ticket [e2e]) :
   - Le workflow devrait afficher : "🔧 Setting up test environment..."
   - Les tests devraient avoir accès à toutes les variables
   - Les tests GitHub API devraient passer (si GITHUB_TOKEN configuré)

## 🔍 Vérification

### Dans les logs du workflow, vous devriez voir :

```
🔧 Setting up test environment...
✅ Test environment file created successfully
📋 Environment variables configured:
  - DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ai_board_test
  - NEXTAUTH_URL: http://localhost:3000
  - APP_URL: http://localhost:3000
  - GITHUB_TOKEN: ghp_xxxxx... (40 chars)
  - WORKFLOW_API_TOKEN: xxxxxxxxx... (64 chars)
  - CLOUDINARY_CLOUD_NAME: dxxxxxx
```

### Tests qui devraient maintenant passer :
- ✅ Tests API GitHub (`tests/api/documentation-edit.spec.ts`)
- ✅ Tests API GitHub (`tests/api/documentation-history.spec.ts`)
- ✅ Tests d'upload d'images (si implémentés)
- ✅ Tests NextAuth (mock mode)

## 🚨 Sécurité

### Fichiers Commitables (✅ Safe)
- `.env.test` - Template avec placeholders uniquement
- `.env.example` - Exemple de configuration
- `.github/scripts/setup-test-env.sh` - Script de setup

### Fichiers NON Commitables (❌ Danger)
- `.env` - Créé dynamiquement dans workflows, jamais commité
- `.env.local` - Vos credentials locales
- `.env.test.local` - Vos credentials de test locales

Le `.gitignore` contient déjà :
```
.env
.env.local
.env.*.local
```

## 📚 Documentation Complète

Pour plus de détails, voir :
- `.github/SECRETS.md` - Guide complet des secrets
- `.env.example` - Template pour développement local
- `.env.test` - Template pour CI/CD

## 🔄 Workflow

### En Local
1. Copier `.env.example` vers `.env`
2. Remplir avec vos vraies credentials
3. Lancer `bun test` ou `bun test:e2e`

### En CI/CD
1. GitHub Secrets sont injectés automatiquement
2. `.github/scripts/setup-test-env.sh` crée le `.env` final
3. Tests ont accès à toutes les variables
4. Fichier `.env` est éphémère (jamais commité)

## ✅ Checklist de Déploiement

- [x] Créer `.env.test` template
- [x] Créer script `setup-test-env.sh`
- [x] Modifier workflow `verify.yml`
- [x] Modifier workflow `speckit.yml`
- [x] Modifier workflow `quick-impl.yml`
- [x] Modifier workflow `ai-board-assist.yml`
- [x] Créer documentation `.github/SECRETS.md`
- [ ] Configurer secrets GitHub (GITHUB_TOKEN, CLOUDINARY_*)
- [ ] Tester un workflow avec les nouveaux secrets
- [ ] Vérifier que les tests passent
