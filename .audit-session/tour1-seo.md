# Audit SEO Klik&Go — Tour 1

**Date** : 2026-04-22
**URL auditée** : https://klikandgo.app
**Stack** : Next.js 14 (App Router) / Vercel / Prisma PostgreSQL

---

## Synthèse chiffrée

| Métrique | Valeur mesurée | Cible | Verdict |
|---|---|---|---|
| TTFB homepage | **578 ms** | < 200 ms | 🟠 Lent (cold Vercel) |
| Time total homepage | 897 ms | < 600 ms | 🟠 |
| HTML homepage | **198 KB** | < 100 KB | 🔴 Trop lourd |
| HTML boutique/[slug] | **390 KB** | < 150 KB | 🔴 Très trop lourd |
| HTML 404 | **91 KB** | < 20 KB | 🟠 |
| Scripts homepage | 24 `<script src=...>` | — | 🟠 |
| URLs sitemap | 68 | — | 🟡 Honorable mais pauvre |
| JSON-LD homepage | 1 (Organization seul) | 3+ | 🔴 |
| JSON-LD city page | 8 (Org + Breadcrumb + FAQ + 5× Store) | OK | ✅ |
| JSON-LD boutique/[slug] | 3 (Org + Store + Breadcrumb, **0 Product**) | 3 + Products | 🔴 |
| H1 homepage / city / bons-plans | **0** | 1 | 🔴 |
| H1 boutique | 1 ("Boucherie Tarik") | 1 | ✅ |
| og:image homepage | **absent du head** (seul twitter:image) | présent | 🔴 |
| Cache-Control homepage | `private, no-cache, no-store` | `s-maxage=60, stale-while-revalidate` | 🔴 |
| hreflang | 0 | FR uniquement OK | ✅ |
| www redirect | 307 → canonical | 301 attendu | 🟡 |

---

## 🔴 CRITIQUE

### C1 — `Cache-Control: private, no-cache, no-store` sur TOUTES les pages publiques
**URL** : `/`, `/boucherie-halal/chambery`, `/boutique/boucherie-tarik`, `/bons-plans`
**Extrait** :
```
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-vercel-cache: MISS
```
**Impact** : le CDN Vercel ne met jamais en cache les pages publiques SSR. Chaque hit Googlebot = cold start sur une serverless function (TTFB ~580 ms mesuré). Résultat : **mauvais scores CWV (LCP/INP), crawl budget gaspillé, pages peu mises à jour dans l'index**. CLAUDE.md parle d'ISR 60 s sur `/` mais le header prouve qu'elle n'est pas active (`x-vercel-cache: MISS` sur 2 hits consécutifs).
**Fix** :
```ts
// app/(client)/page.tsx
export const revalidate = 60; // ISR OK
// app/(client)/layout.tsx : vérifier qu'aucun cookie Clerk ne force "private"
```
Plus probable : `auth()` de Clerk est appelé dans le layout `(client)` → dynamic rendering forcé → `no-store`. Soit passer à `currentUser()` conditionnel côté Client Component, soit isoler l'authent dans un sous-layout non-public.

### C2 — Aucun `<h1>` sur la homepage, `/bons-plans`, et les 6 pages `/boucherie-halal/[ville]`
**URL** : `/` , `/bons-plans`, `/boucherie-halal/chambery`, `/boucherie-halal/grenoble`, `/boucherie-halal/lyon` (et 3 autres)
**Extrait** (city page Chambéry) :
```html
<!-- Seuls h2 présents -->
<h2>Nos 5 boucheries halal partenaires à Chambéry</h2>
<h2>Questions fréquentes</h2>
```
**Impact** : Google déduit le sujet principal via `<title>` faute de H1, mais la hiérarchie sémantique est cassée → -10/15 % de pertinence sur les pages SEO villes (requêtes à très fort volume local type "boucherie halal chambéry"). Le hero visible dit "Marre d'attendre ?" mais ce n'est qu'une `<div>`.
**Fix** :
```tsx
// homepage hero
<h1 className="sr-only md:not-sr-only ...">Boucheries halal près de chez vous — Click & Collect à Chambéry, Grenoble, Lyon</h1>
// page ville
<h1>Boucherie halal à {city.name} — Click & Collect</h1>
```

### C3 — `og:image` absent du `<head>` de la homepage
**URL** : `/`
**Extrait head** :
```
<meta property="og:title" ... />
<meta property="og:description" ... />
<meta property="og:url" ... />
<!-- PAS de og:image -->
<meta name="twitter:image" content="https://klikandgo.app/og-image.png"/>
```
**Impact** : partages Facebook/LinkedIn/WhatsApp/Slack sans miniature → -30 à -50 % de CTR social. Tous les "partage" depuis la home donnent une preview textuelle nue.
**Fix** : dans `app/layout.tsx` ou `app/(client)/page.tsx` metadata, ajouter :
```ts
openGraph: {
  images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Klik&Go — Click & Collect boucherie halal" }],
}
```

### C4 — Page boutique = 390 KB de HTML, 0 `Product` JSON-LD
**URL** : `/boutique/boucherie-tarik`
**Extrait** : 3 JSON-LD (Organization, Store, BreadcrumbList) — `grep -c '"@type":"Product"' = 0`.
**Impact** :
- CLAUDE.md annonce "premiers 20 produits par boutique" → **non implémenté en prod** ou non rendu côté serveur. Perte totale des rich results Google (prix, stock, étoiles) dans les SERPs.
- 390 KB HTML = gros payload RSC (Server Component stream) probablement dû à la sérialisation du catalogue produits complet dans le JSON `__next_f.push`. **LCP mobile explose** sur 4G.
**Fix** :
1. Ajouter `<ProductSchema>` dans `app/(client)/boutique/[slug]/page.tsx` (composant déjà listé dans CLAUDE.md `src/components/seo/ProductSchema.tsx`).
2. Limiter le bootstrap RSC aux 12 premiers produits, lazy-load le reste via `useInfiniteQuery`.

### C5 — Pages légales obligatoires manquantes (B2C + RGPD)
**URLs testées** :
- `/mentions-legales` → 200 ✅
- `/cgv` → 200 ✅
- `/cgu` → **404** 🔴
- `/contact` → **404** 🔴
- `/a-propos` → **404** 🔴
- `/confidentialite` → **404** mais sitemap référence `/politique-de-confidentialite` (jamais testée dans la liste réelle)
**Impact** :
- **Juridique** : site e-commerce sans CGU d'utilisation de plateforme = faille art. L111-1 C.conso. Clerk collecte des données personnelles sans politique de confidentialité accessible = RGPD art. 13-14 non respecté.
- **SEO E-E-A-T** : Google Quality Rater Guidelines pénalisent les sites YMYL (transactions) sans page contact/about. Signal de confiance très bas.
**Fix** : créer `/contact`, `/a-propos`, `/cgu` OU fusionner dans mentions-legales + redirection. Vérifier que le sitemap référence `politique-de-confidentialite` qui renvoie 200 (à tester).

### C6 — Homepage JSON-LD insuffisant (Organization seul, pas de WebSite + SearchAction ni ItemList)
**URL** : `/`
**Extrait** : 1 seul script ld+json = Organization.
**Impact** :
- Pas de sitelinks searchbox Google (WebSite + potentialAction SearchAction).
- La page homepage liste 9 boucheries mais pas d'`ItemList` → pas de carousel rich result.
- Pas de FAQPage en home (alors qu'elle existe sur les pages villes).
**Fix** : ajouter dans `app/(client)/page.tsx` :
```ts
{ "@type": "WebSite", "url": "https://klikandgo.app", "potentialAction": { "@type": "SearchAction", "target": "https://klikandgo.app/search?q={search_term_string}", "query-input": "required name=search_term_string" } }
{ "@type": "ItemList", "itemListElement": shops.map((s,i)=>({ "@type":"ListItem", position:i+1, url: `https://klikandgo.app/boutique/${s.slug}` })) }
```

---

## 🟠 MAJEUR

### M1 — Page 404 renvoie 91 KB de HTML
**URL** : `/cette-page-nexiste-pas-123` → `content-length: 91839`
**Impact** : Googlebot consomme énormément de crawl budget sur des 404 accidentelles (pages supprimées, URLs avec `?utm_`). Vercel serverless invocations inutiles facturées.
**Fix** : créer un `app/not-found.tsx` MINIMAL (pas de nav, pas de footer lourd, pas de hooks client). Target < 10 KB.

### M2 — `x-robots-tag` absent, `robots` meta `index,follow` sur pages privées potentielles
**Constat** : robots.txt disallow `/panier/`, `/checkout/`, `/profil/` mais Googlebot peut arriver dessus via backlinks. Pas de `noindex` via meta HTML vérifié.
**Impact** : risque d'indexation de pages de commande (contenu utilisateur connecté).
**Fix** : ajouter dans les layouts privés :
```ts
export const metadata = { robots: { index: false, follow: false } };
```
CLAUDE.md dit "déjà fait" — à vérifier en crawlant `/panier` direct.

### M3 — Sitemap sans `lastmod` significatif, sans sitemap index
**Extrait** :
```xml
<lastmod>2026-04-22T23:44:40.516Z</lastmod>  <!-- IDENTIQUE pour les 68 URLs -->
```
**Impact** : `lastmod` ne reflète pas la vraie date de modification → Googlebot ignore le signal pour prioriser le re-crawl. Les 49 recettes auraient dû avoir des lastmod étalés.
**Fix** : stocker `updatedAt` en DB et utiliser la vraie date :
```ts
{ url, lastModified: recipe.updatedAt, changeFrequency: "monthly", priority: 0.5 }
```

### M4 — `changefreq: daily` partout sur `/bons-plans` et enfants — signal bruité
**Extrait sitemap** : 6 URLs `/bons-plans/*` toutes `<changefreq>daily</changefreq>`.
**Impact** : Google ignore `changefreq` depuis 2020 (confirmé par John Mueller), mais un excès de `daily` sans modifications réelles est un signal de méfiance algo + gaspillage crawl.
**Fix** : `weekly` par défaut, `daily` uniquement si contenu vraiment journalier.

### M5 — Seulement 9 boutiques + 6 villes dans le sitemap — catalogue produits 0 page indexée
**Constat** : 49 recettes (bon), 9 boutiques, 6 villes. **Aucune page produit indépendante** (ex: `/boutique/boucherie-tarik/produit/agneau-epaule`).
**Impact** : perte énorme du longue traîne. Ex. requête "epaule agneau halal chambéry 500g" n'a aucune page de destination. Pour un click & collect, c'est 60-70 % du trafic SEO potentiel perdu.
**Fix** : créer des routes produits publiques `/boutique/[slug]/p/[product-slug]` avec ProductSchema + offer. Ou au minimum ancres : `/boutique/[slug]#produit-xxx` dans le sitemap.

### M6 — Redirection www → apex en 307 au lieu de 301
**Extrait** : `curl -I https://www.klikandgo.app/` → `HTTP/2 307`
**Impact** : 307 = temporary redirect → Google garde les deux versions en index plus longtemps, dilue le PageRank. CLAUDE.md annonce "301 Vercel-level" mais c'est faux.
**Fix** : dans `next.config.mjs` ajouter `permanent: true` sur la redirect www, ou dans Vercel Domains cocher "Permanent redirect".

### M7 — Pas d'OG image dédiée par boutique (utilise `/img/shops/tarik.jpg` brut)
**Extrait boutique** : `og:image = https://klikandgo.app/img/shops/tarik.jpg`
**Impact** : 1) image non dimensionnée 1200×630 → Facebook crop moche. 2) pas de call-to-action visuel Klik&Go. 3) CTR social faible.
**Fix** : `app/(client)/boutique/[slug]/opengraph-image.tsx` (Edge runtime) qui compose logo Klik&Go + photo shop + nom + rating.

### M8 — 24 scripts chargés sur homepage, aucun `<noscript>` fallback
**Extrait** : 24 `<script src=...>` chunks Next.
**Impact** : Googlebot exécute JS mais premiers crawls peuvent échouer sur un budget rendering serré. Pas de `<noscript>` = page non-indexable si JS down (certains bots IA non-JS).
**Fix** : `noscript` avec résumé textuel + liens vers les boutiques principales.

### M9 — Pas de breadcrumb visible dans la homepage ni dans `/bons-plans` (seulement city/boutique)
**Impact** : maillage interne faible, pas de fil d'ariane visible = UX + SEO local dégradé.
**Fix** : ajouter breadcrumb visible `Accueil > Bons Plans` + BreadcrumbList JSON-LD sur toutes les pages publiques.

---

## 🟡 MINEUR

### Mi1 — `meta keywords` présent
```html
<meta name="keywords" content="boucherie halal,click and collect,viande halal..."/>
```
Ignoré par Google depuis 2009, signal neutre. Pas grave mais inutile — à supprimer pour hygiène.

### Mi2 — Title homepage double "Klik&Go" en début et fin
```
<title>Klik&Go — Click & Collect Boucherie Halal | Commandez en ligne | Klik&Go</title>
```
71 caractères, le deuxième `| Klik&Go` est ajouté par le template et redondant. **Réduire à 60 char** pour éviter troncature SERP.
**Fix** : `<title>Boucheries halal en click & collect à Chambéry, Grenoble, Lyon</title>` + template `%s | Klik&Go` uniquement sur pages enfants.

### Mi3 — Alt text d'images = nom seul du shop
`alt="Boucherie Tarik"` → OK mais ajoutez la ville : `alt="Boucherie Tarik — boucherie halal à Chambéry"` booste le image search SEO local.

### Mi4 — Aucun lien entre boutique et sa ville SEO
La page `/boutique/boucherie-tarik` ne linke PAS vers `/boucherie-halal/chambery`. Maillage sémantique absent.
**Fix** : dans le bloc adresse, wrap la ville dans un `<Link href="/boucherie-halal/chambery">`.

### Mi5 — Homepage : bloc `fetchPriority="low"` sur webpack preload script
```
<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-...">
```
`fetchPriority="low"` sur le webpack runtime est contre-productif (ce chunk est critique pour hydration). Laissez Next.js gérer, ne pas l'overrider.

### Mi6 — Font woff2 preload mais pas `font-display: swap`
3 fonts preloaded. Vérifier que le CSS contient bien `font-display: swap` sinon FOIT sur 3G.

### Mi7 — `/recettes` : 49 URLs sans titre descriptif mentionnant "halal" parfois
Certains slugs sont très longs (ex. `cotelettes-d-agneau-halal-grillees-aux-herbes-mediterraneennes-et-marinade-printaniere`) — OK pour SEO mais à vérifier côté lisibilité SERP. Le caractère `b-uf` (=bœuf) dans les slugs est un fail d'encodage → perte de correspondance avec la requête "recette bœuf halal".
**Fix** : slugifier `bœuf` → `boeuf` (pas `b-uf`).

### Mi8 — Pas de Plausible détecté dans le HTML home
Grep `plausible` sur `/tmp/home.html` → 0 match. Le tracking analytique n'est pas actif en prod, donc pas de data pour mesurer les conversions SEO.

### Mi9 — `priceRange: "€€"` générique sur toutes les boutiques
Non-signifiant pour Google (veut un priceRange réel ou une fourchette précise par produit).

### Mi10 — Pas d'`openingHoursSpecification` dans le Store JSON-LD
Pour un click & collect, c'est **crucial** pour le local pack Google Maps.
**Fix** :
```json
"openingHoursSpecification": [{
  "@type": "OpeningHoursSpecification",
  "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
  "opens": "08:00", "closes": "19:30"
}]
```

### Mi11 — Pas de `geo` (latitude/longitude) dans le Store JSON-LD
Crucial aussi pour local SEO. Les boucheries ont des adresses mais pas de coordonnées.

### Mi12 — `telephone: "04 79 XX XX XX"` en dur
Deux boutiques ont leur téléphone masqué `XX XX XX` dans le JSON-LD (Boucherie du Sud, Halles Savoyardes). Incohérent pour le rich result.

### Mi13 — Incohérence OG image route
- Homepage/city : `/og-image.png` (PNG statique)
- Bons-plans : `/opengraph-image?16edc151550a9c82` (Edge route)
Choisir un standard. `opengraph-image.tsx` Edge est préférable (dynamique).

### Mi14 — CSP autorise `'unsafe-inline'` et `'unsafe-eval'` sur scripts
Signal de sécurité faible. Google n'en tient pas compte pour SEO mais sécu audit Lighthouse pénalise.

---

## TOP 10 actions prioritaires (ROI SEO décroissant)

| # | Action | Effort | Gain estimé |
|---|---|---|---|
| 1 | **Réactiver l'ISR homepage** — supprimer le `private, no-cache, no-store` : isoler les appels Clerk hors du `(client)/layout.tsx` public, ou rendre la homepage totalement statique avec révalidation 60 s | 2-4h | +30-50 % CWV, TTFB ÷3, crawl budget récupéré |
| 2 | **Ajouter un `<h1>` unique** sur homepage + 6 city pages + bons-plans (contenant les mots-clés cibles "boucherie halal + ville + click & collect") | 30 min | +10-15 % pertinence queries villes |
| 3 | **Ajouter `ProductSchema` sur les pages boutique** pour les 20 premiers produits (avec price, availability, halal dans category) + réduire la page à 150 KB | 3h | Rich results prix/stock dans SERP, +20 % CTR |
| 4 | **Créer `/contact`, `/a-propos`, `/cgu`, `/politique-de-confidentialite`** (signaux E-E-A-T + RGPD + légal) | 2h | Débloque la confiance Google + conformité légale |
| 5 | **Ajouter `og:image` sur homepage** (meta tag manquant dans le head) + opengraph-image dynamique par boutique | 1-2h | +30-50 % CTR partages sociaux |
| 6 | **Enrichir le JSON-LD homepage** : WebSite + SearchAction + ItemList des boutiques | 30 min | Sitelinks searchbox + carousel rich result |
| 7 | **Convertir la redirect www → apex en 301** (actuellement 307) | 5 min | Consolidation PageRank propre |
| 8 | **Créer des pages produits SEO indexables** `/boutique/[slug]/p/[product-slug]` avec leur propre metadata + ProductSchema — sitemap à étendre à plusieurs centaines d'URLs | 1-2 j | Capture longue traîne "epaule agneau halal chambéry 500g" — potentiel +200-400 % trafic organique à 3 mois |
| 9 | **Réduire page 404 à < 10 KB** : layout minimal sans header/footer lourd | 30 min | Économie crawl budget Googlebot |
| 10 | **Ajouter `openingHoursSpecification` + `geo` dans Store JSON-LD** | 1h | Local pack Maps + rich snippets horaires |

---

## Annexe — Commandes utilisées

```bash
curl -s -w "TIME:%{time_total}|SIZE:%{size_download}|CODE:%{http_code}|TTFB:%{time_starttransfer}\n" https://klikandgo.app/
curl -s https://klikandgo.app/sitemap.xml | grep -c '<url>'
curl -s https://klikandgo.app/robots.txt
curl -sI https://klikandgo.app/ | grep -iE 'cache-control|x-vercel-cache'
```

## Annexe — Fichiers sources à modifier (liste non exhaustive)

- `src/app/(client)/page.tsx` — ajouter h1, ISR, enrichir metadata/JSON-LD
- `src/app/(client)/layout.tsx` — isoler Clerk pour débloquer ISR
- `src/app/(client)/boucherie-halal/[ville]/page.tsx` — ajouter h1 principal
- `src/app/(client)/bons-plans/page.tsx` — ajouter h1 + metadata description
- `src/app/(client)/boutique/[slug]/page.tsx` — ajouter ProductSchema, alléger RSC
- `src/components/seo/ProductSchema.tsx` — vérifier qu'il est bien monté
- `src/app/sitemap.ts` — ajouter produits, utiliser updatedAt réel
- `src/app/not-found.tsx` — créer version légère
- `next.config.mjs` — forcer 301 sur www
- `src/app/(client)/opengraph-image.tsx` — ajouter à boutique/[slug]
- Nouvelles pages : `/contact`, `/a-propos`, `/cgu`, `/politique-de-confidentialite`
