# Rendu, cache CDN et ISR : choisir le mode le moins cher qui reste juste

Identifiants `S…` / `I…` : [sources.md](sources.md). Le fonctionnement interne de l'App Router
(segments, `cookies()`, `headers()`, Suspense) est traité par le skill `nextjs-app-router` ; ici on
ne regarde que **ce que chaque choix coûte**.

## 1. Les quatre modes, du moins cher au plus cher

| Mode | Coût par vue | Symbole dans `next build` | Quand l'utiliser chez nous |
| --- | --- | --- | --- |
| Statique | 1 requête CDN, aucun calcul | `○` | pages éditoriales, 404, mentions légales |
| ISR (`revalidate` + chemins connus) | 1 requête CDN ; au plus 1 fonction par fenêtre et par chemin, seulement s'il est visité | `○` (sans segment dynamique) ou `●` (avec `generateStaticParams`) ; la table de 14.2.35 n'affiche pas la fenêtre | pages villes et SEO, accueil, bons plans, sitemap |
| Dynamique avec cache CDN (`s-maxage`) | 1 requête CDN ; 1 fonction par fenêtre, par région et par URL | `ƒ` | GET d'API publics identiques pour tous |
| Dynamique | 1 requête CDN + 1 fonction à chaque requête, robots compris | `ƒ` | données par utilisateur, mutations, `/suivi/[id]`, `/boutique/[slug]` (voir § 6) |

Règle de décision, dans l'ordre :

1. La réponse dépend-elle de l'utilisateur (session, rôle, panier, prix pro) ? → dynamique,
   `private, no-store`, jamais de cache partagé.
2. Sinon, les chemins sont-ils énumérables au build ? → ISR avec `generateStaticParams`.
3. Sinon (paramètres de requête libres) → route API publique avec `apiCached`, hors matcher.
4. Tout ce qui ne change qu'au déploiement → statique.

Ce qui fait basculer une page en `ƒ` sans prévenir (S28, I1) : `cookies()`, `headers()`, `auth()`
ou `searchParams` lus dans la page ou un layout parent ; un `fetch` en `no-store` ; la prop `dynamic`
sur `<ClerkProvider>` ; `export const runtime = "edge"` ; `export const dynamic = "force-dynamic"`.
Le job CI `build` et `scripts/check-prerender.mjs` détectent la bascule des pages listées dans
`REQUIRED_ROUTES` et un effondrement du total sous `MIN_PRERENDERED_ROUTES`. **Toute nouvelle
famille de pages publiques doit y ajouter un chemin représentatif.**

## 2. ISR : ce qui coûte vraiment

- Une régénération = une invocation de fonction + les requêtes Prisma de la page, puis une écriture
  ISR **seulement si le HTML a changé** (S14). Une horloge ou une valeur aléatoire dans le rendu
  (`new Date()`, `Math.random()`, identifiant généré) change le HTML à chaque fois : écriture
  facturée à chaque régénération (S14, S27). C'est la raison de la règle CLAUDE.md « pas de
  `new Date()` dans le rendu initial ».
- La fenêtre ne limite le coût que si la page est visitée **plus d'une fois par fenêtre**. Avec un
  trafic clairsemé de robots, une fenêtre de 60 s équivaut à « une fonction par visite ». Plafond
  par chemin et par jour : `86 400 / revalidate` (1 440 pour 60 s, 288 pour 300 s, 24 pour 3 600 s,
  1 pour 86 400 s). Consigne Vercel : prendre l'intervalle le plus long compatible avec la
  fraîcheur attendue, et la revalidation à la demande pour les données événementielles (S27).
- Sur un segment dynamique, `revalidate` seul ne met rien en cache : il faut `generateStaticParams`
  (au besoin `return []`, qui rend chaque chemin à la première visite puis le garde en ISR) (S34).
- Le cache CDN régional est « best effort » : une page rarement demandée peut en sortir ; la
  requête suivante lit alors le cache ISR durable (lecture facturée en unités de 8 KB) sans relancer
  la fonction (S14, S17).
- Chaque déploiement de production repart avec son propre cache ISR pour les entrées créées à
  l'exécution (S26) : multiplier les déploiements multiplie les régénérations. Nos pages ISR sont
  prérendues au build, donc ce coût se paie surtout en durée de build et en requêtes Prisma.
- Les requêtes de robots d'exploration, le mode brouillon et le « prerender bypass » peuvent sauter
  le cache ISR et lancer une fonction (S27). Le motif de chaque régénération est visible dans les
  journaux (`time-based revalidation`, `tag-based invalidation`, `collapsed`).

Fenêtres actuelles (ne pas les raccourcir sans chiffrer le plafond ci-dessus) :

| Fenêtre | Pages |
| --- | --- |
| 86 400 s | `a-propos`, `presse`, `click-and-collect-halal`, `boucheries-halal-rhone-alpes`, `devenir-boucher-partenaire/[ville]` |
| 3 600 s | `boucherie-halal/[ville]` et `[quartier]`, `boucheries-halal/[departement]`, `boucheries-halal-ouvertes-dimanche/[ville]`, `produits/[produit]/[ville]`, `occasions/[occasion]/[ville]`, `trouver-boucherie-halal`, `commander-viande-halal`, `recettes/[slug]`, `sitemap.ts` |
| 300 s | accueil `(client)/page.tsx`, `bons-plans` et ses 5 sous-pages |
| 60 s | `recettes` (lit `searchParams` : rendue par requête de toute façon) |

Les pages à 3 600 s affichent des `ShopCard` (statut ouvert, occupé, horaires). Les passer à
86 400 s exige d'abord la revalidation à la demande sur **toutes** les mutations de boutique
(environ 25 fichiers, dont `src/lib/shop-status.ts`) : sinon une boutique en pause s'affiche
ouverte pendant 24 h (I1). C'est un chantier à part, pas un réglage.

### Revalidation à la demande (rien n'est câblé aujourd'hui)

`rg "revalidatePath|revalidateTag|unstable_cache" src` ne renvoie rien. Les trois fonctions existent
dans `next/cache` en 14.2.35. Patron à suivre quand le chantier sera ouvert :

```ts
// src/lib/revalidate-shop.ts — un seul endroit possède l'invalidation (anti-pattern n° 5 de S26)
import { revalidatePath } from "next/cache";

export function revalidateShopPages(citySlug: string | null) {
  revalidatePath("/");
  if (citySlug) revalidatePath(`/boucherie-halal/${citySlug}`);
}
```

Règles : chaque écriture qui change ce qu'une page ISR affiche appelle ce helper ; un point d'entrée
HTTP de revalidation doit être authentifié et refuser par défaut (un point de purge ouvert laisse
n'importe qui déclencher des régénérations facturées, S26) ; viser le plus petit ensemble de pages
(S27).

## 3. Cache CDN des réponses d'API

Une fonction renvoie par défaut `public, max-age=0, must-revalidate` : rien n'est mis en cache
(S16). Pour que le CDN garde une réponse, il faut `s-maxage`, éventuellement
`stale-while-revalidate` (réponse périmée servie tout de suite, rafraîchie en arrière-plan) et
`stale-if-error` (S16). Notre helper le fait déjà :

```ts
// src/lib/api/errors.ts — apiCached(data, maxAge = 60)
// → "Cache-Control: public, s-maxage=<maxAge>, stale-while-revalidate=<2 × maxAge>"
return apiCached(shops, 60);
```

Le CDN ne met en cache que si **toutes** ces conditions sont vraies (S17) : méthode GET ou HEAD ;
pas d'en-tête `Authorization` dans la requête ; statut 200, 301, 302, 307, 308, 404 ou 410 ; moins
de 10 MB ; pas de `Set-Cookie` dans la réponse ; pas de `private`, `no-cache` ni `no-store` ; pas de
`Vary: *` ni `Vary: Cookie`. Vercel retire `s-maxage` avant d'envoyer la réponse au navigateur ;
`Vercel-CDN-Cache-Control` prime sur `CDN-Cache-Control`, qui prime sur `Cache-Control` ; un en-tête
posé par la fonction prime sur `next.config.mjs` (S16).

La clé de cache du CDN est faite de la méthode, de l'URL (chaîne de requête comprise pour une
fonction), de l'hôte, du déploiement et du schéma, plus `Accept` et `Accept-Encoding` (S41, S17).
**Les cookies n'en font pas partie**, et un `Vary: Cookie` rend la réponse non cacheable au lieu de
la séparer par visiteur (S17). Donc :

- **Jamais `apiCached` sur une réponse qui dépend de l'utilisateur.** L'audit a trouvé deux fuites
  de prix professionnels de cette famille (`/api/search`, cache Redis partagé de `/api/products`),
  corrigées depuis (`0d6fd80`) (I1). `cost-audit.mjs` signale tout fichier qui combine cache public et helper d'auth.
- Un GET public cacheable doit remplir trois conditions pour ne rien coûter en HIT : aucun import de
  `server-auth`, `boucher-auth` ou `admin-auth` dans sa fermeture d'imports ; chemin exclu de
  `config.matcher` (sinon le middleware tourne avant le cache) ; `apiCached` sur **toutes** les
  branches de retour (l'audit avait trouvé `/api/shops/nearby` sans en-tête sur la branche Redis).
  Modèle en place : `src/app/api/shops/nearby/route.ts`. Candidates signalées par le script :
  `/api/calendar-events`, `/api/suggestions`.
- **Cardinalité de la clé** (anti-pattern n° 4 de S26) : `NearbyShops.tsx` appelle
  `/api/shops/nearby?lat=${lat}&lng=${lng}&radius=15` avec les coordonnées brutes, alors que la
  route arrondit à 2 décimales pour sa clé Redis. Chaque visiteur produit une URL différente, donc
  un MISS et une fonction. Arrondir côté client (`lat.toFixed(2)`) aligne l'URL sur la clé Redis.
  Même réflexe pour tout paramètre libre : normaliser avant d'appeler.
- `/api/geo` dépend de l'IP : jamais de cache partagé. Stocker le résultat dans `sessionStorage`
  côté client pour ne pas le redemander à chaque page (I1).

Vérifier après déploiement (deux appels, le second doit être servi par le cache) :

```bash
curl -sI "https://klikandgo.app/api/shops/nearby?lat=45.57&lng=5.92&radius=15" | grep -i -E "x-vercel-cache|cache-control"
```

`x-vercel-cache: MISS` puis `HIT` (ou `STALE`) : le cache fonctionne. Toujours `MISS` : chercher un
`Set-Cookie`, un `Vary: Cookie` ou une URL qui change.

## 4. Client : ne pas fabriquer de requêtes

- **Aucun appel API au montage pour un visiteur anonyme.** Garde en place :
  `(isLoaded && isSignedIn) || hasTestModeCookie()` (`src/lib/test-mode-client.ts`). Avant
  correctifs, une vue anonyme de l'accueil déclenchait 7 appels API, soit 14 exécutions facturées ;
  il en reste 2 (I1). `hasTestModeCookie()` lit le cookie d'indice `klikgo-test-activated` : il
  sert seulement à décider d'appeler ou non. Depuis `2364ef9` le serveur n'accepte que le jeton
  signé `klikgo-test-session` et le mode test est coupé sur la production Vercel : ne jamais
  utiliser cet indice comme preuve côté serveur.
- **`prefetch={false}` sur les liens en masse.** `next/link` précharge tout lien visible, en
  production (S33). Le pied de page porte environ 130 liens : `SeoFooter.tsx` les fait passer par un
  wrapper `<NextLink prefetch={false} {...props} />`. Vers une page ISR, un prefetch peut déclencher
  une régénération ; vers une page `ƒ`, une fonction.
- **Polling** : `useVisiblePolling` / `startVisiblePolling` (`src/hooks/useVisiblePolling.ts`) :
  rien quand l'onglet est caché, un seul appel en vol, backoff sur échec. Le Mode Cuisine garde sa
  boucle propre (`src/hooks/use-order-polling.ts`) car il pilote l'alerte sonore : onglet caché,
  elle **ralentit à 15 s** (`HIDDEN_INTERVAL_MS`) au lieu de s'arrêter, soit 5 760 appels par jour
  pour une tablette laissée en arrière-plan. Vercel cite le polling et le rechargement au focus
  parmi les causes de requêtes en excès (S12, S28).
- **Appels morts** : une URL d'API supprimée mais encore appelée coûte un middleware et une 404 par
  vue (cas `/api/loyalty/status` de l'audit). Supprimer l'appel avec la route.

## 5. Images

Sur Vercel, `/_next/image` est servi par le service d'optimisation de la plateforme : chaque
variante absente ou périmée du cache est une transformation facturée, et il y a une entrée par
combinaison largeur × qualité × format (S15, S29). Notre configuration (`next.config.mjs`) :
`minimumCacheTTL` de 30 jours (proche des 31 jours conseillés par S29), 13 largeurs, `remotePatterns`
restreints à 4 hôtes (une URL source inattendue est refusée en 400, ce qui empêche un tiers de
fabriquer des variantes).

- Ne pas ajouter de largeur, de qualité ou d'hôte distant sans raison : chaque ajout multiplie les
  variantes possibles. Les composants utilisent les qualités 60, 70, 75 et 80 : en réutiliser une.
  `images.qualities` existe en 14.2.35 pour imposer une liste fermée, mais dans cette version une
  prop `quality` absente de la liste **lève une erreur** au lieu d'être arrondie (S29 ;
  `next/dist/shared/lib/image-loader.js`, `next/dist/server/image-optimizer.js`) : lister d'abord
  toutes les valeurs de `rg "quality=\{" src` avant d'activer l'option. Une image sans prop
  `quality` prend la valeur de la liste la plus proche de 75.
- `unoptimized` au cas par cas pour les logos, icônes, images de moins de 10 KB et GIF animés ;
  jamais globalement (S29).
- `OfferPopup` utilise `<img>` natif (règle CLAUDE.md) : aucune transformation, donc aucun coût
  d'optimisation, mais le poids transféré est celui du fichier source.
- Quota Hobby : 5 000 transformations par mois ; au-delà les nouvelles images renvoient 402 (S15).
- Formats : déclarer AVIF en plus de WebP double les transformations et les entrées de cache, et
  Vercel sert alors AVIF aux navigateurs qui l'acceptent (S29). Voir
  [points-a-arbitrer.md](points-a-arbitrer.md) § D avant de toucher à `images.formats`.

## 6. Le cas `/boutique/[slug]`

Gabarit public le plus visité, il reste rendu à chaque requête : il n'a pas de
`generateStaticParams`, et `getShop` lit Upstash par un `fetch` en `no-store`, ce qui fait échouer
la génération statique en production (commentaire en tête de
`src/app/(client)/boutique/[slug]/page.tsx`, I1). Son `revalidate = 30` est donc sans effet.
Conséquences : une fonction par vue humaine ou robot. Ne pas « réparer » en ajoutant
`generateStaticParams` seul.
Options et arbitrage : [points-a-arbitrer.md](points-a-arbitrer.md) § F.
