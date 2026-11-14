# Payer une commande pesée — autorisation puis capture

Repères `[S..]` : [sources.md](sources.md). Code compilé : [patterns.md](patterns.md).

## 1. Pourquoi ce modèle

Le prix d'une commande de viande n'est connu qu'après la pesée. L'ajustement existe mais ne parle pas à Stripe : création par `adjustOrderPrice` (`services/orders/adjust-price.ts`, statuts `ACCEPTED` et `PREPARING`), application par `settleAdjustmentInTx` (`services/orders/adjustment-settlement.ts`, statuts `ACCEPTED`, `PREPARING` et `READY`), réglages dans `src/lib/price-adjustment-config.ts` (`TIER_1_MAX` 10 %, `TIER_2_MAX` 20 %, `MAX_INCREASE_PCT` 50 %).

Faits qui encadrent la solution :
- Une autorisation carte en ligne tient 7 jours pour une transaction initiée par le client (Visa, Mastercard, Amex) ; une transaction Visa initiée par le marchand tient 4 jours 18 heures. Passé ce délai le PaymentIntent passe à `canceled` [S8]. La durée Cartes Bancaires n'est pas publiée : lire `capture_before`.
- On peut capturer **moins** que l'autorisé, le reste est libéré ; on ne capture qu'**une fois** dans la plupart des cas [S8].
- Capturer **plus** exige la sur-capture : IC+ seulement, et Visa l'exclut pour les marchands de l'EEE. Sous SCA, il faut avoir authentifié au moins le montant capturé ; sinon annuler et créer un nouveau paiement [S9].
- Annuler avant capture est gratuit ; rembourser ne rend pas les frais Stripe. Stripe conseille l'autorisation puis capture aux activités qui remboursent souvent [S17].
- Instacart pratique le même principe pour les articles pesés (montant autorisé supérieur, libéré ensuite) [S33].
- La « capture différée automatique » (`automatic_delayed`) est en *private preview* : ne pas s'appuyer dessus [S8].

Bénéfice propre à Klik&Go : une commande refusée, expirée ou annulée avant préparation ne coûte rien.

## 2. Montants

```
amountDue   = Order.totalCents + Order.serviceFeeCents   (le « Total à payer » confirmé, expectedTotalCents)
marge       = ceil(assiette x margePct / 100)
autorisé    = amountDue + marge
capturé     = totalCents final + serviceFeeCents          (toujours <= autorisé)
commission  = computeOrderFees({ orderSubtotalCents: totalCents final, effectiveCommissionRate: tauxGelé })
```

- **Assiette et taux de la marge : à arbitrer** (SKILL.md, n° 2). Ce que le code impose de savoir :
  - le palier (`computeTier`) se calcule sur le total **courant de toute la commande**, pas sur les lignes pesées ni sur le montant autorisé ;
  - un ajustement peut être de type `WEIGHT`, `PRICE` ou `MANUAL` et toucher n'importe quelle ligne ;
  - une commande ne porte qu'un ajustement à la fois, mais une nouvelle proposition remplace la précédente une fois réglée : les hausses se succèdent, chacune relative au total du moment, comme le plafond `maxIncreasePct` (`maxAdjustmentsPerOrder` existe dans la configuration mais aucun code ne l'applique).
  - Donc : assiette = `Order.totalCents` et taux = `tier2MaxPct` (`getPriceAdjConfig()` de `src/lib/price-adjustment.ts`) couvrent **un** ajustement de palier 1 ou 2 depuis le total initial, rien de plus. Une assiette réduite aux lignes pesées (`unit` `KG` ou `TRANCHE`) bloque moins d'argent mais refuse plus tôt.
- **La garde ne dépend pas du palier** : pour une commande `ONLINE`, `adjustOrderPrice` refuse (ou envoie vers l'arbitrage n° 3) tout ajustement dont `nouveau total + serviceFeeCents > montant autorisé`. C'est elle qui garantit `capturé <= autorisé`, quelle que soit la marge retenue. Elle se pose dans la transaction qui verrouille déjà la commande (`lockOrderForAdjustment`), à côté du contrôle `maxIncreasePct`.
- Sans marge possible (aucune ligne ajustable) : autoriser le montant exact, garder quand même la capture manuelle pour annuler sans frais.
- **Geler le taux de commission à l'autorisation** : `getEffectiveCommissionRate()` dépend du palier (recalculé le 1er du mois) et de `earlyAdopterUntil`.
- `computeOrderFees` doit lire `Order.serviceFeeCents` (et non la constante) pour rester aligné sur `serviceFeeCentsFor()` (défaut D16).
- La page Checkout affiche le total des `line_items`, égal au montant autorisé : marge sur une ligne dédiée et explication via `custom_text.submit.message` [S9]. Texte à valider (`conformite-france`, `ux-marketplace`).
- Certaines banques montrent l'autorisation comme un débit [S8] : le dire dans la confirmation.

## 3. Flux nominal

1. `POST /api/orders` (`services/orders/create.ts`) crée la commande `PENDING`, `paymentMethod: ONLINE`. **Ni acceptation auto (`initialState`), ni `announceNewOrder`, ni délai d'acceptation**. En revanche une **échéance de paiement** est posée (champ à créer, ou `expiresAt` réutilisé : à décider avec `order-lifecycle-realtime`).
2. `POST /api/orders/[id]/checkout-session` :
   - gardes : propriétaire, statut `PENDING`, non autorisée, échéance de paiement non dépassée, boutique `acceptOnline` et `stripeChargesEnabled`, `totalCents > 0` ;
   - session `open` déjà enregistrée → renvoyer son `url` ; expirée → nouvelle tentative ;
   - `checkout.sessions.create` : `payment_method_types: ["card"]`, `payment_intent_data.capture_method: "manual"`, `application_fee_amount`, `transfer_data.destination`, `expires_at` (30 min minimum, 24 h maximum [S13]), `metadata` sur la session **et** le PaymentIntent.
3. Le client paie ; 3DS géré par Checkout [S37]. PaymentIntent `requires_capture`, événement `payment_intent.amount_capturable_updated` [S8][S16].
4. Webhook : enregistrer PaymentIntent, charge, montant autorisé, `capture_before`, taux gelé. **Puis** démarrer le délai d'acceptation (`expiresAt`), appeler l'annonce cuisine, et si `Shop.autoAccept` appeler `acceptOrder` (`commands/accept.ts`) avec le `shopId` de la commande et `actorId: SYSTEM_ACTOR_ID`. Ne pas écrire une transition nue vers `ACCEPTED` : `acceptOrder` pose le QR code et l'heure estimée, réserve le stock limité et inscrit les unités réservées dans l'événement `ACCEPTED`, dont dépend toute libération ultérieure.
5. Le boucher accepte, prépare, pèse ; les ajustements modifient `totalCents`.
6. `markReady` (`commands/progress.ts`) : transition commitée, **puis** capture du montant final avec la commission recalculée, sauf ajustement encore `PENDING` (§ 4).
7. `payment_intent.succeeded` : `paidAt`, `stripeFeeCents` (`balance_transaction.fee`), `stripeTransferId` (`charge.transfer`). Si l'un de ces deux champs manque encore dans la réponse, le rattrapage le complète.
8. Retrait (`confirmPickup`), `COMPLETED` : aucun appel Stripe.

`checkout.session.completed` arrive aussi à l'étape 3 ; en capture manuelle il sert seulement à relier session et commande. La valeur de `payment_status` dans ce cas n'est pas documentée : se fier au PaymentIntent (sources, « Non vérifié »).

Pourquoi capturer à `READY` plutôt qu'au retrait : aucun ajustement ne peut plus être **créé** après `PREPARING`, et la capture ne dépend pas d'un geste au comptoir. Attention, un ajustement créé avant peut encore être **appliqué** tant que la commande est `READY` (`ADJUSTMENT_SETTLEMENT_STATUSES` : acceptation du client, échéance du palier 2 réglée à la lecture) ; il n'est clos d'office qu'au retrait (`closePendingAdjustment` dans `confirmPickup`). Voir § 4 et le défaut D17.

## 4. Variantes

| Cas | Conduite |
|---|---|
| Refus de carte | `payment_intent.payment_failed` : ne rien changer, la session reste utilisable [S16] |
| Session abandonnée | `checkout.session.expired` → `transitionOrder` vers `AUTO_CANCELLED` ; `releaseClosedOrder` rend coupon et récompense |
| Commande créée, aucune session jamais ouverte | Aucun événement Stripe n'arrivera : c'est l'échéance de paiement, balayée par la tâche planifiée, qui ferme la commande (`AUTO_CANCELLED`, mêmes effets) |
| Refus boucher, délai dépassé, annulation client avant `READY` | Commande de `commands/close.ts`, puis libération (`paymentIntents.cancel`). `payment_intent.canceled` confirme |
| Rupture (`PARTIALLY_DENIED`, `commands/unavailable.ts`) | Ligne retirée : le total baisse. Ligne remplacée (`replacementChange`) : le total peut **monter**, le remplacement étant tarifé à son propre prix. Refuser un remplacement qui dépasse l'autorisé ; capture finale sur le nouveau total |
| Ajustement `PENDING` au moment de « Prête » | Arbitrage n° 10. Si la capture est différée : elle part à la résolution de l'ajustement (acceptation, refus, validation d'office) et, en filet, par le rattrapage |
| Ajustement résolu alors que la commande est déjà capturée | Interdit : `settleAdjustmentInTx` le clôt sans l'appliquer, comme il le fait déjà quand la commande a changé (règle 15). L'écart se traite par remboursement partiel ou au comptoir |
| Total final > autorisé | Capture refusée par nos gardes ; arbitrage n° 3 |
| Capture refusée par Stripe (autorisation expirée ou annulée) | Ne pas bloquer le boucher : signaler « à encaisser au comptoir », `logger.error` (Sentry), pas de `paidAt` |
| Client absent après `READY` | Paiement capturé ; politique dans les CGV (`conformite-france`) |
| Autorisation proche de l'échéance | Tâche planifiée : alerte puis capture ou annulation selon le statut ; lire `capture_before` [S8] |

## 5. Retrait lointain (précommande, Aïd)

Seuil proposé : si `pickupSlotStart` dépasse **4 jours** (marge sous les 4 j 18 h du cas le plus court publié [S8], durée CB inconnue), l'autorisation risque d'expirer avant la pesée et l'extension est réservée à IC+ [S19]. À confirmer en bac à sable en lisant `capture_before` sur une carte CB. Au-delà du seuil :

1. Session sans `capture_method` (capture immédiate), montant = `amountDue`, sans marge.
2. `payment_intent.succeeded` (ou `checkout.session.completed` avec `payment_status: "paid"`) pose `paidAt` [S13].
3. Poids inférieur : remboursement partiel ([remboursements-litiges.md](remboursements-litiges.md)).
4. Poids supérieur : complément au comptoir ; un débit hors session peut exiger une authentification que le client absent ne peut pas fournir [S37].
5. Refus du boucher : remboursement total, frais Stripe perdus [S17].

Choix du mode côté serveur, à la création de session, depuis `pickupSlotStart` : fonction pure à tester. Dans ce mode la commande est capturée dès le paiement : la règle 15 s'applique d'emblée, `totalCents` reste le montant payé.

## 6. Invariants à tester

- `capturé <= autorisé`, sinon aucun appel Stripe.
- `application_fee_amount < capturé` (Stripe plafonne sans erreur [S5]).
- Jamais deux autorisations actives pour une commande.
- Aucun ajustement ni remplacement accepté au-delà du montant autorisé ; aucune écriture de `totalCents` après capture.
- Aucune commande `DENIED`, `CANCELLED`, `AUTO_CANCELLED` avec autorisation ouverte ou paiement non remboursé (contrôle planifié).
- Aucune commande `ONLINE` non autorisée renvoyée par `kitchen.ts` ni comptée par `pending-count`.
- Aucune commande `ONLINE` non autorisée au-delà de son échéance de paiement.
- Double clic sur « Prête » : une seule capture (`capture:{orderId}:{montant}`).

## 7. Champs à ajouter (avec `prisma-expert`)

Identifiant de charge, montant et date d'autorisation, `captureBefore`, taux de commission gelé, échéance de paiement, `paymentReleasedAt` (libération faite), `captureFailedAt`. `paidAt` garde son sens : argent capturé. Migration : `migrate deploy` en production, `git add prisma/schema.prisma`.

## 8. Brancher sans appel réseau dans la transaction

`transitionOrder` exécute ses `effects` dans une transaction (`timeout: 10_000`). Un appel Stripe y tiendrait les verrous de la ligne pendant un aller-retour réseau et, si la transaction échoue après l'appel, laisserait un argent capturé sans commande à jour. Schéma retenu :

```
1. transitionOrder(...)                 // statut + OrderEvent + effets DB, commit
2. si outcome.ok et paymentMethod ONLINE :
     résultat = await captureOrderPayment / releaseOrderPayment   (service stripe, clé stable)
     écrire le résultat (captureFailedAt / paymentReleasedAt)       (updateMany conditionnel)
3. rattrapage planifié : commandes ONLINE à statut READY+ sans paidAt, ou fermées sans paymentReleasedAt
     → relire le PaymentIntent, enregistrer ce qui a déjà eu lieu, sinon rappeler le même service
```

| Déclencheur | Fichier | Service à appeler après commit |
|---|---|---|
| `READY` | `commands/progress.ts` `markReady` | `captureOrderPayment` |
| Ajustement résolu sur commande `READY` | `acceptAdjustment`, `rejectAdjustment`, `settleDueAdjustment` (`services/orders/adjustment-answers.ts` au relevé), après leur transaction | `captureOrderPayment` |
| `DENIED`, `CANCELLED` | `commands/close.ts` `denyOrder`, `cancelOrderByShop`, `cancelOrderByCustomer` | `releaseOrderPayment` |
| `AUTO_CANCELLED` | `commands/close.ts` `expireOrder` / `expireDueOrders` (cron `auto-cancel`) | `releaseOrderPayment`, par lot borné |
| Liste cuisine | `services/orders/kitchen.ts`, `api/boucher/orders/pending-count` | filtre « `ON_PICKUP` ou autorisée » |

- Logique Stripe dans `src/lib/services/stripe/` (un service par action, `{ ok } | { ok: false, code }`), jamais dans les routes.
- Le même service écrit `paidAt` que l'information vienne du webhook, de la réponse de capture ou du rattrapage : une fonction, une écriture conditionnelle (`paidAt: null` dans le `where`), donc aucun double effet.
- **Cadence du rattrapage** : en minutes, pas en jours. Aujourd'hui tous les crons de `vercel.json` sont quotidiens (`auto-cancel` à 01:00 UTC) : une autorisation à libérer ou une capture manquée ne peut pas attendre le lendemain. S'appuyer sur le cron unique à la minute prévu par `background-jobs-notifications` (`verifyCronAuth`, `try/catch`, `logger` ; son point B1 le subordonne à la confirmation du plan Vercel) plutôt que d'ajouter un cron par besoin. Sans rattrapage à cette cadence, ne pas activer le paiement en ligne. Le délai d'expiration d'une session (30 min à 24 h) et l'échéance de paiement se règlent sur cette cadence.
