# `error.tsx`, `loading.tsx`, `not-found`, Route Handlers, métadonnées

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md).

## 1. Frontières d'erreur

Ce que fait réellement `error.tsx` [S7] :

- c'est un Error Boundary React : obligatoirement `"use client"`, il enveloppe la `page.tsx` du
  segment **et ses segments enfants** ;
- il **ne capte pas** une erreur du `layout.tsx` du **même** segment (le boundary est à l'intérieur
  du layout) : c'est l'`error.tsx` du segment **parent** qui la reçoit ;
- `app/error.tsx` ne capte donc pas une erreur du layout racine : il faut `app/global-error.tsx`,
  qui remplace le layout racine et doit rendre ses propres `<html>` et `<body>` [S7][S26] ;
- en production, une erreur levée dans un Server Component arrive au boundary avec un message
  générique et un `digest` à rapprocher des logs serveur.

État du dépôt [L13] :

| Fichier | Couvre | Ne couvre pas |
| --- | --- | --- |
| `src/app/error.tsx` | pages hors groupe ; layouts de `(client)`, `(boucher)`, `(admin)`, `webmaster`, `onboarding`, `devenir-boucher-partenaire/[ville]` | le layout racine (`ClerkProvider`, `ThemeProvider`, `NotificationProvider`) |
| `src/app/(client)/error.tsx` et équivalents `(admin)`, `(auth)`, `(boucher)`, `webmaster` | les pages du groupe et les layouts de ses sous-segments (`panier`, `profil`…) | le layout du groupe lui-même (`(auth)` n'en a pas) |
| `src/app/global-error.tsx` | **absent** | — |

Règles :

1. Tout nouveau groupe de routes ou segment qui possède un `layout.tsx` reçoit un `error.tsx`
   (`CLAUDE.md`), en gardant en tête qu'il protège les **enfants** de ce layout.
2. Ne jamais afficher `error.message` à l'utilisateur ; afficher un texte fixe, proposer `reset()`
   et un lien de sortie (modèle : `src/app/(client)/error.tsx`).
3. Les six `error.tsx` actuels font seulement `console.error` : aucune remontée Sentry ni `logger`
   [L13]. La capture serveur automatique `onRequestError` de Sentry exige Next 15 [S25]. Le
   câblage relève du skill `reliability-observability` ; le motif `global-error.tsx` vérifié est
   dans [patterns.md](patterns.md).
4. Sous ISR, une erreur de rendu **serveur** pendant une régénération ne montre pas `error.tsx` au
   visiteur : la régénération échoue et l'ancienne page reste servie [S5][S22]. Ce filet n'existe
   pas pour un chemin non prégénéré au build (liste vide ou partielle) lors de sa première visite,
   qui se répète après chaque déploiement puisque le cache ISR est propre au déploiement [S22] :
   il n'y a pas d'ancienne page à servir. `error.tsx` sert surtout aux erreurs de rendu **client**
   et aux routes dynamiques.

## 2. `loading.tsx` et streaming

- `loading.tsx` crée une frontière `Suspense` autour de la page : état de chargement instantané à
  la navigation [S8], et limite de ce qui est préchargé pour une route dynamique [S9].
- **Statut HTTP** : dès que le streaming a commencé, la réponse est en 200. Un `notFound()` levé
  ensuite donne un 200 avec `noindex` ; sans streaming, un vrai 404 [S8][S8b].
- En Next 14, `generateMetadata` est résolu **avant** le début du streaming [S8]. C'est pourquoi
  `src/app/(client)/boutique/[slug]/page.tsx` appelle `notFound()` **dans `generateMetadata`** : la
  boutique inexistante renvoie un vrai 404 malgré son `loading.tsx` (audit du 2026-06-12). Ce
  comportement change en 15.2 : voir [next15-next16.md](next15-next16.md).
- Une page statique/ISR est servie complète : son `loading.tsx` ne s'affiche qu'en navigation
  cliente. Une page à `useSearchParams()` sans `<Suspense>` explicite, en revanche, a pour HTML
  prérendu le `loading.tsx` parent [S10] (trois pages concernées et remèdes :
  [rendu-et-cache.md](rendu-et-cache.md) § 2).

Règles :

1. `loading.tsx` sur toute route `ƒ` et sur les coquilles clientes qui chargent au montage ; inutile
   sur une page de contenu statique.
2. Le squelette reprend la structure et les fonds de la vraie page (`CLAUDE.md` : héros `bg-white`,
   pas noir) — sinon décalage de mise en page à l'arrivée du contenu.
3. Route dynamique indexable avec `loading.tsx` : `notFound()` dans `generateMetadata` **et** dans
   la page, sur la même fonction mémoïsée par `cache()`.
4. Frontière `Suspense` **au-dessus** du composant qui lit `useSearchParams()` ou qui charge, jamais
   à l'intérieur [S23][S10].

## 3. `not-found`

- `src/app/not-found.tsx` est `force-static` : les URL sans route correspondante reçoivent le 404
  prérendu sans exécuter de fonction de page [L10].
- `notFound()` rend le `not-found` le plus proche et ajoute `<meta name="robots" content="noindex">`
  [S8b]. À réserver à « la ressource n'existe pas » : jamais dans un `catch` d'erreur technique,
  jamais dans un `try`.
- Les liens du 404 vers des pages protégées portent `prefetch={false}` (modèle en place).

## 4. Route Handlers (détail : skill `api-route-conventions`)

- Next 14 met en cache un `GET` qui ne lit ni la requête ni une fonction dynamique [S11] ;
  Next 15 ne le fait plus par défaut [S15]. Pour ne dépendre d'aucun défaut :
  **chaque `route.ts` déclare son intention** — `export const dynamic = "force-dynamic"` (190
  fichiers sur 198) ou, pour un `GET` public volontairement mis en cache, `revalidate` (seul cas :
  `src/app/api/calendar-events/route.ts`, 60 s).
- Signature tournée vers l'avenir : `{ params }: { params: Promise<{ id: string }> }` puis
  `const { id } = await params;` — compile en 14.2.35, obligatoire en 15+ [S15][L5][L11].
- Un handler n'est pas dans l'arbre React : pas de déduplication automatique, pas de `cache()`.
- `try/catch` + `handleApiError` + log structuré dans chaque handler (`CLAUDE.md`).
- Un handler qui importe `server-auth`, `boucher-auth` ou `admin-auth` doit être couvert par
  `config.matcher` de `src/middleware.ts` (verrou : `src/lib/__tests__/middleware-matcher.test.ts`).
- Fichiers de métadonnées (`sitemap.ts`, `robots.ts`, `icon.tsx`, `opengraph-image.tsx`) : statiques
  tant qu'ils ne lisent pas la requête [S16]. Jamais de `runtime = "edge"` dessus : l'edge désactive
  le prérendu et l'ISR [S3].

## 5. Métadonnées [S12]

- `metadata` et `generateMetadata` ne s'exportent que d'un **Server Component**, et pas les deux
  dans le même segment. Page `"use client"` ⇒ `layout.tsx` serveur porteur de `metadata`.
- **Fusion superficielle** : un segment qui définit `openGraph`, `twitter` ou `robots` **remplace**
  l'objet du parent en entier. Une page qui pose `openGraph` doit donc redonner `images`,
  `siteName`, `locale` ; une page qui pose `robots` perd les directives `googleBot` du layout racine.
- `title.template` (`%s | Klik&Go`, layout racine) s'applique aux segments enfants : donner un titre
  court sans suffixe ; `title: { absolute: "…" }` pour s'en affranchir (modèle : `a-propos/page.tsx`).
- `metadataBase` est défini dans le layout racine : les URL relatives sont résolues, les URL
  absolues l'ignorent.
- `alternates.canonical` se définit **par page**. Dans un layout, uniquement si ce layout ne sert
  qu'une seule page (layouts porteurs de `metadata` existants) : sinon tous les enfants héritent du
  même canonical.
- Donnée partagée entre `generateMetadata` et la page : une fonction enveloppée dans `cache()`.
- Métadonnées statiques ⇒ objet `metadata`, pas `generateMetadata`.
- Sous ISR, les métadonnées font partie du HTML mis en cache : un `robots` calculé depuis la base
  est figé pour toute la fenêtre. Toute logique `index`/`noindex` suit le skill `seo-anti-penalty`
  (règle du propriétaire : pas de `noindex` automatique sans validation).
- Le layout racine déclare à la fois `openGraph.images` (`/og-image.png`) et un fichier
  `src/app/opengraph-image.tsx`. Dans le code de Next 14.2.35, l'image-fichier n'est appliquée à un
  niveau que si ce niveau ne définit pas `openGraph.images` [L16] : ne pas cumuler les deux sources
  dans un même segment et contrôler la balise `og:image` produite.
- JSON-LD : composants serveur de `src/components/seo/` (dans le HTML, zéro hydratation). Contenu
  des schémas : skills `seo-expert` et `seo-anti-penalty`.
