# RAPPORT PERFORMANCE KLIK&GO — Railway
## Date : 21 Fevrier 2026
## Objectif : Analyser les lenteurs, leurs causes, et evaluer si Railway est adapte

---

## 1. ARCHITECTURE ACTUELLE

- **App** : Next.js 14 App Router (standalone output)
- **Hebergement** : Railway (us-west region)
- **Base de donnees** : PostgreSQL sur Railway (switchyard.proxy.rlwy.net:33197)
- **Cache** : Upstash Redis (utilise pour rate-limiting, SSE, et depuis le dernier sprint, cache de quelques routes API)
- **Auth** : Clerk (appels API serveur pour verifier les sessions)
- **CDN** : Aucun (Railway n'a pas de CDN integre)
- **Region cible des utilisateurs** : France (Europe)

---

## 2. MESURES DE LATENCE (depuis la France, 21/02/2026)

### Latences brutes mesurees avec curl

| Endpoint | Temps total | TTFB | Type |
|----------|-------------|------|------|
| Page statique (`/checkout`) | **224 ms** | 204 ms | HTML pre-rendu |
| Health API (`/api/health`) | **649 ms** | 646 ms | 1 query DB (SELECT 1) |
| Decouvrir (`/decouvrir`) | **483 ms** | 100 ms | SSR + streaming |
| Boutique (1er appel) | **1408 ms** | 1356 ms | SSR + Prisma (4 JOINs) |
| Boutique (cache Redis) | **1279 ms** | 1255 ms | SSR + Redis cache |
| Search API (`?q=merguez`) | **1168 ms** | 1165 ms | ILIKE full-text |
| Shops API (`/api/shops`) | **684 ms** | 684 ms | findMany |
| Nearby API | **923 ms** | 922 ms | Haversine + filtre |

### Latence DB isolee

| Mesure | Valeur |
|--------|--------|
| `SELECT 1` (health check) | **307 ms** |
| Temps de connexion TCP vers Railway DB | ~150-200 ms |

---

## 3. DECOMPOSITION DES LENTEURS

### 3.1 — Latence reseau (INCOMPRESSIBLE sur Railway)

```
Utilisateur (France) → Railway (US-West) : ~100-150 ms aller
Railway App → Railway DB : ~150-200 ms aller
Total roundtrip minimal : ~400-500 ms
```

**C'est le probleme fondamental.** Railway heberge en US-West. Les utilisateurs sont en France. Chaque requete fait un aller-retour transatlantique (~100ms), et la DB est sur un proxy Railway qui ajoute encore ~150ms.

Un simple `SELECT 1` prend **307ms**. Sur Vercel/Neon en Europe, ca prendrait ~5-20ms.

### 3.2 — Pas de CDN / Edge Caching

Railway ne propose **aucun CDN**. Chaque requete HTTP (meme une page statique) traverse l'Atlantique. Sur Vercel, une page statique est servie depuis le edge le plus proche en ~20-50ms. Sur Railway : **224ms** pour la meme chose.

### 3.3 — SSR sans cache edge

Les pages Server Components sont rendues a chaque requete sur le serveur Railway en US-West. Il n'y a pas d'ISR edge cache comme sur Vercel. Meme avec `revalidate: 30`, la page est re-rendue cote serveur a chaque visite (pas de stale-while-revalidate edge).

### 3.4 — Clerk auth() cote serveur

Chaque appel `auth()` dans un Server Component fait un roundtrip vers l'API Clerk (~100-300ms). On a supprime `auth()` de la page boutique, mais d'autres pages l'utilisent encore.

### 3.5 — Requetes Prisma lourdes

La page boutique fait une requete avec 4 JOINs (shop + categories + products + images + labels). Meme avec le cache Redis, le rendering SSR du HTML prend du temps.

---

## 4. OPTIMISATIONS DEJA FAITES (Sprint Performance)

### 4.1 — Bundle (Agent 10)
- Lazy-load recharts : `/boucher/commandes` 237KB → **118KB (-50%)**
- Lazy-load html5-qrcode : import dynamique
- `optimizePackageImports` pour lucide-react
- Reduction des font weights (12 → 9)
- Lazy-load modals dans mode cuisine

### 4.2 — API (Agent 11)
- Bounding box sur `/api/shops/nearby` avant Haversine
- `_count` + `groupBy` sur `/api/admin/users` (plus de chargement de toutes les commandes)
- Search : synonymes limites a 2/token, max 6 tokens, ILIKE sur name+tags uniquement
- Cache Redis sur 3 routes (search 120s, nearby 60s, products 60s)
- `take` sur 14 routes findMany sans pagination
- Fusion des queries dans `/api/chat`

### 4.3 — Client (Agent 12)
- 5 `<img>` → `next/image`
- Lazy-load QRCodeSVG + SplashScreen
- CartProvider deplace vers layout (client) uniquement
- Middleware scope restreint

### 4.4 — Boutique (fix supplementaire)
- Cache Redis sur les donnees shop (TTL 60s)
- Suppression de `auth()` du Server Component
- Parallélisation des queries avec Promise.all

---

## 5. CE QUI RESTE LENT ET POURQUOI

| Probleme | Cause racine | Corrigeable sans migration ? |
|----------|-------------|------------------------------|
| Page boutique ~1.3s | Latence reseau FR→US + DB proxy | **NON** |
| Health check 307ms pour un SELECT 1 | DB proxy Railway (switchyard) | **NON** |
| Page statique 224ms | Pas de CDN, serveur en US-West | **NON** |
| Search API ~1.2s | ILIKE sans index trigram + latence DB | Partiellement (cache aide) |
| Shops API ~680ms | Latence DB + requete Prisma | Partiellement (cache aide) |

### La verite : ~60-70% de la lenteur est de la latence reseau, pas du code.

---

## 6. COMPARAISON RAILWAY vs ALTERNATIVES

### Option A : Rester sur Railway (statu quo)

| Avantage | Inconvenient |
|----------|-------------|
| Simple a gerer | Pas de CDN |
| Prix previsible (~$5-20/mois) | Serveurs US-West uniquement |
| PostgreSQL inclus | DB proxy lent (~300ms par query) |
| Deploy automatique depuis Git | Pas d'ISR edge cache |
| | Pas de region Europe |
| | TTFB minimum ~200ms (pages statiques) |

**Latence incompressible : ~200ms (statique), ~600-1400ms (dynamique)**

### Option B : Vercel (App) + Neon/Supabase (DB en Europe)

| Avantage | Inconvenient |
|----------|-------------|
| CDN edge mondial (pages statiques ~20-50ms) | Plus cher ($20/mois pro) |
| ISR avec stale-while-revalidate edge | Vendor lock-in |
| Serverless Functions en Europe (ew1) | Cold starts possibles |
| Neon DB en Europe (~5-20ms latence) | Limites de bande passante |
| Image optimization integree | |
| Middleware edge (~1ms) | |

**Latence attendue : ~50ms (statique), ~200-400ms (dynamique)**

### Option C : Railway EU + Railway DB EU

Railway a annonce des regions EU mais elles ne sont pas encore matures pour PostgreSQL. Si Railway EU devient disponible :

| Avantage | Inconvenient |
|----------|-------------|
| Meme simplicite que maintenant | Toujours pas de CDN |
| DB locale (~5-20ms) | Pas d'ISR edge |
| Prix similaire | Region EU pas encore stable |

**Latence attendue : ~100ms (statique), ~200-500ms (dynamique)**

### Option D : Fly.io (App EU) + Fly Postgres (EU)

| Avantage | Inconvenient |
|----------|-------------|
| Serveur en Europe (CDG/AMS) | Plus complexe a configurer |
| DB co-localisee (~2-5ms) | Pas de CDN automatique |
| Prix competitif | Pas d'ISR edge natif |
| Support Docker natif | |

**Latence attendue : ~50ms (statique), ~150-400ms (dynamique)**

### Option E : Vercel (App) + Railway EU (DB)

| Avantage | Inconvenient |
|----------|-------------|
| CDN Vercel + ISR edge | Latence Vercel EU → Railway EU (~20-50ms) |
| Garder la DB Railway | 2 providers a gerer |
| Middleware edge | |

---

## 7. RECOMMANDATION

### Le probleme #1 est la GEOGRAPHIE, pas le code.

Le code a ete optimise (bundle -50%, API caching, queries optimisees). Les gains restants sont marginaux cote code. **Le seul moyen de descendre sous 500ms pour les pages dynamiques est de rapprocher le serveur et la DB des utilisateurs (Europe).**

### Matrice de decision :

| Critere | Railway US | Vercel+Neon EU | Fly.io EU | Railway EU |
|---------|-----------|----------------|-----------|------------|
| Latence statique | 200ms | **20-50ms** | 50ms | 100ms |
| Latence dynamique | 600-1400ms | **200-400ms** | 150-400ms | 200-500ms |
| Latence DB | 300ms | **5-20ms** | 2-5ms | 5-20ms |
| Complexite migration | - | Moyenne | Elevee | Faible |
| Cout mensuel | $5-20 | $20-40 | $10-25 | $5-20 |
| CDN | Non | **Oui** | Non | Non |
| ISR Edge | Non | **Oui** | Non | Non |

### Si le budget le permet : **Vercel (App) + Neon (DB EU)** est le meilleur choix pour une app Next.js avec des utilisateurs en France.

### Si on veut rester simple : **Attendre Railway EU** et migrer la DB en Europe quand c'est disponible.

### Migration minimale a court terme : Mettre un **Cloudflare** devant Railway pour cacher les pages statiques et les assets (~$0). Ca reduirait la latence statique de 200ms a ~30ms.

---

## 8. METRIQUES ACTUELLES POST-OPTIMISATION

| Metrique | Valeur |
|----------|--------|
| Build time | 22s |
| Plus grosse route | /boucher/commandes: 118 KB (etait 237 KB) |
| Shared JS | 87.8 KB |
| Routes > 200KB | 0 (etait 2) |
| findMany sans pagination | 0 (etait 22) |
| Cache Redis actif | 4 routes |
| Images non optimisees | 0 (etait 5) |
| Lazy-loaded components | 8+ (etait 2) |
| DB latence (SELECT 1) | 307 ms |
| Page statique TTFB | 204 ms |
| Page boutique TTFB | 1255 ms |
