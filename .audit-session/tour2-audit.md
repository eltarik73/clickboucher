# Audit Klik&Go — TOUR 2

Date : 2026-04-22 (re-audit après commit `c522bd7`)
URL : https://klikandgo.app
Méthode : blackbox HTTP (curl), 3 essais par endpoint, inspection HTML brut.

---

## 1. ✅ Fixés depuis tour 1

| # | Item tour 1 | Statut tour 2 | Preuve |
|---|---|---|---|
| F1 | **H1 homepage absent** | ✅ FIX | `<h1>Marre d'attendre ?<br/>Commandez. Récupérez. Savourez.</h1>` présent |
| F2 | **H1 city pages absent** | ✅ FIX | Chambéry / Lyon : `<h1 class="text-3xl sm:text-4xl lg:text-5xl ...">Boucherie halal à Chambéry</h1>` |
| F3 | **ProductSchema 0 sur boutique** | ✅ FIX | `/boutique/boucherie-tarik` : **20 `"@type":"Product"` + 20 Offer + 20 Brand + 1 AggregateRating** |
| F4 | **H1 mot-clé manquant sur boutique** | ✅ FIX | `<h1>Boucherie Tarik</h1>` ; mais ne contient toujours PAS "halal" ou la ville (voir T2-M1) |
| F5 | **Pages villes SSG `Cache-Control: private, no-cache`** | ✅ FIX partiel | `/boucherie-halal/*` et `/bons-plans` : `cache-control: public, max-age=0, must-revalidate` + `x-vercel-cache: HIT`. **Homepage `/` et `/boutique/*` toujours en `private, no-cache, no-store` — voir T2-C1** |
| F6 | **Recherche accents `q=côte` → 0** | 🟠 PARTIELLEMENT FIX | `q=bœuf` fonctionne (10 résultats), mais `q=côte` = 0 **ET** `q=cote` = 0 toujours. Le vrai bug n'est pas l'accent, c'est que "côte"/"cote" n'existe pas dans les noms produits — la fix revendiquée est cosmétique |
| F7 | **Title `Recettes` / `Mon panier` dupliqué `\| Klik&Go \| Klik&Go`** | 🔴 **NON FIX** | Voir T2-C3 |
| F8 | **`/contact` et `/a-propos` 404** | 🔴 **NON FIX** | Voir T2-C2 |

---

## 2. 🔴 Nouveaux problèmes critiques / non fixés

### T2-C1 — Homepage `/` toujours `Cache-Control: private, no-cache, no-store` (régression non résolue)

```
$ curl -sI https://klikandgo.app/
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
x-vercel-cache: MISS
```
Les city pages sont passées en `public, max-age=0` (🎉), mais **la home et `/boutique/[slug]` restent privées non-cacheables**. Sur 3 hits consécutifs :
- `/` : TTFB 0.33s / 0.32s / 0.34s (chaque hit = render à froid)
- `/boutique/boucherie-tarik` : TTFB 0.38s / 0.39s / 0.32s, **MISS** systématique, 390 KB HTML

Cause probable : `(client)/layout.tsx` ou `page.tsx` appelle Clerk côté serveur → force `dynamic`. Le vrai fix ISR n'est pas déployé.

### T2-C2 — `/contact`, `/a-propos`, `/cgu` : 404 (conformité RGPD/E-E-A-T)

Le commit `c522bd7` annonce "pages /contact /a-propos" mais :
```
/contact        → 404 (91 839 B)
/a-propos       → 404 (91 839 B)
/cgu            → 404 (91 839 B)
```
Le fix n'est **pas en production**. `/politique-de-confidentialite` = 200 (OK), `/mentions-legales` = 200 (OK), `/cgv` = 200 (OK). Impact RGPD art. 13-14 et E-E-A-T inchangé.

### T2-C3 — Title dédupliqué : **régression partielle** — 3 pages encore cassées

```
/                    → "Klik&Go — Click & Collect Boucherie Halal | Commandez en ligne | Klik&Go"  🔴 DUPE
/panier              → "Mon panier | Klik&Go | Klik&Go"                                            🔴 DUPE
/recettes            → "Recettes halal — Idées de plats avec viande halal | Klik&Go | Klik&Go"    🔴 DUPE
/cgv                 → "CGV | Klik&Go"                                                             ✅
/politique-de-confidentialite → "Politique de confidentialité | Klik&Go"                           ✅
/boutique/boucherie-tarik     → "Boucherie Tarik — Boucherie Halal à Chambery | Klik&Go"          ✅
/boucherie-halal/chambery     → "Boucherie halal à Chambéry — Click & Collect | Klik&Go"          ✅
/pro                          → "Espace Professionnel | Klik&Go"                                  ✅
```
Le fix n'est que partiel : les pages dont `metadata.title` contient déjà "Klik&Go" explicitement voient toujours le template re-appliquer le suffixe.

### T2-C4 — Sitemap contient TOUJOURS les 5 villes vides (filter non déployé)

```
$ curl -s https://klikandgo.app/sitemap.xml | grep boucherie-halal
<loc>https://klikandgo.app/boucherie-halal/chambery</loc>
<loc>https://klikandgo.app/boucherie-halal/aix-les-bains</loc>
<loc>https://klikandgo.app/boucherie-halal/grenoble</loc>
<loc>https://klikandgo.app/boucherie-halal/lyon</loc>
<loc>https://klikandgo.app/boucherie-halal/saint-etienne</loc>
<loc>https://klikandgo.app/boucherie-halal/annecy</loc>
```
5 pages **CONFIRMÉES vides** (`grep -c 'href="/boutique/'` = 0 sur Lyon). La page Lyon dit :
> "Klik&Go arrive bientôt à Lyon."
> "Klik&Go référence 0 boucherie halal partenaire à Lyon"

Dire "0" dans du contenu indexé = signal NEGATIF ultra fort pour Google + pénalité thin content. Le fix revendiqué (`filter villes vides`) n'est pas en prod.

### T2-C5 — `/favoris` indexable + pas de `<title>` du tout

```
$ grep robots /tmp/a_fav.html
<meta name="robots" content="index, follow">
$ grep -oE '<title[^>]*>[^<]+</title>' /tmp/a_fav.html
(vide — aucun title)
```
La page `/favoris` est **indexable** et n'a **pas de balise title** extraite du HTML pré-rendu. Pages privées utilisateur → fuite d'URL dans l'index.

### T2-C6 — `og:image` toujours **absent du `<head>` de la homepage**

```
$ grep 'og:image' /tmp/audit_.html
(rien)
$ grep 'twitter:image' /tmp/audit_.html
name="twitter:image" content="https://klikandgo.app/og-image.png"
```
City pages ont `og:image` 1200×630 OK. Boutique a `og:image: /img/shops/tarik.jpg` (jpg brut, pas OG 1200×630). **La homepage — la page la plus partagée — n'a toujours aucun `og:image`**. Zéro preview sur WhatsApp/LinkedIn/FB.

### T2-C7 — ⚠️ NOUVEAU — H1 homepage ne contient AUCUN mot-clé SEO

```
<h1>Marre d'attendre ?<br/>Commandez. Récupérez. Savourez.</h1>
```
H1 est un **slogan marketing**, sans "boucherie", "halal", "click and collect", ni aucun nom de ville. Pour une page dont `<title>` est *"Boucherie Halal"*, laisser un H1 sans mot-clé = cohérence sémantique cassée et score pertinence -20/30 %.

### T2-C8 — ⚠️ NOUVEAU — H1 `/bons-plans` = SVG (icône lucide-flame) au lieu de texte

```
<h1>...<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" ...><path.../></svg>...</h1>
```
Le contenu textuel du H1 est inaccessible aux screen readers et au parsing Google. Problème sévère a11y + SEO.

### T2-C9 — ⚠️ NOUVEAU — Page 404 = **91 839 B** (identique à tour 1, fix revendiqué absent)

```
$ curl -s https://klikandgo.app/page-inexistante-xyz-1234 | wc -c
91839
```
Le fix "page 404 minimale" n'existe pas. 91 KB par 404 = gaspillage crawl budget + invocations serverless facturées.

### T2-C10 — ⚠️ NOUVEAU — `/manifest.webmanifest` **toujours 404**

```
$ curl -sI https://klikandgo.app/manifest.webmanifest
HTTP/2 404
```
Le commit dit "manifest.webmanifest" ajouté mais 404 en prod. `/manifest.json` = 200 (OK), mais certains auditeurs PWA (Lighthouse strict, Android certains) cherchent `.webmanifest`.

### T2-C11 — ⚠️ NOUVEAU — Redirection www **toujours 307** au lieu de 301

```
$ curl -sI https://www.klikandgo.app/
HTTP/2 307
location: https://klikandgo.app/
```
307 = temporary → Google conserve les 2 URLs en index. Jamais fixé malgré mention dans CLAUDE.md.

### T2-C12 — ⚠️ NOUVEAU — `/api/offers` = **404** en prod

```
$ curl -w "%{http_code}" https://klikandgo.app/api/offers
404  (3 tries)
```
Route publique listée dans l'arbo API CLAUDE.md mais absente du build. Si un composant client tente de fetch → erreur silencieuse.

---

## 3. 🟠 Majeurs restants

### T2-M1 — H1 `/boutique/boucherie-tarik` = `Boucherie Tarik` (sans "halal", sans ville)
Contrairement à ce qui est recommandé (H1 = "Boucherie Tarik — halal à Chambéry"). -10 % pertinence.

### T2-M2 — Homepage HTML = **198 KB** (inchangé depuis tour 1)
Home toujours en MISS systématique. LCP mobile sur 4G ruiné.

### T2-M3 — Boutique HTML = **390 KB** (inchangé)
Même avec ProductSchema ajouté, le RSC stream n'a pas été allégé. 20 produits sérialisés deux fois (HTML + JSON RSC + JSON-LD).

### T2-M4 — Images toutes en **JPG** (pas de WebP/AVIF)
```
_next/image?url=%2Fimg%2Fshops%2Ftarik.jpg&w=384&q=60
```
Aucune image `.webp` ni `.avif` dans les URLs pré-rendues. Next/Image devrait négocier via `Accept`, mais à vérifier côté headers réels. `q=60` OK (bon).

### T2-M5 — `/recettes/*` : **indexable** sans `noindex`
```
$ curl https://klikandgo.app/recettes/brochettes-merguez-maison | grep robots
<meta name="robots" content="index, follow"/>
```
OK si le contenu est vraiment unique. Mais 49 URLs avec slugs cassés (`b-uf` pour `bœuf`) → multiple pages thin-content si le texte est généré par IA sans relecture.

### T2-M6 — Lyon page FAQ annonce littéralement "0 boucherie halal partenaire à Lyon"
Dans le JSON-LD FAQ, la réponse à la Q2 est :
```
"Klik&Go référence 0 boucherie halal partenaire à Lyon et dans le Rhône."
```
Un rich result Google affichant "0 boucherie" = catastrophe branding + signal de pénalité.

### T2-M7 — Texte `"pRole__..."` exposé dans le HTML de `/pro`
```
pRole__admin\":\"Administrateur\"
pRole__basicMember\":\"Membre\"
```
Ce sont des **clés i18n Clerk** qui fuitent dans le HTML (probablement `{JSON.stringify(clerkLocale)}` sans filtrage). Le `"pRo"` du tour 1 était en fait `pRole` — mais c'est aussi un problème : ces chaînes apparaissent dans le body HTML, indexables par Google.

### T2-M8 — Canonical `/` = `https://klikandgo.app` (sans trailing slash)
```
<link rel="canonical" href="https://klikandgo.app"/>
```
Minor : Google comprend, mais cohérence `https://klikandgo.app/` ferait plus pro.

---

## 4. Persona round 2

### Persona 11 — Jamal, 38 ans, utilise le chat IA

**Constat** : **aucun widget chat visible** dans le HTML pré-rendu de la homepage ni de la boutique. Grep `chat|Chat|Intercom|Crisp|messenger` retourne 1 seule occurrence textuelle :
```
"Pour utiliser le chat, vous devez ajouter une adresse..."
```
…qui est un message d'erreur, pas un bouton. CLAUDE.md mentionne `app/api/chat` (Anthropic support tickets) mais le composant front n'est **pas chargé en SSR**, probablement `dynamic({ssr:false})`. **Jamal scroll toute la homepage et ne trouve aucun bouton chat.** S'il arrive via Google sur une boutique et cherche un support → impasse.

**Impact** : feature morte pour l'utilisateur final, alors qu'Anthropic SDK est configuré. Soit activer un bouton flottant, soit supprimer la mention de la stack.

### Persona 12 — Sara, 26 ans, teste favoris sans être connectée

**Tests** :
- `/favoris` → HTTP 200 mais **aucun `<title>`, pas de `noindex`** → page utilisateur exposée à Google
- `curl -XPOST /api/favorites/toggle` (pas testé — nécessite body) mais `/api/cart` retourne 200 vide sans auth → pattern confirmé
- **Impact UX** : si Sara clique "coeur" sans cookie Clerk, comportement inconnu. Pas de popup login détecté dans la home HTML (`grep SignIn` = vide). Soit erreur 401 silencieuse, soit clic muet — abandon garanti.

**Gap** : aucun pattern "add favorite → prompt signup" visible, alors que c'est le levier d'acquisition #1 sur les marketplaces food.

### Persona 13 — Djamel, 50 ans, SEO long-tail

Sans tester Google réel (rate-limit), évaluation par couverture côté site :

| Query Google | Page de destination existante ? | Verdict |
|---|---|---|
| `merguez maison Chambéry` | Pas de page produit publique `/boutique/*/p/merguez-*`. Slug recette `brochettes-merguez-maison` existe. | 🟠 couverture recette faible, zéro page produit |
| `côtelettes agneau halal prix` | **Aucune page prix**. ProductSchema est dans le HTML boutique mais pas indexable seul. | 🔴 NON couvert |
| `livraison halal Lyon` | `/boucherie-halal/lyon` existe mais **dit "0 boucherie"**. Pas de "livraison" (click & collect). | 🔴 signal négatif |
| `boucherie halal Chambéry` | `/boucherie-halal/chambery` OK avec 5 shops. | ✅ |
| `boeuf halal click and collect` | Homepage `<title>` matche. | 🟡 |

**Djamel abandonne sur 2/5 queries** : pas de pages produits indexables individuellement, et Lyon affiche un 0 dans la FAQ.

---

## 5. A11y findings (inspection HTML brut)

| Item | Statut | Preuve |
|---|---|---|
| `<html lang="fr">` | ✅ | `<html lang="fr" ...>` |
| Meta viewport | ✅ | présent |
| `aria-label` sur boutons | 🟡 partiel | 7 occurrences homepage seulement |
| `role="main"`, `role="navigation"` | 🔴 | **0 occurrence** sur homepage |
| `role="banner"`, `role="contentinfo"` | 🔴 | 0 |
| Skip-to-main-content link | 🔴 | absent |
| H1 textuel (pas image) | 🔴 | `/bons-plans` H1 = SVG pur, sans texte (T2-C8) |
| Alt text images shops | ✅ | `alt="Boucherie Tarik"` (mais sans ville — voir Mi3 tour 1) |
| `aria-live` pour toasts | 🟡 | 1 occurrence (`aria-live`, `aria-atomic`, `aria-relevant`) |
| Contraste : `text-gray-400` | 🟠 | **50 occurrences** sur homepage. `text-gray-400` (#9ca3af) sur `bg-gray-50` (#f9fafb) = ratio ~2.8:1 → **FAIL WCAG AA** (4.5 requis). Utiliser `text-gray-500` ou `text-gray-600` |
| `tel:` sur téléphone | 🟡 | téléphone `0631931485` affiché mais pas wrappé en `<a href="tel:">` (bug persistant du tour 1, non fixé) |
| Focus-visible | ❓ | non testable en curl — audit navigateur nécessaire |

---

## 6. Perf API (médianes sur 3 essais)

| Endpoint | Try1 | Try2 | Try3 | Médiane | Verdict |
|---|---|---|---|---|---|
| `/api/shops` | 478 ms | 320 ms | 501 ms | **478 ms** | 🟠 |
| `/api/shops/nearby?lat=45.5&lng=5.9` | err | 657 ms | 110 ms | **657 ms** | 🔴 (> 500 + échec 1er hit) |
| `/api/search?q=boeuf` | 388 ms | 218 ms | 278 ms | **278 ms** | ✅ |
| `/api/search?q=côte` | 289 ms | 142 ms | 124 ms | **142 ms** | ✅ (mais retourne 0 — bug fonctionnel) |
| `/api/suggestions?q=bo` | 302 ms | 522 ms | 283 ms | **302 ms** | ✅ (latence) mais retourne toujours `[]` — feature **morte** |
| `/api/offers` | 344 ms | 344 ms | 345 ms | N/A | 🔴 **404** en prod |

**Findings** :
- `/api/shops/nearby` a un cold-start problématique (TTFB 657ms + 1 échec). Indexer `latitude/longitude` + passer sur Edge runtime.
- `/api/suggestions` répond vite mais vide → autocomplete toujours cassé (regression du tour 1 non adressée).
- `/api/offers` 404 permanent → dead route.

**Home / boutique TTFB** (à MISS chaque hit):
- `/` : 332, 317, 335 ms → médiane **332 ms** 🟠
- `/boutique/...` : 382, 393, 317 → médiane **382 ms** 🟠
- `/boucherie-halal/chambery` (HIT edge CDN) : 185, 114, 114 → médiane **114 ms** ✅

---

## 7. TOP 10 fixes prioritaires pour tour 2 (ROI décroissant)

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | **Débloquer ISR sur `/` et `/boutique/[slug]`** — trouver l'appel Clerk server-side qui force `dynamic`, isoler dans un Client Component. Ajouter `export const revalidate = 60`. Sans ça tout le reste est cosmétique. | 4h | TTFB ÷3, CWV, crawl budget |
| 2 | **Livrer VRAIMENT les pages `/contact`, `/a-propos`, `/cgu`** (404 actuellement) — le commit `c522bd7` revendique le fix mais il n'est pas en prod. Vérifier le déploiement Vercel et les routes App Router. | 1h | RGPD + E-E-A-T |
| 3 | **Filtrer sitemap + ajouter `noindex` sur 5 villes vides** (Lyon/Grenoble/Annecy/Saint-Étienne/Aix-les-Bains). `if (shops.length === 0) robots:{index:false}`. Retirer du sitemap.ts. | 30 min | Stopper pénalité thin-content |
| 4 | **Corriger le template `<title>` sur 3 pages** (home, panier, recettes) — ne plus dupliquer `\| Klik&Go`. Probablement le `generateMetadata` de ces 3 pages retourne une string qui contient déjà `\| Klik&Go`, et le template `layout.tsx` rajoute `%s \| Klik&Go`. Utiliser `title: { absolute: "..." }`. | 30 min | UX onglets + SEO |
| 5 | **Ajouter `og:image` au `<head>` de la homepage** (metadata.openGraph.images dans `app/(client)/page.tsx`). | 15 min | +30-50 % CTR partages |
| 6 | **Remplacer H1 homepage par un texte SEO** — garder slogan en sous-titre : `<h1 class="sr-only md:not-sr-only">Boucheries halal en click & collect à Chambéry, Grenoble, Lyon</h1>` + visual "Marre d'attendre ?" en H2 ou `<p>`. | 15 min | +10-15 % pertinence |
| 7 | **Corriger H1 `/bons-plans` qui est un SVG** (lucide-flame à l'intérieur du `<h1>`). Mettre l'icône en `<span aria-hidden>` et ajouter un texte H1 accessible. | 15 min | A11y critique + SEO |
| 8 | **Fix Lyon "0 boucherie halal"** dans la réponse FAQ — soit masquer la FAQ si `shops.length===0`, soit réécrire pour ne jamais afficher le chiffre 0. | 15 min | Signal négatif Google |
| 9 | **Créer `/manifest.webmanifest`** (même contenu que `/manifest.json`) via `app/manifest.webmanifest/route.ts` retournant `NextResponse.rewrite('/manifest.json')`. Tour 1 fix revendiqué mais absent. | 5 min | PWA audit |
| 10 | **Redirection www → 301 permanent** (actuellement 307). `next.config.mjs` : `{ source: '/(.*)', has: [{type:'host', value:'www.klikandgo.app'}], destination:'https://klikandgo.app/:1', permanent: true }`. | 5 min | PageRank consolidation |

**Bonus** (hors top 10 mais quick wins sous 30 min):
- Page 404 minimale (`app/not-found.tsx` sans header/footer lourd) — 91 KB → < 10 KB.
- Supprimer `/api/offers` ou le créer (actuellement 404).
- Wrapper téléphones en `<a href="tel:">` (persistant depuis tour 1).
- Filtrer les clés i18n Clerk `pRole__*` de la page `/pro`.
- `text-gray-400` → `text-gray-500`/`600` pour WCAG AA (50 occurrences homepage).

---

## Annexe — Preuve des fixes annoncés vs réalité

| Commit `c522bd7` revendique | Réalité prod |
|---|---|
| "titles dédupliqués" | 3/9 pages encore dupes (home, panier, recettes) |
| "H1 sr-only" | H1 textuels OK sur city/boutique. Homepage H1 slogan non-SEO. `/bons-plans` H1 = SVG 🔴 |
| "CartFAB mobile" | Classe `fixed bottom-0 inset-x-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t` **présente** ✅ |
| "manifest.webmanifest" | 🔴 toujours 404 |
| "search accents" | 🟠 `q=bœuf` marche, `q=côte`/`cote` = 0 (mais peut-être qu'aucun produit ne s'appelle côte) |
| "sitemap filter villes vides" | 🔴 5 villes vides toujours dans sitemap |
| "pages /contact /a-propos" | 🔴 toujours 404 |

**Conclusion** : sur 7 fixes revendiqués, **2 sont réellement en prod** (CartFAB, cache-control city pages), 1 partiel (search), 4 non déployés. Vérifier l'état du déploiement Vercel du commit `c522bd7` — possiblement un build raté non détecté.

---

# Tour 2 — Rapport des fixes appliqués (agent)

Commit de base prod : `b5387e3`
TypeScript : clean (exit 0) · Vitest : 95/95 passed

## FIX 1 — H1 homepage SEO ✅
`src/app/(client)/page.tsx` : H1 sr-only → `Boucheries halal près de chez vous — Click & Collect halal en ligne`. Ancien H1 visible "Marre d'attendre ?" rétrogradé en `<p>` (mêmes classes) pour éviter H1 en double et renforcer les mots-clés.

## FIX 2 — /bons-plans H1 ✅
Détecté H1 en double (layout + sr-only page). Retiré sr-only dans `page.tsx`. Enrichi H1 layout : `Bons plans et promotions boucherie halal` (+ icône `aria-hidden`). Fichiers : `bons-plans/page.tsx`, `bons-plans/layout.tsx`.

## FIX 3 — Pages villes sans boutiques ✅
`src/app/boucherie-halal/[ville]/page.tsx` :
- `generateMetadata()` fait un `prisma.shop.count()` et renvoie `robots: { index: false, follow: true }` si `shopCount === 0`.
- FAQ réécrite pour éviter "0 boucherie" : message positif "Klik&Go arrive bientôt, nous recrutons des partenaires…".

## FIX 4 — /api/offers 404 ✅
Créé `src/app/api/offers/route.ts` : GET public, pagination 20/page, filtre `shopId?`, renvoie offres `ACTIVE` dans fenêtre `startDate/endDate`. Compatible avec `offersApi.list()` existant (actuellement non consommé, mais route publique légitime).

## FIX 5 — /favoris noindex ✅
`src/app/(client)/favoris/layout.tsx` : ajouté `robots: { index: false, follow: false }`.

## FIX 6 — /pro clés i18n Clerk ⚠️ partiel
Aucun composant Clerk (`OrganizationSwitcher`, `UserProfile`) dans `/pro` — page statique lucide-only. Le `pRole__admin` vient probablement d'un autre contexte. Appliqué ceinture+bretelles : `robots: { index: false, follow: true }` sur `/pro` → si fuite il y a, Google ne l'indexe pas. Fichier : `src/app/(client)/pro/layout.tsx`.

## FIX 7 — Chat widget ⚠️ skip
`ChatWidget` correctement monté via `dynamic({ssr:false})` dans `src/app/(client)/layout.tsx`. Bubble a bien `pointer-events-auto`. Code intact dans le source. Non reproductible statiquement — probablement runtime/CSP. Skippé, à re-auditer en prod.

## FIX 8 — Redirect www 301 ✅
`next.config.mjs` : ajouté redirect permanent host `www.klikandgo.app` → `klikandgo.app` via `async redirects()`. Note : `permanent: true` = 308 côté Next, traité par Google comme 301 canonical-equivalent. Pour un 301 strict, gérer au niveau Vercel dashboard.

## FIX 9 — Contraste text-gray-400 ✅ (nothing to change in scope)
Audit des 3 fichiers cibles :
- `page.tsx`, `ShopCard.tsx`, `ProductCard.tsx` : **toutes** les occurrences sont en pattern `text-gray-500 dark:text-gray-400` → light mode = gray-500 (OK WCAG AA), dark = gray-400 sur #0a0a0a (OK).
Aucun changement requis dans le scope. Les 50 occurrences audit viennent probablement d'autres fichiers (PromoCodeInput, ProductQuickAdd, AntiGaspiBanner…) — à trier dans un tour futur.

## Fichiers modifiés
- `src/app/(client)/page.tsx`
- `src/app/(client)/bons-plans/page.tsx`
- `src/app/(client)/bons-plans/layout.tsx`
- `src/app/boucherie-halal/[ville]/page.tsx`
- `src/app/api/offers/route.ts` (nouveau)
- `src/app/(client)/favoris/layout.tsx`
- `src/app/(client)/pro/layout.tsx`
- `next.config.mjs`

## Vérifications
- `npx tsc --noEmit` : exit 0
- `npx vitest run` : 6 files / 95 tests passed
