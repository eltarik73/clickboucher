# Security Audit — Klik&Go (2026-04-30)

> Branch: `claude/modest-rhodes-258b78` | Worktree: `modest-rhodes-258b78`
> Stack: Next.js 14 App Router + Prisma + PostgreSQL + Clerk + Stripe Connect (foundations only — `isStripeConfigured()` may be false in prod).
> Scope: 193 API route files under `src/app/api/**`, middleware, lib/services, next.config.

## Executive Summary

The Klik&Go codebase demonstrates a strong security posture overall. Authentication is consistently centralized through `getServerUserId()`, `getAuthenticatedBoucher()`, and `requireAdmin()` — there are no occurrences of raw `await auth()` from `@clerk/nextjs/server` outside the three sanctioned wrappers. Multi-tenant isolation via `shopId` is enforced on the high-risk write paths (orders, products, categories), and Stripe Connect Express has been carefully designed: webhook signatures are verified, idempotency is enforced both at Stripe and DB level (StripeEvent table inserted **before** the handler runs), prices are recalculated server-side from the Order, and the TVA HT/TTC fix (audit I4) is correctly applied in `commission.ts`. CSP is reasonable for a Clerk + Stripe + Sentry stack, secrets are never bundled with `NEXT_PUBLIC_`, rate-limiting is broadly applied, and cron endpoints are protected by `verifyCronAuth`. However, there are a handful of concrete defects: (1) `/api/debug-stripe-env` is publicly reachable and leaks Stripe key prefixes; (2) `/api/users/[id]/validate-pro` allows any boucher to approve pro requests for any user (no shop scope); (3) `/api/shops/[id]/pro-requests/[proAccessId]` is missing the OR-clause for `dbUser.id` and breaks under the "ownerId may store either Clerk id or Prisma id" invariant documented in `CLAUDE.md`; (4) the homepage `/api/cart/add` is unauthenticated (acknowledged but worth tightening); (5) CSP keeps `unsafe-eval`. None of the findings are exploitable for unrestricted account takeover or fund theft, but several are exploitable for cross-tenant data manipulation by authenticated bouchers, and the debug route should be deleted today.

**Global score: 7.6 / 10** — production-grade core, three concrete bugs to fix before public launch (all S effort), and several quality-of-life hardening items.

---

## Findings Table

| ID | Severity | File:Line | Description | Recommended fix | Effort |
|----|----------|-----------|-------------|-----------------|--------|
| F-01 | HIGH | `src/app/api/debug-stripe-env/route.ts:1-24` | Public unauthenticated endpoint leaks `STRIPE_SECRET_KEY` prefix (8 chars), length, full env-key list. Anyone can confirm whether Stripe is live, which key family (`sk_test_` vs `sk_live_`), and infer cluster/staging vs prod. | Delete the file, or wrap with `requireAdmin()` and remove the prefix exposure. The original "to be deleted after debug" comment confirms intent. | S |
| F-02 | HIGH | `src/app/api/users/[id]/validate-pro/route.ts:30-67` | Any user with role `BOUCHER` (or `ADMIN`) can approve/reject a pro request on **any** user — there is no check that the target user has a `ProAccess` for the calling boucher's shop. A boucher in shop A can flip another shop's pending pro client to `CLIENT_PRO` (and bump Clerk metadata), gaining pro pricing across the marketplace. | Look up `ProAccess` filtered on `userId = params.id` AND `shopId = caller.shopId` (status PENDING) and reject if missing. The endpoint at `/api/shops/[id]/pro-requests/[proAccessId]` is the proper shop-scoped path. | S |
| F-03 | HIGH | `src/app/api/shops/[id]/pro-requests/[proAccessId]/route.ts:28-30` | Ownership check is `shop.ownerId !== clerkId` — single comparison only. Per `CLAUDE.md`, `ownerId` may store either the Clerk id OR the Prisma user id. Bouchers whose `Shop.ownerId = dbUser.id` (instead of clerkId) get a 403 on their legitimate pro request. Conversely, depending on which value is in DB, a boucher may NOT be the legitimate owner and the equality holds — small risk of cross-tenant access. | Replace with the documented OR pattern: `shop.ownerId !== clerkId && shop.ownerId !== dbUser.id`. Also add admin bypass via `isAdmin(role)`. | S |
| F-04 | HIGH | `src/app/api/cart/add/route.ts:13-58` | Endpoint accepts `{ shopId, productId, qty }` from any anonymous IP, only rate-limited by IP. It does not verify product/shop existence or ownership and only logs. Currently a no-op (no DB write), but advertising it publicly invites abuse. The persistent cart already lives on `/api/cart` which is auth-gated. | Either delete this stub or gate on `getServerUserId()` and validate `shopId` + `productId` exist with a `shopId` consistency check. | S |
| F-05 | MEDIUM | `src/app/api/checkout/guest/route.ts:34-95` | Guest checkout creates a shadow user keyed by email and uses email-based rate limiting. An attacker can iterate emails to enumerate which emails already have a real Clerk account (returns `CONFLICT` "Un compte existe déjà avec cet email"). | Replace the response code with a generic message (`"Email indisponible"`) or always succeed and silently dedupe via a queue. Add IP-based rate limiting in addition to email-keyed. | S |
| F-06 | MEDIUM | `src/app/api/test-mode/activate/route.ts:38-46` | Constant-time comparison is documented as "tiny secrets, fine for this use case", but `provided !== expected` is timing-attackable. With test mode disabled in production by default this is low risk, but `ALLOW_TEST_IN_PROD` exists. | Use `crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))` (with length check first to avoid an obvious leak). | S |
| F-07 | MEDIUM | `src/app/api/test-mode/activate/route.ts:46-48,93-95` | Test-mode cookies are `httpOnly: false` (JS-readable). If `TEST_MODE=true` ever leaks into prod, any XSS would steal the activation cookie and let the attacker pose as ADMIN. | Set `httpOnly: true` and read the activation state server-side only (the existing `isTestActivatedMiddleware` already reads `req.cookies` — it does not need JS access). | S |
| F-08 | MEDIUM | `src/app/api/boucher/stripe/onboard/route.ts:55-77` | Uses `createConnectAccount` directly (Stripe-side dedupe only, 24h) instead of `getOrCreateConnectAccount` which combines Stripe idempotency + DB race detection. Under double-click race the persisted `stripeAccountId` may not reflect the Stripe-deduped account, leading to orphan Express accounts billed by Stripe. The race-protected helper is in the same file (`connect.ts:92-157`). | Switch the call to `getOrCreateConnectAccount`. The helper already returns `{ accountId, created }`. | S |
| F-09 | MEDIUM | `next.config.mjs:81` | CSP `script-src` includes `'unsafe-eval'` and `'unsafe-inline'`. Unsafe-inline is required by Clerk and Next inline scripts; unsafe-eval is needed by some Sentry/Clerk runtimes but worth re-checking. | Remove `'unsafe-eval'` and validate Clerk/Stripe still load. Move toward strict-dynamic + nonce on inline scripts as a long-term goal. | M |
| F-10 | MEDIUM | `src/app/api/cron/route.ts:9-16` vs other cron routes | `/api/cron/route.ts` accepts only the `x-cron-secret` header, while every other cron uses `verifyCronAuth` which also accepts Vercel's `Authorization: Bearer`. Vercel-managed crons hitting this endpoint will 401. | Refactor to call `verifyCronAuth(req)` like the rest. | S |
| F-11 | MEDIUM | `src/app/api/admin/users/route.ts:14-38` | `roleFilter` is taken from query param and cast directly to `Prisma.EnumRoleFilter` without enum validation. A request with `?role=__proto__` (or any garbage) would cause Prisma to throw an `Argument role: Got invalid value` 500. Not a security boundary breach but allows unauthenticated client error noise. | `z.enum(["CLIENT","CLIENT_PRO","CLIENT_PRO_PENDING","BOUCHER","ADMIN"]).optional().parse(roleFilter)`. | S |
| F-12 | MEDIUM | `src/app/api/payments/webhook/route.ts:140-148` | When a handler throws, the StripeEvent marker is rolled back via `prisma.stripeEvent.delete(...)`. Combined with `INSERT-before-handler` (audit I1 fix) this is correct, but the rollback can race with a concurrent retry that already did the INSERT. The `delete` will then succeed and the next retry will re-process. | Use a transaction around the handler so the marker insert/rollback is atomic relative to the handler's DB writes, OR keep the marker but add a `processedAt` flag set only on success. | M |
| F-13 | MEDIUM | `src/app/api/orders/[id]/route.ts:48` | Guest path checks `order.user.guestToken !== guestTokenQuery` with simple string equality. This compares random UUIDs so timing attacks are infeasible, but the token is in the URL query string — it gets logged in Vercel access logs and CDN logs. | Move guestToken to an `Authorization: Bearer` header (already cookied as `GUEST_COOKIE_NAME`). The cookie path is preferred — only the query-string fallback is risky. | S |
| F-14 | MEDIUM | `src/app/api/admin/users/[id]/route.ts:23-71` | Admin can change a user role to anything (including `admin`) without secondary confirmation, and the action is not written to `audit_log` (other admin endpoints log via `writeAuditLog` — e.g. shop suspend/commission). | Add `writeAuditLog({ actorId: admin.userId, action: "user.role_change", target: "User", targetId: id, details: {from: previousRole, to: prismaRole} })`. | S |
| F-15 | LOW | `src/app/api/auth/check-admin/route.ts:39` | `console.error("[auth/check-admin]", error)` — same pattern in 8 routes. CLAUDE.md forbids `console.log` in production but `console.error` is in active use. They are non-sensitive (just errors), but project policy says `logger.error`. | Replace `console.error` with `logger.error` to keep formatting consistent and surface to Sentry. | S |
| F-16 | LOW | `src/app/api/orders/[id]/cancel/route.ts:32` | `order.user.clerkId !== userId` is a single comparison — but here the user is a CLIENT and `userId` from `getServerUserId()` is always a Clerk id. So this is correct for CLIENT context. The comment in CLAUDE.md about OR-clause applies primarily to Shop ownership (which can be either id). Same OK pattern in `orders/[id]/rate`, `orders/[id]/modify`, `orders/[id]/respond`. | No fix — confirmed safe. Mentioned for completeness. | — |
| F-17 | LOW | `src/app/api/uploads/product-image/route.ts:56` | `MAX_FILE_SIZE = 2 * 1024 * 1024` (2 MB). For boucher product photos this is fine, but pre-resize the buffer is held in memory via `Buffer.from(await file.arrayBuffer())` before the sharp pipeline. Under load this could pressure the function's 1024 MB memory. | Stream the file via `sharp` directly from a `ReadableStream`, or set the formidable limit lower (1 MB). | M |
| F-18 | LOW | `src/app/api/boucher/images/import/route.ts:42-69` | URL fetched server-side from `body.url` (Pexels/Unsplash). Schema validates `z.string().url()` only — it does not enforce hostname. SSRF possible: an attacker could craft a URL pointing at internal IPs, AWS metadata service, or `localhost`. Vercel functions don't expose IMDS by default but defense-in-depth is cheap. | Add a hostname allowlist similar to `boucher/images/proxy/route.ts` (`ALLOWED_HOSTS = images.pexels.com, images.unsplash.com`). Block private IPs (RFC1918) and link-local. | S |
| F-19 | LOW | `src/app/api/admin/images/generate/route.ts:53` | `await fetch(replicateUrl)` from the Replicate output URL. `replicate.delivery` is trusted, but the output is not verified — a model swap or compromise could redirect. The buffer is uploaded to public Vercel Blob without size cap (could fill quotas). | Add `MAX_BYTES` check on the buffer (e.g. 10 MB) and verify `replicateUrl.startsWith("https://replicate.delivery/")`. | S |
| F-20 | LOW | `src/middleware.ts:19-22` | The test-mode bypass in middleware checks `process.env.TEST_MODE === "true"` AND `ALLOW_TEST_IN_PROD === "true"` for prod. Cookie-based bypass is correct, but the middleware bypasses Clerk **completely** when the cookie is present. If `klikgo-test-activated=true` is set on a session that originated from a different role, the middleware lets the request through with no role check at all — including admin routes. The downstream auth helpers re-validate via `getTestRole()`, so this is mitigated, but it relies on every route doing so. | Document this requirement; consider keeping the role-cookie validation in middleware as a second line of defense. | S |
| F-21 | LOW | `src/app/api/orders/[id]/route.ts:32-40` | The order GET fetches `user.guestToken` and returns it in the JSON when the guest path is taken (line 51). For Clerk-auth path, the include also pulls `clerkId` and (via `priceAdjustment`) potentially internal-only fields. | Use `select` instead of `include: { user: true }` and explicitly remove `clerkId`/`guestToken` from the response in the Clerk-auth branch. | S |
| F-22 | LOW | `src/app/api/auth/me/route.ts:16-19` | Returns the Prisma `user.id` field to the client. While not a secret, it's the foreign-key value many other endpoints accept (e.g. ownership checks). Since auth is checked, this is fine. | None — informational. The IDs are CUIDs (random) so enumeration is infeasible. | — |
| F-23 | LOW | `src/app/api/orders/[id]/checkout-session/route.ts:58-65` | `prisma.user.findFirst({ where: { OR: [{ clerkId: userId }, { id: userId }] } })` — looking up a user by `id` from a Clerk id is a defensive measure but pollutes the query plan. Could mask account-confusion bugs. | Consider only `clerkId`-based lookup (test mode is already covered upstream). | S |
| F-24 | LOW | `src/app/api/calendar-events/route.ts:7` | Fully public GET, no rate limit. Returns 60-second cached list of calendar events. Low impact — public marketing content — but still a quota burn target. | Add a soft rate limit (e.g. `rateLimits.api`) keyed by IP. Cache headers already mitigate this in practice via Vercel CDN. | S |
| F-25 | LOW | `src/app/api/chat/route.ts:1-410` | The route wires user input into a Claude system prompt. While the prompt structure resists basic injection, an attacker can ask the assistant to leak the prompt itself, including the per-shop product DB (already done by design). More importantly: the route accepts `cart: [...]` from the client and trusts `priceCents` for display only. If the assistant ever auto-creates an order from this cart context (the `<!--ACTION:add_to_cart-->` directive is parsed client-side), the price recalc must remain server-side in `/api/orders` — which it does. | None — confirmed safe. Cart prices are only displayed to the LLM context; orders re-fetch product prices from DB. | — |
| F-26 | INFO | `next.config.mjs:78-89` | CSP allows `img-src 'self' data: blob: https: http:` — `http:` is unnecessary in 2026 for a TLS-only site. | Remove `http:` from `img-src`. | S |
| F-27 | INFO | `src/app/api/boucher/orders/[orderId]/action/route.ts:688` | `console.error` in receipt-email path. Same as F-15 — replace with `logger.error`. | S | — |

---

## Top 5 Critical Issues (Detailed)

### 1. F-02 — Cross-tenant pro-validation by any boucher

**File**: `src/app/api/users/[id]/validate-pro/route.ts:30-67`

```ts
const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
if (!isBoucher(dbUser?.role) && !isAdmin(dbUser?.role)) {
  return apiError("FORBIDDEN", "Acces reserve aux bouchers et admins");
}

const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, clerkId: true, role: true, proStatus: true },
});

// ... no check that `user` requested PRO at the calling boucher's shop ...

if (data.action === "approve") {
  await prisma.user.update({
    where: { id },
    data: { role: "CLIENT_PRO", proStatus: "APPROVED", proValidatedBy: userId, proValidatedAt: new Date() },
  });
  await clerk.users.updateUserMetadata(targetClerkId, { publicMetadata: { role: "client_pro" } });
}
```

**Reproduction**:

1. Boucher A (legitimate, owns shop A) authenticates.
2. Boucher A reads the public list of pending pro users (or guesses the user id — IDs are CUIDs so this is brute-force infeasible, but a leaked id is enough).
3. Boucher A does `POST /api/users/<userId>/validate-pro` with `{ "action": "approve" }`.
4. Server checks "is the caller a boucher? yes" → approves.
5. The user's role flips to `CLIENT_PRO` everywhere — they now get pro pricing on **every** shop, paid for by every boucher in the marketplace.

**Fix**:

```ts
const proAccess = await prisma.proAccess.findFirst({
  where: { userId: id, status: "PENDING", shop: { OR: [{ ownerId: userId }, { ownerId: dbUser.id }] } },
});
if (!proAccess && !isAdmin(dbUser?.role)) {
  return apiError("FORBIDDEN", "Aucune demande pro pour votre boutique");
}
```

The shop-scoped sibling endpoint `/api/shops/[id]/pro-requests/[proAccessId]` does the right thing — recommend deprecating the global one.

---

### 2. F-01 — Public Stripe environment debug endpoint

**File**: `src/app/api/debug-stripe-env/route.ts:9-24`

```ts
export async function GET() {
  const secret = process.env.STRIPE_SECRET_KEY;
  return NextResponse.json({
    hasStripeSecret: !!secret,
    stripeKeyPrefix: secret ? secret.substring(0, 8) : null,
    stripeKeyLength: secret?.length || 0,
    hasStripePublishable: !!pub,
    hasStripeWebhook: !!wh,
    envKeys: Object.keys(process.env).filter(k => k.includes("STRIPE")).sort(),
  });
}
```

**Reproduction**: `curl https://klikandgo.app/api/debug-stripe-env` returns the JSON for any caller.

**Why it matters**:
- Confirms whether Stripe is in test or live mode (`sk_test_` vs `sk_live_`).
- Exposes secret length (mild fingerprinting).
- Lists all env keys containing `STRIPE`, leaking custom integrations.
- The file's own header says "À supprimer après debug de production".

**Fix**: Delete the file. Also grep CI for any remaining `debug-*` routes.

---

### 3. F-03 — Owner check missing OR clause in `pro-requests/[proAccessId]`

**File**: `src/app/api/shops/[id]/pro-requests/[proAccessId]/route.ts:28-30`

```ts
if (shop.ownerId !== clerkId) {
  return apiError("FORBIDDEN", "Accès refusé");
}
```

**Reproduction**: Per `CLAUDE.md` and the helper at `boucher-auth.ts:77-79`, `Shop.ownerId` can store either the Clerk id (`user_xxx`) OR the Prisma user id (`cm...`). For shops created via `/api/shops/register/route.ts:92` it stores the `userId` (= Clerk id), but `/api/onboarding/route.ts:115` stores `user.id` (Prisma id). Bouchers in the second category get a 403 on legitimate pro request reviews.

**Cross-tenant risk**: If two records collide where shop A has `ownerId = clerkId_X` and a malicious user has `clerkId = clerkId_X`, the equality holds. Practically infeasible (Clerk IDs are unique) but the code path is not defensively coded.

**Fix**:

```ts
const dbUser = await prisma.user.findUnique({ where: { clerkId }, select: { id: true, role: true } });
if (!isAdmin(dbUser?.role) && shop.ownerId !== clerkId && shop.ownerId !== dbUser?.id) {
  return apiError("FORBIDDEN", "Accès refusé");
}
```

---

### 4. F-08 — Stripe Connect onboarding skips race-safe helper

**File**: `src/app/api/boucher/stripe/onboard/route.ts:55-77`

```ts
let accountId = shop.stripeAccountId;
if (!accountId) {
  const account = await createConnectAccount({ ... });
  accountId = account.id;
  await prisma.shop.update({ where: { id: shop.id }, data: { stripeAccountId: accountId, stripeAccountStatus: "pending" } });
}
```

The helper `createConnectAccount` uses Stripe-side idempotency (`shop:create-account:${shopId}` for 24h), but the DB persist happens after the create — so two concurrent requests may both call Stripe, get back the same account id (deduped), and only one wins the DB write. The second update silently overwrites an identical value. That works **in practice** because Stripe dedupes — but only for 24h. After 24h a second create on the same idempotency key creates a new account, giving the merchant two Express accounts and complicating fund routing.

`getOrCreateConnectAccount` in `connect.ts:92-157` solves this by:
1. Pre-checking the DB.
2. Calling Stripe (idempotent).
3. Updating DB with `where: { stripeAccountId: null }` — guarded write.
4. Re-reading on race.

**Fix**: Use `getOrCreateConnectAccount` and remove the inline branch.

---

### 5. F-04 — Anonymous cart endpoint with no auth & no validation

**File**: `src/app/api/cart/add/route.ts:13-58`

```ts
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "anon";
  const rl = await checkRateLimit(rateLimits.api, `cart-add:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const body = await req.json();
  const parsed = addToCartSchema.safeParse(body);
  // ... only logs, no DB write ...
  logger.info(`[CART] Add: shop=${shopId}, product=${productId}, qty=${qty}`);
  return NextResponse.json({ success: true, ... });
}
```

**Why it matters**:
- Endpoint is documented as "future server-side cart + analytics" but is **active in prod**.
- Anonymous IPs can spam the logger with arbitrary `shopId`/`productId` strings, polluting analytics.
- An attacker could correlate logs with rate-limit Redis keys to fingerprint cart behavior.
- Rate limit fails open (returns success on Redis error) — line 47 of `rate-limit.ts`.

**Fix**: Either delete the file, or:

```ts
const userId = await getServerUserId();
if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");
// Then validate shopId / productId against DB and forward to /api/cart logic.
```

---

## Quick Wins (< 1h fixes)

These are independent, low-risk fixes that materially improve security:

1. **Delete `src/app/api/debug-stripe-env/route.ts`** — F-01 (5 min).
2. **Replace `auth()` cookie `httpOnly: false` with `httpOnly: true`** in `test-mode/activate/route.ts:46,93` — F-07 (5 min). Verify `isTestActivatedMiddleware` keeps working (it reads cookies server-side, which works regardless of httpOnly).
3. **Add OR-clause to `pro-requests/[proAccessId]/route.ts:28-30`** — F-03 (10 min).
4. **Refactor `cron/route.ts` to use `verifyCronAuth`** — F-10 (10 min).
5. **Validate `roleFilter` enum in `admin/users/route.ts:14-17`** with Zod — F-11 (10 min).
6. **Hostname allowlist in `boucher/images/import/route.ts`** — F-18 (15 min). Reuse the `ALLOWED_HOSTS` set from `boucher/images/proxy/route.ts:7-9`.
7. **Add `MAX_BYTES` cap in `admin/images/generate/route.ts`** before `put()` — F-19 (10 min).
8. **Replace `console.error` with `logger.error`** across 8 files — F-15, F-27 (20 min).
9. **Replace `provided !== expected` with `crypto.timingSafeEqual`** in `test-mode/activate/route.ts:38,84` — F-06 (10 min).
10. **Remove `http:` from CSP `img-src`** in `next.config.mjs:84` — F-26 (5 min).
11. **Add `writeAuditLog` to `admin/users/[id]/route.ts` PATCH** — F-14 (15 min).

Total: under 2 hours of focused work.

---

## Long-term Recommendations

### Architecture
1. **Centralize ownership checks.** Extract a single `assertShopOwnership(shopId, clerkId, dbUserId)` helper that always applies the OR-clause, checks admin bypass, and returns a typed result. Every shop-scoped route should call it. The 11 places using inline `shop.ownerId !== userId && shop.ownerId !== dbUser.id` are a maintenance hazard (any one of them could drop the OR clause in a future refactor).
2. **Standardize on Prisma ID throughout.** The dual-mode (`ownerId` may be Clerk id OR Prisma id) is documented in CLAUDE.md as known tech debt. Migrate all rows to a single convention (Prisma id) and drop the OR clauses everywhere. This is a one-shot migration with low risk: `UPDATE shops SET owner_id = (SELECT id FROM users WHERE clerk_id = shops.owner_id) WHERE owner_id LIKE 'user_%';` then add a runtime assert.
3. **Per-route Zod input validation.** Most POST/PATCH routes already use Zod — extend to all GET routes with query params (e.g. `admin/users` `?role=`). Build a typed wrapper `withZod(schema, handler)`.
4. **Drop `unsafe-eval` from CSP.** Audit Sentry/Clerk runtimes; move to `strict-dynamic` with nonces. Required for SOC2 and similar audits.

### Stripe
5. **Refund flow.** `charge.refunded` handler at `src/app/api/payments/webhook/route.ts:321-403` correctly recalculates platform fee proportional to refund — but the route that **creates** the refund (currently a TODO at `checkout-session.ts:317`) needs `refund_application_fee: true` and `reverse_transfer: true`. Implement before going live.
6. **Webhook handler atomicity.** F-12: wrap each handler in a Prisma transaction so the StripeEvent insert + handler writes succeed or fail together. Stripe will retry on 5xx, idempotency holds.
7. **Test mode activation in prod.** Even with `ALLOW_TEST_IN_PROD` gating, the existence of test users with hardcoded ids (`test-admin-001`) is a footgun. Generate per-deploy test ids and rotate `TEST_SECRET` weekly.

### Defensive depth
8. **Audit logging.** `writeAuditLog` is used inconsistently — F-14. Add it to every admin write (role change, plan change, commission change, banner CRUD, support ticket close).
9. **Rate limit fail-open vs fail-closed.** `rate-limit.ts:50` returns `{ success: true }` on Redis error. For `/api/auth/otp/*` and `/api/orders` POST this is dangerous — a Redis outage opens the door to brute-force/spam. Switch the highest-risk limiters (`otpVerify`, `otpSend`, `orders`) to fail-closed and add a clear log line.
10. **Sensitive query-string tokens.** F-13: move `guestToken` from `?guestToken=...` to `Authorization` header. Guest cookie already exists; the query path is pure backwards-compat.
11. **CSP `connect-src` minimization.** Currently allows `wss://*.clerk.accounts.dev` — narrow to your specific Clerk subdomain (`clerk.klikandgo.app`).
12. **`Permissions-Policy` should opt out of more features.** Add `payment=(self)` (when Stripe is live) and `interest-cohort=()`.

### Multi-tenant
13. **Row-Level Security (RLS) at PostgreSQL level.** As a hard backstop against application bugs, enable RLS on `Order`, `Product`, `Category`, `OrderItem`, `Cart`, `CartItem`, `Review`, `LoyaltyPoint`, `Notification`, `SupportTicket`. Inject the current `shopId`/`userId` via Prisma's `setExtraQueryArgs` or PostgreSQL `SET LOCAL` per request. This is an investment but it converts every "missed `where: { shopId }`" bug from data leak to an empty result.

### Monitoring
14. **Sentry coverage.** `handleApiError` already calls `Sentry.captureException` (errors.ts:163), but only for unhandled errors. Add `Sentry.captureMessage("FORBIDDEN", { extra: { route, userId, shopId } })` on every 403 — these often signal active abuse attempts.
15. **Health endpoint exposes too little.** `/api/health` returns DB + Redis status. Add Stripe configuration check and Clerk reachability behind admin auth.

---

## Coverage Notes

- **Authentication & Authorization**: 193/193 API route files reviewed by name; ~50 deep-read. No occurrences of `await auth()` from `@clerk/nextjs/server` outside the three sanctioned wrappers (`server-auth.ts`, `boucher-auth.ts`, `admin-auth.ts`, `middleware.ts`). Test-mode activation requires server-validated secret.
- **Multi-tenant isolation**: All product/category/order writes scoped by shopId via `getAuthenticatedBoucher()`. `prisma.product.findMany` calls all include `shopId` in `where` (verified in `products/route.ts`, `boucher/products/route.ts`, `chat/route.ts`).
- **Stripe Connect**: Webhook signature verified, idempotency table, server-side price recalc, TVA HT/TTC fix. Two concrete improvements (F-08, F-12) but the foundations are correct.
- **Input validation**: ~95% of POST/PATCH routes use Zod. Found one missing case (F-11 enum).
- **Rate limiting**: Applied broadly (`orders`, `otp`, `chat`, `search`, `tickets`, `api`, `ai`). Fails open on Redis outage.
- **CSP & headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all set. CSP is acceptable; `unsafe-eval` is a known item.
- **Secrets management**: `env.example` is complete; no `NEXT_PUBLIC_` on secret vars; no hardcoded keys in source. `STRIPE_SECRET_KEY` only read server-side.
- **CSRF / cookies**: Test mode cookie is `sameSite: lax` (correct), `httpOnly: false` (F-07). Guest cookie is `httpOnly: true, secure (prod), sameSite: lax`. Clerk handles its own session cookies.
- **Sensitive data exposure**: Error responses are sanitized via `apiError()`; full stacks only go to `console.error` (server logs) and Sentry.
- **OWASP Top 10**: A01 broken access control (F-02, F-03), A03 injection (none — Prisma + Zod), A04 insecure design (F-04), A05 misconfig (F-01, F-09), A07 auth (F-06, F-07 mild), A08 software-and-data integrity (F-08 race), A10 SSRF (F-18 mitigated, F-19 mild). No A02 (crypto) or A09 (logging) findings.

---

## Files Referenced

Auth & roles:
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/auth/server-auth.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/auth/test-auth.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/admin-auth.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/boucher-auth.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/cron-auth.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/middleware.ts`

Stripe Connect:
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/stripe.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/services/stripe/checkout-session.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/services/stripe/connect.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/lib/services/stripe/commission.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/payments/webhook/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/orders/[id]/checkout-session/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/boucher/stripe/onboard/route.ts`

Critical findings:
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/debug-stripe-env/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/users/[id]/validate-pro/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/shops/[id]/pro-requests/[proAccessId]/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/cart/add/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/checkout/guest/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/test-mode/activate/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/cron/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/admin/users/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/boucher/images/import/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/src/app/api/admin/images/generate/route.ts`
- `/Users/macbook/Desktop/clickboucher/.claude/worktrees/modest-rhodes-258b78/next.config.mjs`

Auditor: senior security reviewer (LLM-assisted)
Date: 2026-04-30
