---
name: click-and-collect
description: Parcours click & collect Klik&Go de bout en bout et règles métier — découverte boutique, catalogue au poids, panier mono-boutique, devis serveur, créneau de retrait, commande invité, confirmation, suivi, retrait au comptoir, recommande, et traitement côté boucher. À charger avant de toucher au panier, au checkout, aux créneaux, au suivi de commande, au mode cuisine ou à toute règle « qui peut commander quoi, quand ».
when_to_use: Panier, /panier, checkout invité, créneau de retrait, available-slots, createOrder, devis (quote), suivi commande, /suivi, /commande, statut commande, refus, rupture, ajustement de prix ou de poids, retrait, QR code, recommander, mode cuisine, boutique fermée ou en pause, précommande.
---

# Click & Collect Klik&Go — parcours et règles métier

Ce skill dit **ce que le produit doit garantir** à chaque étape d'une commande à retirer. Il ne décrit pas l'habillage des écrans (voir `ux-marketplace`) ni la mécanique temps réel (voir `order-lifecycle-realtime`).

## État du code décrit — à lire avant tout

Relevé initial au commit `161f920`, **entièrement revérifié le 14/11/2026 sur l'arbre de travail** : HEAD `32c581f` + chantier « intégrité des commandes », **non committé et encore en mouvement** (des fichiers ont changé pendant la relecture). Trois conséquences :

1. **Aucun numéro de ligne** n'est donné : chercher par nom de fonction, et relire le fichier avant de s'y fier.
2. Un statut « ✅ chantier » n'est vrai que si le chantier est dans votre branche. Test : `ls src/lib/pricing src/lib/cart src/lib/services/orders/quote.ts`. Si ces chemins manquent (ex. une branche tirée d'`origin/main` à `32c581f`), les écarts E1, E5, E6, E7, E31, E32 sont **ouverts** et l'ancien code s'applique : le signaler avant de coder, ne pas réécrire ce que le chantier apporte.
3. Le chantier a **supprimé** des routes : `/api/offers/validate`, `/api/checkout/validate-code`, `/api/orders/reorder`, `/api/orders/[id]/{accept,deny,preparing,ready,picked-up,respond,stock-issue,modify,prep-time}`. Ne pas les appeler, ne pas les recréer.

Modules du chantier à **utiliser** (jamais de formule de prix, de formateur de poids ou de transition de statut écrits à côté) :

| Besoin | Module |
|---|---|
| Ligne, quantité, total de ligne, texte d'un poids | `src/lib/pricing/{line,unit-price,discount,totals,format}.ts` |
| Ligne de panier, identifiant de ligne, reducer, recommande | `src/lib/cart/cart-line.ts` |
| Corps du devis et de la commande, clé d'idempotence | `src/lib/cart/order-payload.ts`, `src/lib/validators/order.ts` |
| Devis serveur (seul calcul de prix) | `src/lib/services/orders/quote.ts`, `POST /api/orders/quote`, `src/lib/hooks/use-order-quote.ts` |
| Création | `src/lib/services/orders/{create,shop-capacity,numbering,discount-ledger,limited-stock}.ts` |
| Changement de statut (seul écrivain après la création) | `src/lib/services/orders/transition.ts`, `commands/*.ts` |

## Skills voisins (ne pas dupliquer)

| Sujet | Skill |
|---|---|
| Disposition des écrans, formulaires, états vides/erreur, preuves sociales | `ux-marketplace` |
| Machine à états, polling, SSE, expiration automatique | `order-lifecycle-realtime` |
| E-mails, push, crons de relance | `background-jobs-notifications` |
| Paiement en ligne, remboursement | `stripe-payment` |
| Mentions légales, prix, avis, bouton de commande | `conformite-france` |
| Avis et notes (règles du propriétaire) | `seo-anti-penalty` — prioritaire |
| Recalcul des prix côté serveur, isolation boutique | `security-multitenant`, `api-route-conventions` |

## Carte du parcours (lire ces fichiers AVANT de coder)

Chemins relatifs à `src/` ; les écrans client sont sous `app/(client)/`.

| Étape | Écran / route | Fichiers | API |
|---|---|---|---|
| 1. Découverte | `/` | `app/(client)/page.tsx`, `decouvrir/NearbyShops.tsx`, `components/shop/ShopCard.tsx` | `/api/shops/nearby`, `/api/geo` |
| 2. Boutique | `/boutique/[slug]` | `boutique/[slug]/page.tsx`, `components/shop/ShopProductsClient.tsx` | — (rendu serveur à chaque requête + Redis 60 s) |
| 3. Produit | feuilles | `components/product/{ProductCard,WeightSheet,TrancheSheet,ProductSheet,QuantitySelector}.tsx`, `lib/conversion-config.ts`, `lib/estimate.ts` | — |
| 4. Panier | état client | `lib/hooks/use-cart.tsx` (Context + `useReducer`, `sessionStorage`, synchro `/api/cart` si connecté), `lib/cart/cart-line.ts` | `/api/cart` |
| 5. Validation | `/panier` | `panier/page.tsx`, `components/checkout/OrderCountdown.tsx`, `lib/hooks/{use-order-quote,use-checkout-session}.ts` | `/api/shops/[id]/available-slots`, `POST /api/orders/quote`, `POST /api/orders`, `POST /api/checkout/guest` |
| 6. Création | serveur | `lib/services/orders/create.ts` (à partir du devis de `quote.ts`) | — |
| 7. Suivi | `/suivi/[id]` (invité accepté) et `/commande/[id]` | `suivi/[id]/{page,SuiviClient}.tsx`, `commande/[id]/page.tsx`, `lib/order-state-machine.ts` | `/api/orders/[id]`, `/api/orders/[id]/status`, `/cancel`, `/alternatives`, `/choose-alternatives` |
| 8. Boucher | `/boucher/commandes` | `app/(boucher)/boucher/commandes/page.tsx`, `components/boucher/KitchenOrderCard.tsx`, `hooks/use-order-polling.ts` | `GET /api/boucher/orders/kitchen`, `PATCH /api/boucher/orders/[orderId]/action` (`boucherActionSchema`, `lib/services/orders/commands/action-schema.ts`) |
| 9. Retrait | comptoir | `components/boucher/QRScanner.tsx`, héros numéro + `Prénom.N` | `POST /api/boucher/orders/pickup` (scan) ; actions `confirm_pickup` et `manual_pickup` |
| 10. Après | `/commandes`, accueil | `commandes/page.tsx` (`cartItemFromOrderLine`), `components/order/ReorderSection.tsx` | `/api/orders`, `/api/orders/[id]/rate`, `/api/reviews` |

Détail étape par étape (objectif, états, règles, textes) : [references/parcours-client.md](references/parcours-client.md).

## Invariants métier

Chaque règle est suivie de sa raison. Statut au 14/11/2026 : ✅ tenu · ✅ chantier (tenu si le chantier est dans la branche) · ⚠️ partiel · ❌ non tenu. Preuves : [references/regles-metier.md](references/regles-metier.md).

1. **Un panier = une boutique.** Changer de boutique passe par la confirmation de `use-cart.tsx` ; jamais de vidage silencieux. *Un retrait = un comptoir.* ✅
2. **Le serveur décide du prix, de la remise, du stock, du créneau et de l'ouverture.** Le navigateur envoie des identifiants, des quantités, un code promo et le total qu'il a vu (`expectedTotalCents`) — **jamais** un prix ni un montant de remise : `createOrderSchema` est strict et refuse tout champ inconnu. `createOrder` recalcule tout et répond par un code : `VALIDATION_ERROR`, `NOT_FOUND`, `SERVICE_DISABLED`, `CAPACITY_EXCEEDED`, `PRODUCTS_MISSING`, `STOCK_INSUFFICIENT`, `PRICE_CHANGED`, `CONFLICT`. Chaque code a un message et une action de sortie côté client. Prix et remise : ✅ chantier. Créneau et horaires : ❌ (E2, E29).
3. **Une tentative de commande = une clé d'idempotence**, la même tant que le contenu confirmé ne change pas, y compris après « Réessayer » ou un rechargement. *Sans elle, un réseau qui coupe après l'écriture crée deux commandes.* ✅ chantier (`prepareCheckoutAttempt`, clé `klikgo-checkout-attempt` en `sessionStorage`, champ `idempotencyKey` obligatoire).
4. **« Commandable maintenant » = statut `OPEN`/`BUSY` ET heure de Paris dans `openingHours`.** Sinon : précommande sur le premier créneau, ou état fermé explicite avec l'heure de réouverture. *Une commande acceptée par le site puis expirée faute de boucher détruit la confiance.* ❌ (E2)
5. **Toute promesse d'heure est tenable.** « Dès que possible » affiche une heure estimée (préparation + mode occupé). Le premier créneau suit la règle CLAUDE.md (maintenant + 10 min, arrondi au créneau supérieur) ; l'étendre au temps de préparation est une proposition (A11). L'heure s'affiche en fenêtre (« 14h30 – 14h40 »), pas en compte à rebours à la seconde [P1]. ⚠️ (E12, E13)
6. **Aucun coût découvert au dernier écran, aucun coût affiché que le serveur ne facture pas.** *Les coûts annexes sont le premier motif d'abandon déclaré, une fois écartés les simples curieux (40 %)* [B1]. Le total affiché est celui du devis serveur (`amountDueCents`). Frais de service : `serviceFeeCentsFor(paymentMethod)` (`lib/pricing/totals.ts`) — **0 en paiement sur place**, `SERVICE_FEE_CENTS` (99) en ligne ; `Order.totalCents` ne contient jamais les frais ; ne jamais écrire 0,99 € en dur. Frais : ✅ chantier. Minimum de commande (`Shop.minOrderCents`) : ⚠️ signalé sur `/panier` seulement une fois le panier en dessous, jamais sur la page boutique (E11).
7. **Produit au poids : prix au kilo, total estimé, tolérance annoncée.** Quand le prix ne peut pas être calculé à l'avance, la loi demande d'en fournir le mode de calcul [L5] : le prix au kilo et l'estimation en tiennent lieu. Tout écart au-delà de la tolérance passe par l'ajustement de prix ; une hausse n'est jamais silencieuse. ⚠️ (plusieurs valeurs de tolérance — A2 ; seuils d'ajustement — A1)
8. **Invité d'abord, compte ensuite.** La commande sans compte reste le chemin par défaut ; la création de compte se propose après la commande [B2][B3]. L'invité a les capacités essentielles du connecté : créneau, note, suivi **qui se met à jour**, annulation. ❌ (le suivi d'un invité ne se rafraîchit pas : `/api/orders/[id]/status` exige une session — E33 ; ni annulation ni réponse à une rupture — E4). Le code promo est refusé à l'invité **par le serveur** (`LOGIN_REQUIRED`) : décision à confirmer (A14), ne pas la contourner côté écran.
9. **Chaque changement de statut est visible et notifié une fois.** Les états d'échec (`DENIED`, `CANCELLED`, `AUTO_CANCELLED`) affichent le motif et une action ; ils n'affichent jamais de consigne de retrait. ❌ sur `/suivi` (E3)
10. **Un seul récit de la commande.** Mêmes libellés, mêmes actions, même règle d'annulation quel que soit le point d'entrée. Cible : libellés tirés de `ORDER_STATUS_LABELS` (`lib/design-tokens.ts`) et `TRACKER_STEPS` (`lib/order-state-machine.ts`) — aujourd'hui aucun écran client ne les importe. ❌ (deux pages, sept fichiers de libellés — E4, E18)
11. **Retrait = numéro du jour + `Prénom.N`, QR en secours.** Format du nom : `formatClientName` (`lib/format-kitchen.ts`, « Tarik.B », règle CLAUDE.md) — `/suivi` écrit encore « Tarik B. » à la main. Le boucher clôt par scan ou confirmation manuelle ; l'avis n'est demandé qu'après `PICKED_UP`, sans contrepartie (voir `seo-anti-penalty`). ⚠️
12. **Heure de Paris partout côté serveur** (`lib/paris-time.ts`), prix en centimes, poids en grammes ; le service ne s'appelle jamais « livraison ». ✅
13. **Preuve sociale et urgence uniquement sur données réelles** (modèle : `ordersThisWeek >= 5` dans `boutique/[slug]/page.tsx`, `antiGaspiStock`). *Une fausse rareté est une pratique trompeuse* [L2]. ✅ sur les écrans lus

## Règles de décision rapides

| Situation | Décision | Raison |
|---|---|---|
| Boutique `PAUSED`/`AUTO_PAUSED` | Catalogue consultable, ajout désactivé ; « Reprise vers HH:MM » si `pauseEndsAt` existe (une pause automatique n'a pas d'heure de fin : dire « momentanément indisponible ») | Ne pas laisser remplir un panier qui sera refusé à la fin |
| Boutique fermée par horaires | Proposer la précommande sur le premier créneau du prochain jour ouvré (décision produit à confirmer, A10) | Les achats de viande se préparent la veille |
| Créneau complet | Désactivé et étiqueté « Complet » ; le serveur revalide la capacité (`maxOrdersPerSlot`, `shop-capacity.ts`) | Deux clients peuvent viser le même créneau |
| Créneau reçu par le serveur | Le revalider en entier : futur, dans les horaires du jour, aligné sur l'intervalle, en heure de Paris (`parisWallClockToUtc`) — aujourd'hui seule la capacité est vérifiée (E29) | Le navigateur peut être dans un autre fuseau ou envoyer n'importe quelle date |
| Commande à créneau, boutique en `autoAccept` | Reste `PENDING` (section « Commandes Programmées » de CLAUDE.md : « PAS auto-acceptées ») — le code la passe en `ACCEPTED` (E30), et la liste des fonctionnalités de CLAUDE.md dit l'inverse : à trancher (A15) avant de coder | Le boucher doit voir et confirmer une commande programmée |
| Créneau perdu entre l'affichage et l'envoi (`CAPACITY_EXCEEDED`) | Rester sur `/panier`, recharger les créneaux, garder le reste du formulaire | Ne jamais faire ressaisir [N5] |
| Total changé entre l'affichage et l'envoi (`PRICE_CHANGED`, 409) | Retour au panier, devis rafraîchi, le client reconfirme le nouveau total — en place (`onPriceChanged`) : conserver | Personne ne paie un total qu'il n'a pas vu |
| Produit disparu ou en rupture | Le devis le signale avant la commande (`PRODUCTS_MISSING`, `STOCK_INSUFFICIENT`) : retirer la ligne, **dire laquelle**, laisser confirmer | Aujourd'hui seul un nombre est annoncé |
| Rupture après acceptation | `PARTIALLY_DENIED` : le client remplace ou retire chaque ligne (`choose-alternatives`), la commande repasse en `PENDING` | Même logique que Deliveroo [P9] et Instacart [P10] |
| Hausse de prix après pesée | Bandeau d'ajustement sur le suivi, décision du client tracée | Invariant 7 |
| Boucher muet | Cible : `AUTO_CANCELLED` dès `expiresAt` (= création + `acceptTimeoutMin`, 10 min par défaut, comme Deliveroo [P8]) + proposition d'une autre boutique. Aujourd'hui seul le cron `auto-cancel` expire une commande, et `vercel.json` le planifie **une fois par jour** (E34) | Ne pas laisser attendre ; ne pas afficher « expire dans 10 min » si rien n'expire |
| Commande prête non retirée | Bandeau sur le suivi après 30 min (en place). Le rappel par notification (cron `ready-reminder`) ne tourne qu'une fois par jour (E34) | Limiter les oublis |
| Annulation client | `PENDING`, ou `ACCEPTED` moins de 5 min après la création (`cancelOrderByCustomer`, `isCancellable`). Refusée par le serveur en `PARTIALLY_DENIED`, alors que l'écran y propose le bouton (E35) | Après, la préparation a commencé |

## Côté boucher (résumé)

Le mode cuisine est un outil de comptoir : mains occupées, tablette à distance, bruit. Règles : une action principale par carte et par statut ; refus toujours motivé (le motif part au client) ; délai proposé par défaut = `prepTimeMin` de la boutique ; « occupé » et « pause » accessibles en un geste ; perte de connexion et session expirée visibles en permanence. Références de marché et écarts : [references/cote-boucher.md](references/cote-boucher.md).

## Erreurs déjà commises ici (à ne pas reproduire)

1. Promettre côté client ce que le serveur ne vérifie pas ou ne fait pas (horaires d'ouverture, expiration « dans 10 min » portée par un cron quotidien ; hier : frais de service affichés mais jamais facturés).
2. Envoyer une commande sans clé d'idempotence alors qu'un bouton « Réessayer » existe (corrigé par le chantier).
3. Construire deux pages de suivi au lieu d'une : `/suivi` n'a ni annulation ni choix d'alternative, `/commande` n'est pas le lien des e-mails et refuse l'invité.
4. Laisser un écran de suivi « heureux » sur une commande refusée (numéro géant + « Présentez ce numéro au comptoir »).
5. Recalculer un total localement dans un écran : panier, ligne et serveur divergeaient dès qu'une découpe avait un prix ou qu'un produit était au kilo. Formule unique : `lineTotalCents` (`lib/pricing/line.ts`), total affiché = devis serveur.
6. Dupliquer un bloc d'écran par public (créneau invité / créneau connecté) : les textes ont divergé (accents, tutoiement).
7. Recommander en recopiant d'anciennes lignes sans poids ni variante (corrigé par le chantier : `cartItemFromOrderLine`, prix recalculé par le devis).
8. Citer un chiffre non vérifié dans le code (« Baymard +23 % », toujours présent dans `panier/page.tsx`) : le chiffre publié est une part d'abandons, pas un gain de conversion [B1][B2].
9. Accepter du navigateur un prix ou un montant (`cutPriceCents`, `discountCents`) au lieu de le recalculer à partir de la base (corrigé par le chantier).
10. Ouvrir un parcours à l'invité (page `/suivi`) sans ouvrir les API que cette page appelle (`/status`) : l'écran reste figé.

Liste complète, priorisée, avec preuve et test d'acceptation : [references/ecarts-constates.md](references/ecarts-constates.md).

## Checklist avant de livrer une modification du parcours

- [ ] Le changement respecte les 13 invariants ; sinon l'écart est écrit dans la PR.
- [ ] Testé en **invité** et en **connecté**, en « dès que possible » et en créneau, avec un produit au poids, un à la tranche, un à la pièce. En local ou en preview, une session de test s'ouvre par `POST /api/test-mode/activate` (jamais en posant des cookies à la main, voir CLAUDE.md « Test Mode »).
- [ ] Testé boutique `OPEN`, `BUSY`, `PAUSED`, `CLOSED`, et hors horaires.
- [ ] Les 8 codes de refus de l'invariant 2 ont chacun un message en français correct et une action.
- [ ] Corps de requête modifié à la main (champ de prix ajouté, découpe inconnue, créneau passé ou hors horaires, quantité 0 ou 100, poids sur un produit à la pièce) : le serveur refuse, il ne fait jamais confiance.
- [ ] Le total affiché avant le bouton final est `amountDueCents` du devis, égal au centime à `Order.totalCents + Order.serviceFeeCents`.
- [ ] Double appui sur « Confirmer » et « Réessayer » après coupure réseau : une seule commande.
- [ ] Minuit–2 h et changement d'heure : les créneaux restent justes (helpers `paris-time.ts`, pas de `toISOString()` pour une date locale).
- [ ] Les statuts d'échec affichent motif + action sur tous les écrans de suivi.
- [ ] Aucun libellé de statut, aucune formule de prix, aucun formateur de poids écrit en dur dans un écran.
- [ ] Toute fonction pure ajoutée dans `src/lib/**` a son test Vitest (règle CLAUDE.md).

## Définition de terminé (domaine click & collect)

Un travail est terminé quand : (1) le scénario nominal et les scénarios d'échec de l'étape touchée sont couverts par un test (Vitest pour les règles pures, intégration `tests/integration/orders/` pour la création et les transitions, Playwright pour le parcours — voir `testing-strategy`) ; (2) invité et connecté obtiennent le même résultat métier, ou la différence est une décision écrite ; (3) le boucher voit l'effet dans le mode cuisine sans rechargement ; (4) le client est informé du résultat par l'écran et par une notification ; (5) `references/regles-metier.md` et `references/ecarts-constates.md` sont mis à jour si une règle change de statut ; (6) `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm run test` passent.

## Points à arbitrer (propriétaire)

Tant qu'un point n'est pas tranché, la règle écrite dans CLAUDE.md s'applique et le code n'est pas modifié sur ce point. Détail, preuves et propositions : [references/points-a-arbitrer.md](references/points-a-arbitrer.md).

- **A1 — Ajustement de prix.** CLAUDE.md : hausse ≤ seuil avec 5 min pour répondre. Code : ≤ 10 % approuvée d'office, 10–20 % approuvée après 30 s, > 20 % escaladée après 10 min. Quelle règle ?
- **A2 — Tolérance de poids.** 15 % (défaut produit), 10 % ou 15 % affichés selon le mode, 10 % dans un service inutilisé. Une seule valeur.
- **A3 — Compte à rebours de 5 s avant envoi** (+ 2 s de succès) : le garder, ou envoyer tout de suite avec annulation libre en `PENDING`.
- **A4 — Bouton final et moyens de paiement.** « Confirmer ma commande » face à l'article L221-14 [L1] ; paiement sur place à indiquer à tous, invités compris.
- **A5 — Fidélité.** CLAUDE.md : 3 paliers en euros ; l'écran boutique affiche un pourcentage par boutique.
- **A6 — Page de suivi unique.** Garder `/suivi/[id]`, rediriger `/commande/[id]`.
- **A7 — Persistance du panier.** `sessionStorage` (perdu à la fermeture de l'onglet) ou `localStorage` avec expiration.
- **A8 — Prix en ligne majoré** par rapport au prix boutique (markup) : l'indiquer au client ?
- **A9 — Paiement en ligne.** Sans objet depuis le chantier (`/panier` n'envoie que `ON_PICKUP`) ; à rouvrir avec `stripe-payment`.
- **A10 — Précommande boutique fermée** : impossible aujourd'hui.
- **A11 — Marge du premier créneau.** CLAUDE.md : maintenant + 10 min. Proposition : `max(10 min, prepTimeMin + busyExtraMin)`. Ne pas toucher à `earliestPickupMinutes` sans accord.
- **A12 — Horaires non renseignés.** Si l'invariant 4 est appliqué, une boutique sans `openingHours` devient non commandable : bloquer son activation, ou la considérer ouverte ?
- **A13 — Frais de service au retrait.** Le chantier pose 0 sur place : un code ou un badge « Frais offerts » (CLAUDE.md) n'a alors rien à offrir.
- **A14 — Code promo pour l'invité.** Refusé par le serveur (`LOGIN_REQUIRED`) et masqué sans explication.
- **A15 — Commande programmée et acceptation automatique.** CLAUDE.md se contredit (« auto-acceptées » dans la liste des fonctionnalités, « PAS auto-acceptées » dans la section dédiée) ; le code accepte d'office si `autoAccept` (E30).

## Références

- [references/parcours-client.md](references/parcours-client.md) — les étapes en détail.
- [references/regles-metier.md](references/regles-metier.md) — catalogue des règles avec statut et preuve dans le code.
- [references/cote-boucher.md](references/cote-boucher.md) — traitement des commandes au comptoir, comparaison Uber Eats / Deliveroo.
- [references/ecarts-constates.md](references/ecarts-constates.md) — écarts ouverts et écarts fermés par le chantier, priorisés.
- [references/points-a-arbitrer.md](references/points-a-arbitrer.md) — les 15 décisions en attente, avec preuves et propositions.
- [references/sources.md](references/sources.md) — sources externes, ce qu'elles prouvent, date de consultation.
