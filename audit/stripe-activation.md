# Stripe — Checklist d'activation

État actuel : **fondations posées, paiement en ligne désactivé.**

Le SDK est installé, le webhook scaffold est en place avec vérification de signature,
la table d'idempotency `StripeEvent` existe, le `Shop` a les champs Stripe Connect.
Tant que `STRIPE_SECRET_KEY` n'est pas set, `isStripeConfigured()` retourne `false` et
toute l'app reste en "paiement sur place uniquement".

Cette checklist couvre les 10 étapes pour passer de "fondations" à "encaissement réel".
Compter **2-3 semaines** de travail + décision business + KYC Stripe.

---

## 1. Décider du modèle commercial

- **Stripe Standard** : chaque boucher a son compte Stripe, Klik&Go redirige vers
  son Checkout. Plus simple, mais oblige chaque boucher à créer un compte Stripe et
  à gérer sa propre comptabilité TVA. Pas de prélèvement de commission propre.
- **Stripe Connect Express** (recommandé) : Klik&Go encaisse, prélève
  `application_fee_amount`, reverse au boucher via `transfer_data.destination`.
  KYC géré par Stripe via `accountLinks`. Permet la commission propre et le
  reporting consolidé. Choix par défaut dans le code (`Shop.stripeAccountId`).

## 2. Setup environnement

- Créer un compte Stripe + activer Connect (mode Express).
- Récupérer les clés `sk_test_` et `pk_test_` (mode test).
- Variables Vercel + `.env.local` :
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...` (généré à l'étape 4)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- Vérifier que `isStripeConfigured()` retourne `true` après reload du dev server.

## 3. Schema (déjà en place)

Migration `20260426093652_add_stripe_foundations` a déjà ajouté :
- `Shop.stripeAccountId / stripeAccountStatus / stripeChargesEnabled / stripePayoutsEnabled`
- Modèle `StripeEvent` (idempotency)

À ajouter au moment de l'activation :
- `Order.stripePaymentIntentId String? @unique` (le `stripePaymentId` historique
  peut être renommé/migré).
- `Order.stripeChargeId String?`
- `Order.paymentStatus PaymentStatus` (enum à créer : `PENDING | AUTHORIZED | CAPTURED | FAILED | REFUNDED`).
- `Order.refundedAt DateTime?`, `Order.refundAmountCents Int?`.

## 4. Backend — Checkout Session

- Compléter `src/lib/services/stripe/checkout-session.ts` :
  - Recalculer `totalCents` côté serveur (déjà OK dans `orders/create.ts`).
  - `stripe.checkout.sessions.create({ mode: "payment", ... })`
  - `metadata: { orderId, shopId, userId }` (CRITIQUE — utilisé par le webhook).
  - `payment_intent_data: { application_fee_amount, transfer_data: { destination: shop.stripeAccountId }}` (Connect).
  - `idempotencyKey: \`checkout:${orderId}\`` en 2e arg.
- Créer `POST /api/checkout/create-session` qui appelle ce service et renvoie l'URL Stripe.
- **Ne PAS marquer la commande comme payée** ici — la vérité vient du webhook.

## 5. Webhook handlers

Le scaffold est déjà dans `src/app/api/payments/webhook/route.ts` (signature vérifiée,
runtime `nodejs`, raw body via `req.text()`). Il reste à :

- Implémenter l'idempotency en début de handler :
  ```ts
  const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return NextResponse.json({ received: true, duplicate: true });
  await prisma.stripeEvent.create({ data: { id: event.id, type: event.type, payload: event as any } });
  ```
- Brancher les TODOs :
  - `checkout.session.completed` → set `Order.paymentStatus = CAPTURED`, `paidAt`, `stripePaymentIntentId`.
  - `payment_intent.payment_failed` → `paymentStatus = FAILED`, notifier client.
  - `charge.refunded` → `refundedAt`, `refundAmountCents`.
  - `account.updated` → sync `Shop.stripeAccountStatus`, `stripeChargesEnabled`, `stripePayoutsEnabled`.
- Configurer l'endpoint dans Stripe Dashboard → récupérer `whsec_...` → `STRIPE_WEBHOOK_SECRET`.

## 6. Refunds

- `POST /api/admin/orders/[id]/refund` (admin only) :
  - `stripe.refunds.create({ payment_intent, amount, reason })` avec `idempotencyKey`.
  - Refund partiel possible (s'aligner sur `PriceAdjustment` existant).
  - Le webhook `charge.refunded` finalise la persistance.

## 7. UI client

- Sur `/panier` quand `paymentMethod === "ONLINE"` :
  - Appeler `/api/checkout/create-session`.
  - Rediriger vers `session.url` (Stripe Checkout hosted — sortie PCI scope).
- Pages `/checkout/success?session_id=...` (confirmation, source de vérité = webhook)
  et `/checkout/cancel` (retour panier).
- Réactiver le toggle `acceptOnline` côté UI boucher (actuellement masqué).

## 8. Onboarding boucher (Connect Express)

- Page `/boucher/dashboard/parametres/paiement` :
  - Si `stripeAccountId === null` → bouton "Connecter Stripe" qui appelle :
    ```ts
    const account = await stripe.accounts.create({ type: "express", country: "FR", email: shop.email });
    const link = await stripe.accountLinks.create({ account: account.id, refresh_url, return_url, type: "account_onboarding" });
    ```
  - Persister `Shop.stripeAccountId` immédiatement.
- Bloquer `acceptOnline=true` tant que `stripeChargesEnabled !== true`.
- Webhook `account.updated` met à jour les flags.

## 9. Tests

- `stripe listen --forward-to localhost:3000/api/payments/webhook` → récupère un
  `whsec_` de test et relaie les events.
- Cartes test Stripe :
  - `4242 4242 4242 4242` — succès.
  - `4000 0000 0000 0002` — décliné.
  - `4000 0027 6000 3184` — 3DS requis.
- Vérifier l'idempotency en rejouant un event via Stripe Dashboard.
- Tests Vitest pour le service `createCheckoutSession` (mock du SDK).

## 10. Conformité & passage en prod

- **PCI** : Klik&Go reste hors scope tant qu'on utilise Stripe Checkout hosted
  (la carte ne touche jamais nos serveurs). Confirmer dans CGU.
- **RGPD** : ajouter Stripe au registre des sous-traitants. DPA signé via Dashboard Stripe.
- **NF525** : à évaluer si caisse certifiée — probablement out of scope tant qu'on
  est click & collect pur (cf. skill `nf525-isca`).
- Bascule `sk_live_` + `pk_live_` après recette complète en mode test.
- Surveillance Sentry sur `/api/payments/webhook` (déjà branché via `logger`).
- Documenter le runbook refund/dispute pour le support.

---

## Référence rapide — fichiers existants

- `src/lib/stripe.ts` — singleton + `isStripeConfigured()`.
- `src/app/api/payments/webhook/route.ts` — webhook scaffold (signature OK, handlers TODO).
- `src/lib/services/stripe/checkout-session.ts` — service skeleton.
- `prisma/schema.prisma` — modèle `StripeEvent` + champs `Shop.stripe*`.
- `prisma/migrations/20260426093652_add_stripe_foundations/migration.sql` — DDL.

## Référence — règles non négociables (CLAUDE.md)

- Prix TOUJOURS recalculé côté serveur avant Checkout Session.
- Signature webhook TOUJOURS vérifiée avec `constructEvent()`.
- `STRIPE_SECRET_KEY` JAMAIS côté client.
- Idempotency key sur chaque PaymentIntent / Refund.
