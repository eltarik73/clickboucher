# Odeurs de code : exemples réels de Klik&Go

Chaque odeur de la liste de base (Fowler, _Refactoring_, ch. 3, noms repris, texte à nous) avec un
exemple trouvé dans ce dépôt, le mouvement de remaniement qui la traite et la gravité à retenir en
relecture. Une odeur est un jugement : on écrit « odeur possible », on montre l'alternative plus
simple, et une règle du dépôt l'emporte toujours. Les exemples citent des fichiers et des
symboles, pas des numéros de ligne : chercher par nom, l'arbre bouge. Les nombres d'occurrences
sont dans `architecture-conventions/references/etat-du-code.md` et dans l'état des lieux de
`quality-gates`, avec la commande qui les re-mesure.

## Sommaire

1. Code dupliqué
2. Chirurgie au fusil
3. Switch répétés
4. Envie de fonctionnalité (règle métier recalculée sur place)
5. Obsession des primitifs
6. Groupes de données
7. Intermédiaire inutile
8. Généralité spéculative et code mort
9. Changement divergent
10. Nom mystérieux
11. Fonction longue
12. Grille de gravité

## 1. Code dupliqué

**Exemple** : le prix en euros est mis en forme par `formatPrice` (`src/lib/utils.ts`), par
`formatPriceCents` (`src/lib/format-kitchen.ts`), par des `fmtPrice` locaux
(`src/lib/emails/order-confirmation.ts`, `src/lib/emails/order-receipt.ts`,
`src/components/client/ProductQuickAdd.tsx`) et par une flèche locale dans
`src/components/boucher/OrderAlertOverlay.tsx`. Les poids aussi : `formatWeight`
(`src/lib/utils.ts`) affiche 1 234 g en « 1.2 kg » (point, arrondi), `formatGrams`
(`src/lib/pricing/format.ts`) en « 1,234 kg » (virgule, sans arrondi).

**Recherche** : `rg -n "(function|const) (formatPrice|fmtPrice)\b" src`.

**Mouvement** : garder une fonction, remplacer chaque copie par un appel (Inline Function sur la
copie, puis appel de l'original) ; un fichier par commit, tests de mise en forme inchangés.

**Gravité** : `mineur` pour une copie identique de mise en forme. `majeur` quand deux copies
divergent sur ce que voit le client ou le boucher (les deux formats de poids ci-dessus), parce que
`CLAUDE.md` fait de `src/lib/pricing/*` la seule source de l'affichage des prix et des quantités.

## 2. Chirurgie au fusil

**Exemple** : la conversion centimes → euros écrite à la main, `(x / 100).toFixed(2)`, se répète
dans des dizaines de fichiers ; décider demain d'un séparateur de milliers oblige à tous les
toucher. Même chose pour le nom `Prénom.N` : `formatClientName` (`src/lib/format-kitchen.ts`)
existe, mais des écrans le réécrivent.

**Recherche** : `rg -n "/ ?100\)\.toFixed\(2\)" src` ; `rg -n "charAt\(0\)\.toUpperCase" src`.

**Mouvement** : Move Function vers le module d'autorité, puis remplacer le code en ligne par
l'appel, répertoire par répertoire. Si le motif est mécanique, proposer plutôt une règle
(`no-restricted-syntax`) ou un test de garde via `quality-gates`, au lieu de N constats.

**Gravité** : `mineur` par emplacement en relecture de diff ; en audit, un seul constat groupé.
Un diff qui **ajoute** une copie alors que l'autorité existe : `majeur` (`klikgo-programme` § 6
règle 7).

## 3. Switch répétés

**Exemple** : le libellé d'unité se décide à la main dans de nombreux composants, chacun à sa
façon (« /kg », « /pce », « pièce », « barq. », « /barquette »). Plusieurs ternaires ne
connaissent que `KG`, `PIECE` et le reste : dans `src/components/search/SearchBar.tsx` et
`src/app/(client)/commande/[id]/page.tsx`, un produit `TRANCHE` reçoit « barq. ». L'autorité
existe : `isWeighedUnit` et `SaleUnit` dans `src/lib/pricing/line.ts`.

**Recherche** : `rg -n "unit === \"KG\"" src`.

**Mouvement** : une fonction de libellé typée par `SaleUnit`, avec un `switch` exhaustif (défaut
`never`), appelée partout ; Replace Conditional with Function Call.

**Gravité** : `majeur` quand une branche donne un résultat faux pour une unité réelle (cas
`TRANCHE` ci-dessus : scénario « produit vendu à la tranche → libellé barquette ») ; `mineur` si
toutes les branches sont justes mais dupliquées.

## 4. Envie de fonctionnalité (règle métier recalculée sur place)

**Exemple** : le prix promotionnel est recalculé dans la page, sous la forme
`Math.round(product.priceCents * (1 - product.promoPct / 100))`, dans
`src/app/webmaster/catalogue/page.tsx` et `src/app/(boucher)/boucher/produits/page.tsx`. La règle
vit dans `src/lib/pricing/unit-price.ts` (`activeProductPromo`, `resolveUnitPrice`, exposés à
l'affichage par `displayedUnitPrice` de `src/lib/pricing/display.ts`) : elle connaît la remise
fixe (`promoType`), la date de fin (`promoEnd`) et son propre arrondi. La copie ignore les deux
premières.

**Recherche** : `rg -n "priceCents \* \(1 -" src`. Elle remonte aussi les écrans et la route
anti-gaspi, qui appliquent une autre remise : à lire à part, contre la règle qui les gouverne.

**Mouvement** : Move Function n'est pas nécessaire, la fonction existe : remplacer le calcul par
l'appel à l'autorité, et ajouter le cas « remise fixe » au test du composant ou de l'helper.

**Gravité** : `majeur` (règle métier dupliquée qui a déjà dérivé). `bloquant` si la copie sert à
encaisser, à enregistrer un total ou à répondre au client : `CLAUDE.md` veut le prix recalculé par
le serveur.

## 5. Obsession des primitifs

**Exemple** : l'identifiant Clerk et l'identifiant Prisma d'un utilisateur sont deux `string` ;
les confondre a déjà produit un bogue (`CLAUDE.md`, « Résolution userId »). Autre cas :
`formatUnit(unit: string)` (`src/lib/format-kitchen.ts`) accepte n'importe quelle chaîne et rend
« barq. » pour une unité inconnue, une valeur par défaut qui a l'air d'une donnée.

**Mouvement** : typer par le domaine (`SaleUnit` plutôt que `string`) ; pour les identifiants,
Replace Primitive with Object sous forme de type marqué, d'abord en pilote (`typescript-patterns` ;
le déploiement est un point à arbitrer).

**Gravité** : `mineur` pour un primitif de plus ; `majeur` quand le diff compare ou mélange deux
identifiants de natures différentes (scénario : `Order.userId` comparé à un `clerkId` → aucune
commande trouvée).

## 6. Groupes de données

**Exemple** : `pickupSlotStart` et `pickupSlotEnd` voyagent ensemble dans des dizaines de
fichiers ; `unit`, `quantity` et `weightGrams` aussi. Le dépôt a déjà la cure pour le second :
`CartItem` (`src/lib/cart/cart-line.ts`) et les schémas de `src/lib/validators/order.ts`.

**Mouvement** : Introduce Parameter Object (un type `PickupSlot`), en commençant par les
signatures de service, puis les composants.

**Gravité** : `mineur`, sauf si le diff sépare un groupe qui doit rester cohérent (début modifié
sans la fin) : alors `majeur` avec le scénario.

## 7. Intermédiaire inutile

**Exemple** : `src/lib/hooks/useCart.ts` ne fait que ré-exporter `src/lib/hooks/use-cart.tsx`,
alors que `CLAUDE.md` dit d'importer `use-cart` ; `src/components/layout/index.ts` est un baril
qui ré-exporte. `architecture-conventions` § 2 demande de les retirer et de ne pas en créer.

**Mouvement** : Remove Middle Man / Inline Function : faire pointer les importeurs vers la source,
puis supprimer l'intermédiaire. Test de suppression : si l'effacer simplifie les appelants, il
n'avait pas de raison d'être.

**Gravité** : `mineur` ; un **nouveau** baril dans le diff : `majeur` (règle d'`architecture-conventions`).

## 8. Généralité spéculative et code mort

**Exemple** : `CartDrawer`, `CartPanel` et `CartFAB` (`src/components/cart/`) n'ont aucun appelant
(écart déjà relevé dans `klikgo-programme/references/contradictions-connues.md` § 2) ;
`src/lib/validations/` double `src/lib/validators/`.

**Recherche** : `rg -l "CartDrawer|CartPanel|CartFAB" src` (seuls leurs propres fichiers).

**Mouvement** : Remove Dead Code, après avoir vérifié les appels par convention que la recherche
ne voit pas : fichiers `page`, `layout`, `route`, crons listés dans `vercel.json`, `scripts/`, code
appelé seulement par les tests.

**Gravité** : `mineur` en audit (préexistant). Dans un diff, une option, un paramètre ou une
couche sans second appelant : `mineur`, avec l'alternative sans eux ; `majeur` si elle duplique
une autorité.

## 9. Changement divergent

**Exemple** : avant le chantier 0, une seule route boucher portait toutes les actions de commande ;
elle a été scindée en commandes de `src/lib/services/orders/commands/`, la route ne gardant que
l'auth, le schéma et la traduction HTTP (`api-route-conventions` § 1). Le mode cuisine
`src/app/(boucher)/boucher/commandes/page.tsx` change encore pour des raisons sans lien entre
elles (mise en page, rafraîchissement, impression, alertes).

**Mouvement** : Split Phase, Extract Function vers un service ou un hook par raison de changer ;
plan de découpage : `architecture-conventions` § 7.

**Gravité** : `mineur`, sauf si le diff fait grossir un fichier déjà au-dessus de 300 lignes :
`majeur` (`klikgo-programme` § 6 règle 6).

## 10. Nom mystérieux

**Exemple** : un même concept porte trois noms (`formatPrice`, `formatPriceCents`, `fmtPrice`),
et un nom ne dit pas laquelle des deux règles de poids il applique (`formatWeight` contre
`formatGrams`, § 1). À l'inverse, les noms porteurs d'unité du dépôt sont le modèle :
`priceCents`, `weightGrams`, `TIER_2_AUTO_APPROVE_SEC`.

**Mouvement** : Rename, en reprenant le terme déjà employé par le code d'autorité.

**Gravité** : `mineur` ; jamais plus de deux remarques de nommage par relecture.

## 11. Fonction longue

**Exemple** : les formulaires produit du boucher (`ProductFormPage.tsx`, `ProductForm.tsx` sous
`src/app/(boucher)/boucher/produits/`) et le mode cuisine dépassent de loin les 300 lignes de
`CLAUDE.md`. Mesure : `node .claude/skills/architecture-conventions/scripts/size-report.mjs 300 25`.

**Mouvement** : caractérisation d'abord, puis Extract Function / Extract Component, un bloc par
commit (`architecture-conventions` § 7–8, `simplicity-refactoring`).

**Gravité** : en audit, un constat `préexistant` par fichier, renvoyé à un chantier de découpage ;
en relecture de diff, `majeur` si le diff fait grossir un fichier déjà trop long, rien sinon.

## 12. Grille de gravité

| Situation                                                                        | Gravité                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| odeur sur de la mise en forme ou de la structure, sans effet observable          | `mineur`                                                                     |
| copie ou recalcul d'une règle métier (prix, statut, heure, horaires, auth)       | `majeur`                                                                     |
| copie qui a déjà divergé, avec une entrée réelle qui donne un résultat faux      | `majeur`, ou `bloquant` si l'argent, les données ou la sécurité sont touchés |
| intermédiaire, baril ou copie **ajouté** par le diff alors que l'autorité existe | `majeur`                                                                     |
| remaniement proposé qui déplace la complexité sans la réduire                    | pas de constat                                                               |
