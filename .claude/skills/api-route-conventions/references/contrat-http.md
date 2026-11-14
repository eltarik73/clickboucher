# Contrat HTTP de l'API Klik&Go

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md). Les extraits de code ont été compilés
contre les gabarits et le client Prisma du dépôt [L7].

## 1. Enveloppe

```jsonc
// Succès (apiSuccess, apiCached)
{ "success": true, "data": … }
// Liste paginée par pages (apiPaginated)
{ "success": true, "data": [ … ], "pagination": { "page": 1, "perPage": 20, "total": 132, "totalPages": 7 } }
// Erreur (apiError, handleApiError)
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Données invalides", "details": { "items.0.quantity": ["…"] } } }
```

- **Le statut HTTP fait foi** ; `success` le redouble pour les écrans. Un écran teste `res.ok` (ou
  `json.success`), affiche `json.error.message`, et ne branche sa logique que sur `json.error.code`.
- **`code` est le contrat, `message` ne l'est pas** [S10][S11] : on peut reformuler un message, jamais
  renommer un code sans mettre à jour ses lecteurs. `message` est en français, affichable tel quel,
  sans détail technique (ni texte d'exception, ni nom de table, ni SQL) [S4 §5].
- `details` : `Record<string, string[]>` produit par `formatZodError` — clé = chemin du champ
  (`items.0.quantity`), `_root` pour l'objet entier.
- Jamais de `data: null` pour dire « introuvable » : c'est `NOT_FOUND`. Exception historique et
  voulue : `GET /api/cart` répond 200 avec un panier vide à un anonyme (`5d74e38`), et `data: null`
  à un client connecté qui n'a pas encore de panier.

### Et RFC 9457 ?
`application/problem+json` est la norme IETF pour les erreurs [S4]. Elle est **facultative** : elle
dit elle-même qu'une application peut avoir une meilleure façon de porter l'erreur dans un format
qu'elle définit déjà, et qu'elle ne vise pas à remplacer les formats existants (§4). Notre enveloppe
est lue par 54 fichiers [L12] ; elle a la même forme que celle des guides Microsoft
(`{ error: { code, message, details } }`) [S11]. Décision : **on garde l'enveloppe**. Correspondance,
si une API publique (clés webmaster) devait un jour l'exposer : `type` ← URI dérivée de `code`,
`title` ← libellé du code, `status` ← statut, `detail` ← `message`, extension `errors` ← `details`.

## 2. Codes et statuts

`ApiErrorCode` et `STATUS_MAP` vivent dans `src/lib/api/errors.ts`. Choisir avec cette table ; le sens
des statuts vient de RFC 9110 §15.5–15.6 [S5].

| Situation | Code | Statut |
| --- | --- | --- |
| Corps, query ou `params` qui ne respecte pas le schéma ; JSON mal formé | `VALIDATION_ERROR` | 400 |
| Pas de session (ou secret de cron invalide) | `UNAUTHORIZED` | 401 |
| Session valide mais rôle insuffisant | `FORBIDDEN` | 403 |
| Ressource absente **ou appartenant à un autre** (boutique, client) | `NOT_FOUND` | 404 |
| L'action ne s'applique plus à l'état courant (commande déjà refusée, course perdue), doublon | `CONFLICT` | 409 |
| Offre ou réservation expirée | `OFFER_EXPIRED`, `RESERVATION_EXPIRED` | 410 |
| Règle métier violée par une demande bien formée (stock, tolérance de poids, produits disparus) | `STOCK_INSUFFICIENT`, `WEIGHT_EXCEEDS_TOLERANCE`, `PRODUCTS_MISSING` | 422 |
| Trop de requêtes d'un même demandeur | `RATE_LIMITED` (+ `Retry-After`) | 429 |
| Boutique saturée, créneau complet | `CAPACITY_EXCEEDED` | 429 |
| Fonction coupée (boutique fermée ou en pause, Stripe ou service d'images non configuré) | `SERVICE_DISABLED` | 503 |
| Paiement en ligne refusé | `PAYMENT_FAILED` (déclaré, émis par aucune route : réservé à `stripe-payment`) | 402 |
| Tout le reste | `INTERNAL_ERROR` (par `handleApiError` uniquement) | 500 |

Règles d'usage :

- **404 plutôt que 403 pour la ressource d'un autre tenant.** RFC 9110 permet de répondre 404 pour
  ne pas révéler l'existence d'une ressource interdite [S5 §15.5.4] ; c'est déjà la convention des
  commandes (`transitionResponse` : « not found = 404, also for an order outside the caller's
  scope »). En pratique : borner la requête (`where: { id, shopId }`) et répondre `NOT_FOUND` si rien
  ne sort. Google AIP-193 retient l'inverse (403 dès que la permission manque) [S10] : choix à
  confirmer (SKILL.md, Points à arbitrer n° 3). Le schéma « `findUnique` par `id` puis comparer
  `shopId` » (`products/[id]/stock`…) répond 403 et confirme donc que l'identifiant existe.
- **`CONFLICT` pour un état, pas `VALIDATION_ERROR`.** « Impossible d'accepter une commande en statut
  X » est un conflit avec l'état de la ressource (409), pas une saisie invalide (400). Aligné sur
  `order-lifecycle-realtime` (« rejouer = 200, course perdue = 409 »).
- **`RATE_LIMITED` ≠ `CAPACITY_EXCEEDED`.** Le premier concerne le demandeur, le second la boutique ;
  les écrans n'affichent pas la même chose. Deux routes les confondent aujourd'hui (E4).
- **Ne jamais renvoyer `INTERNAL_ERROR` à la main** avec un message d'exception : lever, et laisser
  `handleApiError` produire le message neutre et prévenir Sentry [S17].
- Nouveau code : l'ajouter à `ApiErrorCode` **et** `STATUS_MAP`, avec un test dans
  `src/lib/__tests__/api-errors.test.ts`. Pas de chaîne libre (l'ancien `offers/route.ts`, supprimé
  par le chantier prix, renvoyait un code `"INTERNAL"` hors `ApiErrorCode`).
- Méthode non exportée ⇒ Next répond 405 tout seul [S1] : ne pas écrire de handler pour le dire.

## 3. Validation (Zod 3.25, API v3)

| Entrée | Règle | Pourquoi |
| --- | --- | --- |
| Corps | `body: schema` dans la config ; `z.object` retire les clés inconnues [L4] | Empêche l'affectation de masse : `role`, `shopId`, `priceCents` glissés dans un corps ne passent pas [S20, API3] |
| Écriture Prisma | `data: { champ: body.champ, … }` champ par champ, jamais `data: body` | Un champ ajouté plus tard au schéma ne devient pas modifiable par accident |
| Valeur que le serveur sait calculer (prix, remise, total, commission, `shopId` du boucher, `userId`) | **Absente du schéma.** Recalculée ou lue dans `ctx.auth` ; schéma `.strict()` pour qu'un vieux client qui l'envoie reçoive 400 | E9 : `discountCents` était lu dans le corps (retiré par le chantier prix, modèle `validators/order.ts`). `CLAUDE.md` : prix toujours recalculé côté serveur |
| Nombre dans la query | `z.coerce.number().int().min(…).max(…).default(…)` | `""` et `null` deviennent `0`, `"abc"` échoue proprement [L4] ; plus de `NaN` (E2) |
| Booléen dans la query | `z.enum(["true", "false"])`, puis comparer | `z.coerce.boolean()` rend `true` pour `"false"` [L4] |
| Énumération | `z.enum([...])` ou `z.nativeEnum(OrderStatus)` | Une chaîne libre dans un `where` Prisma finit en 500 (E2) |
| Chaîne, tableau | toujours `.max(n)` ; `.trim()` sur le texte libre | Entrées non bornées = consommation non bornée [S20, API4] |
| Date | `z.string().datetime()` : n'accepte que l'UTC en `Z` (ce que produit `toISOString()`), refuse `+01:00` sauf `{ offset: true }`, refuse une date seule [L4] ; convertie dans le handler | Les heures métier passent par `src/lib/paris-time.ts` |
| Identifiant d'URL | `params: z.object({ id: z.string().min(1).max(64) })` | Voir wrapper.md § 3 pour le choix de ne pas imposer `.cuid()` |
| Fichier | `openRoute`/`boucherRoute` **sans** `body`, puis `await req.formData()` dans le handler ; type MIME et taille contrôlés à la main | Modèle : `uploads/product-image/route.ts` |
| Plusieurs valeurs d'une même clé (`?status=A&status=B`) | Non géré par le moteur (dernière valeur gardée) : préférer `?status=A,B` + `.transform((s) => s.split(","))` | `Object.fromEntries(searchParams)` |

Où ranger un schéma : réutilisé ou lié à un modèle ⇒ `src/lib/validators/<domaine>.ts` (le fichier
`index.ts` de 450 lignes est à découper, sans changer les imports grâce aux ré-exports) ; propre à une
route ⇒ constante **non exportée** du `route.ts` (Next refuse tout export qui n'est ni une méthode
HTTP ni une option de segment [L6]). Importer `z` depuis `"zod"` uniquement (API v3, comme tout le
dépôt) ; `zod/v4` est présent dans le paquet [L16] : ne pas l'introduire fichier par fichier, une
montée de version de Zod est un chantier à part.

## 4. Pagination

Paginer **dès la création** de toute liste qui peut dépasser 50 éléments (`CLAUDE.md`) : l'ajouter
après coup change le comportement pour les appelants existants [S9][S11].

| Besoin | Forme | Entrée | Sortie |
| --- | --- | --- | --- |
| Tableau de back-office avec numéros de page et total (commandes admin, prospects, journal d'audit) | pages | `paginationSchema.extend({ … })` ⇒ `page`, `perPage` (20 par défaut, 50 max) | `apiPaginated(data, total, page, perPage)` |
| Flux qui grandit sans borne, lu par défilement ou par sondage (notifications, historique client, événements) | curseur | `cursor?`, `limit` (20 par défaut, 50 max) | `apiSuccess({ items, nextCursor })`, `nextCursor: null` à la fin |

L'offset est simple et permet de sauter à une page, mais la base parcourt quand même les lignes
sautées ; le curseur passe à l'échelle, impose un tri sur une colonne unique et interdit le saut
[S16].

```ts
// Pages — tri stable obligatoire : sans départage unique, une ligne peut sauter ou doubler
const [rows, total] = await Promise.all([
  prisma.order.findMany({
    where, select,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (query.page - 1) * query.perPage,
    take: query.perPage,
  }),
  prisma.order.count({ where }),
]);
return apiPaginated(rows, total, query.page, query.perPage);
```

```ts
// Curseur — demander une ligne de plus pour savoir s'il y a une suite
const rows = await prisma.notification.findMany({
  where: { userId: auth.userId },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: query.limit + 1,
  ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
});
const hasMore = rows.length > query.limit;
const items = hasMore ? rows.slice(0, query.limit) : rows;
return apiSuccess({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
```

- Un seul vocabulaire : `page` / `perPage`, ou `cursor` / `limit`. Plus de `pageSize`, ni de `limit`
  employé comme taille de page. Renommer le paramètre d'une liste existante (`limit` → `perPage` sur
  `admin/orders`) se fait dans le même commit que l'écran qui l'appelle, jamais dans un lot de
  migration mécanique.
- Au-delà du maximum, `paginationSchema` répond 400 (il ne ramène pas à 50, à la différence de ce
  que décrit AIP-158 [S9]) : un écran qui demandait 100 lignes doit être corrigé avec la route.
- Le filtre de tenant (`shopId`, `userId`) est dans le `where` de **chaque** page : un curseur ou un
  numéro de page reçu du client ne donne aucun droit (autorisation au niveau objet [S20, API1]).
- Une liste réellement bornée (catégories d'une boutique, créneaux d'un jour) n'a pas besoin de
  pagination mais garde un `take` de sécurité. Index et plans de requête : `prisma-expert`.

## 5. Rate limit

Outil : `src/lib/rate-limit.ts` (Upstash, fenêtre glissante). Dans une fabrique : `rateLimit: "<nom>"`.

| Limiteur | Budget | Pour |
| --- | --- | --- |
| `api` | 30 / min | mutation ordinaire (défaut) |
| `orders` | 5 / min | création de commande |
| `search` | 30 / min | recherche, suggestions |
| `ai`, `aiChat` | 10 / min, 3 / min | tout appel payant (Anthropic, Replicate) |
| `promoValidate` | 10 / min | validation de code (anti-énumération) |
| `otpSend`, `otpVerify` | 2 / min, 5 / 5 min | codes à usage unique |
| `tickets` | 10 / h | support |

- **Toute mutation a une limite** ; un `GET` en a une s'il est public et coûteux (recherche, IA,
  géocodage) [S20, API4]. Les crons et webhooks signés n'en ont pas.
- **Clé = opération + demandeur**, composée par la fabrique : `${name}:${shopId|userId|clerkId}` ou
  `${name}:ip:<adresse>`. Limiter par boutique ou par compte dès qu'on le peut : derrière une même
  IP il y a toute une boucherie, ou tout un opérateur mobile.
- **Budget d'une route boucher** : le compteur est celui de la boutique, partagé par toutes ses
  tablettes. `api` (30/min) sur les actions de cuisine laisse environ sept commandes par minute si
  chacune demande quatre actions (accepter, préparer, prête, retirée) : avant de poser une limite
  sur une route de cuisine, compter le pic réel (Aïd, Ramadan) et créer au besoin un limiteur dédié
  dans `rateLimits`. Une limite qui bloque un boucher en plein service coûte plus qu'elle ne protège.
- Clé métier (e-mail d'un invité, code promo visé) : appel manuel **après** validation, réponse par
  `tooManyRequests(rl, message)` — jamais un `apiError` 429 écrit à la main.
- Réponse : 429 `RATE_LIMITED` + `Retry-After` en secondes [S5 §10.2.3][S6]. Une réponse 429 ne doit
  pas être mise en cache [S6] ; les fabriques personnalisées posent `no-store`.
- **Comportement en panne** : sans Redis, ou après 5 s sans réponse (défaut d'Upstash), la requête
  passe [L8][S14]. Acceptable pour le confort, discutable pour `otpVerify` et `promoValidate`
  (voir Points à arbitrer). Le limiteur est créé au niveau module : son cache mémoire bloque un
  demandeur déjà limité sans rappeler Redis [S14].
- Le rate limit applicatif ne remplace pas une protection en amont, au niveau de la plateforme :
  `vercel-cost-performance`.

## 6. Cache

| Réponse | En-tête | Comment |
| --- | --- | --- |
| Dépend du demandeur, ou d'un état qui bouge (commandes, panier, back-office) | `Cache-Control: private, no-store` | Posé par toutes les fabriques sauf `openRoute`. Dans un `GET` encore écrit à la main : ne jamais poser `s-maxage` (sans lui, le CDN ne cache rien [S12]) ; pour l'écrire noir sur blanc là où un cache a existé, `privateNoStore(...)` autour de **chaque** réponse, erreurs comprises (modèle : `products/[id]`) |
| Identique pour tous, tolère N secondes de retard | `public, s-maxage=N, stale-while-revalidate=2N` | `openRoute` + `apiCached(data, N)` sur **toutes** les branches de succès |
| Erreur | aucun cache | `apiError` ne pose rien ; Vercel ne cache que 200, 404, 410 et redirections (301, 302, 307, 308) [S12] |

- Le CDN cache un `GET` qui porte `s-maxage`, sauf en-tête `Authorization` sur la requête,
  `set-cookie` ou `private`/`no-cache`/`no-store` sur la réponse [S12]. La clé de cache est faite de
  la méthode, de l'URL, de l'hôte, du déploiement et du schéma [S12b] (plus `Accept` et
  `Accept-Encoding` [S12]) : **les cookies n'y sont pas**. D'après ces deux pages, un visiteur
  connecté reçoit donc l'entrée mise en cache pour un anonyme (non mesuré ; recette : etat-du-code E8).
  **Une URL = une variante.** Variante par utilisateur ⇒ URL distincte ou aucun cache.
  `Vary: Cookie` n'est pas une solution : Vercel ne met alors rien en cache [S12].
- Un 404 porteur de `s-maxage` serait mis en cache : `apiError` n'en pose pas, ne pas en ajouter.
- Un `GET` cachable n'appelle **aucun** helper de session, même pour une clé de rate limit (limiter
  par IP), et vit hors du matcher Clerk quand c'est possible : sinon chaque HIT paie le middleware
  (`vercel-cost-performance`).
- Normaliser la query avant de s'en servir (minuscules, tri, valeurs par défaut) : chaque variante
  d'URL est une entrée de cache.
- Chaque `route.ts` déclare `export const dynamic = "force-dynamic"` : Next 14 met en cache un `GET`
  qui ne lit pas la requête, Next 15 ne le fait plus [S1][S3] ; on ne dépend d'aucun des deux
  défauts. Seule exception, `calendar-events` : `revalidate = 60`, prérendu au build, écrit à la
  main. Il ne passe pas sur une fabrique, qui le rendrait dynamique [L19] (wrapper.md § 2.5).
- Un cache Redis partagé obéit à la même règle que le CDN : la clé contient tout ce qui fait varier
  la réponse, et la variante privée n'y entre jamais (`0d6fd80`).

## 7. Idempotence

`GET`, `PUT` et `DELETE` sont idempotents par définition [S5 §9.2.2] ; `POST` ne l'est pas, `PATCH`
non plus [S29], et un client ne devrait pas rejouer seul une requête non idempotente [S5 §9.2.2]. Or le réseau mobile rejoue,
les doigts aussi. Quatre cas, quatre réponses :

| Cas | Garantie | Modèle |
| --- | --- | --- |
| **Création à effet réel** (commande, session de paiement, remboursement) | Clé générée par le client (UUID v4 [S8]), stockée dans une colonne `@unique` **dans la même transaction** que l'effet ; rejeu ⇒ 200 avec la ressource d'origine | `Order.idempotencyKey` (`@unique`, colonne `idempotency_key`) et `services/orders/create.ts` ; contrat détaillé : `order-lifecycle-realtime` |
| **Transition d'état** (accepter, refuser, prête, retirée) | Écriture conditionnelle sur l'état attendu ; rejouer ⇒ 200 avec l'état courant, course perdue ⇒ 409 | `order-lifecycle-realtime`, patron A |
| **Webhook** | Identifiant d'événement du fournisseur inséré **avant** le traitement, dans la base | `StripeEvent` (`payments/webhook`). `webhooks/clerk` déduplique `svix-id` dans Redis (`SET NX`, 24 h) et laisse passer si Redis manque : acceptable tant que ses effets sont des `upsert`, pas au-delà |
| **Affectation d'une valeur** (stock, statut boutique, favori) | Rendre l'opération idempotente par nature : `PATCH { inStock: false }`, `PUT`/`DELETE` d'un favori | Éviter les bascules : `favorites/toggle` s'annule sur un double appui |

Règles pour une clé d'idempotence :

- Transport : en-tête `Idempotency-Key` pour tout nouvel endpoint (`readIdempotencyKey(req)`), comme
  Stripe [S8] et le brouillon IETF [S7] ; `POST /api/orders` garde son champ `idempotencyKey` dans le
  corps (contrat existant).
- **Bornée au demandeur** : la ligne retrouvée par la clé n'est rendue que si elle appartient au
  demandeur, sinon `CONFLICT` (`findByIdempotencyKey` de `services/orders/create.ts`).
- C'est la **contrainte unique** qui arbitre, pas la lecture préalable : deux requêtes simultanées
  passent toutes deux la lecture. Sur `P2002`, savoir quelle contrainte a parlé avant de conclure :
  `uniqueViolationFields(error)` (`src/lib/prisma-errors.ts`) renvoie les **colonnes de la base**
  (`["idempotency_key"]`), pas les noms de champs Prisma. Modèle : `creationFailure` dans
  `services/orders/create.ts`.
- Statuts, par convention [S7] : clé exigée mais absente ⇒ 400 ; même clé avec un autre corps ⇒ 422 ;
  même clé encore en cours de traitement ⇒ 409. À n'implémenter que là où le cas existe.
- Pas de magasin de clés dans Redis : il « laisse passer » en panne [L8].

## 8. Journalisation et corrélation

- `logger` de `src/lib/logger.ts` (JSON en production), jamais `console.*`. Forme :
  `logger.warn("[orders/accept] transition refusée", { orderId, shopId, from, to })` — message court
  et stable, données dans l'objet.
- **Ne pas journaliser** : corps de requête complets, e-mails, téléphones, jetons, codes de retrait.
  Identifiants internes uniquement (voir `conformite-france` pour le RGPD).
- Une erreur inattendue se **lève** : `handleApiError` la journalise et l'envoie à Sentry avec le tag
  `route` ; la fabrique ajoute `request_id`. Ne pas appeler en plus `logger.error` sur la même erreur :
  en production il envoie lui aussi à Sentry (deux événements).
- Les 4xx attendus (validation, 401, 404, 409) ne sont pas des erreurs à remonter : ni `logger.error`
  ni Sentry — c'est aussi le choix de Cal.com [S21].
- Chaque réponse d'une fabrique porte `x-request-id` (repris de `x-vercel-id` sur Vercel [S13]) : le
  donner au support suffit pour retrouver la ligne `[api] réponse 5xx` et l'événement Sentry [S11].
  La doc Vercel décrit `x-vercel-id` comme la liste des régions traversées, sans garantir son
  unicité : s'en servir pour retrouver une requête, pas comme clé.
- Action d'administration qui modifie une boutique, un rôle, une commission ou un paiement :
  `writeAuditLog({ actorId: auth.clerkId, action, target, targetId })` (`src/lib/audit-log.ts`, ne
  lève jamais) — 11 fichiers de `src/app/api` l'appellent aujourd'hui [L17].
