# Mouvements de refactoring — catalogue appliqué à Klik&Go

## Sommaire

0. Boucle commune à tous les mouvements
1. Extract Function — extraire une fonction
2. Inline Function — réintégrer une fonction
3. Split Phase — séparer en phases
4. Replace Nested Conditional with Guard Clauses — clauses de garde (et ternaires imbriqués)
5. Introduce Parameter Object — objet paramètre
6. Remove Flag Argument — supprimer l'argument drapeau
7. Separate Query from Modifier — séparer lecture et modification
8. Move Function — déplacer une fonction
9. Change Function Declaration et Rename Variable — renommer
10. Réintégrer puis réextraire — remède à la mauvaise abstraction
11. Remplacer une copie par l'autorité — ce n'est pas un mouvement pur

Les noms anglais sont ceux du catalogue de Martin Fowler (refactoring.com/catalog) : les garder
tels quels dans le rapport et le corps du commit, ils servent de clé de recherche. Les exemples sont
écrits pour ce skill, à la forme du code Klik&Go (centimes, `shopId`, helpers du dépôt) ; ce ne sont
pas des extraits du dépôt, sauf mention d'un fichier.

## 0. Boucle commune

1. Caractérisation verte sur le code touché (gabarit : `architecture-conventions`,
   `references/refactoring-incremental.md` § 3).
2. Un seul mouvement.
3. Tests ciblés (forme de `testing-strategy` § 4 ; intégration si Prisma est touché) et
   `npx tsc --noEmit`.
4. Vert : noter le mouvement dans le rapport (nom, fichier, symbole). Rouge : annuler le pas,
   comprendre, recommencer plus petit. Jamais « réparer » un test pour le faire passer.
5. Recommencer. Les signaux du SKILL § 5 sont relevés avant le premier pas et après le dernier.

## 1. Extract Function

**Quand** : un bloc a un nom évident (un commentaire l'annonce souvent) ; un calcul vit dans le
rendu d'un composant ; le même bloc apparaît deux fois dans un module.
**Pas quand** : le nom ne ferait que paraphraser le code ; une fonction existe déjà ailleurs pour
ce besoin (§ 11).

Étapes : créer la fonction avec le corps copié tel quel ; ce que le bloc lit devient paramètre, ce
qu'il modifie devient valeur de retour ; remplacer le bloc par l'appel ; un helper pur extrait vers
`src/lib/` reçoit son test (`CLAUDE.md` § Tests).

```tsx
// Avant : calcul dans le rendu
function ScheduledRow({ pickupAt, now }: { pickupAt: Date; now: Date }) {
  const minutes = Math.round((pickupAt.getTime() - now.getTime()) / 60_000);
  let label: string;
  if (minutes <= 0) label = "maintenant";
  else if (minutes < 60) label = `dans ${minutes} min`;
  else label = `dans ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  return <span>{label}</span>;
}

// Après : fonction pure, testée, appelée par le composant
export function pickupCountdownLabel(pickupAt: Date, now: Date): string {
  const minutes = Math.round((pickupAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  return `dans ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
```

Piège : `formatShortTime` (`src/lib/utils.ts`) affiche « 1h05 », le bloc affiche « 1 h 05 ».
Brancher l'un sur l'autre change l'écran : c'est le § 11, pas ce mouvement.

## 2. Inline Function

**Quand** : le test de suppression est positif (la fonction renomme et transmet, ou adapte pour
une couture qui n'a qu'un côté) ; première étape du § 10.
**Pas quand** : la fonction est appelée par convention ou nommée dans `CLAUDE.md` (Pièges du
SKILL) ; elle porte une décision (lier un prix, borner par `shopId`, retirer des champs internes).

Étapes : recherche complète des appelants (`src`, `tests`, `vi.mock("@/…")`) ; remplacer chaque
appel par le corps ; supprimer la fonction ; `tsc`.

```ts
// Avant : un intermédiaire qui ne décide rien
export function shopHoursForDay(shop: { openingHours: OpeningHours | null }, jsDay: number) {
  return getDayHours(shop.openingHours, jsDay);
}
// Appelant : shopHoursForDay(shop, jsDay)

// Après : les appelants lisent l'autorité directement
// getDayHours(shop.openingHours, jsDay)
```

Contre-exemples du dépôt, à garder : `cartLineTotalCents(item)` lie `item.priceCents` à
`lineTotalCents` ; `quoteOrder` retire de `prepareOrder` les données internes (boutique, remise)
que le client n'a pas à recevoir.

## 3. Split Phase

**Quand** : une fonction enchaîne lire, valider, calculer et assembler, et les phases partagent
des données intermédiaires ; complexité au-dessus de 15 dans un service ou un handler.

Étapes : nommer la donnée qui passe d'une phase à l'autre (un type si elle a plusieurs champs) ;
extraire la phase 2 dans une fonction qui ne reçoit que cette donnée ; la fonction d'origine devient
l'enchaînement. La phase de calcul pur se teste en unitaire ; la lecture Prisma reste en intégration.

```ts
// Avant : lecture de la requête et calcul mêlés dans le handler
const dateKey = req.nextUrl.searchParams.get("date");
// … lecture de la boutique, puis le calcul des créneaux à partir de shop, dateKey et now, en ligne

// Après : phase 1 = lire et valider ; phase 2 = calcul pur
type SlotInput = {
  dayStartMin: number;
  dayEndMin: number;
  intervalMin: number;
  earliestMin: number;
};

export function pickupSlots({
  dayStartMin,
  dayEndMin,
  intervalMin,
  earliestMin,
}: SlotInput): number[] {
  const slots: number[] = [];
  for (
    let start = Math.max(dayStartMin, earliestMin);
    start + intervalMin <= dayEndMin;
    start += intervalMin
  ) {
    slots.push(start);
  }
  return slots;
}
```

Piège réel : `api/shops/[id]/available-slots/route.ts` lit `openingHours` à la main. Y brancher
`getDayHours` pendant le découpage changerait le comportement (`getDayHours` accepte aussi les clés
`mon` … `sun`) : couche à part, après caractérisation (§ 11).
Cas d'école du dépôt : `prepareOrder` (`src/lib/services/orders/quote.ts`) a déjà ses phases
`priceLines` et `unavailableProducts` ; la remise et les totaux sont la phase suivante à extraire.

## 4. Replace Nested Conditional with Guard Clauses

**Quand** : imbrication au-delà de 3 niveaux ; `else` qui ne fait que renvoyer une erreur ;
ternaire imbriqué (`no-nested-ternary`).

```ts
// Avant
const auth = await getAuthenticatedBoucher();
if (!auth.error) {
  const parsed = productStockSchema.safeParse(await readJsonBody(req));
  if (parsed.success) {
    const updated = await prisma.product.updateMany({
      where: { id: params.id, shopId: auth.shopId },
      data: { inStock: parsed.data.inStock },
    });
    if (updated.count > 0) return apiSuccess({ id: params.id, inStock: parsed.data.inStock });
    else return apiError("NOT_FOUND", "Produit introuvable");
  } else {
    return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
  }
} else {
  return auth.error;
}

// Après : mêmes réponses, même ordre des contrôles, try/catch + handleApiError inchangés autour
const auth = await getAuthenticatedBoucher();
if (auth.error) return auth.error;
const parsed = productStockSchema.safeParse(await readJsonBody(req));
if (!parsed.success) {
  return apiError("VALIDATION_ERROR", "Données invalides", formatZodError(parsed.error));
}
const updated = await prisma.product.updateMany({
  where: { id: params.id, shopId: auth.shopId },
  data: { inStock: parsed.data.inStock },
});
if (updated.count === 0) return apiError("NOT_FOUND", "Produit introuvable");
return apiSuccess({ id: params.id, inStock: parsed.data.inStock });
```

Ternaire imbriqué dans le JSX : une table `Record<OrderStatus, string>` (exhaustive, le compilateur
signale un statut oublié) ou un petit composant à retours anticipés. Garder l'ordre des contrôles :
l'auth avant la lecture du corps, la lecture avant l'écriture.

## 5. Introduce Parameter Object

**Quand** : plus de 3 paramètres positionnels (`max-params`), ou deux du même type côte à côte
(`computeTier(originalTotal, newTotal, tier1Max, tier2Max)` : quatre nombres) ; le même groupe de
valeurs voyage ensemble (`shopId`, `now`, seuils). Le dépôt suit déjà cette forme :
`resolveUnitPrice(product, { isPro, cutOption, now })`, `computeOrderTotals({ … })`.

```ts
// Avant
function quoteLine(
  product: ProductPricing,
  quantity: number,
  weightGrams: number | null,
  isPro: boolean,
  cutOption: string | null,
  now: Date
) {
  /* … */
}

// Après
type LineRequest = { quantity: number; weightGrams: number | null; cutOption: string | null };
function quoteLine(product: ProductPricing, line: LineRequest, ctx: { isPro: boolean; now: Date }) {
  /* … */
}
```

Piège : un objet fourre-tout optionnel partout (`options?: { … }`) recrée la mauvaise abstraction.
Chaque champ est requis sauf si un appelant réel l'omet.

## 6. Remove Flag Argument

**Quand** : un booléen choisit une branche du corps et les appelants passent des littéraux
(`render(order, true)`). On le remplace par deux fonctions nommées, ou par un paramètre de type
union quand les cas sont plus de deux.

```ts
// Avant
function priceLabel(cents: number, perKg: boolean): string {
  return perKg ? `${formatPrice(cents)} / kg` : formatPrice(cents);
}

// Après
const priceLabel = (cents: number) => formatPrice(cents);
const pricePerKgLabel = (cents: number) => `${formatPrice(cents)} / kg`;
```

**Pas un drapeau** : un booléen transmis comme donnée. `handleValidate(approved: boolean)`
(`webmaster/boutiques/[shopId]/page.tsx`) envoie `{ approved }` à l'API sans brancher dessus : le
couper en deux dupliquerait l'appel réseau. Dans le cas ci-dessus, `priceLabel` ne fait plus que
transmettre : test de suppression (§ 2), les appelants appellent `formatPrice`.

## 7. Separate Query from Modifier

**Quand** : une fonction renvoie une valeur **et** écrit (base, état, cache), si bien qu'on ne
peut pas la lire sans effet. Fréquent dans les hooks (`fetch` qui met aussi à jour un état
global) et dans les helpers « get or create ».

```ts
// Avant : lire le total met aussi à jour le compteur affiché
function cartTotal(items: readonly CartItem[], setBadge: (n: number) => void): number {
  setBadge(items.length);
  return cartTotalCents(items);
}

// Après : la lecture est pure, l'effet est appelé là où il est voulu
const total = cartTotalCents(items);
setBadge(items.length);
```

Exception du dépôt : les écritures conditionnelles qui renvoient leur résultat dans la même
opération (`updateMany` de `transition.ts`, compteur de `numbering.ts`) sont voulues : la lecture
séparée réintroduirait une course. Ne pas les « séparer ».

## 8. Move Function

**Quand** : une fonction vit dans un module qui ne la concerne pas, ou du côté serveur alors que
l'écran en a besoin (règle de `architecture-conventions` § 2 pour la destination).

Étapes : copier la fonction à sa nouvelle place, faire de l'ancienne un appel vers la nouvelle,
passer les appelants un par un, supprimer l'ancienne ; un commit de déplacement sans autre
modification pour que git suive le fichier (`references/refactoring-incremental.md` § 5 de
`architecture-conventions`). Mettre à jour les imports, les `vi.mock("@/…")` et, si le fichier
écrit dans `orders`, la liste fermée de `tests/lib/order-writers-guard.test.ts`.

Exemple du dépôt : `computeTier`, fonction pure, est dans `src/lib/price-adjustment.ts`, module
serveur (il importe `feature-flags.ts`, qui importe Prisma), et le composant client
`PriceAdjustModal.tsx` en a une copie (`computeDisplayTier`). Le **déplacement** de la fonction
pure vers le module client `price-adjustment-config.ts` est un refactor ; faire utiliser au modal
les seuils configurés est un **changement de comportement**, dans une couche suivante.

## 9. Change Function Declaration et Rename Variable

**Quand** : un nom ment ou oblige à lire le corps (`data`, `res2`, `handle`, une fonction `get…`
qui écrit). Garder le vocabulaire de `CLAUDE.md` et du domaine : boutique, `shopId`, centimes
(`…Cents`), grammes (`…Grams`), créneau, retrait.

Étapes : renommer la déclaration, puis laisser `npx tsc --noEmit` désigner chaque usage oublié
(pas de remplacement de texte aveugle, qui touche aussi les chaînes et les homonymes) ; rechercher
ensuite l'ancien nom dans les chaînes, les tests, les `vi.mock`, les skills
(`references/etat-du-code.md`) et `CLAUDE.md`. Un nom cité dans `CLAUDE.md` ne se renomme pas en
passant : Points à arbitrer.

## 10. Réintégrer puis réextraire (mauvaise abstraction)

Signal : un helper partagé dont la signature a grossi de drapeaux, et dont chaque appelant
n'emprunte qu'une partie (Sandi Metz).

```ts
// Avant : 3 appelants, 4 booléens
function orderBadge(
  o: BadgeOrder,
  compact: boolean,
  showPrice: boolean,
  forKitchen: boolean,
  dark: boolean
) {
  /* … 40 lignes de if … */
}
```

1. Caractériser chaque appelant avec les arguments qu'il passe réellement (pas toutes les
   combinaisons : seulement celles qui existent).
2. **Inline Function** : recopier le corps chez chacun des 3 appelants.
3. Chez chaque appelant, remplacer chaque booléen par sa valeur constante et supprimer les
   branches mortes (ce sont des simplifications à comportement constant, tests verts à chaque pas).
4. Comparer les 3 restes : seul ce qui est réellement identique est réextrait (**Extract
   Function**), avec une interface sans drapeau. Le balisage qui diffère reste chez l'appelant.
5. Supprimer l'ancien helper (aucun importeur, `tsc`).

Si le helper porte une règle métier (prix, statut, heure), la règle ne se recopie pas : on la sort
d'abord dans son autorité (`src/lib/pricing/`, `transition.ts`, `paris-time.ts`) et seuls les
morceaux d'affichage passent par cette séquence.

## 11. Remplacer une copie par l'autorité

Remplacer `fmtPrice` local par `formatPrice`, une lecture d'`openingHours` à la main par
`getDayHours`, un `computeDisplayTier` par `computeTier` : ce n'est un refactor **que si** les deux
donnent la même sortie pour toutes les entrées réelles.

1. Test de caractérisation qui compare la copie et l'autorité sur des valeurs choisies à la main,
   bornes comprises (0, négatif, valeur absente, grande valeur) — modèle :
   `references/refactoring-incremental.md` § 3 d'`architecture-conventions`.
2. Égales partout : remplacement dans une couche `refactor`, la copie supprimée.
3. Une différence : c'est un changement de comportement visible (format, palier, horaire). Le
   noter en Points à arbitrer ou en `besoinsDuChef` ; le remplacement va dans un brief à part.
