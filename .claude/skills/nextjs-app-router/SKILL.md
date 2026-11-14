---
name: nextjs-app-router
description: Next.js App Router en production pour Klik&Go (Next 14.2.35). Décider statique / ISR / dynamique, repérer ce qui bascule silencieusement une route en rendu par requête, generateStaticParams et revalidatePath, frontière Server/Client Components et emplacement du chargement de données, route handlers, error.tsx / loading.tsx / not-found, hydratation sans mismatch, metadata, et écriture compatible Next 15/16. À charger avant de créer ou modifier un fichier sous src/app (page, layout, route, loading, error, sitemap, opengraph-image), un composant rendu côté serveur ou src/middleware.ts.
when_to_use: Nouvelle page ou route ; ajout de "use client", cookies(), headers(), auth(), searchParams, revalidate, generateStaticParams, next/dynamic, Link en liste ; page passée en ƒ dans la table du build ; échec de scripts/check-prerender.mjs ; erreur d'hydratation ; erreur "Page changed from static to dynamic at runtime" ; question sur la montée vers Next 15 ou 16.
---

# Next.js App Router — Klik&Go

Version installée : **Next 14.2.35**, React 18.3.1, Clerk 6.39.9, déployé sur Vercel (état vérifié
au commit `2364ef9`). Ce skill explique le **pourquoi** des règles de `CLAUDE.md` (§ « Coût CPU
Vercel » et § « Next.js App Router »), les complète, et ne les contredit jamais : en cas de doute,
`CLAUDE.md` gagne et l'écart va dans « Points à arbitrer ». Chaque affirmation externe renvoie à
[references/sources.md](references/sources.md) (`[S…]` source, `[L…]` preuve locale).

Skills voisins, à ne pas dupliquer : `vercel-cost-performance` (facturation, middleware),
`api-route-conventions` (handlers), `clerk-auth`, `seo-expert` et `seo-anti-penalty` (indexation —
garde-fou du propriétaire), `web-performance`, `reliability-observability`, `order-lifecycle-realtime`.

## 1. Le principe qui gouverne tout

Une route **prérendue** (statique ou ISR) est servie par le CDN sans exécuter de fonction ; une
route **dynamique** exécute une fonction à chaque vue, robots compris [S1][S22]. Next décide **par
route entière**, et un seul appel mal placé — même dans un layout — bascule toute la route [S1].
La panne du 2026-11-05 l'illustre : une prop sur `<ClerkProvider>` a rendu 298 routes sur 308
dynamiques pendant six mois sans qu'aucun test ne le voie [L10] (l'autre cause, le middleware
exécuté sur toutes les routes, est traitée par `vercel-cost-performance`).

Avant de toucher `src/app`, répondre à quatre questions :

1. La route est-elle publique ou indexable ? ⇒ elle **doit** rester prérendue.
2. Son rendu serveur dépend-il de la requête (session, cookie, query string) ou de l'heure ? ⇒ pour
   une route publique, la réponse doit être non : ces parties vont côté client, après montage.
3. Qui modifie la donnée affichée, et à quelle fréquence ? ⇒ fenêtre ISR, ou revalidation à la demande.
4. Ce fichier a-t-il vraiment besoin de `"use client"` ? ⇒ sinon, seule la feuille interactive l'a.

## 2. Choisir le mode de rendu

| Situation | Mode | Mise en œuvre | Modèle dans le dépôt |
| --- | --- | --- | --- |
| Page publique sans donnée | statique | rien à déclarer | `(client)/cgv/page.tsx` |
| Page publique + Prisma, sans segment dynamique | ISR | `export const revalidate = 3600;` — littéral, parmi 300, 3600, 86400 | `(client)/page.tsx`, `sitemap.ts` |
| Segment dynamique, liste fermée | ISR prégénérée | `revalidate` + `generateStaticParams` qui renvoie la liste | `boucherie-halal/[ville]/page.tsx` |
| Segment dynamique, slugs en base | ISR à la demande | `revalidate` + `generateStaticParams` qui renvoie `[]` | `(client)/recettes/[slug]/page.tsx` |
| Espace connecté | coquille statique `"use client"` + appels API | chemin couvert par `config.matcher` du middleware | `(boucher)/boucher/**` |
| Le serveur doit lire la session | dynamique | `force-dynamic`, `getServerUserId()`, chemin dans le matcher | `(client)/suivi/[id]/page.tsx` |
| Vitrine `/boutique/[slug]` | dynamique (**décision actée**) | ne pas ajouter `generateStaticParams` | voir [isr-revalidation.md](references/isr-revalidation.md) § 6 |

Carte de rendu des 104 pages et diagnostic : [rendu-et-cache.md](references/rendu-et-cache.md).
Choix de la fenêtre : [isr-revalidation.md](references/isr-revalidation.md) § 3.

## 3. Ce qui rend une route dynamique sans prévenir

Aucun de ces points ne fait échouer le build (au mieux une ligne d'avertissement dans les logs) :

- la prop `dynamic` sur `<ClerkProvider>` — **interdite** (`src/app/layout.tsx`) [S21][L6] ;
- `cookies()`, `headers()`, `auth()`, `currentUser()`, donc `getServerUserId()`,
  `getAuthenticatedBoucher()`, `requireAdmin()`, dans une page **ou un layout** [S1] ;
- la lecture de la prop `searchParams` dans une `page.tsx` serveur (cas réel : `/recettes`) [S1] ;
- un `fetch` en `no-store` dans l'arbre serveur — le client Upstash (`@/lib/redis`) en fait par
  défaut [S5][L7] ;
- un segment `[param]` sans `generateStaticParams` : `revalidate` y est **ignoré** [S4b][L4] ;
- `export const runtime = "edge"` (pas d'ISR en edge) [S3] ; `force-dynamic` ou `revalidate = 0`.

Ne rendent **pas** dynamique : `"use client"`, `useAuth()`, `useUser()`, `usePathname()`.
`useSearchParams()` garde la route statique mais sort du HTML tout ce qui est sous la frontière
`Suspense` la plus proche [S10] — sans `<Suspense>` explicite, c'est la page entière (HTML = le
`loading.tsx` parent). Deux remèdes : `<Suspense>` autour du seul composant qui lit le paramètre,
ou lecture de `window.location.search` dans un `useEffect` (modèle : `inscription-boucher/page.tsx`).

Piège inverse : une route à `generateStaticParams` qui touche une API de requête à l'exécution ne
devient pas dynamique, elle répond **500** [S14][L3]. Les routes à liste vide ne sont pas rendues
au build : ce 500 n'apparaît qu'en production.

**Contrôle obligatoire** après tout changement sous `src/app` ou dans un composant de layout :
`npm run build` puis `node scripts/check-prerender.mjs`, et comparer la table des routes à la
référence — hors API : 88 `○`, 10 `●`, 13 `ƒ` au commit `2364ef9` [L9]. Toute page publique
nouvellement en `ƒ` est une régression ; quand une route est ajoutée volontairement, mettre ces
chiffres à jour ici et dans [rendu-et-cache.md](references/rendu-et-cache.md).

## 4. ISR : les règles

- `revalidate` est un **littéral numérique** (`3600`, pas `60 * 60`) [S3] ; la plus petite valeur
  entre layouts et page s'applique à toute la route.
- Après la fenêtre, le premier visiteur reçoit l'ancienne page et déclenche la régénération ; chaque
  régénération est une fonction facturée [S5][S22]. Fenêtre longue par défaut ; moins de 300 s se
  justifie par écrit dans le fichier.
- **Laisser lever les erreurs de données.** Un rendu qui réussit est mis en cache : une erreur Prisma
  avalée fige une liste vide — et parfois un `noindex` — pour toute la fenêtre ; une erreur levée
  conserve la dernière bonne page [S5]. Donc pas de `try/catch` à valeur par défaut, et un build
  sans base joignable **doit** échouer.
- `notFound()` signifie « n'existe pas », jamais « erreur technique ».
- Revalidation à la demande : aucune n'existe encore dans `src/` [L13]. Pour en ajouter :
  `revalidatePath` depuis le handler, après l'écriture, via un helper unique ; portée globale
  `("/", "layout")` réservée aux actions rares. Ne jamais allonger une fenêtre en s'appuyant sur une
  couverture partielle des écritures.

Détail, inventaire des écritures boutique et recette de vérification :
[isr-revalidation.md](references/isr-revalidation.md).

## 5. Server / Client Components et données

- `"use client"` embarque le module **et tous ses imports** dans le bundle [S24]. Mesuré ici :
  `(client)/layout.tsx` est client, il importe `SeoFooter` donc `SEO_CITIES` ⇒ un chunk de 70 ko
  (16 ko gzip) sur chaque page du groupe [L8].
- Un `layout.tsx` est un Server Component ; les providers sont de petits fichiers clients qui
  reçoivent `children` (`CartProviderWrapper`). La directive va sur la feuille interactive [S23][S26].
- Donnée publique : Prisma **dans le Server Component**, `select` minimal, `Promise.all`. Jamais de
  `fetch("/api/…")` vers soi-même depuis le serveur [S23][S26].
- Même requête dans `generateMetadata` et la page : `cache()` de `react` (modèle : `getShop`).
- Donnée par utilisateur sur une page publique (favoris, panier, commande en cours, prix pro) :
  client, après montage, sous `(isLoaded && isSignedIn) || hasTestModeCookie()`.
- Tout ce qui est passé en prop à un Client Component est **public** (HTML + payload RSC) : objet
  construit champ par champ, jamais l'enregistrement Prisma entier.
- `import "server-only";` [S13] : **aucun module ne l'utilise aujourd'hui** et l'import fait
  échouer Vitest tant qu'un alias n'existe pas [L17]. Ne pas l'ajouter isolément : prérequis dans
  [composants-donnees-hydratation.md](references/composants-donnees-hydratation.md) § 1.
- Mutations : Route Handlers (`api-route-conventions`). Aucune Server Action n'existe ; en introduire
  est une décision d'architecture.
- Liens : `prefetch={false}` sur toute liste de liens et tout lien répété vers une route dynamique ;
  chaque lien visible vers une route dynamique est une fonction exécutée [S9].

Détail : [composants-donnees-hydratation.md](references/composants-donnees-hydratation.md).

## 6. Hydratation

Le HTML serveur et le premier rendu navigateur doivent être identiques [S24]. Sous ISR, une valeur
calculée au rendu serveur est vieille de **toute la fenêtre**.

- Horloge, fuseau, `localStorage`, `document.cookie`, `window` : jamais pour décider du JSX du
  premier rendu ; état initial neutre puis `useEffect` (modèle : `ShopCard.tsx`) [S14].
- Logique d'horaires : `src/lib/paris-time.ts` (le runtime Vercel est en UTC).
- Clerk : `useAuth()`/`useUser()` valent `isLoaded: false` au premier rendu ; rendu par défaut
  « déconnecté », `isLoaded`/`isSignedIn` dans les dépendances des effets (modèle : `BottomNav.tsx`).
- Composant navigateur pur (PWA, popup, chat) : `dynamic(…, { ssr: false })`, déclaré dans un
  fichier client pour tout nouveau code (§ 8).
- `suppressHydrationWarning` : `<html>` (thème) ; jamais pour masquer un écart de contenu [S24].
  Les deux usages existants sur l'année du pied de page ne sont pas un modèle à étendre.

## 7. `error.tsx`, `loading.tsx`, `not-found`, handlers, metadata

- `error.tsx` protège la page et les segments enfants, **pas** le layout du même segment ; le layout
  racine n'est couvert que par `app/global-error.tsx`, absent aujourd'hui [S7][L13].
- `loading.tsx` ⇒ réponse streamée ⇒ statut 200 même si `notFound()` est levé ensuite [S8][S8b].
  Sur une route dynamique indexable, appeler `notFound()` aussi dans `generateMetadata`
  (modèle : `boutique/[slug]/page.tsx`).
- `redirect()` et `notFound()` jamais à l'intérieur d'un `try` [S23].
- Chaque `route.ts` déclare son mode (`force-dynamic`, ou `revalidate` pour un `GET` public mis en
  cache) ; `params` typé en `Promise` et attendu avec `await`.
- `metadata` : Server Component uniquement ; fusion **superficielle** — une page qui définit
  `openGraph` ou `robots` remplace l'objet parent en entier [S12] ; canonical par page.
- Jamais de `runtime = "edge"` sur `sitemap.ts`, `icon.tsx`, `opengraph-image.tsx`.

Détail : [fichiers-speciaux.md](references/fichiers-speciaux.md).

## 8. Écrire compatible Next 15 / 16

Next 14 n'est plus supporté ; 15 l'est jusqu'au 2027-01-31 ; 16 est la version active [S19]. Tout
nouveau code suit ces formes, qui compilent déjà en 14.2.35 [L11] :

- serveur : `params: Promise<{ slug: string }>` + `await params` ; page cliente : `useParams()` ;
- `await cookies()`, `await headers()` dans tout **nouveau** code. Les helpers synchrones existants
  (`getTestRole()`, `isTestActivated()`, `getVercelGeo()`) ne se réécrivent pas au passage : leur
  passage en `async` touche l'authentification et se fait dans la PR de migration ;
- `ssr: false` uniquement dans un fichier `"use client"` (interdit en Server Component dès 15 [S16]) ;
- `revalidatePath` plutôt que `revalidateTag` (forme à un argument dépréciée en 16 [S17]) ;
- aucune dépendance à un cache implicite (`GET` et `fetch` ne sont plus mis en cache par défaut en
  15 [S15]) ; pas de nouvel `edge`.

Inventaire chiffré de ce que la migration touchera : [next15-next16.md](references/next15-next16.md).
Motifs prêts à copier : [patterns.md](references/patterns.md).

## 9. Erreurs déjà commises dans ce dépôt

| Erreur | Conséquence | Verrou actuel |
| --- | --- | --- |
| `<ClerkProvider dynamic>` (2026-04-29) | 298/308 routes dynamiques, quota CPU, site hors ligne | commentaire dans `layout.tsx`, job CI `build` + `check-prerender.mjs` |
| `revalidate` sans `generateStaticParams` sur `[slug]` | page rendue à chaque requête en croyant à l'ISR | `generateStaticParams` ⇒ `[]` ; lire la table du build |
| `try/catch` à valeur par défaut autour de Prisma | sous ISR : page vide ou `noindex` en cache | relance en production (`(client)/page.tsx`) |
| `runtime = "edge"` sur `icon.tsx`, `opengraph-image.tsx` | image régénérée à chaque requête | ligne supprimée |
| `sitemap.ts` en `force-dynamic` | 5 requêtes Prisma par passage de robot | `revalidate = 3600` |
| Calcul d'horloge dans le rendu (`ShopCard`, horaires en UTC) | mismatch d'hydratation, badge faux | `useEffect`, `paris-time.ts` |
| Footer de ≈ 130 liens en prefetch par défaut | une rafale de requêtes RSC par page vue | wrapper `Link` à `prefetch={false}` |
| Appels API au montage pour les anonymes | fonctions facturées pour rien | garde `isSignedIn` / `hasTestModeCookie()` |
| `(client)/layout.tsx` en `"use client"` | 70 ko de données SEO dans le bundle | **aucun — dette ouverte** |
| Pas de `global-error.tsx`, `error.tsx` sans remontée | erreur du layout racine non maîtrisée ni tracée | **aucun — dette ouverte** |

## 10. Définition de terminé

- [ ] Les quatre questions du § 1 ont une réponse écrite dans la PR pour toute nouvelle route.
- [ ] `npm run build` passe **avec une base joignable**, puis `node scripts/check-prerender.mjs`.
- [ ] Table des routes : aucune page publique nouvellement en `ƒ` ; toute nouvelle route apparaît
      dans la classe prévue (vérifiée dans `.next/prerender-manifest.json` pour l'ISR) ; une
      nouvelle page publique clé est ajoutée à `REQUIRED_ROUTES` de `scripts/check-prerender.mjs`.
- [ ] Segment dynamique prérendu ⇒ `generateStaticParams` présent ; `revalidate` littéral.
- [ ] Aucun `cookies()`/`headers()`/auth serveur hors des routes couvertes par le matcher ; si une
      famille protégée est ajoutée, matcher **et** `middleware-matcher.test.ts` mis à jour.
- [ ] Aucun `try/catch` à valeur par défaut autour des données d'une page prérendue.
- [ ] Aucun affichage dépendant de l'heure ou de la session dans le HTML serveur d'une page publique.
- [ ] `"use client"` seulement sur des feuilles ; aucun nouveau layout client ; imports vérifiés ;
      aucun `useSearchParams()` hors `<Suspense>` ; pas d'`import "server-only"` sans ses prérequis.
- [ ] Nouveau segment avec layout ⇒ `error.tsx` ; route `ƒ` ou coquille cliente ⇒ `loading.tsx`
      fidèle à la page.
- [ ] Listes de liens et liens vers routes dynamiques en `prefetch={false}`.
- [ ] Formes compatibles 15/16 du § 8 respectées dans tout fichier créé ou modifié.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test` verts ; mode clair/sombre et 375 px vérifiés
      si l'interface change (`CLAUDE.md`).
- [ ] Pour une route à `generateStaticParams` vide : réponse 200 constatée sur la preview Vercel.

## 11. Points à arbitrer

À trancher par le propriétaire ; rien ici ne modifie une règle existante.

1. **Next 14 est hors support** [S19] et des avis de sécurité de 2026 couvrent 14.x sans correctif
   en 14 [S20], alors que les majeures sont exclues de Dependabot (`CLAUDE.md`). Décider d'un
   calendrier 14 → 15.5 → 16. L'applicabilité de chaque avis à ce déploiement n'est pas évaluée.
2. **`CLAUDE.md` : « PWA/Popup : toujours `dynamic({ ssr: false })` ».** Exact, mais interdit dans un
   Server Component à partir de Next 15 [S16] ; 8 appels sont dans ce cas. Proposer d'ajouter
   « depuis un fichier client ».
3. **`CLAUDE.md` : « `error.tsx` dans chaque layout ».** La doc précise qu'il ne couvre pas le layout
   du même segment et demande `global-error.tsx` à la racine [S7]. Proposer de compléter la règle.
4. **`CLAUDE.md` : « pas de `new Date()` dans le rendu initial d'un composant rendu côté serveur ».**
   Des Server Components de pages ISR l'emploient pour borner une requête Prisma ou afficher l'année
   (`(client)/page.tsx`, `bons-plans/page.tsx`, `boucherie-halal/[ville]/page.tsx`). Sans risque
   d'hydratation, mais figé à la régénération : confirmer que cet usage est toléré.
5. **`/boutique/[slug]` dynamique.** La doc Vercel cite les catalogues e-commerce comme cas d'usage
   de l'ISR [S22] ; la conversion a trois prérequis lourds (§ 6 du document ISR). À rouvrir ou non.
6. **`dynamicParams = false` sur les routes SEO à liste fermée** : supprimerait le rendu à la demande
   de slugs inconnus, mais ferait répondre 404 aux combinaisons valides non prégénérées
   (`produits`, `occasions`). Décision d'indexation ⇒ protocole `seo-anti-penalty`.
7. **Statut 404 des boutiques inexistantes après Next 15.2** : les métadonnées deviennent streamées
   [S12b], ce qui peut annuler le correctif anti-soft-404 du 2026-06-12 (non vérifié). Repli
   documenté : `htmlLimitedBots: /.*/` désactive ce streaming, au prix du TTFB [S12b].
8. **`revalidate` inerte** sur `/boutique/[slug]` (30) et `/recettes` (60) : à retirer ou à garder
   comme documentation d'intention ?
9. **Adopter `server-only`** sur les modules qui touchent Prisma ou un secret : demande de déclarer
   le paquet (présent seulement comme dépendance de Clerk) et d'ajouter un alias dans
   `vitest.config.ts` [L17]. À décider avec `security-multitenant` et `testing-strategy`.

## Références

- [references/rendu-et-cache.md](references/rendu-et-cache.md) — caches, causes de bascule, carte de rendu, diagnostic
- [references/isr-revalidation.md](references/isr-revalidation.md) — ISR, `generateStaticParams`, `revalidatePath`, écritures à couvrir
- [references/composants-donnees-hydratation.md](references/composants-donnees-hydratation.md) — frontière client, données, prefetch, hydratation
- [references/fichiers-speciaux.md](references/fichiers-speciaux.md) — erreurs, chargement, 404, handlers, metadata
- [references/next15-next16.md](references/next15-next16.md) — changements Next 15/16 et impact chiffré
- [references/patterns.md](references/patterns.md) — dix motifs compilés contre les versions installées
- [references/sources.md](references/sources.md) — sources, crédibilité, dates, preuves locales
