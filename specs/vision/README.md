# ai-board Vision Documentation

Documentation complète de l'architecture et de la stratégie d'implémentation du projet ai-board.

## 📚 Documents Disponibles

### 1. [Overview](./overview.md) - Vue d'Ensemble
**Point d'entrée principal** - Lisez ceci en premier !

- Vision globale du projet
- Workflow détaillé (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP)
- Modes automatique vs manuel
- Architecture high-level
- Stratégie Git et commits
- Déploiement et auto-deployment

### 2. [MVP Quickstart](./mvp-quickstart.md) - Solution Rapide ⭐
**Approche recommandée pour le lancement**

- Architecture GitHub Actions (0€ infrastructure)
- Code complet (workflow YAML, API routes, webhooks)
- Schema Prisma mis à jour
- Guide de déploiement Vercel + Neon
- Setup dev local avec Docker
- **Temps de dev: 16-24h**
- **Coût: $0-30/mois**

### 3. [Architecture Target](./architecture-target.md) - Solution Scalable
**Migration future quand le besoin se fait sentir**

- Architecture Docker + Workers
- BullMQ + Redis + Fly.io
- WebSocket temps réel
- Monitoring complet
- **Temps de dev: 40-60h**
- **Coût: $20-50/mois**

### 4. [Feasibility Analysis](./feasibility.md) - Analyse de Faisabilité
**Guide de décision et comparaison**

- Comparaison détaillée MVP vs Target
- Analyse risques et complexité
- Breakdown des coûts
- Matrice de décision
- Plan de migration en 4 phases
- **Recommandation: MVP d'abord**

### 5. [Timeout Analysis](./timeout-analysis.md) - 🚨 Analyse Critique
**Point de vigilance important pour GitHub Actions**

- Limites GitHub Actions (6h max/job)
- Durées réelles spec-kit par commande
- Probabilités de timeout
- Stratégies de mitigation
- Triggers de migration
- **Verdict: MVP viable avec bonnes pratiques**

### 6. [Next Features](./next-features.md) - Roadmap Features
**Features futures après MVP**

- Priorité 1: Foundation (editing, deletion, indicators)
- Priorité 2: Spec Management (spec field, editor)
- Priorité 3: Board Experience (filtering, sorting)
- Priorité 4: GitHub Preparation (project model, URLs)
- Prompts `/specify` prêts à l'emploi

## 🚀 Par Où Commencer ?

### Pour Développeurs
1. ✅ Lire [Overview](./overview.md) - comprendre la vision
2. ✅ Lire [MVP Quickstart](./mvp-quickstart.md) - guide d'implémentation
3. ✅ Lire [Timeout Analysis](./timeout-analysis.md) - comprendre les limites
4. ✅ Implémenter le MVP
5. ⏳ Monitorer métriques
6. ⏳ Migrer vers Target si besoin

### Pour Product Managers
1. ✅ Lire [Overview](./overview.md) - workflow et vision
2. ✅ Lire [Feasibility Analysis](./feasibility.md) - ROI et décisions
3. ✅ Lire [Timeout Analysis](./timeout-analysis.md) - contraintes techniques
4. ✅ Prioriser [Next Features](./next-features.md) - roadmap

### Pour Architectes
1. ✅ Lire [Overview](./overview.md) - architecture globale
2. ✅ Comparer [MVP Quickstart](./mvp-quickstart.md) vs [Architecture Target](./architecture-target.md)
3. ✅ Analyser [Feasibility Analysis](./feasibility.md) - risques et migration
4. ✅ Évaluer [Timeout Analysis](./timeout-analysis.md) - contraintes critiques

## 📊 Recommandations Clés

### Phase 1: MVP (Semaines 1-4) ⭐ EN COURS
```
✅ GitHub Actions pour spec-kit execution
✅ Vercel + Neon (tiers gratuits)
✅ Workflow INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
✅ Modes auto/manuel
⏱️ Timeout configuré: 2h par job
💰 Coût: $0-30/mois
```

### Phase 2: Validation (Semaines 5-12)
```
📊 Monitorer métriques:
   - Volume de tickets/mois
   - Durée moyenne /implement
   - Taux de timeout
   - Feedback utilisateurs

🎯 Triggers de migration:
   - >500 tickets/mois OU
   - >30% jobs >60min OU
   - >5% timeouts
```

### Phase 3: Migration Target (Semaines 13-22, si besoin)
```
🚀 Si triggers atteints:
   - Build Docker + Workers
   - Deploy Fly.io + Redis
   - Parallel run (10% traffic)
   - Gradual migration
   - Full cutover
```

## ⚠️ Points de Vigilance

### Timeouts GitHub Actions
- **Limite stricte**: 6h par job
- **Configuration**: 2h recommandé
- **Risque**: 10-20% des `/implement` dépassent 1h
- **Solution**: Découpage tickets complexes
- **Fallback**: Self-hosted runner ou migration Target

### Quotas GitHub Actions
- **Free tier**: 2000 min/mois
- **Capacité réaliste**: 100-200 tickets/mois (workload mixte)
- **Upgrade**: GitHub Team $4/user/mois (+3000 min)

### Latence Utilisateur
- **MVP**: 20-40s par commande
- **Target**: 5-10s par commande
- **Impact**: Acceptable pour MVP, amélioration avec Target

## 🔗 Liens Utiles

### Documentation Externe
- [spec-kit GitHub](https://github.com/github/spec-kit) - Outil de spécification AI
- [Claude Code CLI](https://github.com/anthropics/claude-code) - Interface Claude Code
- [GitHub Actions Limits](https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration) - Limites officielles
- [Vercel Deployment](https://vercel.com/docs) - Guide déploiement
- [Fly.io Machines](https://fly.io/docs/machines/) - Workers Docker

### Ressources Internes
- `/specs/001-initialize-the-ai/` - Premier ticket implémenté
- `/specs/002-create-a-basic/` - Board basique
- `/specs/003-add-new-ticket/` - Création tickets
- `/specs/004-add-drag-and/` - Drag and drop
- `/specs/005-add-ticket-detail/` - Détail modal

## 📝 Notes de Mise à Jour

**Dernière mise à jour**: 2025-10-02

**Changements récents**:
- ✅ Ajout analyse timeout GitHub Actions
- ✅ Mise à jour triggers migration (volume + performance)
- ✅ Documentation complète MVP vs Target
- ✅ Stratégies de mitigation timeout
- ✅ Métriques de monitoring ajoutées

**Prochaines étapes**:
- [ ] Implémenter colonne SPECIFY
- [ ] Créer workflow GitHub Actions
- [ ] Ajouter monitoring durée jobs
- [ ] Tester end-to-end localement
- [ ] Déployer MVP sur Vercel
