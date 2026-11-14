# Webhooks et idempotence

Repères `[S..]` : voir [sources.md](sources.md). Code compilé : [patterns.md](patterns.md).

## 1. Deux portées, deux endpoints Stripe, deux secrets

Une plateforme Connect reçoit ses événements dans deux portées distinctes [S11] :

| Portée (Workbench : « Events from ») | Paramètre API | Contient pour nous |
|---|---|---|
| Votre compte | `connect: false` | Tout ce qui touche une destination charge : sessions Checkout, PaymentIntents, charges, remboursements, litiges, transferts |
| Comptes connectés | `connect: true` | `account.updated`, `account.external_account.updated`, `payout.*` des bouchers. Chaque événement porte `event.account` |

Chaque endpoint déclaré chez Stripe a son propre secret `whsec_`. La route actuelle n'en connaît qu'un (défaut D5). Deux façons correctes :

- **Une route, deux secrets** : `STRIPE_WEBHOOK_SECRET` et `STRIPE_CONNECT_WEBHOOK_SECRET`, essayés l'un après l'autre par `constructEvent` ([patterns.md](patterns.md) § 8). Un seul handler, une seule table de déduplication.
- **Deux routes** : la seconde sous `/api/webhooks/stripe-connect`, déjà exclue du middleware par le préfixe `webhooks/`. Si un autre chemin est choisi, mettre à jour le matcher de `src/middleware.ts` **et** `src/lib/__tests__/middleware-matcher.test.ts`.

Autres réglages de l'endpoint :
- **Format de charge utile « instantané » (*snapshot*)**. À la création d'une destination, Workbench demande de choisir entre « léger » (*thin*, présenté comme recommandé) et « instantané » [S14]. Notre handler lit `event.data.object` après `constructEvent` : il lui faut des événements instantanés. Un événement léger se lit par une autre méthode du SDK (`parseEventNotification`, présente dans la version installée) que notre route n'appelle pas ; une même URL ne reçoit pas les deux formats [S38].
- Version d'API de l'endpoint alignée sur celle du SDK (`2026-04-22.dahlia`), sinon la forme des objets reçus peut différer des types TypeScript [S14].
- N'abonner que les événements du tableau ci-dessous [S14].
- Pour Connect, l'URL de production reçoit aussi des événements de test : contrôler `event.livemode` [S11].
- Un bac à sable a ses propres endpoints et secrets [S11].

## 2. Événements à traiter

| Événement | Portée | Action | Garde |
|---|---|---|---|
| `checkout.session.completed` | compte | Relier session, PaymentIntent et commande. En capture immédiate seulement : si `payment_status === "paid"`, marquer payé [S13] | Commande trouvée par `metadata.orderId`, pas déjà payée |
| `checkout.session.expired` | compte | `transitionOrder` `PENDING` → `AUTO_CANCELLED` (scope `{ system: true }`, `effects: releaseClosedOrder` qui rend coupon et fidélité) [S13] | Commande ni autorisée ni payée ; ignorer si une session plus récente existe |
| `payment_intent.amount_capturable_updated` | compte | Marquer autorisée (charge, montant, `capture_before`, taux gelé), démarrer `expiresAt`, annoncer au boucher, puis si `Shop.autoAccept` appeler `acceptOrder` (`commands/accept.ts`, `actorId: SYSTEM_ACTOR_ID`) [S8] | `updateMany` conditionnel « pas encore autorisée » ; commande encore `PENDING` (sinon libérer l'autorisation) |
| `payment_intent.succeeded` | compte | Poser `paidAt`, frais réels, identifiant de transfert | `paidAt` nul |
| `payment_intent.payment_failed` | compte | Journaliser, éventuellement prévenir le client. **Aucun changement de statut** [S16] | |
| `payment_intent.canceled` | compte | Marquer l'autorisation libérée ; si la commande n'est pas terminée (autorisation expirée), alerter : « à encaisser au comptoir » ou fermeture par `transitionOrder` selon l'arbitrage | Commande non payée |
| `refund.created`, `refund.updated`, `charge.refunded` | compte | Relire charge, commission et transfert sur Stripe, écrire les montants [S17]. **Jamais de changement de statut** | Écriture par valeur absolue, jamais par incrément |
| `refund.failed` | compte | Alerte : le client n'a pas été remboursé [S17] | |
| `charge.dispute.created` | compte | Créer la fiche litige, alerter le fondateur, noter `due_by` [S10][S18] | Unicité sur l'identifiant du litige |
| `charge.dispute.closed` | compte | Enregistrer l'issue ; si `lost`, annuler le transfert [S10] | Annulation idempotente |
| `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated` | compte | Écritures de rapprochement | |
| `radar.early_fraud_warning.created` | compte | Alerte ; envisager un remboursement préventif sur petit montant [S18] | Facultatif |
| `transfer.reversed` | compte | Synchroniser le net versé au boucher | |
| `account.updated` | comptes connectés | Synchroniser `charges_enabled`, `payouts_enabled`, `requirements` ; si les encaissements sont coupés, repasser `acceptOnline` à faux [S12] | |
| `payout.failed` | comptes connectés | Alerter le boucher : son compte bancaire est désactivé jusqu'à mise à jour [S11] | |
| `payout.paid` | comptes connectés | Facultatif (affichage finances) | |

Les événements `checkout.session.async_payment_*` ne concernent que les moyens de paiement à confirmation différée [S13]. Tant que la session est limitée à `["card"]`, ne pas s'y abonner. Si un autre moyen de paiement est ajouté un jour, `checkout.session.completed` ne voudra plus dire « payé ».

`transfer.created` n'est pas nécessaire : le transfert d'une destination charge se lit sur `charge.transfer`, et ses métadonnées sont vides puisque seules celles du PaymentIntent sont copiées, vers la Charge [S20][S5].

## 3. Règles d'un handler

1. **Corps brut** : `await req.text()` puis `constructEvent`. Ne jamais passer par `req.json()` avant [S14][S31]. `runtime = "nodejs"`, `dynamic = "force-dynamic"` (déjà en place).
2. **Signature invalide : 400**, sans détail. Tolérance d'horodatage par défaut de 5 minutes ; ne jamais la mettre à 0 [S14].
3. **Déduplication par `event.id`** : insertion du marqueur `StripeEvent` avant traitement, `P2002` signifie doublon, réponse 200 (en place). **Limite à corriger (D18)** : le marqueur n'est retiré que dans le `catch`. Si la fonction est tuée pendant le traitement (délai de 30 s, arrêt de l'instance), il reste, et la nouvelle tentative de Stripe est acquittée comme doublon : l'événement est perdu. Correctif : une colonne « traité » (`handledAt`) écrite à la fin du handler ; sur `P2002`, répondre 200 seulement si l'événement est traité, et retraiter un marqueur non traité plus vieux que deux fois la durée maximale de la fonction (60 s). Les gardes d'état de la règle 4 rendent ce retraitement sûr. Le rapprochement planifié ([tests-rapprochement.md](tests-rapprochement.md) § 5) reste le filet.
4. **Écritures conditionnelles** : un marqueur ne suffit pas, deux événements différents peuvent décrire le même fait [S14]. Champs de paiement : `updateMany` avec la garde dans le `where`, test de `count`. **Statut : uniquement `transitionOrder`** (le `where` de départ y est déjà conditionnel ; `CONFLICT` = déjà traité ou état incompatible, à journaliser, réponse 200).
   ```ts
   const { count } = await prisma.order.updateMany({
     where: { id: orderId, paidAt: null, paymentMethod: "ONLINE" },
     data: { paidAt: new Date(), stripePaymentIntentId: pi.id },
   });
   if (count === 0) return; // déjà traité ou état incompatible : ne rien notifier
   ```
5. **Aucun ordre garanti** [S14]. Chaque handler doit donner le bon résultat seul. Ne pas ordonner avec `event.created`. Pour un état qui peut reculer (compte Connect), prévoir un rattrapage : `refresh-status` existe côté boucher, ajouter une vérification planifiée. L'audit C5 a choisi de lire la charge utile de `account.updated` plutôt que de rappeler l'API ; ce choix reste valable si ce rattrapage existe.
6. **Effets de bord après l'écriture gagnante** : notification, e-mail, son cuisine ne partent que si `count === 1` (ou `outcome.ok`).
7. **Répondre vite, mais finir ce qu'on a lancé** : fonction limitée à 30 s (`vercel.json`), Stripe attend un 2xx avant tout traitement long [S14]. Sur Vercel, une promesse non attendue peut être gelée après la réponse : attendre les envois comme `services/orders/announce.ts` (`Promise.allSettled`, échec journalisé, jamais remonté). Le handler actuel lance `sendNotification(...).catch(...)` sans `await` : à corriger.
8. **Erreur de traitement : 500** après suppression du marqueur, pour que Stripe réessaie (jusqu'à 3 jours en production, trois fois en quelques heures en test) [S14]. Une erreur fonctionnelle définitive (commande inconnue) se journalise et renvoie 200, sinon Stripe réessaiera pour rien.
9. **Jamais d'appel d'authentification** (Clerk) dans ces routes, ni d'import de `server-auth`, `boucher-auth`, `admin-auth` (test de matcher).
10. **Journalisation** : `logger` avec `event.id`, `event.type`, identifiant de commande. Pas de charge utile complète dans les logs.
11. **Écrivain de la table `orders`** : toute nouvelle route ou service qui appelle `order.update(Many)` s'ajoute à `ORDER_WRITERS` de `tests/lib/order-writers-guard.test.ts` avec sa raison ; une fois le statut passé par `transitionOrder`, retirer le webhook de `STATUS_WRITERS`.

Purge : `StripeEvent.payload` contient des données personnelles. Prévoir une purge planifiée au-delà de la fenêtre utile (Stripe permet de renvoyer un événement jusqu'à 30 jours par la CLI [S14]), durée à fixer avec `conformite-france`.

## 4. Idempotence des appels sortants

Fonctionnement côté Stripe (API v1) [S15][S22] :
- La première réponse d'une clé est mémorisée dès que l'exécution commence, **y compris un 400 ou un 500**. La rejouer renvoie la même réponse.
- Même clé avec d'autres paramètres : erreur.
- Deux requêtes simultanées avec la même clé : 409 ; réessayer avec la même clé.
- Les clés sont conservées au moins 24 h, 255 caractères au plus, sans donnée personnelle.
- Un 500 a un résultat indéterminé : ne pas changer de clé tant que l'issue n'est pas connue.
- Une erreur survenue avant le début de l'exécution (paramètre invalide, clé API invalide, limite d'appels) n'est pas mise en cache : corriger puis réessayer avec la même clé.

**Que faire après une erreur ou un délai dépassé** (capture, annulation, remboursement) :
1. Relire l'objet chez Stripe (`paymentIntents.retrieve`, [patterns.md](patterns.md) § 9).
2. L'effet a eu lieu (PaymentIntent `succeeded`, `canceled`, remboursement présent) : l'enregistrer en base, ne rien rappeler.
3. L'effet n'a pas eu lieu et la clé rejoue une erreur mise en cache : même intention, clé suffixée par un numéro de tentative (`capture:{orderId}:{montant}:2`). Jamais de clé aléatoire, jamais de nouvelle clé sans l'étape 1.

Le SDK réessaie seul les erreurs réseau, avec attente exponentielle, et ajoute une clé si besoin [S31] ; une clé métier explicite protège en plus contre le double clic et le rejeu de nos propres routes. Principe général, posé par l'équipe API de Stripe : un identifiant unique par opération, renvoyé à l'identique à chaque nouvel essai, pour que les effets de bord ne se produisent qu'une fois [S32].

Construire une clé :
- à partir de l'identité métier de l'opération, pas d'un aléa tiré à chaque requête ;
- avec un discriminant quand une seconde opération légitime doit rester possible (montant, numéro de tentative, rang du remboursement) ;
- stable entre deux essais de la même intention.

| Appel | Clé | Remarque |
|---|---|---|
| `checkout.sessions.create` | `checkout:{orderId}:{montantAutorisé}:{tentative}` | Avant de créer : relire la session enregistrée ; si `status === "open"`, renvoyer son `url`. `tentative` s'incrémente quand la session précédente est expirée |
| `paymentIntents.capture` | `capture:{orderId}:{montantCapturé}` | Une seule capture possible par paiement [S8] ; le montant dans la clé évite l'erreur « mêmes clé, autres paramètres » si le total change après un échec |
| `paymentIntents.cancel` | `cancel-pi:{orderId}` | |
| `refunds.create` | `refund:{orderId}:{rang}` | `rang` = nombre de remboursements déjà enregistrés + 1 |
| `applicationFees.createRefund` | `fee-refund:{orderId}:{rang}` | Si la commission est rendue séparément |
| `transfers.createReversal` | `dispute-reversal:{disputeId}` | |
| `transfers.create` (complément remise) | `topup:{orderId}` | |
| `accounts.create` | `shop:create-account:{shopId}` | En place |
| `accountLinks.create`, `accounts.createLoginLink` | aucune | Liens à usage unique, à régénérer à chaque clic [S12] |

Côté Klik&Go, la création de commande a déjà sa clé (`Order.idempotencyKey`, unique). Toute nouvelle route qui déclenche de l'argent (remboursement manuel par un administrateur) doit accepter une clé fournie par l'appelant ou en dériver une de l'état.

## 5. Client Stripe

```ts
new Stripe(key, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
  timeout: 10_000,        // défaut SDK 80 s, fonction Vercel 30 s
  maxNetworkRetries: 1,   // défaut SDK
  appInfo: { name: "klikgo", version: "1.0.0" },
});
```

Le SDK réessaie les erreurs de connexion, **délais dépassés compris**, les 409 et les 5xx (`node_modules/stripe/cjs/RequestSender.js`). Un appel peut donc durer `timeout × (maxNetworkRetries + 1)` plus l'attente : 20,5 s avec ces valeurs. Avec 20 s et deux nouveaux essais, il dépasserait 60 s et la fonction serait tuée avant de voir l'erreur. Règle : garder ce produit sous la durée maximale de la fonction (30 s, `vercel.json`).

Monter de version : changer ensemble la dépendance, `apiVersion` et la version de l'endpoint webhook, relire le CHANGELOG du SDK (`node_modules/stripe/CHANGELOG.md`), rejouer la recette. Le type de `apiVersion` est le littéral de la version du SDK (`node_modules/stripe/cjs/apiVersion.js`). C'est pourquoi `.github/dependabot.yml` ignore déjà les mises à jour mineures et majeures de `stripe` : la montée de version est manuelle.

## 6. Développement local

```bash
stripe listen --all-snapshot --forward-to localhost:3000/api/payments/webhook
stripe trigger payment_intent.succeeded
stripe trigger --stripe-account acct_xxx <événement>
stripe events resend evt_xxx --webhook-endpoint=we_xxx
```

- `--forward-to` exige de choisir les événements : `--all-snapshot` (notre format), `--events …` ou `--all-thin` ; sans cela la commande s'arrête sur une erreur. Les événements des comptes connectés partent vers la même URL, sauf `--forward-connect-to` [S38]. La page S14 montre encore l'ancienne forme sans ce drapeau : si la CLI installée ne le connaît pas, la mettre à jour.
- `stripe trigger --stripe-account` simule un événement de la portée « Comptes connectés » [S11].
- Les événements simulés par `stripe trigger` n'ont pas nos `metadata` : ils servent à vérifier la signature et le routage. Le comportement métier se teste en jouant le vrai parcours en bac à sable.
- `stripe listen` affiche un secret `whsec_`, à placer dans l'environnement local ; il ne change pas d'un lancement à l'autre [S38] et n'est celui d'aucun endpoint du Dashboard.
- Vérifier la déduplication en renvoyant deux fois le même événement (`stripe events resend`, possible jusqu'à 30 jours [S14]).

Outil : Stripe CLI, dépôt officiel `stripe/stripe-cli` [S35].
