# Typographie

## 1. Les polices : ce qui est chargé, ce qui est affiché

`src/app/layout.tsx` charge trois familles avec `next/font/google` (auto-hébergées : le navigateur n'appelle pas Google, [S13]) :

| Famille | Variable | Graisses chargées | Classe Tailwind | Rôle (`CLAUDE.md`) |
|---|---|---|---|---|
| DM Sans | `--font-body` | 400, 600, 700 | `font-sans` (défaut du `<body>`) | texte courant |
| Outfit | `--font-display` | 500, 700, 800 | `font-display` | titres, chiffres clés, logo |
| Cormorant Garamond | `--font-serif` | 500 (`preload: false`) | `font-serif` | accent rare (13 usages) |

**État en production au 2026-11-13 : ni DM Sans ni Outfit ne s'affichent** (bug B0 de [etat-des-lieux.md](etat-des-lieux.md)). Les variables `next/font` sont posées sur `<body>` alors que `globals.css` construit `--font-body-stack` et `--font-display-stack` sur `:root`, où elles n'existent pas.

Correctif (vérifié par simulation sur la page de production) :

```tsx
// src/app/layout.tsx — les variables de police vont sur <html>, comme dans la doc Next.js [S13]
<html lang="fr" className={`${dmSans.variable} ${outfit.variable} ${cormorant.variable}`} suppressHydrationWarning>
  <body className="bg-white text-gray-900 antialiased dark:bg-black dark:text-white">
```

Ce correctif change l'aspect de tout le site : DM Sans est 3 à 4 % plus large que la police générique mesurée (1 087 px contre 1 044 px sur un texte témoin à 32 px ; +3,7 % et +3,4 % sur deux autres textes). À livrer seul, avec contrôle visuel à 375 px des écrans denses : `ProductCard` en 4 colonnes, libellés de `BottomNav` (10 px), `KitchenOrderCard`, tableaux du back-office, ticket `OrderTicket` (qui a ses propres styles d'impression). Le fondateur doit valider le rendu : c'est la première fois que la typographie prévue s'affichera.

Règles permanentes :

- Jamais de nom de police en dur (`fontFamily: "'Cormorant Garamond'"`, `"Georgia"`, `"Outfit"`). `next/font` génère un nom haché (`__Outfit_07f9cb`) : un nom littéral ne correspond à rien. Écrire `font-display`, `font-serif`, ou `style={{ fontFamily: "var(--font-display)" }}` quand une classe est impossible. Exception : `opengraph-image.tsx` et `icon.tsx` (rendu `ImageResponse`, hors CSS du site).
- Pas de quatrième famille. Chaque police est une ressource de plus à télécharger ([S13]).
- Les `<link rel="preconnect">` vers `fonts.googleapis.com` et `fonts.gstatic.com` de `layout.tsx` ne servent à rien avec `next/font` ; leur retrait relève de `web-performance` et contredit une ligne de `CLAUDE.md` : voir [points-a-arbitrer.md](points-a-arbitrer.md).

## 2. Graisses : n'utiliser que celles qui existent

Quand une graisse demandée n'est pas chargée, le navigateur en choisit une autre selon un algorithme fixe ([S26]) : entre 400 et 500 il cherche vers 500 puis descend ; au-dessus de 500 il monte puis descend.

| Classe | Sur DM Sans (400/600/700) | Sur Outfit (500/700/800) |
|---|---|---|
| `font-normal` (400) | 400 | 500 |
| `font-medium` (500) | **400** : identique à `font-normal` (514 usages) | 500 |
| `font-semibold` (600) | 600 | **700** |
| `font-bold` (700) | 700 | 700 |
| `font-extrabold` (800), `font-black` (900) | **700** : identique à `font-bold` (105 usages) | 800 |

Conséquences :

- Texte courant : trois niveaux seulement, `font-normal`, `font-semibold`, `font-bold`. `font-medium` ne distingue rien ; pour une emphase légère écrire `font-semibold`.
- Titres en `font-display` : `font-bold` (700) par défaut, `font-extrabold` (800) pour le héros et les gros chiffres. `font-display font-semibold` rend du 700.
- Charger DM Sans 500 est possible (une ligne dans `layout.tsx`) mais c'est un fichier de plus : décision à l'arbitrage, pas au fil de l'eau.

## 3. Deux échelles coexistent

| Échelle | Classes | Usages | Où |
|---|---|---|---|
| Tailwind | `text-xs` 12 px, `text-sm` 14, `text-base` 16, `text-lg` 18, `text-xl` 20, `text-2xl` 24, `text-3xl` 30… | 2 832 | pages et composants métier |
| Projet (`tailwind.config.ts`) | `text-micro` 11 px/600, `text-caption` 13/500, `text-body` 15/400, `text-body-lg` 17/400, `text-subtitle` 20/600, `text-title` 28/700, `text-hero` 40/700 | 36 | primitives de `src/components/ui` |
| Arbitraire | `text-[10px]` 358, `text-[11px]` 214, `text-[9px]` 36, `text-[13px]` 28… | 682 | partout |

Les classes de l'échelle projet fixent aussi l'interligne, l'approche et la graisse. Tant que `cn()` n'est pas corrigé (B1), elles sont supprimées dès qu'une couleur de texte suit : ne pas les combiner à une classe `text-<couleur>` dans un appel `cn()` sans le correctif.

Règle de décision en attendant l'arbitrage sur l'échelle canonique :

| Rôle | Classe |
|---|---|
| Titre de page (`h1`) | `font-display text-2xl font-bold`, `md:text-3xl` sur les pages vitrines |
| Titre de section (`h2`) | `font-display text-xl font-bold` |
| Titre de carte (`h3`) | `text-base font-semibold` |
| Texte courant | `text-sm` en interface dense, `text-base` en lecture (pages SEO, CGV, héros) |
| Texte secondaire, légende | `text-sm text-muted-foreground` ou `text-xs text-muted-foreground` |
| Libellé de pastille, compteur | `text-xs font-semibold` ; `text-micro` (11 px) uniquement pour une étiquette d'un ou deux mots |
| Prix | `font-bold tabular-nums` ; total en `font-display text-xl font-extrabold tabular-nums` |
| Mode cuisine | une taille au-dessus de l'équivalent client, jamais sous 14 px (`text-sm`) : lecture à bout de bras sur tablette ; numéro de commande en `text-lg` ou plus, minuteur en `font-mono tabular-nums` |

Dans `src/components/ui`, conserver les tokens projet déjà en place. Ne jamais écrire `text-[Npx]` : si aucune classe ne convient, c'est l'échelle qu'il faut faire arbitrer.

## 4. Taille minimale

- Plancher pour une phrase : 12 px (`text-xs`). Geist, référence de sobriété retenue par le fondateur, n'a aucun style sous 12 px et réserve le 12 px au texte tertiaire des vues chargées ([S22]). Apple recommande au moins 11 points pour rester lisible sans zoom ([S24]).
- 11 px (`text-micro`) : étiquettes courtes en gras uniquement.
- 10 px et moins : dette (407 occurrences de 7 à 10 px). Ne pas en ajouter. Ne remonter une taille existante qu'avec contrôle visuel à 375 px, les mises en page compactes (`ProductCard`, `BottomNav`) ayant été réglées dessus.
- WCAG ne fixe pas de taille minimale mais exige que le contenu reste utilisable à 320 px de large sans défilement horizontal ([S20]) : ne pas compenser un texte trop long par une police plus petite, tronquer (`truncate`, `line-clamp-2`) ou passer à la ligne.

## 5. Détails qui comptent

- Chiffres qui changent (prix, quantités, minuteurs, compteurs) : `tabular-nums`, sinon la largeur saute à chaque mise à jour.
- Titres sur deux lignes : `text-balance` (disponible en 3.4.19). Paragraphes : `text-pretty`.
- Hiérarchie par la graisse et la couleur avant la taille : `text-foreground font-semibold` contre `text-muted-foreground`, plutôt que trois tailles voisines.
- Champs de saisie : `text-base md:text-sm` (16 px sur mobile), comme le composant `Input` officiel de shadcn ([S31]). Raison habituellement donnée : iOS Safari zoome sur un champ de moins de 16 px. **Non corroboré par une source Apple ou WebKit** : vérifier sur un iPhone réel avant de généraliser aux champs bruts (173 sur 201 sont en `text-sm` ou `text-xs`) et à `ui/input.tsx` (`text-body`, 15 px). Ne jamais « corriger » ce zoom avec `maximum-scale=1` ou `user-scalable=no` (aucun des deux n'est présent aujourd'hui, à préserver).
- Pages SEO (`/boucherie-halal/[ville]`, fiche boutique) : une retouche typographique ne change ni la hiérarchie `h1`–`h3` ni le texte indexable ; toute modification de structure passe par le skill `seo-anti-penalty`.
- Prénom client : format `Prénom.N` imposé par `CLAUDE.md`, sans style particulier.
