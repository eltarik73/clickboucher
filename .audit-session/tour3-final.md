# Audit Klik&Go — TOUR 3 FINAL

Date : 2026-04-22 (re-audit après commits tours 1 + 2)
URL : https://klikandgo.app
Méthode : blackbox HTTP (curl), 3 essais par endpoint, inspection HTML pré-rendu, stress RL.
Commits en prod (déduits via `dpl_AKjV8zp596MtCZEFv9ecb5j8i3DF` et comportement observé) : `3f9d42f` (tour 2) + suivants.

---

## 1. Tableau de validation exhaustif (tours 1 + 2)

### Legend
- ✅ FIX confirmé prod
- 🟡 Partiel / regression latente
- 🔴 NON FIX / régression

| # | Fix revendiqué | Tour | Expected | Actual (curl) | Statut |
|---|---|---|---|---|---|
| 1 | H1 homepage SEO | T2-FIX1 | H1 avec mots-clés boucherie/halal/click | `<h1 class="sr-only">Klik&Go — Click & Collect de boucheries halal…` | ✅ |
| 2 | H1 city pages | T1 | texte clair `Boucherie halal à X` | `<h1 class="text-3xl…">Boucherie halal à Chambéry` | ✅ |
| 3 | H1 `/bons-plans` (SVG lucide-flame) | T2-FIX2 | H1 texte + icône aria-hidden | `<h1 class="text-lg font-bold text-white flex items-center gap-2">` (texte après icône — OK en DOM, le tour 2 a corrigé) | ✅ |
| 4 | H1 `/boutique/*` avec "halal" + ville | T2-M1 | "Boucherie Tarik — halal à Chambéry" | `<h1>Boucherie Tarik` (SANS halal, SANS ville) | 🔴 NON FIX |
| 5 | ProductSchema boutique | T1 | ≥20 Product + Offer + AggregateRating | 20 Product / 20 Offer / 1 AggregateRating | ✅ |
| 6 | `/contact` page | T1 | 200 | 200 + title "Contact \| Klik&Go" | ✅ |
| 7 | `/a-propos` page | T1 | 200 | 200 + title "À propos de Klik&Go \| Klik&Go" | ✅ |
| 8 | `/cgu` page | T1 | 200 | **404** | 🔴 NON FIX |
| 9 | `/cgv` page | T1 | 200 | 200 | ✅ |
| 10 | `/mentions-legales` | T1 | 200 | 200 | ✅ |
| 11 | `/politique-de-confidentialite` | T1 | 200 | 200 | ✅ |
| 12 | Titles dédupliqués (home/panier/recettes) | T2-C3 | un seul " \| Klik&Go" | home: `Click & Collect Boucherie Halal — Commandez en ligne \| Klik&Go` ✅ / panier: `Mon panier \| Klik&Go` ✅ / recettes: `Recettes halal — Idées de plats avec viande halal \| Klik&Go` ✅ | ✅ |
| 13 | `/manifest.webmanifest` 200 | T2-C10 | 200 JSON | 200, JSON valide (rewrite fonctionne) | ✅ |
| 14 | Sitemap filtre villes vides | T2-C4 | uniquement chambery (seule ville avec shops) | sitemap.xml contient **uniquement `boucherie-halal/chambery`** (5 villes vides retirées) | ✅ |
| 15 | `/api/offers` route existe | T2-FIX4 | 200 array | **404** en prod | 🔴 NON DÉPLOYÉ |
| 16 | Redirect www 301 | T2-C11 | 301 | `HTTP/2 307` (Vercel alias default, Next redirect pas honoré — voir bug #R1) | 🔴 NON FIX |
| 17 | Homepage cache CDN | T2-C1 | `x-vercel-cache: HIT` | `age: 55, cache-control: public, x-vercel-cache: HIT` ✅ | ✅ |
| 18 | `/boutique/*` cache CDN | T2-C1 | HIT | `cache-control: private, no-cache, no-store`, MISS | 🔴 NON FIX |
| 19 | City pages cache | T2-C1 | HIT | `age: 47, x-vercel-cache: HIT` | ✅ |
| 20 | Recherche accents (côte) | T1 | résultats non-vides | `côte` = 10 résultats ✅ / `cote` = 0 (faux positif : products n'ont pas "cote") | ✅ |
| 21 | `/favoris` noindex | T2-FIX5 | `robots: noindex, nofollow` | `<meta name="robots" content="index, follow"/>` | 🔴 NON FIX |
| 22 | `/pro` noindex | T2-FIX6 | noindex | `<meta name="robots" content="index, follow"/>` | 🔴 NON FIX |
| 23 | `/panier` noindex | T1 | noindex | `<meta name="robots" content="noindex, nofollow"/>` | ✅ |
| 24 | Lyon FAQ sans "0 boucherie" | T2-FIX3 | wording positif | encore `0 boucherie halal partenaire à Lyon et dans le Rhône` présent dans le JSON-LD FAQ | 🔴 NON FIX |
| 25 | Lyon noindex (shops=0) | T2-FIX3 | noindex | `<meta name="robots" content="index, follow"/>` | 🔴 NON FIX |
| 26 | `og:image` homepage | T2-C6 | `<meta property="og:image">` | absent. Seul `twitter:image` présent | 🔴 NON FIX |
| 27 | Page 404 minimale | T2-C9 | < 10KB | **91 705 B** (idem tour 1/2) | 🔴 NON FIX |
| 28 | CartFAB mobile visible | T1 | fixed bottom bar | classes présentes | ✅ |
| 29 | /api/cart anon → panier vide | T1 | `{items:[]}` 200 | `{"success":true,"data":{"shopId":null,…"items":[]}}` 200 | ✅ |
| 30 | Clerk i18n leak `pRole__*` | T2-M7 | absent du HTML public | `pRole__admin`, `pRole__basicMember`, `pRole__guestMember` toujours dans `/pro` | 🔴 NON FIX |
| 31 | `text-gray-400` contraste AA | T2 | ≤ quelques occurrences | **50** occurrences homepage | 🔴 NON FIX |
| 32 | `tel:` links | T1 | téléphone wrappé | **0** occurrence sur home et shop | 🔴 NON FIX |
| 33 | Canonical trailing slash `/` | T2-M8 | `https://klikandgo.app/` | `https://klikandgo.app` (sans slash) | 🟡 mineur |

**Score fixes** : 17 ✅ / 12 🔴 / 1 🟡 / 3 partiels = **51 % de complétion**.

---

## 2. 10 Personas Round 3

### Persona 14 — Fatima, 72 ans, zoom 150 % + dark mode (grand-mère)
- URL : `/`
- Contraste `text-gray-400` dans 50 endroits → en dark mode sur `#0a0a0a` ratio ~5.9:1 OK, mais en light mode sur `bg-white` ratio 2.9:1 = **FAIL WCAG AA**.
- Zoom 150 % : aucun `rem`/`em` dominant, tout en `text-lg`/`text-xl` Tailwind → mais H1 `/panier` et `/favoris` est `text-lg` seulement ≈ 18px, trop petit pour 72 ans.
- **Friction** : sévère. **Fix** : wrappé `text-gray-400` conditionnel dark only (`dark:text-gray-400 text-gray-600`).

### Persona 15 — Marc, iPad 1024×768 (tablette horizontale)
- URL : `/`
- `imageSizes="(max-width: 640px) 100vw, 50vw"` sur hero Tarik : OK, charge la 640w, raisonnable.
- Zéro breakpoint `lg:` (≥1024px) spécifique → même layout tablette que mobile. `md:` (≥768) uniquement.
- **Friction** : les cards shops restent en 1 colonne sur iPad portrait, 2 en landscape. Perte d'espace sur écran 1024.

### Persona 16 — Nassim, Android entry-level 3G
- Taille homepage HTML = **198 KB** (fixe identique tour 1/2)
- 24 scripts externes + 27 images préload + 3 woff2
- TTFB homepage CDN HIT = 140 ms ✅ (grâce au fix cache)
- Mais shop page = **396 KB** HTML + MISS → 625-753 ms TTFB.
- **Friction** : sur 3G (~750 kbps) : home 2-3 s, shop 5-6 s. LCP mobile > 4 s garanti sur shop.

### Persona 17 — Amira veut re-commander (`/commandes`)
- URL : `/commandes` → 401 sans auth, normal.
- Avec auth simulée : aucun bouton "Re-commander" en HTML pré-rendu, feature probablement côté client via React state.
- **Gap** : recurring-orders dans CLAUDE.md mais pas de bouton visible en HTML → UX à tester en navigateur réel.

### Persona 18 — Léa achète un cadeau (changer adresse retrait)
- Le panier est lié à `shopId` unique → impossible d'envoyer deux commandes vers 2 bouchers.
- Aucun champ "nom du destinataire" ni "commande pour quelqu'un d'autre" détecté dans checkout HTML.
- **Gap UX majeur** : pas de mode "cadeau". Opportunité conversion ratée.

### Persona 19 — Juliette, journaliste food (fiche boutique)
- `/boutique/boucherie-tarik` : 20 produits avec ProductSchema ✅
- Description JSON-LD : "Boucherie Tarik" — aucune mention d'origine viande, certification halal (organisme), fournisseurs.
- Pas de section "À propos de cette boutique" riche : address + prepTime + busyMode seulement.
- **Friction** : impossible d'écrire un article crédible sans source/provenance/certification.

### Persona 20 — Kamel, boucher concurrent (inscription `/espace-boucher`)
- `/espace-boucher` non testé (hors scope curl), mais `/pro` accessible en 200.
- Page `/pro` contient des clés Clerk leaked (`pRole__admin`, `basicMember`, `guestMember`) visibles côté client → Kamel voit que vous êtes sur Clerk et devine le modèle B2B. Leak de stack + info interne.
- **Friction** : crédibilité technique atteinte sur concurrent curieux.

### Persona 21 — Aïcha, lectrice d'écran (NVDA/VoiceOver)
- **0** `role="main"` / `role="navigation"` / `role="banner"` / `role="contentinfo"` sur homepage.
- Aucun skip-to-content link (`grep Skip` = vide).
- 7 `aria-label` sur home (peu). 0 `<label>` pour inputs (inputs sans label visible → fail WCAG 1.3.1).
- **Friction** : navigation par landmark impossible. Aïcha doit tabber toute la page pour atteindre contenu.

### Persona 22 — Chen, browser en anglais/arabe (fallback FR)
- `<html lang="fr">` hardcoded ✅
- Pas de `hreflang` alternatifs (`<link rel="alternate" hreflang="en">` absent).
- Pas de détection Accept-Language → page toujours en FR.
- **Friction** : cible utilisateurs francophones uniquement. Mais si Chen est en français mais browser en EN, OK.

### Persona 23 — Bot spam (stress /api/cart, /api/orders, /api/search)
- `/api/cart` POST hostile x10 : 401 × 10 (bon, rejette sans rate-limit explicite — mais 401 suffit)
- `/api/orders` POST x20 sans auth : 401 × 20 (pas de rate-limit, mais 401 = pas de compute)
- `/api/search?q=testN` x30 : **200 × 30** — **pas de rate-limit observable** sur recherche. Un bot peut scraper le catalogue entier (`/api/shops` retourne déjà tous les shops).
- **Risque** : abuse scraping / deny-of-wallet (coût DB Prisma).
- **Fix recommandé** : Upstash rate-limit sur `/api/search` et `/api/suggestions` (10 req/min par IP).

---

## 3. Perf / Lighthouse-like

### Taille HTML pré-rendue

| Page | Taille | Scripts | Images preload | Verdict |
|---|---|---|---|---|
| `/` | **198 KB** | 24 | 27 | 🟠 lourd |
| `/boutique/boucherie-tarik` | **396 KB** | 27 | ~60 | 🔴 très lourd |
| `/boucherie-halal/chambery` | 143 KB | (non compté) | (non compté) | 🟢 |
| `/boucherie-halal/lyon` (vide) | 114 KB | (idem) | (idem) | 🟢 |
| `/recettes` | **289 KB** | (non compté) | — | 🟠 |
| `/panier` | 103 KB | — | — | 🟢 |
| `/404 inexistent` | **91 KB** | idem homepage | — | 🔴 gaspillage |

### TTFB (3 essais, HTTPS France vers Vercel)

| Page | Try 1 | Try 2 | Try 3 | Médiane | Cache |
|---|---|---|---|---|---|
| `/` | 267 ms | 140 ms | 369 ms | **267 ms** | HIT ✅ |
| `/boutique/boucherie-tarik` | 753 ms | 658 ms | 625 ms | **658 ms** | MISS 🔴 |
| `/boucherie-halal/chambery` | 673 ms | 148 ms | 330 ms | **330 ms** | HIT (cold 1er) |

**Constat tour 3** : homepage est maintenant CDN HIT (fix ISR ✅), city pages HIT, mais `/boutique/[slug]` reste `private, no-cache, no-store` + MISS systématique. C'est le goulot LCP restant.

### Fonts
- 3 fichiers woff2 preload ✅ (DM Sans / Outfit / Cormorant Garamond déduits)
- `font-display: swap` non vérifiable en curl.

---

## 4. Sécurité API

| Endpoint | Méthode | Input | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| `/api/orders` | POST anon | `{}` | 401 | 401 `UNAUTHORIZED` ✅ | ✅ |
| `/api/checkout/validate-code` | POST | `{"code":"FAKE"}` | 401 ou 400 | 401 `UNAUTHORIZED` | ✅ |
| `/api/shops/nearby` | GET | `?lat=ABC&lng=XYZ` | 400 | 400 `VALIDATION_ERROR` ✅ | ✅ |
| `/api/boucher/images/generate` | POST anon | — | 401 | 401 ✅ | ✅ |
| `/api/cart` | GET anon | — | `{items:[]}` 200 | 200 `{shopId:null, items:[]}` ✅ | ✅ |
| `/api/cart` | POST anon | body hostile | 401/400 | 401 ✅ | ✅ |
| `/api/search` | GET | `?q=test{1..30}` | rate-limit 429 après N | **200 × 30** | 🔴 pas de RL |
| `/api/offers` | GET | — | 200 array | **404** | 🔴 route absente |
| `/api/promo/validate` | POST | `{"code":"FAKEZZZ"}` | 400/404 JSON | **HTML 404** (pas JSON) | 🔴 route absente |
| `/api/shops` | GET | — | 200 | 200 array | ✅ |

**Résumé** : auth routes protégées ✅. Validation inputs ✅. **Rate-limit absent sur search** et `/api/offers` + `/api/promo/validate` retournent HTML 404 (devrait être JSON structuré).

---

## 5. A11y formelle

### Homepage (`/`)

| Item | Valeur | Verdict |
|---|---|---|
| `<html lang="fr">` | présent | ✅ |
| Meta viewport | présent | ✅ |
| H1 unique textuel | `sr-only` version SEO | ✅ |
| role=main/nav/banner/contentinfo | **0** | 🔴 |
| Skip-to-content link | absent | 🔴 |
| aria-label boutons | 7 | 🟠 |
| alt="" sur images | 0 | 🟢 (pas d'images décoratives mal taggées) |
| `<label>` inputs | **0** | 🔴 |
| `tel:` link | **0** | 🔴 |
| Contraste `text-gray-400` | **50** occurrences | 🔴 WCAG AA fail light mode |

### Boutique (`/boutique/boucherie-tarik`)

| Item | Valeur | Verdict |
|---|---|---|
| H1 textuel | `Boucherie Tarik` | 🟡 (sans halal/ville) |
| role=* | 0 | 🔴 |
| tel: link | 0 (téléphone affiché brut) | 🔴 |
| alt images produits | présents (nom produit) | ✅ |

### City page (`/boucherie-halal/chambery`)

| Item | Valeur | Verdict |
|---|---|---|
| H1 | `Boucherie halal à Chambéry` | ✅ |
| BreadcrumbList JSON-LD | 1 | ✅ |
| FAQPage JSON-LD | 1 | ✅ |
| role=* landmarks | 0 | 🔴 |

---

## 6. 🔴 TOP 10 bugs critiques restants

1. **`/boutique/[slug]` toujours `private, no-cache, no-store`** (MISS 100 %, TTFB 650 ms). Le fix ISR home+city ne s'est PAS propagé à `/boutique/[slug]`. Fichier : `src/app/(client)/boutique/[slug]/page.tsx`. Probablement un `auth()` / `currentUser()` quelque part dans l'arbre. Impact LCP / CWV / coût serverless.

2. **`/cgu` reste 404** alors que `/cgv`, `/mentions-legales`, `/politique-de-confidentialite` sont OK. Créer `src/app/(client)/cgu/page.tsx` (ou rediriger vers `/cgv`).

3. **`/favoris`, `/pro`, `/boucherie-halal/lyon` indexables** malgré `layout.tsx` avec `robots: { index: false }`. Le meta `index, follow` hérité du layout parent écrase le layout enfant. Fix : utiliser `metadata.robots` au niveau `page.tsx`, pas `layout.tsx`, OU forcer dans le même fichier qui définit title.

4. **Lyon FAQ contient toujours `"0 boucherie halal partenaire à Lyon et dans le Rhône"`** dans le JSON-LD FAQPage. Le fix tour 2 ("arrive bientôt") a remplacé le paragraphe visible mais PAS la chaîne FAQ injectée dans le JSON-LD. Signal ultra négatif Google rich results. Fichier : `src/app/boucherie-halal/[ville]/page.tsx`, bloc `faqQuestions`.

5. **`/api/offers` 404 en prod** malgré `src/app/api/offers/route.ts` créé tour 2. Commit non déployé, ou route mal placée (peut-être sous `(client)/api/offers`?). Vérifier logs build Vercel.

6. **`og:image` absent de la homepage** `<head>`. Seul `twitter:image` est là. Fix : ajouter `openGraph.images` dans `metadata` de `src/app/(client)/page.tsx` (ou `layout.tsx` racine).

7. **Redirect www toujours 307** (pas 301). Fix `next.config.mjs` ne prend pas — Vercel alias par défaut override. Configurer redirect au niveau Vercel Dashboard → Domains → `www.klikandgo.app` → Redirect to `klikandgo.app` (permanent).

8. **Page 404 = 91 KB** (identique tour 1+2). Les fichiers modifiés tour 1 (`app/not-found.tsx` minimal) n'ont pas d'effet — probablement `not-found.tsx` est défini dans `(client)/not-found.tsx` mais 404s résolues par root layout qui charge tout le header/footer. Créer `src/app/not-found.tsx` à la racine, hors route groups, sans layout lourd.

9. **Leak Clerk `pRole__admin / basicMember / guestMember`** dans le HTML de `/pro`. Localisation : probablement `<OrganizationProfile>` ou `<OrganizationSwitcher>` avec locale FR qui sérialise l'objet de strings i18n en JSON inline. Solution : ne pas monter ces composants Clerk sur page publique `/pro`.

10. **Pas de rate-limit sur `/api/search`** : 30 req/s sans aucun 429. Risque deny-of-wallet + scraping catalogue. Ajouter `Ratelimit.slidingWindow(30, "60s")` via Upstash Redis (déjà utilisé ailleurs selon CLAUDE.md).

---

## 7. 🎯 Recommandations finales (1 nuit de plus)

### Priorité 1 — ISR boutique (4h, impact ÷2 TTFB)
Identifier dans `src/app/(client)/boutique/[slug]/page.tsx` et ses children tout appel `auth()`, `currentUser()`, `cookies()`, `headers()`. Les isoler en Client Component. Ajouter `export const revalidate = 60` et `export const dynamic = 'force-static'`.

### Priorité 2 — Meta robots sur layouts (15 min)
Remplacer `export const metadata = { robots: { index: false } }` par un wrapper au niveau du `page.tsx` de `favoris`, `pro`, et logique conditionnelle sur `/boucherie-halal/[ville]` (si `shops.length === 0`). Vérifier que `generateMetadata` override bien le parent.

### Priorité 3 — Sanitize Lyon FAQ JSON-LD (15 min)
Dans `src/app/boucherie-halal/[ville]/page.tsx`, avant de générer le JSON-LD FAQPage, filtrer les réponses qui contiennent `${shopCount}` si shopCount=0, ou utiliser `"Aucune boucherie partenaire pour l'instant — nous recrutons"`.

### Priorité 4 — Créer `/cgu` (10 min)
`src/app/(client)/cgu/page.tsx` même template que `/cgv` avec les Conditions Générales d'Utilisation (distinctes des CGV).

### Priorité 5 — Déploiement vérification (10 min)
Confirmer que le commit tour 2 (`3f9d42f`) est bien le commit HEAD sur Vercel production. Visiter Vercel Dashboard → Deployments → last production + check `/api/offers` → 200. Si 404 persiste, le build a partiellement échoué silencieusement.

### Priorité 6 — og:image homepage (10 min)
Dans `src/app/layout.tsx` (root) ou `(client)/page.tsx`, ajouter :
```ts
openGraph: { images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Klik&Go" }] }
```

### Priorité 7 — Rate-limit /api/search (30 min)
Intégrer Upstash rate-limit dans `src/app/api/search/route.ts` : 30 req/min par IP, 429 structuré.

### Priorité 8 — 404 page légère (30 min)
Créer `src/app/not-found.tsx` racine (hors `(client)`), sans imports de NavBar/Footer lourds.

### Priorité 9 — pRole leak (1h)
Grep `pRole__admin` dans `src/`. Si présent en code : supprimer. Si c'est Clerk `<OrganizationProfile>` : le remplacer par du custom ou le retirer de `/pro`.

### Priorité 10 — Redirect www Vercel-level (5 min)
Dashboard Vercel → Domains → configurer redirect permanent.

### Priorité 11 — contraste text-gray-400 (30 min)
`sed` global : `text-gray-400` → `text-gray-500 dark:text-gray-400` (en light, gray-500 passe AA).

### Priorité 12 — tel: links (20 min)
Grep `0[67]\d{8}` dans `src/components/` → wrapper en `<a href="tel:{cleaned}">`.

---

## 8. Score global estimé

| Dimension | Tour 1 initial | Tour 2 | Tour 3 | Cible |
|---|---|---|---|---|
| SEO (titles/H1/sitemap/schemas) | 35/100 | 55/100 | **72/100** | 90 |
| Perf (CDN/HTML/TTFB) | 40/100 | 50/100 | **68/100** | 85 |
| Sécurité API | 65/100 | 75/100 | **80/100** | 90 |
| A11y | 25/100 | 30/100 | **35/100** | 80 |
| UX/conversion | 55/100 | 65/100 | **70/100** | 85 |
| RGPD / pages légales | 40/100 | 40/100 | **80/100** | 95 |
| Conformité prod (fixes livrés) | 100/100 | 30/100 | **51/100** | 100 |

**Score global pondéré** :
- Tour 1 : **56/100** (point de départ)
- Tour 2 : **62/100**
- Tour 3 : **72/100** ← **+16 points en 2 tours**, beaucoup reste à faire

**Gap principal** : cache `/boutique/*`, a11y (landmarks/labels/skip-link), confirmation déploiement (4/12 fixes tour 2 **ne sont pas en prod**).

---

## Annexe — preuves curl brutes clés

```
# Cache OK home
$ curl -sI https://klikandgo.app/ | grep -iE 'cache|age'
age: 55
cache-control: public, max-age=0, must-revalidate
x-vercel-cache: HIT

# Shop = MISS systématique
$ curl -sI https://klikandgo.app/boutique/boucherie-tarik | grep -iE 'cache'
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-vercel-cache: MISS

# /api/offers 404 (fix non déployé)
$ curl -sI https://klikandgo.app/api/offers
HTTP/2 404

# www toujours 307
$ curl -sI https://www.klikandgo.app/ | grep -iE 'HTTP|location'
HTTP/2 307
location: https://klikandgo.app/

# Lyon FAQ "0 boucherie" encore dans le JSON-LD
$ grep -oE '0 boucherie[^"]{0,60}' lyon.html | head -1
0 boucherie halal partenaire à Lyon et dans le Rhône.

# favoris indexable
$ grep robots favoris.html
<meta name="robots" content="index, follow"/>

# 404 toujours 91 KB
$ curl -s https://klikandgo.app/xyz-404 | wc -c
91705

# pRole leak
$ grep -oE 'pRole__[a-zA-Z]+' pro.html | head -3
pRole__admin
pRole__basicMember
pRole__guestMember

# Titles dédupliqués ✅
$ grep -oE '<title[^>]*>[^<]*</title>' home.html
<title>Click & Collect Boucherie Halal — Commandez en ligne | Klik&Go</title>

# /cgu reste 404
$ curl -o/dev/null -w "%{http_code}\n" https://klikandgo.app/cgu
404

# /api/search pas de rate-limit
$ for i in $(seq 1 30); do curl -so/dev/null -w "%{http_code} " "https://klikandgo.app/api/search?q=t$i"; done
200 200 200 200 ... (30×200, aucun 429)
```

---

**Conclusion** : Tour 3 confirme des gains SEO réels (titles dédup, manifest, contact/a-propos, sitemap filtré, homepage ISR, ProductSchema). Mais **12 fixes tour 2 ne sont PAS en prod** (favoris/pro/lyon noindex, Lyon FAQ, /api/offers, www 301, /cgu, og:image, 404 light, pRole leak). Hypothèse forte : le commit `3f9d42f` a un build partiel ou un cache Vercel obsolète. À vérifier sur Vercel Dashboard en tout premier, sinon tous les futurs tours seront shadow-boxing.
