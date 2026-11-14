# États, cibles tactiles, mouvement, responsive

## 1. La matrice d'états : aucun composant interactif n'est « fini » sans elle

| État | Classes de référence | Règle | Source |
|---|---|---|---|
| Repos | celles de la variante | Le contrôle se reconnaît sans survol : forme, libellé ou icône contrastée. | [S15] |
| Survol | `hover:bg-primary-hover`, `hover:bg-muted` | Le survol **fonce** un aplat, jamais ne l'éclaircit (`primary/90` : 4,33:1). Rien d'essentiel ne dépend du survol : un écran tactile ne survole pas. | [S8], [S14] |
| Focus clavier | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | Anneau plein de 2 px, contraste ≥ 3:1 avec le fond. Jamais `outline-none` seul. Jamais d'anneau à 20 ou 30 % d'opacité (1,63:1). | [S15], [S17] |
| Appui | `motion-safe:active:scale-[0.97]` | Retour immédiat, 100 à 150 ms. | |
| Désactivé | `disabled:pointer-events-none disabled:opacity-50`, attribut `disabled` réel | Un vrai `disabled`, pas une `div` grisée. Texte exempté de contraste. Dire pourquoi à côté (« Choisissez un créneau »). | [S14] |
| Chargement | `<Button loading>` : `disabled` + `aria-busy` + `Loader2 animate-spin` ; page : `loading.tsx` avec `Skeleton` | Le libellé reste visible, la largeur ne change pas. Double clic impossible. | |
| Erreur | `aria-invalid`, `aria-[invalid=true]:border-destructive`, message `role="alert"` relié par `aria-describedby` | Texte + bordure, pas la couleur seule. Message qui dit quoi faire. | [S19] |
| Sélectionné, actif | `aria-pressed`, `aria-current="page"`, `data-[state=on]` | L'état est dans le DOM, le style le lit (`aria-pressed:bg-primary`). Pas de couleur seule : graisse, coche ou filet en plus. | [S7], [S19] |
| Vide | `EmptyState` | Icône, phrase, action suivante. | |
| Succès | `toast.success(...)` ou changement d'état visible à l'endroit de l'action | Jamais une action sans retour. | |

Variantes Tailwind 3.4.19 utiles (toutes compilées avec notre config) : `focus-visible:`, `disabled:`, `aria-busy:`, `aria-pressed:`, `aria-expanded:`, `aria-[invalid=true]:`, `data-[state=open]:`, `group-hover:`, `peer-*:`, `has-[:checked]:`, `motion-safe:`, `motion-reduce:`, `forced-colors:` ([S7]).

Pièges constatés dans ce code :

- `focus:` (282) au lieu de `focus-visible:` (39) : sur un bouton, l'anneau apparaît aussi au clic souris. Sur un champ texte les deux se valent ; garder `focus-visible:` partout pour n'avoir qu'une convention.
- `focus-visible:outline-none` de Tailwind 3 pose un contour transparent (`outline: 2px solid transparent`) qui redevient visible en mode couleurs forcées de Windows : le garder, ne pas écrire `outline: 0` en CSS brut. En Tailwind 4 cette classe s'appellera `outline-hidden` ([S8]).
- Révélation au survol seul (`opacity-0 group-hover:opacity-100`, 6 fichiers : `ShopCard`, `boucher/images/page.tsx`, les trois modales d'image boucher, et `CartItem` qui n'est monté nulle part) : ajouter `group-focus-within:opacity-100` et rendre visible sans survol sur tactile (`[@media(hover:none)]:opacity-100`).
- Placeholder par défaut de Tailwind 3 : `gray-400`, 2,54:1 sur blanc. Toujours `placeholder:text-muted-foreground`. Le placeholder ne remplace jamais le `<label>`.
- `transition-all` (204) : anime aussi la mise en page. Écrire `transition-colors`, `transition-transform`, `transition-opacity` ou `transition-shadow`.

## 2. Cibles tactiles

| Référence | Seuil |
|---|---|
| `CLAUDE.md` (règle projet, non négociable) | ≥ 44 px |
| WCAG 2.2 — 2.5.8 niveau AA | 24 × 24 px CSS, ou espacement équivalent ([S16]) |
| WCAG 2.2 — 2.5.5 niveau AAA | 44 × 44 px CSS ([S16]) |
| Apple | 44 × 44 points ([S24]) |
| Material / Android, web.dev | 48 dp, environ 9 mm, cibles espacées d'environ 8 px ([S21], [S23]) |

Application :

- Contrôle standard : `h-12` ; compact : `h-11` ; bouton d'icône : `size-11` ; mode cuisine (tablette, mains occupées) : `h-14` et plus.
- Une icône reste petite, c'est la zone cliquable qui grandit ([S25]). Deux écritures : `size-11` avec l'icône centrée, ou, si le visuel doit rester à 32 px, `relative after:absolute after:-inset-2` (zone étendue de 8 px de chaque côté, compilé).
- Cibles voisines séparées d'au moins `gap-2`.
- Dette : 45 boutons ou liens carrés de 28 à 36 px (sur 143 carrés `w-7 h-7` à `w-9 h-9`, les 98 autres étant des pastilles d'icône, avatars ou spinners), le bouton de fermeture de `dialog.tsx` (32 px), `Button size="sm"` et `size="icon"` (40 px), `Stepper` en `sm` et `md` (28 et 36 px).

## 3. Mouvement

Durées, alignées sur les jetons Material (courtes 50–200 ms, moyennes 250–400 ms, longues 450–600 ms, [S23]) et sur les valeurs Tailwind déjà employées :

| Usage | Durée | Classe |
|---|---|---|
| Couleur, appui, petite icône | 150 ms | `duration-150` |
| Survol de carte, apparition d'un élément | 200 ms | `duration-200` |
| Entrée ou sortie de modale, feuille, tiroir | 300 ms à l'entrée, 200 ms à la sortie | `data-[state=open]:duration-300 data-[state=closed]:duration-200` (un `duration-300` nu est ignoré, voir plus bas) |
| Au-delà de 400 ms | réservé au héros et au splash, jamais à une action répétée | |

Règles :

- N'animer que `transform` et `opacity` : ce sont les propriétés qui restent sur l'étape de composition ; éviter ce qui déclenche mise en page ou peinture (`top`, `left`, `width`, `height`, ombre lourde) ([S21]). Pas de `will-change` préventif.
- Entrée en décélération (`ease-out`), sortie plus courte que l'entrée.
- Animations nommées par `CLAUDE.md` : `fade-in`, `fade-up`, `slide-up`, `scale-in`, `pulse-soft`, `shimmer`. Cinq d'entre elles existent en double (config et `globals.css`, B6 ; `pulse-soft` n'est que dans la config) : c'est la version de `globals.css` qui s'applique. Ne pas en créer une septième sans supprimer un doublon.
- Entrées et sorties des modales Radix : classes `tailwindcss-animate` pilotées par `data-state` ([composants.md](composants.md) §6). `animate-in` et `animate-out` fixent 150 ms ; une autre durée s'écrit avec le même préfixe (`data-[state=open]:duration-300`), sinon elle est ignorée (B13, vérifié dans Chromium).
- Animation en boucle (`animate-pulse`, `animate-bounce-gentle`, `animate-ring`) : seulement pour un état qui exige une action (nouvelle commande en cuisine, minuteur en fin de course). Jamais décorative.
- Squelettes : `animate-pulse` sur des blocs à la taille réelle du contenu, pour ne pas décaler la page à l'arrivée des données.

### Mouvement réduit

Aujourd'hui : zéro `motion-safe:`/`motion-reduce:` dans le code, un seul test JavaScript (`OrderCountdown.tsx`). Les mouvements déclenchés par une interaction doivent pouvoir être désactivés (WCAG 2.3.3, niveau AAA, technique C39 avec `prefers-reduced-motion`, [S18]) ; les changements de couleur ou d'opacité ne sont pas du « mouvement ».

Dans le code nouveau :

```tsx
<div className="motion-safe:animate-fade-up">…</div>
<button className="transition-colors motion-safe:active:scale-[0.97] motion-safe:hover:scale-[1.02]">…</button>
```

Filet de sécurité ciblé, à ajouter une seule fois à la fin de `globals.css` (lot 4 ; compilé avec notre config). Il coupe les classes d'animation maison, y compris celles que `motion-safe:` ne peut pas atteindre parce qu'elles sont déclarées hors `@layer` :

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-up, .animate-fade-in, .animate-scale-in, .animate-slide-up,
  .animate-pulse-slow, .animate-bounce-gentle, .animate-ring, .flash-green, .flash-red {
    animation: none !important;
  }
}
```

Sans animation, les éléments en `fade-up`, `fade-in` ou `scale-in` s'affichent directement dans leur état final : rien ne reste invisible.

Règle fourre-tout `*, *::before, *::after { animation-duration: 0.01ms !important; … }` : ne pas l'ajouter tant que le point A19 n'est pas tranché, et jamais en plus du filet ciblé. web.dev la présente comme une feuille de style que l'utilisateur injecte lui-même, sans garantie ([S21]) ; elle figerait les 155 indicateurs `animate-spin`, qui sont de l'information, et peut casser un code qui attend `animationend`. Le skill `accessibility-wcag` renvoie à ce bloc (sa règle 11 et son patron §12) et porte le même point à arbitrer (son n° 9) : le bloc CSS n'existe qu'ici, ne pas en écrire un second ailleurs.

En JavaScript : `window.matchMedia("(prefers-reduced-motion: reduce)")` avec écoute de `change` ([S21]). Les alertes du mode cuisine gardent leur signal sans mouvement : couleur, bandeau, son.

### Survol sur écran tactile

Aujourd'hui aucune des quelque 200 règles `hover:` de la feuille de production n'est conditionnée par une requête média (201 puis 202 relevées sur `/` les 2026-11-13 et 14, aucune sous `@media (hover: hover)`) : elles s'appliquent aussi au toucher, le style « colle » après un tap. Tailwind 3 propose l'option `future: { hoverOnlyWhenSupported: true }` qui enveloppe chaque `hover:` et chaque `group-hover:` dans `@media (hover: hover) and (pointer: fine)` (vérifié dans `node_modules/tailwindcss` 3.4.19 et à la compilation ; introduite en 3.1, [S8]). Tailwind 4 fait de même par défaut avec `@media (hover: hover)` ([S8]). Conséquence à traiter avant de l'activer : les éléments révélés au seul `group-hover` ne s'afficheraient plus jamais sur un téléphone. Changement global à valider : point A10 de [points-a-arbitrer.md](points-a-arbitrer.md).

## 4. Responsive

| Règle | Détail |
|---|---|
| Base mobile 375 px (`CLAUDE.md`) | Les classes sans préfixe décrivent le téléphone ; `md:` (768) tablette, `lg:` (1024) bureau. `sm:` (640) existe 270 fois : l'accepter pour un ajustement de grille, ne pas en faire un quatrième palier de mise en page. |
| Rien ne casse à 320 px | Pas de défilement horizontal, pas de perte d'information (WCAG 1.4.10 AA, [S20]). Tableaux du back-office : défilement interne `overflow-x-auto` sur le tableau seul. |
| Grilles de produits | `ProductGrid.tsx` utilise une grille intrinsèque `repeat(auto-fill, minmax(150px, 1fr))`, écart 8 px : 2 colonnes à 375 px, puis autant que la largeur en accepte, sans palier. La réutiliser (`grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2`) plutôt que d'empiler des `grid-cols-N`. Images `aspect-[4/3] object-cover object-center` (`CLAUDE.md`). |
| Hauteur d'écran | `min-h-screen` est déjà corrigé en `100dvh` par `globals.css` ; pour une hauteur maximale écrire `max-h-[90dvh]`, pas `vh`. |
| Zones sûres iOS | Barre du bas et feuilles : `pb-safe-bottom` ou `pb-[calc(1.25rem+env(safe-area-inset-bottom))]`. Élément fixe au-dessus de la barre : `bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6`. Les `sticky top-0` sont décalés par `globals.css`. |
| Pas de valeur responsive en `style={{}}` | Un style inline l'emporte sur toute classe `md:` (bug B9 de `CartFAB`). |
| Focus sous une barre fixe | Un élément qui reçoit le focus ne doit pas être entièrement masqué par la barre du bas, le FAB ou le bandeau cookies (WCAG 2.4.11 AA) : `scroll-pb-24` sur le conteneur qui défile ([S17]). |
| Tablette cuisine | Disposition de `CLAUDE.md` : 3 colonnes au bureau, 4 onglets au mobile, les deux sections « En cours » toujours visibles. Ne pas la réinventer. |
| Rendu serveur | Pas de `window.innerWidth` ni de `Date.now()` au premier rendu (`CLAUDE.md`) : le responsive se fait en CSS, pas en JavaScript. |

Contrôle minimal avant de rendre un écran : 375 px clair, 375 px sombre, 320 px, 768 px, 1280 px ; navigation au clavier (Tab, Entrée, Échap) ; `page.emulateMedia({ reducedMotion: "reduce" })` disponible dans Playwright 1.59 pour le mouvement réduit. Outils : skills `qa` ou `browse`, projet Playwright `mobile` (Pixel 7) ; l'audit d'accessibilité détaillé relève du skill `accessibility-wcag`.

Écrans protégés (mode cuisine, back-office boucher, webmaster, admin) : ils ne se regardent qu'en local ou sur un aperçu, avec le mode test de `CLAUDE.md`. Depuis le commit `2364ef9`, la session de test est un jeton signé posé par `POST /api/test-mode/activate` (ou `?testmode=<TEST_SECRET>` dans l'URL) ; poser à la main les cookies lisibles `klikgo-test-activated` et `klikgo-test-role` ne donne plus aucun droit, et le mode test est impossible en production. Détail : skill `clerk-auth`. En production, seules les pages publiques se mesurent, en lecture seule.
