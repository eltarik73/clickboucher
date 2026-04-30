# Performance Audit — Klik&Go (2026-04-30)

> Static analysis only. No app run. All file:line references are absolute paths reduced to `src/...` for readability. Cited line numbers refer to the worktree at `.claude/worktrees/modest-rhodes-258b78/`.

## Executive Summary

**Score: 7.2 / 10**

Klik&Go has solid foundations: Prisma singleton, comprehensive indexes on hot tables (`Order`, `Product`, `Shop`), ISR caching on the homepage (60s) and shop pages (30s) with Redis fallback, dynamic imports for PWA / heavy widgets, and a well-implemented SafeImage with WebP-first config. Cron jobs are mostly batched correctly (weekly-report, calendar-alerts, trial-expiry).

However, several real perf issues remain:
- **Two cron N+1s** that scale with shop count (`recalc-shop-tiers`, `performance-refresh`).
- **Two cron paths declared in `vercel.json` point to non-existent routes** (`/api/cron/auto-promos`, `/api/cron/expire-promos`) — silent 404s every day.
- **`recharts` is imported synchronously** on two finance dashboards, ballooning JS bundle on those pages.
- **`/api/cart` GET issues an auth check followed by full include** — it now returns an empty cart on 401 (good), but the full-fat `include` is shipped even when the cart is empty in many paths.
- **`prisma.product.findMany` on `/bons-plans` is unbounded** — works at current data volumes but unsafe long-term.
- **No `<link rel="preconnect">` to Clerk / Google Fonts** in `src/app/layout.tsx` despite CLAUDE.md saying this should exist.
- **`/api/orders/reorder`** does a `findFirst orderBy: orderNumber desc` for daily numbering — race-prone and slow on a growing orders table.

The kitchen mode SSE polling, EventSource cleanup, and useEffect cleanup are correctly implemented. No memory-leak red flags found.

## Findings Table

| ID | Sev | Type | File:line | Issue | Fix | Effort |
|---|---|---|---|---|---|---|
| P-01 | HIGH | Cron N+1 | `src/app/api/cron/recalc-shop-tiers/route.ts:38-81` | Loops over every shop and runs `prisma.order.aggregate` + `prisma.shop.update` per iteration. Linear in shop count — at 100+ shops this scales to 200+ queries on the 1st-of-month cron. | Replace with a single `prisma.order.groupBy({ by: ['shopId'], _sum: { totalCents: true } })` filtered on `paidAt`, then resolve tiers in memory and batch updates in a `$transaction`. | 1h |
| P-02 | HIGH | Cron N+1 | `src/lib/services/performance.ts:296-302` (called by `src/app/api/cron/performance-refresh/route.ts`) | `refreshAllShopMetrics` iterates `shops` and `await refreshShopMetrics(shop.id)` per shop. Each call hits the DB multiple times (orders, ratings, alerts). Linear and serial. | Use `Promise.all` with concurrency cap (`p-limit` style), or push into a queue. Better: rewrite the metrics aggregator as a single SQL `groupBy` per metric. | 2-3h |
| P-03 | HIGH | Cron config | `vercel.json:14, 17` | `"/api/cron/auto-promos"` and `"/api/cron/expire-promos"` are scheduled but the route handlers don't exist (no `src/app/api/cron/auto-promos/route.ts` or `expire-promos/route.ts`). Vercel logs daily 404s. | Either implement the handlers or remove the cron entries from `vercel.json`. | 15min |
| P-04 | HIGH | Cron schedule collision | `vercel.json:6, 13` | `busy-end` and `trial-expiry` both at `0 2 * * *`; `vacation-end` and `auto-promos` both at `0 6 * * *`. Vercel runs them simultaneously sharing DB connections. | Stagger to avoid DB-pool spikes (e.g. `5 2`, `10 2`, `0 6`, `5 6`). | 5min |
| P-05 | HIGH | Bundle | `src/app/(boucher)/boucher/dashboard/finances/page.tsx:22-30` and `src/app/webmaster/finances/page.tsx:19-30` | `recharts` imported statically at top of the page. Chart bundle (~140KB gzip) is shipped before user even sees the dashboard. The `statistiques` page already uses `next/dynamic` for the same lib — these two pages did not get the same treatment. | Mirror the pattern from `src/app/(boucher)/boucher/dashboard/statistiques/page.tsx:30-44` with `dynamic(() => import("recharts").then(m => m.X), { ssr: false })`. | 30min |
| P-06 | HIGH | Render-blocking | `src/app/layout.tsx:120-131` | No `<link rel="preconnect">` to `https://clerk.klikandgo.app`, `https://fonts.gstatic.com`, or `https://fonts.googleapis.com`. CLAUDE.md states "Preconnect : Clerk + Google Fonts dans layout.tsx <head>" — actual file has only the Plausible script. Adds ~150-300ms RTT on cold loads (especially mobile 4G). | Add `<link rel="preconnect" href="..." crossOrigin="anonymous" />` for Clerk + fonts inside the existing `<head>` block. | 10min |
| P-07 | MEDIUM | Unbounded list | `src/app/(client)/bons-plans/page.tsx:78-93` | `prisma.product.findMany` for promo products has no `take:`. ISR-cached so DB hit is once per minute, but full result ships in HTML payload — page weight grows with promo catalog size. | Add `take: 200` (or split into "trending 50" + "load more" client-side). | 20min |
| P-08 | MEDIUM | Unbounded list | `src/app/(client)/boutique/[slug]/page.tsx:35-43` | Shop products pulled with `include` and no `take:`. Fine for typical butcher (~100 SKUs) but no upper bound. Server payload + client serialization grows linearly. | Add `take: 300` and a "see more" pagination if shop ever exceeds. | 15min |
| P-09 | MEDIUM | API perf | `src/app/api/orders/reorder/route.ts:90-95` | `findFirst({ where: { orderNumber: { startsWith: prefix } }, orderBy: { orderNumber: "desc" } })` to compute next number. No index on `orderNumber` prefix; scans growing table. Also race-prone for concurrent reorders. | Use the existing `DailyCounter` model (it's literally for this purpose) inside a transaction. | 1h |
| P-10 | MEDIUM | API caching | `src/app/api/categories/route.ts:36-42` | Public list cached via `apiCached` (300s) — good. But `_count: { products: true }` runs subquery each cache miss; cheap individually but called for every shop visit. Could go in shop detail's existing Redis cache. | Pre-compute counts in the existing `getShop()` Redis cache in `src/app/(client)/boutique/[slug]/page.tsx:50-75`. | 30min |
| P-11 | MEDIUM | Unused component / Date.now in render | `src/components/landing/CalendarBanner.tsx:16` | `Date.now()` at module top-level of a Server Component — would cause SSR/CSR mismatch IF rendered, but `grep` shows no caller (only its own definition). Dead code shipping the file in builds. | Either delete the file or wire it into the homepage. CLAUDE.md mentions it as a Server Component, so likely meant to be used. | 15min |
| P-12 | MEDIUM | Console in API | `src/app/api/boucher/orders/stream/route.ts:135` and `src/lib/services/performance.ts:300` | `console.error` calls in API code violate CLAUDE.md "Pas de console.log en production". Sentry would catch the throw anyway. | Replace with `logger.error(...)` from `@/lib/logger`. | 10min |
| P-13 | LOW | Image opt | `src/app/(client)/boutique/[slug]/page.tsx:314` | Hero shop image uses `quality={80}`. CLAUDE.md says shop card cards should use 60. Hero may justify higher quality; just confirm intentional. | Verify intent. If unintentional, drop to 70. | 5min |
| P-14 | LOW | SafeImage usage | only 4 callers found via `grep -rln "@/components/ui/SafeImage"` | Many `next/image` calls (29 imports) skip `SafeImage` even though SafeImage is the documented standard. Failed product images fall to broken-image icon, not the SVG fallback. | Migrate `Image` → `SafeImage` in shop/product list pages. Audit callers for `imageUrl` nullability. | 1-2h |
| P-15 | LOW | Memory leak | `src/components/checkout/OrderCountdown.tsx:107-119` | `setInterval` cleanup only happens via `if (timerRef.current)` — when `submitOrder` resolves and component unmounts simultaneously, ref might be cleared but interval can fire once before cleanup. Tiny edge case. | Add `cancelledRef.current` guard inside the interval callback. | 10min |
| P-16 | LOW | Hooks | `src/hooks/use-order-polling.ts:99` | `fetch("/api/orders")` on every poll re-fetches the full order set with all includes. Kitchen tablets stay open hours and re-pull ~20 orders every 5s (~17K calls / day per tablet). | Add an `If-Modified-Since` header or `since=` cursor; server returns `304` on unchanged. | 2h |
| P-17 | LOW | API list | `src/app/api/cart/route.ts:20-41` | Cart GET pulls full product fields per item even when component only needs `name`/`priceCents`/`imageUrl`. Per-page payload bloat. | Trim `select` (name, imageUrl, priceCents, proPriceCents, unit, inStock, snoozeType — drop `id` if redundant; cartItem already has productId). | 15min |
| P-18 | LOW | CLS risk | `src/components/order/OrderTracker.tsx:70` | When the active order finishes loading, the entire banner appears with no skeleton. Adds ~80px to the homepage layout suddenly. Server renders nothing (it's `dynamic` SSR off). | Reserve space with a skeleton placeholder while `loading`, then fade in. | 30min |

## Top 5 Performance Issues (with explanation)

### 1. P-01 — Monthly cron N+1 on shop tiers
`recalc-shop-tiers` runs once on the 1st of the month at 03:00 UTC. With the current shop count (low double digits) it's invisible. As Klik&Go grows toward the 1000-shop milestone, this becomes a 1000-aggregate + 1000-update serial flood that can blow past the configured `maxDuration: 300` and fail mid-run, leaving tiers half-updated. Also pegs the pgbouncer pool. Fix is a ~10-line refactor to `groupBy` + batched `UPDATE`. **Should be fixed before next major shop onboarding.**

### 2. P-02 — Daily metrics refresh N+1
`performance-refresh` runs every day at 03:00 UTC and is even worse because each `refreshShopMetrics(shopId)` itself does multiple queries (orders, ratings, alerts). At 100 shops, ~500 sequential queries; at 500 shops, ~2,500. This is the most likely future cause of cron timeouts. Same fix shape: pull aggregate data once, distribute in memory.

### 3. P-03 / P-04 — Broken / colliding cron schedules
Two of the 14 declared crons (auto-promos, expire-promos) silently fail because the route doesn't exist. Vercel logs 404s daily; KPIs that rely on these (promo expiry) may be silently stale. Cron co-scheduling at exactly `0 2` and `0 6` means concurrent DB pool pressure even on small workloads. Both are 5-minute fixes that pay dividends.

### 4. P-05 — Recharts in finance dashboards
Two of the most-used pages by paying butchers (`/boucher/dashboard/finances`) and webmasters (`/webmaster/finances`) ship `recharts` (140KB gzip) statically. Even on a fast connection this delays interactivity. The `statistiques` page already lazy-loads recharts the right way — copy that pattern. Easy win, big impact.

### 5. P-06 — Missing preconnect to Clerk
The CLAUDE.md spec says "Preconnect : Clerk + Google Fonts dans layout.tsx <head>", but the actual `<head>` only renders the conditional Plausible script. On a cold first paint, Clerk's auth bundle and the Outfit/DM Sans webfonts each cost a TLS+DNS+TCP round-trip. Adding three `<link rel="preconnect">` tags is a single 5-line edit, typically saves 150-300ms LCP on mobile.

## Quick Wins (under 30 min each)

1. **Add preconnect tags** in `src/app/layout.tsx` head (P-06) — 10 min, ~150-300ms LCP saved.
2. **Remove or implement** `auto-promos` and `expire-promos` cron entries in `vercel.json` (P-03) — 15 min.
3. **Stagger cron schedules** in `vercel.json` (P-04) — 5 min.
4. **Replace `console.error` with `logger.error`** in stream + performance service (P-12) — 10 min.
5. **Lazy-load recharts** on `boucher/dashboard/finances/page.tsx` and `webmaster/finances/page.tsx` (P-05) — 30 min.
6. **Decide on CalendarBanner**: delete dead code or render it (P-11) — 15 min.
7. **Add `take: 200`** to `bons-plans` and shop product queries (P-07, P-08) — 20 min.
8. **Trim cart GET select** (P-17) — 15 min.

Estimated combined impact: -200ms LCP on homepage, -100KB JS on finance pages, no more silent cron 404s, cleaner logs.

## Bundle Analysis Recommendations

The codebase already does good things via `next.config.mjs:8-19` (`optimizePackageImports` for `lucide-react`, `recharts`, `sonner`, `zod`, `class-variance-authority`, `clsx`, Radix, dnd-kit). Build-time tree-shaking is correct.

What's missing:
1. **Per-route bundle inspection.** Run `ANALYZE=true next build` with `@next/bundle-analyzer` (not currently in `package.json`) to confirm the recharts findings (P-05) and surface other heavy clients. Add it as a one-time devDependency.
2. **First-load JS budget.** Add a CI check (e.g. `next-bundle-analyzer` JSON output + a `node` script) failing the build if any route's first-load JS exceeds 200KB. The 1077-line `panier/page.tsx` and 1218-line `boucher/commandes/page.tsx` are likely candidates.
3. **`@anthropic-ai/sdk`, `replicate`, `stripe`, `web-push`, `svix`** — verify these are server-only (currently used only in API routes / `src/lib/services/*` per `grep`). Confirm with bundle analyzer they don't accidentally land in client bundles (they shouldn't, but worth verifying).
4. **Sharp** is correctly dynamic-imported (`src/app/api/uploads/product-image/route.ts:103`).
5. **`html5-qrcode`** is correctly dynamic-imported (`src/components/order/QRScanner.tsx:26`, `src/components/boucher/QRScanner.tsx:56`).
6. **`qrcode.react`** is dynamic on `src/app/(client)/commande/[id]/page.tsx:8` — good.

## Database / Prisma Observations

**Indexes are well thought out** (`prisma/schema.prisma`):
- `Order`: `[shopId, status]`, `[shopId, createdAt]`, `[shopId, updatedAt]`, `[userId]`, `[userId, status]`, `[expiresAt, status]`, `[status, expiresAt]`, `[createdAt, status]`, `[offerId]` — covers all hot query patterns.
- `Product`: `[shopId, displayOrder]`, `[shopId]`, `[shopId, isActive, inStock]`, `[shopId, inStock, snoozeType]`, `[inStock, promoPct]`, anti-gaspi/flash variants.
- `Shop`: `[latitude, longitude]`, `[city]`, `[visible, status]`, `[status, rating]`, `[ownerId]`.
- `Notification`, `OrderEvent`, `LoyaltyReward`, `Offer` all properly indexed.

**Potential index gap**: `Order.orderNumber` has `@unique` (good for lookups) but the prefix-scan pattern in `reorder/route.ts:90` benefits from a B-tree on `(orderNumber)` which `@unique` already provides — this is fine. The real fix is to use `DailyCounter` (P-09).

**No truly bad N+1s in the API request path** — all the major routes (`/api/orders`, `/api/products`, `/api/cart`, `/api/shops/...`) use proper `include`/`select`. The N+1s are confined to crons (P-01, P-02).

**Pagination is mostly present**: `take: 50` on orders list, `take: 200` on products, `take: 6/3/4` on offer/popup/recipe queries. The two unbounded ones (P-07, P-08) are ISR-cached so the operational risk is low until catalog grows.

**`select` is appropriately lean** in hot paths. One exception is `/api/cart` (P-17) — minor.

## Mobile Performance

- **Touch targets**: Spot-checked components show consistent `min-h-[44px]`, `w-11 h-11`, `min-w-[44px] min-h-[44px]` (`FavoriteButton`, `ThemeToggle`, `FormWizard`, `ImageRetouchModal`). Compliant with CLAUDE.md.
- **Animations**: `transition-transform duration-500 group-hover:scale-105` on shop cards is GPU-friendly. `animate-pulse` skeletons used. No heavy `transition-all` red flags found in the components reviewed.
- **Polling overhead on tablets**: Kitchen mode polls every 5s for full order data (P-16). Over 8h of operation that's ~5,800 calls/tablet. Real impact depends on the order shape; today it's tolerable, but the SSE stream (`useOrderStream`) is already implemented and could replace the polling on tablets.

## Memory Leaks — none found

- `useOrderPolling` (`src/hooks/use-order-polling.ts:167-173`) cleans interval on unmount.
- `useOrderStream` (`src/hooks/useOrderStream.ts:96-100`) closes EventSource on unmount.
- SSE route (`src/app/api/boucher/orders/stream/route.ts:121-124`) cleans interval on stream cancel.
- `OrderTracker.tsx:67`, `ActiveOrderBanner.tsx:54`, `BoucherNav.tsx:62`, `WebmasterNav.tsx:115`, `PrepTimer.tsx:27`, `FlashCountdown.tsx:25-32`, `OrderCountdown.tsx:107-119` — all clear interval in cleanup. P-15 flagged a tiny edge case but it's not a real leak.

## ISR / Caching Strategy

- `src/app/(client)/page.tsx:1` — `revalidate = 60` ✓
- `src/app/(client)/boutique/[slug]/page.tsx:1` — `revalidate = 30` ✓
- `src/app/(client)/bons-plans/page.tsx:3` — `revalidate = 60` ✓
- Boutique page also wraps the DB query in `react.cache` + Redis (TTL 60s) — belt & suspenders, correct.
- `apiCached` used appropriately on `/api/categories` (300s) and `/api/search` (30s).
- Vercel CDN headers from `revalidate` work because the homepage no longer calls `auth()` on the server (favorites hydrated client-side, see comment at `page.tsx:103-104`).

## Render-blocking & Fonts

- Three Google Fonts loaded with `display: "swap"` — non-blocking ✓.
- Plausible loads with `strategy="lazyOnload"` ✓.
- Sentry wrapped via `withSentryConfig` only when `SENTRY_DSN` set — soft dependency ✓.
- Missing preconnect (P-06).

## Conclusion

The app is well-engineered for its current scale. The handful of issues here split into "future-scaling foot-guns" (P-01, P-02, P-16) and "quick wins" (P-03 through P-08, P-12). I'd prioritize the 30-min wins next sprint to claw back ~200ms LCP and clean cron logs, then schedule the cron N+1s before next butcher cohort lands.
