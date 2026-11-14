# Tokens : couleurs, rayons, ombres, couches, espacement

Les tokens vivent à deux endroits, toujours modifiés ensemble :

- `src/styles/globals.css` : variables CSS sous `:root` (clair) et `.dark` (sombre), au format shadcn `H S% L%` **sans** `hsl()` et **sans** alpha.
- `tailwind.config.ts` : `theme.extend.colors` les expose (`primary: "hsl(var(--primary))"`), ce qui autorise `bg-primary/90`.

Tailwind ne lit que `src/app/**` et `src/components/**` (`content`) : une classe de token ou de palette écrite dans `src/lib/**` n'est pas émise (bug B12 de [etat-des-lieux.md](etat-des-lieux.md)).

Vocabulaire ([S28]) : un token est une valeur nommée ; un alias en référence une autre. Chez nous, deux niveaux seulement : la palette Tailwind (`red-600`, `gray-500`) fournit les valeurs brutes, les tokens sémantiques (`primary`, `card`, `muted-foreground`) disent le rôle. Un composant ne cite que le rôle.

Ratios ci-dessous calculés avec `scripts/contrast.mjs` (formule WCAG 2.x). Seuils : 4,5:1 texte normal ; 3:1 grand texte (18 pt, ou 14 pt gras, soit environ 24 px et 18,5 px) et composants d'interface ([S14], [S15]).

## 1. Valeurs réelles des tokens (HEAD `161f920`)

| Token | Clair | Hex | Sombre | Hex | Rôle |
|---|---|---|---|---|---|
| `background` | `0 0% 100%` | #ffffff | `0 0% 0%` | #000000 | fond de page |
| `foreground` | `24 20% 14%` | #2b221d | `0 0% 98%` | #fafafa | texte principal |
| `card` / `popover` | `0 0% 100%` | #ffffff | `0 0% 8%` | #141414 | surface posée sur la page |
| `primary` / `destructive` / `ring` | `0 76% 50%` | #e01f1f | idem | #e01f1f | action principale, danger, focus |
| `secondary` / `muted` / `accent` | `30 15% 93%` | #f0edea | `0 0% 12%` | #1f1f1f | surface discrète |
| `muted-foreground` | `24 5% 45%` | #78726d | `0 0% 55%` | #8c8c8c | texte secondaire |
| `border` / `input` | `30 15% 90%` | #e9e6e2 | `0 0% 100% / 0.1` | blanc 10 % | filets |
| `success` | `142 71% 45%` | #21c45d | idem | | état positif |
| `warning` | `38 92% 50%` | #f59f0a | idem | | état d'attention |

Variables hors convention, héritées d'un ancien thème et sans usage Tailwind : `--burgundy` (#7a1023), `--orange`, `--radius-sm`, `--radius-xs`. `::selection` en clair utilise encore `--burgundy-hex`. `THEME` dans `src/lib/utils.ts` nomme `burgundy` la valeur `#DC2626` : ne pas s'y fier, la marque est **rouge `#DC2626`**, pas bordeaux.

## 2. Ce que disent les contrastes

| Paire | Ratio | Verdict |
|---|---|---|
| blanc sur `#DC2626` (bouton primaire) | 4,83 | AA |
| blanc sur `#b91c1c` (survol de fait : 107 `hover:bg-[#b91c1c]`, 122 occurrences de la valeur) | 6,47 | AA |
| blanc sur `primary/90` posé sur blanc (survol de `button.tsx`) | 4,33 (4,35 avec le token actuel `#e01f1f`) | **échec** : le survol éclaircit le bouton |
| `#DC2626` en texte sur blanc | 4,83 | AA |
| `#DC2626` en texte sur `#f8f6f3` | 4,48 | échec de peu |
| `#DC2626` en texte sur `#141414` / `#0a0a0a` | 3,81 / 4,10 | **échec** en petit texte (237 `text-[#DC2626]` sans variante sombre) |
| `red-400` (#f87171) sur `#141414` / `#0a0a0a` | 6,66 / 7,16 | AA : c'est le rouge de texte en sombre |
| `red-700` (#b91c1c) sur `#f8f6f3` / `red-50` | 6,00 / 5,91 | AA : rouge de texte sur fond beige ou teinté |
| `muted-foreground` clair sur blanc / `#f8f6f3` / `muted` | 4,76 / 4,41 / 4,08 | AA sur blanc seulement |
| `gray-500` sur blanc / `#f8f6f3` / `gray-100` | 4,83 / 4,48 / 4,39 | AA sur blanc seulement |
| `gray-400`, `stone-400`, `#999` sur blanc | 2,54 / 2,52 / 2,85 | **échec** en mode clair |
| `gray-400` sur `#141414` | 7,26 | AA : correct **en sombre** |
| `gray-500` / `gray-600` sur `#141414` | 3,81 / 2,44 | **échec** en sombre (cuisine) |
| blanc sur `success` / `warning` (tokens actuels) | 2,30 / 2,14 | **échec** |
| blanc sur `emerald-600` / `green-600` / `amber-500` / `amber-600` / `orange-500` | 3,77 / 3,30 / 2,15 / 3,19 / 2,80 | **échec** (56 aplats de ce type) |
| blanc sur `emerald-700` / `green-700` / `amber-700` / `orange-700` | 5,48 / 5,02 / 5,02 / 5,18 | AA |
| `amber-950` (#451a03) sur `amber-500` | 6,97 | AA : texte sombre sur ambre vif |
| anneau `ring-[#DC2626]/30` sur blanc | 1,63 | **échec** du 3:1 (95 anneaux translucides) |
| anneau `#DC2626` plein sur blanc / `#141414` | 4,83 / 3,81 | conforme au 3:1 |
| filets `gray-200`, `#ece8e3` sur blanc | 1,24 / 1,22 | décoratifs : ne doivent pas être le seul indice d'un champ |

Rappels de norme : le texte d'un composant **désactivé** est exempté de contraste, le **placeholder** ne l'est pas ([S14]). Un filet de champ n'est exigé à 3:1 que s'il est le seul moyen de repérer le champ ([S15]). La couleur ne doit jamais être le seul porteur d'une information ([S19]).

## 3. Règles de choix d'une couleur

| Besoin | Classe à écrire | Ne pas écrire |
|---|---|---|
| Fond de page | rien si le layout du groupe le pose (`(boucher)`, `(admin)`, `webmaster`) ; sinon la paire existante `bg-[#f8f6f3] dark:bg-[#0a0a0a]` ; `bg-background` seulement après alignement du token (§4, point A14) | `bg-background` aujourd'hui (blanc / noir), une nouvelle valeur hex |
| Carte, feuille, modale | `bg-card text-card-foreground` | `bg-white dark:bg-[#141414]` |
| Texte principal | `text-foreground` | `text-gray-900 dark:text-white` |
| Texte secondaire | sur carte ou fond blanc : `text-muted-foreground` (4,76). Directement sur le fond beige ou sur `bg-muted`, tant que le token n'est pas foncé (§4 ; 4,41 et 4,08 aujourd'hui) : `text-gray-600 dark:text-gray-400` (7,01 et 6,49) | `text-gray-400` en clair, `text-gray-500` sur beige ou en sombre |
| Filet | `border-border` | `border-border/50` tant que le token sombre contient un alpha (§4) |
| Surface discrète (puce, champ, zone survolée) | `bg-muted` | `bg-gray-100 dark:bg-white/5` |
| Action principale | `bg-primary text-primary-foreground` | `bg-[#DC2626] text-white`, `bg-red-600` |
| Rouge en texte (prix promo, lien) | `text-primary dark:text-red-400` ; sur fond beige ou teinté `text-red-700 dark:text-red-400` | `text-[#DC2626]` seul |
| Aplat de succès / d'attention | `bg-emerald-700 text-white` ; `bg-amber-500 text-amber-950` ou `bg-amber-700 text-white` | `bg-emerald-600 text-white`, `bg-amber-500 text-white` |
| État en pastille teintée | paire `X-100` + `X-700`, sombre `X-900/20` + `X-300` (§6) | `bg-X-500/10 text-X-600` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | `focus:ring-[#DC2626]/30` |

Une couleur absente de ce tableau se cherche d'abord dans la palette Tailwind (`red`, `emerald`, `amber`, `blue`, `gray`). Une valeur `[#…]` n'est admise que pour une couleur imposée de l'extérieur (logo tiers, couleur d'étiquette saisie par le boucher), avec un commentaire. La doc Tailwind réserve les valeurs arbitraires aux cas ponctuels et le thème aux choix durables ([S5]).

Une seule famille de gris pour le code nouveau : `gray`, et seulement là où aucun token ne convient. `stone`, `zinc`, `neutral`, `slate` ne s'étendent pas.

## 4. Corrections de tokens recommandées (valeurs vérifiées)

À appliquer dans `globals.css` dans un lot dédié, avec contrôle visuel. Chaque ligne a été recalculée ou compilée avec nos versions.

| Token | Valeur actuelle | Valeur proposée | Effet |
|---|---|---|---|
| `--primary`, `--ring`, `--destructive` | `0 76% 50%` (#e01f1f) | `0 72.2% 50.6%` | exactement `#DC2626`, blanc dessus 4,83:1 |
| `--primary-hover` (nouveau, + `primary.hover` dans la config) | absent | `0 73.7% 41.8%` | exactement `#b91c1c` ; `hover:bg-primary-hover` remplace `hover:bg-primary/90` et les 107 `hover:bg-[#b91c1c]` |
| `--background` clair / sombre | `0 0% 100%` / `0 0% 0%` | `36 26.3% 96.3%` / `0 0% 3.9%` | exactement `#f8f6f3` / `#0a0a0a`, comme l'exige `CLAUDE.md` |
| `--muted-foreground` clair | `24 5% 45%` | `24 6% 40%` (#6c6560) | 5,74 sur blanc, 5,32 sur `#f8f6f3`, 4,92 sur `muted` |
| `--border`, `--input` sombre | `0 0% 100% / 0.1` | `0 0% 17%` (#2b2b2b) | équivalent opaque du blanc 10 % sur `#141414` ; `border-border/50` redevient valide |
| `--success` + `--success-foreground` | `142 71% 45%` + blanc | `142 72% 29%` + blanc | blanc dessus 5,07:1 |
| `--warning` + `--warning-foreground` | `38 92% 50%` + blanc | `26 90% 37%` + blanc | blanc dessus 5,04:1 |

Après `--background` beige, `ring-offset-background` suit la page ; le héros reste `bg-white` (règle `CLAUDE.md`) et les cartes `bg-card`. Les tokens `success` et `warning` restent des **aplats** : en texte sur teinte 10 % ils plafonnent à 4,4:1, d'où la règle des paires de palette (§6).

Contrôle : `node .claude/skills/design-klikgo/scripts/contrast.mjs --tokens`. Aujourd'hui il signale 7 défauts sur les paires garanties (5 de contraste, 2 tokens avec alpha) et sort en code 1 ; avec les valeurs ci-dessus (essai sur une copie de `globals.css`) il affiche « Toutes les paires garanties passent ». Les lignes `info` rappellent les usages déconseillés par le §3 (token d'aplat employé comme couleur de texte) sans influer sur le code de sortie.

La colonne « Token » de `--primary-hover` suppose l'ajout, dans `tailwind.config.ts`, de `primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", hover: "hsl(var(--primary-hover))" }` (compilé : `hover:bg-primary-hover` génère `background-color: hsl(var(--primary-hover))`).

## 5. Ajouter un token : quatre gestes, sinon rien

1. Déclarer la variable dans `:root` **et** dans `.dark` (`globals.css`), canaux seuls : `--info: 217 91% 40%;`. La doc Tailwind v3 précise que la fonction de couleur dans la variable casse les modificateurs d'opacité ([S4]).
2. L'exposer dans `tailwind.config.ts` : `info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))" }`. Convention shadcn : le token nu est le fond, `-foreground` le texte posé dessus ([S1]).
3. Si le nom ajouté n'est pas une couleur (taille de texte, ombre, z-index nommé), le déclarer dans `extendTailwindMerge` ([composants.md](composants.md) §2), sinon `cn()` le confondra avec autre chose ([S9]).
4. Vérifier les paires avec `contrast.mjs` et ajouter la paire à la liste `guaranteed` du script.

Un token se justifie à partir de trois usages dans trois fichiers. En dessous, classe de palette.

## 6. Couleurs d'état : une seule table

Répartition à tenir, à cause du `content` de Tailwind (B12) :

| Quoi | Où | Pourquoi |
|---|---|---|
| Libellés (`ORDER_STATUS_LABELS`, `SHOP_STATUS_LABELS`) et hex pour Recharts (`ORDER_STATUS_HEX`) | `src/lib/design-tokens.ts` | données pures, déjà importées par `order-state-machine.ts` |
| Classes Tailwind des statuts | `src/components/ui/status-badge.tsx` (`OrderStatusBadge`, `ShopStatusBadge`) | fichier lu par Tailwind ; rendu unique à brancher sur les libellés ci-dessus |
| `ORDER_STATUS_COLORS`, `SHOP_STATUS_COLORS`, `ORDER_STATUS_BORDER` de `design-tokens.ts` | à retirer une fois leurs appelants passés à `status-badge` : trois pages (`webmaster/commandes`, `webmaster/boutiques`, `webmaster/boutiques/[shopId]`) et `getStatusColor()` de `order-state-machine.ts` (aucun appelant dans l'interface) | huit de leurs classes ne sont pas émises, la plupart de leurs paires échouent au contraste |

Tant que des classes restent dans `src/lib`, ajouter `"./src/lib/**/*.{ts,tsx}"` au `content` de `tailwind.config.ts` (lot 0d de [convergence.md](convergence.md)). Les 11 cartes locales (`boucher/dashboard/page.tsx`, `admin/orders/page.tsx`, `(client)/commandes/page.tsx`, `order-row.tsx`…) sont à supprimer au fil des passages.

Paires à utiliser, toutes vérifiées. Ce sont celles de `status-badge.tsx` à deux retouches près, à faire dans ce fichier : `text-amber-700` devient `text-amber-800` (PENDING, BUSY) et `text-gray-500` devient `text-gray-600` (CANCELLED, AUTO_CANCELLED, repli « Inconnu » : 4,39 aujourd'hui).

| Statut | Clair | Ratio | Sombre | Ratio sur #141414 |
|---|---|---|---|---|
| En attente | `bg-amber-100 text-amber-800` | 6,37 (`amber-700` : 4,51, trop juste) | `bg-amber-900/20 text-amber-300` | 11,63 |
| Acceptée | `bg-blue-100 text-blue-700` | 5,49 | `bg-blue-900/20 text-blue-300` | 9,45 |
| En préparation | `bg-indigo-100 text-indigo-700` | 6,41 | `bg-indigo-900/20 text-indigo-300` | 8,65 |
| Prête / ouvert | `bg-emerald-100 text-emerald-700` | 4,84 | `bg-emerald-900/20 text-emerald-300` | 11,08 |
| Refusée / en pause | `bg-red-100 text-red-700` | 5,30 | `bg-red-900/20 text-red-300` | 9,06 |
| Partielle | `bg-orange-100 text-orange-700` | 4,52 | `bg-orange-900/20 text-orange-300` | 10,02 |
| Annulée / fermée / récupérée | `bg-gray-100 text-gray-600` | 6,87 | `bg-gray-800 text-gray-400` | 5,78 |
| Terminée | `bg-green-100 text-green-700` | 4,57 | `bg-green-900/20 text-green-300` | 11,90 |
| Vacances | `bg-purple-100 text-purple-700` | 5,92 | `bg-purple-900/20 text-purple-300` | 9,79 |

Les paires actuelles de `design-tokens.ts` (`bg-amber-500/10 text-amber-600` 2,95 ; `text-emerald-600` 3,42 ; `text-green-600` 3,02 ; `text-red-500` 3,30 ; `text-gray-400` 2,34) échouent en mode clair. Le libellé accompagne toujours la couleur ([S19]).

## 7. Rayons

Rendu réel des classes : voir [etat-des-lieux.md](etat-des-lieux.md) B3. Règle pour le code nouveau, tant que l'arbitrage sur `--radius` n'est pas rendu :

| Élément | Classe | Rendu |
|---|---|---|
| Étiquette, puce de promo, mini-pastille | `rounded` | 4 px |
| Bouton, champ, puce de filtre, vignette | `rounded-xl` | 12 px |
| Carte, modale, feuille (`rounded-t-2xl`) | `rounded-2xl` | 16 px (valeur de `CLAUDE.md`) |
| Pilule, avatar, bouton d'icône | `rounded-full` | |
| Interdits en code nouveau | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-[…]` | rendus trompeurs (12, 16, 20 px) |

Emboîtement : rayon intérieur = rayon extérieur moins l'espacement. Une image en haut d'une carte `rounded-2xl` se rogne par `overflow-hidden` sur la carte, pas par un second rayon.

## 8. Ombres et élévation

`CLAUDE.md` nomme `soft`, `card`, `elevated`, `glow`. Usage réel : `shadow-sm` 177, `shadow-lg` 32, `shadow-md` 28, `shadow-elevated` 5, `shadow-glow` 2, `shadow-card` 1, arbitraires 43.

| Niveau | Classe | Pour |
|---|---|---|
| 0 | aucun, filet `border-border` | listes, lignes, surfaces en mode sombre |
| 1 | `shadow-card` (porté par `<Card>`) ou `shadow-sm` | carte posée sur la page |
| 2 | `shadow-elevated` | élément flottant : FAB, barre collante, menu |
| 3 | `shadow-lg` | modale, feuille (porté par `dialog.tsx`, `sheet.tsx`) |

En sombre, une ombre noire sur fond noir ne se voit pas : l'élévation se lit par la surface (`bg-card` plus clair que `bg-background`) et le filet. Geist procède de même : peu de niveaux, le rayon et l'ombre croissent avec l'élévation ([S22]). `shadow-glow` et les ombres colorées (`shadow-red-500/30`) sont à l'arbitrage (préférence de sobriété du fondateur).

## 9. Couches (`z-index`)

Convention, à partir des usages réels :

| Couche | Classe | Occupants |
|---|---|---|
| Local à un composant | `z-10`, `z-20` | pastille sur une image, en-tête collant d'un tableau |
| En-tête collant de page | `z-30` | |
| Navigation fixe, élément flottant | `z-40` | `BoucherNav`, `WebmasterNav` |
| Overlay, modale, feuille | `z-50` | `dialog.tsx`, `sheet.tsx`, panneau de `ChatWidget` (son bouton flottant est aussi en `z-50` : à ramener en `z-40`) |
| Bandeau au-dessus des modales | `z-[60]` | `AnalyticsConsent` |
| Modale ouverte depuis le mode cuisine | `z-[70]`, `z-[80]` | historique de `boucher/commandes/page.tsx` (70), `PriceAdjustModal`, `ItemUnavailableModal` (80) |
| Alerte nouvelle commande | `z-[90]` | `OrderAlertOverlay` |
| Toast, hors ligne, lien d'évitement | `z-[100]` | `NotificationToast`, `OfflineBanner` |

Anomalie connue : `layout/BottomNav.tsx` est en `z-50`, au niveau des modales ; il doit passer en `z-40`. Jamais de `z-[9999]` hors `SplashScreen` et `TestRoleSwitcher`. Une modale Radix est rendue dans un portail : inutile de surenchérir sur le `z-index` d'un parent.

## 10. Espacement et largeur

Le code est déjà sur l'échelle Tailwind (une trentaine d'espacements arbitraires seulement). Rythme observé à conserver :

| Usage | Valeurs |
|---|---|
| Gouttière de page mobile | `px-4` (16 px), `px-5` dans les héros |
| Intérieur de carte | `p-4`, `p-5` pour les cartes principales (`CardHeader`/`CardContent` sont en `p-5`) |
| Entre éléments d'une ligne | `gap-2` (585 usages), `gap-3` |
| Entre blocs | `gap-4`, `space-y-4`, `space-y-6` entre sections |
| Contrôles | `h-12` par défaut, `h-11` compact, `h-14` et plus en cuisine |
| Conteneurs | lecture `max-w-xl`/`max-w-2xl`, back-office `max-w-4xl`, vitrine `max-w-6xl` |

Tokens d'espacement du projet : `pb-safe-bottom` (`env(safe-area-inset-bottom)`), `h-nav-height` (5 rem). Une largeur ou hauteur `[…px]` reste admise pour une dimension dictée par le contenu (ticket 80 mm, vignette).
