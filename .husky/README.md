# Git Hooks

Ce dossier contient les Git hooks configurés avec [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

Le hook `pre-commit` s'exécute automatiquement **avant chaque commit** et effectue les vérifications suivantes :

1. **🔍 Lint** : Vérifie la qualité du code avec ESLint (`bun run lint`)
2. **📝 Type Check** : Vérifie les types TypeScript (`bun run type-check`)

### Comportement

- ✅ Si toutes les vérifications passent → Le commit est créé
- ❌ Si une vérification échoue → Le commit est **annulé** et vous devez corriger les erreurs

### Contourner le hook (⚠️ À utiliser avec précaution)

Si vous devez absolument contourner le hook (ex: commit WIP) :

```bash
git commit --no-verify -m "WIP: travail en cours"
```

**Note** : Cette pratique est déconseillée car elle peut introduire du code non validé dans l'historique.

### Installation

Le hook est automatiquement installé lors de `bun install` grâce au script `prepare` dans `package.json`.

Pour réinstaller manuellement :

```bash
bun run prepare
```
