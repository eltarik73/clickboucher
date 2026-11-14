# Rendu statique, dynamique et caches — état Next 14.2.35

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md).

## 1. Le modèle en une page

- **Statique par défaut** : une route est rendue au build (ou en arrière-plan après revalidation),
  mise en cache et servie par le CDN. **Dynamique** : rendue à chaque requête [S1].
- Next décide **par route entière**. Une seule fonction dynamique ou une seule donnée non mise en
  cache, **où que ce soit dans l'arbre (layout compris)**, bascule toute la route [S1][S2].
- Sur Vercel, une route prérendue est servie par le CDN **sans exécuter de fonction** ; une route
  dynamique exécute une fonction à chaque vue, bots compris [S22]. C'est le lien direct avec la
  panne `DEPLOYMENT_DISABLED` du 2026-11-05 (`CLAUDE.md` § « Coût CPU Vercel ») [L10].

### Les quatre caches [S2]

| Cache | Où | Contenu | Durée | Ce qui compte ici |
| --- | --- | --- | --- | --- |
| Request Memoization | serveur | `fetch` identiques d'un même rendu | une requête | Prisma n'est **pas** `fetch` : utiliser `cache()` de `react` (ex. `getShop` dans `boutique/[slug]/page.tsx`) |
| Data Cache | serveur | résultats de `fetch` | persistant | quasi inutilisé ici (données via Prisma) |
| Full Route Cache | serveur/CDN | HTML + payload RSC des routes statiques | persistant, revalidable | **le cache qui nous évite le CPU** |
| Router Cache | navigateur | payload RSC par segment | 30 s (dynamique) / 5 min (statique) [L2] | une mutation faite par un Route Handler **ne le vide pas** [S2] |

## 2. Ce qui sort une route du rendu statique

| Cause | Portée | Où c'est arrivé / où ça guette ici | Source |
| --- | --- | --- | --- |
| `<ClerkProvider dynamic>` | **toute l'app** (layout racine) | `src/app/layout.tsx` — 298 routes sur 308 rendues par requête du 2026-04-29 au correctif de novembre 2026 | [S21][L6][L10] |
| `cookies()` / `headers()` dans un Server Component ou un layout | route entière | uniquement via `src/lib/auth/server-auth.ts`, `guest-auth.ts`, `vercel-geo.ts`, `suivi/[id]/page.tsx` — ne jamais les importer dans un layout ou une page publique | [S1] |
| `auth()` / `currentUser()` de Clerk (donc `getServerUserId()`) | route entière | `admin-login/page.tsx`, `suivi/[id]/page.tsx` (voulu) | [S21] |
| Lecture de la prop `searchParams` dans `page.tsx` | la page | `/recettes` : `revalidate = 60` y est **inopérant** | [S1] |
| `fetch` en `cache: "no-store"` ou `revalidate: 0` | route entière | le client Upstash est en `no-store` par défaut ⇒ `/boutique/[slug]` | [S2][S5][L7] |
| `export const dynamic = "force-dynamic"` ou `revalidate = 0` | le segment et ses enfants | 190 handlers API (voulu), `suivi/[id]` | [S3] |
| `unstable_noStore()` | route entière | absent du dépôt — ne pas l'introduire sur une page publique | [L1] |
| Segment dynamique **sans** `generateStaticParams` | la route | `/boutique/[slug]` (voulu), 8 coquilles clientes `[id]` | [S4b][L4] |
| `export const runtime = "edge"` | la route | ISR indisponible en edge ; `icon.tsx` et `opengraph-image.tsx` l'ont eu | [S3] |

**Ce qui ne rend PAS une route dynamique** : `"use client"`, `useAuth()`, `useUser()`,
`usePathname()`, `useRouter()`. Un Client Component est lui aussi prérendu en HTML sur le serveur
[S1b][S21]. D'où 59 des 67 pages `"use client"` servies comme coquilles statiques ; les 8 autres
ont un segment `[id]` sans `generateStaticParams` [L9][L13].

**Cas à part — `useSearchParams()`** : la route reste statique, mais tout l'arbre client jusqu'à la
frontière `Suspense` la plus proche n'est rendu que dans le navigateur [S10]. Sans frontière
explicite, le HTML prérendu est le `loading.tsx` parent : c'est le cas de `checkout/success`,
`checkout/cancel` et `boucher/parametres/paiement` (aucun `<Suspense>` dans `src/`) [L13] — constat
refait dans le build : leur HTML ne contient que le squelette [L8]. Deux façons de l'éviter :

- `<Suspense>` autour du seul composant qui appelle `useSearchParams()` (motif 7 de
  [patterns.md](patterns.md)) ;
- pour un paramètre lu une seule fois, `new URLSearchParams(window.location.search)` dans un
  `useEffect` — c'est ce que fait déjà `src/app/(client)/inscription-boucher/page.tsx` (code de
  parrainage `?ref=`), dont le formulaire reste dans le HTML prérendu.

### Le piège du « statique qui devient dynamique »

Une route enregistrée comme prérendue (elle a `generateStaticParams`) qui touche une API de requête
**à l'exécution** ne bascule pas en dynamique : elle répond **500**
« Page changed from static to dynamic at runtime » [S14][L3]. Les deux conséquences ci-dessous sont
déduites du code de Next par l'audit [L10] ; elles n'ont pas été reproduites en production :

- remettre `dynamic` sur `<ClerkProvider>` donnerait un 500 sur `/sign-in`, `/sign-up` et
  `/recettes/[slug]` : leur `generateStaticParams` renvoie `[]`, rien n'est rendu au build, donc le
  build ne voit rien [L10]. Les 282 pages SEO, elles, repasseraient silencieusement en rendu par
  requête (le build détecte `headers()` en les prérendant) — c'est ce qui s'est produit d'avril à
  novembre 2026 ;
- ajouter `generateStaticParams` à `/boutique/[slug]` sans retirer la lecture Upstash donnerait un
  500 **uniquement à l'exécution**, dans un environnement où Upstash est configuré [L7][L10].

## 3. Carte de rendu de l'application (build à 161f920, recontrôlée à 2364ef9) [L8][L9]

| Classe | Routes | Fenêtre |
| --- | --- | --- |
| Coquille statique (`○`, page `"use client"` ou sans donnée) | `/panier`, `/favoris`, `/commandes`, `/profil`, `/recherche`, tout `/boucher/*`, `/webmaster/*`, `/admin/*` non paramétrés, pages légales | aucune (régénérée au déploiement) |
| ISR sans paramètre (affichée `○` dans la table, **la fenêtre se lit dans le manifest**) | `/` et `/bons-plans/*` | 300 s |
| | `/a-propos`, `/presse`, `/click-and-collect-halal`, `/boucheries-halal-rhone-alpes` | 86 400 s |
| | `/commander-viande-halal`, `/trouver-boucherie-halal`, `/sitemap.xml` | 3 600 s |
| ISR paramétrée (`●`, `generateStaticParams`) | `/boucherie-halal/[ville]` (+ `[quartier]`), `/boucheries-halal/[departement]`, `/boucheries-halal-ouvertes-dimanche/[ville]`, `/occasions/…`, `/produits/…` | 3 600 s |
| | `/devenir-boucher-partenaire/[ville]` | 86 400 s |
| ISR à la demande (`●`, `generateStaticParams` ⇒ `[]`) | `/recettes/[slug]`, `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | 3 600 s / aucune |
| Dynamique voulue (`ƒ`) | `/boutique/[slug]` (+ son `opengraph-image`), `/suivi/[id]`, `/admin-login` | — |
| Dynamique subie (`ƒ`) | `/recettes` (lit `searchParams`) ; 8 coquilles clientes à segment `[id]` : `/commande/[id]`, `/validation/[id]`, `/admin/shops/[shopId]`, `/admin/support/[ticketId]`, `/boucher/produits/[id]/modifier`, `/boucher/support/[ticketId]`, `/webmaster/boutiques/[shopId]`, `/webmaster/support/[ticketId]` | — |
| API | 197 `ƒ`, 1 prérendue | — |

Total : 370 entrées dans `prerender-manifest.json`, dont 282 pages SEO paramétrées (55 villes,
12 quartiers, 5 départements, 15 « dimanche », 84 produits × villes, 56 occasions × villes,
55 « devenir partenaire »). Le garde-fou CI exige ≥ 250 et la présence de `/`, `/cgv`, `/a-propos`,
`/boucherie-halal/chambery`, `/sitemap.xml` (`scripts/check-prerender.mjs`).

Décompte hors API de la table du build : 88 `○` (dont `/_not-found`), 10 `●`, 13 `ƒ`. Quand une
route est ajoutée volontairement, mettre à jour ce décompte et celui de `SKILL.md` § 3.

## 4. Diagnostiquer une route

1. `npm run build` (base joignable obligatoire), puis lire la table : `○` statique, `●` prérendue
   avec paramètres, `ƒ` rendue à la demande.
2. La table ne montre pas la fenêtre ISR d'une page sans paramètre : lire
   `.next/prerender-manifest.json` → `routes["/chemin"].initialRevalidateSeconds` ; une route ISR à
   la demande apparaît dans `dynamicRoutes`.
3. `node scripts/check-prerender.mjs` (ce que fait le job CI `build`).
4. En local, `next build` puis `next start` avec `NEXT_PRIVATE_DEBUG_CACHE=1` journalise les
   hits/miss ISR ; l'en-tête de réponse `x-nextjs-cache` vaut `HIT`, `STALE`, `MISS` ou
   `REVALIDATED` [S5].
5. Une page publique passée en `ƒ` sans raison : chercher dans son graphe d'imports serveur
   `next/headers`, `server-auth`, `boucher-auth`, `admin-auth`, `@/lib/redis`, la prop
   `searchParams`, `force-dynamic`, `runtime = "edge"`.

## 5. Règles sur les options de segment [S3]

- Valeur **littérale** : `export const revalidate = 3600;` — `60 * 60` n'est pas analysable
  statiquement.
- La plus petite valeur de `revalidate` parmi les layouts et la page d'une route s'applique à toute
  la route : ne jamais poser un `revalidate` court dans un layout partagé.
- `dynamic = "force-static"` force `cookies()`, `headers()` et `useSearchParams()` à renvoyer des
  valeurs vides : réservé aux pages sans donnée par utilisateur (ex. `src/app/not-found.tsx`).
- `dynamic = "error"` fait échouer le build si la page devient dynamique : option possible pour
  verrouiller une page SEO, à valider avant usage.
- Ces deux valeurs font passer le défaut de `dynamicParams` à `false` : sur un segment `[param]`,
  les chemins non prégénérés répondraient 404, sauf à écrire `dynamicParams = true`. Aucune route
  paramétrée du dépôt ne les utilise ; ne pas en poser sans passer par le point à arbitrer n° 6.
- Un `export const revalidate` sur une route qui reste dynamique (`/boutique/[slug]`, `/recettes`)
  est **inerte** et trompeur : ne pas en ajouter, et ne pas s'y fier en lisant le code.
