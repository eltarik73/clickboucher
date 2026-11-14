# Extraits de code vérifiés

Vérification du 2026-11-14, deux passages indépendants : les appels Stripe ci-dessous ont été compilés par `tsc --noEmit` (`strict`, `moduleResolution: bundler`) contre `stripe` 22.1.0 installé. Le test du § 11 a été **exécuté** (Vitest 4, vraie route `src/app/api/payments/webhook/route.ts`, helpers de `tests/integration/helpers/`, PostgreSQL 15 jetable ; la CI tourne sur PostgreSQL 16). Ce sont des modèles : les champs Prisma marqués « à créer » viennent de [paiement-pesee.md](paiement-pesee.md) § 7.

Convention : un service par action dans `src/lib/services/stripe/`, qui reçoit des identifiants, relit la base et renvoie `{ ok: true, ... } | { ok: false, code, message }`. Client toujours obtenu par `getStripeClient()`.

## 1. Client

```ts
_client = new Stripe(key, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
  timeout: 10_000,          // défaut SDK 80 s
  maxNetworkRetries: 1,     // défaut SDK ; un délai dépassé est réessayé lui aussi
  appInfo: { name: "klikgo", version: "1.0.0" },
});
```

Budget d'un appel : `timeout × (maxNetworkRetries + 1)` plus l'attente entre essais (0,5 s au départ, 5 s au plus dans le SDK installé), soit environ 20,5 s ici, sous les 30 s de `vercel.json`. Une route qui enchaîne deux appels (lecture puis annulation) peut dépasser : le rattrapage planifié et les clés d'idempotence rendent la reprise sûre. `timeout` et `maxNetworkRetries` se règlent aussi par appel, dans les options de requête.

## 2. Montant autorisé et suffixe de relevé (fonctions pures, à tester)

```ts
export function computeAuthorizedCents(input: {
  amountDueCents: number; marginBaseCents: number; marginPct: number;
}): number {
  return input.amountDueCents + Math.ceil((input.marginBaseCents * input.marginPct) / 100);
}

// 10 caractères tiennent toujours, quel que soit le préfixe de la plateforme [S27]
export function toStatementSuffix(shopName: string, max = 10): string {
  const cleaned = shopName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // échappement ASCII : ne pas coller les caractères combinants eux-mêmes
    .replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ")
    .trim().toUpperCase().slice(0, max).trim();
  return /[A-Z]/.test(cleaned) ? cleaned : "COMMANDE";
}
// "Boucherie Élysée & Fils" -> "BOUCHERIE" ; "123" -> "COMMANDE"
```

`marginBaseCents` : assiette retenue par l'arbitrage n° 2 (`Order.totalCents` ou total des lignes pesées). Suffixe plus long : `max = 22 - longueur du préfixe - 2` (pour `* `), à condition de connaître le préfixe réglé dans le Dashboard ; au-delà Stripe tronque le libellé sans erreur. Contrôler le résultat sur `charge.calculated_statement_descriptor` [S27].

## 3. Réutiliser une session avant d'en créer une

```ts
const s = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
if (s.status === "open" && s.url) return s.url;          // même montant : la rendre
// montant changé alors qu'elle est encore ouverte : stripe.checkout.sessions.expire(s.id) puis tentative + 1
```

## 4. Checkout Session : destination charge, capture manuelle

```ts
const session = await stripe.checkout.sessions.create(
  {
    mode: "payment",
    payment_method_types: ["card"],            // explicite : sinon réglages du Dashboard
    line_items: lineItems,                      // somme = montant autorisé, marge sur une ligne dédiée
    client_reference_id: order.id,
    customer_email: customerEmail,
    success_url: successUrl,                    // contient {CHECKOUT_SESSION_ID}
    cancel_url: cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,   // de 30 min à 24 h
    locale: "fr",
    metadata: { orderId: order.id, shopId: order.shopId },
    payment_intent_data: {
      capture_method: "manual",
      application_fee_amount: fees.platformFeeCents,
      transfer_data: { destination: shop.stripeAccountId },
      statement_descriptor_suffix: toStatementSuffix(shop.name),
      metadata: { orderId: order.id, shopId: order.shopId, orderNumber: order.orderNumber },
    },
    custom_text: { submit: { message: "Seul le montant réel après pesée sera débité." } },
  },
  { idempotencyKey: `checkout:${order.id}:${authorizedCents}:${attempt}` },
);
```

`Date.now()` est permis ici : code serveur hors rendu. `on_behalf_of: shop.stripeAccountId` s'ajoute dans `payment_intent_data` si l'arbitrage n° 5 le retient. Retrait lointain : retirer `capture_method` et la ligne de marge.

## 5. Capture au montant pesé

```ts
// computeOrderFees doit d'abord lire Order.serviceFeeCents (défaut D16), sinon platformFeeCents
// suppose 99 centimes de frais de service même quand la commande en porte un autre montant.
const fees = computeOrderFees({ orderSubtotalCents: order.totalCents, effectiveCommissionRate: order.frozenCommissionRate /* à créer */ });
const amount = order.totalCents + order.serviceFeeCents;
if (amount > order.authorizedAmountCents /* à créer */) return { ok: false, code: "ABOVE_AUTHORIZED", message: "…" };
if (fees.platformFeeCents >= amount) return { ok: false, code: "INVALID_AMOUNT", message: "…" };

const pi = await stripe.paymentIntents.capture(
  order.stripePaymentIntentId,
  { amount_to_capture: amount, application_fee_amount: fees.platformFeeCents },
  { idempotencyKey: `capture:${order.id}:${amount}` },
);
// pi.status === "succeeded" : passer par la même fonction d'enregistrement que le webhook
```

`paidAt` s'écrit par **une** fonction partagée avec `payment_intent.succeeded` (`updateMany` avec `paidAt: null` dans le `where`) : peu importe qui arrive le premier, l'écriture n'a lieu qu'une fois.

## 6. Brancher la capture sur `markReady` (après commit)

```ts
const outcome = await transitionOrder({ orderId, scope: { shopId }, from: ["ACCEPTED", "PREPARING"], to: "READY",
  data: { actualReady: now }, event: { type: "READY", actorId } });
if (outcome.ok && outcome.order.paymentMethod === "ONLINE") {
  const captured = await captureOrderPayment({ orderId });        // hors transaction, clé stable
  if (!captured.ok) {
    logger.error("[stripe/capture] failed", { orderId, code: captured.code });
    await prisma.order.updateMany({ where: { id: orderId, paidAt: null }, data: { captureFailedAt: now /* à créer */ } });
  }
}
```

Le cron de rattrapage reprend les commandes `ONLINE` `READY`/`PICKED_UP` sans `paidAt` : il relit d'abord le PaymentIntent (§ 7 et § 9), enregistre une capture déjà faite, sinon rappelle `captureOrderPayment`. Même schéma pour `releaseOrderPayment` après `denyOrder`, `cancelOrderByShop`, `cancelOrderByCustomer`, `expireOrder`. Le nouveau fichier qui écrit dans `orders` rejoint `ORDER_WRITERS` de `tests/lib/order-writers-guard.test.ts`.

## 7. Libérer le paiement d'une commande fermée

```ts
const pi = await stripe.paymentIntents.retrieve(piId);
switch (pi.status) {
  case "requires_capture":
  case "requires_payment_method":
  case "requires_confirmation":
  case "requires_action":
    await stripe.paymentIntents.cancel(pi.id, { cancellation_reason: "abandoned" }, { idempotencyKey: `cancel-pi:${orderId}` });
    return { ok: true, action: "canceled" };
  case "succeeded":
    await stripe.refunds.create(
      { payment_intent: pi.id, reverse_transfer: true, refund_application_fee: true, metadata: { orderId } },
      { idempotencyKey: `refund:${orderId}:1` },
    );
    return { ok: true, action: "refunded" };
  case "canceled":
    return { ok: true, action: "none" };
  case "processing":
    return { ok: false, code: "STRIPE_PROCESSING", message: "Paiement en cours de traitement" };
}
```

Le `switch` couvre tous les statuts typés par le SDK 22.1.0 (vérifié à la compilation). Erreurs : `err instanceof Stripe.errors.StripeError` donne `err.type` et `err.code`. Journaliser ces deux champs, jamais l'objet complet. Un remboursement avec `reverse_transfer` renvoie une erreur si le solde du boucher est insuffisant [S4] : alerte, pas de nouvel essai aveugle.

## 8. Vérifier une signature avec deux secrets, router sans transtypage

```ts
export function verifyStripeEvent(body: string, sig: string, secrets: string[]): Stripe.Event {
  let lastErr: unknown;
  for (const secret of secrets) {
    try { return stripe.webhooks.constructEvent(body, sig, secret); } catch (err) { lastErr = err; }
  }
  throw lastErr;
}
// secrets = [STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean)

switch (event.type) {                                   // union discriminée : data.object déjà typé
  case "payment_intent.amount_capturable_updated": return onAuthorized(event.data.object);   // Stripe.PaymentIntent
  case "checkout.session.expired":                 return onSessionExpired(event.data.object); // Stripe.Checkout.Session
  case "charge.dispute.created":                   return onDispute(event.data.object);        // Stripe.Dispute (evidence_details.due_by)
  case "refund.failed":                            return onRefundFailed(event.data.object);   // Stripe.Refund (failure_reason)
  case "account.updated":                          return onAccount(event.data.object, event.account ?? null);
  case "payout.failed":                            return onPayoutFailed(event.data.object, event.account ?? null);
}
```

Les `as Stripe.X` du handler actuel sont inutiles. Ce code suppose des événements au format instantané (*snapshot*) : voir [webhooks-idempotence.md](webhooks-idempotence.md) § 1.

## 9. Lire l'état réel : frais, transfert, échéance

```ts
const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge.balance_transaction"] });
const charge = pi.latest_charge;                                     // string | Stripe.Charge | null
if (charge && typeof charge !== "string") {
  const bt = charge.balance_transaction;
  const feeCents = bt && typeof bt !== "string" ? bt.fee : null;
  const transferId = typeof charge.transfer === "string" ? charge.transfer : charge.transfer?.id ?? null;
  const captureBefore = charge.payment_method_details?.card?.capture_before ?? null;   // secondes Unix
}
```

Sans `expand`, un champ extensible est un identifiant : toujours tester `typeof x === "string"`.

## 10. Litige perdu : reprendre le transfert ; compte par propriétés `controller`

```ts
if (dispute.status !== "lost") return;
const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
const ch = await stripe.charges.retrieve(chargeId, { expand: ["transfer"] });
const t = ch.transfer;
if (!t || typeof t === "string") return;
await stripe.transfers.createReversal(
  t.id,
  { amount: Math.min(dispute.amount, t.amount - t.amount_reversed), metadata: { disputeId: dispute.id } },
  { idempotencyKey: `dispute-reversal:${dispute.id}` },
);

// Équivalent Express sans le paramètre `type`, obsolète (après arbitrage n° 4) : passer `controller` seul
await stripe.accounts.create({
  country: "FR",
  controller: { stripe_dashboard: { type: "express" }, fees: { payer: "application" },
                losses: { payments: "application" }, requirement_collection: "stripe" },
  capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  metadata: { shopId },
}, { idempotencyKey: `shop:create-account:${shopId}` });
```

## 11. Test d'intégration du webhook (PostgreSQL réel, Prisma non mocké)

À placer dans `tests/integration/stripe/webhook.test.ts`. `STRIPE_WEBHOOK_SECRET` est lu à l'import de `@/lib/stripe` : le poser dans `vi.hoisted`, avant tout import applicatif.

```ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_never_called";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppMessage: vi.fn(async () => true), sendWhatsAppRaw: vi.fn(async () => true) }));

import Stripe from "stripe";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/payments/webhook/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestProduct, createTestShop, createTestUser } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const signer = new Stripe("sk_test_dummy_never_called", { apiVersion: "2026-04-22.dahlia" });

function signed(event: Record<string, unknown>, secret = "whsec_test_secret"): NextRequest {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret });
  return new NextRequest("http://localhost/api/payments/webhook", {
    method: "POST", body: payload, headers: { "stripe-signature": header },
  });
}

describe("POST /api/payments/webhook", () => {
  it("refuse une signature invalide sans rien écrire", async () => {
    const res = await POST(signed({ id: "evt_bad", type: "payout.paid", data: { object: {} } }, "whsec_autre"));
    expect(res.status).toBe(400);
    expect(await prisma.stripeEvent.count()).toBe(0);
  });

  it("ne traite qu'une fois le même event.id", async () => {
    const event = { id: "evt_dup", type: "payout.paid",
      data: { object: { id: "po_1", amount: 100, currency: "eur", arrival_date: 0 } } };
    expect((await POST(signed(event))).status).toBe(200);
    expect(await (await POST(signed(event))).json()).toMatchObject({ duplicate: true });
    expect(await prisma.stripeEvent.count()).toBe(1);
  });

  // ROUGE aujourd'hui (défaut D1 : le handler écrit CANCELLED). À faire passer, puis à garder.
  it("un refus de carte ne change pas le statut de la commande", async () => {
    const shop = await createTestShop();
    const user = await createTestUser();
    const product = await createTestProduct(shop.id);
    const order = await createTestOrder({ shopId: shop.id, userId: user.id, items: [{ productId: product.id }],
      overrides: { paymentMethod: "ONLINE", serviceFeeCents: 99 } });
    const failed = { id: "evt_failed", type: "payment_intent.payment_failed",
      data: { object: { id: "pi_1", metadata: { orderId: order.id }, last_payment_error: { code: "card_declined" } } } };
    expect((await POST(signed(failed))).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });
});
```

Résultat du 2026-11-14 : les deux premiers cas passent, le troisième échoue comme attendu (`expected 'CANCELLED' to be 'PENDING'`). Avec le code actuel, les mêmes montages reproduisent aussi D3 (`checkout.session.completed` → `ACCEPTED`, `qrCode` nul, aucun `OrderEvent`), D7 (`charge.refunded` total sur une commande `COMPLETED` → `CANCELLED`) et le retour 500 avec marqueur supprimé quand le handler lève.

`constructEvent` et `generateTestHeaderString` ne font aucun appel réseau ; la clé factice ne sert qu'à instancier le SDK. `createTestOrder` crée une commande `PENDING` : passer `overrides: { paymentMethod: "ONLINE" }`, puis envoyer les événements signés et relire `Order` et `OrderEvent`. Un handler qui appellera Stripe (lecture du PaymentIntent, capture) demandera de simuler `@/lib/stripe` : Points à arbitrer n° 9.
