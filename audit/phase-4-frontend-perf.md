# Phase 4 — Audit Architecture & Performance Frontend

Date : 2026-04-26 — Branche : `claude/quirky-kirch`

---

## 1. Score perf frontend : **7.5/10**

### Justification

**Points forts :**
- Prisma singleton correct (`src/lib/prisma.ts`) — un seul `new PrismaClient()` global, cache `globalThis` pour HMR
- 81 `@@index` sur `prisma/schema.prisma` — couverture solide des hot paths (shopId+createdAt, userId+read, status+rating, etc.)
- Recharts (~280KB), html5-qrcode (~700KB), qrcode.react sont **tous** lazy-loadés via `dynamic(() => import())`
- ISR bien configuré : `revalidate = 60` sur la home, `revalidate = 30` sur boutiques, `revalidate = 60` sur bons-plans/recettes
- 30+ `loading.tsx` et 6 `error.tsx` répartis dans toutes les route groups
- `next/image` largement adopté — seulement **4 occurrences `<img>` natifs**, toutes justifiées (preview admin, QR, ticket print)
- `next.config.mjs` : WebP first, AVIF fallback, cache 30j, `optimizePackageImports` activé
- `html-to-image` bien retiré du bundle (0 occurrence dans `package.json` et `src/`)

**Points faibles :**
- **190 fichiers `"use client"`** — beaucoup de pages dashboard pourraient être Server Components avec sous-arbres clients ciblés
- **0 `findMany` avec `take:`** sur 119 occurrences dans `src/app/api/**` — pagination quasi inexistante au niveau Prisma (souvent compensée par filtres/limites métier mais risque réel)
- **174 occurrences `force-dynamic`** dans `src/app/**` — beaucoup légitimes (auth, mutations) mais bloquent tout cache pour les routes GET
- Schema Prisma sur **`prisma-client-js`** legacy (pas la nouvelle target `prisma-client` v6)
- 14 fichiers > 700 lignes (CLAUDE.md fixe < 300L)

---

## 2. Findings importants 🟡

### 🟡 Pagination Prisma absente (`take:`)
📁 Fichier : `src/app/api/**` — global, 119 `findMany` sans `take`
🐛 Aucun `findMany` ne déclare explicitement `take: N`. Exemples : `src/app/api/boucher/products/route.ts:27`, `src/app/api/products/route.ts:115`, `src/app/api/boucher/clients/route.ts:42`, `src/app/api/boucher/dashboard/stats/route.ts:20`, `src/app/api/chat/route.ts:213/250/267`.
💥 Impact perf : Sur une boutique avec 500 produits ou un boucher avec 5000 commandes, payload + temps DB explosent. À ce stade, le projet est petit donc pas critique — devient un goulot avant 1k boutiques.
✅ Fix : Ajouter `take: 50` (ou un cursor-based pagination) sur les listes admin/boucher. Ajouter `take: 100` côté `chat` qui multiplie les `findMany` parallèles.

### 🟡 `/api/shops/[id]` : tous les produits chargés sans pagination
📁 Fichier : `src/app/api/shops/[id]/route.ts:25-29`
🐛 `products: { where: { inStock: true }, include: { categories: true }, orderBy: { name: "asc" } }` — pas de `take`, charge l'intégralité du catalogue d'une boutique en 1 requête. Confirme le finding mentionné dans le brief.
💥 Impact perf : Boutique à 300 produits = payload 200KB+, blocage TTFB.
✅ Fix : Soit déplacer les produits sur `/api/products?shopId=X` paginé (déjà existant), soit ajouter `take: 100` ici.

### 🟡 190 composants `"use client"` — sur-utilisation
📁 Fichiers : `src/components/**`, `src/app/**` — 190 fichiers
🐛 Le ratio est très élevé pour une app Next 14 App Router. Beaucoup de pages dashboard entières sont `"use client"` (ex: `src/app/(boucher)/boucher/parametres/page.tsx` 1245L, `src/app/webmaster/parametres/page.tsx` 980L) alors que la majorité du contenu est statique avec quelques zones interactives.
💥 Impact perf : Hydratation lourde côté client, bundle JS gonflé. Les Server Components ne coûtent rien côté client — un dashboard de 1000 lignes envoyé brut au navigateur, c'est 50–100KB JS+HTML inutile.
✅ Fix : Refactoriser progressivement en pattern Server Component parent + îlots `"use client"` ciblés (formulaires, boutons interactifs).

### 🟡 `force-dynamic` étendu sur 174 routes
📁 Fichiers : 174 occurrences dans `src/app/**`
🐛 Beaucoup sont légitimes (POST/PATCH, auth-dependent). Mais certaines routes GET publiques pourraient bénéficier d'un cache (ex : `/api/boucher/products/route.ts:1` est `force-dynamic` alors qu'on pourrait `revalidate = 30`).
💥 Impact perf : Aucun cache CDN sur ces endpoints — chaque hit = full DB roundtrip.
✅ Fix : Audit ciblé route par route : ne garder `force-dynamic` que pour endpoints qui retournent vraiment du contenu user-specific. Les autres → `revalidate = N` ou `cache: "force-cache"`.

### 🟡 Fichiers > 700 lignes — non-conformes CLAUDE.md (< 300L)
📁 Fichiers (top 14) :
- `src/app/(boucher)/boucher/produits/ProductForm.tsx:1708`
- `src/app/(boucher)/boucher/produits/ProductFormPage.tsx:1703`
- `src/app/(boucher)/boucher/parametres/page.tsx:1245`
- `src/app/(boucher)/boucher/commandes/page.tsx:1218`
- `src/app/(boucher)/boucher/produits/page.tsx:1130`
- `src/components/dashboard/marketing/CampaignForm.tsx:1038`
- `src/app/webmaster/parametres/page.tsx:980`
- `src/components/dashboard/marketing/OfferForm.tsx:921`
- `src/app/(client)/commande/[id]/page.tsx:858`
- `src/app/(admin)/admin/shops/page.tsx:853`
- `src/app/(client)/panier/page.tsx:852`
- `src/app/(boucher)/boucher/dashboard/statistiques/page.tsx:828`
- `src/components/boucher/KitchenOrderCard.tsx:750`
- `src/app/webmaster/boutiques/[shopId]/page.tsx:740`

🐛 Tous ces fichiers sont des composants client monolithiques. `ProductForm.tsx` et `ProductFormPage.tsx` semblent être des duplicates (1708 vs 1703 lignes — investiger).
💥 Impact perf : Bundle gros, time-to-interactive dégradé sur dashboards. Maintenance pénible.
✅ Fix : Splitter en sous-composants par section + extraire la logique métier dans des hooks. Vérifier si `ProductForm.tsx` ET `ProductFormPage.tsx` sont tous deux utilisés ou si l'un est mort.

---

## 3. Findings améliorations 🟢

### 🟢 Prisma generator legacy
📁 Fichier : `prisma/schema.prisma:13-16`
🐛 `provider = "prisma-client-js"` — c'est le générateur historique. Prisma 6 propose `prisma-client` (nouveau, plus performant, type-safety améliorée). Le projet est sur `@prisma/client@^5.14.0`.
💥 Impact perf : Mineur. Migration v6 = +10–15% perf queries + bundle plus léger côté serveur.
✅ Fix : Roadmap futur — bump à Prisma 6 + migration generator.

### 🟢 SearchBar lit `localStorage` dans render path (mais wrappé)
📁 Fichier : `src/components/search/SearchBar.tsx:25-29`
🐛 Fonction `getRecentSearches()` accède directement à `localStorage` ; appelée probablement dans un `useState(() => getRecentSearches())` ou `useEffect`. À vérifier — si appelée pendant le render initial sans guard SSR, hydration mismatch possible.
💥 Impact perf : Pas vérifié — peut causer warnings hydration en cas d'usage en initializer.
✅ Fix : Vérifier que tous les appels sont dans `useEffect` (pas dans `useState(initial)` ni dans le render direct).

### 🟢 ThemeProvider — hydration sensible
📁 Fichier : `src/components/providers/ThemeProvider.tsx:20`
🐛 `localStorage.getItem("theme")` lu dans le composant. Pattern classique de mismatch SSR/client. Probablement déjà géré (script inline `<head>` qui set la classe avant React hydrate), mais à vérifier.
💥 Impact perf : Flash of Unstyled Content (FOUC) si pas géré.
✅ Fix : S'assurer du script anti-flash dans `layout.tsx`.

### 🟢 Index DB potentiellement manquants
📁 Fichier : `prisma/schema.prisma`
🐛 81 `@@index` couvrent l'essentiel. À vérifier sur les modèles non-listés dans l'extrait :
- `Review` : `[shopId, rating]` (pour tri reviews) — présent (`@@index([status, rating])` mais sur un autre modèle, à confirmer pour Review)
- `OrderItem` : `[orderId]` et `[productId]`
- `Notification` : `[userId, read]` — présent
- `Order` : `[userId, status]` — pas vu dans l'extrait
💥 Impact perf : Marginal sur petit volume, sensible à >10k orders.
✅ Fix : Audit ciblé `prisma/schema.prisma` sur Order, Review, OrderItem.

### 🟢 `optimizePackageImports` ne couvre pas `@dnd-kit`
📁 Fichier : `next.config.mjs:6`
🐛 La config liste `lucide-react, recharts, sonner, zod, cva, clsx` mais pas `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (~150KB combinés).
💥 Impact perf : Mineur, dépend de l'usage de dnd-kit.
✅ Fix : Ajouter ces modules à `optimizePackageImports`.

---

## 4. Quick wins (< 30 min)

| # | Fix | Fichier | Effort |
|---|-----|---------|--------|
| 1 | Ajouter `take: 100` sur `/api/shops/[id]` products | `src/app/api/shops/[id]/route.ts:25` | 2 min |
| 2 | Ajouter `take: 50` sur findMany boucher (clients, products, calendar) | 3 routes | 10 min |
| 3 | Ajouter `@dnd-kit/*` à `optimizePackageImports` | `next.config.mjs:6` | 1 min |
| 4 | Investiger duplication `ProductForm.tsx` vs `ProductFormPage.tsx` (3411L combinées) — supprimer le mort | `src/app/(boucher)/boucher/produits/` | 15 min |
| 5 | Vérifier `force-dynamic` sur `/api/boucher/products/route.ts:1` — passer en `revalidate = 30` si compatible | 1 ligne | 5 min |
| 6 | Ajouter `take: 100` sur `chat/route.ts` recipes/products/popular | `src/app/api/chat/route.ts:213/250/267` | 5 min |

---

## 5. Tableau récap

| Catégorie | Statut | Détail |
|-----------|--------|--------|
| Prisma singleton | 🟢 OK | 1 seule instanciation, `globalThis` cache |
| Server vs Client | 🟡 À améliorer | 190 `"use client"` — sur-utilisation dashboards |
| Hydration risks | 🟢 OK | Pas de `Math.random()`/`Date.now()` dans render Server. Refs/effects OK côté client. |
| N+1 queries | 🟢 OK | Pas de `.map(async)` ou loops `await prisma.X` détectés. `include`/`select` partout. |
| Pagination | 🟡 À améliorer | 0/119 `findMany` avec `take` |
| Index DB | 🟢 OK | 81 `@@index`, hot paths couverts |
| Images | 🟢 OK | 4 `<img>` justifiés, `next/image` partout sinon |
| Bundle (recharts/qrcode) | 🟢 OK | Tous lazy via `dynamic()` |
| html-to-image | 🟢 OK | Supprimé du bundle |
| Loading/Error | 🟢 OK | 30+ `loading.tsx`, 6 `error.tsx` |
| Cache HTTP / ISR | 🟡 À améliorer | 174 `force-dynamic` — audit ciblé recommandé |
| Prisma v6 generator | 🟢 OK | Sur v5 `prisma-client-js` legacy — pas urgent |
| Fichiers > 300L | 🟡 À améliorer | 14 fichiers > 700L, top à 1708L |
| `optimizePackageImports` | 🟢 OK | Manque `@dnd-kit/*` (mineur) |

---

**Conclusion** : Architecture frontend **saine** pour un MVP en croissance. Les 3 chantiers prioritaires sont (1) ajouter pagination Prisma sur les routes liste, (2) découper les composants 1000+ lignes en îlots Server/Client, (3) auditer `force-dynamic` pour libérer du cache CDN. Aucun blocker critique 🔴.
