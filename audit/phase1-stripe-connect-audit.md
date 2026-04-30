# Audit Phase 1 Stripe Connect — Klik&Go

**Auditeur** : Claude Auditor (Opus 4.7 — 1M context)
**Commit audité** : `2f97ca5` — feat(stripe): marketplace Connect backend (commission tiers + markup + webhook)
**Date** : 2026-04-29
**Périmètre** : 9 fichiers (1317 insertions, 251 suppressions)

---

## Score global : **6.5 / 10**

Verdict synthétique : **Fixes nécessaires avant prod**. Les fondations sont solides (signature webhook, idempotency, recalcul prix server-side, frais service en ligne séparée), mais 5 défauts critiques peuvent provoquer des pertes financières (overflow `Int32` sur `monthlyGmvCents`, double création de compte Stripe sur double-clic, désynchro webhook lors des retries quand `account.updated` arrive avant `onboard` persist) ou des erreurs de comptabilité (TVA non gérée, frais Stripe non re-déduits, refund partiel ne rembourse pas la commission). Le backend n'est pas catastrophique mais ce n'est pas livrable en l'état.

---

## 🔴 Critique (à fixer avant prod)

### C1. Race condition « double création de compte Stripe » sur l'onboarding
**Fichier** : `src/app/api/boucher/stripe/onboard/route.ts:55-71`
**Problème** : Le pattern `findUnique → if(!accountId) → create → update` n'est PAS protégé contre les requêtes concurrentes. Si le boucher double-clique, ouvre 2 onglets, ou que la requête est rejouée par un retry réseau, on crée DEUX comptes Express orphelins chez Stripe (et seul le second est persisté dans `Shop.stripeAccountId`). Les comptes orphelins sont facturés, requièrent une suppression manuelle, et polluent le dashboard Stripe.
**Impact** : Comptabilité Stripe sale, comptes facturés à vide, support utilisateur (boucher voit 2 demandes KYC).
**Fix proposé** :
1. Wrapper la séquence dans `prisma.$transaction()` avec `SERIALIZABLE` ou un advisory lock par `shopId`.
2. OU passer une `idempotencyKey: connect_account:${shopId}` à `stripe.accounts.create()` (Stripe accepte les idempotency keys sur `/v1/accounts`).
3. OU re-relire le shop juste avant l'update et abort si `stripeAccountId !== null` (race-detection optimiste).

```ts
// Option recommandée : idempotency Stripe-side
const account = await stripe.accounts.create(
  { ... },
  { idempotencyKey: `connect-account:${shopId}` }, // Stripe dédupe 24h
);
```

---

### C2. Webhook handlers : `payment_intent.payment_failed` ne marque PAS l'order FAILED
**Fichier** : `src/app/api/payments/webhook/route.ts:223-241`
**Problème** : La doc en tête du fichier (ligne 6) annonce « marque l'order FAILED + notifie le client », mais le code ne fait QUE logger le warning. La commande reste en `PENDING` indéfiniment. Conséquence : le boucher voit dans son Mode Cuisine une commande qui n'a JAMAIS été payée, peut la préparer pour rien, le client ne reçoit pas de notification d'échec, et la commande peut bloquer la capacité auto-cancel.
**Impact** : Perte boucher (préparation à perte), dégradation UX client, capacité fictive consommée.
**Fix proposé** :
```ts
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const orderId = pi.metadata?.orderId;
  if (!orderId) return;
  await prisma.order.update({
    where: { id: orderId, paidAt: null }, // safety : ne pas écraser un order déjà payé
    data: { status: "CANCELLED", denyReason: pi.last_payment_error?.message ?? "Paiement refusé" },
  });
  // Notifier le client (à ajouter dans notifications.ts si pas encore présent : ORDER_PAYMENT_FAILED)
  sendNotification("ORDER_PAYMENT_FAILED", { ... }).catch(...)
}
```

---

### C3. `charge.refunded` : la commission n'est PAS proportionnellement remboursée au boucher
**Fichier** : `src/app/api/payments/webhook/route.ts:243-264`
**Problème** : Le handler met à jour `refundAmountCents` et passe `status=CANCELLED` si full refund, mais ne touche PAS à `platformFeeCents` ni `shopPayoutCents`. Or :
1. Stripe ne rembourse PAS automatiquement l'`application_fee` lors d'un refund destination charge — il faut explicitement passer `refund_application_fee: true` à `stripe.refunds.create()`.
2. Le code n'appelle même pas `stripe.refunds.create()` : il réagit à un refund déjà fait. Si ce refund a été fait sans `refund_application_fee`, Klik&Go a gardé l'intégralité de la commission, alors que le boucher a rendu 100% du panier au client.
3. En cas de refund partiel, aucune logique de calcul de la part rendue par Klik&Go vs boucher.
**Impact** : Soit Klik&Go pille la commission sur des commandes annulées (illégal côté CGU/conso), soit le boucher perd de l'argent sur les refunds. Risque de litige consommateur + risque comptable.
**Fix proposé** :
1. Identifier le code qui DÉCLENCHE les refunds (probablement boucher dashboard ou admin) et y ajouter `refund_application_fee: true`.
2. Sur `charge.refunded`, recalculer proportionnellement :
```ts
const refundRatio = charge.amount_refunded / charge.amount;
const commissionToRefund = Math.round(order.platformFeeCents * refundRatio);
await prisma.order.update({
  where: { id: orderId },
  data: {
    refundAmountCents: charge.amount_refunded,
    platformFeeCents: order.platformFeeCents - commissionToRefund,
    shopPayoutCents: order.shopPayoutCents - (charge.amount_refunded - commissionToRefund),
    refundedAt: new Date(),
    status: isFullRefund ? "CANCELLED" : order.status,
  },
});
```

---

### C4. `monthlyGmvCents` typé `Int` (Int32) — overflow garanti
**Fichier** : `prisma/schema.prisma:416` + `migration.sql:20`
**Problème** : `Int` Prisma = `INTEGER` Postgres = signed 32-bit, max **2 147 483 647 cents** = 21,4 M€. Pour le tier `monthlyGmvCents` ce seuil est inatteignable mensuellement par une seule boucherie, mais :
1. Le code fait `Order.totalCents` aussi en `Int` (existait déjà). Sur des commandes B2B (`isPro=true`), un traiteur peut commander > 21k€ → overflow.
2. Si un cron mensuel agrège plusieurs mois ou cumule des stats pour le webmaster, l'overflow est trivial.
3. Standard de l'industrie : `BigInt` (8 octets) pour TOUS les compteurs monétaires cumulatifs.
**Impact** : Bug silencieux le jour où un commerçant grossit. Postgres lève une erreur `integer out of range` qui crashe le cron de recalc tier → tous les bouchers restent au tier obsolète.
**Fix proposé** :
```prisma
monthlyGmvCents BigInt @default(0) @map("monthly_gmv_cents")
```
Migration : `ALTER TABLE shops ALTER COLUMN monthly_gmv_cents TYPE BIGINT;`
Côté code : passer le type retourné par le cron en `bigint` JS et convertir en number après division/comparaisons.

---

### C5. `account.updated` — la mise à jour Shop n'est pas atomique avec la sync Stripe
**Fichier** : `src/app/api/payments/webhook/route.ts:266-304`
**Problème** :
1. `syncShopStripeStatus(account.id)` fait un `stripe.accounts.retrieve()` réseau LIVE — si Stripe est lent ou en panne, le handler timeout.
2. Le payload `account` reçu par le webhook contient DÉJÀ `charges_enabled`, `payouts_enabled`, etc. → l'appel `accounts.retrieve` est redondant et coûte un round-trip réseau.
3. Si `accounts.retrieve` répond avec un état plus VIEUX que celui du payload webhook (rare mais possible avec la cohérence éventuelle Stripe), on régresse l'état Shop.
**Impact** : Latence webhook (Stripe attend 200 < 30s, sinon retry → désync), risque de régression d'état (un boucher déjà actif repasse en pending).
**Fix proposé** :
```ts
async function handleAccountUpdated(account: Stripe.Account) {
  // Utiliser DIRECTEMENT le payload webhook — il est la source de vérité à l'instant t
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const pastDue = account.requirements?.past_due ?? [];
  const status = chargesEnabled && payoutsEnabled
    ? "active"
    : (pastDue.length > 0 || account.requirements?.disabled_reason) ? "restricted" : "pending";
  // Update DB en une seule passe — pas de syncShopStripeStatus(...)
  await prisma.shop.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeAccountStatus: status, stripeChargesEnabled: chargesEnabled, stripePayoutsEnabled: payoutsEnabled },
  });
}
```
Pour `refresh-status` (route boucher) on garde l'appel `accounts.retrieve` car c'est là qu'on en a besoin.

---

## 🟠 Important (à fixer rapidement)

### I1. Idempotency `StripeEvent` insérée APRÈS le handler — fenêtre de double-traitement
**Fichier** : `src/app/api/payments/webhook/route.ts:64-121`
**Problème** : Le pattern actuel est :
1. `findUnique` sur StripeEvent → si déjà présent, skip.
2. Run handler (peut prendre 5-10s : DB writes + Stripe API + notif).
3. `prisma.stripeEvent.create()` à la fin.

Si Stripe retry pendant l'étape 2 (timeout ou réponse 5xx), un second pod du serveur passe l'étape 1 (l'event n'est pas encore en DB), commence à processer, → DOUBLE traitement (e.g. double notif boucher, double `paidAt` overwrite).

Le commentaire ligne 130 dit « la table StripeEvent fait que le rejeu sera idempotent une fois le bug fixé » — mais c'est un raisonnement circulaire : la table est insérée APRÈS le handler donc elle ne protège PAS du retry pendant le handler.
**Impact** : Double notifs, double `sendNotification("ORDER_PENDING")` → boucher reçoit 2 SMS/push, double traitement coûteux.
**Fix proposé** : Inverser l'ordre — INSÉRER le marker StripeEvent EN PREMIER avec `INSERT ON CONFLICT DO NOTHING` (lock unique sur `id`), récupérer le résultat. Si insertion 0 lignes → déjà processé, skip. Sinon process. En cas d'échec handler, supprimer le marker (rollback) ou implémenter un état `processing | done | failed` dans la table.
```ts
const inserted = await prisma.stripeEvent.create({
  data: { id: event.id, type: event.type, payload: event as object },
}).catch((err) => {
  if (err.code === "P2002") return null; // unique violation = déjà processé
  throw err;
});
if (!inserted) return NextResponse.json({ received: true, duplicate: true });
// Ensuite seulement, run handler
```

---

### I2. `payment_intent.succeeded` — race conditions sur les fees Stripe
**Fichier** : `src/app/api/payments/webhook/route.ts:200-221`
**Problème** :
1. `estimateStripeFeeCents(pi.amount)` utilise une heuristique (1.4% + 25 cts) qui ne correspond PAS aux vrais frais Stripe : carte EU avec 3DS = 1.4%, hors EU = 2.9%, présence Apple Pay/Google Pay sont différents. Le vrai montant est dans `pi.charges.data[0].balance_transaction.fee` (à expander) ou via `balance_transactions.retrieve(charge.balance_transaction)`.
2. Le code n'utilise pas la valeur Stripe officielle alors qu'elle est disponible.
3. Lors du refund (`charge.refunded`) Stripe rembourse les frais Stripe au prorata — le code ne le reflète pas.
**Impact** : Reporting boucher faux (à 5-10 cts près par commande), dashboard finances montre des chiffres divergents de la réalité Stripe.
**Fix proposé** : Expander `charges.data.balance_transaction` lors du `paymentIntent.retrieve` (ou via `expand` dans le webhook event si Stripe le permet sur PaymentIntent), ou écouter `charge.succeeded` qui contient le `balance_transaction` directement.

---

### I3. `transfer_data.destination` — pas de validation `chargesEnabled` sur l'order au moment de la création
**Fichier** : `src/lib/services/stripe/checkout-session.ts:111-117`
**Problème** : Le check `stripeChargesEnabled` se base sur le flag DB Klik&Go. Mais ce flag peut être STALE (e.g. Stripe a désactivé un compte pour fraude entre deux webhooks `account.updated`). La création de Checkout Session échouera côté Stripe, MAIS :
- L'order persiste avec `stripeCheckoutSessionId` orphelin.
- Le client se voit afficher une page d'erreur générique.
- La race avec un mass `account.updated` (Stripe restreint 100 comptes simultanément suite à audit) peut laisser des paniers en plan.
**Impact** : UX dégradée + orders zombie.
**Fix proposé** : Au moment du checkout, **toujours** appeler `stripe.accounts.retrieve(stripeAccountId)` en parallèle des autres checks pour rafraîchir `chargesEnabled`. Coût : 1 round-trip Stripe (~200ms) acceptable.

---

### I4. TVA et commission HT — confusion des bases de calcul
**Fichier** : `src/lib/services/stripe/commission.ts:43-129`
**Problème critique CGU/légal** :
- Le code applique la commission sur `orderSubtotalCents` qui inclut la TVA collectée par le boucher (panier client TTC).
- Or, **la commission Klik&Go doit être calculée HT**, sinon Klik&Go prélève une part de la TVA boucher → erreur fiscale grave côté boucher (TVA collectée ≠ TVA déclarée).
- Le frais de service 0,99€ n'a pas non plus de gestion HT/TTC explicite — Klik&Go doit émettre une facture mensuelle de commission au boucher avec TVA 20% sur les commissions encaissées + facture de frais de service au client (lui aussi en TTC).
**Impact** : Risque fiscal lourd. Le boucher déclare moins de TVA qu'il a collectée → URSSAF/DGFiP redressement.
**Fix proposé** :
1. Stocker `vatAmountCents` séparément (déjà présent dans schema ligne 1067).
2. Calculer la commission sur `subtotal - vatAmount` :
```ts
const baseHT = order.totalCents - order.vatAmountCents;
const commission = Math.round(baseHT * effectiveRate);
```
3. Documenter dans le code la convention (HT / TTC) à chaque endroit où un montant est manipulé.
4. Le `serviceFeeCents = 99` (frais service) devrait probablement être TTC (côté client) → en HT côté Klik&Go = 82,5 cts (TVA 20%) — à clarifier avec un expert-comptable.

---

### I5. Markup 100% × tier 5% (Platine) — formule cassée
**Fichier** : `src/lib/services/stripe/commission.ts:83-114`
**Problème** : L'audit demande de vérifier l'edge case markup=100% sur Platine (5%). Avec la formule `online = boutique / (1 - rate × markup%)` :
- rate = 0.05, markup = 100% → `effectiveMarkup = 0.05 × 1.0 = 0.05`
- `online = 50€ / 0.95 = 52,63€` → arrondi DOWN au 0,10€ : `floor(5263/10)*10 = 5260` cts = **52,60€** ✓ correct.

**MAIS** sur Bronze (8%) avec markup 100% :
- `effectiveMarkup = 0.08 × 1.0 = 0.08`
- `online = 50€ / 0.92 = 54,35€` → arrondi DOWN = 54,30€
- Commission Klik&Go = 54,30 × 0.08 = 4,344€
- Boucher reçoit = 54,30 - 4,34 = 49,96€ → **manque 4 cts au boucher** par rapport à son prix boutique de 50€.

L'arrondi DOWN au 0,10€ provoque systématiquement une perte boucher, qui croît avec le markup et le rate. À 100/100 et 8% → ~10cts perdus par commande.
**Impact** : Perte récurrente boucher, non documentée dans le commentaire de la fonction (ligne 71-77 mentionne le gross-up mais pas la perte d'arrondi).
**Fix proposé** :
- Soit arrondir au `Math.ceil` au lieu de `Math.floor` (boucher gagne 1-9 cts).
- Soit documenter explicitement et compenser dans le payout (ajouter la perte d'arrondi à `shopPayoutCents`).
- Soit accepter et l'expliquer en CGU boucher.
Recommandation : **ceil** au 0,10€ pour ne pas léser le boucher, OU accepter mais documenter dans CGU + dashboard.

---

### I6. `shop.tier` cast en `ShopTier` non vérifié runtime
**Fichier** : `src/lib/services/stripe/checkout-session.ts:125`
**Problème** : `tier: order.shop.tier as ShopTier` — le cast TypeScript ne valide pas runtime. Si la valeur DB est corrompue ou si une migration future ajoute un tier non supporté, `TIER_THRESHOLDS[tier]` retourne `undefined` → `undefined.rate` → TypeError au moment du checkout. Crash silencieux.
**Impact** : Crash random checkout selon le shop.
**Fix proposé** : Valider explicitement avant utilisation :
```ts
const validTiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;
const tier = validTiers.includes(order.shop.tier as ShopTier) ? (order.shop.tier as ShopTier) : "BRONZE";
```
Ou utiliser un `safeParse` Zod sur le shop sortant de Prisma.

---

### I7. Webhook timing : `account.updated` peut arriver AVANT le persist `stripeAccountId`
**Fichier** : `src/app/api/boucher/stripe/onboard/route.ts:55-71`
**Scénario** :
1. Boucher clique → `accounts.create()` → Stripe retourne `acct_xxx`.
2. Stripe envoie `account.updated` AVANT que la response remonte (le webhook arrive dans les ms qui suivent la création).
3. Le webhook handler tente `findFirst({ where: { stripeAccountId: account.id } })` → **rien**, l'`update Shop` n'a pas encore eu lieu.
4. Le webhook log "shop not found" et passe outre.
5. La route persiste `stripeAccountId` après la response Stripe.
6. Le boucher ne reçoit JAMAIS de mise à jour de status car le webhook initial est skippé. Il faut attendre un nouveau `account.updated` (potentiellement plusieurs heures).
**Impact** : Le statut shop reste à `pending` même après KYC complet, jusqu'à un nouveau changement Stripe.
**Fix proposé** :
1. Persister `stripeAccountId` AVANT de retourner l'`account` (déjà le cas — ok ligne 65-71).
2. MAIS le webhook `account.updated` peut quand même arriver avant la query DB. Solution : dans le handler webhook `account.updated`, si `findFirst` ne trouve rien, **enregistrer l'event avec `processedAt = null` ou une retry-queue** plutôt que de skipper. Ou mieux : récupérer `metadata.shopId` (qui est SET à la création — ligne 52 connect.ts) et upsert le shop directement :
```ts
const shopId = account.metadata?.shopId; // toujours présent grâce à connect.ts:52
if (shopId) {
  await prisma.shop.update({
    where: { id: shopId },
    data: { stripeAccountId: account.id, ... },
  });
}
```

---

### I8. `req: NextRequest` non utilisé dans `dashboard-link/route.ts` — lint warning latent
**Fichier** : `src/app/api/boucher/stripe/dashboard-link/route.ts:16`
**Problème** : `export async function GET()` — pas de `req` paramètre. C'est cohérent (rien d'utile dans la requête), mais incompatible avec un futur hook de rate-limit qui pourrait nécessiter `req.headers`. Note : pas un bug critique.
**Fix** : Documenter ou ajouter `_req: NextRequest` pour cohérence avec `onboard/route.ts`.

---

## 🟡 Recommandations (optimisations)

### R1. `computeOrderCommission` — utilise `Math.round` (correct), mais perd 0,5 cts à chaque arrondi
Le code utilise `Math.round` qui est le standard correct (banker's rounding pas appliqué — trade-off acceptable). Sur 1000 commandes à 14,99€ × 8% = perte cumulée < 5 cts pour Klik&Go. **OK**.

### R2. `business_profile.product_description` trop générique
**Fichier** : `connect.ts:46`
Stripe utilise cette description pour la revue manuelle des comptes à risque. « Boucherie halal click & collect » est court. Recommandation : « Boucherie halal certifiée — vente de viande crue (bœuf, agneau, poulet) en click & collect, retrait en boutique uniquement. Aucune vente d'alcool ni produit interdit. ». Plus la description est précise, moins Stripe pose de questions au boucher pendant le KYC.

### R3. MCC `5499` (Misc & Specialty Retail Stores - Food) — appropriate
L'audit demandait de comparer avec `5411` (Grocery Stores, Supermarkets). Pour une boucherie spécialisée, `5499` est CORRECT (5411 = supermarché grand format avec mix produits). À conserver.

### R4. `payment_method_types` pas restreint — possible problème SCA
Le code laisse Stripe choisir (par défaut `["card"]`). Recommandation : explicitement passer `payment_method_types: ["card"]` pour s'éviter une activation involontaire de Klarna/Bancontact si Stripe les active par défaut sur le compte plateforme. Aussi : ajouter `automatic_payment_methods: { enabled: false }` pour éviter les payment methods fantaisie qui ne sont pas testés en marketplace destination charge.

### R5. `statement_descriptor_suffix: "KLIKANDGO"` — limite Stripe
Stripe limite à 22 caractères au TOTAL `prefix + suffix` sur les cartes US, à 13 caractères de SUFFIX max France. Le préfixe vient du compte Stripe. À tester en sandbox avec une vraie carte FR pour vérifier l'affichage releve.

### R6. Erreurs de `stripe.checkout.sessions.create` non typées
**Fichier** : `checkout-session.ts:222-229`
Le catch retourne un message générique. Stripe retourne des erreurs typées (`StripeCardError`, `StripeInvalidRequestError`, `StripeConnectionError`). Recommandation : différencier les codes pour permettre au client de retry ou contacter le support.

### R7. `priceRoundingEnabled` shop-level lu mais pas utilisé dans `checkout-session.ts`
Le shop a un flag `priceRoundingEnabled` (schema ligne 415, default true). Mais `computeOrderFees()` (qui calcule la commission) ne l'utilise pas. Il sert uniquement dans `computeOnlinePriceCents()` côté UI catalogue. **OK** — séparation correcte.

### R8. Pas de logging d'idempotency conflict explicit
Le pattern « duplicate event, skipping » à la ligne 68 logge en `info`. Un compteur dédié dans la métrique applicative aiderait à détecter une rafale de retries (signal de bug handler).

### R9. `commissionPct` legacy field encore présent
Schema ligne 409 : `commissionPct Float @default(0)` — concurrent avec le nouveau `tier` system. Source de bug si une autre route lit `commissionPct` au lieu d'`getEffectiveCommissionRate(shop)`. À deprecated explicitement (ajouter `/// @deprecated use tier+earlyAdopterUntil`).

### R10. Migration : pas de `down` rollback
Le SQL est `ADD COLUMN IF NOT EXISTS` (idempotent forward) mais aucun script de rollback. En cas de bug majeur post-déploiement, impossible de rollback sans `pg_restore`. Recommandation : créer `audit/rollback-marketplace-commission.sql` avec les `DROP COLUMN`.

### R11. `idempotencyKey: checkout:${order.id}` — bonne pratique mais durée de vie limitée
Stripe garde les idempotency keys 24h. Si un order reste en panier > 24h et qu'on retry la création de session, Stripe re-crée la session (pas de dédup). **Pas critique** mais à documenter.

### R12. Logger pas systématique sur les early returns
Dans `handleChargeRefunded`, si `orderId` est null ou order pas trouvé, pas de log. Ça rend le debug d'un refund qui n'a pas été propagé en DB difficile.

---

## 🟢 Bonnes pratiques observées

1. **Webhook signature** : `constructEvent(body, sig, secret)` avec `body = await req.text()` (raw bytes) — CORRECT (ligne 43-55 webhook). Pas de piège `req.json()`. ✓
2. **Idempotency Stripe**: `stripe.checkout.sessions.create({...}, { idempotencyKey })` sur l'orderId — évite la double-création client-side. ✓
3. **Auth** : `getAuthenticatedBoucher()` appelé sur les 3 routes `/api/boucher/stripe/*`. Pas d'`auth()` direct Clerk. ✓
4. **Prisma singleton** : `import prisma from "@/lib/prisma"` partout. ✓
5. **Logger structuré** : `logger.info/warn/error` avec contexte structuré, pas de `console.log`. ✓
6. **Recalcul prix server-side** : `createCheckoutSession` ne fait JAMAIS confiance aux prix du client — recharge l'order DB et calcule depuis ça. ✓
7. **Constantes nommées** : `TIER_THRESHOLDS`, `SERVICE_FEE_CENTS`, `EARLY_ADOPTER_DISCOUNT`, `COMMISSION_FLOOR` — pas de magic numbers (sauf le `0.014 + 25 cts` dans `estimateStripeFeeCents` qui mériterait une constante).
8. **Indexes DB** : 3 indexes ajoutés sur `orders` (paid_at, payment_intent_id, checkout_session_id) — couvre le dashboard finances et le webhook lookup. ✓
9. **Séparation des préoccupations** : `commission.ts` (pure compute) | `connect.ts` (Stripe Account API) | `checkout-session.ts` (orchestration). Architecture propre. ✓
10. **`destination charge`** vs `direct charge` — le bon choix pour un marketplace centralisé. ✓
11. **Plancher commission 5%** correctement appliqué après early adopter discount via `Math.max(COMMISSION_FLOOR, ...)`. ✓
12. **Limites tier** : `monthlyGmvCents >= TIER_THRESHOLDS.PLATINUM.min` — comparaison `>=` cohérente, pas de gap. ✓ (le shop à exactement 200000 cents = 2000€ → SILVER, ce qui est probablement l'intention).
13. **Pas de secrets `NEXT_PUBLIC_`** — `STRIPE_SECRET_KEY` reste server-only. ✓
14. **`metadata.shopId`** systématiquement set sur les comptes Connect — facilite le routing webhook. ✓
15. **Try/catch autour de `stripe.checkout.sessions.create`** + log structuré — robuste face à un Stripe down. ✓

---

## Tests recommandés avant mise en prod

### Tests unitaires (non présents — à écrire impérativement)
- [ ] `computeTier(0)` → BRONZE, `computeTier(199999)` → BRONZE, `computeTier(200000)` → SILVER, etc. (limites exactes)
- [ ] `computeOnlinePriceCents(1400, 0.08, 80, true)` → 1490 (cas du commentaire)
- [ ] `computeOnlinePriceCents(5000, 0.05, 100, true)` → 5260 (Platine 100% markup)
- [ ] `computeOnlinePriceCents(0, ...)` → 0 (edge case)
- [ ] `computeOnlinePriceCents(5000, 0.08, 0, true)` → 5000 (markup 0 = pas de gross-up)
- [ ] `getEffectiveCommissionRate({ tier: "PLATINUM", earlyAdopterUntil: future_date })` → 0.05 (plancher appliqué)
- [ ] `getEffectiveCommissionRate({ tier: "PLATINUM", earlyAdopterUntil: past_date })` → 0.05 (early adopter expiré)
- [ ] `getEffectiveCommissionRate({ tier: "BRONZE", earlyAdopterUntil: future })` → 0.06 (8% - 2 = 6%)
- [ ] `computeOrderFees({ subtotal: 1000, rate: 0.08 })` → commission=80, service=99, platformFee=179, payout=920, total=1099

### Tests d'intégration Stripe (avec mock ou sandbox)
- [ ] Webhook signature invalide → 400
- [ ] Webhook event déjà processé → 200 + `duplicate: true`
- [ ] `checkout.session.completed` met l'order en PAID + envoie notif boucher
- [ ] `payment_intent.payment_failed` met l'order en FAILED (à fixer C2)
- [ ] `charge.refunded` (full) → status CANCELLED + commission proportionnelle (à fixer C3)
- [ ] `charge.refunded` (partiel à 50%) → fees ajustés à 50%
- [ ] `account.updated` charges_enabled=true → Shop.stripeChargesEnabled=true
- [ ] `account.updated` avec metadata.shopId vide → fallback sur stripeAccountId
- [ ] Concurrent retry du même event → seul le 1er handler s'exécute (à fixer I1)

### Tests bout-en-bout marketplace
- [ ] Boucher onboarding flow complet : create account → KYC Stripe → return → status active
- [ ] Boucher double-clique « Connecter Stripe » → 1 seul compte créé (à fixer C1)
- [ ] Client paie 14,99€ panier → application_fee_amount = 1,19€ (8% × 14,99 + 0,99 = 119+99 = 218 cts) → boucher reçoit 13,80€ → écart cohérent avec breakdown
- [ ] Boucher Bronze passe à Silver après 2000€ CA mois M → tier=SILVER au mois M+1 (cron à venir)
- [ ] Refund partiel 5€ sur 14,99€ → commission proratée 0,40€ remboursée (à fixer C3)

### Tests sécurité
- [ ] Boucher A appelle `/api/boucher/stripe/onboard` → ne peut pas créer un compte pour le shop B (vérifié via `getAuthenticatedBoucher` qui retourne le shopId du boucher courant — ✓ OK)
- [ ] Webhook sans signature → 400
- [ ] Replay attack (event signé valide rejoué) → traité une seule fois (à fixer I1)
- [ ] `application_fee_amount` ne peut PAS être manipulé côté client (vérifié — recalc server-side ✓ OK)

### Tests fiscaux / comptables
- [ ] Vérifier que la commission est calculée HT (à fixer I4) — sinon redressement TVA boucher
- [ ] Audit trail : pour chaque order payée, on peut retrouver `stripeCheckoutSessionId`, `stripePaymentIntentId`, `stripeTransferId` → ✓ traçable

---

## Conclusion

**Verdict : Fixes nécessaires avant prod (estimé 1-2 jours de travail).**

Le commit `2f97ca5` pose des fondations correctes (architecture claire, séparation des préoccupations, idempotency basique, recalc server-side). Cependant, il a 5 défauts critiques qui sont bloquants pour la production :

1. **C1** : double création de compte Stripe (race condition).
2. **C2** : `payment_intent.payment_failed` ne marque pas l'order — incompatibilité avec Mode Cuisine.
3. **C3** : refunds ne propagent pas au boucher — risque litige consommateur + redressement Klik&Go.
4. **C4** : `Int32` sur `monthlyGmvCents` — overflow garanti à terme.
5. **C5** : `account.updated` re-appelle Stripe inutilement → latence + risque régression.

Ainsi que **8 importants (I1-I8)** dont notamment :
- **I4** : la commission est calculée TTC au lieu de HT — risque fiscal majeur.
- **I1** : fenêtre de double-traitement webhook entre lookup et insert StripeEvent.
- **I3** : pas de validation live `chargesEnabled` au moment du checkout.

Les **bonnes pratiques observées** (15 points) prouvent que le développeur connaît Stripe — mais les 5 critiques sont des erreurs courantes spécifiques au mode marketplace avec destination charges qui méritent un test sandbox approfondi avant le passage en prod.

**Plan d'action recommandé** :
1. Corriger les 5 critiques (½ journée).
2. Corriger I1, I3, I4 (½ journée).
3. Écrire les tests unitaires sur `commission.ts` (½ journée).
4. Tester end-to-end en sandbox Stripe avec 3 scénarios : succès, échec, refund (partiel + full).
5. Documenter en CGU boucher la perte d'arrondi DOWN (ou la corriger en CEIL).
6. Activer en prod sur 1-2 boucheries pilotes pendant 2 semaines avant le rollout généralisé.

Le code review montre une bonne maîtrise architecturale (services purs, prisma singleton, logger structuré) — il manque juste la rigueur des cas limites marketplace. Ce n'est pas un refactor majeur mais une série de fixes ciblés.

---

**Fin du rapport**.
