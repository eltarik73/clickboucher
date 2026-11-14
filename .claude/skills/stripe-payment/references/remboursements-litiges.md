# Remboursements et litiges

Repères `[S..]` : voir [sources.md](sources.md). Code compilé : [patterns.md](patterns.md).

## 1. Annuler ou rembourser

| État du paiement | Geste | Coût |
|---|---|---|
| Session Checkout encore ouverte | `checkout.sessions.expire` | Aucun |
| Autorisé, non capturé (`requires_capture`) | `paymentIntents.cancel` | Aucun [S17] |
| Capturé (`succeeded`) | `refunds.create` | Frais Stripe du paiement d'origine non rendus [S17] |

Un PaymentIntent `requires_capture` ne se rembourse pas, il s'annule ; un PaymentIntent `succeeded` ne s'annule plus [S17]. Le service « libérer le paiement » doit lire l'état réel (`paymentIntents.retrieve`) avant de choisir.

## 2. Remboursement d'une destination charge

Comportement par défaut de Stripe, à ne jamais laisser tel quel [S5] :
- `reverse_transfer` faux : le boucher garde l'argent, la plateforme paie le remboursement ;
- `refund_application_fee` faux : la plateforme garde sa commission.

Avec `reverse_transfer: true`, Stripe reprend au boucher la totalité du transfert pour un remboursement total, ou une part proportionnelle pour un remboursement partiel. Avec `refund_application_fee: true`, la commission est rendue au boucher dans la même proportion ; on ne peut pas rendre la commission sans annuler le transfert [S5].

### Remboursement total (commande annulée après capture)

```ts
await stripe.refunds.create(
  { payment_intent: order.stripePaymentIntentId, reverse_transfer: true,
    refund_application_fee: true, reason: "requested_by_customer", metadata: { orderId: order.id } },
  { idempotencyKey: `refund:${order.id}:1` },
);
```

Le client récupère panier et frais de service ; le boucher rend ce qu'il a reçu ; Klik&Go rend sa commission et supporte les frais Stripe.

### Remboursement partiel (poids inférieur sur une commande capturée d'avance, article manquant)

Le partage proportionnel de Stripe rend aussi au boucher une fraction des 0,99 € de frais de service, qui ne sont pas liés au poids. Deux options :

- **Simple** : `refund_application_fee: true`. L'écart est de quelques centimes en faveur du boucher. Acceptable si le rapprochement lit les montants réels.
- **Exacte** : `refund_application_fee: false` avec `reverse_transfer: true`, puis `applicationFees.createRefund(feeId, { amount })` pour rendre exactement la baisse de commission, calculée par `computeOrderCommission` sur l'ancien et le nouveau total [S5].

Choisir une option, l'écrire dans le service et la tester ; ne pas mélanger.

### Après le remboursement

- Écrire en base ce que Stripe a réellement fait : `charge.amount_refunded`, `applicationFee.amount_refunded` (via `charge.application_fee`), `transfer.amount_reversed` (via `charge.transfer`). Le handler actuel recalcule par proportion (défaut D7), ce qui est faux pour un remboursement saisi dans le Dashboard sans les mêmes options.
- Le statut de la commande suit la machine à états (`src/lib/order-state-machine.ts`) et ne s'écrit que par `transitionOrder`. `READY` n'a que `PICKED_UP` pour sortie, `PICKED_UP` que `COMPLETED`, `COMPLETED` aucune : un remboursement est un fait comptable distinct du statut.
- Conséquence : en capture au passage `READY`, une commande capturée ne peut plus être fermée ; son remboursement (client absent, produit non conforme) se fait **sans** changement de statut. « Annuler et rembourser » n'existe que pour une commande capturée d'avance (retrait lointain) encore `PENDING`, `ACCEPTED` ou `PREPARING` : passer d'abord par la commande de `commands/close.ts`, puis rembourser après commit.
- Délai côté client : 5 à 10 jours ouvrés selon la banque ; un remboursement très rapide peut apparaître comme une simple disparition du débit [S17]. À dire dans la notification.
- Si le solde disponible de la plateforme est insuffisant, le remboursement reste `pending` puis échoue après 45 jours [S17]. Si l'annulation du transfert est demandée et que le solde du boucher est insuffisant, la requête renvoie une erreur au lieu de créer le remboursement [S4] (cas probable juste après le virement hebdomadaire ; à constater en bac à sable, voir [modele-connect.md](modele-connect.md) § 4). Traiter cette erreur : alerte au fondateur, pas de nouvel essai aveugle, et la commande reste marquée « paiement à rembourser ».
- `refund.failed` peut arriver après un `succeeded` apparent : l'argent revient sur le solde de la plateforme et le client n'est pas remboursé [S17][S5]. Alerte obligatoire.
- Un remboursement ne peut partir que vers le moyen de paiement d'origine, et le total remboursé ne dépasse jamais le paiement [S17].

### Qui peut rembourser

Route à créer (sous un préfixe couvert par le matcher du middleware), réservée à l'administrateur (`requireAdmin`) et, pour une annulation de sa propre commande, au boucher (`getAuthenticatedBoucher`, commande bornée par `shopId`). Entrée validée par Zod : identifiant de commande, montant optionnel inférieur ou égal au reste remboursable, motif. Le montant maximal se recalcule côté serveur. Journal d'audit (`src/lib/audit-log.ts`).

## 3. Litiges (rétrofacturations)

### Ce que fait Stripe

- À l'ouverture, Stripe débite le **solde de la plateforme** du montant contesté et des frais de litige, avec ou sans `on_behalf_of` [S10]. Frais : 20,00 € par litige reçu ; contester manuellement coûte 20,00 € de plus, rendus si le litige est gagné [S23].
- Délai de réponse : en général 7 à 21 jours selon le réseau ; la décision de la banque peut prendre 60 à 75 jours [S18]. La date limite exacte est `dispute.evidence_details.due_by`.
- Une demande d'information (`status` préfixé par `warning_`) précède parfois le litige : y répondre, ou rembourser, évite les frais [S18].
- Un paiement authentifié par 3D Secure transfère en général à la banque émettrice la responsabilité d'une contestation pour fraude [S37] ; un litige « produit non reçu » n'est pas couvert [S26].

### Conduite

| Moment | Action |
|---|---|
| `charge.dispute.created` | Créer la fiche (identifiant, commande, montant, motif, `due_by`), alerter le fondateur immédiatement, geler tout remboursement manuel de cette commande |
| Décision | Accepter (retrait non prouvé) ou contester (preuves disponibles) |
| Litige accepté | Annuler le transfert tout de suite [S10] |
| Litige contesté | Déposer les preuves avant `due_by` ; **attendre l'issue** avant de toucher au transfert [S10] |
| `charge.dispute.closed`, `won` | Ne rien reprendre au boucher |
| `charge.dispute.closed`, `lost` | `transfers.createReversal` (clé `dispute-reversal:{disputeId}`), montant borné par `transfer.amount - transfer.amount_reversed` |

Si le solde du boucher est négatif après l'annulation, Stripe ne prélève son compte bancaire que si `debit_negative_balances` est actif [S10][S3]. La documentation ne décrit l'échec d'une annulation pour solde insuffisant que pour les comptes dont Stripe porte les pertes [S10] ; pour les nôtres (pertes à la plateforme), le comportement est à constater en bac à sable. Annuler puis regagner le litige oblige à refaire un transfert depuis le solde de la plateforme, qui peut échouer s'il est insuffisant [S10].

Ne pas rembourser un paiement en cours de litige : le client serait crédité deux fois. Si un litige survient pendant qu'un remboursement est en attente, ce remboursement échoue avec `failure_reason: charge_for_pending_refund_disputed` ; Stripe recommande alors d'accepter ou de contester le litige plutôt que de rembourser [S17].

### Preuves propres au retrait en boutique

Tout ce que Klik&Go enregistre déjà et qui prouve la remise : `Order.qrScannedAt`, `Order.pickedUpAt`, code de retrait à 4 chiffres, ticket imprimé, historique des statuts (table `OrderEvent`, écrite par `transitionOrder`), notifications envoyées, échanges du chat, ajustement de prix accepté par le client (`PriceAdjustment`). Le service de litige doit pouvoir assembler ces éléments pour une commande.

### Prévenir

- Libellé de relevé reconnaissable ([modele-connect.md](modele-connect.md) § 5).
- E-mail de confirmation avec le montant réellement débité après pesée et l'adresse de la boutique.
- Remboursement rapide en cas de problème avéré : moins cher qu'un litige à 20 €.
- La règle de partage d'un litige perdu (qui supporte le montant, les 20 € et la commission selon que la faute vient du boucher, de la plateforme ou d'une fraude) doit figurer dans les conditions générales bouchers (`conformite-france`) avant d'automatiser l'annulation du transfert.

## 4. Schéma minimal d'une fiche litige

Identifiant Stripe unique, commande, boutique, montant, motif, statut, date limite, issue, identifiant de l'annulation de transfert. Toute lecture côté boucher est bornée par `shopId`.
