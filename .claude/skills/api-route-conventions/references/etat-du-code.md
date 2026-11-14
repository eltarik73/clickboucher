# État du code — les route handlers au 2026-11-14

Base : `HEAD 32c581f` + l'arbre de travail du chantier « prix des commandes » (non commité, et qui
bouge encore : treize `route.ts` supprimés sous `orders/`, `offers/`, `checkout/validate-code` ; trois
ajoutés : `orders/quote`, `boucher/orders/kitchen`, `boucher/orders/pending-count`). Décrire le code
tel qu'on le trouve : relancer l'audit avant de citer un chiffre.

```bash
node .claude/skills/api-route-conventions/scripts/audit-routes.mjs                    # synthèse
node .claude/skills/api-route-conventions/scripts/audit-routes.mjs --list nan-query   # fichiers d'une règle
```

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md).

## 1. Inventaire (arbre de travail, 2026-11-14 à 08 h 35)

Le chantier prix écrit encore dans l'arbre : entre 07 h 50 et 08 h 35, quatre comptes ci-dessous ont
bougé d'une unité, `src/lib/api/index.ts` a disparu et `errors.ts` a gagné `privateNoStore`. Lire ces
valeurs comme des ordres de grandeur datés.

| Mesure | Valeur |
| --- | --- |
| Fichiers `route.ts` / méthodes exportées | 188 / 249 (117 GET, 69 POST, 41 PATCH, 22 DELETE, 0 PUT) ; 198 fichiers à `HEAD` |
| Plus longs | `payments/webhook` 524, `chat` 412 (> 300) ; `products` 285 ; `boucher/orders/[orderId]/action` passé de 690 à **66** lignes |
| `try` + `handleApiError` | 185 fichiers avec `try`, 171 avec `handleApiError` |
| Helpers d'auth : `requireAdmin` / `getServerUserId` / `getAuthenticatedBoucher` / `verifyCronAuth` / `getBoucherOwnerUserId` | 59 / 48 / 47 / 16 / 9 fichiers |
| `auth()` ou `currentUser()` importés de Clerk dans un handler | 0 (ils vivent dans `boucher-auth.ts`, `admin-auth.ts`, `server-auth.ts`, seuls autorisés) |
| Fichiers qui importent `zod` | 68 ; schémas partagés dans `src/lib/validators/{index,order}.ts` et `src/lib/validations/{campaign,offer}.ts` |
| Rate limit | 36 fichiers ; **76 fichiers qui mutent sans rate limit** (audit `no-rate-limit`) |
| `apiCached` / `apiPaginated` / `privateNoStore` | 7 / 2 / 3 fichiers |
| Config de segment | 181 fichiers `force-dynamic`, 1 en `revalidate` (`calendar-events`), 6 sans rien (`admin/scrape-butchers`, `auth/otp/send`, `auth/otp/verify`, `cart/add`, `cart/reserve`, `payments/[orderId]`) |
| `params` lu comme objet synchrone | 48 fichiers (3 déjà en `Promise`) |
| Fabriques `*Route` | 0 / 249 |

Ce que le socle fait déjà bien, et qu'on garde : une enveloppe unique (`src/lib/api/errors.ts`), des
helpers d'auth qui portent le test mode (jeton signé, coupé en production Vercel : `CLAUDE.md`
§ Test Mode), la logique des commandes sortie dans `src/lib/services/orders/` avec un résultat
`{ ok: true … } | { ok: false, code, message }`, les commandes de transition traduites en HTTP par
`transitionResponse`, des tests de handlers par mocks hoistés (`tests/api/**`) **et** contre une
vraie base (`tests/integration/api/public-exposure.test.ts`), et le verrou du matcher
(`middleware-matcher.test.ts`).

## 2. Ce qui se répète dans chaque fichier

```ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await getAuthenticatedBoucher();          // 1. auth
    if (authResult.error) return authResult.error;
    const rl = await checkRateLimit(rateLimits.api, `x:${authResult.shopId}`);   // 2. rate limit
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");
    const data = schema.parse(await req.json());                 // 3. validation
    // … logique …
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "x");                           // 4. erreurs
  }
}
```

Huit à douze lignes recopiées par méthode, et chaque copie peut diverger. Les écarts ci-dessous sont
des divergences de ce squelette — c'est ce que la fabrique supprime.

## 3. Écarts constatés

### E1 — Un JSON mal formé répond 500 et part chez Sentry
`await req.json()` lève `SyntaxError` ; `handleApiError` ne le reconnaît pas ⇒ `INTERNAL_ERROR` 500 +
`captureException` [L2]. Reproduit le 2026-11-14 sur `POST /api/cart` **et** `POST /api/orders` [L3].
Tous les handlers qui lisent un corps sont concernés, sauf ceux qui ont leur propre `try` interne
(`favorites/toggle`). Dub et Formbricks renvoient 400 dans ce cas [S22][S23]. Ne pas corriger dans
`handleApiError` : un `SyntaxError` peut aussi venir du `JSON.parse` d'une réponse tierce (sortie
d'IA), qui est bien une erreur serveur.

### E2 — `NaN` dans la pagination (4 fichiers)
`Math.max(1, parseInt(sp.get("page") || "1"))` vaut `NaN` pour `?page=abc` [L4] ; `skip: NaN` atteint
Prisma [L3] ⇒ 500. Fichiers : `admin/orders`, `boucher/clients`, `boucher/products`,
`webmaster/prospects`. Même famille : `where.status = sp.get("status")` sans énumération
(`admin/orders/route.ts`) ⇒ erreur de validation Prisma ⇒ 500 au lieu de 400.

### E3 — Quatre formes de réponse d'erreur
| Forme | Où (audit `raw-response`) |
| --- | --- |
| `{ success: false, error: { code, message, details? } }` | la norme (`apiError`) |
| `{ error: "texte" }` | `search`, `cart/add`, `support/ai-respond`, `chat`, `cron/recalc-shop-tiers`, `admin/scrape-butchers` |
| `{ user: null }`, `{ admin: false }` | `auth/me`, `auth/check-admin` |
| texte brut | `orders/[id]/stream`, `boucher/orders/stream` (flux SSE, exception légitime § 4) |

Un écran qui lit `json.error?.message` reçoit `undefined` sur la deuxième forme : même famille que
le « bug recherche » déjà corrigé (structure de réponse inattendue côté écran).
`admin/scrape-butchers` renvoie aussi le texte de l'exception (audit `error-leak`).

### E4 — Rate limit sans contrat
Aucun `Retry-After` dans le dépôt ; `checkRateLimit` ne renvoie pas `reset` [L8]. Deux routes répondent
`CAPACITY_EXCEEDED` (réservé à la capacité de la boutique) pour un rate limit utilisateur :
`orders` (POST) et `checkout/guest`. Plusieurs façons de lire l'IP (`x-forwarded-for` entier,
premier élément, `x-real-ip`). 76 fichiers qui mutent n'ont aucune limite.

### E5 — Pagination au cas par cas
Plusieurs vocabulaires (`page`+`perPage` par schéma, `page`+`limit`, `limit` seul, taille codée en
dur), plusieurs formes de sortie (`apiPaginated`, pagination rangée dans `data`, rien). 31 fichiers
sur 75 qui appellent `findMany` n'ont aucun `take:` [L17].

### E6 — Prisma reconnu par le texte de ses messages
`handleApiError` cherche « Record to update not found », « Record to delete does not exist »,
« Unique constraint »… [L2]. Les deux premiers textes n'existent plus dans le moteur de requêtes
installé (6.19.2) : `P2025` y est formulé « An operation failed because it depends on one or more
records that were required but not found » [L2]. Un `P2025` non intercepté finit donc en 500.
Cal.com reconnaît Prisma par classe et par `code` [S21] ; les codes sont documentés [S15] ; le dépôt
a déjà `uniqueViolationFields` (`src/lib/prisma-errors.ts`) pour `P2002`.

### E7 — Deux sens pour `userId`
`requireAdmin().userId` est un identifiant Clerk, `getAuthenticatedBoucher().userId` un identifiant
Prisma [L13]. C'est la cause du correctif `e3b1629` (« coupon validation userId mismatch ») et de la
règle « Résolution userId » de `CLAUDE.md`. De nombreux fichiers refont à la main
`prisma.user.findUnique({ where: { clerkId } })` ou passent par `getOrCreateUser`.

### E8 — Variante publique cachée et variante privée sur la même URL (corrigé dans l'arbre de travail)
À `HEAD`, `GET /api/products/[id]` [L10] rend au public `apiCached(…, 60)` (projection publique) et
au propriétaire, aux admins et aux `CLIENT_PRO` une réponse non cachée (ligne complète ou prix pro).
Vercel ne cache pas une réponse `private`/`no-store`, mais rien dans ses critères n'exclut une
requête porteuse de cookies [S12], et les cookies ne font pas partie de sa clé de cache [S12b] :
tant que l'entrée publique est fraîche (60 s), un propriétaire reçoit la variante publique, et son
formulaire d'édition la réenregistre. Le chantier prix l'a corrigé le 2026-11-14 : les trois branches
du `GET` passent par `privateNoStore(...)` (`src/lib/api/errors.ts`), plus aucun `apiCached`. Deux
autres `GET` du chantier font de même (`boucher/orders/kitchen`, `boucher/orders/pending-count`) ;
une fabrique personnalisée pose le même en-tête sans qu'on l'écrive.

Reste de la même famille : `search` pose `apiCached(…, 30)` après avoir lu la session, pour sa seule
clé de rate limit (audit `shared-cache-with-auth`). La réponse ne dépend pas du visiteur depuis
`0d6fd80`, mais la lecture de session coûte une exécution par MISS : `openRoute`, limite par IP.

Comportement du CDN établi par la documentation, **non mesuré**. La mesure n'a besoin ni de session
ni de preview — trois `GET` sur une URL publique servie par `apiCached`
(`/api/categories?shopId=<id>`, par exemple) : `curl -sI '<url>'` deux fois (le second doit dire
`x-vercel-cache: HIT`, sinon rien n'est caché et la question tombe), puis
`curl -sI -H 'Cookie: sonde=1' '<url>'` ; un `HIT` confirme que le cookie ne sépare pas les entrées.

### E9 — Valeurs métier acceptées depuis le corps (corrigé dans l'arbre de travail)
Jusqu'au chantier prix, `createOrderSchema` acceptait `discountCents` et `createOrder` l'appliquait
dès qu'une offre active était citée [L9]. Le chantier l'a retiré : les schémas de
`validators/order.ts` sont `.strict()` et ne portent aucun montant ; le total confirmé par le client
n'est qu'un contrôle (`PRICE_CHANGED`). Leçon conservée : Zod valide une forme, jamais une valeur que
le serveur sait calculer. Reste à nettoyer : `toggleFavoriteSchema` (`validators/index.ts`) déclare un
`userId` dans le corps (non utilisé par la route, qui redéclare son propre schéma).

### E10 — Idempotence de création (corrigé dans l'arbre de travail)
`createOrder` lit la clé, renvoie `CONFLICT` si la commande appartient à un autre client, et ne
traite un `P2002` comme un rejeu que si `uniqueViolationFields` désigne `idempotency_key` [L9].
Contrat détaillé : `order-lifecycle-realtime`.

### E11 — Divers
- `console.*` dans 5 handlers (`auth/me`, `chat`, deux flux SSE, `webhooks/clerk`) au lieu de
  `logger` ; `withRequestId` existe dans `src/lib/logger.ts` mais n'est appelé nulle part.
- 3 handlers sans `try` (`cart/reserve`, `payments/[orderId]`, `test-mode/status`), dont deux
  bouchons « Not implemented » toujours routés.
- 8 `await sendNotification(...)` restent dans le chemin de réponse [L17] (les annonces de commande
  passent désormais par `services/orders/announce.ts`) : voir `background-jobs-notifications`.
- `src/lib/validators/index.ts` fait 450 lignes (limite 300).
- `tests/security/multitenant.test.ts` teste des copies locales de `isAdmin`/`isBoucher`, pas les
  vraies fonctions ni un handler : il ne peut pas détecter une régression.
- Faux positif connu de l'audit `unvalidated-body` : `orders/[id]/adjust-price` passe le corps brut
  à `adjustOrderPrice`, qui le valide (`safeParse`). Migration : `body: z.unknown()`.
- `cron/route.ts` (17ᵉ fichier de `cron/`, « master cron ») compare `x-cron-secret` à la main au
  lieu d'appeler `verifyCronAuth` comme les 16 autres : il refuse donc l'en-tête
  `Authorization: Bearer` qu'envoie Vercel. Il n'est pas dans `vercel.json` ; le passer sur
  `cronRoute` aligne son contrôle (les deux en-têtes acceptés).
- Le baril `src/lib/api/index.ts` et le client navigateur `src/lib/api/client.ts` ont été supprimés
  par le chantier prix ; `src/lib/api/` ne contient plus que `errors.ts` [L18]. Tant que le chantier
  écrit, `npx tsc --noEmit` peut sortir des erreurs passagères dans des fichiers que vous n'avez pas
  touchés (une erreur à 07 h 55, plusieurs centaines à 08 h 20, zéro à 08 h 35) : relancer, puis
  lire `git status` avant de conclure.

## 4. Exceptions légitimes

**Hors fabrique** — un seul fichier : `calendar-events/route.ts`. C'est le seul handler prérendu
(`revalidate = 60`, `○` dans la table du build) ; une fabrique lit `req.headers` et le rendrait
dynamique [L19]. Il garde son `GET()` sans argument, son `try/catch` + `handleApiError` et
`apiCached`. Le jour où ce cache n'est plus voulu, il passe sur `openRoute` avec `force-dynamic`.

**Hors enveloppe** — seule la réponse **de succès** est dispensée de `{ success, data }` ;
l'authentification, la validation et le `try/catch` (ou la fabrique) restent obligatoires.

| Famille | Fichiers | Pourquoi |
| --- | --- | --- |
| Webhooks signés | `webhooks/clerk`, `payments/webhook` | Contrat du fournisseur ; corps brut `req.text()` pour la signature ; 2xx = acquitté, 5xx = à rejouer |
| Flux SSE | `orders/[id]/stream`, `boucher/orders/stream` | `text/event-stream` (leur avenir : `order-lifecycle-realtime`) |
| Fichiers | `orders/export`, `boucher/finances/export`, `users/me/export`, `boucher/images/proxy` | CSV, JSON téléchargé, binaire |
| Sondes | `health`, `test-mode/*` | Lues par un outil externe ou par le sélecteur de rôle |

`scripts/audit-routes.mjs` porte cette liste (`EXEMPT_ENVELOPE`).

## 5. Leçons de l'historique [L11]

| Commit | Ce qui a dû être corrigé en masse |
| --- | --- |
| `b4cf98c` | Zod ajouté à 18 routes de mutation |
| `3e0e236` | Gestion d'erreur refaite dans 14 routes |
| `c514358`, `d0a1598` | Isolation multi-tenant : 12 requêtes Prisma, puis contrôle de propriété dans 21 routes |
| `ff0752e` | `force-dynamic` oublié sur les nouvelles routes ⇒ build Vercel cassé |
| `6f75818` | `BigInt` non sérialisable ⇒ correctif global dans `errors.ts` |
| `5d74e38` | `/api/cart` répondait 401 aux anonymes au lieu d'un panier vide |
| `7813dc7`, `0d6fd80` | Cron qui répondait 500, puis cron accessible sans secret |
| `f2cac19` | `auth()` appelé sur un chemin hors middleware ⇒ 500 |
| `0747029` | Route de 497 lignes scindée en contrôleur + services |

Chaque ligne est une règle qu'un squelette commun aurait rendue impossible à oublier.
