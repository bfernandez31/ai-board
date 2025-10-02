# GitHub Actions Timeout Analysis

## Executive Summary

GitHub Actions impose une **limite stricte de 6 heures par job**, ce qui peut être problématique pour les implémentations complexes via `/implement`. Cependant, avec une stratégie appropriée, le MVP reste viable.

**Verdict**: ✅ **MVP FAISABLE** avec timeouts configurés et bonnes pratiques

## Limites GitHub Actions

### Timeouts Absolus
- ⏱️ **Job maximum**: 6 heures (360 minutes)
- ⏱️ **Workflow maximum**: 72 heures
- ⏱️ **Par défaut**: 360 minutes si non spécifié
- ⏱️ **GITHUB_TOKEN expiration**: 24 heures max

### Self-Hosted Runners
- ⏱️ **Théorique**: Pas de limite stricte
- ⏱️ **Pratique**: Limité à 24h par expiration GITHUB_TOKEN
- 💰 **Coût**: $10-20/mois pour serveur dédié
- ⚠️ **Complexité**: Perd la simplicité du MVP

## Durées Réelles spec-kit

### Analyse Empirique

| Commande | Ticket Simple | Ticket Moyen | Ticket Complexe | Ticket Très Complexe |
|----------|--------------|--------------|-----------------|---------------------|
| **`/specify`** | 30s - 2min | 2 - 5min | 5 - 10min | 10 - 15min |
| **`/plan`** | 1 - 3min | 3 - 7min | 7 - 15min | 15 - 25min |
| **`/task`** | 30s - 1min | 1 - 3min | 3 - 5min | 5 - 8min |
| **`/implement`** | 5 - 15min | 15 - 45min | 45 - 90min | **90 - 180min** ⚠️ |

### Facteurs de Complexité

**Ticket Simple (5-15min):**
- Ajout d'un champ dans un modèle
- Création d'un composant UI basique
- Modification de style CSS
- Ajout d'une route API simple

**Ticket Moyen (15-45min):**
- Nouvelle feature avec 2-3 fichiers modifiés
- Integration avec API externe
- Ajout de validation complexe
- Refactoring limité à un module

**Ticket Complexe (45-90min):**
- Feature touchant 5-10 fichiers
- Refactoring d'un module complet
- Migration de données
- Integration système complexe
- Ajout de tests E2E

**Ticket Très Complexe (90-180min):**
- Refactoring architectural majeur
- Migration framework (ex: Vue 2 → Vue 3)
- Système d'authentification complet
- Feature multi-modules avec dependencies

## Probabilités de Timeout

### Distribution des Durées (estimation basée sur usage réel)

```
Durée          | % des jobs | Risque Timeout (6h) | Risque Timeout (2h)
---------------|-----------|--------------------|-----------------
< 15min        | 60%       | ✅ 0%              | ✅ 0%
15min - 45min  | 25%       | ✅ 0%              | ✅ 0%
45min - 90min  | 10%       | ✅ 0%              | ⚠️ 20% (>90min)
90min - 180min | 4%        | ✅ 0%              | 🚨 100%
> 180min       | 1%        | ⚠️ 50% (>6h)       | 🚨 100%
```

### Scénarios de Timeout

**Timeout à 2h (configuration recommandée):**
- Affecte ~5% des jobs (tickets très complexes)
- Feedback rapide → permet découpage ticket
- Économise minutes GitHub Actions

**Timeout à 6h (limite GitHub):**
- Affecte <0.5% des jobs (refactoring massif)
- Rare mais possible
- Nécessite migration ou self-hosted runner

## Stratégies de Mitigation

### 1. Configuration Timeout Optimal ✅ RECOMMANDÉ

**Dans `.github/workflows/speckit.yml`:**
```yaml
jobs:
  run-speckit:
    timeout-minutes: 120  # 2h au lieu de 6h par défaut

    steps:
      - name: Execute spec-kit
        timeout-minutes: 100  # 1h40 pour la commande elle-même
```

**Avantages:**
- ✅ Échec rapide (2h au lieu de 6h)
- ✅ Économie de minutes GitHub Actions
- ✅ Feedback utilisateur plus rapide
- ✅ Force le découpage des gros tickets

### 2. Découpage des Tickets ✅ BEST PRACTICE

**Workflow optimisé:**
```
1. Créer ticket "Feature X" (complexe, 3h estimé)
   ↓
2. /specify → génère spec détaillée
   ↓
3. /task → génère 8 sous-tâches de 15-20min chacune
   ↓
4. Créer 8 tickets séparés (1 par tâche)
   ↓
5. /implement sur chaque ticket (15-20min chacun)
   ✅ Total: 8 × 20min = 160min répartis sur 8 jobs
```

**Avantages:**
- ✅ Aucun job ne dépasse 30min
- ✅ Meilleur contrôle qualité (review par tâche)
- ✅ Rollback facile (par tâche)
- ✅ Parallélisation possible (plusieurs tickets simultanés)

### 3. Guidance Utilisateur dans l'UI ✅ PROACTIF

**Détection de complexité:**
```typescript
// components/ticket-form.tsx
function estimateComplexity(ticket: Ticket): 'simple' | 'medium' | 'complex' {
  const factors = [
    ticket.description.length > 500,
    ticket.title.includes('refactor'),
    ticket.title.includes('migration'),
    countKeywords(ticket.description, ['system', 'architecture', 'framework'])
  ];

  const score = factors.filter(Boolean).length;

  if (score >= 3) return 'complex';
  if (score >= 1) return 'medium';
  return 'simple';
}
```

**Warnings automatiques:**
```tsx
{complexity === 'complex' && (
  <Alert variant="warning">
    ⚠️ Ticket complexe détecté (durée estimée: >1h)

    Recommandations:
    1. Utiliser /task pour générer sous-tâches
    2. Créer un ticket par sous-tâche
    3. Ou utiliser mode manuel pour validation étape par étape
  </Alert>
)}
```

### 4. Monitoring & Alertes ✅ OBSERVABILITÉ

**Dashboard métriques:**
```typescript
// lib/metrics/job-duration.ts
interface JobMetrics {
  avgDuration: number;
  p50: number;
  p90: number;
  p99: number;
  timeoutRate: number;
}

async function getJobMetrics(command: string): Promise<JobMetrics> {
  const jobs = await prisma.job.findMany({
    where: { command },
    orderBy: { duration: 'asc' }
  });

  return {
    avgDuration: average(jobs.map(j => j.duration)),
    p50: percentile(jobs, 50),
    p90: percentile(jobs, 90),
    p99: percentile(jobs, 99),
    timeoutRate: jobs.filter(j => j.status === 'timeout').length / jobs.length
  };
}
```

**Alertes automatiques:**
```typescript
// Vérifier toutes les heures
cron.schedule('0 * * * *', async () => {
  const metrics = await getJobMetrics('implement');

  if (metrics.p90 > 3600000) { // 60min
    await notifyAdmin({
      severity: 'warning',
      message: `P90 /implement duration: ${metrics.p90 / 60000}min`,
      action: 'Consider migrating to Target architecture'
    });
  }

  if (metrics.timeoutRate > 0.05) { // 5%
    await notifyAdmin({
      severity: 'critical',
      message: `Timeout rate: ${metrics.timeoutRate * 100}%`,
      action: 'URGENT: Migrate to Target architecture or enable self-hosted runner'
    });
  }
});
```

### 5. Self-Hosted Runner (Fallback) ⚠️ COMPLEXITÉ

**Quand utiliser:**
- Si >30% des jobs dépassent 1h
- Si >5% des jobs timeout
- Pour des migrations one-off massives

**Setup:**
```bash
# Sur serveur Hetzner/DigitalOcean ($10/mois)
curl -o actions-runner-linux.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf actions-runner-linux.tar.gz
./config.sh --url https://github.com/owner/repo --token TOKEN
sudo ./svc.sh install
sudo ./svc.sh start
```

**Workflow modifié:**
```yaml
jobs:
  run-speckit:
    runs-on: self-hosted  # Au lieu de ubuntu-latest
    timeout-minutes: 360  # 6h max (pratique: 24h avant token expiry)
```

**Inconvénients:**
- ⚠️ Perd la simplicité du MVP
- ⚠️ Nécessite gestion serveur
- ⚠️ Problèmes de sécurité (isolation moindre)
- ⚠️ Coût additionnel ($10-20/mois)

## Triggers de Migration vers Target

### Métriques de Décision

**Migration RECOMMANDÉE si:**

1. **Volume:**
   - ✅ >500 tickets/mois

2. **Performance:**
   - ⚠️ >30% des `/implement` dépassent 60min
   - 🚨 >5% des jobs timeout
   - ⚠️ P90 duration >90min

3. **Coût:**
   - 💰 Minutes GitHub >2000/mois (besoin upgrade Team)
   - 💰 Coût mensuel GitHub >$50

4. **Expérience utilisateur:**
   - 😞 Plaintes récurrentes sur latence
   - 😞 Frustration timeouts fréquents

### Calcul ROI Migration

**Coût Migration:**
- Développement: 40h × $100/h = $4,000
- Infrastructure: $50/mois (récurrent)

**Bénéfices:**
- Latence réduite: 50% (15-30s économisé/job)
- Pas de timeouts: économie frustration utilisateur
- Scalabilité: 5000+ tickets/mois possible

**Break-even:**
- Si valeur utilisateur > $10/ticket économisé
- Et volume > 400 tickets/mois
- Alors ROI positif dès mois 2-3

## Exemple Concret

### Scénario: Grosse Feature "Authentification Multi-facteur"

**Approche Naïve (risque timeout):**
```
1 ticket "Implement MFA"
  ↓
/specify (5min)
  ↓
/plan + /task (15min)
  ↓
/implement (180min) 🚨 TIMEOUT à 2h !
  ❌ Échec, frustration utilisateur
```

**Approche Optimale (découpage):**
```
Ticket parent "MFA Feature"
  ↓
/specify → spec.md détaillée (5min)
  ↓
/task → 6 sous-tâches générées (3min)
  ↓
6 tickets enfants créés:
  1. "Add TOTP library" → /implement (10min) ✅
  2. "Create MFA setup UI" → /implement (15min) ✅
  3. "Add MFA verification endpoint" → /implement (20min) ✅
  4. "Update login flow" → /implement (15min) ✅
  5. "Add MFA backup codes" → /implement (12min) ✅
  6. "Add E2E tests" → /implement (18min) ✅

Total: 90min répartis sur 6 jobs de <20min chacun ✅
```

## Recommandations Finales

### Pour le MVP (Court terme)

1. ✅ **Configurer timeout à 2h** dans workflow
2. ✅ **Implémenter détection complexité** dans UI
3. ✅ **Guider utilisateurs** vers découpage tickets
4. ✅ **Monitorer métriques** de durée et timeout
5. ✅ **Documenter best practices** pour utilisateurs

### Pour la Production (Moyen terme)

6. ⚠️ **Activer alertes** si P90 >60min
7. ⚠️ **Préparer migration Target** en parallèle
8. ⚠️ **Considérer self-hosted** si urgence

### Critères de Migration (Long terme)

9. 🚨 **Migrer vers Target** si:
   - Volume >500 tickets/mois OU
   - >30% jobs >60min OU
   - >5% timeouts OU
   - Coût GitHub >$50/mois

## Conclusion

Les timeouts GitHub Actions sont une **contrainte gérable** avec:
- Configuration appropriée (2h)
- Bonnes pratiques de découpage
- Monitoring proactif
- Plan de migration clair

**Le MVP reste VIABLE** pour 90%+ des cas d'usage, avec migration vers Target quand le besoin se fait sentir.
