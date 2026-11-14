# Parcours client, étape par étape

Chaque étape donne : le but, ce que le client doit savoir en quittant l'écran, les règles, les états à couvrir, l'ancrage dans le code, et le repère de marché quand une source le documente. Les identifiants entre crochets renvoient à [sources.md](sources.md) ; les `E…` à [ecarts-constates.md](ecarts-constates.md) ; les `A…` aux points à arbitrer de SKILL.md.

État décrit : arbre de travail du 14/11/2026, chantier « intégrité des commandes » compris (voir l'avertissement en tête de SKILL.md). Chemins relatifs à `src/`.

Convention : « commandable » = le serveur accepterait une commande maintenant (invariant 4 de SKILL.md).

---

## 1. Découverte — `/`

**But.** Choisir une boutique en un écran.

**Le client doit savoir.** Quelles boutiques sont commandables maintenant, dans combien de temps la commande serait prête, à quelle distance, avec quelle réputation.

**Règles.**
- Tri : boutiques commandables d'abord, puis promotions actives (règle CLAUDE.md « promos en premier »), puis distance si connue, puis note pondérée par le nombre d'avis. Ne jamais trier sur la note seule : une moyenne sans volume trompe [B10].
- Localisation sans demande de permission au chargement : position mémorisée (`localStorage` `klikgo-geo`, 24 h), sinon géolocalisation IP silencieuse (`/api/geo`), sinon liste serveur. Le GPS ne se demande que sur un geste (« Activer GPS » dans `ReorderSection.tsx`). C'est déjà en place : le conserver. Ces deux appels (`/api/geo`, `/api/shops/nearby`) sont le seul budget d'appels anonymes admis sur l'accueil (voir `vercel-cost-performance`) : ne pas en ajouter.
- Boutique non commandable : visible, grisée, avec la prochaine ouverture (« Ouvre à 8h30 », « Reprise vers 14h10 ») — pas seulement « Fermé » (E9).
- Dernière commande en haut de page pour un client connecté, avec ajout direct au panier [B6] (E16).

**États.** Chargement géolocalisation (liste serveur déjà affichée, pas d'écran vide) ; aucune boutique ouverte (dire quand la prochaine ouvre) ; aucune boutique dans le rayon (garder la liste complète) ; erreur base de données (en production la page ISR précédente reste servie — ne pas avaler l'erreur, voir le commentaire dans `page.tsx`).

**Code.** `app/(client)/page.tsx` (ISR, `revalidate = 300`, conforme à CLAUDE.md : ne pas y ajouter d'authentification serveur ni de rendu qui dépend de l'horloge — voir `nextjs-app-router` et `vercel-cost-performance`), `decouvrir/NearbyShops.tsx`, `components/shop/ShopCard.tsx`, `components/order/ReorderSection.tsx`, `components/order/OrderTracker.tsx`.

**Repère.** Baymard observe que les utilisateurs cherchent leurs achats passés autant sur la page d'accueil que dans l'historique, et recommande de les montrer dans le premier écran aux clients connectés, avec ajout direct au panier [B6].

---

## 2. Boutique — `/boutique/[slug]`

**But.** Comprendre l'offre et commencer un panier.

**Le client doit savoir.** Si la boutique prend des commandes maintenant, l'heure de retrait la plus proche, les horaires, le minimum de commande s'il existe, et tout frais réellement facturé (aucun en paiement sur place).

**Règles.**
- L'en-tête porte : nom, note + nombre d'avis (rien si zéro avis, E14), délai effectif (`prepTimeMin + busyExtraMin` si `busyMode`), statut.
- Statut `PAUSED`/`AUTO_PAUSED` : bandeau avec heure de reprise quand `pauseEndsAt` existe (en place) **et** ajout au panier désactivé (absent, E9).
- Le minimum de commande apparaît ici ou dans la barre panier, pas seulement sur `/panier` (invariant 6, E11).
- Catégories : pastilles collantes. Aujourd'hui elles **filtrent** (`activeCat`). Si le catalogue grossit, préférer un menu long avec ancres par catégorie : le client voit tout en défilant et les promos restent en tête (choix d'équipe, à arbitrer).
- La preuve sociale (« 37 commandes cette semaine ») n'est affichée qu'à partir de 5 et vient d'un `count` réel. Ne pas baisser ce seuil : un petit nombre joue contre la boutique [N11].

**États.** Boutique introuvable (404 déclenché dans `generateMetadata`, à conserver) ; catalogue vide ; catégorie vide (« Aucun produit ») ; produit en rupture (grisé, étiquette « Indisponible », pas de bouton) ; boutique en pause ; boutique fermée.

**Code.** `boutique/[slug]/page.tsx` (rendu à chaque requête, cache Redis 60 s — ne pas ajouter `generateStaticParams`, voir le commentaire en tête du fichier et CLAUDE.md), `components/shop/ShopProductsClient.tsx`, `components/shop/{OpeningHoursAccordion,EarliestPickupTime,LoyaltyBadge,ReviewList}.tsx`.

**Repère.** L'analyse DoorDash de plus de cent mille menus place le nombre de photos — surtout sur les articles les plus vendus — en tête des facteurs liés à la conversion, suivi de la possibilité de personnaliser ; leurs tests A/B sur une photo d'en-tête et davantage d'informations sur l'établissement ont donné une amélioration nette [P4]. Uber Eats a généralisé une catégorie « Most Popular Items » née d'un test local [P2].

---

## 3. Produit — carte et feuilles

**But.** Ajouter la bonne quantité sans quitter la liste.

**Le client doit savoir.** Le prix au kilo ou à la pièce, une estimation du total pour la quantité choisie, pour combien de personnes, la tolérance de pesée.

**Règles par unité** (`Product.unit`) :

| Unité | Geste | Ligne de panier (`CartItem`) | Total estimé |
|---|---|---|---|
| `PIECE`, `BARQUETTE` | « + » ajoute 1, le bouton devient un compteur − n + [B8] | `quantity` = nombre d'unités, pas de `weightGrams` | prix unitaire × `quantity` |
| `KG` | Feuille poids : préréglages, saisie libre, ± pas ; option découpe ; option pièces (`weightPerPiece`) | `quantity` = nombre de portions, `weightGrams` = grammes d'une portion | prix d'une portion (`portionPriceCents`) × `quantity` |
| `TRANCHE` | Feuille tranche : nombre + épaisseur → poids estimé | idem `KG`, plus `sliceCount` et `thickness` | idem `KG` |

- L'identifiant d'une ligne se calcule avec `cartLineId` (`lib/cart/cart-line.ts`) : il porte tout ce qui distingue deux lignes (variante, découpe, tranches, pièces, poids de la portion). Ne jamais le composer à la main.
- Le total estimé se calcule avec `cartLineTotalCents` / `lineTotalCents`, le prix affiché avec `displayedUnitPrice` — pas avec une formule recopiée dans le composant.
- Les bornes viennent du produit (`minWeightG`, `weightStepG`, `maxWeightG`) puis de la règle de catégorie (`getConversionRule`, `lib/conversion-config.ts`). Ce sont des bornes d'écran : le serveur n'impose que 1 à 99 portions et 1 à 50 000 g par portion.
- La découpe choisie change le prix au kilo (`Product.cutOptions`) : elle voyage par son **nom**, le serveur retrouve le prix et refuse une découpe inconnue.
- La tolérance de pesée affichée est celle qui sera appliquée (point A2).
- Un produit au poids déjà au panier doit être repérable sur sa carte [B9] (E23).
- Ne jamais convertir en kilos dans `quantity` côté client : la conversion vers la forme enregistrée (kilogrammes dans `OrderItem.quantity`) appartient au serveur (`toStoredQuantity`).

**États.** Rupture ; anti-gaspi avec stock restant réel ; promotion avec ancien prix (voir `conformite-france` pour le prix de référence [L3]) ; variante obligatoire non choisie ; image absente (repli `resolveProductImage`, `lib/product-images.ts`).

**Code.** `components/product/*`, `lib/conversion-config.ts`, `lib/estimate.ts` (`computeEstimation`, « ≈ 4 pers. » — testé dans `src/lib/__tests__/estimate.test.ts`), `lib/pricing/`, `lib/cart/cart-line.ts`.

---

## 4. Panier — état client

**But.** Garder la sélection jusqu'à la validation, sans surprise.

**Règles.**
- Une seule boutique ; l'ajout depuis une autre ouvre « Changer de boutique ? » (`ConfirmDialog` dans `CartProvider`).
- Premier rendu toujours vide côté serveur et client, relecture du stockage après montage (corrige une erreur d'hydratation — ne pas relire dans l'initialiseur du reducer).
- Synchronisation `/api/cart` uniquement si la session est confirmée ou si une session de test est active (`hasTestModeCookie`) ; jamais d'appel pour un anonyme connu.
- La restauration depuis la base n'écrase jamais des articles ajoutés localement.
- Le prix du panier est une **estimation locale** ; dès que `/panier` est ouvert, le devis serveur fait foi et signale les produits disparus ou indisponibles.
- Un panier stocké est relu par `normalizeStoredCart` : une ligne qui n'est plus recevable est écartée, pas réparée à la main.

**À corriger.** Persistance `sessionStorage` (E17) ; suppression d'une ligne sans annulation possible (proposer « Annuler » dans le toast, voir `ux-marketplace`).

**Code.** `lib/hooks/use-cart.tsx` (fournisseur), `lib/cart/cart-line.ts` (type `CartItem`, `cartReducer`). Import : `import { useCart } from "@/lib/hooks/use-cart"`.

---

## 5. Validation — `/panier`

**But.** Transformer le panier en commande en moins d'une minute, compte ou pas.

**Ordre des blocs.** Aujourd'hui : articles → suggestions → code promo (connectés) → coûts → identité (invités) → créneau → note → paiement (connectés) → bouton. Cible : articles → suggestions → créneau → identité (invité seulement) → note → code promo → paiement → récapitulatif des coûts → bouton, pour que le total soit lu juste avant de confirmer.

**Règles.**
- **Devis serveur.** `useOrderQuote(buildQuoteRequest(selection))` appelle `POST /api/orders/quote` à chaque changement du panier ou du code (400 ms d'attente, une requête à la fois). Lignes, sous-total, remise, frais et « Total à payer » affichés viennent du devis ; l'estimation locale ne sert que pendant le calcul. Ne rien recalculer dans la page.
- **Créneau.** Deux modes : « Dès que possible » (avec heure estimée, E12) et « Choisir un créneau ». Les créneaux viennent de `/api/shops/[id]/available-slots?date=YYYY-MM-DD` (pas de calcul local, hormis le filtre des créneaux déjà passés). La date se calcule avec `localDateKey` (jamais `toISOString()`, qui recule d'un jour entre 0 h et 2 h).
- **Identité invité.** E-mail (obligatoire, sert au lien de suivi), prénom, nom, téléphone facultatif avec la raison de la demande (« pour vous prévenir si un article manque »). Un e-mail déjà rattaché à un compte est refusé par `/api/checkout/guest` (`CONFLICT`) : proposer la connexion sans perdre le panier.
- **Coûts.** Sous-total, remise, frais de service **seulement s'ils sont facturés** (`serviceFeeCents > 0`, donc jamais en paiement sur place), total. Mention « total estimé, ajusté à la pesée » dès qu'une ligne est au poids. Minimum de commande rappelé avec la somme manquante (« encore 4,20 € ») avant d'atteindre le dernier écran (E11).
- **Remise.** Le client envoie un code (`promoCode`) ; le montant est calculé par le serveur, qui peut le refuser (`discountRejection`, message à afficher sous le champ — en place).
- **Moyens de paiement.** Indiqués au plus tard au début de la validation (« Paiement sur place, au retrait »), pour tous, invités compris [L1] (A4).
- **Envoi.** Corps construit par `prepareCheckoutAttempt` avec `expectedTotalCents` = `amountDueCents` du devis et la clé d'idempotence de la tentative. Le bouton ne peut pas être déclenché deux fois [W5]. « Réessayer » renvoie le même corps et la même clé ; aujourd'hui il relance en plus le compte à rebours de 5 s (A3).
- **Bouton final.** Aujourd'hui désactivé sans explication tant qu'un créneau n'est pas choisi ou que le devis charge (E36) : préférer un bouton actif qui montre l'erreur à l'endroit du choix manquant [W5].
- **Refus serveur.** Voir le tableau ci-dessous.

| Code serveur | Message client | Action |
|---|---|---|
| `SERVICE_DISABLED` | Celui du serveur (pause, fermée, vacances) | Rester sur le panier ; proposer un créneau ultérieur ou une autre boutique |
| `CAPACITY_EXCEEDED` | « Ce créneau est complet » / « La boutique est temporairement surchargée » | Recharger les créneaux, garder le formulaire |
| `PRODUCTS_MISSING` | Nom des produits retirés | Retrait automatique des lignes (en place, mais seul un nombre est annoncé) |
| `STOCK_INSUFFICIENT` | Nom des produits indisponibles (fourni par le serveur) | Retirer ou remplacer la ligne (`details.unavailableProductIds`) |
| `PRICE_CHANGED` (409) | « Les prix ou la disponibilité ont changé… » | Retour au panier, devis rafraîchi, nouvelle confirmation (en place) |
| `VALIDATION_ERROR` | Message du serveur (minimum de commande, article invalide, panier périmé) | Mettre le champ ou la ligne en erreur, focus dessus |
| `NOT_FOUND` | « Cette boucherie n'est plus disponible » | Retour à la liste des boutiques, panier conservé jusqu'au choix du client |
| `CONFLICT` | Invité : « Un compte existe déjà avec cet e-mail » ; sinon clé d'idempotence déjà utilisée par un autre client | Proposer la connexion (`/sign-in?redirect_url=/panier`) sans vider le panier |
| Réseau | « Connexion interrompue » | « Réessayer » avec la même clé d'idempotence |

Aujourd'hui `OrderCountdown` ne traite à part que `PRICE_CHANGED` et `PRODUCTS_MISSING` ; pour tous les autres codes il affiche le message brut du serveur sous le titre « Oups, une erreur est survenue », avec « Réessayer » et « Retour au panier ». Plusieurs textes de l'écran sont sans accents (« Reessayer », « Commande envoyee », « Erreur reseau »).

**Code.** `panier/page.tsx` (824 lignes, au-delà de la règle des 300 : extraire `PickupSlotPicker`, `GuestIdentityForm`, `OrderSummary` avant d'ajouter quoi que ce soit, E26), `components/checkout/OrderCountdown.tsx`, `lib/cart/order-payload.ts`, `lib/hooks/use-order-quote.ts`, `lib/hooks/use-checkout-session.ts`.

**Repères.** Motifs d'abandon déclarés (Baymard, liste tenue à jour) : coûts annexes 40 %, création de compte imposée 18 %, tunnel trop long 17 %, total non visible d'avance 12 % [B1]. 47 % des sites qui proposent l'achat invité ne le mettent pas en avant [B2]. Proposer le compte à l'écran de confirmation, avec le seul mot de passe à saisir [B3]. 47 % des sites n'expliquent pas pourquoi ils demandent le téléphone, et 68 % des répondants hésitent à le donner [B5].

---

## 6. Création — serveur

`createOrder(body, customer)` (`lib/services/orders/create.ts`) enchaîne :

1. validation Zod stricte (`createOrderSchema`, `lib/validators/order.ts`) ;
2. rejeu : une commande déjà créée avec cette clé d'idempotence est renvoyée à son client (200) ;
3. devis (`prepareOrder`, `quote.ts`) : boutique, produits de cette boutique, lignes recevables, prix unitaire (pro, promotion, découpe), disponibilité et stock limité, remise, totaux ;
4. refus de prix (`priceRefusal`) : code promo refusé → `PRICE_CHANGED` ; minimum non atteint → `VALIDATION_ERROR` ; `amountDueCents ≠ expectedTotalCents` → `PRICE_CHANGED` ;
5. capacité (`checkShopCanTakeOrder`) : statut de la boutique, débit horaire, places du créneau ;
6. état initial (`initialState`) puis une seule transaction : consommation du code, numéros (client, jour, commande), écriture de la commande et de ses lignes, consommation de la récompense fidélité, réservation du stock limité si la commande naît acceptée ;
7. annonce (`announceNewOrder`).

Statut initial : `ACCEPTED` si `shop.autoAccept` (avec `estimatedReady` = début du créneau s'il est futur, sinon maintenant + préparation), sinon `PENDING` avec `expiresAt = maintenant + acceptTimeoutMin`. CLAUDE.md demande qu'une commande à créneau arrive toujours en `PENDING` : ce n'est le cas que si `autoAccept` est désactivé (E30).

Ce que la création ne fait pas encore et qu'il ne faut pas supposer : contrôle des horaires d'ouverture (E2), validation du créneau au-delà de la capacité (E29).

Toute règle nouvelle qui conditionne l'acceptation d'une commande se place **ici** (ou dans `quote.ts` si elle change le prix), puis se reflète dans l'écran. Jamais l'inverse.

---

## 7. Confirmation et suivi — `/suivi/[id]`

**But.** Rassurer, dire quand venir, permettre d'agir.

**Le client doit savoir.** Son numéro de retrait, l'état, l'heure prévue (fenêtre), l'adresse, et ce qu'il peut encore faire.

**Règles.**
- En tête : numéro du jour en très grand + `Prénom.N` — c'est ce qu'il dira au comptoir. Uber Eats place de même le numéro en haut de l'écran de suivi, sous le prénom et l'initiale [P7].
- Progression en segments visibles d'un coup d'œil ; l'heure en fenêtre fixe plutôt qu'en compte à rebours : chez Deliveroo, un minuteur qui remonte inquiétait les clients, le passage à une plage horaire a réglé le problème [P1] (E13).
- Dernière information en premier, langage courant, historique daté conservé [N4].
- Actions selon l'état : annuler (`PENDING`, ou `ACCEPTED` < 5 min) ; choisir une alternative (`PARTIALLY_DENIED`) ; accepter/refuser un ajustement de prix ; itinéraire et appel (dès `ACCEPTED`) ; noter (après `PICKED_UP`) ; recommander (états d'échec).
- États d'échec : motif (`denyReason`) + « Commander ailleurs » ; aucune consigne de retrait (E3).
- Invité : accès par jeton (`?guestToken=` ou cookie `GUEST_COOKIE_NAME`) ; proposer la création de compte ici [B3]. Toute API appelée par cette page doit accepter le même jeton : aujourd'hui `/api/orders/[id]/status` ne l'accepte pas et l'écran d'un invité ne se met pas à jour (E33).
- Demande de notification : ici, juste après la commande, sur un geste (« Me prévenir quand c'est prêt »), précédée d'une explication ; jamais au chargement d'une page [W6]. Sur iPhone, le push web n'existe que si le site est installé sur l'écran d'accueil [W8] : l'e-mail reste le canal garanti.
- Un changement de statut s'annonce aussi aux lecteurs d'écran (`role="status"`) [W2].

**États.** Chargement ; commande introuvable ou non autorisée (404, sans révéler l'existence) ; hors ligne (garder le dernier état connu et le dire) ; prêt depuis plus de 30 min (bandeau, en place).

**Code.** `suivi/[id]/page.tsx` (contrôle propriétaire ou invité côté serveur), `SuiviClient.tsx` (polling 3/5/10 s selon l'état, pause onglet caché — mais écrit avec un `setInterval` nu, sans ralentissement sur erreur : CLAUDE.md impose `useVisiblePolling` ; `commande/[id]/page.tsx` utilise déjà `startVisiblePolling` et `nextOrderPollDelay` de `hooks/useVisiblePolling.ts`, voir `order-lifecycle-realtime`), `commande/[id]/page.tsx` (annulation, alternatives, QR, avis — à fusionner, E4), `components/client/PriceAdjustmentBanner.tsx`. Les quantités s'affichent avec `formatStoredLineQuantity` (en place sur `/suivi`).

---

## 8. Retrait

**Règles.** Le client montre le numéro (et le QR s'il existe) ; le boucher scanne (`POST /api/boucher/orders/pickup`) ou confirme à la main (action `manual_pickup`) ; le statut passe à `PICKED_UP` ; le paiement sur place se fait à ce moment. Le ticket imprimé reprend numéro, `Prénom.N`, articles, total, code de retrait à 4 chiffres (`components/boucher/OrderTicket.tsx`).

**Repère.** Uber Eats demande au client de vérifier son numéro de commande avec le commerçant au retrait [P7] ; côté commerçant, les commandes passent par les onglets « In Progress » puis « Ready for Pickup » [P5].

**À prévoir (non couvert aujourd'hui, décision produit).** Client qui ne vient pas : rappel (cron `ready-reminder`, quotidien aujourd'hui), puis règle de clôture ; retrait par un tiers ; client sans téléphone (le prénom et le numéro suffisent).

---

## 9. Après la commande

- **Avis.** Demandé une fois, après `PICKED_UP`, sans contrepartie, dans l'application et non au comptoir ; date affichée ; règles complètes dans `seo-anti-penalty` et `conformite-france` [L4].
- **Recommander.** Depuis l'historique : `cartItemFromOrderLine` reconstruit chaque ligne (poids, variante, découpe conservés), le devis serveur recalcule les prix et signale les produits indisponibles. Reste à faire : nommer les lignes écartées, et offrir le même geste depuis l'accueil, où `ReorderSection` n'est qu'un lien vers la boutique (E16).
- **Fidélité.** Progression visible sur la boutique et au panier ; récompense applicable en un geste (point A5).
- **Favoris.** Réservés aux connectés (`components/ui/FavoriteButton.tsx` ne s'affiche pas pour un anonyme).

**Code.** `commandes/page.tsx`, `components/order/ReorderSection.tsx`, `/api/orders`, `/api/orders/[id]/rate`, `/api/reviews`, `components/shop/LoyaltyBadge.tsx`.
