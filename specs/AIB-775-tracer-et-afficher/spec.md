# Feature Specification: Tracer et afficher la version du plugin et de l'agent sur chaque job

**Feature Branch**: `AIB-775-tracer-et-afficher`
**Created**: 2026-05-08
**Status**: Draft
**Input**: AIB-775 — Track and display plugin version and agent CLI version per job in the job detail panel.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Plugin version captured = the canonical release identifier of the active AI-Board plugin bundle (commands + skills + prompts) at the moment the job starts. When no semantic version is available, fall back to the short commit SHA of the plugin source.
- **Policy Applied**: AUTO (recommendation: CONSERVATIVE; net signal score -1, low confidence → fallback)
- **Confidence**: Low (0.3) — neutral observability feature with no overriding domain signal
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE because confidence < 0.5
- **Trade-offs**:
  1. Storing both semver and SHA when available adds a small payload but guarantees uniqueness across pre-release plugin builds
  2. SHA fallback is less human-readable than a tag but never collides
- **Reviewer Notes**: Confirm where the plugin's canonical version lives (package metadata vs. git tag) so the capture step reads the right source.

- **Decision**: Agent CLI version is captured by reading the version reported by the CLI itself at job start (one identifier per agent: claude-code, codex, gemini-cli, mistral-vibe).
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Medium — direct alignment with acceptance criterion "all 4 agents covered"
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE
- **Trade-offs**:
  1. Capturing a string the CLI prints means we trust the CLI to be honest about its version, but no other authoritative source exists
  2. Capture must run quickly so it does not visibly slow job startup
- **Reviewer Notes**: Confirm each of the four agents exposes a stable "version" affordance and that calling it before the job body is safe.

- **Decision**: Version capture happens once, at job start (before the agent's productive work begins), and is persisted to the job record before the agent's first turn completes.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Medium — matches the user need ("active at the moment of the run")
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Capturing at start (not end) means a mid-run plugin upgrade would not be reflected, but jobs do not hot-swap the plugin so this is acceptable
  2. A pre-flight capture step adds a single metadata write before the first turn
- **Reviewer Notes**: Verify capture failure cannot block job startup or roll back the job creation.

- **Decision**: When either version is missing (legacy job or capture failure), the job detail panel displays the same discrete placeholder used for other unknown execution metadata (an em-dash "—") with an accessible tooltip "Non disponible".
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Medium — directly stated in acceptance criteria
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. A neutral placeholder avoids implying an error when the value is simply absent
  2. Tooltip adds an extra accessibility affordance at minimal layout cost
- **Reviewer Notes**: Reuse whatever placeholder convention already exists in the job detail panel for empty metric cells.

- **Decision**: Capture failure is logged at warning level (so operators can audit how often this happens) but the job continues and is persisted with the unknown value.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Medium — explicit in the acceptance criteria
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Warning logs add noise but enable trend monitoring of capture reliability
  2. Continuing the job preserves user value over a strict guarantee of complete metadata
- **Reviewer Notes**: Confirm the existing job log channel surfaces warnings without alerting.

- **Decision**: Visibility of the new metadata follows the same access rules as other job execution metadata (model, tokens, duration). No new gating.
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: High — versions are non-sensitive operational metadata
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Anyone allowed to see the job sees the versions
  2. Consistent with existing privacy posture of the panel
- **Reviewer Notes**: None.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspecter les versions actives sur un job récent (Priority: P1)

Un opérateur ouvre le panneau de détail d'un job qui vient de tourner pour comprendre pourquoi le ticket a frictionné. Il lit déjà le modèle, les tokens, la durée et le coût. Il voit maintenant, dans la même zone, la version exacte du plugin AI-Board et la version exacte de l'agent CLI utilisés pour ce run, ce qui lui permet de corréler le comportement observé avec la combinaison plugin/agent en place à ce moment-là.

**Why this priority**: C'est la valeur centrale de la feature. Sans cette information lisible dans l'UI, on doit aller en base pour répondre à la question "quelle version a tourné", ce qui rend impossible toute analyse rapide ou comparaison entre runs.

**Independent Test**: On peut le tester en lançant un nouveau job sur un ticket de test, puis en ouvrant son panneau de détail et en vérifiant que les deux versions apparaissent à côté des autres métriques d'exécution. Cela délivre seul la valeur principale ("savoir avec quelle stack ce job a tourné").

**Acceptance Scenarios**:

1. **Given** un nouveau job lancé après le déploiement de la feature, **When** un opérateur ouvre le panneau de détail de ce job, **Then** la version du plugin et la version de l'agent CLI sont visibles dans la zone des métriques d'exécution.
2. **Given** un nouveau job lancé avec l'agent Claude, **When** l'opérateur consulte les métadonnées du job, **Then** la version de plugin affichée est l'identifiant de release du plugin actif au démarrage du job.
3. **Given** un nouveau job lancé avec l'agent Claude, **When** l'opérateur consulte les métadonnées du job, **Then** la version d'agent CLI affichée est celle reportée par `claude-code` au démarrage du job.

---

### User Story 2 - Comprendre qu'une version est absente sans avoir l'impression d'un bug (Priority: P2)

Un opérateur ouvre un job antérieur à la feature, ou un job dont la capture a techniquement échoué. Plutôt qu'un champ vide, un texte "undefined", ou pire une erreur dans l'UI, il voit un placeholder discret au même emplacement, qui lui indique sans ambiguïté que la donnée n'existe pas pour ce job — pas que l'application est cassée.

**Why this priority**: Sans ce traitement, les jobs antérieurs ou les rares échecs de capture donneraient l'impression que la fonctionnalité est buggée, et perdraient la confiance que les opérateurs accordent au panneau de détail.

**Independent Test**: On peut le tester sur un job pré-feature (ou en simulant un échec de capture) et en vérifiant que le panneau de détail affiche un placeholder sobre, lisible, sans erreur, sans champ visiblement vide.

**Acceptance Scenarios**:

1. **Given** un job antérieur à la feature qui n'a pas de version stockée, **When** l'opérateur ouvre son panneau de détail, **Then** la zone affiche un placeholder discret (em-dash) au lieu de la version, et un tooltip indique "Non disponible".
2. **Given** un job dont la capture de version a échoué techniquement, **When** l'opérateur ouvre son panneau de détail, **Then** le panneau affiche le même placeholder que pour un job antérieur, sans message d'erreur ni champ vide.
3. **Given** un job où seule l'une des deux versions a été capturée, **When** l'opérateur ouvre son panneau, **Then** le champ capturé s'affiche normalement et l'autre montre le placeholder.

---

### User Story 3 - Tracer la version pour les futures analyses comparatives (Priority: P3)

Une équipe future veut bâtir des analyses comparatives entre runs (benchmark de régression, A/B, replay, counterfactuel). Pour que ces futurs travaux soient possibles, chaque job lancé après cette feature doit déjà avoir, dans sa donnée stockée, la version du plugin et la version de l'agent CLI utilisés. Cette feature ne livre pas l'analyse, mais garantit que la donnée d'entrée existe.

**Why this priority**: Valeur indirecte mais structurante. Sans cette donnée stockée systématiquement à partir de maintenant, toutes les futures features de comparaison devront commencer par la collecter, ce qui les bloquerait.

**Independent Test**: On peut le tester en lançant plusieurs jobs avec différents agents et en vérifiant en lecture (par l'UI ou par l'API du job) que chaque job possède bien les deux champs de version renseignés.

**Acceptance Scenarios**:

1. **Given** une série de jobs lancés sur les 4 agents supportés (Claude, Codex, Gemini, Mistral), **When** on consulte chacun de ces jobs après leur démarrage, **Then** chacun expose une version de plugin et une version d'agent CLI.
2. **Given** un job qui démarre puis termine normalement, **When** on consulte ses métadonnées, **Then** les versions sont présentes dès l'instant où le job a démarré (et pas seulement à la fin).

---

### Edge Cases

- **Capture impossible (CLI absent ou ne répond pas)** : le job continue sans bloquer, la version reste nulle, l'UI affiche le placeholder, et un avertissement est journalisé.
- **Plugin sans tag de version sémantique** : le système retombe sur l'identifiant secondaire (ex. SHA court) plutôt que de laisser la version vide.
- **Job ancien (pré-feature)** : aucun backfill, aucune migration de données ; l'UI affiche le placeholder.
- **Job en cours d'exécution** : les versions sont déjà visibles, puisqu'elles sont capturées au démarrage du job (avant la première interaction agent productive).
- **Job exécuté pendant un upgrade simultané du plugin** : la version capturée est celle active au démarrage du job ; un upgrade en milieu de run n'est pas reflété (cas non supporté car les jobs ne rechargent pas le plugin à chaud).
- **Format de version reportée par un CLI inconnu / non parsable** : la chaîne brute est stockée telle quelle pour préserver la traçabilité ; aucune validation stricte n'est appliquée côté capture.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT capturer la version du plugin AI-Board active au démarrage de chaque nouveau job, et la persister sur le job avant que celui-ci termine sa première étape productive.
- **FR-002**: Le système DOIT capturer la version de l'agent CLI utilisé (telle que reportée par le CLI lui-même) au démarrage de chaque nouveau job, et la persister sur le job de la même manière que la version du plugin.
- **FR-003**: La capture des versions DOIT fonctionner pour les quatre agents supportés (Claude, Codex, Gemini, Mistral).
- **FR-004**: Si la capture d'une ou des deux versions échoue pour une raison technique, le job DOIT continuer normalement, sans interruption ni statut d'erreur lié à la capture, et la donnée manquante DOIT rester nulle pour ce job.
- **FR-005**: Le panneau de détail d'un job DOIT afficher la version du plugin et la version de l'agent CLI dans la même zone que les autres métriques d'exécution (modèle, tokens, durée, coût, contexte par turn).
- **FR-006**: Lorsqu'une des deux versions est absente sur un job (job antérieur à la feature ou échec de capture), l'UI DOIT afficher un placeholder discret à la place, et NE DOIT PAS afficher d'erreur, de champ vide brut, ni de mention "undefined".
- **FR-007**: L'affichage des deux versions DOIT être compact et cohérent visuellement avec les badges/labels des autres métriques d'exécution déjà présents dans la zone.
- **FR-008**: Le système NE DOIT PAS effectuer de backfill rétroactif sur les jobs existants ; les jobs antérieurs à la feature peuvent rester sans cette donnée et seront affichés avec le placeholder.
- **FR-009**: Les versions stockées sur un job NE DOIVENT PAS changer après le démarrage du job (capturé une fois, immuable pour la durée de vie du job).
- **FR-010**: Un échec de capture DOIT générer un avertissement journalisé identifiant le job concerné, sans déclencher d'alerte ni faire échouer le job.
- **FR-011**: La visibilité des versions DOIT suivre les mêmes règles d'accès que les autres métadonnées d'exécution du même panneau (pas de gating supplémentaire).

### Key Entities

- **Job (existant)** : entité d'exécution représentant un run d'agent sur un ticket. Acquiert deux nouveaux attributs de métadonnées d'exécution : la version du plugin AI-Board active au démarrage du job, et la version de l'agent CLI utilisé. Les deux attributs sont optionnels (nullables) afin que les jobs antérieurs à la feature ou les jobs où la capture a échoué restent valides. Une fois écrits, ils ne sont plus modifiés pour la durée de vie du job.

### Internal Processes

- **Capture des versions au démarrage du job** : autonome, déclenchée par le passage d'un job à l'état "en exécution".
  - **Input** : identité du job, identité de l'agent CLI assigné au job, état courant du plugin AI-Board sur l'environnement d'exécution.
  - **Phases** :
    1. Avant la première interaction productive avec l'agent, le runtime résout l'identifiant de version du plugin actif (release sémantique si disponible, sinon SHA court de la source du plugin).
    2. Le runtime interroge le CLI de l'agent assigné pour récupérer la chaîne de version qu'il rapporte.
    3. Les deux valeurs (l'une ou les deux pouvant être nulles si la capture a partiellement échoué) sont écrites sur le job.
  - **Output** : deux champs de version persistés sur le job ; en cas d'échec partiel, l'un des deux peut rester nul.
  - **Error behavior** : aucune des deux étapes ne fait échouer le job ; chaque échec individuel est journalisé en avertissement avec l'identifiant du job, et le runtime poursuit avec une valeur nulle pour le champ concerné. La capture n'est pas réessayée plus tard sur le même job (la donnée est figée au démarrage).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des jobs démarrés après le déploiement de la feature sur un environnement de référence ont au moins l'un des deux champs de version renseignés (plugin ou CLI), à l'exception des cas explicites d'échec de capture journalisés.
- **SC-002**: Au moins 95 % des jobs démarrés après le déploiement de la feature ont les deux champs de version renseignés, sur les quatre agents supportés cumulés.
- **SC-003**: Sur le panneau de détail d'un job, un opérateur peut identifier visuellement les deux versions en moins de 5 secondes (intégration cohérente avec les autres badges d'exécution).
- **SC-004**: Pour 100 % des jobs antérieurs à la feature consultés via l'UI, l'utilisateur voit un placeholder discret aux emplacements concernés, et n'observe ni champ vide brut, ni erreur, ni mention "undefined".
- **SC-005**: La capture des versions ajoute moins de 1 seconde au démarrage perçu d'un job (mesuré entre passage en "en exécution" et début de la première interaction agent productive).
- **SC-006**: Les jobs où la capture échoue et qui se terminent malgré tout normalement représentent un cas isolé, traçable via les avertissements journalisés et corrélable au job concerné en moins de 2 minutes par un opérateur.
