# Critères WCAG 2.2 (A et AA) qui comptent pour Klik&Go

WCAG 2.2 est une Recommandation W3C (version du 12 décembre 2024) `[W1]`. Elle ajoute neuf critères à WCAG 2.1 et retire 4.1.1 `[W2]`. Notre cible : tous les critères A et AA.

Lecture des tableaux :

- **◆** : critère relu dans sa fiche « Understanding » pendant la recherche (référence indiquée).
- Sans ◆ : numéro, nom et niveau repris de la Recommandation `[W1]` ; relire la fiche du critère avant un arbitrage fin.
- **Nouveau** : ajouté par WCAG 2.2 `[W2]`.
- **Contrôle** : `axe:<règle>` quand axe-core 4.11.1 a une règle, sinon « manuel » ou « test Playwright » (voir `tests-playwright-axe.md`).
- **Où regarder** : lignes du commit `161f920` ; plusieurs fichiers bougent depuis (audit §0).

## 1. Parcours de commande client (catalogue, panier, validation, suivi)

| Critère | Niv. | Ce qu'il exige chez nous | Où regarder | Contrôle |
|---|---|---|---|---|
| 1.1.1 Contenu non textuel | A | Image produit avec `alt` ; icône décorative `aria-hidden` ; émoji porteur de sens doublé d'un texte | `ProductCard`, `NotificationBell.tsx:119` (émoji lu) | `axe:image-alt`, manuel |
| 1.3.1 Information et relations | A | Étiquette reliée au champ ; `fieldset`/`legend` pour les groupes radio ; titres balisés | `panier/page.tsx:655-990` | `axe:label`, manuel |
| 1.3.5 Finalité de la saisie ◆ `[W1]` | AA | `autoComplete` exact sur email, prénom, nom, téléphone | Formulaire invité (déjà fait) | `axe:autocomplete-valid` |
| 1.4.1 Usage de la couleur | A | Créneau choisi, erreur, promo appliquée, statut : jamais la couleur seule | Créneaux `panier/page.tsx:754`, badges de statut | manuel |
| 1.4.3 Contraste minimum ◆ `[W10]` | AA | 4,5:1 ; 3:1 pour le grand texte (≥ 24 px, ou ≥ 18,5 px gras). Texte indicatif inclus. Pas d'arrondi | Tableau de l'audit §4 | `axe:color-contrast`, `contrast.mjs` |
| 1.4.4 Agrandissement du texte | AA | Lisible et utilisable à 200 % | Tout | manuel |
| 1.4.10 Redistribution ◆ `[W1]` | AA | Utilisable à 320 px de large sans défilement horizontal | Grille de créneaux, lignes du panier | manuel |
| 1.4.11 Contraste non textuel ◆ `[W11]` | AA | 3:1 pour l'anneau de focus stylé, l'état d'un interrupteur, une icône porteuse de sens, la bordure d'un champ si elle seule l'identifie | `switch.tsx`, champs du panier | `contrast.mjs` |
| 1.4.13 Contenu au survol ou au focus | AA | Pas d'information réservée à une infobulle `title` | `panier/page.tsx:596` | manuel |
| 2.1.1 Clavier | A | Tout se fait au clavier ; pas de `div onClick` | `ProductCard.tsx:173`, au moins 12 `div`/`span` avec `onClick` | manuel, lint |
| 2.1.2 Pas de piège clavier | A | On sort toujours d'un composant (Échap, Tab) | Dialogues | test Playwright |
| 2.2.1 Délai réglable ◆ `[W6]` | A | Toute limite de temps se désactive, se règle ou se prolonge. Est une limite de temps tout processus qui se déclenche sans action de l'utilisateur après un délai. Un message temporaire ne compte pas si l'information reste disponible ailleurs | `OrderCountdown.tsx` (5 s), toasts | manuel, arbitrage |
| 2.4.1 Contourner des blocs | A | Lien d'évitement | `layout.tsx:172` (fait) | test Playwright |
| 2.4.2 Titre de page | A | `title` unique et descriptif ; l'annonceur de route de Next le lit `[T8]` | `metadata` de chaque page | manuel |
| 2.4.3 Parcours du focus | A | Ordre logique ; le focus entre dans le dialogue et revient à l'ouvreur `[A2]` | Tous les dialogues (retour absent) | test Playwright |
| 2.4.4 Fonction du lien | A | Un lien a un nom qui dit où il mène | Lien retour `panier/page.tsx:415`, `:452` | `axe:link-name` |
| 2.4.6 En-têtes et étiquettes | AA | Libellés qui décrivent : « Supprimer Merguez du panier » | `panier/page.tsx:99-123` | manuel |
| 2.4.7 Focus visible | AA | Indicateur toujours visible | 17 lignes `outline-none` sans remplacement, dont l'interrupteur de `commandes/page.tsx:603` | manuel |
| 2.4.11 Focus non masqué ◆ `[W4]` **Nouveau** | AA | L'élément focalisé n'est jamais entièrement caché par un bandeau collant | Bouton collant du panier, barre du bas, `CartFAB`, bandeau de consentement | manuel |
| 2.5.3 Étiquette dans le nom ◆ `[W1]` | A | Le nom accessible contient le texte visible | Boutons avec texte et `aria-label` différents | manuel (`axe:label-content-name-mismatch` est expérimentale : elle ne tourne pas avec nos tags `[V9]`) |
| 2.5.7 Mouvements de glissement **Nouveau** `[W2]` | AA | Tout geste de glisser a une alternative au simple appui | Tri des produits par glisser-déposer (`boucher/produits/page.tsx:762`, `DndContext`) : prévoir des boutons monter et descendre. Les curseurs `type="range"` natifs restent utilisables au clic | manuel |
| 2.5.8 Taille de la cible ◆ `[W3]` **Nouveau** | AA | 24 × 24 px au moins, ou espacement équivalent. Règle maison : 44 px | Audit §3 P2 | `axe:target-size` (tag `wcag22aa`) |
| 3.1.1 Langue de la page | A | `lang="fr"` | `layout.tsx:152` (fait) | `axe:html-has-lang` |
| 3.2.2 À la saisie | A | Choisir une option ne déclenche pas un changement de contexte inattendu | Radios de retrait et de paiement | manuel |
| 3.2.6 Aide cohérente **Nouveau** `[W2]` | A | Le lien de contact ou d'aide garde la même place d'une page à l'autre | Pied de page (`/contact`) | manuel |
| 3.3.1 Identification des erreurs | A | L'erreur est décrite en texte et rattachée au champ | Formulaire invité, code promo | manuel |
| 3.3.2 Étiquettes ou instructions | A | Étiquette visible et persistante, pas un texte indicatif | `panier/page.tsx:655-699` | `axe:label`, manuel |
| 3.3.3 Suggestion après erreur | AA | Le message dit comment corriger | « Email invalide » → donner un exemple | manuel |
| 3.3.4 Prévention des erreurs (juridique, financier, données) | AA | Avant un engagement financier : vérifier, corriger ou annuler | Récapitulatif avant « Confirmer », paiement en ligne à venir | manuel |
| 3.3.7 Saisie redondante ◆ `[W12]` **Nouveau** | A | Ne pas redemander dans le même parcours ; garder la saisie après une erreur | Invité → paiement Stripe à venir | manuel |
| 3.3.8 Authentification accessible ◆ `[W13]` **Nouveau** | AA | Collage et gestionnaire de mots de passe jamais bloqués ; un chemin sans test cognitif | Composants Clerk : voir le skill `clerk-auth` | manuel |
| 4.1.2 Nom, rôle, valeur | A | Chaque contrôle expose nom, rôle, état | Boutons icône, interrupteurs, onglets | `axe:button-name`, `axe:nested-interactive`, test Playwright |
| 4.1.3 Messages d'état ◆ `[W5]` | AA | Total du panier, code appliqué, chargement des créneaux, erreurs : annoncés sans déplacer le focus | 2 régions live dans tout le code | test Playwright, manuel |

## 2. Tablette cuisine (`/boucher/commandes`)

| Critère | Niv. | Ce qu'il exige chez nous | Où regarder |
|---|---|---|---|
| 1.3.4 Orientation ◆ `[W1]` | AA | L'écran fonctionne en portrait et en paysage ; ne pas verrouiller l'orientation | Mise en page 3 colonnes / onglets |
| 1.4.2 Contrôle du son ◆ `[W9]` | A | La sonnerie (boucle de 5 s) se coupe par un contrôle nommé | `sounds.ts:279`, bouton son `commandes/page.tsx:657` |
| 1.4.3 Contraste ◆ `[W10]` | AA | Textes secondaires ≥ 4,5:1 sur `#0a0a0a` / `#111` : `gray-400` minimum | Textes `gray-500` à `gray-700`, `#57534E` |
| 1.4.1 Usage de la couleur | A | Retard, programmée, prête : libellé ou icône en plus de la couleur | `KitchenOrderCard`, compte à rebours coloré |
| 2.2.2 Mettre en pause, arrêter, masquer ◆ `[W7]` | A | Une animation de plus de 5 s à côté d'autre contenu s'arrête ou se masque. Un contenu mis à jour automatiquement doit pouvoir être mis en pause, arrêté ou masqué, sauf si la mise à jour est essentielle à l'activité : la liste des commandes d'un écran de cuisine relève a priori de cette exception, à confirmer lors d'un audit | `animate-pulse` infini, alerte ; sondage 5 s |
| 2.3.1 Trois flashs ◆ `[W8]` | A | Jamais plus de trois flashs par seconde | `flash-green`, `flash-red`, alerte |
| 2.4.3 Parcours du focus | A | L'alerte prend le focus ; à sa fermeture il va sur la commande concernée | `OrderAlertOverlay.tsx` |
| 2.5.8 Taille de la cible ◆ `[W3]` | AA | 44 px maison pour toute action ; viser plus grand pour Accepter, Refuser, Prête | En-tête (32 à 36 px), `KitchenOrderCard` |
| 4.1.2 Nom, rôle, valeur | A | Interrupteur « en ligne », son, mode simple, scanner : nom et état ; onglets `tablist` `[A5]` | `commandes/page.tsx:587-800` |
| 4.1.3 Messages d'état ◆ `[W5]` | AA | Nouvelle commande, perte de connexion, pause, action réussie : annoncés | Alerte, icône Wi-Fi, bandeau pause, toasts |

Le sondage qui réordonne les cartes ne doit jamais déplacer ni faire perdre le focus : conserver des `key` stables et ne pas démonter la carte focalisée.

## 3. Transversal

| Sujet | Règle | Source |
|---|---|---|
| ARIA | Préférer l'élément natif ; un rôle engage son comportement clavier | `[A1]` |
| Mobile | Le support d'ARIA par les lecteurs d'écran mobiles n'est pas garanti par l'APG : tester sur VoiceOver et TalkBack | `[A1]` |
| Mouvement | Retirer le mouvement non essentiel quand `prefers-reduced-motion: reduce` | `[T11]` |
| Zoom | Pas de `maximumScale` ni de `userScalable: false` dans `viewport` | `axe:meta-viewport` `[V1]` |
| Composants inactifs | Un contrôle désactivé est exempté de contraste, mais doit rester compréhensible | `[W10][W11]` |

## 4. Correspondance RGAA

Le RGAA 4.1.2 compte 106 critères en 13 thématiques : Images, Cadres, Couleurs, Multimédia, Tableaux, Liens, Scripts, Éléments obligatoires, Structuration de l'information, Présentation de l'information, Formulaires, Navigation, Consultation `[L5][L7]`. Il s'appuie sur la norme EN 301 549 et WCAG 2.1 A et AA `[L6]` ; les critères nouveaux de WCAG 2.2 n'y figurent donc pas.

axe-core étiquette 66 de ses 104 règles `RGAAv4` `[V1]` : `runAxe(page, { tags: ["RGAAv4"] })` donne un rapport lisible par un auditeur RGAA. Cela ne remplace pas un audit RGAA.
