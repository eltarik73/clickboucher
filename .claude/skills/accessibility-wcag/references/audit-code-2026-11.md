# État des lieux accessibilité — Klik&Go au commit `161f920` (2026-11-13)

Ce fichier est une photographie. Il sert à choisir par où commencer et à mesurer le progrès. Quand un point est corrigé, le rayer ici dans le même commit.

Méthode : lecture de `src/components/ui/*`, `src/components/cart/*`, `src/app/(client)/panier/page.tsx`, `src/app/(boucher)/boucher/commandes/page.tsx`, `src/components/boucher/OrderAlertOverlay.tsx` ; comptages `grep` sur `src/` ; ratios calculés avec `scripts/contrast.mjs` ; scan axe-core 4.11.1 en lecture seule de la production. Sources : `[V1]`–`[V9]` dans `sources.md`.

Tous les numéros de ligne sont ceux du commit `161f920` ; ils ont été relus un par un à ce commit `[V9]`. Pour retrouver une ligne citée : `git show 161f920:<chemin> | sed -n '<début>,<fin>p'`. Les fichiers `.tsx` et `.css` sont identiques à `32c581f` (HEAD au 2026-11-14).

## 0. Dérive de l'arbre de travail (constat du 2026-11-14)

Le chantier « prix et commandes », non commité, réécrit des fichiers cités ici. Dans ces fichiers, chercher le motif, pas la ligne. L'état ci-dessous est une photographie d'un arbre en mouvement : le refaire avant de s'y fier (`git diff --stat HEAD -- src` et `node .claude/skills/accessibility-wcag/scripts/a11y-counts.mjs`).

| Fichier | Dérive | Défauts de cet audit déjà corrigés dans l'arbre | Défauts toujours présents (motif à chercher) |
|---|---|---|---|
| `(client)/panier/page.tsx` | Réécrit : 1 096 → 824 lignes | Noms de « Retirer le code promo », « Jour précédent », « Jour suivant » ; une région `aria-live` et deux `role="alert"` sur le devis | Lien retour sans nom (`href={backHref}`) ; libellés génériques (`"Diminuer la quantité"`) ; champs invité sans étiquette (`placeholder="Email *"`) ; erreurs `text-[11px] text-red-500` non reliées ; radios sans `fieldset` (`name="timeSlot"`) ; `label` non relié au `textarea` ; `title="Frais fixes…"` ; champ code promo sans étiquette ; `<main>` imbriqué |
| `(boucher)/boucher/commandes/page.tsx` | + 16 lignes (décalage de 3 à 16) | Un second bandeau `role="alert"` | Tout le reste : modales `fixed inset-0`, interrupteur `focus:outline-none`, `title=` seuls, onglets sans rôle |
| `product/ProductCard.tsx` | Décalage de 18 lignes | Aucun | `role: "button"` sur la carte (ligne 191 au lieu de 173) |
| `checkout/OrderCountdown.tsx` | + 31 lignes | Aucun | `role="dialog"` écrit à la main, `aria-live` qui parle chaque seconde, envoi automatique |
| `cart/CartItem.tsx`, `boucher/KitchenOrderCard.tsx`, `product/ProductSheet.tsx`, `TrancheSheet.tsx`, `WeightSheet.tsx`, `client/ProductQuickAdd.tsx`, `chat/ChatWidget.tsx`, `layout/BoucherNav.tsx` | Modifiés | Non relus ligne à ligne | Relire le fichier avant d'y travailler |

Comptages sur l'arbre de travail, là où ils diffèrent du §1 : régions live 6 (au lieu de 2), `focus:outline-none` 72 (74), `<label` 143 (148), champs 250 (256), `text-[10px]` 354 (358), `text-[11px]` 212 (214). Les autres comptages du script sont inchangés.

## 1. Chiffres clés

| Mesure (`src/`, fichiers `.tsx`) `[V5]` | Valeur | Lecture |
|---|---|---|
| Fichiers avec un calque `fixed inset-0` | 30, dont 27 sans Radix | Modales, tiroirs, menus mobiles, écrans pleins (`SplashScreen`, `AudioUnlockScreen`) : liste par `a11y-counts.mjs --list` |
| Fichiers qui consomment `ui/dialog`, `ui/sheet` ou `ConfirmDialog` | 7, dont 2 sans appelant (`CartDrawer`, `CartPanel`) | Les 5 vivants : `admin/shops`, `admin/users`, `admin/orders`, `panier/page.tsx`, `lib/hooks/use-cart.tsx`. `ui/sheet.tsx` n'a aucun appelant |
| `role="dialog"` écrits à la main | 8 fichiers | Sémantique posée, comportement absent (sauf `CartDrawer`) |
| `DialogTrigger` / `SheetTrigger` hors `ui/` | 0 | Aucun dialogue Radix ne rend le focus à son bouton d'ouverture (voir §3) |
| `aria-live`, `role="status"`, `role="alert"` | 2 occurrences | Presque aucun changement d'état n'est annoncé |
| `role="tab"`, `role="tablist"`, `aria-selected` | 0 | Les onglets du mode cuisine sont de simples boutons |
| `htmlFor` | 1, pour 148 `<label` et 256 champs | Étiquettes englobantes ou absentes |
| `aria-invalid`, `aria-describedby`, `aria-errormessage` | 1 | Les erreurs ne sont pas reliées aux champs |
| `focus:outline-none` | 74 | Sur 134 lignes contenant `outline-none`, 17 n'ont ni anneau ni changement de bordure au focus |
| `prefers-reduced-motion`, `motion-reduce:`, `motion-safe:` | 1 fichier (`OrderCountdown.tsx`) | Aucune règle globale dans `globals.css` |
| Classes `animate-pulse` / `ping` / `bounce` / `spin` | 239 | Dont des animations infinies en cuisine |
| `title=` | 86 (props de composants comprises) | Souvent seul nom d'un bouton icône |
| `aria-hidden` | 24 | `lucide-react` 0.378 ne le pose pas par défaut |
| `text-[10px]` / `text-[11px]` / `text-[9px]` ou `[8px]` | 358 / 214 / 45 | Pas un échec WCAG en soi ; aggrave chaque contraste limite |
| Fichiers contenant `<main` | 18 : `src/app/layout.tsx` et 17 autres | Ces 17 sont imbriqués dans le `<main id="main-content">` de `src/app/layout.tsx:183` |
| Systèmes de toast | 3 | `sonner` (47 fichiers) ; `NotificationToast` (4 fichiers appelants + le provider de `layout.tsx`) ; `Toast.tsx` (aucun appelant) |

Points déjà corrects, à conserver (nos primitives `ui/*` suivent le modèle shadcn/ui `[T14]`) : `lang="fr"` et lien d'évitement (`src/app/layout.tsx:152`, `:172`), anneau de focus de `Button` et `Input`, `aria-pressed` de `toggle-pill.tsx`, `role="alert"` du bandeau « Session expirée » (`commandes/page.tsx:714`), cibles de 44 px des contrôles de quantité de la page panier (`panier/page.tsx:100`, `:110`), `autoComplete` sur les champs invité.

## 2. Base de référence axe en production (2026-11-13)

Pixel 7 émulé, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`. Nombre de nœuds en échec. Scan rejoué le 2026-11-14 : mêmes règles, mêmes nombres (plancher des fourchettes ci-dessous) `[V3]`.

| Page | Thème clair | Thème sombre |
|---|---|---|
| `/` | `landmark-unique` 1 | `color-contrast` 6 à 12, `landmark-unique` 1 |
| `/panier` (vide) | `color-contrast` 2, `link-name` 1 | `color-contrast` 1 à 2, `link-name` 1 |
| `/boutique/boucherie-tarik` | `color-contrast` 26, `nested-interactive` 40 | `color-contrast` 49, `nested-interactive` 40 |
| `/boucherie-halal/chambery` | aucune | `color-contrast` 1 ou plus |
| `/bons-plans` | aucune | `color-contrast` 1 |

axe a aussi classé jusqu'à 43 nœuds `color-contrast` en « incomplete » (texte sur image ou dégradé) : à juger à l'œil. Les pages connectées, le panier rempli et le mode cuisine n'ont pas été scannés.

Ce que ces violations désignent dans le code :

- `nested-interactive` : `src/components/product/ProductCard.tsx:173` pose `role="button"` sur la carte entière, qui contient déjà le bouton d'ajout.
- `link-name` : lien retour sans nom, `panier/page.tsx:415` et `:452`.
- `color-contrast` 3,67:1 sur le bouton « Découvrir les boucheries » : défaut de `cn()`, voir §3.
- `color-contrast` 4,48:1 : `text-gray-500` sur le fond `#f8f6f3`.
- `color-contrast` 2,8:1 : texte blanc de 10 px sur `bg-orange-500` (« Plus que 3 »).
- `color-contrast` en sombre : `text-[#DC2626]` et `text-[#991B1B]` en petit texte sur fond sombre.

## 3. Défauts transverses, par priorité

### P0 — bloquent un parcours ou touchent tout le site

1. **`cn()` supprime la couleur du texte des boutons.** `src/lib/utils.ts` utilise `twMerge` non configuré : il prend nos tailles `text-body`, `text-body-lg`, `text-caption`, `text-subtitle`, `text-micro` pour des couleurs. Avec `size="sm"`, `"lg"` ou `"xl"`, `text-primary-foreground` disparaît et le bouton hérite du texte du corps (`#111827` sur `#DC2626` = 3,67:1 en clair, mesuré par axe en production). 46 des 108 `<Button>` sont dans ce cas (28 `sm`, 18 `lg`, aucun `xl`) `[V8][V9]`. Correctif : patron §2 de `patterns-composants.md`, écrit dans `design-klikgo`.
2. **Le focus n'est jamais rendu après un dialogue.** Dans `@radix-ui/react-dialog` 1.1.15, le dialogue modal annule le retour de focus par défaut et focalise son `Dialog.Trigger`. Nous n'en utilisons aucun : à la fermeture le focus tombe sur `<body>` (lu dans le code installé `[V1]`, reproduit par exécution dans jsdom `[V7][V9]` ; le test « dialogue » de `tests-playwright-axe.md` §5 le vérifiera dans le navigateur). Correctif : patron §3 (`DialogTrigger` quand c'est possible, sinon l'enveloppe dans `src/components/ui/dialog.tsx` et `sheet.tsx`).
3. **Modales écrites à la main.** Sans piège de focus ni arrière-plan inerte, et sans Échap (sauf `ImageRetouchModal`) : scanner QR (`commandes/page.tsx:489`), pause (`:511`), historique (`:1074`), `ItemUnavailableModal.tsx:46`, `PriceAdjustModal.tsx:166`, `ImageRetouchModal.tsx:149`, `checkout/OrderCountdown.tsx:147`, les feuilles produit (`product/ProductSheet.tsx`, `TrancheSheet.tsx`, `WeightSheet.tsx`, `client/ProductQuickAdd.tsx`). Là où `aria-modal="true"` est posé, l'arrière-plan reste pourtant atteignable au clavier. Deux fichiers ont le même défaut mais aucun appelant, donc rien à corriger : `order/RatingPopup.tsx:54` et `:89`, `order/QRScanner.tsx:67` (le scanner du mode cuisine est `boucher/QRScanner.tsx`).
4. **Formulaire invité du panier sans étiquettes.** `panier/page.tsx:655-699` : le texte indicatif sert d'étiquette et disparaît à la saisie ; erreurs en `text-[11px] text-red-500` (3,76:1) non reliées au champ, non annoncées, sans déplacement du focus.
5. **Mode cuisine toujours sombre, variantes `dark:` conditionnelles.** `src/app/(boucher)/layout.tsx:16` force `bg-[#0a0a0a]` mais la classe `.dark` dépend du thème choisi (`ThemeProvider.tsx`). En thème clair, `text-gray-500 dark:text-gray-400` rend `#6b7280` sur `#111` : 3,91:1. Correctif : classe `dark` sur le conteneur du mode cuisine.

### P1 — échecs de critères A ou AA localisés

| Fichier:ligne | Défaut | Critère |
|---|---|---|
| `product/ProductCard.tsx:173` | Carte `role="button"` contenant un bouton | 4.1.2 |
| `boucher/OrderAlertOverlay.tsx:30-49` | Plein écran `role="button"` contenant un bouton ; pas de `alertdialog`, focus non déplacé, trois animations infinies | 4.1.2, 2.4.3, 2.2.2 |
| `ui/NotificationBell.tsx:66-70`, `:109-137` | Pas d'`aria-expanded` ; panneau sans Échap ; `div role="button"` dans un `Link` ; émojis lus | 4.1.2, 2.1.1 |
| `ui/NotificationToast.tsx:64`, `:100` | Pile sans région live ; bouton fermer sans nom ; blanc sur `amber-500` 2,15:1, sur `emerald-600` 3,77:1 | 4.1.3, 4.1.2, 1.4.3 |
| `ui/Toast.tsx:38-56` (sans appelant) | Pas de région live | 4.1.3 |
| `cart/CartItem.tsx:65-79`, `:81-90` (sans appelant) | Boutons nommés par le seul signe « − » ou « + » ; suppression masquée par `sm:opacity-0` hors survol, donc invisible au focus clavier | 2.4.6, 2.4.7 |
| `panier/page.tsx:415`, `:452` | Lien retour sans nom | 2.4.4 |
| `panier/page.tsx:525`, `:735`, `:741`, `:859`, `:872` | Boutons icône sans nom (retirer le code, jour précédent, jour suivant) | 4.1.2 |
| `panier/page.tsx:553`, `:569` | Champ code promo sans étiquette ; erreur non reliée | 3.3.2, 3.3.1 |
| `panier/page.tsx:596` | Explication des frais dans un `title` : inatteignable au clavier et au toucher | 1.4.13, 2.1.1 |
| `panier/page.tsx:708-730`, `:811-853`, `:934-990` | Groupes de boutons radio sans `fieldset` ni `legend` | 1.3.1 |
| `panier/page.tsx:754-772`, `:890-908` | Créneau choisi signalé par la couleur seule ; « Chargement… » non annoncé | 1.4.1, 4.1.3 |
| `panier/page.tsx:782`, `:919` | `label` non relié au `textarea` | 1.3.1 |
| `checkout/OrderCountdown.tsx:191-195`, `:287` | Compte à rebours de 5 s annoncé chaque seconde, puis envoi automatique | 2.2.1 (à arbitrer) |
| `commandes/page.tsx:587-610` | Interrupteur « en ligne » sans nom ni rôle, `focus:outline-none`, 36 × 20 px sur mobile | 4.1.2, 2.4.7, 2.5.8 |
| `commandes/page.tsx:657-707` | Son, mode simple, scanner, réglages : nom porté par `title` seul ; 32 px sur mobile | 4.1.2 |
| `commandes/page.tsx:692-698` | État de connexion : icône seule, changement non annoncé | 1.1.1, 4.1.3 |
| `commandes/page.tsx:766-800` | Onglets sans sémantique d'onglets | 4.1.2 |
| `commandes/page.tsx` (textes vides) | `text-gray-600` 2,62:1 et `text-gray-700` 1,92:1 sur `#0a0a0a` | 1.4.3 |
| `ui/switch.tsx:26-27` | Anneau de focus à 30 % d'opacité (1,62:1) ; état « off » `stone-200` sur blanc (1,26:1) | 1.4.11 |
| `ui/sheet.tsx:37`, `:49`, `:81` (aucun appelant, mais brique cible des feuilles) | Pas de variantes sombres ; `#b5a99a` sur blanc 2,31:1 | 1.4.3 |
| `ui/StarRating.tsx:37-58` | `radiogroup` sans navigation aux flèches ; cible de 20 px en taille `sm` | 2.1.1, 2.5.8 |
| `ui/stepper.tsx:51`, `:71` (sans appelant) | « Diminuer » et « Augmenter » sans contexte ; valeur non annoncée | 2.4.6, 4.1.3 |
| `ui/FormWizard.tsx:36-65`, `:105` | Étapes sans `aria-current` ; libellé « ... » pendant l'envoi | 1.3.1, 4.1.2 |
| `src/styles/globals.css` | Aucune règle `prefers-reduced-motion` | 2.2.2, pratique `[T11]` |
| 17 fichiers (liste : `a11y-counts.mjs --list`) | `<main>` imbriqué dans celui de `src/app/layout.tsx` | Bonne pratique axe `landmark-no-duplicate-main` |

### P2 — règle maison des 44 px (CLAUDE.md) non tenue, mais ≥ 24 px

`ui/dialog.tsx:50` (32 px), `ui/sheet.tsx:48` (≈ 30 px), `ui/button.tsx:28` et `:31` (`sm` et `icon` : 40 px), `ui/stepper.tsx:29-30` (28 et 36 px), `ui/NotificationBell.tsx:69` (36 px), `cart/CartItem.tsx:68`, `:76`, `:85` (36 px), `ui/switch.tsx:26` (44 × 24 px), boutons d'en-tête du mode cuisine (32 à 36 px), nombreux boutons `text-[10px]` de `KitchenOrderCard.tsx`.

### Code sans appelant : ne pas corriger, arbitrer (point n° 8 de `SKILL.md`)

Aucun `import`, statique ou dynamique, ne vise ces fichiers `[V9]` : `cart/CartDrawer.tsx`, `cart/CartPanel.tsx`, `cart/CartItem.tsx`, `cart/CartFAB.tsx`, `checkout/cart-item.tsx`, `order/RatingPopup.tsx`, `order/QRScanner.tsx`, `ui/stepper.tsx`, `ui/toggle-pill.tsx`, `ui/Toast.tsx`.

`CartDrawer.tsx` illustre le risque d'un piège de focus maison : le sien (`:29-72`) entre en conflit avec le dialogue Radix qu'il contient (`:171`), car l'écouteur `keydown` posé sur `document` ferme le tiroir quand on presse Échap dans la confirmation.

`ui/sheet.tsx` n'a pas d'appelant non plus, mais c'est la brique vers laquelle migrent les feuilles produit : la garder et la réparer.

## 4. Contrastes mesurés

Texte normal : 4,5:1. Grand texte (≥ 24 px, ou ≥ 18,5 px gras) et éléments non textuels : 3:1 `[W1][W10][W11]`.

| Paire | Ratio | Verdict |
|---|---|---|
| Blanc sur `#DC2626` | 4,83 | OK texte |
| Blanc sur `hsl(var(--primary))` = `#E01F1F` | 4,79 | OK texte |
| `#DC2626` sur blanc | 4,83 | OK texte |
| `#DC2626` sur `#f8f6f3` | 4,48 | Échec petit texte, OK grand texte et icône |
| `#DC2626` sur `#0a0a0a` / `#141414` | 4,10 / 3,81 | Échec petit texte, OK grand texte et icône |
| `#b91c1c` sur `#f8f6f3` / blanc | 6,00 / 6,47 | OK : rouge de texte en clair |
| `#f87171` (`red-400`) sur `#0a0a0a` / `#141414` | 7,16 / 6,66 | OK : rouge de texte en sombre |
| `red-500` `#ef4444` sur blanc | 3,76 | Échec : messages d'erreur actuels |
| `gray-500` sur blanc / `#f8f6f3` | 4,83 / 4,48 | OK / échec |
| `gray-600` sur blanc / `#f8f6f3` | 7,56 / 7,01 | OK : gris secondaire sûr en clair |
| `gray-400` sur blanc | 2,54 | Échec |
| `gray-400` sur `#0a0a0a` / `#141414` | 7,80 / 7,26 | OK : gris secondaire sûr en sombre |
| `gray-500` sur `#0a0a0a` / `#111` / `#141414` | 4,10 / 3,91 / 3,81 | Échec |
| `gray-600` / `gray-700` sur `#0a0a0a` | 2,62 / 1,92 | Échec |
| `#78716C` / `#57534E` sur `#111` | 3,94 / 2,48 | Échec |
| `muted-foreground` sur blanc / sur `muted` | 4,74 / 4,07 | OK / échec |
| Blanc sur `--success` `#21C45D` / `--warning` `#F59F0A` | 2,30 / 2,13 | Échec |
| Blanc sur `emerald-600` / `emerald-700` | 3,77 / 5,48 | Échec / OK |
| Blanc sur `amber-700` `#b45309` | 5,02 | OK |
| Noir sur `amber-500` | 9,78 | OK |
| Blanc sur `orange-500` `#f97316` | 2,8 (mesuré par axe) | Échec |
| Blanc à 70 % sur `#DC2626` | 2,99 | Échec |
| `#b5a99a` sur blanc | 2,31 | Échec |
| Anneau `#DC2626` à 30 % sur blanc | 1,62 | Échec non textuel |
| Anneau `#DC2626` plein sur blanc / `#0a0a0a` | 4,83 / 4,10 | OK non textuel |
| Bordure de champ `#ece8e3` ou `--border` sur blanc | 1,22 / 1,24 | Insuffisant si la bordure est le seul indice du champ |
| Interrupteur « off » `stone-200` sur blanc | 1,26 | Échec non textuel |
| Interrupteur cuisine `#3F3F46` sur `#111` | 1,81 | Échec non textuel |
