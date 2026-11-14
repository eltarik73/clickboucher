---
name: design-klikgo
description: Design system Klik&Go en pratique d'ingénierie — tokens Tailwind 3.4 (couleurs à contraste vérifié, rayons, ombres, couches), typographie, mode sombre, composants shadcn/Radix/cva, états (hover, focus-visible, disabled, loading, error), mouvement, responsive mobile-first, et convergence du code existant sans redesign. À charger avant de créer ou modifier un composant, une page, des classes Tailwind, src/styles/globals.css, tailwind.config.ts ou src/components/ui.
when_to_use: Déclencheurs — composant, bouton, carte, modale, feuille, badge, couleur, token, dark mode, mode sombre, police, typographie, radius, ombre, focus, contraste, cible tactile, animation, responsive, design system, shadcn, Radix, cva, tailwind-merge, harmoniser l'interface, refonte visuelle, revue d'une PR qui touche des classes Tailwind.
---

# Design system Klik&Go — pratique d'ingénierie

Marque : **rouge `#DC2626`** (ce n'est pas un bordeaux), interface **claire** par défaut (fond `#f8f6f3`, héros et cartes blancs), sombre pris en charge partout, seul le mode cuisine est sombre forcé. Goût du fondateur : sobriété (références Stripe, Linear, Vercel, Apple), une seule couleur d'accent, pas de halo ni de dégradé décoratif. `CLAUDE.md` fait foi ; ce skill dit comment l'appliquer dans le code tel qu'il est. Mesures prises à `161f920`, refaites à `32c581f` (aucun `.tsx` ni fichier de style n'a changé entre les deux) et recoupées en production les 2026-11-13 et 2026-11-14.

Le chantier de tarification des commandes (calcul des prix et promotions ; en cours, non fusionné au 2026-11-14) réécrit `/panier`, `CartItem`, `ProductCard`, `KitchenOrderCard`, les feuilles produit et les tickets : sur son arbre les compteurs bougent déjà (107 `<Button>`, 569 `<button>`, 22 boutons touchés par `cn()`). Re-mesurer avant de citer un chiffre, et ne pas ouvrir de lot de convergence sur ces fichiers avant sa fusion.

Pile réelle : Tailwind 3.4.19 (config JS, `darkMode: ["class"]`, `content` limité à `src/app` et `src/components`), tailwind-merge 2.6.1, cva 0.7.1, `@radix-ui/react-dialog` 1.1.15 et `react-slot` (seules primitives Radix), tailwindcss-animate, lucide-react 0.378.0, sonner 1.7.4, React 18.3. Pas de `components.json`, pas de `next-themes`.

## 1. Huit faits mesurés à connaître avant d'écrire une classe

1. **Les polices de marque ne s'affichent pas en production** (mesuré trois fois, les 2026-11-13 et 14 : 0 face chargée sur 20) : DM Sans et Outfit sont déclarées mais jamais appliquées (variables `next/font` posées sur `<body>`, piles calculées sur `:root`). Correctif d'une ligne, visible sur tout le site.
2. **`cn()` efface des classes** : tailwind-merge prend `text-body`, `text-caption`… pour des couleurs. 23 `<Button>` en `size="sm"` ou `"lg"` perdent leur couleur de texte (en thème clair), dont « Confirmer ma commande » ; tous les `<Badge>` perdent leur taille `text-micro`. Constaté en production sur le bouton du panier vide : texte presque noir sur rouge, 3,67:1.
3. **`rounded-lg` vaut 20 px**, `rounded-md` 16 px, `rounded-sm` 12 px (surcharge par `--radius: 20px`), alors que `rounded-xl` = 12 px et `rounded-2xl` = 16 px.
4. **Les tokens existent mais ne servent pas** : 196 usages contre 2 545 couleurs hex arbitraires et 6 518 variantes `dark:` écrites à la main. `bg-card` est pourtant identique au pixel à `bg-white dark:bg-[#141414]` (405 fois).
5. **Le rouge ne passe pas partout** : blanc sur `#DC2626` 4,83:1 (bon) ; `#DC2626` en texte sur fond sombre 3,81:1 (insuffisant) ; `--success` et `--warning` avec texte blanc 2,3:1 et 2,1:1.
6. **Le token `--border` sombre contient un alpha** : `border-border/50` devient invalide et la bordure des `Card` passe au blanc en thème sombre.
7. **États absents** : `focus:` 282 contre `focus-visible:` 39, 95 anneaux translucides (1,63:1 au mieux), zéro `aria-invalid`, zéro `motion-reduce`, 21 fichiers d'overlay maison sans sémantique de dialogue, 45 boutons ou liens carrés de 28 à 36 px, 575 `<button>` bruts contre 108 `<Button>`.
8. **Tailwind ne lit pas `src/lib`** : huit classes de `src/lib/design-tokens.ts` ne sont émises nulle part (`bg-indigo-500/10`, `bg-green-500/10`, `bg-orange-500/10`, `bg-gray-400/10`, quatre `border-t-*-400`). Les pastilles « En préparation », « Terminée », « Partiel. refusée » et « Expirée » du webmaster n'ont pas de fond.

Preuves, chiffres complets et autres bugs : [references/etat-des-lieux.md](references/etat-des-lieux.md). Ces chiffres sont une photographie : les relancer avec les scripts ci-dessous avant de les citer ou de planifier.

## 2. Où lire quoi

| Je dois… | Lire |
|---|---|
| choisir une couleur, un rayon, une ombre, un `z-index`, ajouter un token | [references/tokens.md](references/tokens.md) |
| choisir une police, une taille, une graisse | [references/typographie.md](references/typographie.md) |
| créer ou modifier un composant, une modale, un champ, un toast | [references/composants.md](references/composants.md) |
| traiter survol, focus, chargement, erreur, cible tactile, animation, responsive | [references/etats-et-mouvement.md](references/etats-et-mouvement.md) |
| écrire pour le mode sombre ou le mode cuisine | [references/dark-mode.md](references/dark-mode.md) |
| migrer du code existant, planifier un lot de nettoyage | [references/convergence.md](references/convergence.md) |
| savoir ce qui attend une décision du fondateur | [references/points-a-arbitrer.md](references/points-a-arbitrer.md) |
| vérifier d'où vient une règle | [references/sources.md](references/sources.md) |

Outils fournis (lecture seule, sans dépendance) :

```bash
node ${CLAUDE_SKILL_DIR}/scripts/design-audit.mjs                 # thermomètre de dérive (option --dir="src/app/(client)")
node ${CLAUDE_SKILL_DIR}/scripts/design-audit.mjs --check         # cliquet : la dette ne doit pas augmenter
node ${CLAUDE_SKILL_DIR}/scripts/contrast.mjs "#DC2626" "#141414" # ratio WCAG d'une paire (--ui pour le seuil 3:1)
node ${CLAUDE_SKILL_DIR}/scripts/contrast.mjs --tokens            # toutes les paires de tokens de globals.css
```

## 3. Règles de décision

### Couleur

| Besoin | Écrire | Ne plus écrire |
|---|---|---|
| Fond de page | rien si le layout du groupe le pose déjà (`(boucher)`, `(admin)`, `webmaster`) ; sinon (`(client)`, pages publiques hors groupe) la paire existante `bg-[#f8f6f3] dark:bg-[#0a0a0a]`, seule valeur hex que le cliquet ne compte pas ; `bg-background` quand le token sera aligné (A14) | `bg-background` aujourd'hui (il vaut blanc / noir), un autre hex |
| Carte, modale, feuille | `bg-card text-card-foreground` | `bg-white dark:bg-[#141414]` |
| Texte principal | `text-foreground` | `text-gray-900 dark:text-white` |
| Texte secondaire | sur carte ou fond blanc : `text-muted-foreground` (4,76:1). Posé directement sur le fond de page beige ou sur `bg-muted`, tant que le lot 2 n'a pas foncé le token (4,41 et 4,08 aujourd'hui) : `text-gray-600 dark:text-gray-400` | `text-gray-400` en clair, `text-gray-500` sur beige ou en sombre |
| Filet, surface discrète | `border-border`, `bg-muted` | `border-gray-200 dark:border-white/10`, `border-border/50` |
| Action principale | `bg-primary text-primary-foreground` | `bg-[#DC2626] text-white`, `bg-red-600` |
| Rouge en texte | `text-primary dark:text-red-400` ; sur beige ou teinte `text-red-700 dark:text-red-400` | `text-[#DC2626]` seul |
| Aplat vert ou ambre | `bg-emerald-700 text-white`, `bg-amber-500 text-amber-950` | `bg-emerald-600 text-white`, `bg-amber-500 text-white` |
| Pastille d'état | `bg-X-100 text-X-700 dark:bg-X-900/20 dark:text-X-300` (ambre : `text-amber-800`) + libellé | `bg-X-500/10 text-X-600`, couleur seule |

- Zéro nouvelle valeur `[#…]` (hors fond de page ci-dessus). Si aucun token ni classe de palette ne convient, vérifier la paire avec `contrast.mjs` puis proposer un token (quatre gestes : `:root`, `.dark`, `tailwind.config.ts`, `extendTailwindMerge` si le nom n'est pas une couleur). Couleur imposée de l'extérieur (logo tiers) : admise avec un commentaire, en convertissant une autre valeur hex dans la même PR pour que le cliquet reste vert.
- Seuils : 4,5:1 pour le texte, 3:1 pour le grand texte, les composants et l'anneau de focus. Le placeholder compte ; le texte désactivé non.
- Un survol fonce l'aplat (`#b91c1c`), il ne l'éclaircit pas (`primary/90` tombe à 4,33:1).
- Une seule famille de gris dans le code nouveau (`gray`), et seulement à défaut de token.

### Typographie

- Titres : `font-display` + `font-bold` (Outfit n'est chargée qu'en 500, 700, 800). Texte : `font-normal`, `font-semibold`, `font-bold` (DM Sans n'est chargée qu'en 400, 600, 700 : dès que la police s'appliquera, `font-medium` rendra du 400 et `font-black` du 700 ; aujourd'hui c'est la police `sans-serif` de l'appareil qui répond, avec ses propres graisses).
- Pages : échelle Tailwind (`text-xs` à `text-3xl`). `src/components/ui` : tokens projet déjà en place. Jamais `text-[Npx]`.
- Plancher 12 px pour une phrase ; 11 px (`text-micro`) pour une étiquette courte ; rien de neuf en dessous.
- Jamais de nom de police en dur (`fontFamily: "Outfit"`) : `next/font` génère des noms hachés.
- Chiffres qui changent : `tabular-nums`. Champs : `text-base md:text-sm` (modèle de l'`Input` shadcn ; la justification par le zoom iOS n'est pas corroborée, à tester sur iPhone).

### Forme

- Rayons : `rounded` (étiquette), `rounded-xl` (bouton, champ), `rounded-2xl` (carte, modale, 16 px comme `CLAUDE.md`), `rounded-full`. **Interdits en code nouveau** : `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-[…]`.
- Ombres : filet seul, `shadow-card`/`shadow-sm` (carte), `shadow-elevated` (flottant), `shadow-lg` (modale). En sombre, l'élévation se lit par la surface.
- Couches : `z-30` en-tête collant, `z-40` navigation fixe, `z-50` overlay et modale, `z-[100]` toast. Pas de `z-[9999]`.
- Espacement : échelle Tailwind (`gap-2`, `p-4`, `px-4` en gouttière mobile). Contrôles `h-12`, compact `h-11`, cuisine `h-14` et plus.

### Composants

- Chercher avant de créer : `ui/button`, `ui/input`, `ui/card`, `ui/badge`, `ui/dialog`, `ui/ConfirmDialog`, `ui/skeleton`, `ui/empty-state`, `ui/status-badge`, `sonner` pour les toasts, `lucide-react` pour les icônes.
- Une primitive : `React.forwardRef`, `displayName`, `...props` répandu, `className` fusionné en dernier par `cn()`, variantes dans `cva` nommées par intention (`variant`) et encombrement (`size`), `asChild` pour rendre un `<Link>`.
- `className` à l'appel : marges et placement seulement. Couleur, rayon, hauteur ou typographie répétés trois fois = une variante à ajouter dans la primitive.
- Une chaîne de classes s'écrit dans `src/app` ou `src/components` (fait 8) : ailleurs Tailwind ne l'émet pas et rien ne prévient. Le lot 0 étend `content` à `src/lib` pour réparer l'existant ; le code nouveau n'y range que libellés et valeurs hex.
- Overlay : toujours `@radix-ui/react-dialog` via `ui/dialog` ou `ui/sheet` (focus piégé, Échap, titre annoncé). Jamais `fixed inset-0` maison, `confirm()` ni `alert()`. Radix ne rend le focus qu'à un `Dialog.Trigger` : nos modales pilotées par `open` appliquent le correctif du skill `accessibility-wcag` (patron « Dialogue modal et retour du focus »).
- **Ne pas coller un composant de la doc shadcn actuelle** : elle vise Tailwind 4 et React 19 (`@theme`, `oklch`, pas de `forwardRef`, paquets `radix-ui`, `cn`, `tw-animate-css` absents ici). Ne pas lancer la CLI shadcn.
- Bouton d'icône : `aria-label` sur le bouton, `aria-hidden="true"` sur l'icône (lucide 0.378.0 ne le pose pas).

### États (aucun composant interactif n'est fini sans eux)

- Focus : `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (`ring-white` sur un fond sombre fixe ou une image). Ajouter `ring-offset-background` (ou `ring-offset-card` sur une carte), sinon l'écart de 2 px reste blanc en thème sombre. Jamais `outline-none` seul, jamais d'anneau translucide.
- Désactivé : attribut `disabled` réel + `disabled:pointer-events-none disabled:opacity-50`.
- Chargement : bouton `disabled` + `aria-busy` + `Loader2 animate-spin`, libellé conservé ; page : `loading.tsx` à la forme de la vraie page.
- Erreur : `aria-invalid`, message `role="alert"` relié par `aria-describedby`, texte et bordure (pas la couleur seule).
- Retour d'action systématique : `toast.success` / `toast.error` ou changement visible sur place.
- Cibles tactiles ≥ 44 px (`h-11`, `size-11`) ; l'icône reste petite, la zone grandit (`relative after:absolute after:-inset-2`).

### Mode sombre

- Écrire par tokens : un composant sans aucune variante `dark:` est le but. `dark:` reste pour les couleurs de palette sans token et pour `text-primary dark:text-red-400`.
- En sombre, pas de texte `gray-500` ou plus foncé (3,81:1 et moins) ; secondaire en `text-muted-foreground`.
- Mode cuisine : classe `dark` sur l'enveloppe (`<div className="dark min-h-screen bg-[#0a0a0a] text-foreground">`, le fond déjà en place ; `bg-background` vaut noir pur tant que A14 n'est pas tranché) plutôt que des couleurs en dur dans chaque composant. Une modale Radix sort de l'enveloppe par son portail : lui passer `dark` aussi.
- Regarder chaque écran modifié en clair et en sombre.

### Mouvement

- Animer `transform` et `opacity` seulement ; `transition-colors` ou `transition-transform`, jamais `transition-all`.
- 150 ms (appui, couleur), 200 ms (apparition), 300 ms (modale, feuille). Boucle (`animate-pulse`) uniquement pour un état qui exige une action.
- Entrée ou sortie `tailwindcss-animate` : la durée porte le même préfixe que l'animation (`data-[state=open]:animate-in data-[state=open]:duration-300`). Un `duration-300` nu est écrasé par les 150 ms de `animate-in` (vérifié dans Chromium ; c'est le cas de `ui/dialog` et `ui/sheet` aujourd'hui).
- Tout mouvement décoratif derrière `motion-safe:`. La variante n'atteint pas les classes déclarées hors `@layer` dans `globals.css` (`animate-ring`, `animate-pulse-slow`, `animate-bounce-gentle`, `flash-green`, `flash-red` : `motion-safe:animate-ring` ne génère rien) : elles sont coupées par le filet ciblé de [references/etats-et-mouvement.md](references/etats-et-mouvement.md) §3, écrit une seule fois (lot 4). Pas de règle `*` tant que A19 n'est pas tranché.
- Animations autorisées : celles de `CLAUDE.md` (`fade-in`, `fade-up`, `slide-up`, `scale-in`, `pulse-soft`, `shimmer`). Pas de nouvelle `@keyframes` sans supprimer un doublon.

### Responsive

- Base 375 px sans préfixe, puis `md:` et `lg:` ; rien ne casse à 320 px.
- Zones sûres : `pb-safe-bottom`, `bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6`. Hauteurs en `dvh`.
- Jamais de valeur responsive dans `style={{}}` : elle écrase les classes `md:`.
- Rien d'essentiel au survol : le tactile ne survole pas.
- Images produit : `aspect-[4/3] object-cover object-center`. Pages SEO : ne pas changer la hiérarchie `h1`–`h3` ni le texte indexable (skill `seo-anti-penalty`).

## 4. Converger sans redesign

Ordre imposé, un lot = une nature de changement ([references/convergence.md](references/convergence.md)) :

1. **Lot 0** — `cn()` avec `extendTailwindMerge` + test ; classes fantômes `tap-scale`, `no-scrollbar`, `scrollbar-hide` ; `--border` sombre sans alpha ; `content` Tailwind étendu à `src/lib`.
2. **Lot 1** — polices sur `<html>` (visible partout : après accord du fondateur, point A1), avec la décision A8 sur DM Sans 500, sinon les 514 `font-medium` rendent du 400 partout.
3. **Lot 2** — tokens exacts : `--primary` = `#DC2626`, `--primary-hover`, `--muted-foreground` ; puis `--background`, `--success`, `--warning` une fois A14 et A5 tranchés.
4. **Lot 3** — primitives `ui/` réparées (44 px, survol, `loading`, tokens et durées dans `dialog` et `sheet`, retour du focus, statuts unifiés).
5. **Lot 4** — script anti-flash du thème ; filet ciblé `prefers-reduced-motion`.
6. **Lot 5** — migration par surface (client, cuisine, back-office, webmaster) avec la table de remplacement ; d'abord les paires identiques au pixel.
7. **Lot 6** — code mort, doublons, cartes de statut locales.

Hors lots : tout fichier ouvert pour une fonctionnalité repart avec ses paires converties et ses boutons bruts remplacés, sans changement visible non demandé.

## 5. Erreurs déjà commises ici, à ne pas refaire

- Ajouter un nom au thème Tailwind (`fontSize`, `boxShadow`) sans le déclarer à tailwind-merge.
- Mettre un alpha dans un token (`--border: 0 0% 100% / 0.1`).
- Référencer une variable CSS (`var(--font-body)`) plus haut dans l'arbre que l'élément qui la définit.
- Écrire une classe qui n'existe pas (`tap-scale`) : Tailwind ne prévient pas.
- Ranger des classes dans `src/lib/design-tokens.ts`, hors du `content` de Tailwind : huit ne sont jamais émises.
- Poser `duration-200` ou `duration-300` à côté de `data-[state=open]:animate-in` : l'animation reste à 150 ms.
- Redéfinir `rounded-lg` : tout le monde suppose 8 px.
- Définir la même animation dans la config et dans `globals.css`.
- Deux « sources uniques » pour les couleurs de statut (`lib/design-tokens.ts`, `ui/status-badge.tsx`) et onze copies locales.
- Surcharger la couleur d'un `<Button>` par `className` 57 fois au lieu de corriger le token.
- Créer une primitive (`skeleton`, `empty-state`, `stepper`, `sheet`) sans brancher un seul appelant.
- Appliquer le thème dans un `useEffect` (flash clair).
- Supposer que la doc d'une bibliothèque décrit la version installée (lucide `aria-hidden`, shadcn v4).

## 6. Définition de terminé

- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/design-audit.mjs --check` : aucune régression de dette. Si un compteur monte, corriger le code ajouté ; la référence ne se réécrit (`--write-baseline`) qu'après une baisse.
- [ ] Aucune nouvelle valeur `[#…]` (hors paire de fond de page), `text-[Npx]`, `rounded-sm|md|lg`, `transition-all`, police en dur, `confirm()`.
- [ ] Toute paire de couleurs nouvelle vérifiée avec `contrast.mjs` (4,5:1 texte, 3:1 composant) en clair **et** en sombre.
- [ ] Chaque élément interactif a : focus visible au clavier, état désactivé, état de chargement si l'action est asynchrone, erreur annoncée, cible ≥ 44 px, nom accessible.
- [ ] Écran contrôlé à 375 px clair, 375 px sombre, 320 px, 768 px et 1280 px ; parcours au clavier (Tab, Entrée, Échap). Écran protégé (cuisine, back-office, webmaster) : en local ou sur un aperçu, avec la session de test signée de `CLAUDE.md` (« Test Mode »), jamais en production.
- [ ] Mouvement décoratif sous `motion-safe:` ; rien d'essentiel ne dépend du survol.
- [ ] Composant existant réutilisé ou variante ajoutée à la primitive ; pas de doublon créé.
- [ ] `globals.css` ou `tailwind.config.ts` modifié : `contrast.mjs --tokens` relancé, nom déclaré à tailwind-merge si besoin, test `cn()` à jour.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` passent (`CLAUDE.md` ; le build exige une base joignable).
- [ ] Tout changement visible non demandé est signalé dans la PR avec capture avant et après.

## 7. Points à arbitrer (décision du fondateur)

Détail, options et règle d'attente : [references/points-a-arbitrer.md](references/points-a-arbitrer.md).

- **A1** Appliquer réellement DM Sans et Outfit (change l'aspect de tout le site).
- **A2** `CLAUDE.md` dit « Font : Outfit » à un endroit et « DM Sans (body), Outfit (display) » à un autre.
- **A3** `CLAUDE.md` dit « Radius : 16px », `--radius` vaut 20 px et dérègle `rounded-sm|md|lg`.
- **A4** Entériner `red-400` et `red-700` comme rouges de texte (le `#DC2626` seul échoue en sombre).
- **A5** Nouvelles valeurs de `--success` et `--warning`.
- **A6, A7, A8** Plancher de taille de texte, échelle typographique unique, chargement de DM Sans 500.
- **A9, A10** Thème par défaut (suivre le système ?), survol limité aux appareils qui survolent.
- **A11, A12, A13** `glow` et dégradés face à la sobriété voulue, liste blanche d'emojis, cadrage `object-[center_38%]`.
- **A14 à A18** Fond de page par token, Tailwind 4, préconnexion Google Fonts devenue inutile, casse des noms de fichiers `ui/`, bordure des champs à 3:1.
- **A19** Mouvement réduit : filet ciblé (retenu ici) ou règle globale `*` (elle fige aussi les 155 `animate-spin`).
- **A20** Brancher `design-audit.mjs --check` dans la CI.

## 8. Frontières avec les autres skills

`accessibility-wcag` : audit, critères complets et tests (ici, seulement ce que le design system garantit par construction ; ratios, anneau de focus et seuil de 44 px sont les mêmes dans les deux skills). `ux-marketplace` et `click-and-collect` : parcours et priorités d'écran. `web-performance` : images, polices côté chargement, CLS. `css-expert`, `react-patterns` : mécanique CSS et React générique. `testing-strategy` : tests de composants et visuels. `seo-anti-penalty` : toute page indexable. Ne pas dupliquer leurs règles ici : y renvoyer.

Les extraits de code des autres skills montrent un comportement, pas un habillage : quand l'un d'eux écrit `focus:ring-[#DC2626]/30`, `bg-[#DC2626] hover:bg-[#b91c1c]` sur un `<Button>` ou une paire hex (c'est le cas de `ux-marketplace/references/snippets.md`), garder sa logique et appliquer les classes de ce skill.
