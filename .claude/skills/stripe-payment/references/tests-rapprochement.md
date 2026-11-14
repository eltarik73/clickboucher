# Tests, rapprochement, mise en service

Repères `[S..]` : voir [sources.md](sources.md). Stratégie générale de test : skill `testing-strategy`.

## 1. Trois niveaux de test

| Niveau | Outil | Où | Ce qu'on y prouve |
|---|---|---|---|
| Fonctions pures | Vitest | `src/lib/__tests__/` ou `tests/lib/` | Frais (`computeOrderFees`), montant autorisé, choix capture manuelle ou immédiate selon `pickupSlotStart`, suffixe de relevé, clé d'idempotence |
| Services et webhook | Projet Vitest `integration` (`npm run test:integration`), PostgreSQL réel, schéma `itest` ; `// @vitest-environment node`, `useCleanDatabase()`, factories de `tests/integration/helpers/factories.ts` | `tests/integration/stripe/` | Gardes d'état, idempotence, transitions, réaction à chaque événement. **Prisma jamais mocké** (CLAUDE.md). Signature réelle (`generateTestHeaderString`) ; transports sortants (`@/lib/email`, `@/lib/push`, `@/lib/whatsapp`) mockés ; appels Stripe sortants : voir Points à arbitrer n° 9 |
| Parcours réel | Bac à sable Stripe + CLI | manuel, puis Playwright sur environnement de test | 3DS, refus, capture, remboursement, litige, onboarding |

Règles :
- Aucun test automatisé n'appelle l'API Stripe réelle en CI. Les clés de test ne vont pas dans le dépôt.
- `playwright.config.ts` vise par défaut `https://klikandgo.app`. Un scénario de paiement ne se lance **jamais** contre la production : exiger `PLAYWRIGHT_BASE_URL` vers un environnement de test et y vérifier une clé `sk_test_`.
- Le mode test de l'application (jeton de session signé `klikgo-test-session`, impossible en production Vercel depuis `2364ef9`) n'a aucun lien avec le mode test de Stripe (clés `sk_test_`) : ne pas les confondre dans les noms de variables ni dans les gardes.
- Unitaires (`npm run test`) : jamais de base ni de réseau ; tout ce qui touche Prisma va en intégration.

## 2. Cas obligatoires du webhook

Montage prêt à l'emploi, exécuté le 2026-11-14 : [patterns.md](patterns.md) § 11. Les cas 1 et 3 y passent ; le cas 5 y est rouge tant que D1 n'est pas corrigé.

1. Signature invalide : 400, aucune écriture.
2. En-tête `stripe-signature` absent : 400.
3. Doublon (même `event.id` envoyé deux fois) : 200 `duplicate: true`, une seule ligne `StripeEvent`.
4. Handler qui lève : 500 et marqueur supprimé.
5. `payment_intent.payment_failed` : statut de commande inchangé (non-régression D1).
6. `payment_failed` puis autorisation réussie : commande autorisée, jamais `CANCELLED`.
7. `payment_intent.succeeded` reçu avant `amount_capturable_updated` : état final correct.
8. Même fait annoncé par deux événements (`checkout.session.completed` et `payment_intent.succeeded`) : une seule notification boucher.
9. `checkout.session.expired` sur commande autorisée entre-temps : aucun effet.
10. `charge.refunded` partiel puis total : montants égaux à ceux de Stripe, statut conforme à la machine à états.
11. `charge.dispute.created` deux fois : une seule fiche.
12. `account.updated` avec `charges_enabled: false` : `acceptOnline` repasse à faux.
13. Événement signé avec le second secret (portée Connect) : accepté.

## 3. Cas obligatoires des services

- Création de session : commande d'un autre client (403), commande `ON_PICKUP`, commande déjà autorisée, commande annulée, boutique sans compte actif, session ouverte réutilisée, montant modifié (nouvelle clé).
- Capture : montant supérieur à l'autorisé (aucun appel Stripe), ajustement en attente (refus), double appel (une seule capture), commission recalculée sur le montant final avec le taux gelé.
- Libération : autorisation annulée si non capturée, remboursement si capturée, rien si aucun paiement, erreur Stripe remontée sans changer le statut.
- Remboursement : montant supérieur au reste remboursable refusé ; boucher d'une autre boutique refusé (404, comme les commandes de `commands/`).
- Garde statique : `tests/lib/order-writers-guard.test.ts` mis à jour pour chaque nouvel écrivain de `orders`.

## 4. Recette en bac à sable

Cartes de test (date future, cryptogramme quelconque) [S26] :

| Carte | Scénario |
|---|---|
| `4000002500000003` | Visa française, paiement simple |
| `4000002500001001` | Cartes Bancaires / Visa |
| `4000002760003184` | 3D Secure exigé à chaque paiement |
| `4000002500003155` | Authentification exigée pour tout paiement en session (donc toujours dans Checkout) ; hors session, seulement si la carte n'a pas été configurée pour un usage futur |
| `4000000000000002` | Refus générique |
| `4000000000009995` | Refus pour fonds insuffisants |
| `4000000000002685` | Paiement accepté puis litige « produit non reçu » |
| `4000000000001976` | Paiement accepté puis demande d'information |
| `4000000000005423` | Alerte de fraude précoce |
| `4000000000007726` | Remboursement d'abord `pending` puis réussi |
| `4000000000005126` | Remboursement réussi puis `failed` |

Onboarding Connect en test [S26] : code SMS `000-000`, date de naissance `1901-01-01` (correspondance réussie), adresse `address_full_match`, identifiant `000000000`. Un bac à sable peut laisser passer des paiements alors qu'une capacité n'est pas active : ne pas conclure du test que la garde `stripeChargesEnabled` est inutile [S26].

Parcours à jouer avec `stripe listen --all-snapshot --forward-to …` actif ([webhooks-idempotence.md](webhooks-idempotence.md) § 6) :
1. Onboarding d'un boucher jusqu'à `charges_enabled`, puis lien d'onboarding expiré (`refresh_url`).
2. Commande en ligne, 3DS, autorisation, acceptation, baisse de poids, `READY`, capture inférieure à l'autorisation. Vérifier dans le Dashboard : montant capturé, commission, transfert, libellé de relevé.
3. Refus de carte puis seconde carte dans la même session.
4. Session abandonnée jusqu'à expiration.
5. Refus du boucher avant préparation : autorisation annulée, aucun frais.
6. Annulation après capture : remboursement total, transfert annulé, commission rendue.
7. Remboursement partiel.
8. Litige avec la carte dédiée : fiche créée, alerte, issue gagnée puis perdue (preuves de test de Stripe).
9. Désactivation du compte du boucher : paiement en ligne retiré du panier.
10. Renvoi d'un événement déjà traité (`stripe events resend`).

Noter aussi ce que la documentation ne dit pas (voir sources, « Non vérifié ») : valeur de `payment_status` en capture manuelle, séquence exacte des événements après un refus, échéance `capture_before` d'une carte CB.

## 5. Rapprochement

Principe : Stripe est la référence pour l'argent, la base Klik&Go pour les commandes. Le rapprochement cherche les écarts, il ne les corrige pas en silence.

Champs à tenir à jour sur `Order` à partir des objets Stripe (jamais par estimation) :

| Champ | Source |
|---|---|
| `paidAt` | `payment_intent.succeeded` |
| `stripeFeeCents` | `latest_charge.balance_transaction.fee` |
| `platformFeeCents` | `application_fee_amount` effectivement capturé |
| `shopPayoutCents` | montant capturé moins commission, moins annulations de transfert |
| `stripeTransferId` | `charge.transfer` |
| `refundAmountCents`, `refundedPlatformFeeCents` | `charge.amount_refunded`, `applicationFee.amount_refunded` |

Deux cadences (à écrire avec `background-jobs-notifications` : `verifyCronAuth`, `try/catch`, `logger`, traitement par lots sans requête par ligne). Les crons de `vercel.json` sont tous quotidiens aujourd'hui : le rattrapage en minutes suppose le cron à la minute prévu par ce skill.

Rattrapage, en minutes (ce qui touche l'argent d'un client ou bloque une cuisine) :
- commandes `ONLINE` non autorisées au-delà de leur échéance de paiement : les fermer ;
- commandes à statut terminal négatif avec paiement non libéré : libérer ;
- commandes `READY` ou au-delà sans `paidAt` : relire le PaymentIntent, enregistrer ou capturer ;
- ajustements de palier 2 échus mais non réglés (ils ne le sont aujourd'hui qu'à la lecture) sur commande `ONLINE` ;
- événements `StripeEvent` reçus mais non traités depuis plus d'une minute (défaut D18) : les retraiter.

Contrôle quotidien (écarts à signaler, jamais corrigés en silence) :
- commandes `ONLINE` autorisées depuis plus de 24 h sans statut d'avancement ;
- autorisations dont `capture_before` approche ;
- boutiques `acceptOnline` dont le compte Stripe n'encaisse plus ;
- somme des `platformFeeCents` du jour comparée aux « Application Fees » de Stripe [S5].

Côté boucher, le détail d'un virement se lit avec `balanceTransactions.list({ payout })` exécuté au nom du compte connecté (`{ stripeAccount }`), ou dans son tableau de bord Express. Côté plateforme, le rapport « Payout reconciliation » fournit l'export détaillé par transaction, métadonnées comprises [S36].

Pages finances existantes (`api/boucher/finances`, `api/webmaster/finances`) : elles agrègent `platformFeeCents`, `stripeFeeCents`, `shopPayoutCents` filtrés sur `paidAt`. Elles deviennent justes dès que ces champs viennent de Stripe ; les commandes payées sur place n'y figurent pas.

## 6. Mise en service (ordre strict)

1. Arbitrages du fondateur rendus (SKILL.md) et avis juridique reçu.
2. Défauts bloquants de [etat-du-code.md](etat-du-code.md) corrigés et testés.
3. Compte Stripe : profil de plateforme Connect rempli, responsabilités de plateforme acceptées, marque Checkout réglée, libellé de relevé et préfixe définis.
4. Deux endpoints webhook créés (portée compte et portée comptes connectés), **format instantané (*snapshot*)**, version d'API `2026-04-22.dahlia`, événements limités à la table, secrets en variables d'environnement serveur.
5. Variables Vercel : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`. Aucune en `NEXT_PUBLIC_*` (la redirection vers Checkout hébergé ne demande pas de clé publique côté client).
6. Recette complète en bac à sable (§ 4).
7. Clés réelles, un boucher pilote, plafond de commandes, suivi quotidien du rapprochement.
8. Levée des verrous, en dernier et ensemble : validateur (`paymentMethodSchema` de `src/lib/validators/order.ts`, qui sert au devis et à la création), requête du navigateur (`paymentMethod: "ON_PICKUP"` en dur dans `src/lib/cart/order-payload.ts`), type du devis (`OrderQuote.paymentMethod` dans `services/orders/quote.ts`), interface (`panier/page.tsx`). `tests/integration/checkout-contract.test.ts` verrouille ce contrat : le compléter pour `ONLINE`.
9. CLAUDE.md, `audit/stripe-activation.md` et ce skill mis à jour le même jour.

Alertes à brancher avant l'étape 7 (Sentry via `logger.error`, skill `reliability-observability`) : échec de handler de webhook, `refund.failed`, `charge.dispute.created`, `payout.failed`, capture refusée, écart de rapprochement.
