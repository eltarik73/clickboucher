# État des lieux mesuré — HEAD `161f920` (2026-11-13)

Tout ce qui suit a été mesuré sur le dépôt, pas supposé. Les mesures ont été refaites deux fois par des vérificateurs indépendants, le 2026-11-13 puis le 2026-11-14, à `32c581f` (aucun `.tsx` ni fichier de style modifié depuis `161f920`) : scripts relancés sur une extraction propre de `HEAD`, CSS recompilé, `twMerge` réexécuté, extraits recompilés en `strict`, production relue dans un navigateur. Les chiffres corrigés sont signalés par « recompté », les constats ajoutés par « ajouté le 2026-11-14 ».

**Arbre de travail et chantier de tarification.** Les chiffres valent pour `HEAD`. Le chantier de tarification en cours (non fusionné au 2026-11-14) modifie 25 fichiers d'interface, dont `(client)/panier/page.tsx` (réécrit), `CartItem`, `ProductCard`, `KitchenOrderCard`, `ProductSheet`, `TrancheSheet`, `WeightSheet`, les deux `OrderTicket` et `boucher/commandes/page.tsx`. Sur son arbre : 300 fichiers, 65 597 lignes, 107 `<Button>`, 569 `<button>`, 2 187 valeurs hex hors fond de page, 22 boutons touchés par B1 ; `--check` y passe (dette en baisse). Le socle (`src/components/ui`, `globals.css`, `tailwind.config.ts`, `src/lib/utils.ts`, `src/app/layout.tsx`) n'est pas touché. Pour re-mesurer :

```bash
node .claude/skills/design-klikgo/scripts/design-audit.mjs            # tout src/
node .claude/skills/design-klikgo/scripts/design-audit.mjs --dir="src/app/(client)"
node .claude/skills/design-klikgo/scripts/contrast.mjs --tokens       # paires de tokens de globals.css

# Une classe est-elle réellement émise ? (sortie hors dépôt ; 0 = absente du CSS)
node_modules/.bin/tailwindcss -c tailwind.config.ts -i src/styles/globals.css -o /tmp/klikgo.css
grep -cF '.bg-indigo-500\/10' /tmp/klikgo.css
```

Périmètre : 301 fichiers `.tsx`, 66 013 lignes sous `src/`.

## 1. Versions installées (lues dans `node_modules`)

| Paquet | Version | Conséquence |
|---|---|---|
| `tailwindcss` | 3.4.19 | Config JS (`tailwind.config.ts`), `darkMode: ["class"]`, pas de `@theme`. `content` : `./src/components/**` et `./src/app/**` seulement (voir B12). `size-*`, `min-h-dvh`, `text-balance`, `has-[]`, `motion-safe:`, `forced-colors:` disponibles. |
| `tailwind-merge` | 2.6.1 | Ne connaît pas nos noms de thème personnalisés (voir bug B1). |
| `class-variance-authority` | 0.7.1 | `cva`, `VariantProps`, `compoundVariants` (clé `class` ou `className`). |
| `@radix-ui/react-dialog` | 1.1.15 | Seule primitive Radix installée avec `@radix-ui/react-slot` 1.2.4. |
| `tailwindcss-animate` | 1.0.7 | Fournit `animate-in/out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`. `animate-in` et `animate-out` fixent eux-mêmes `animation-duration: 150ms` (voir B13). Dépôt sans commit depuis 2024-07. |
| `lucide-react` | 0.378.0 | N'ajoute **pas** `aria-hidden` par défaut (la doc actuelle décrit une version plus récente). |
| `sonner` | 1.7.4 | `<Toaster position="top-center" richColors />` dans `src/app/layout.tsx`. |
| `react` / `next` | 18.3.1 / 14.2.35 | `React.forwardRef` reste obligatoire pour transmettre une ref. |
| `prettier-plugin-tailwindcss` | 0.6.14 | Trie les classes ; option `tailwindFunctions` non configurée. |

Absents : `components.json` (pas de CLI shadcn), `next-themes`, `vaul`, `tw-animate-css`, `radix-ui` (paquet unifié), tout plugin ESLint Tailwind.

## 2. Chiffres de dérive

| Mesure | Valeur | Lecture |
|---|---|---|
| Couleurs hex arbitraires `[#…]` | 2 545 occurrences, 78 valeurs distinctes | Le rouge est écrit `[#DC2626]` 835 fois, `red-600` 229 fois, `primary` 68 fois. |
| Tokens sémantiques (`bg-card`, `text-muted-foreground`…) | 196 usages au total | Ils existent mais ne sont presque pas utilisés. |
| Variantes `dark:` | 6 518 | Le mode sombre est fait à la main, classe par classe. |
| Familles de gris | `gray` 6 177, `stone` 324, `zinc` 29, `neutral` 10, `slate` 4 | 5 familles pour un seul rôle. |
| Rayons | `rounded-xl` 733, `rounded-lg` 405, `rounded-full` 388, `rounded-2xl` 342, `rounded` 186, arbitraires 94 | `rounded-lg` vaut 20 px ici (voir B3). |
| Tailles de texte | Tailwind 2 832, projet (`text-body`…) 36, arbitraires 682 | 621 occurrences sous 12 px (`text-[10px]` 358, `text-[11px]` 214, `text-[9px]` 36). |
| Graisses | `font-medium` 514, `font-extrabold`/`font-black` 105 | Graisses non chargées (voir [typographie.md](typographie.md)). |
| Focus | `focus:` 282, `focus-visible:` 39, anneaux translucides 95 (dont 92 en `focus:` ou `focus-visible:`) | `ring-[#DC2626]/30` = 1,63:1 sur blanc, `ring-red-500/30` = 1,50:1. |
| Mouvement | `transition-all` 204, `motion-reduce:`/`motion-safe:` 0 | Aucune prise en compte de `prefers-reduced-motion` en CSS. |
| Boutons | `<Button>` 108, `<button>` brut 575 | 57 des 108 `<Button>` redéfinissent le fond via `className`. |
| Champs | `<Input>` 55, `<input>` brut 149, `<select>` 28, `<textarea>` 24 | Sur ces 201 champs bruts, 159 sont en `text-sm` (14 px) et 14 en `text-xs` (recompté) ; `ui/input.tsx` est en `text-body` (15 px). |
| Overlays | 30 fichiers avec `fixed inset-0`, 21 sans `role="dialog"`/`aria-modal`/Radix | Pas de piège de focus ni d'Échap. Le compte inclut deux écrans pleins qui ne sont pas des modales (`SplashScreen`, `AudioUnlockScreen`) et deux menus mobiles plein écran (`AdminNav`, `WebmasterNav`) : à trier avant de planifier. |
| `confirm()` / `alert()` natifs | 8 | `ConfirmDialog` existe (2 imports). |
| États | `aria-invalid` 0, `aria-busy` 0, `aria-live` ou `role="status"` ou `role="alert"` 2 | Les erreurs et chargements ne sont pas annoncés. |
| Squelettes | `<Skeleton>` 0 usage ; 22 `loading.tsx` en `animate-pulse` écrits à la main | |
| Cibles tactiles | 143 carrés de 28 à 36 px (`w-7 h-7` à `w-9 h-9`), dont **45** portés par un `<button>`, `<a>`, `<Link>` ou `<Button>` (recompté) | Ces 45 sont sous le seuil projet de 44 px ; les 98 autres sont des pastilles d'icône, avatars ou spinners. |
| Emojis dans le source | 308 | Certains sont prescrits par `CLAUDE.md` (📅, 🔑). |

## 3. Paires clair/sombre les plus fréquentes (les tokens de fait)

Méthode de comptage : une chaîne de classes qui contient exactement une couleur claire et une couleur `dark:` de la même famille (`bg`, `text` ou `border`), même séparées par d'autres classes. Une recherche du motif littéral accolé donne donc un chiffre un peu différent (392 pour `bg-white dark:bg-[#141414]`, par exemple).

| Paire écrite à la main | Occurrences | Token existant équivalent |
|---|---|---|
| `text-gray-500 dark:text-gray-400` | 1 181 | `text-muted-foreground` |
| `text-gray-900 dark:text-white` (+ `dark:text-[#f8f6f3]` 107) | 649 | `text-foreground` |
| `bg-white dark:bg-[#141414]` | 405 | `bg-card` (identique au pixel) |
| `border-gray-200 dark:border-white/10` | 277 | `border-border` |
| `text-gray-700 dark:text-gray-300` | 265 | aucun (niveau intermédiaire) |
| `text-gray-600 dark:text-gray-400` | 208 | aucun |
| `border-[#ece8e3] dark:border-white/10` | 170 | `border-border` |
| `border-gray-100 dark:border-white/10` | 115 | `border-border` |
| `bg-[#f8f6f3] dark:bg-[#0a0a0a]` | 96 | `bg-background` après alignement du token |
| `bg-gray-100 dark:bg-white/5` | 95 | `bg-muted` |
| Sans paire : `bg-[#DC2626]` 187, `text-[#DC2626]` 237, `bg-red-600` 73 | | `bg-primary`, `text-primary` |

## 4. Bugs prouvés (reproductibles)

**B0 — DM Sans et Outfit ne sont pas affichées en production.** Mesuré sur klikandgo.app le 2026-11-13 (`getComputedStyle` + `document.fonts`) :

| Mesure | Valeur |
|---|---|
| `font-family` calculée du `<body>` | `"DM Sans", sans-serif` (nom littéral) |
| `font-family` calculée d'un `.font-display` | `Outfit, sans-serif` (nom littéral) |
| Familles réellement déclarées par `next/font` | `__DM_Sans_d065d5`, `__Outfit_07f9cb`, `__Cormorant_Garamond_ed02b4` |
| Faces chargées (`status === "loaded"`) | 0 sur 20 (confirmé par la seconde mesure) |
| Largeur d'un texte témoin, pile du body / `sans-serif` seul | 1 044,17 px / 1 044,17 px : c'est la police générique `sans-serif` de l'appareil qui s'affiche (seconde mesure, autre texte : 1 054,89 px / 1 054,89 px ; troisième, le 2026-11-14 : 725,81 px / 725,81 px) |
| `--font-body` sur `:root` / sur `<body>` | vide / `"__DM_Sans_d065d5",…` |
| `font-family` calculée de `<html>` | `Times` : la pile `font-sans` du preflight Tailwind commence par `var(--font-body)`, indéfinie à cet endroit, donc la déclaration est invalide (ajouté le 2026-11-14 ; sans effet visible, `<body>` la remplace) |

Cause : `src/app/layout.tsx` pose `dmSans.variable`, `outfit.variable`, `cormorant.variable` sur `<body>`, alors que `globals.css` calcule `--font-body-stack: var(--font-body, "DM Sans"), sans-serif` et `--font-display-stack` sur `:root`. À cet endroit `--font-body` n'existe pas : le repli littéral `"DM Sans"` est retenu, puis hérité tel quel. Le nom littéral ne correspond à aucune famille déclarée. `.font-display` de `globals.css` (qui écrase celle de la config, voir B6) subit le même sort. Seule `font-serif` fonctionne (13 usages), car elle est résolue sur l'élément. Deux fichiers `.woff2` sont préchargés pour rien.

Correctif vérifié (simulé dans le DOM de la page de production) : poser les trois classes `*.variable` sur `<html>` comme dans la doc Next.js. Après simulation : `font-family` du body = `__DM_Sans_d065d5, …`, `.font-display` = `__Outfit_07f9cb, …`, faces DM Sans 400/600/700 et Outfit 700 chargées, texte témoin à 1 087,37 px (+4,1 % ; +3,7 % puis +3,4 % aux deux mesures suivantes, sur d'autres textes). Le changement est visible sur tout le site : voir [typographie.md](typographie.md) §1 avant de l'appliquer. Effet de bord sur les graisses : DM Sans n'est chargée qu'en 400, 600 et 700 ; une fois le correctif posé, les 514 `font-medium` rendront du 400 sur tous les appareils (voir [typographie.md](typographie.md) §2 et le point A8). Aujourd'hui le rendu dépend de la police générique de l'appareil. Mesuré sur macOS (Chromium, 2026-11-14) : elle n'a ni 500 ni 600, donc `font-medium` y rend déjà du 400 et `font-semibold` du 700 ; après correctif `font-semibold` y deviendra un vrai 600, plus léger qu'aujourd'hui. Non mesuré sur Android ni sur iOS : là où la police générique possède un 500, `font-medium` perdra son emphase.

**B1 — `cn()` supprime des classes des primitives (visible en production).** `tailwind-merge` 2.6.1 prend `text-body`, `text-body-lg`, `text-caption`, `text-micro`… pour des couleurs de texte : la dernière classe `text-*` écrase les autres. Vérifié en exécutant le `twMerge` installé sur la sortie de `buttonVariants` :

| Appel | Classes supprimées |
|---|---|
| `<Button>` (défaut) | `text-body` (taille 15 px perdue) |
| `<Button size="sm">`, `size="lg"`, `size="xl"` | `text-primary-foreground` (ou `text-destructive-foreground`, `text-secondary-foreground`) : **la couleur du texte disparaît**, le bouton hérite de `text-gray-900` du `<body>` |
| `<Badge>`, toutes variantes (27 usages) | `text-micro` : sans taille passée en `className`, la pastille prend la taille de texte de son parent au lieu de 11 px (ajouté le 2026-11-14) |
| `CardTitle` avec une couleur de texte en `className` | `text-subtitle` |
| `shadow-sm` + `shadow-glow` | aucune des deux n'est retirée (pas de fusion) |

Impact mesuré sur les 108 `<Button>` (recompté : le premier comptage coupait la balise au premier `=>` et en manquait) : 49 perdent leur classe de taille de texte, 43 perdent leur couleur de variante, dont **23 sans couleur de remplacement** (les autres ajoutent `text-white` dans `className`), plus un 24ᵉ dont la variante est dynamique. Fichiers touchés : `(client)/panier/page.tsx` (3, dont les deux « Confirmer ma commande »), `(client)/commandes/page.tsx` (3), `(client)/inscription-pro/page.tsx` (4), `(client)/inscription-boucher/page.tsx` (2), `(client)/profil/page.tsx` (2), `(client)/pro/page.tsx`, `(client)/validation/[id]/page.tsx`, `(boucher)/boucher/clients/page.tsx` (2), `(boucher)/boucher/produits/page.tsx` (2), `boucher/order-row.tsx` (1, et le bouton à variante dynamique), `boucher/stock-issue-wizard.tsx` (2). Le défaut ne se voit qu'en thème clair : en sombre le `<body>` est en texte blanc.

Constat en production (klikandgo.app/panier, panier vide, mode clair, 2026-11-13, relu les 13 et 14 par les vérificateurs) : le bouton « Découvrir les boucheries » a `color: rgb(17, 24, 39)` sur `background-color: rgb(220, 38, 38)`, soit un texte presque noir sur rouge, 3,67:1 au lieu du blanc à 4,83:1. Ses classes rendues ne contiennent plus ni `text-primary-foreground`, ni `text-body`, ni `bg-primary`.

Correctif vérifié : `extendTailwindMerge` dans `src/lib/utils.ts` ([composants.md](composants.md) §2).

**B2 — Bordure blanche des `Card` en mode sombre.** `.dark { --border: 0 0% 100% / 0.1 }` contient un alpha. Toute classe `border-border/NN` (`/50` dans `card.tsx`, `/30` dans `boucher/order-detail.tsx`, `/60` trois fois dans `validation/[id]/page.tsx`) compile en `hsl(var(--border) / 0.5)`, soit `hsl(0 0% 100% / 0.1 / 0.5)` : valeur invalide, la bordure retombe sur `currentColor` (texte quasi blanc). `border-border` sans modificateur reste valide. La doc Tailwind v3 demande des variables réduites aux canaux, sans fonction de couleur ; un alpha dans la variable casse de la même façon le modificateur d'opacité.

**B3 — Échelle de rayons non monotone.** `tailwind.config.ts` redéfinit `lg`, `md`, `sm` à partir de `--radius: 20px`. CSS compilé :

| Classe | Rendu réel | Valeur Tailwind par défaut |
|---|---|---|
| `rounded-sm` | 12 px | 2 px |
| `rounded` | 4 px | 4 px |
| `rounded-md` | 16 px | 6 px |
| `rounded-lg` | **20 px** | 8 px |
| `rounded-xl` | 12 px | 12 px |
| `rounded-2xl` | 16 px | 16 px |
| `rounded-3xl` | 24 px | 24 px |

`<Button size="sm">` (`rounded-lg`) est donc plus arrondi que le bouton par défaut (`rounded-xl`).

**B4 — Classes sans CSS.** `tap-scale` (11), `no-scrollbar` (1), `scrollbar-hide` (2) ne sont définies nulle part : aucun effet.

**B5 — Tokens d'état illisibles.** `--success` (#21c45d) et `--warning` (#f59f0a) avec texte blanc : 2,30:1 et 2,14:1. `Badge variant="sponsored"` (`text-accent` sur `bg-accent/10`) : 1,15:1, texte invisible.

**B6 — Animations définies deux fois.** `animate-fade-up`, `animate-fade-in`, `animate-scale-in`, `animate-shimmer`, `animate-slide-up` et `.font-display` existent dans `tailwind.config.ts` **et** dans `globals.css` ; c'est la version de `globals.css` qui gagne. Les entrées correspondantes de la config sont du code mort.

**B7 — Flash clair au chargement en mode sombre.** `ThemeProvider` applique `.dark` dans un `useEffect` : un utilisateur en sombre voit la page claire jusqu'à l'hydratation. Pas de lecture de `prefers-color-scheme`.

**B8 — `--primary` n'est pas `#DC2626`.** `0 76% 50%` donne `#E01F1F`. `#DC2626` = `0 72.2% 50.6%`.

**B9 — Style inline plus fort que la variante responsive.** `CartFAB.tsx` : `style={{ bottom: … }}` annule `md:bottom-6`. Le défaut ne se voit pas aujourd'hui, `CartFAB` n'étant monté nulle part (voir §5) ; la règle vaut pour tout composant.

**B10 — Polices nommées en dur.** `ui/sheet.tsx` (`'Cormorant Garamond'`), `boucher/commandes/page.tsx` (`"Outfit…"`), `chat/OrderTicketBubble.tsx` (`"DM Sans, sans-serif"`) : `next/font` génère un nom de famille haché, le nom littéral ne correspond à aucune police déclarée et le navigateur prend la police générique. `ProductSheet.tsx` et `TrancheSheet.tsx` écrivent `"Georgia"`, police système qui n'appartient pas aux trois familles du design system.

**B11 — Deux « sources uniques » de couleurs de statut.** `src/lib/design-tokens.ts` (5 imports) et `src/components/ui/status-badge.tsx` (0 import), plus 11 cartes locales. Libellés et couleurs divergent ; les paires de `design-tokens.ts` échouent en clair (ambre 2,95:1, émeraude 3,42:1). Détail : [tokens.md](tokens.md) §6.

**B12 — Classes écrites hors du `content` de Tailwind (ajouté le 2026-11-14).** `tailwind.config.ts` ne fait lire que `./src/components/**` et `./src/app/**`. Une classe écrite dans `src/lib/**` ou `src/hooks/**` n'est émise que si la même chaîne existe aussi dans un fichier lu. CSS complet recompilé : huit classes de `src/lib/design-tokens.ts` sont absentes, `bg-indigo-500/10`, `bg-green-500/10`, `bg-orange-500/10`, `bg-gray-400/10` (`ORDER_STATUS_COLORS`) et `border-t-amber-400`, `border-t-blue-400`, `border-t-indigo-400`, `border-t-emerald-400` (`ORDER_STATUS_BORDER`, sans appelant). Conséquence visible : dans `webmaster/commandes` et `webmaster/boutiques/[shopId]`, les pastilles PREPARING, COMPLETED, PARTIALLY_DENIED et AUTO_CANCELLED ont leur couleur de texte mais aucun fond. Les autres classes du fichier ne fonctionnent que parce qu'elles sont répétées ailleurs. Correctif vérifié à la compilation : ajouter `"./src/lib/**/*.{ts,tsx}"` à `content` (les huit classes apparaissent, la feuille grossit de moins de 1 Ko).

**B13 — Durées d'animation sans effet sur les modales (ajouté le 2026-11-14).** `ui/dialog.tsx` écrit `duration-200` et `ui/sheet.tsx` `duration-300` à côté de `data-[state=open]:animate-in`. La règle `.data-[state=open]:animate-in[data-state="open"]` de `tailwindcss-animate` pose `animation-duration: 150ms` avec une spécificité supérieure à celle de `.duration-300` : dans Chromium la durée calculée reste `0.15s`. Écrite `data-[state=open]:duration-300`, elle vaut bien `0.3s`.

## 5. Primitives de `src/components/ui` : vivantes ou mortes

| Fichier | Fichiers importeurs | Statut |
|---|---|---|
| `button.tsx` | 27 | vivant |
| `badge.tsx` | 12 | vivant |
| `card.tsx`, `input.tsx` | 11, 11 | vivants |
| `SafeImage.tsx` | 10 | vivant |
| `KlikLogo.tsx` | 8 (et `layout/KlikGoLogo.tsx` 2) | doublon |
| `dialog.tsx` | 6 | vivant, couleurs en dur |
| `switch.tsx`, `NotificationToast.tsx` | 5, 5 | vivants |
| `ConfirmDialog.tsx`, `StarRating.tsx` | 2, 2 | vivants |
| `separator.tsx`, `FormWizard.tsx` | 1, 1 | vivants |
| `sheet.tsx`, `skeleton.tsx`, `status-badge.tsx`, `stepper.tsx`, `toggle-pill.tsx`, `empty-state.tsx`, `quick-actions.tsx`, `Toast.tsx` | 0 | **code mort** |
| `layout/bottom-nav.tsx` (doublon de `layout/BottomNav.tsx`), `layout/section-header.tsx`, `layout/index.ts`, `product/QuantityPicker.tsx` | 0 | **code mort** |
| `layout/client-header.tsx`, `layout/page-container.tsx` | 1, 2 | vivants, usage marginal (`(client)/pro`, `validation/[id]`) |
| `cart/CartFAB.tsx`, `cart/CartDrawer.tsx`, `cart/CartPanel.tsx` (et `cart/CartItem.tsx`, importé par ces deux derniers seulement), `checkout/cart-item.tsx` | 0 | **code mort** (ajouté le 2026-11-14) : le panier réel est `(client)/panier/page.tsx`. `CLAUDE.md` les cite encore dans sa structure : leur sort relève du point à arbitrer n° 8 du skill `accessibility-wcag`. Ne pas les prendre pour modèle ni y passer un lot de convergence. |

Trois systèmes de toast coexistent : `sonner` (47 fichiers), `NotificationToast` (5), `Toast.tsx` (0).
