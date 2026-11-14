# État du code Stripe — relevé du 2026-11-14

Base : HEAD `32c581f` + chantier 0 non commité (arbre de travail). Les numéros de ligne sont indicatifs : les revérifier avant d'éditer, le chantier bouge encore `src/lib` et `src/app/api/orders`.
Chaque ligne a été relue dans le code par un second passage le 2026-11-14 ; D1, D3 et D7 ont en plus été reproduits par un test d'intégration ([patterns.md](patterns.md) § 11). Les fichiers d'ajustement de prix ont été réécrits pendant ce passage : leur description date de 09 h 46 et peut encore bouger. Les fichiers Stripe (`src/lib/stripe.ts`, `services/stripe/*`, `api/payments/*`, `api/boucher/stripe/*`) sont ceux de HEAD.

## 1. Carte des fichiers

| Fichier | Rôle | État |
|---|---|---|
| `src/lib/stripe.ts` | `getStripeClient()` (singleton), `isStripeConfigured()`, `STRIPE_WEBHOOK_SECRET` lu **à l'import** | Correct. Manque `timeout` (D13). Commentaire « Basil » faux (version `dahlia`) ; renvoie à `audit/stripe-activation.md`, dépassé |
| `src/lib/services/stripe/commission.ts` | Paliers Bronze à Platine (8 à 5 %), plancher 5 %, bonus pionnier, HT (TVA 5,5 %), `SERVICE_FEE_CENTS = 99`, majoration du prix en ligne | Testé (`tests/lib/stripe-commission.test.ts`). `computeOrderFees` ignore `Order.serviceFeeCents` ; `estimateStripeFeeCents` faux (D12) |
| `src/lib/pricing/totals.ts` | `serviceFeeCentsFor("ON_PICKUP") = 0`, `("ONLINE") = SERVICE_FEE_CENTS` ; `computeOrderTotals` → `amountDueCents` | Seule source de la politique de frais : Stripe doit la lire |
| `src/lib/services/stripe/checkout-session.ts` | Destination charge, `application_fee_amount`, ligne « Frais de service » | Paiement immédiat seulement. D4, D6, D10, D16 |
| `src/lib/services/stripe/connect.ts` | Compte Express idempotent, Account Link, Login Link, `syncShopStripeStatus` | Correct. `type: "express"` hérité ; `business_type: "individual"` par défaut ; `mcc: "5499"` |
| `src/app/api/orders/[id]/checkout-session/route.ts` | Contrôle de propriété (Clerk → Prisma), refuse `ON_PICKUP` et commande payée | Ne contrôle ni le statut ni l'expiration de la commande ; inaccessible à un invité (`getServerUserId()`) |
| `src/app/api/payments/webhook/route.ts` | Signature, marqueur `StripeEvent` avant traitement, 7 événements | Base saine. D1, D2, D3, D5, D7, D8, D12, D14, D18 |
| `src/app/api/payments/[orderId]/route.ts` | Stub `SERVICE_DISABLED` | À implémenter ou supprimer |
| `src/app/api/boucher/stripe/{onboard,dashboard-link,refresh-status}/route.ts` | Onboarding, lien Express, rafraîchissement | Authentification et `shopId` corrects. Méthode HTTP des créations : règle de SKILL.md § 9 (état actuel : registre privé du programme) |
| `src/app/(boucher)/boucher/parametres/paiement/page.tsx` | Statut du compte, palier, taux | Recopie les taux en dur (`TIER_INFO`, liste 8/7/6/5 %) au lieu de lire `TIER_THRESHOLDS` |
| `src/app/(client)/checkout/{success,cancel}/page.tsx` | Retour de Checkout | `success` n'écrit rien (bien) mais lit `paidAt`, qui restera nul entre autorisation et capture : afficher l'état d'autorisation. `cancel` est le seul appelant de la route de session |
| `src/lib/hooks/use-checkout-session.ts` | **Piège de nom** : dit qui commande (Clerk ou mode test), aucun rapport avec une Checkout Session Stripe | Ne pas y mettre de logique de paiement |
| `src/lib/validators/order.ts` | `paymentMethodSchema = z.literal("ON_PICKUP")`, schémas `.strict()` | Verrou volontaire |
| `src/lib/cart/order-payload.ts`, `src/lib/services/orders/quote.ts` | `paymentMethod: "ON_PICKUP"` en dur dans la requête ; type littéral dans `OrderQuote` | Verrous à lever en même temps que le validateur |
| `src/lib/validators/index.ts` (schémas de mise à jour de la boutique) | Garde serveur d'`acceptOnline` : règle de SKILL.md § 9, état actuel au registre privé du programme | D9 |
| `src/lib/services/orders/create.ts` | `initialState` (acceptation auto si `Shop.autoAccept`), `commissionCents` via `computeOrderCommissionFromHt(totalCents TTC, commissionPct)`, `serviceFeeCents: quote.serviceFeeCents` | D3, D11 |
| `src/lib/services/orders/announce.ts` | Alerte boucher + e-mail client **attendus** avant la réponse HTTP | À ne pas appeler avant autorisation pour `ONLINE` |
| `src/lib/services/orders/transition.ts` | Seul écrivain du statut ; `effects` dans la même transaction | Point d'entrée des transitions Stripe |
| `src/lib/services/orders/commands/accept.ts` | `acceptOrder` : QR code, heure estimée, réservation du stock limité, unités inscrites dans l'événement `ACCEPTED` | À appeler pour l'acceptation automatique après autorisation (`actorId: SYSTEM_ACTOR_ID`) |
| `src/lib/services/orders/commands/{close,progress,unavailable}.ts` | Fermetures, `READY`, ruptures (retrait de ligne ou remplacement, qui peut coûter plus cher) | Aucun effet Stripe (D2) |
| `src/lib/services/orders/kitchen.ts`, `api/boucher/orders/pending-count` | Tableau cuisine, badge | Filtrent par statut seulement (D3) |
| `src/lib/services/orders/adjust-price.ts` (`adjustOrderPrice`) | Crée l'ajustement sous verrou de ligne (statuts `ACCEPTED`/`PREPARING`), palier et plafond `maxIncreasePct` calculés sur le total courant de la commande ; une seule ligne d'ajustement par commande, remplacée par la proposition suivante | Ignore `paymentMethod` et le montant autorisé (D4, D17) |
| `src/lib/services/orders/adjustment-settlement.ts` | **Seul écrivain d'un total ajusté** : `settleAdjustmentInTx`, écriture conditionnelle sous verrou de ligne (boutique, statut dans `ADJUSTMENT_SETTLEMENT_STATUSES` : `ACCEPTED`, `PREPARING`, `READY`, total d'origine) ; `closePendingAdjustment`, appelé par les fermetures, les ruptures et le retrait | Le point unique où poser les gardes Stripe : ni `paymentMethod`, ni `paidAt`, ni montant autorisé n'y figurent (D17) |
| `src/lib/services/orders/adjustment-answers.ts` | Les trois façons de régler un ajustement en attente : `acceptAdjustment`, `rejectAdjustment` (client), `settleDueAdjustment` (échéance du palier 2, escalade du palier 3) | Points d'appel de la capture différée, après leur transaction. L'échéance n'est réglée qu'à la lecture (`GET /api/orders/[id]`, `kitchen.ts`, `list.ts`), pas par une tâche planifiée. Fichier créé pendant le relevé : retrouver ces fonctions par `grep` |
| `src/lib/price-adjustment.ts`, `src/lib/pricing/adjustment.ts`, `src/app/api/orders/[id]/adjustment/{accept,reject}/route.ts` | Configuration et `computeTier` ; recalcul pur d'une ligne (`reweighLine`, `repriceLine`) ; routes minces du client | Rien à y brancher |
| `src/app/api/cron/recalc-shop-tiers/route.ts` | Palier mensuel (1er du mois, 03:00 UTC) | Ne compte que `paidAt` ; somme TTC ; une agrégation par boutique dans une boucle |
| `tests/lib/order-writers-guard.test.ts` | Liste fermée des écrivains de `orders` (dont `adjustment-settlement.ts` pour le total ajusté) | Webhook et `checkout-session.ts` tolérés « hors périmètre » ; le webhook est le second fichier de `STATUS_WRITERS` |
| `prisma/schema.prisma` | `Shop.stripe*`, `Shop.tier`, `Order.{platformFeeCents, serviceFeeCents, stripeFeeCents, shopPayoutCents, stripeCheckoutSessionId, stripePaymentIntentId, stripeTransferId, refundedAt, refundAmountCents, refundedPlatformFeeCents, paidAt}`, `StripeEvent` | Manquent : identifiant de charge, montant et date d'autorisation, `capture_before`, taux gelé, marqueur de libération, échéance de paiement, `StripeEvent` « traité », table des litiges, `requirements` du compte |
| `src/middleware.ts` | Matcher API excluant `webhooks/` et `payments/webhook$` | Correct |
| `.github/dependabot.yml` | Ignore les mineures et majeures de `stripe` (commentaire : le littéral `apiVersion` de `src/lib/stripe.ts` casserait `tsc`) | Correct : montée de version manuelle, avec `apiVersion` et la version des endpoints |
| `src/lib/api/errors.ts` | Codes `SERVICE_DISABLED` (503) et `PAYMENT_FAILED` (402, émis par aucune route) | `PAYMENT_FAILED` est réservé à ce domaine (`api-route-conventions`) |

## 2. À conserver

- Prix relu en base, jamais reçu du client.
- Marqueur `StripeEvent` inséré **avant** le handler, supprimé si le handler lève (audit I1). À compléter par un état « traité » (D18).
- `account.updated` lit la charge utile et retrouve la boutique par `metadata.shopId` (audits C5, I7).
- `getOrCreateConnectAccount` : clé Stripe + `updateMany` conditionnel (audit C1).
- Commission sur le HT (audit I4).
- Services qui renvoient `{ ok: true } | { ok: false, code }`, convertis par `apiError` dans la route.

## 3. Défauts à corriger avant activation

### Bloquants

| N° | Défaut | Conséquence |
|---|---|---|
| D1 | `payment_intent.payment_failed` → `CANCELLED` | Le client réessaie dans la même session et réussit : `paidAt` posé sur une commande `CANCELLED` (reproduit) |
| D2 | Aucune libération du paiement dans `commands/close.ts` ni dans `expireDueOrders` (cron `auto-cancel`) | Commande payée puis refusée jamais remboursée |
| D3 | `ONLINE` annoncée et visible en cuisine avant paiement ; acceptée d'office par `initialState` si `autoAccept`, puis le webhook écrit `ACCEPTED` en direct | Boucher qui prépare une commande impayée ; double alerte ; pas d'`OrderEvent` ni de `qrCode` sur le chemin webhook (reproduit), ni de réservation du stock limité |
| D4 | `adjust-price.ts` modifie `totalCents` sans lien avec Stripe ; la session débite l'estimation | Écart entre dû et débité |
| D5 | Un seul secret de webhook | Événements d'une des deux portées rejetés |
| D6 | Clé `checkout:{orderId}`, pas de contrôle de statut | Session morte ou erreur rejouée 24 h ; commande annulée encore payable |
| D7 | `charge.refunded` reconstruit les montants par proportion et force `CANCELLED` | Montants faux si remboursement saisi au Dashboard ; transition interdite depuis `COMPLETED` (reproduit) |
| D8 | Litiges non traités | 20 € + montant débités sans alerte, délai manqué |
| D9 | Verrous serveur du paiement en ligne : `acceptOnline` n'est accepté que si `stripeChargesEnabled` (SKILL.md § 9) ; `create.ts` ne vérifie ni `acceptOnline` ni `stripeChargesEnabled` | Paiement en ligne sur une boutique non vérifiée |
| D17 | Un ajustement en attente s'applique encore quand la commande est `READY` (acceptation du client, échéance du palier 2) ; son palier est relatif au total courant, pas au montant autorisé | Total modifié après une capture faite à `READY` ; hausse « palier 2 » au-delà de l'autorisé |

### Sérieux

| N° | Défaut | Conséquence |
|---|---|---|
| D10 | Remise `PLATFORM` / `LOYALTY` déduite de la part du boucher | Boucher sous-payé |
| D11 | Deux moteurs de commission (`Shop.commissionPct` sur TTC dans `create.ts` ; paliers sur HT) | `commissionCents` change de sens entre création et session |
| D12 | Frais estimés ; `transfer.created` lit des métadonnées vides | `stripeFeeCents` faux, `stripeTransferId` toujours nul |
| D13 | Client sans `timeout` (défaut 80 s) pour une fonction de 30 s | Fonction tuée avant l'erreur Stripe |
| D14 | Événements manquants : `amount_capturable_updated`, `checkout.session.expired`, `payment_intent.canceled`, `refund.failed`, `charge.dispute.*`, `payout.failed` | Commandes abandonnées jamais fermées (coupon et récompense restent consommés), alertes absentes |
| D16 | `computeOrderFees` additionne `SERVICE_FEE_CENTS` au lieu de `Order.serviceFeeCents` ; `checkout-session.ts` réécrit ensuite `Order.serviceFeeCents` et `commissionCents` | Montant Stripe découplé du « Total à payer » confirmé (`expectedTotalCents`) ; valeurs de la commande écrasées |
| D18 | Marqueur `StripeEvent` retiré seulement dans le `catch` | Fonction tuée pendant le traitement : la nouvelle tentative de Stripe est acquittée comme doublon, l'événement est perdu (signalé aussi par `security-multitenant`) |

### Mineurs

- Commentaire faux sur `payment_method_types` (`checkout-session.ts`).
- `statement_descriptor_suffix: "KLIKANDGO"` : mettre le nom de la boutique nettoyé.
- `handlePaymentIntentSucceeded` écrit sans garde d'état.
- Notifications du webhook non attendues.
- `StripeEvent.payload` garde l'événement entier (e-mail, nom) sans purge : durée à fixer avec `conformite-france`.
- `business_type: "individual"` prérempli : beaucoup de boucheries sont des sociétés ; laisser l'onboarding hébergé poser la question.
- `mcc: "5499"` : code non vérifié pour une boucherie (sources, « Non vérifié »).
- `recalc-shop-tiers` borne le mois avec l'horloge du serveur (UTC) : passer par `src/lib/paris-time.ts` (CLAUDE.md).

## 4. Ordre de chantier conseillé

1. Décisions du fondateur (SKILL.md, au minimum n° 1 à 4 et n° 10).
2. Champs de la boutique réservés à l'administrateur (commission comprise) : garde serveur et test d'intégration, indépendants de l'activation ; état et priorité : registre privé du programme.
3. Schéma : autorisation, capture, libération, échéance de paiement, litiges, exigences Connect, `StripeEvent` traité (`prisma-expert`, `migrate deploy` en production).
4. Webhook : deux secrets, table d'événements, statut par `transitionOrder` (D1, D3, D5, D7, D8, D14, D18).
5. Autorisation puis capture reliée aux commandes et aux ajustements (D2, D4, D6, D17), avec rattrapage planifié.
6. Remboursement et litige ; verrous serveur (D9) ; commission unique (D10, D11, D16) ; frais réels (D12) ; client (D13).
7. Recette en bac à sable, puis seulement levée des verrous (validateur, `order-payload.ts`, type du devis, panier).
