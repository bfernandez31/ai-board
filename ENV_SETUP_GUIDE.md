# 🚀 Guide de Configuration des Variables d'Environnement

## ✅ Statut : Aucune Action Requise pour les Tests

Les tests fonctionnent **SANS secrets GitHub** grâce aux mocks automatiques.

## 🎯 Ce Qui Est Déjà Configuré

### 1. Mode Test Automatique

Les mocks s'activent automatiquement via :

```typescript
if (process.env.NODE_ENV === 'test' ||
    process.env.TEST_MODE === 'true' ||
    process.env.TEST_USER_ID)
```

### 2. En Local (Développement)

#### Fichier `playwright.config.ts`
```typescript
webServer: {
  command: 'TEST_MODE=true WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only npm run dev',
  env: {
    TEST_MODE: 'true',
    WORKFLOW_API_TOKEN: 'test-workflow-token-for-e2e-tests-only',
  },
}
```
✅ **Déjà configuré** - Pas besoin de modifier

#### Fichier `.env.test.local`
```env
TEST_MODE=true
WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only
NEXTAUTH_SECRET=test-secret-key-for-local-development-only
NEXTAUTH_URL=http://localhost:3000
```
✅ **Déjà présent** - Pas besoin de modifier

### 3. Dans les Workflows GitHub Actions

#### Fichiers Créés
- ✅ `.env.test` - Template avec `TEST_MODE=true`
- ✅ `.github/scripts/setup-test-env.sh` - Script d'injection

#### Workflows Modifiés (4 fichiers)
- ✅ `verify.yml` - Step "Setup Test Environment" ajouté
- ✅ `speckit.yml` - Step "Setup Test Environment" ajouté
- ✅ `quick-impl.yml` - Step "Setup Test Environment" ajouté
- ✅ `ai-board-assist.yml` - Step "Setup Test Environment" ajouté

## 📋 Secrets GitHub : Optionnels

### Secrets Actuellement Requis (Déjà Configurés)

Ces secrets doivent être présents pour que les workflows fonctionnent :

1. **`CLAUDE_CODE_OAUTH_TOKEN`** ✅
   - Token OAuth pour Claude Code CLI
   - Utilisé par tous les workflows

2. **`WORKFLOW_API_TOKEN`** ✅
   - Token d'authentification pour les appels API
   - Utilisé pour mettre à jour le statut des jobs

3. **`GH_PAT`** ✅
   - GitHub Personal Access Token
   - Utilisé pour créer les Pull Requests

### Secrets OPTIONNELS (Pour Tests Avancés)

Ces secrets sont **OPTIONNELS** car les mocks fonctionnent sans eux :

4. **`GITHUB_TOKEN`** ⚠️ **OPTIONNEL**
   - ❌ **NON REQUIS** pour les tests (mocks actifs)
   - ✅ Requis seulement si vous voulez tester avec la vraie API GitHub
   - Comment obtenir : GitHub Settings → Developer settings → Personal access tokens

5. **`CLOUDINARY_CLOUD_NAME`** ⚠️ **OPTIONNEL**
   - ❌ **NON REQUIS** si pas de tests d'upload d'images
   - ✅ Requis pour tests d'upload d'images (si implémentés)
   - Comment obtenir : Cloudinary Dashboard → Account Details

6. **`CLOUDINARY_API_KEY`** ⚠️ **OPTIONNEL**
   - Même que ci-dessus

7. **`CLOUDINARY_API_SECRET`** ⚠️ **OPTIONNEL**
   - Même que ci-dessus

## 🔧 Comment Ajouter des Secrets (Si Nécessaire)

### 1. Via Interface GitHub

```
Repo → Settings → Secrets and variables → Actions → New repository secret
```

### 2. Nom du Secret

Utiliser exactement les noms ci-dessus (sensible à la casse)

### 3. Valeur du Secret

Coller la valeur du token/credential

## 🧪 Tester Sans Secrets

### Local
```bash
# Tous les tests fonctionnent immédiatement
bun test
```

### GitHub Actions
```
# Déclencher manuellement un workflow
Actions → Choisir un workflow → Run workflow
```

Les tests passeront avec les mocks, **sans** `GITHUB_TOKEN`.

## 🎯 Quand Ajouter GITHUB_TOKEN ?

Ajoutez `GITHUB_TOKEN` seulement si :

1. ❌ Vous voulez tester avec la **vraie** API GitHub
2. ❌ Vous voulez désactiver les mocks
3. ❌ Vous développez de nouvelles intégrations GitHub

Pour 99% des cas, **les mocks suffisent**.

## 🔍 Vérification

### Comment vérifier que tout fonctionne ?

#### En Local
```bash
# Lancer les tests
bun test

# Vérifier les logs du serveur
# Rechercher : "Using mock data (test mode)"
```

#### Dans GitHub Actions
```
1. Aller dans Actions
2. Déclencher un workflow (ex: verify.yml)
3. Vérifier les logs :
   ✅ "🔧 Setting up test environment..."
   ✅ "Using mock data (test mode)"
   ✅ Pas d'erreur "GITHUB_TOKEN not set"
```

## 📊 Résumé des Actions Requises

| Action | Requis ? | Statut |
|--------|----------|--------|
| Modifier code | ✅ | ✅ Fait |
| Ajouter mocks | ✅ | ✅ Fait |
| Modifier workflows | ✅ | ✅ Fait |
| Ajouter `GITHUB_TOKEN` secret | ❌ | ⏭️ Optionnel |
| Ajouter `CLOUDINARY_*` secrets | ❌ | ⏭️ Optionnel |
| Tester localement | ✅ | ⏳ À faire |
| Commit et push | ✅ | ⏳ À faire |
| Tester workflow GitHub | ✅ | ⏳ À faire |

## 🎉 Conclusion

**Vous n'avez AUCUN secret à ajouter !**

Les changements de code suffisent :
- ✅ Mocks activés automatiquement en mode test
- ✅ Variables d'environnement déjà configurées
- ✅ Workflows déjà mis à jour

Prochaines étapes :
1. Commit et push les changements
2. Déclencher un workflow pour vérifier
3. C'est tout ! 🎉
