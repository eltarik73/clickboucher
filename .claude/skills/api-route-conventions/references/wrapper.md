# La fabrique de routes : approches évaluées, spécification, décisions

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md). Code de référence : `templates/`
(compilé et testé contre les versions installées [L7]).

## 1. Approches évaluées

| Approche | Vue dans | Verdict pour Klik&Go | Raison |
| --- | --- | --- | --- |
| **Fabrique par type d'accès**, écrite dans le dépôt : `withWorkspace`, `withSession`, `withCron` | Dub [S22] | **Retenue** | Même forme que nos helpers (`getAuthenticatedBoucher`, `requireAdmin`…) ; le handler reçoit un contexte déjà résolu (tenant compris) ; migration fichier par fichier ; zéro dépendance |
| Wrapper unique « répondeur » qui convertit les exceptions | Cal.com `defaultResponderForAppDir` [S21] | Idée reprise (conversion centrale, 4xx hors Sentry), forme non retenue | Ne traite ni l'auth ni la validation : ~190 handlers garderaient leur préambule |
| Wrapper auth + rate limit + audit + log | Formbricks `withV1ApiWrapper` [S23] | Idée reprise (ordre des étapes, helper « lire + valider le corps ») | Leur code porte des clés d'API et un proxy Envoy qui n'existent pas ici |
| Procédures tRPC (`publicProcedure` / `protectedProcedure`) | create-t3-app [S24] | Écartée ; idée reprise : le middleware d'auth **affine le type** du contexte | Remplace `fetch("/api/…")` par un client tRPC : les 54 fichiers d'interface qui lisent l'enveloppe seraient à réécrire [L12], crons et webhooks restent en `route.ts` de toute façon |
| `next-safe-action` | [S25] | Hors sujet | Server Actions uniquement ; aucune Server Action n'existe dans le dépôt, en introduire est une décision d'architecture (`nextjs-app-router` § 5) |
| Hono dans une route attrape-tout `app/api/[[...route]]/route.ts` | [S26] | Écartée | Fusionne ~190 fonctions en une seule : `maxDuration`, `runtime` et `dynamic` ne se règlent plus par route [S2] ; le verrou du matcher raisonne par fichier `route.ts` [L5] ; migration en bloc, pas route par route |
| `ts-rest`, `next-zod-route` | — | Écartées | Archivé / adoption insuffisante (sources.md) |

Deux constantes chez Cal.com, Dub et Formbricks, qui fondent la spécification : (1) une fonction
d'ordre supérieur **maison**, pas une bibliothèque ; (2) les erreurs passent par un seul
convertisseur, le handler n'a plus de `try/catch` de squelette. Chez Dub et Formbricks, il ne lit plus
non plus la session. Aucun des trois ne valide le corps dans le wrapper (helpers `parseRequestBody`,
`parseAndValidateJsonBody` appelés par le handler) : c'est ce que nos fabriques ajoutent.

## 2. Spécification

### 2.1 Trois modules

| Fichier cible | Contenu | Peut être importé par |
| --- | --- | --- |
| `src/lib/api/route-core.ts` | `createRoute`, types, `tooManyRequests`, `clientIp`, `readIdempotencyKey` | les deux fichiers ci-dessous et les tests |
| `src/lib/api/route-open.ts` | `openRoute`, `cronRoute` | tout handler, **obligatoire** pour ceux exclus du matcher Clerk |
| `src/lib/api/route-auth.ts` | `userRoute`, `optionalUserRoute`, `clientRoute`, `boucherRoute`, `adminRoute` | uniquement les handlers couverts par `config.matcher` |

Pourquoi trois fichiers et pas un `defineRoute({ auth: "boucher" })` : un module unique importerait
`server-auth`, `boucher-auth` et `admin-auth` ; tout cron qui l'utiliserait ferait échouer
`middleware-matcher.test.ts`, qui suit aussi les `import()` dynamiques [L5]. Une fabrique par type
d'accès donne en plus un `ctx.auth` typé sans union à discriminer [S22][S24].

### 2.2 Les sept fabriques

| Fabrique | Helper appelé | `ctx.auth` | Clé de rate limit | Cache |
| --- | --- | --- | --- | --- |
| `openRoute` | aucun | `null` | IP | libre (`apiCached` permis) |
| `cronRoute` | `verifyCronAuth(req)` | `{ cron: true }` | `cron` | `private, no-store` |
| `userRoute` | `getServerUserId()` | `{ clerkId }` | `clerkId` | `private, no-store` |
| `optionalUserRoute` | `getServerUserId()` | `{ clerkId: string \| null }` | `clerkId` ou IP | `private, no-store` |
| `clientRoute` | `getServerUserId()` + `User` Prisma (`getOrCreateUser` en secours) | `{ clerkId, userId, role }` | `userId` | `private, no-store` |
| `boucherRoute` | `getAuthenticatedBoucher()` | `{ userId, shopId }` | `shopId` | `private, no-store` |
| `adminRoute` | `requireAdmin()` | `{ clerkId }` | `clerkId` | `private, no-store` |

Les noms disent la nature de l'identifiant : `clerkId` (Clerk, `user_…`) ou `userId` (Prisma,
`User.id`). C'est la réponse à E7 : on ne compare jamais `ctx.auth.clerkId` à une colonne `userId`.

### 2.3 Signature

```ts
export const PATCH = boucherRoute(
  {
    name: "products/stock",        // obligatoire : tag Sentry, log, préfixe de la clé de rate limit
    rateLimit: "api",              // facultatif : une clé de `rateLimits`
    params: z.object({ id: z.string().min(1).max(64) }),   // facultatif
    query: …,                      // facultatif
    body: toggleStockSchema,       // facultatif ; absent ⇒ le corps n'est pas lu
  },
  async ({ req, auth, params, query, body, requestId }) => apiSuccess(…)   // renvoie une Response
);
```

- `params`, `query`, `body` sont typés par `z.output` du schéma. Sans schéma : `params` est un
  `Record<string, string>` brut, `query` et `body` valent `undefined` (lire la query impose donc un
  schéma).
- Service qui valide lui-même un `unknown` (`createOrder(body, customer)`, `adjustOrderPrice`) :
  `body: z.unknown()`. La fabrique lit le JSON (400 s'il est mal formé) et transmet la valeur telle
  quelle ; le schéma du service reste la seule validation (compilé [L7]).
- `name` : le chemin de l'API sans ses `[param]`, suivi de la méthode quand le fichier en exporte
  plusieurs (`"orders GET"`, `"orders POST"`, `"boucher/orders/action"` — forme déjà passée à
  `handleApiError` aujourd'hui). Unique dans le dépôt : c'est aussi le préfixe du compteur de rate limit.
- Le handler **renvoie** une `Response` construite par `apiSuccess`, `apiPaginated`, `apiCached` ou
  `apiError`. Il peut poser des cookies (`checkout/guest`) ou renvoyer un flux.
- La fonction produite accepte `(req, segment?)` : `segment.params` peut être un objet (Next 14) ou
  une `Promise` (Next 15+) [S3] ; le second argument est facultatif pour les tests. Elle satisfait le
  garde de types de Next 14.2.35 [L6].

### 2.4 Ordre garanti, et pourquoi

1. **Identifiant de requête** : `x-vercel-id` [S13], sinon `x-request-id`, sinon UUID ; une valeur
   hors gabarit (`[\w.:-]`, 128 caractères) est remplacée par un UUID. Cette lecture de `req.headers`
   se fait **hors du `try`** : elle rend le handler dynamique, et sur un `GET` sans `force-dynamic`
   c'est là que Next 14 lève pour sortir de la génération statique — l'erreur doit lui parvenir, pas
   devenir un 500 [L19]. Ne pas la déplacer (test dédié dans `api-route-core.test.ts`).
2. **Authentification** — avant toute lecture du corps : un anonyme ne reçoit jamais le détail de la
   validation, et le rejet ne coûte rien. Même logique qu'AIP-193, qui fait contrôler la permission
   avant l'existence de la ressource [S10].
3. **Rate limit** — après l'auth pour compter par boutique ou par utilisateur plutôt que par IP
   (plusieurs tablettes derrière la même box), avant la validation pour ne pas offrir de travail
   gratuit [S20, API4].
4. **`params` → `query` → `body`** : `safeParse`, 400 `VALIDATION_ERROR` + `details` par champ.
   JSON mal formé ⇒ 400 « Corps JSON invalide » (E1) ; corps vide ⇒ `undefined` soumis au schéma.
5. **Handler.**
6. **Erreurs** : toute exception ⇒ `handleApiError(error, name)` dans un `Sentry.withScope` qui ajoute
   le tag `request_id`. Une erreur attrapée n'est vue de Sentry que si on la lui envoie [S17].
7. **Finition** : en-tête `x-request-id` [S11] ; sur une fabrique personnalisée, `Cache-Control:
   private, no-store` (ce que `privateNoStore()` de `errors.ts` pose à la main dans les handlers non
   migrés) si l'en-tête est absent **ou** s'il annonce un cache partagé (`public`,
   `s-maxage`) — avec un `logger.warn` dans ce second cas ; une ligne `logger.warn("[api] réponse
   5xx", { route, method, status, requestId })` pour toute réponse ≥ 500.

### 2.5 Ce que la fabrique ne fait pas (volontairement)

| Elle ne fait pas | Parce que |
| --- | --- |
| Poser `dynamic`, `runtime`, `maxDuration` | Next les lit statiquement dans le `route.ts` [S2] : ils y restent |
| Laisser un handler statique ou en ISR | Elle lit `req.headers` (et `req.url` s'il y a un schéma de query) : en Next 14, tout accès à ces propriétés sort le handler de la génération statique [L19]. `revalidate` / `force-static` sur un handler passé par une fabrique sont sans effet (audit `static-with-factory`). `calendar-events`, seul handler prérendu (`○` dans la table du build), reste écrit à la main |
| Laisser passer `redirect()` / `notFound()` de `next/navigation` | Ces fonctions lèvent une erreur de contrôle que le `catch` de la fabrique convertit en 500 (vérifié pour `redirect()` ; aucun handler ne les appelle aujourd'hui). Rediriger par `NextResponse.redirect(url)`, qui passe (307) |
| Vérifier que la ressource appartient à `auth.shopId` / `auth.userId` | Autorisation au niveau objet = requête Prisma bornée, dans le handler ou le service [S20, API1] → `security-multitenant` |
| Emballer la valeur de retour dans `apiSuccess` | Une seule façon de répondre, lisible dans le handler ; les cas 201, pagination et cache restent explicites |
| Lever/attraper une classe d'exception métier | Le dépôt a déjà deux conventions (`return apiError(…)`, résultat `{ ok }` des services) ; en ajouter une troisième n'apporte rien aujourd'hui (voir Points à arbitrer) |
| Stocker les clés d'idempotence | Redis est facultatif et « laisse passer » en cas de panne ; l'idempotence se garantit par une contrainte unique en base (contrat-http § 7) |
| Journaliser chaque requête | Vercel le fait ; une ligne par requête serait du bruit facturé |

## 3. Décisions de conception

| Décision | Alternative écartée | Raison |
| --- | --- | --- |
| Garder `apiSuccess` / `apiError` / `handleApiError` tels quels | Réécrire `errors.ts` | La fabrique est adoptable aujourd'hui sans toucher au contrat ni aux ~190 fichiers ; le test `api-errors.test.ts` reste vrai |
| Le moteur n'importe pas `withRequestId` de `@/lib/logger` | Réutiliser le helper | Les tests de `tests/api/**` mockent `@/lib/logger` avec `{ logger }` seul : l'import casserait chaque test de handler migré ; et `withRequestId` ignore `x-vercel-id` |
| `new URL(req.url).searchParams` | `req.nextUrl.searchParams` | Les tests existants passent un `Request` standard casté en `NextRequest` : `nextUrl` y est `undefined` |
| En-tête IP : premier élément de `x-forwarded-for`, sinon `x-real-ip` | `req.ip` | `NextRequest.ip` disparaît en Next 15 [S3] ; `@vercel/functions` n'est pas installé [L15] ; Vercel réécrit `x-forwarded-for` [S13] |
| `Retry-After` de 60 s par défaut, en **secondes** | Pas d'en-tête ; recopier `reset` comme Dub | `checkRateLimit` ne renvoie pas encore `reset` [L8] ; 60 s est la plus petite fenêtre de `rateLimits`. Le correctif du § 4 donne la valeur exacte. Dub met l'horodatage brut en millisecondes dans `Retry-After` [S22], ce que RFC 9110 ne prévoit pas [S5] : `tooManyRequests` convertit |
| Schémas de `params` par défaut `z.string().min(1).max(64)` | `.cuid()` partout | Les jeux de test et le seed n'ont pas tous des identifiants `cuid` ; un identifiant inconnu donne de toute façon 404 |
| Écraser un `s-maxage` sur une fabrique personnalisée | Faire confiance au handler | E8, et la fuite de tarif pro par un cache Redis partagé (`0d6fd80`) : le CDN ne sépare pas non plus deux visiteurs par leurs cookies, absents de sa clé de cache [S12b] |

## 4. Correctifs du socle à poser avec la fabrique

Aucun n'est requis pour que la fabrique fonctionne ; ils en complètent le contrat. Extraits compilés [L7].

**a. `src/lib/rate-limit.ts` — renvoyer `reset`** (le moteur le lit déjà s'il existe) :

```ts
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
  if (!limiter) return { success: true };
  try {
    const result = await limiter.limit(identifier);
    return { success: result.success, remaining: result.remaining, reset: result.reset };
  } catch (e) {
    logger.warn("[RateLimit] check failed", { message: (e as Error).message });
    return { success: true }; // laisse passer — voir Points à arbitrer
  }
}
```

**b. `src/lib/api/errors.ts` — reconnaître Prisma par son code** [S15][S21], à appeler en tête de la
branche `error instanceof Error` de `handleApiError`, en gardant les tests de texte comme repli :

```ts
const PRISMA_CODE_MAP: Record<string, { code: ApiErrorCode; message: string }> = {
  P2002: { code: "CONFLICT", message: "Cette ressource existe déjà" },
  P2003: { code: "CONFLICT", message: "Référence invalide ou ressource liée" },
  P2025: { code: "NOT_FOUND", message: "Ressource introuvable" },
  P2034: { code: "CONFLICT", message: "Modification concurrente, réessayez" },
};
const PRISMA_CONNECTIVITY = new Set(["P1001", "P1008", "P1017", "P2024"]);

function mapPrismaError(error: unknown) {
  // `code` : PrismaClientKnownRequestError ; `errorCode` : PrismaClientInitializationError (P1001 au démarrage)
  const raw = error as { code?: unknown; errorCode?: unknown } | null;
  const code = raw?.code ?? raw?.errorCode;
  if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return null;
  const known = PRISMA_CODE_MAP[code];
  if (known) return apiError(known.code, known.message);
  if (PRISMA_CONNECTIVITY.has(code)) return apiError("INTERNAL_ERROR", "Erreur de connexion a la base de donnees");
  return null;
}
```

Le test par propriété (`code` de la forme `Pxxxx`) évite d'importer `@prisma/client` dans `errors.ts`
et survit à deux instances du client — Cal.com garde ce repli pour la même raison [S21]. Ajouter un cas
par code dans `src/lib/__tests__/api-errors.test.ts` (les deux classes se construisent sans base :
`new Prisma.PrismaClientKnownRequestError("x", { code: "P2025", clientVersion: "6.19.2" })`,
`new Prisma.PrismaClientInitializationError("x", "6.19.2", "P1001")`). Pourquoi c'est urgent : le texte
« Record to update not found » n'existe plus dans le moteur 6.19.2 (les causes s'y écrivent « No record
was found for … »), un `P2025` répond donc 500 aujourd'hui [L2]. À savoir : la branche
« connexion à la base » de `handleApiError` répond 500 **sans** appeler Sentry (un `console.error`
seul) — une panne de base ne remonte donc pas en alerte ; à traiter avec `reliability-observability`.
Ce convertisseur reste un filet : quand le **sens** d'un `P2002` compte (rejeu ou vrai doublon), le
service le lit lui-même avec `uniqueViolationFields` (`src/lib/prisma-errors.ts`), comme `createOrder`.

**c. Journalisation de `handleApiError`** : il écrit par `console.error` puis appelle
`Sentry.captureException`. Passer à `logger` est souhaitable, mais `logger.error` envoie **déjà**
à Sentry en production (`src/lib/logger.ts:65-81`) : faire les deux crée deux événements par erreur.
À traiter avec `reliability-observability` (une seule des deux voies).
