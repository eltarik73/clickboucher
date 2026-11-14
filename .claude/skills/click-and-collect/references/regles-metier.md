# Catalogue des règles métier

Statut revérifié le 14/11/2026 sur l'arbre de travail (HEAD `32c581f` + chantier « intégrité des commandes », non committé et encore en mouvement) : ✅ tenue · ✅ chantier (tenue seulement si les fichiers du chantier sont dans la branche, voir SKILL.md) · ⚠️ partielle · ❌ absente. « Preuve » = où la règle est (ou devrait être) appliquée ; chemins relatifs à `src/`. Aucun numéro de ligne : chercher par nom. Mettre ce fichier à jour quand une règle change de statut.

## 1. Panier

| # | Règle | Statut | Preuve |
|---|---|---|---|
| P1 | Un panier ne contient qu'une boutique ; changement confirmé | ✅ | `lib/hooks/use-cart.tsx` `addItem` → `pendingSwitch` → `ConfirmDialog` |
| P2 | Rendu initial vide puis relecture du stockage (pas d'erreur d'hydratation) | ✅ | `use-cart.tsx` `useIsomorphicLayoutEffect` |
| P3 | Synchro base seulement pour un utilisateur confirmé ; jamais d'écrasement du panier local | ✅ | `use-cart.tsx` `canSync`, `knownAnonymousRef`, `loadFromDB` |
| P4 | Le panier survit à la fermeture de l'onglet | ❌ | `sessionStorage` (`STORAGE_KEY = "klikgo-cart"`) — décision A7 |
| P5 | Une formule unique pour le total d'une ligne, partagée par la feuille produit, la ligne panier, le total et le serveur | ✅ chantier | `lineTotalCents` (`lib/pricing/line.ts`), appelée par `cartLineTotalCents` (`lib/cart/cart-line.ts`) et par `quote.ts` ; `/panier` affiche les lignes et le total du devis serveur |
| P6 | Les lignes obsolètes sont retirées en nommant les produits | ⚠️ | `panier/page.tsx` `removeMissingProducts` : retire, mais annonce seulement un nombre, sans accents |
| P7 | Paniers abandonnés relancés (connectés) | ⚠️ | cron `abandoned-carts` (quotidien, 04:00 UTC dans `vercel.json`), champs `abandonedAt` / `reminderSentAt` |

**Fonctions de référence : ne pas les réécrire.** Elles sont pures (sans base ni horloge), testées dans `src/lib/__tests__/{pricing-*,cart-line,order-payload,order-line-display}.test.ts`, et leurs noms ont été vérifiés à la compilation le 14/11/2026 :

| Besoin | Fonction | Fichier (`src/lib/`) |
|---|---|---|
| Total d'une ligne de panier ou de requête | `lineTotalCents(line, unitPriceCents)` | `pricing/line.ts` |
| Ligne recevable ? (quantité entière 1–99 ; poids obligatoire au kilo et à la tranche, interdit à la pièce et à la barquette) | `checkLineQuantity(line)` → `null` ou `QUANTITY_INVALID`, `WEIGHT_REQUIRED`, `WEIGHT_FORBIDDEN`, `WEIGHT_INVALID` | `pricing/line.ts` |
| Prix d'une portion au poids, arrondi au centime en arithmétique entière | `portionPriceCents(pricePerKgCents, grams)` | `pricing/line.ts` |
| Unités de stock limité prises par une ligne | `lineUnits(line)`, `storedLineUnits(item)` | `pricing/line.ts` |
| Quantité à écrire dans `OrderItem.quantity` | `toStoredQuantity(line)` | `pricing/line.ts` |
| Relire une ligne enregistrée (affichage, recommande) | `describeStoredLine`, `lineQuantityFromStored` | `pricing/line.ts` |
| Prix unitaire d'un produit pour un client (découpe, prix pro, promotion) | `resolveUnitPrice(product, { isPro, cutOption, now })` | `pricing/unit-price.ts` |
| Remise d'un code ou d'une récompense | `offerDiscount(offer, basket)`, `loyaltyRewardDiscount` | `pricing/discount.ts` |
| Sous-total, remise, total, frais, montant à payer | `computeOrderTotals`, `serviceFeeCentsFor(paymentMethod)` | `pricing/totals.ts` |
| Texte d'un poids ou d'une quantité (« 500 g », « 1,5 kg », « 2 × 500 g », « 3 pièces ») | `formatGrams`, `formatStoredLineQuantity` | `pricing/format.ts` |
| Total local d'une ligne et du panier (estimation avant devis) | `cartLineTotalCents`, `cartTotalCents` | `cart/cart-line.ts` |
| Identifiant d'une ligne de panier | `cartLineId(line)` | `cart/cart-line.ts` |
| Prix affiché sur une carte produit (sans horloge avant le montage) | `displayedUnitPrice(product, now)` | `cart/cart-line.ts` |
| Ligne de panier à partir d'une ancienne ligne de commande | `cartItemFromOrderLine(row)` | `cart/cart-line.ts` |
| Corps du devis, corps de la commande, clé d'idempotence | `buildQuoteRequest`, `prepareCheckoutAttempt`, `parseCheckoutAttempt` | `cart/order-payload.ts` |
| Numéros affichés (« #012 », « C-012 ») | `formatDisplayNumber`, `formatCustomerNumber`, `formatOrderNumber` | `order-number-format.ts` |

Résultats constatés à l'exécution : `lineTotalCents({ unit: "KG", quantity: 2, weightGrams: 500 }, 2000)` → `2000` ; `toStoredQuantity` de la même ligne → `1` (kilogramme) ; `checkLineQuantity({ unit: "PIECE", quantity: 1, weightGrams: 100 })` → `"WEIGHT_FORBIDDEN"`.

Contrat à connaître (écrit en tête de `pricing/line.ts`) :

- **Ligne de panier ou de requête** : `quantity` = nombre de portions (`KG`, `TRANCHE`) ou d'unités (`PIECE`, `BARQUETTE`), entier de 1 à 99 ; `weightGrams` = grammes d'**une** portion (1 à 50 000), présent seulement pour une unité pesée.
- **Ligne enregistrée (`OrderItem`)** : pour `KG` et `TRANCHE`, `quantity` = **kilogrammes** (portions × grammes / 1000) — forme historique, réécrite par l'ajustement de poids du boucher ; pour `PIECE` et `BARQUETTE`, le nombre d'unités. Ne jamais convertir à la main : passer par `toStoredQuantity` et `describeStoredLine`.
- Le prix unitaire et la remise sont calculés par le serveur à partir de la base (prix pro, promotion, découpe choisie par son **nom** parmi `Product.cutOptions`, offre) — jamais lus dans le corps de la requête, dont le schéma strict refuse `cutPriceCents`, `discountCents`, `offerId`. Une découpe inconnue est refusée (`UNKNOWN_CUT_OPTION` → `VALIDATION_ERROR` « découpe inconnue »), pas facturée au prix de base.
- `Order.totalCents` = marchandises moins remise, ce que le boucher encaisse ; les frais de service sont stockés à part (`serviceFeeCents`) : 0 sur place, 99 en ligne. « Total à payer » = `amountDueCents` = `totalCents + serviceFeeCents`.

Si `src/lib/pricing/` est absent de la branche de travail : ne pas écrire une formule de plus ; le signaler et attendre le chantier.

## 2. Ouverture et capacité

| # | Règle | Statut | Preuve |
|---|---|---|---|
| O1 | Refus de commande si statut boutique ≠ `OPEN`/`BUSY` | ✅ | `services/orders/shop-capacity.ts` `checkShopCanTakeOrder` → `getShopStatus` (`lib/shop-status.ts`, cache Redis 60 s) → `SERVICE_DISABLED` |
| O2 | Refus de commande immédiate hors horaires d'ouverture | ❌ | `checkShopCanTakeOrder` ne lit pas `openingHours` ; `Shop.status` est un interrupteur manuel (`app/(boucher)/boucher/parametres/page.tsx`, `patchStatus`) ; aucun cron d'ouverture/fermeture dans `app/api/cron/` |
| O3 | Plafond de commandes par heure | ✅ | `checkShopCanTakeOrder` : `ordersLastHour >= shop.maxOrdersPerHour` (défaut 20) → `CAPACITY_EXCEEDED` |
| O4 | Plafond par créneau, revalidé à l'écriture | ✅ | `available-slots/route.ts` (`remaining`), `checkShopCanTakeOrder` : `ordersInSlot >= shop.maxOrdersPerSlot` (défaut 5) |
| O5 | Fin automatique de pause, mode occupé, vacances | ✅ | `lib/shop-status.ts` `getShopStatus(shopId)` : expiration à la lecture (cache Redis 60 s) ; les crons `busy-end` et `vacation-end` ne sont qu'un filet quotidien |
| O6 | Pause automatique après commandes manquées | ⚠️ | `checkAutoPause` (`missedOrdersCount`, `autoPauseThreshold` 3 par défaut, statut `AUTO_PAUSED`) n'est appelée que par le cron `auto-cancel`, quotidien (E34), et ne fait rien si le statut n'est pas `OPEN` (une boutique `BUSY` n'est jamais mise en pause automatique) |
| O7 | Minimum de commande | ⚠️ | Serveur : `quote.ts` (`belowMinimumOrder`) puis `create.ts` `priceRefusal` → `VALIDATION_ERROR`. Client : `/panier` affiche « Commande minimum de … » et désactive le bouton quand le devis est sous le minimum ; rien sur la page boutique ni avant, alors que `publicShopSelect` expose `minOrderCents` (E11) |
| O8 | Boutique non commandable : l'ajout au panier est bloqué avec explication | ❌ | `ShopProductsClient.tsx` n'a aucune garde de statut (E9) |

**Fonction à créer pour O2** (pure, testable, heure de Paris). Elle réutilise le calcul d'horaires qui existe déjà — ne pas reparser « HH:MM » à la main :

```ts
import { getShopStatus as getHoursStatus, type OpeningHours } from "@/lib/shop-hours";
import { toParisWallClockDate } from "@/lib/paris-time";

/** Vrai si une commande « dès que possible » est recevable à cet instant. */
export function isOrderableNow(
  status: string,
  openingHours: OpeningHours | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== "OPEN" && status !== "BUSY") return false;
  // toParisWallClockDate : Date dont getDay()/getHours() donnent l'heure de Paris
  return getHoursStatus(openingHours, toParisWallClockDate(now)).status !== "CLOSED";
}
```

Vérifié au typage (`tsc` du projet) et à l'exécution le 14/11/2026 sur 12 cas (hiver, été, jour sans horaires, minute de fermeture, passage de minuit, statut `PAUSED`, horaires `null`). À savoir avant de la brancher :

- **Deux fonctions s'appellent `getShopStatus`.** `lib/shop-status.ts` : asynchrone, lit le statut en base et dans Redis (`OPEN`, `BUSY`, `PAUSED`…). `lib/shop-hours.ts` : pure, calcule `OPEN` / `CLOSING_SOON` / `CLOSED` à partir des horaires. La création de commande n'appelle que la première. Toujours importer la seconde sous un alias.
- `Shop.openingHours` est une colonne `Json` : la convertir (`as OpeningHours | null`) à la lecture Prisma, comme `available-slots/route.ts`.
- `shop-hours.ts` ne gère pas une fermeture après minuit (`open < close` le même jour), ni deux plages dans la journée (coupure du midi).
- Les créneaux peuvent suivre un horaire distinct (`Shop.pickupSlots.slots[jour]`, prioritaire sur `openingHours` dans `available-slots/route.ts`) : décider lequel fait foi pour « commandable maintenant ».
- Trancher le cas « horaires non renseignés » (avec ce code : fermé) avant de brancher la règle dans `checkShopCanTakeOrder`, sinon une boutique sans horaires ne recevrait plus rien (point A12).

Tests à écrire avec la fonction : jour fermé, avant l'ouverture, minute de fermeture, minuit, changement d'heure, horaires absents, statut `PAUSED`.

## 3. Créneaux

| # | Règle | Statut | Preuve |
|---|---|---|---|
| C1 | Créneaux calculés en heure de Paris, comptage en UTC réel | ✅ | `app/api/shops/[id]/available-slots/route.ts`, `parisWallClockToUtc` |
| C2 | Premier créneau = maintenant + 10 min, arrondi au créneau supérieur | ✅ | `earliestPickupMinutes` (`PICKUP_MARGIN_MIN = 10`, `lib/paris-time.ts`) — règle CLAUDE.md ; sorties constatées : 13h09 → 13h30, 13h22 → 14h00, 14h05 → 14h30, 14h31 → 15h00 |
| C3 | (Proposition A11) Premier créneau ≥ maintenant + préparation effective | ❌ | La marge de 10 min ne tient pas compte de `prepTimeMin` / `busyExtraMin` |
| C4 | Pas de créneau pour une date passée, y compris entre 0 h et 2 h | ✅ | `dateStr < paris.dateKey` ; client : `localDateKey` |
| C5 | Créneaux disponibles même boutique fermée (précommande) | ❌ | Retour `{ slots: [] }` si `CLOSED`/`PAUSED`/`AUTO_PAUSED`/`VACATION` — décision A10 |
| C6 | Horizon de réservation borné (ex. 7 jours) | ❌ | `panier/page.tsx` `navigateDate` avance sans limite |
| C7 | Commande à créneau : `PENDING`, acceptée sans choix de délai, bascule « à préparer » 30 min avant | ⚠️ | `KitchenOrderCard`, `boucher/commandes/page.tsx` (`THIRTY_MIN`), `/api/orders/[id]/scheduled-notify`. Mais `create.ts` `initialState` pose `ACCEPTED` dès que `shop.autoAccept` est vrai, créneau ou pas (E30) ; CLAUDE.md se contredit sur ce point (A15) |
| C8 | Le serveur revalide le créneau reçu : futur, dans les horaires du jour, aligné sur l'intervalle, exprimé en heure de Paris | ❌ | `createOrderSchema` : `pickupSlotStart: z.string().datetime()` ; `checkShopCanTakeOrder` ne contrôle que la capacité. Le client fabrique l'instant dans le fuseau du navigateur (`new Date(\`${selectedDate}T${slot.start}:00\`).toISOString()`, `panier/page.tsx`), le serveur compte les places avec `parisWallClockToUtc` : hors de France, les deux ne coïncident pas (E29) |

C2 est la règle écrite dans CLAUDE.md : elle s'applique tant que le propriétaire n'a pas tranché le point A11. C3 est une proposition qui ne remplace pas C2 : le premier créneau serait le plus tard des deux (`max(maintenant + 10 min, maintenant + préparation effective)`, arrondi au créneau supérieur).

## 4. Statuts de commande

Source unique : `TRANSITIONS` dans `lib/order-state-machine.ts` (testé dans `src/lib/__tests__/order-state-machine.test.ts`). Le tableau ci-dessous est une copie pour lecture, relevée le 14/11/2026 : en cas de doute, le fichier fait foi.

| Depuis | Vers |
|---|---|
| `PENDING` | `ACCEPTED`, `DENIED`, `CANCELLED`, `AUTO_CANCELLED`, `PARTIALLY_DENIED` |
| `ACCEPTED` | `PREPARING`, `READY`, `CANCELLED`, `DENIED`, `PARTIALLY_DENIED` * |
| `PREPARING` | `READY`, `CANCELLED` |
| `READY` | `PICKED_UP` |
| `PICKED_UP` | `COMPLETED` |
| `PARTIALLY_DENIED` | `PENDING` *, `ACCEPTED`, `CANCELLED`, `DENIED` |
| `COMPLETED`, `DENIED`, `CANCELLED`, `AUTO_CANCELLED` | aucun (états finaux) |

\* Transitions ajoutées par le chantier (absentes de `32c581f`) : le boucher peut signaler une rupture après avoir accepté ; après la réponse du client, la commande revient en `PENDING` pour une nouvelle décision. Le même chantier ajoute `KITCHEN_ACTIVE_STATUSES`, `KITCHEN_HISTORY_STATUSES`, `DISCOUNT_RELEASING_STATUSES` et `holdsLimitedStock(status)` : les utiliser plutôt que de recopier des listes de statuts.

`getStepIndex(status)` du même fichier renvoie `-1` pour `DENIED`, `CANCELLED`, `AUTO_CANCELLED` : c'est le signal « écran d'échec » à utiliser dans le suivi (il renvoie `0` pour `PARTIALLY_DENIED`, qui demande son propre écran).

| # | Règle | Statut | Preuve |
|---|---|---|---|
| S1 | Toute transition passe par la table et par une écriture conditionnelle | ✅ chantier | `services/orders/transition.ts` (`transitionOrder`, seul écrivain de `Order.status` après la création, lève `IllegalTransitionError` hors table) ; commandes dans `services/orders/commands/` — voir `order-lifecycle-realtime` |
| S2 | Expiration si le boucher ne répond pas | ⚠️ | `expiresAt = now + acceptTimeoutMin` (défaut 10) est posé par `create.ts`, mais seul le cron `auto-cancel` (→ `expireOrder`) écrit `AUTO_CANCELLED`, et `vercel.json` le planifie une fois par jour (`0 1 * * *`) ; aucune expiration à la lecture (E34) |
| S3 | Annulation client : `PENDING`, ou `ACCEPTED` moins de 5 min après création | ⚠️ | Serveur ✅ chantier : `cancelOrderByCustomer` (`commands/close.ts`, `CUSTOMER_CANCELLATION_WINDOW_MS`). Écrans : `/commande/[id]` n'offre le bouton qu'en `PENDING` et en `PARTIALLY_DENIED` (où le serveur le refuse, E35), jamais en `ACCEPTED` récent ; `/suivi` jamais. La règle pure `isCancellable(status, createdAt)` existe pour décider d'afficher le bouton, mais aucun écran ne l'appelle |
| S4 | Refus toujours motivé | ✅ | `KitchenOrderCard` : bouton désactivé sans `denyReason` ; `boucherActionSchema` : `reason` d'au moins 1 caractère |
| S5 | Le motif de refus est montré au client | ⚠️ | `/commande/[id]` oui ; `/suivi` non (`denyReason` absent du `select` de `suivi/[id]/page.tsx`) |
| S6 | Libellés issus d'une seule table | ❌ | Tables locales dans `design-tokens.ts`, `order-state-machine.ts`, `components/ui/status-badge.tsx`, `SuiviClient.tsx` (frise, badge, toasts), `commandes/page.tsx`, `ActiveOrderBanner.tsx`, `commande/[id]/page.tsx` (E18) |

Libellés actuels de `ORDER_STATUS_LABELS` (`lib/design-tokens.ts`) : « En attente », « Acceptée », « En préparation », « Prête », « Récupérée », « Terminée », « Refusée », « Annulée », « Partiel. refusée », « Expirée ». Cette table sert au tableau de bord webmaster et aux messages de conflit des commandes (`getStatusLabel` dans `services/orders/commands/http.ts`) ; aucun écran client ne l'importe encore.

Proposition de libellés côté client (choix d'équipe, à valider avant de modifier la table ou d'en dériver une variante « client ») : `PENDING` « En attente du boucher » · `READY` « Prête — vous pouvez venir » · `PARTIALLY_DENIED` « Article indisponible — votre choix » ; les autres inchangés. Aujourd'hui « Retirée » (`SuiviClient.tsx`) et « Récupérée » coexistent : garder « Récupérée », le terme de `design-tokens.ts`.

## 5. Poids, découpe, ajustement

| # | Règle | Statut | Preuve |
|---|---|---|---|
| W1 | Prix au kilo et total estimé affichés avant l'ajout | ✅ | `ProductCard` (« ≈ x € pour y g »), `WeightSheet` |
| W2 | Tolérance de pesée unique et affichée | ❌ | `Product.weightMargin` défaut 15 ; `WeightSheet` : `weightMargin`, sinon 10 (poids) ou 15 (pièces) ; `services/weight.service.ts` : 10 % (`TOLERANCE_PERCENT`), fichier importé nulle part — A2 |
| W3 | Prix de découpe recalculé par le serveur | ✅ chantier | `quote.ts` `priceLines` → `resolveUnitPrice` (`pricing/unit-price.ts`) ; schéma strict |
| W4 | Contrat `quantity` / `weightGrams` identique client ↔ serveur | ✅ chantier | `cart/order-payload.ts` envoie la ligne telle que le panier la tient ; `quote.ts` la contrôle (`checkLineQuantity`) ; `create.ts` l'enregistre (`toStoredQuantity`) |
| W5 | Ajustement de prix tracé, plafonné, soumis au client au-delà d'un seuil | ⚠️ | `lib/price-adjustment*.ts`, `services/orders/adjust-price.ts`, `components/client/PriceAdjustmentBanner.tsx` — seuils à arbitrer (A1) |
| W6 | Pendant un ajustement en attente, le boucher ne peut pas passer à « prête » | ✅ | `KitchenOrderCard` : boutons désactivés si `priceAdjustment.status === "PENDING"` |
| W7 | Montant de remise calculé par le serveur | ✅ chantier | `services/orders/discount.ts` `resolveDiscount` → `offerDiscount` (`pricing/discount.ts`) ; consommation dans la transaction (`discount-ledger.ts`) |

## 6. Rupture et remplacement

| # | Règle | Statut | Preuve |
|---|---|---|---|
| R1 | Produit inactif, en rupture ou en veille : non commandable | ✅ | `quote.ts` `unavailableProducts` (`isActive`, `inStock`, `snoozeType`) → `STOCK_INSUFFICIENT` ; fin de veille par le cron `unsnooze` (quotidien) |
| R2 | Stock limité (anti-gaspi, vente flash) vérifié au devis et réservé à l'acceptation | ✅ chantier | `quote.ts` (`antiGaspiStock`, `flashSaleStock`), `limited-stock.ts` `reserveLimitedStock`, `holdsLimitedStock` |
| R3 | Rupture après commande : le client choisit remplacement ou retrait | ⚠️ | `commands/unavailable.ts` (`reportUnavailableItems`, `resolveUnavailableItems`), `/api/orders/[id]/alternatives`, `/choose-alternatives` — seulement sur `/commande/[id]`, donc jamais pour l'invité |
| R4 | Délai de réponse du client et issue par défaut définis | ❌ | Non défini : que se passe-t-il si le client ne répond pas à une rupture ? |

Repères : chez Deliveroo, le commerçant marque l'article en rupture après avoir accepté, le client est notifié, son panier est pré-rempli avec les articles disponibles et il peut ajouter un remplacement ou valider sans [P9]. Instacart laisse choisir, avant comme après la commande, entre meilleur équivalent, article précis (jusqu'à trois) ou remboursement [P10].

## 7. Identité, invité, fidélité, avis

| # | Règle | Statut | Preuve |
|---|---|---|---|
| I1 | Commande sans compte | ✅ | `/api/checkout/guest` (utilisateur fantôme `clerkId = null`, `guestToken`, cookie httpOnly `GUEST_COOKIE_NAME` de 30 jours) ; refus `CONFLICT` si l'e-mail appartient déjà à un compte |
| I2 | Suivi invité par lien, mis à jour sans rechargement | ⚠️ | Page : `/suivi/[id]?guestToken=…` ou cookie (`lib/auth/guest-auth.ts`) ✅. Rafraîchissement : `SuiviClient` interroge `/api/orders/[id]/status`, qui répond `UNAUTHORIZED` sans session — l'écran d'un invité reste sur l'état du chargement (E33) |
| I3 | Parité invité : annulation, réponse à une rupture | ❌ | `/api/orders/[id]/cancel` et `/choose-alternatives` exigent `getServerUserId()` ; `/suivi` n'a aucune action (E4) |
| I3b | Code promo pour l'invité | décision A14 | Refus serveur voulu : `resolveDiscount` → `LOGIN_REQUIRED` pour un visiteur anonyme ou invité ; `/panier` masque le bloc promo sans le dire |
| I4 | Création de compte proposée après la commande | ❌ | Seulement une phrase d'intention sous le formulaire invité |
| I5 | Comparaison d'identifiants : toujours l'identifiant Prisma | ✅ règle | CLAUDE.md « Résolution userId » ; `commands/outcome.ts` `customerUserId` |
| I6 | Avis : après retrait, un par commande, daté, sans contrepartie | ⚠️ | `/api/orders/[id]/rate` puis `/api/reviews` (double écriture depuis `commande/[id]/page.tsx`) ; voir `seo-anti-penalty` |
| I7 | Note affichée seulement s'il existe des avis | ❌ | `ShopCard`, en-tête de `boutique/[slug]/page.tsx` : `rating.toFixed(1)` sans condition (E14) |

## 8. Notifications

| # | Règle | Statut | Preuve |
|---|---|---|---|
| N1 | Chaque transition notifie le client sur au moins un canal garanti (e-mail) | à vérifier | `lib/notifications.ts`, `lib/emails/`, `tests/integration/notifications/` — voir `background-jobs-notifications` |
| N2 | Le lien d'une notification ouvre directement la commande | ⚠️ | E-mails, bandeau, QR → `/suivi/[id]` ; cloche (`components/ui/NotificationBell.tsx`) et liste → `/commande/[id]` |
| N3 | Permission push demandée en contexte, sur un geste | ❌ | `components/pwa/PushPrompt.tsx` existe mais n'est monté nulle part (E15) |
| N4 | Pas de doublon pour un même événement | à vérifier | Les commandes du chantier ne notifient que la requête qui a réellement changé le statut (`kind: "done"`) ; NN/g : éviter les notifications en double, lien direct vers le suivi [N4] |
