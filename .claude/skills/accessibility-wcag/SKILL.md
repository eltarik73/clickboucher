---
name: accessibility-wcag
description: Accessibilité WCAG 2.2 AA de Klik&Go, côté commande client et tablette cuisine boucher. À charger avant de créer ou modifier un composant interactif (modale, tiroir, onglets, interrupteur, toast, formulaire, bouton icône, carte cliquable, alerte sonore ou animée), avant de choisir une couleur de texte ou une taille de cible, et pour écrire ou relire un test d'accessibilité axe-core ou Playwright. Couvre clavier et focus, noms et rôles ARIA, messages d'état aria-live, contraste, cibles tactiles, mouvement réduit, son, RGAA et directive européenne d'accessibilité, avec l'audit du code au commit 161f920. Mots-clés - accessibilité, a11y, WCAG, RGAA, ARIA, lecteur d'écran, VoiceOver, TalkBack, focus, clavier, contraste, aria-label, aria-live, role dialog, prefers-reduced-motion, axe.
---

# Accessibilité WCAG 2.2 AA — Klik&Go

Cible : **WCAG 2.2 niveaux A et AA** sur tout écran client et boucher. Deux publics : le client qui commande au téléphone, parfois avec un lecteur d'écran, un zoom ou une seule main ; le boucher devant une tablette, mains occupées, dans le bruit.

Les identifiants `[W3]`, `[A2]`, `[V1]`… renvoient à [references/sources.md](references/sources.md). Ce skill ne redéfinit ni les jetons de design (`design-klikgo`), ni les parcours (`click-and-collect`, `ux-marketplace`), ni la stratégie de test (`testing-strategy`), ni le droit (`conformite-france`) : il y renvoie. Au 2026-11-14, `conformite-france` et `architecture-conventions` ne sont pas encore écrits et `testing-strategy` n'a que ses gabarits : en leur absence, s'en tenir à ce skill et à CLAUDE.md, et porter la question à l'owner.

## Méthode

1. Avant de toucher un fichier, lire ses lignes dans [references/audit-code-2026-11.md](references/audit-code-2026-11.md). Les numéros de ligne sont ceux du commit `161f920` (`git show 161f920:<chemin>` les retrouve). Le chantier « prix et commandes », non commité au 2026-11-14, réécrit `panier/page.tsx` (1 096 → 824 lignes) et décale `commandes/page.tsx`, `ProductCard.tsx`, `OrderCountdown.tsx` : dans ces fichiers, chercher le motif donné par l'audit §0, pas la ligne, avant de conclure qu'un défaut a disparu.
2. Choisir le patron dans [references/patterns-composants.md](references/patterns-composants.md). Tous compilent avec nos versions installées. À créer à leur premier usage, depuis leur patron : `LiveRegion` et `Field` dans `src/components/ui/`, `KitchenTabs` dans `src/components/boucher/`. La confirmation destructive est une évolution de `ui/ConfirmDialog.tsx` (patron §4), pas un nouveau composant.
3. Coder, puis vérifier selon la « Définition de terminé » ci-dessous.
4. Dans le même commit : rayer le défaut dans l'audit et retirer la règle de la liste `KNOWN` de `tests/e2e/a11y.spec.ts`. Ce fichier n'existe pas encore : le premier chantier le crée d'après [references/tests-playwright-axe.md](references/tests-playwright-axe.md) §3 et §4.

## État du code (commit `161f920`, détail dans l'audit)

| Mesure | Valeur |
|---|---|
| Fichiers avec une superposition écrite à la main (`fixed inset-0`, sans Radix) | 27 |
| Fichiers qui consomment `ui/dialog`, `ui/sheet` ou `ConfirmDialog` | 7, dont 2 sans appelant ; `ui/sheet` : 0 |
| Dialogues Radix qui rendent le focus à leur bouton d'ouverture | 0 |
| Régions live (`aria-live`, `role="status"`, `role="alert"`) | 2 |
| `htmlFor` pour 256 champs | 1 |
| Fichiers qui respectent `prefers-reduced-motion` | 1 |
| `focus:outline-none` | 74 |
| Systèmes de toast | 3, dont 2 muets pour un lecteur d'écran |
| Violations axe en production (boutique, thème sombre) | 49 contrastes, 40 éléments interactifs imbriqués |

Les fichiers d'interface sont identiques entre `161f920` et `32c581f` ; l'arbre de travail, lui, a déjà bougé (6 régions live, 72 `focus:outline-none` : audit §0). Pour remesurer sur l'arbre courant : `node ${CLAUDE_SKILL_DIR}/scripts/a11y-counts.mjs --list`.

## Règles

1. **HTML natif d'abord.** `<button type="button">` pour une action, `<Link>` pour une navigation, `<input>` et `<fieldset>` pour un choix. Jamais de `div onClick`, jamais de `role="button"` sur un conteneur qui contient déjà un bouton. Un rôle ARIA engage tout son comportement clavier `[A1]`.
2. **Toute superposition passe par `ui/dialog` ou `ui/sheet`.** Radix fournit le piège du focus, Échap, l'arrière-plan masqué et le verrou de défilement `[T6][V1]`. Ne jamais écrire `role="dialog"` ni `aria-modal` à la main : l'attribut ment tant que l'arrière-plan reste atteignable `[A2]`.
3. **Chaque dialogue a un titre, un focus initial choisi, un retour du focus.** `DialogTitle` obligatoire. Le focus arrive sur l'action la moins risquée. À la fermeture il revient au bouton d'ouverture `[A2]`, ce que Radix ne fait pas sans `Dialog.Trigger` (exécuté dans jsdom `[V7]`). Bouton d'ouverture unique et voisin du dialogue : `DialogTrigger asChild`, le moyen prévu par Radix `[T6]`, qui ne dépend pas du focus donné par le clic (Safari n'en donne pas à un bouton `[T16]`). Dialogue ouvert par un état : enveloppe du patron §3. Ouvreur qui disparaît : repli passé par l'appelant (§3). Action irréversible : `role="alertdialog"` (patron §4) `[A3]`. Ne jamais transmettre `role={undefined}` à `DialogContent` : cela efface le rôle `[V7]`.
4. **Chaque contrôle a un nom qui désigne son objet.** Bouton icône : `aria-label` + `aria-hidden="true"` sur l'icône (lucide ne le pose pas `[V1]`). « Supprimer Merguez du panier », pas « Supprimer ». `title` seul ne nomme pas de façon fiable `[W16]` et son infobulle n'existe ni au clavier ni au toucher `[T15]`.
5. **L'état est un attribut, le style en découle.** `aria-pressed`, `aria-selected`, `aria-checked`, `aria-expanded`, `aria-current="page"`, stylés par les variantes Tailwind `aria-selected:` ou `aria-pressed:` `[T9]`. Jamais la teinte seule : entre deux états, viser un écart de luminosité d'au moins 3:1 ou un second indice (icône, libellé) `[W18]`. L'étiquette d'un interrupteur ne change pas avec son état `[A6]`.
6. **Tout changement sans déplacement du focus est annoncé.** Confirmation : `toast` de `sonner`, seul système autorisé (région polie déjà dans le DOM `[V1]`). Total, chargement, résultat : `LiveRegion` (`role="status"`), présente vide dès le premier rendu puis remplie `[W5][T10]`. Erreur bloquante ou état durable : texte persistant `role="alert"`. Jamais d'information importante uniquement dans un toast `[W6][A4]`.
7. **Formulaires.** Étiquette visible reliée par `htmlFor`/`id` `[W16]` ; le texte indicatif n'est pas une étiquette `[W17]`. `autoComplete` exact. Erreur en texte sous le champ, `aria-describedby` + `aria-invalid`, qui dit comment corriger. À la soumission : focus sur le premier champ en erreur `[W15]`. Ne jamais vider une saisie valide `[W12]`, ne jamais bloquer le collage `[W13]`.
8. **Focus toujours visible.** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (`ring-white` sur fond sombre fixe). Jamais `outline-none` seul, jamais d'anneau à opacité réduite : il doit tenir 3:1 `[W11]`. Aucun élément focalisé entièrement caché sous une barre collante `[W4]`.
9. **Cibles tactiles : 44 px** (règle CLAUDE.md), soit `h-11 w-11` ou `min-h-11`. Le plancher WCAG 2.2 AA est 24 px, ou un espacement tel qu'un cercle de 24 px centré sur la cible ne touche aucune autre cible `[W3]` : en dessous, c'est un échec de conformité, pas seulement un écart maison.
10. **Contraste.** Texte : 4,5:1. Grand texte (≥ 24 px, ou ≥ 18,5 px gras), icône porteuse de sens, état d'un composant : 3:1. Sans arrondi : 4,48 échoue `[W10][W11]`. Toute paire nouvelle passe par `scripts/contrast.mjs`, dans les deux thèmes.
11. **Mouvement.** Pas d'animation en boucle à côté d'un contenu à lire, sauf si un contrôle visible l'arrête `[W7]` ; rien ne clignote plus de trois fois par seconde `[W8]`. Mouvement décoratif derrière `motion-safe:` `[T9]`. Nos classes d'animation maison, que cette variante n'atteint pas, sont coupées sous `prefers-reduced-motion` par le filet ciblé écrit dans `design-klikgo` (`references/etats-et-mouvement.md` §3). Pas de règle globale sur `*` tant que le point à arbitrer n° 9 n'est pas tranché (patron §12) `[T11]`.
12. **Son.** Jamais le seul canal d'une information. Tout son automatique de plus de 3 s a un mécanisme d'arrêt `[W9]` ; nous y rangeons la sonnerie qui reprend toutes les 5 s : son bouton d'arrêt a un nom.
13. **Structure.** Un seul `<main>` : celui de `src/app/layout.tsx`. Les pages utilisent `<div>` ou `<section>`. Un `h1`, un `title` unique (l'annonceur de route de Next le lit `[T8]`), `lang="fr"`, zoom jamais bloqué.

## Couleurs vérifiées

Ratios calculés avec `scripts/contrast.mjs` et recoupés par axe en production `[V2][V3]`. Les jetons et leur évolution appartiennent à `design-klikgo` ; son script `contrast.mjs --tokens` vérifie toutes les paires de `globals.css` (écart de ± 0,02 avec le nôtre, qui part de l'hexadécimal arrondi).

| Usage | Thème clair (blanc, `#f8f6f3`) | Thème sombre (`#0a0a0a`, `#141414`) |
|---|---|---|
| Texte secondaire | `text-gray-600` (7,0:1). `gray-500` échoue sur `#f8f6f3` (4,48) | `text-gray-400` (7,3:1). `gray-500` à `gray-700` échouent |
| Rouge de marque `#DC2626` | Fond de bouton avec texte blanc (4,83), icône, grand texte. Petit texte : échec sur `#f8f6f3` (4,48) | Icône et grand texte seulement (4,10 et 3,81) |
| Petit texte rouge, erreur | `text-red-700` `#b91c1c` (6,0:1) | `text-red-400` (6,7:1) |
| Aplat de succès | Blanc sur `emerald-700` (5,48). `emerald-600` et `--success` échouent | Idem |
| Aplat d'alerte | `bg-amber-500 text-amber-950` (6,97 ; convention de `design-klikgo`) ou blanc sur `amber-700` (5,02). Blanc sur `amber-500`, `orange-500`, `--warning` échoue | Idem |
| Anneau de focus | `ring-ring` plein (4,79) | `ring-ring` tient 3:1 (4,13 sur `#0a0a0a`, 3,85 sur `#141414`) ; `ring-white` sur fond sombre fixe (cuisine), aplat rouge ou image |

## Mode cuisine (`/boucher/commandes`)

- L'écran est toujours sombre, mais `dark:` dépend du thème choisi : poser `dark text-white` sur son conteneur, et `dark` sur ses dialogues, rendus hors du conteneur (patron §13). Sinon `text-gray-500 dark:text-gray-400` tombe à 3,91:1. La classe `dark` n'agit que sur les descendants, pas sur l'élément qui la porte (`:is(.dark *)`, compilé avec notre config `[V9]`).
- Nouvelle commande : un `alertdialog` qui prend le focus, visible sans le son, audible sans regarder ; son bouton arrête aussi la sonnerie et l'animation (patron §5).
- Onglets mobiles : `tablist` avec flèches (patron §6). Interrupteur « Boutique en ligne », son, mode simple, scanner : nom, état, 44 px.
- État de connexion, pause, session expirée : texte et `role="status"` ou `role="alert"`, pas une icône seule.
- Retard ou urgence (état durable, sans bouton d'arrêt) : bordure, icône et libellé fixes, pas `animate-pulse` infini.
- Le sondage ne doit jamais faire perdre le focus : `key` stables, carte focalisée jamais démontée.
- Actions Accepter, Refuser, Prête : les plus grandes cibles de l'écran. Lisibilité et précision du toucher se valident sur la tablette réelle (contrôle manuel, étape 6).

## Tester

Détail, fixture et specs dans [references/tests-playwright-axe.md](references/tests-playwright-axe.md).

```bash
npx playwright install chromium            # une fois : la révision installée ne correspond pas à 1.59.1
npx playwright test tests/e2e/a11y.spec.ts # spec à créer (référence §4) ; lecture seule, vise la production par défaut
node ${CLAUDE_SKILL_DIR}/scripts/contrast.mjs '#DC2626' '#f8f6f3'   # depuis la racine : .claude/skills/accessibility-wcag/scripts/
node ${CLAUDE_SKILL_DIR}/scripts/a11y-counts.mjs                    # chiffres clés de l'audit sur l'arbre courant
```

- axe-core trouve en moyenne 57 % des problèmes `[T3]` : un scan vert ne prouve pas la conformité. Clavier, ordre et retour du focus, annonces, mouvement, son se testent par scénario Playwright ou à la main.
- Demander le tag `wcag22aa`, sinon la règle de taille de cible ne tourne pas `[V1]`.
- Scanner chaque état : dialogue ouvert, erreur affichée, thème sombre, largeur mobile.
- Localiser par `getByRole` et par nom : un test qui ne trouve pas le bouton décrit ce que vit un lecteur d'écran.
- `@axe-core/playwright` n'est pas installé : utiliser la fixture « variante B » en attendant. Playwright ne tourne pas en CI aujourd'hui.
- Parcours connectés (mode cuisine, panier rempli) : serveur local ou préversion seulement, session ouverte par `POST /api/test-mode/activate` (jeton signé depuis `2364ef9` ; poser les cookies à la main ne fonctionne plus). Gabarits : `.claude/skills/testing-strategy/templates/e2e/`.
- Jamais de commande ni de formulaire soumis contre la production.

## Cadre légal en bref

- La directive européenne d'accessibilité s'applique au commerce électronique depuis le 28 juin 2025 ; contrôle par la DGCCRF `[L1][L2]`.
- Les entreprises de moins de 10 personnes et de 2 M€ au plus de chiffre d'affaires ou de bilan sont exemptées en tant que prestataires de services, selon la fiche DGCCRF `[L1]` (la loi elle-même, article L. 412-13, n'a pas pu être relue). Klik&Go l'est probablement aujourd'hui : à confirmer par l'owner.
- Le RGAA 4.1.2 (106 critères, fondé sur WCAG 2.1 AA) ne vise que le secteur public et les entreprises à partir du seuil de 250 M€ de chiffre d'affaires `[L5][L6]`.
- Viser WCAG 2.2 AA couvre le socle web des deux régimes ; l'arrêté du 9 octobre 2023 fixe d'autres exigences, non étudiées ici `[L1]`. Détail, sanction et questions ouvertes : [references/cadre-legal-france.md](references/cadre-legal-france.md).

## Erreurs déjà commises ici

Lignes du commit `161f920` ; `panier/page.tsx` et `ProductCard.tsx` ont bougé depuis (audit §0).

| Erreur | Où | Correctif |
|---|---|---|
| `cn()` efface la couleur du texte des boutons `sm`, `lg`, `xl` (3,67:1) | `src/lib/utils.ts` | Patron §2 (correctif de `design-klikgo`) |
| Superposition écrite à la main, sans piège de focus | 27 fichiers, dont les feuilles produit et 3 modales de `commandes/page.tsx` | Patron §3 |
| Focus perdu à la fermeture de tout dialogue | `ui/dialog.tsx`, `ui/sheet.tsx` | Patron §3 |
| Texte indicatif en guise d'étiquette, erreur non reliée | `panier/page.tsx:655-699` | Patron §9 |
| Carte `role="button"` contenant un bouton | `product/ProductCard.tsx:173` | Patron §11 |
| Bouton ou lien icône sans nom | `panier/page.tsx:415`, `:525`, `:735` (les deux derniers déjà nommés dans l'arbre de travail) | Patron §10 |
| Libellé générique répété sur chaque ligne (« Diminuer la quantité ») | `panier/page.tsx:99-123` | Patron §10 |
| Toast sans région live | `ui/NotificationToast.tsx` | Patron §8 |
| Anneau de focus à 30 % d'opacité (1,62:1) | `ui/switch.tsx:26` | Règle 8, patron §7 |
| `<main>` imbriqué dans celui du layout | 17 fichiers | Règle 13 |
| Variantes `dark:` sur un écran toujours sombre | Mode cuisine | Patron §13 |
| Aucune prise en compte du mouvement réduit | `globals.css` | Patron §12 |
| `variant="danger"` sans effet : confirmation destructive en simple `dialog` | `ui/ConfirmDialog.tsx` | Patron §4 |
| Défauts relevés dans du code sans appelant | `cart/CartItem.tsx`, `ui/stepper.tsx`, `order/RatingPopup.tsx`, `order/QRScanner.tsx` | Ne pas corriger : point à arbitrer n° 8 |

## Définition de terminé

Un changement d'interface est terminé quand, sur chaque écran touché :

- [ ] tout se fait au clavier seul, dans un ordre logique, focus toujours visible et jamais sous une barre collante ;
- [ ] chaque superposition passe par Radix, a un titre, se ferme avec Échap et rend le focus à son ouvreur ;
- [ ] chaque contrôle est trouvé par `getByRole` avec un nom qui désigne son objet ; son état est exposé par un attribut ;
- [ ] chaque champ a une étiquette visible reliée ; chaque erreur est un texte relié au champ, et le focus va au premier champ en erreur ;
- [ ] chaque changement d'état (total, chargement, succès, erreur) est annoncé ;
- [ ] chaque paire de couleurs nouvelle est vérifiée dans les deux thèmes ; aucune information par la couleur seule ;
- [ ] chaque cible fait 44 px, et jamais moins de 24 px ;
- [ ] aucune boucle animée sans bouton d'arrêt, mouvement réduit respecté, tout son a son bouton d'arrêt ;
- [ ] l'écran reste utilisable à 320 px de large et à 200 % de zoom ;
- [ ] le scan axe (tags WCAG dont `wcag22aa`, clair et sombre, mobile) n'ajoute aucune règle à `KNOWN` ;
- [ ] le parcours a été écouté une fois avec VoiceOver ou TalkBack si le panier, la validation de commande ou le mode cuisine sont touchés ;
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build` passent ; aucun `title` ni `h1` de page indexable modifié sans passer par les skills SEO ;
- [ ] l'audit et la liste `KNOWN` sont à jour.

## Points à arbitrer

Ces points touchent une règle de CLAUDE.md, un autre skill ou une décision de l'owner. Ne pas trancher seul. Ceux qui portent sur des jetons sont instruits dans `design-klikgo` (`references/points-a-arbitrer.md`), dont les numéros sont rappelés.

1. **Rouge de marque en petit texte** (A4 de `design-klikgo`). CLAUDE.md fixe `#DC2626`. En petit texte il échoue sur `#f8f6f3` (4,48) et sur fond sombre (4,10 ; 3,81). Proposition : `red-700` (clair) et `red-400` (sombre) pour le petit texte. D'ici là, ne pas ajouter de petit texte `#DC2626` sur ces fonds. → owner.
2. **Jetons** (A5 et A18 de `design-klikgo`). `--success` et `--warning` avec texte blanc : 2,30 et 2,13. `--input` et `--border` : 1,24 sur blanc, alors que la bordure est souvent le seul indice d'un champ `[W11]`. → owner.
3. **Compte à rebours de 5 s avant envoi de la commande** (`OrderCountdown.tsx` ; A3 de `click-and-collect`). Selon notre lecture, une limite de temps au sens de 2.2.1 `[W6]` : 5 s pour annuler, ni réglables ni prolongeables. Proposition : le garder, avec une annonce unique, un bouton « Envoyer maintenant » et une annulation encore possible après envoi ; sinon le remplacer par une confirmation explicite. → owner.
4. **Taille de texte** (A6 de `design-klikgo`). 358 `text-[10px]`, 45 à 9 px ou moins. WCAG ne fixe pas de taille minimale ; plancher proposé : 12 px côté client, 14 px en cuisine. → owner.
5. **Outillage.** Installer `@axe-core/playwright` ; lancer Playwright en CI ; activer les règles `jsx-a11y` de la référence « tests » §6 (0 erreur et 162 avertissements aujourd'hui `[V9]`). → `testing-strategy`, `architecture-conventions`, owner.
6. **Statut légal.** Confirmer l'exemption de taille ; décider d'une page « Accessibilité » volontaire (page indexable : règles SEO de l'owner). → owner, `conformite-france`, `seo-anti-penalty`.
7. **Titre d'onglet clignotant en cuisine** (`use-kitchen-notifications.ts:39`). Proposition : titre stable avec compteur. → `order-lifecycle-realtime`.
8. **Code sans appelant.** `cart/CartDrawer`, `CartPanel`, `CartItem`, `CartFAB`, `checkout/cart-item`, `order/RatingPopup`, `order/QRScanner`, `ui/stepper`, `ui/toggle-pill`, `ui/Toast` ne sont importés nulle part, ni en statique ni en dynamique `[V9]` (CLAUDE.md cite encore les quatre premiers dans sa structure). Les supprimer ou les rebrancher avant d'y corriger quoi que ce soit. → `architecture-conventions`, owner.
9. **Mouvement réduit : filet ciblé ou règle globale** (A19 de `design-klikgo`). Le filet ciblé coupe nos classes maison et laisse tourner les indicateurs de chargement ; la règle sur `*` coupe tout, indicateurs compris, et web.dev la présente comme une astuce d'utilisateur à ses risques `[T11]`. En attendant : filet ciblé seul (règle 11). → owner, `design-klikgo`.

Déjà tranché, à ne pas rouvrir : les cibles de 44 px sont une règle de CLAUDE.md, et `design-klikgo` remonte les primitives (`Button` `sm` et `icon` 40 px, fermeture de dialogue 32 px) dans son lot 3 ; `--primary` (`#E01F1F` au lieu de `#DC2626`) est son correctif B8.

Écarts avec d'autres skills, à faire corriger par leurs auteurs. Tant qu'ils subsistent, ce skill fait foi sur ces points :

- `ux-marketplace` (`SKILL.md`, `references/snippets.md` §9, `references/patterns-ecrans.md`) et `design-klikgo/references/composants.md` §6 écrivent que Radix rend le focus au déclencheur. C'est vrai avec un `Dialog.Trigger`, que le code n'utilise nulle part : le patron §3 reste nécessaire.
- `design-klikgo/SKILL.md` attribue à ce skill « la règle globale `prefers-reduced-motion` ». Le seul bloc CSS à écrire est le filet ciblé de sa propre référence (règle 11, point n° 9).
- `nextjs-app-router/references/patterns.md` rend un `<main>` dans une page : suivre la règle 13.

## Références

- [references/patterns-composants.md](references/patterns-composants.md) — 13 patrons de code compilés.
- [references/audit-code-2026-11.md](references/audit-code-2026-11.md) — défauts par fichier et ligne, base axe de production, table des contrastes.
- [references/criteres-wcag-klikgo.md](references/criteres-wcag-klikgo.md) — critères A et AA par parcours, nouveautés 2.2, correspondance RGAA.
- [references/tests-playwright-axe.md](references/tests-playwright-axe.md) — fixture axe, garde-fou, tests clavier, lint, contrôle manuel.
- [references/cadre-legal-france.md](references/cadre-legal-france.md) — directive européenne, RGAA, exemption, veille.
- [references/sources.md](references/sources.md) — toutes les sources, leur fiabilité, ce qui a été écarté.
- `scripts/contrast.mjs` — ratio de contraste d'une paire de couleurs. `scripts/a11y-counts.mjs` — chiffres clés de l'audit, recomptés.
