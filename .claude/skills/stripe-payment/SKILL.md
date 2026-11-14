---
name: stripe-payment
description: "Paiement en ligne Klik&Go avec Stripe Connect (marketplace à commission, France). À utiliser dès qu'on touche à Stripe : Checkout Session, PaymentIntent, autorisation puis capture au poids réel, commission (application_fee_amount), onboarding Connect des bouchers, webhooks signés et idempotents, remboursement, litige, clés d'idempotence, SCA/3DS, rapprochement, tests de paiement ; ou aux fichiers src/lib/stripe.ts, src/lib/services/stripe/*, src/app/api/payments/*, src/app/api/boucher/stripe/*, src/app/api/orders/[id]/checkout-session, boucher/parametres/paiement, ou au champ paymentMethod. Rappel : le paiement en ligne n'est PAS activé (paiement sur place uniquement)."
---

# Stripe Connect — Klik&Go

Relevé du 2026-11-14 sur le dépôt réel : HEAD `32c581f` + chantier 0 (prix et commandes) non commité dans l'arbre de travail. Ce chantier était encore en cours d'édition pendant le relevé (ajustements de prix réécrits le matin même) : retrouver par `grep` tout nom de fonction cité hors de `services/stripe/` avant de s'y brancher.
SDK `stripe` 22.1.0, API épinglée `2026-04-22.dahlia` (`src/lib/stripe.ts`). Affirmations externes : repères `[S..]` de [references/sources.md](references/sources.md), relues en ligne le 2026-11-14. Extraits de code compilés contre le SDK installé ; test d'intégration du webhook exécuté sur PostgreSQL.

## 1. État réel en 30 secondes

- **Rien n'est encaissé en ligne.** Verrous : `isStripeConfigured()` (faux sans `STRIPE_SECRET_KEY`) ; `paymentMethodSchema = z.literal("ON_PICKUP")` dans `src/lib/validators/order.ts` (devis et création) ; `paymentMethod: "ON_PICKUP"` écrit en dur dans `src/lib/cart/order-payload.ts` et typé littéral dans `OrderQuote` (`services/orders/quote.ts`) ; `Shop.acceptOnline` à `false` ; panier (`(client)/panier/page.tsx`) qui n'affiche que « Paiement sur place ».
- **Le socle Connect existe** : comptes Express + onboarding hébergé (`services/stripe/connect.ts`, `api/boucher/stripe/*`), Checkout Session en *destination charge* avec `application_fee_amount` (`services/stripe/checkout-session.ts`, `api/orders/[id]/checkout-session`), webhook signé dédupliqué par `StripeEvent` (`api/payments/webhook`), moteur de commission testé (`services/stripe/commission.ts`, `tests/lib/stripe-commission.test.ts`).
- **Il n'est pas activable en l'état** : défauts inventoriés dans [references/etat-du-code.md](references/etat-du-code.md). Le lire avant toute modification.
- Le chantier 0 a posé les règles que Stripe devra respecter : `Order.totalCents` = marchandises après remise, `Order.serviceFeeCents` à part (`serviceFeeCentsFor()` dans `src/lib/pricing/totals.ts` : 0 sur place, 99 en ligne), « Total à payer » = `amountDueCents`, et **un seul écrivain du statut** : `transitionOrder` (`src/lib/services/orders/transition.ts`). Le webhook Stripe est aujourd'hui l'unique exception tolérée par `tests/lib/order-writers-guard.test.ts`, parce qu'il est inactif.

## 2. Règles non négociables

De CLAUDE.md (inchangées) :
1. Prix **toujours recalculé côté serveur** depuis l'`Order` avant toute Checkout Session.
2. Signature webhook **toujours** vérifiée par `constructEvent()` sur le corps brut (`await req.text()`), `runtime = "nodejs"` [S14][S31].
3. `STRIPE_SECRET_KEY` jamais côté client ni en `NEXT_PUBLIC_*`.
4. Clé d'idempotence sur chaque écriture Stripe (session, capture, annulation, remboursement, transfert).

Ajoutées (chacune avec sa raison) :
5. **L'état du paiement vient de Stripe, jamais du navigateur.** Le webhook est obligatoire : le client peut fermer l'onglet avant le retour [S13]. `success_url` ne prouve rien et n'écrit rien ; si une page de retour doit accélérer l'affichage, elle passe par la même fonction serveur idempotente, qui relit l'objet chez Stripe.
6. **Le statut d'une commande ne s'écrit que par `transitionOrder` / `transitionOrderInTx`**, y compris depuis le webhook (dans le code actuel : portée `{ system: true }`, acteur `SYSTEM_ACTOR_ID` ; `order-lifecycle-realtime` propose un acteur `system:stripe`, à suivre s'il est adopté). Retirer alors le webhook de `STATUS_WRITERS` dans `order-writers-guard.test.ts`.
7. **Aucun appel réseau Stripe dans une transaction Prisma** ni dans le callback `effects` d'une transition (transaction de 10 s, verrous tenus pendant l'appel). Ordre : transition commitée → appel Stripe avec clé stable → résultat écrit → rattrapage planifié si échec ([references/paiement-pesee.md](references/paiement-pesee.md) § 8).
8. **Tout `refunds.create` sur une destination charge porte `reverse_transfer: true`** : sans lui le boucher garde l'argent et la plateforme paie [S5]. Seule dérogation : une reprise refusée pour solde insuffisant du boucher [S4], et c'est alors une décision tracée, jamais un oubli.
9. **Toute fermeture (`DENIED`, `CANCELLED`, `AUTO_CANCELLED`) d'une commande `ONLINE` libère le paiement** : annulation avant capture, remboursement après. Aucune commande de `services/orders/commands/close.ts` ne le fait aujourd'hui.
10. **Une commande `ONLINE` non autorisée n'existe pas pour la cuisine** : ni `announceNewOrder`, ni `kitchen.ts`, ni `pending-count`, ni acceptation automatique.
11. **Handler rejouable et indépendant de l'ordre des événements** [S14] ; écritures conditionnelles (`updateMany` + garde d'état, test de `count`).
12. **Montants en centimes entiers, lus sur Stripe après coup** (`balance_transaction.fee`, `amount_refunded`, `amount_reversed`), jamais estimés.
13. **Aucun secret, numéro de carte, IBAN ni e-mail dans les logs, les `metadata` ou les clés d'idempotence** [S15][S20][S21].
14. Les routes de webhook n'importent jamais `server-auth`, `boucher-auth`, `admin-auth` : `/api/payments/webhook` et `/api/webhooks/*` sont hors du matcher (`src/middleware.ts`, verrouillé par `src/lib/__tests__/middleware-matcher.test.ts`).
15. **Après capture, `Order.totalCents` ne change plus.** Un écart se règle par remboursement partiel ou au comptoir, pas en réécrivant le total (§ 4).

## 3. Modèle cible

| Sujet | Décision | Pourquoi |
|---|---|---|
| Compte boucher | Tableau de bord Express, KYC par Stripe, frais et pertes à la charge de la plateforme | Boucher non technicien ; configuration recommandée par Stripe pour les destination charges [S1][S6] |
| Type de charge | **Destination charge** + `application_fee_amount` | Un panier = une boutique (`CartState.shopId`). Les *separate charges and transfers* ne servent qu'au multi-vendeurs ou à un transfert supérieur au paiement [S4] |
| Commission | `computeOrderFees()` : commission % sur le HT (TVA 5,5 %) + frais de service ; le client paie `totalCents + serviceFeeCents` | Le boucher garde toute sa TVA |
| Virement boucher | Hebdomadaire (lundi, `connect.ts`) | 0,25 % + 0,10 € par virement et 2 € par compte actif par mois [S24] |
| Encaissement | **Autorisation à la commande, capture au passage `READY`** au montant pesé | § 4 |

En destination charge, frais Stripe, remboursements, litiges (montant + 20 € [S23]) et soldes négatifs sont **débités sur le solde Klik&Go** ; la plateforme se rembourse en annulant le transfert [S4][S5][S10]. Coûts, `on_behalf_of`, remises, comptoir : [references/modele-connect.md](references/modele-connect.md).

## 4. Commande dont le prix dépend de la pesée

En Europe on ne capture pas plus que le montant authentifié (SCA) ; la sur-capture est réservée à IC+ et exclut Visa pour les marchands de l'EEE [S9]. Donc **on autorise un plafond, on capture le réel**.

| Situation | Règle |
|---|---|
| Commande `ONLINE`, retrait proche | Checkout `capture_method: "manual"`, autorisé = `amountDueCents` + marge de pesée. Une capture au passage `READY` avec `amount_to_capture` **et** `application_fee_amount` recalculés [S5][S8] |
| Poids réel inférieur | Capturer moins : le reste est libéré, sans frais [S8][S17] |
| Hausse, nouveau total + frais de service ≤ montant autorisé | Capturer le montant ajusté |
| Hausse au-delà du montant autorisé | Non capturable : refuser l'ajustement, ou annuler et ré-autoriser, ou complément au comptoir (Points à arbitrer n° 3) [S9] |
| Refus, annulation, expiration avant capture | `paymentIntents.cancel` : gratuit [S17] |
| Remboursement après capture | `refunds.create` + `reverse_transfer` (+ `refund_application_fee`) ; frais Stripe non rendus [S17]. Une commande `READY` ne peut plus être annulée (`READY` → `PICKED_UP` seulement) : remboursement sans changement de statut |
| Retrait au-delà de la fenêtre d'autorisation (précommande Aïd) | Autorisation carte en ligne : 7 jours en général, 4 j 18 h pour une transaction Visa initiée par le marchand [S8] ; l'extension est réservée à IC+ [S19]. Capture immédiate, remboursement partiel si le poids baisse |
| `ON_PICKUP` | Aucun objet Stripe, aucune commission prélevée (Points à arbitrer n° 1) |

- **Le palier d'un ajustement ne dit pas s'il est capturable.** `computeTier` compare au total *courant* de toute la commande et les ajustements se succèdent. Pour une commande `ONLINE`, `adjustOrderPrice` (`services/orders/adjust-price.ts`) doit comparer le nouveau total + frais de service au **montant autorisé**.
- Une seule capture par paiement : après une capture partielle, impossible de capturer le reste [S8]. D'où la règle 15 : le seul écrivain d'un total ajusté, `settleAdjustmentInTx` (`services/orders/adjustment-settlement.ts`), doit clore sans l'appliquer l'ajustement d'une commande capturée.
- Échéance : `charge.payment_method_details.card.capture_before`, jamais une durée codée en dur [S8].
- `application_fee_amount` est plafonné au montant capturé sans erreur : vérifier `fee < capturé` avant l'appel [S5].

Détail : [references/paiement-pesee.md](references/paiement-pesee.md).

## 5. Cycle de commande et points de branchement

| Étape | Code existant | Effet Stripe à ajouter |
|---|---|---|
| Création `ONLINE` | `services/orders/create.ts` (`initialState`, `announceNewOrder`) | Forcer `PENDING` sans acceptation auto ni annonce ; pas de délai d'acceptation avant autorisation, mais une **échéance de paiement** : une commande jamais payée (même sans session créée) est fermée par le système |
| Session | `services/stripe/checkout-session.ts` | Capture manuelle, montant = `amountDueCents` + marge, réutilisation de la session `open`, clé versionnée |
| Autorisation | webhook `payment_intent.amount_capturable_updated` | Marquer autorisée, puis annonce cuisine, puis, si `Shop.autoAccept`, `acceptOrder` de `commands/accept.ts` avec `actorId: SYSTEM_ACTOR_ID` (elle réserve le stock limité et l'inscrit dans l'événement `ACCEPTED` : pas de transition nue) |
| `READY` | `commands/progress.ts` `markReady` | Capture après commit, sauf ajustement encore `PENDING` (Points à arbitrer n° 10) |
| Ajustement résolu (accepté, refusé, validé à l'échéance) | `acceptAdjustment`, `rejectAdjustment`, `settleDueAdjustment` (`services/orders/adjustment-answers.ts` au relevé) | Si la commande est `READY` et non capturée : capturer, après commit |
| Refus, annulation, expiration | `commands/close.ts` (`denyOrder`, `cancelOrderByShop`, `cancelOrderByCustomer`, `expireOrder`) | Libération du paiement après commit |
| Rupture partielle | `commands/unavailable.ts` | Le total baisse (ligne retirée) ou **monte** (remplacement plus cher) : capture finale sur le nouveau total, garde « ≤ autorisé » |
| Session abandonnée | webhook `checkout.session.expired` | `transitionOrder` → `AUTO_CANCELLED` ; `releaseClosedOrder` rend déjà coupon et récompense |
| Après capture | webhook `payment_intent.succeeded` | `paidAt`, frais réels, `stripeTransferId` (`charge.transfer`) |

`payment_intent.payment_failed` n'est **pas** terminal : le PaymentIntent revient à `requires_payment_method` et le client peut réessayer [S16]. Ne jamais annuler la commande sur cet événement.

## 6. Webhooks

- **Deux portées** [S11] : « Votre compte » (`checkout.session.*`, `payment_intent.*`, `charge.refunded`, `refund.failed`, `charge.dispute.*` : tout ce qui touche une destination charge, même avec `on_behalf_of`) et « Comptes connectés » (`account.updated`, `account.external_account.updated`, `payout.failed`, avec `event.account`). Deux endpoints chez Stripe, donc deux secrets : une seule variable `STRIPE_WEBHOOK_SECRET` ne suffit pas.
- **Format instantané (*snapshot*)** pour les deux endpoints : `constructEvent` et `event.data.object` ne lisent pas les événements légers (*thin*), que Workbench présente comme le format recommandé [S14].
- Stripe réessaie jusqu'à 3 jours en production, sans ordre garanti, avec doublons possibles [S14]. Dédupliquer par `event.id` (`StripeEvent`, déjà en place) **et** garder chaque écriture par l'état.
- **Limite du marqueur actuel** : posé avant le handler, retiré s'il lève ; si la fonction est tuée entre les deux, il reste et la nouvelle tentative est acquittée comme doublon. Distinguer « reçu » de « traité » ([references/webhooks-idempotence.md](references/webhooks-idempotence.md) § 3).
- Répondre vite (fonctions plafonnées à 30 s dans `vercel.json`) mais **attendre** les envois avant de répondre, comme `announce.ts` : une fonction serverless peut être gelée après la réponse.
- N'abonner que les événements traités [S14] ; contrôler `event.livemode` sur l'endpoint de production [S11].

Table des événements, règles du handler, idempotence sortante : [references/webhooks-idempotence.md](references/webhooks-idempotence.md).

## 7. Idempotence des appels sortants

Stripe mémorise la première réponse d'une clé dès que l'exécution commence, **erreurs 500 comprises**, au moins 24 h, et rejette la même clé avec d'autres paramètres [S15]. D'où des clés qui portent l'intention **et** le montant :

| Appel | Clé |
|---|---|
| `checkout.sessions.create` | `checkout:{orderId}:{montantAutorisé}:{tentative}` (après avoir réutilisé une session `open`) |
| `paymentIntents.capture` | `capture:{orderId}:{montantCapturé}` |
| `paymentIntents.cancel` | `cancel-pi:{orderId}` |
| `refunds.create` | `refund:{orderId}:{rang}` |
| `transfers.createReversal` | `dispute-reversal:{disputeId}` |
| `accounts.create` | `shop:create-account:{shopId}` (en place) |

- **Erreur rejouée ou issue inconnue** (500, délai dépassé) : relire l'objet chez Stripe avant tout nouvel essai. Effet produit → l'enregistrer. Aucun effet → même intention avec un suffixe de tentative, jamais une clé aléatoire [S22].
- Client : `timeout: 10_000`, `maxNetworkRetries: 1`. Le SDK réessaie aussi les délais dépassés : un appel peut durer `timeout × (essais + 1)`, à garder sous les 30 s de la fonction (défauts SDK : 80 s et 1 nouvel essai [S31]).
- Montée de version du SDK : manuelle (`.github/dependabot.yml` ignore les mineures et majeures de `stripe`) ; changer ensemble dépendance, `apiVersion` et version des endpoints.

## 8. Remboursements et litiges

- Avant capture : annuler. Après : rembourser. Lire l'état réel (`paymentIntents.retrieve`) avant de choisir [S17].
- Remboursement : `reverse_transfer: true` (règle 8) ; `refund_application_fee: true` rend au boucher la commission au prorata, frais de service compris [S5]. Écrire ensuite les montants **lus sur Stripe**. Un remboursement ne change pas le statut : `COMPLETED` n'a aucune transition sortante (`order-state-machine.ts`).
- Suivre `refund.failed` : l'argent revient sur le solde de la plateforme, le client n'est pas remboursé [S17].
- Litige : débité sur la plateforme (montant + 20 €) ; répondre avant `evidence_details.due_by` (7 à 21 jours selon le réseau) ; accepté ou perdu → annuler le transfert ; contesté → attendre l'issue [S10][S18][S23]. Preuves propres au retrait : `qrScannedAt`, `pickedUpAt`, `OrderEvent`, ticket.

Procédures : [references/remboursements-litiges.md](references/remboursements-litiges.md).

## 9. Onboarding Connect

- Account Link à usage unique, expiré en quelques minutes ou dès qu'une messagerie le prévisualise : en créer un à chaque clic ; `refresh_url` en recrée un [S12].
- `return_url` ne prouve rien : vérifier `charges_enabled` et `requirements` (fait par `POST /api/boucher/stripe/refresh-status`) [S12].
- `account.updated` doit aussi stocker `requirements.currently_due`, `current_deadline`, `disabled_reason`, et repasser `acceptOnline` à `false` si les encaissements sont coupés.
- `acceptOnline: true` doit être refusé **côté serveur** tant que `stripeChargesEnabled` est faux, preuve par un test d'intégration (état actuel : voir le registre privé du programme).
- Un compte Connect ou un lien d'onboarding ne se crée qu'en réponse à un `POST` authentifié, jamais à un `GET`, qu'un simple lien suffit à déclencher (état actuel : voir le registre privé du programme).
- Le paramètre `type: "express"` est obsolète (marqué *deprecated* dans les types du SDK installé) ; Stripe recommande Accounts v2 aux nouvelles intégrations, ou les propriétés `controller` en v1 [S1][S6]. À trancher avant le premier compte réel (Points à arbitrer n° 4).

## 10. Erreurs déjà présentes dans ce dépôt

Les n° 1 à 3 ont été reproduits par un test d'intégration le 2026-11-14.

1. `payment_intent.payment_failed` passe la commande à `CANCELLED` : un second essai réussi donne une commande payée et annulée.
2. `checkout.session.completed` écrit `status: "ACCEPTED"` directement, hors `transitionOrder`, sans `qrCode` ni `OrderEvent`, en ignorant `Shop.autoAccept`.
3. `charge.refunded` force `CANCELLED` sur un remboursement total, même depuis `COMPLETED` (transition interdite par la machine à états), et recalcule la commission par règle de trois.
4. La commande `ONLINE` est annoncée au boucher à la création (`announce.ts`) puis de nouveau au paiement.
5. Clé `checkout:{orderId}` figée : session expirée ou erreur rejouée pendant 24 h, erreur d'idempotence si le montant change ; aucun contrôle du statut de la commande avant la session.
6. `computeOrderFees()` ajoute la constante `SERVICE_FEE_CENTS` au lieu de lire `Order.serviceFeeCents` ; la session n'est pas comparée au `amountDueCents` confirmé par le client, puis `checkout-session.ts` réécrit `Order.serviceFeeCents` et `commissionCents`.
7. Commentaire faux : sans `payment_method_types`, Checkout applique les moyens de paiement du Dashboard, pas « carte seule ».
8. `transfer.created` cherche `transfer.metadata.orderId`, toujours vide : les métadonnées ne se copient que du PaymentIntent vers la Charge [S20].
9. `estimateStripeFeeCents` : 1,4 % + 0,25 € ; tarif public 1,5 % (EEE standard) à 2,8 % (EEE premium) + 0,25 € [S23]. Lire `balance_transaction.fee`.
10. Deux commissions : `create.ts` (`Shop.commissionPct`, appliqué au TTC via `computeOrderCommissionFromHt`, nommée HT) et `services/stripe/commission.ts` (paliers, sur le HT).
11. `statement_descriptor_suffix: "KLIKANDGO"` : le suffixe ne dit pas quelle boucherie a encaissé, le client ne la reconnaît pas sur son relevé [S27].
12. Notifications du webhook lancées sans `await` (`.catch` seul) : risque de perte sur Vercel.
13. `settleAdjustmentInTx` applique un ajustement tant que la commande est `ACCEPTED`, `PREPARING` ou **`READY`** (`ADJUSTMENT_SETTLEMENT_STATUSES`), sans regarder `paymentMethod` ni `paidAt` : accepté après `READY`, il changerait le total d'une commande déjà capturée. L'échéance du palier 2 n'est réglée qu'à la lecture de la commande, pas par une tâche planifiée.

## 11. Tests

- **Pur** (Vitest, `src/lib/__tests__` ou `tests/lib`) : frais, marge de pesée, choix capture manuelle ou immédiate, suffixe de relevé, clés.
- **Webhook et services : intégration sur PostgreSQL réel** (`tests/integration/**`, `useCleanDatabase()`, factories). **Ne jamais mocker `@/lib/prisma`** (CLAUDE.md). Signature produite par `stripe.webhooks.generateTestHeaderString` sans appel réseau [S31]. Modèle exécuté, avec le test rouge du défaut n° 1 : [references/patterns.md](references/patterns.md) § 11.
- Cas obligatoires : signature invalide, doublon, désordre, refus puis second essai, rejeu après erreur 500, deux portées.
- Bout en bout en bac à sable : `stripe listen --all-snapshot --forward-to …` (les événements des comptes connectés suivent la même URL) [S38] ; cartes `4000002500001001` (CB/Visa), `4000002760003184` (3DS toujours), `4000000000009995` (fonds insuffisants), `4000000000002685` (litige « non reçu »), `4000000000005126` (remboursement qui échoue) [S26].

Matrice, recette, rapprochement, mise en service : [references/tests-rapprochement.md](references/tests-rapprochement.md).

## 12. Définition de terminé

- [ ] Aucun montant reçu du navigateur ; montant Stripe égal à `amountDueCents` (+ marge éventuelle) recalculé serveur.
- [ ] Chaque écriture Stripe a sa clé (section 7) ; aucun appel Stripe dans une transaction Prisma.
- [ ] Statut écrit uniquement par `transitionOrder` ; `order-writers-guard.test.ts` à jour et vert.
- [ ] Chaque transition `ONLINE` a son effet Stripe (section 5), son rattrapage planifié et son test d'intégration.
- [ ] Handler rejouable : même événement deux fois, ou dans le désordre, laisse la base identique.
- [ ] Aucune écriture de `totalCents` après capture ; aucun ajustement accepté au-delà du montant autorisé.
- [ ] Requêtes bornées par `shopId` ou propriétaire ; entrées Zod ; `try/catch` + `logger` ; pas de `console.log`.
- [ ] Taux de commission de la boutique modifiable par l'administrateur seul : garde côté serveur, prouvée par un test d'intégration.
- [ ] Parcours joué en bac à sable : 3DS, refus puis succès, abandon, baisse de poids, annulation avant et après capture, remboursement partiel, litige.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run test:integration` verts ; `prisma/schema.prisma` ajouté au commit s'il change.
- [ ] Les verrous de la section 1 ne sont levés que sur décision explicite du fondateur.

## Points à arbitrer (décisions du fondateur, non tranchées ici)

1. **Commission sur le paiement au comptoir** : non prélevée aujourd'hui, alors que le modèle est « commission uniquement ». Options : paiement en ligne obligatoire, Terminal ou Tap to Pay (disponibles en France, compatibles destination charge [S28]), débit du solde Connect (consentement, 1,4 % [S24][S25]), facture mensuelle.
2. **Marge de pesée autorisée** : son taux (proposition : `tier2MaxPct`, 20 %), son assiette (toute la commande, ou les seules lignes pesées : blocage plus faible pour le client, ajustements plus vite refusés) et son affichage avant paiement (`conformite-france`).
3. **Hausse au-delà du montant autorisé sur commande en ligne** : refus, ré-autorisation ou complément au comptoir.
4. **Type de compte** : `type: "express"` (obsolète) contre `controller` en v1 ou Accounts v2 [S1][S6]. Le type de tableau de bord ne change plus après création [S6].
5. **`on_behalf_of`** : libellé du boucher sur le relevé, mais aussi sa marque sur Checkout [S5].
6. **Remises financées par Klik&Go** (`discountSource` `PLATFORM` / `LOYALTY`) : aujourd'hui supportées par le boucher ; transfert complémentaire à prévoir.
7. **TVA et facturation** de la commission et des frais de service (dont le taux unique de 5,5 % codé dans `VAT_RATE_FOOD`) : expert-comptable.
8. **Statut juridique** de l'encaissement pour compte de tiers : avis juridique avant activation [S29][S30].
9. **Tests d'un appel Stripe sortant** : le skill `testing-strategy` (règle 3) range Stripe parmi les frontières réseau simulables ; CLAUDE.md liste les mocks permis sans le nommer. Proposition : traiter `@/lib/stripe` comme un transport sortant mockable en intégration et l'inscrire dans CLAUDE.md.
10. **Ajustement de prix non résolu quand le boucher clique « Prête »** (commande en ligne) : refuser `READY`, ou l'accepter et différer la capture jusqu'à la résolution (proposition : différer, avec rattrapage).
11. **Palier de commission** : `recalc-shop-tiers` ne compte que les commandes avec `paidAt` (donc jamais le sur place : tout le monde reste Bronze) et additionne du TTC face à des seuils HT.
12. **Documents à réaligner** : CLAUDE.md (« Stripe pas encore implémenté »), `audit/stripe-activation.md` (route `/api/checkout/create-session` et `Order.paymentStatus` inexistants), commentaire de `src/lib/stripe.ts` (« Basil »).
13. **Paiement en ligne des invités** : `POST /api/orders/[id]/checkout-session` exige `getServerUserId()`, qu'un invité (`/api/checkout/guest`, `guestToken`) n'a pas. L'ouvrir par jeton invité, ou réserver le paiement en ligne aux comptes.

## Skills voisins

`order-lifecycle-realtime` (statuts, cuisine), `click-and-collect` (parcours), `api-route-conventions`, `security-multitenant`, `prisma-expert` (migrations), `background-jobs-notifications` (crons de rattrapage), `testing-strategy`, `reliability-observability` (Sentry), `conformite-france` (CGV, information du consommateur, facturation).
