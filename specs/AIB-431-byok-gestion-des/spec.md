# Feature Specification: BYOK - gestion des cles API utilisateur pour les agents AI

**Feature Branch**: `AIB-431-byok-gestion-des`  
**Created**: 2026-03-31  
**Status**: Draft  
**Input**: Ticket AIB-431 - Permettre a chaque utilisateur de gerer ses credentials AI par provider et d'imposer l'usage de la cle du owner du projet pour tous les workflows AI

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Une seule credentiel active est conservee par provider et par utilisateur, quel que soit son type; enregistrer une nouvelle credentiel remplace l'ancienne pour les prochains workflows.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score +7) - Feature expose des secrets utilisateurs, touche l'authentification des workflows et reste user-facing, sans signaux contradictoires
- **Fallback Triggered?**: No - AUTO a resolu proprement vers CONSERVATIVE avec forte confiance
- **Trade-offs**:
  1. Ce modele simplifie la comprehension pour l'utilisateur et reduit le risque d'utiliser une mauvaise credentiel
  2. Les utilisateurs ne peuvent pas conserver plusieurs credentiels Anthropic en parallele pour des usages differents
- **Reviewer Notes**: Verifier que le produit assume bien un mode "une credentiel Anthropic active" plutot qu'un portefeuille de credentiels

---

- **Decision**: Tous les workflows AI utilisent exclusivement la credentiel du owner du projet; un membre peut lancer un workflow, mais ne peut ni substituer sa propre credentiel ni contourner l'absence de credentiel du owner.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score +7) - Decision de facturation et de securite, avec risque de confusion important dans les projets multi-membres
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Le modele de responsabilite et de cout reste clair pour chaque projet
  2. Les equipes doivent s'organiser autour de la credentiel du owner, ce qui limite la flexibilite a court terme
- **Reviewer Notes**: Verifier que ce comportement reste acceptable pour les offres TEAM avant d'etendre le modele a des credentiels par membre

---

- **Decision**: Si la credentiel du owner est absente, invalide, inaccessible, expiree ou impossible a recuperer au moment du lancement, le workflow est bloque ou s'arrete avant toute execution AI et affiche un message de remediation explicite.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score +7) - Echec ferme requis pour eviter l'usage non autorise de secrets partages et pour proteger les couts
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Certains lancements echoueront plus tot au lieu de tenter une execution de secours
  2. L'utilisateur recoit une cause actionnable plutot qu'un echec tardif et ambigu
- **Reviewer Notes**: Verifier que les messages de blocage couvrent bien les cas "aucune credentiel", "credentiel invalide" et "validation impossible"

---

- **Decision**: Le test de credentiel confirme la validite du format pendant la saisie puis l'acceptation cote serveur avant activation; apres enregistrement, seule une vue masquee et un statut de disponibilite restent visibles.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE)
- **Confidence**: High (score +7) - La combinaison UX + protection du secret correspond a un besoin de confiance utilisateur sans re-exposer la valeur sensible
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Le parcours est plus rassurant et diminue les echecs de lancement
  2. Le secret complet n'est plus recuperable apres saisie, ce qui impose a l'utilisateur de conserver sa propre source de verite
- **Reviewer Notes**: Verifier que le produit assume bien qu'aucune revele du secret complet n'est possible apres la sauvegarde initiale

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurer une credentiel Anthropic utilisable (Priority: P1)

Un utilisateur veut activer le mode BYOK dans ses reglages personnels afin que ses projets puissent lancer des workflows AI avec sa propre credentiel Anthropic. Il choisit le type de credentiel, ajoute un label, saisit la valeur, verifie qu'elle est valide et enregistre une configuration prete a l'emploi.

**Why this priority**: Sans credentiel utilisateur valide, aucun workflow AI ne peut fonctionner dans le modele BYOK. C'est la capacite fondatrice de la fonctionnalite.

**Independent Test**: Peut etre teste de bout en bout en configurant une credentiel Anthropic depuis les settings, en obtenant un statut de validation positif et en verifiant qu'elle apparait ensuite de facon masquee.

**Acceptance Scenarios**:

1. **Given** un utilisateur connecte sans credentiel Anthropic, **When** il ouvre ses settings et saisit une nouvelle credentiel avec un label et un type, **Then** le systeme verifie le format en temps reel et l'autorise a soumettre uniquement si l'entree est coherent
2. **Given** une credentiel correctement soumise, **When** la verification serveur confirme qu'elle est utilisable, **Then** la credentiel est activee pour l'utilisateur et reaffichee uniquement sous forme masquee avec son label, son type et son statut
3. **Given** une credentiel invalide ou refusee par le provider, **When** l'utilisateur tente de l'enregistrer, **Then** la configuration n'est pas activee et un message explicite indique quoi corriger

---

### User Story 2 - Lancer un workflow avec la credentiel du owner (Priority: P1)

Un owner de projet, ou un membre autorise de son projet, veut lancer un workflow AI en sachant que le cout et l'autorisation d'usage reposent toujours sur la credentiel AI du owner du projet. Le lancement doit reussir seulement si cette credentiel est disponible et exploitable au moment du depart.

**Why this priority**: Le besoin metier central est de faire porter les couts AI au bon utilisateur tout en supprimant la dependance aux secrets partages de la plateforme.

**Independent Test**: Peut etre teste en lancant un workflow sur un projet avec une credentiel owner valide, puis sur un projet sans credentiel owner valide, et en comparant le comportement obtenu.

**Acceptance Scenarios**:

1. **Given** un projet dont le owner dispose d'une credentiel valide, **When** un workflow AI est lance depuis ce projet, **Then** le workflow recupere la credentiel du owner via un canal reserve aux workflows et demarre avec le mode d'authentification adapte au type de credentiel
2. **Given** un membre non-owner lance un workflow sur un projet, **When** le lancement est prepare, **Then** le systeme utilise quand meme la credentiel du owner du projet et jamais celle du membre
3. **Given** un projet dont le owner n'a aucune credentiel utilisable, **When** un workflow AI est lance, **Then** le lancement est bloque avant execution AI et l'utilisateur voit un message indiquant comment rendre le projet eligible

---

### User Story 3 - Gerer le cycle de vie de la credentiel sans re-exposer le secret (Priority: P2)

Un utilisateur veut remplacer une credentiel devenue obsolete, supprimer une credentiel qu'il ne souhaite plus utiliser, ou verifier rapidement si sa configuration actuelle est encore operationnelle, sans jamais revoir la valeur complete du secret.

**Why this priority**: Cette capacite est importante pour la maintenance, la rotation de secret et le support, mais elle est secondaire par rapport au premier enregistrement et au lancement des workflows.

**Independent Test**: Peut etre teste en remplacant une credentiel existante, en verifiant que le prochain workflow utilise la nouvelle configuration, puis en supprimant la credentiel et en confirmant que les lancements suivants sont bloques.

**Acceptance Scenarios**:

1. **Given** une credentiel Anthropic active existe deja, **When** l'utilisateur enregistre une nouvelle credentiel du meme provider, **Then** la nouvelle configuration remplace l'ancienne pour les prochains workflows
2. **Given** une credentiel active est affichee dans les settings, **When** l'utilisateur consulte cette page plus tard, **Then** il ne voit jamais la valeur complete mais seulement les informations d'identification masquees et le statut de disponibilite
3. **Given** une credentiel active, **When** l'utilisateur la supprime, **Then** elle n'est plus utilisable et tout nouveau workflow dependant de cette credentiel est bloque avec un message explicite

---

### Edge Cases

- Que se passe-t-il si l'utilisateur change de type de credentiel pour Anthropic, par exemple en passant d'une API key a un OAuth token ? La nouvelle credentiel remplace integralement l'ancienne et devient l'unique configuration active pour ce provider
- Que se passe-t-il si le provider est temporairement indisponible pendant le test ou l'enregistrement ? La credentiel n'est pas activee tant que sa validite n'a pas pu etre confirmee, et l'utilisateur recoit un message l'invitant a reessayer
- Comment le systeme reagit-il si un membre lance un workflow alors que le owner n'a pas configure de credentiel ? Le lancement est refuse avec une explication claire indiquant que le owner doit configurer une credentiel AI
- Que se passe-t-il si une credentiel est supprimee ou remplacee pendant qu'un workflow est en file d'attente ? Tout workflow qui n'a pas encore recupere de credentiel doit appliquer l'etat le plus recent; un workflow ayant deja recupere la credentiel continue ou echoue de facon sure sans divulgation du secret
- Que se passe-t-il apres un transfert de propriete du projet ? Les workflows suivants se basent sur la credentiel du nouveau owner et restent bloques tant que celui-ci n'en a pas configure une utilisable

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow each authenticated user to configure one active AI credential per supported provider in their personal settings
- **FR-002**: System MUST support both standard API-key credentials and OAuth-style credentials for Anthropic at launch
- **FR-003**: System MUST require a user-provided label so the configured credential can be identified later without showing the full secret
- **FR-004**: System MUST validate credential format while the user is entering it and MUST prevent activation when the submitted value does not meet the expected format for the selected type
- **FR-005**: System MUST confirm server-side that a submitted credential is usable before marking it as active for workflow launches
- **FR-006**: System MUST show stored credentials only in masked form after initial submission, exposing at most the final four characters alongside non-sensitive metadata such as label, type, provider, and readiness status
- **FR-007**: System MUST allow a user to replace or delete their active credential for a provider at any time
- **FR-008**: System MUST ensure that saving a new credential for a provider immediately supersedes the prior one for all future workflow launches
- **FR-009**: System MUST protect credential values so they are never shown again in clear text after submission and are never exposed in standard user-facing views, logs, or workflow inputs
- **FR-010**: System MUST use the project owner's active credential as the sole source of AI authorization for workflows launched from that project, regardless of which authorized member initiated the launch
- **FR-011**: System MUST retrieve the project owner's credential through a workflow-only secure retrieval step at launch time rather than embedding the secret in user-visible launch payloads
- **FR-012**: System MUST map the owner's active credential type to the correct provider-specific authentication method expected by the AI tooling used by the workflow
- **FR-013**: System MUST block a workflow from starting AI execution when the project owner does not have a usable credential for the requested provider
- **FR-014**: System MUST present an explicit, actionable message when a workflow launch is blocked because the owner credential is missing, invalid, expired, or could not be verified
- **FR-015**: System MUST fail closed when secure credential retrieval cannot be completed, rather than falling back to any shared platform credential
- **FR-016**: System MUST keep the credential model extensible so additional providers can follow the same user experience and workflow authorization pattern without redefining the feature's ownership model
- **FR-017**: System MUST limit credential retrieval access to workflow-authenticated requests and MUST not make the owner's secret available to standard project members or browser clients after submission

### Key Entities *(include if feature involves data)*

- **User AI Credential**: Credential configuration owned by one user for one provider, including a label, provider, credential type, masked preview, readiness status, and the protected secret value
- **Credential Readiness Status**: Current state indicating whether a saved credential is usable for workflow launches, including the last verification outcome and whether user action is required
- **Project Ownership Context**: Association that determines which user's credential is authoritative for AI usage within a project, even when another member initiates the workflow
- **Workflow Credential Request**: Secure server-to-workflow exchange that authorizes a workflow to obtain the current owner credential only at launch time and only for the provider it needs

## Assumptions & Dependencies

- BYOK is mandatory for AI workflow usage in publicly available plans; there is no fallback to a shared platform credential
- The project owner is the billing-responsible party for AI usage generated by workflows on that project
- Anthropic is the only provider exposed in the initial release, but the feature model is intended to support additional providers later
- The AI provider offers a deterministic way to confirm whether a submitted credential is still usable at save time
- The workflow platform can authenticate itself to the application strongly enough to justify a workflow-only secret retrieval path

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users can add and validate an Anthropic credential from settings in under 2 minutes without support intervention
- **SC-002**: 100% of workflow launch attempts on projects without a usable owner credential are stopped before any AI task begins
- **SC-003**: At least 95% of workflow launches tied to a valid owner credential start successfully on the first attempt
- **SC-004**: In 100% of post-save settings views, users can identify their configured credential without seeing more than the final four characters of the secret
- **SC-005**: A credential replacement or deletion changes eligibility for the next workflow launch within 1 minute of the user action
- **SC-006**: At least 90% of blocked workflow launches present an actionable remediation message that lets the user resolve the issue without administrator assistance
