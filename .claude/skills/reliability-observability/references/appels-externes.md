# Appels externes : délais, nouvelles tentatives, dégradation

Extraits compilés le 2026-11-14 (tsc du dépôt, `node_modules` installés ; recompilés par le
vérificateur). Constats `E…` : [etat-du-code.md](etat-du-code.md).

## 1. Règles

1. **Délai explicite** sur chaque appel réseau. Le choisir à partir de la latence observée de la
   dépendance (percentile élevé), avec marge [S10] ; à défaut de mesure, valeurs de départ de ce
   skill : 800 ms pour Redis, 3 s pour la base dans une sonde, 5 s pour une API HTTP, 12 s pour
   un LLM.
2. **Budget de la fonction** : compter 30 s pour tout handler sous `src/app/api/**` (règle de
   `vercel.json`), même quand la route exporte `maxDuration = 60` ou `300` — la page Vercel lue ne
   dit pas laquelle des deux valeurs l'emporte [S28], et `cron/auto-cancel` s'arrête à 25 s pour
   cette raison (`EXPIRY_BUDGET_MS`). `vercel inspect <url> --json` donne la valeur réellement
   déployée (champ `timeout`) [S28]. Le middleware a 25 s [S23].
3. **Le pire cas se calcule** : `(retries + 1) × délai + attentes` de chaque appel, additionnés,
   doit rester sous le budget. Un SDK qui retente un délai dépassé (Anthropic) double sa borne.
4. **Nouvelle tentative à une seule couche** : les retries empilés multiplient la charge sur une
   dépendance déjà malade [S10][S11]. Si le SDK retente déjà, ne pas l'envelopper d'un second retry.
5. **Seulement si c'est idempotent** : lecture, ou écriture protégée par une clé d'idempotence
   (Resend `idempotencyKey`, `idempotencyKey` de commande) [S10].
6. **Backoff exponentiel avec jitter**, nombre d'essais plafonné [S10][S11].
7. **Ne jamais retenter** une erreur permanente (4xx, validation, P2002 unique).

## 2. Patrons par dépendance

### `fetch` (Bing, IndexNow, WhatsApp, images Replicate…) — E13

```ts
const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
if (!res.ok) throw new Error(`bing ${res.status}`);
```

`AbortSignal.timeout` existe en Node et dans l'edge runtime fourni par Next 14.2.35
(`next/dist/compiled/@edge-runtime/primitives/abort-controller.js.text.js`). L'erreur levée est une
`DOMException` de nom `TimeoutError`. Google Places passe par son client
(`@googlemaps/google-maps-services-js`, `timeout: 10_000` déjà posé dans `admin/scrape-butchers`).

### Upstash Redis (`src/lib/redis.ts`, `edgeRedis` de `src/middleware.ts`) — E11

```ts
export const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  retry: { retries: 1, backoff: () => 50 },
  signal: () => AbortSignal.timeout(800),
});
```

Comportements prouvés par `scripts/upstash-timeout-check.mjs` (à relancer après toute montée de
version du SDK) :

| Situation | SDK 1.36.2 par défaut | Avec les options ci-dessus |
| --- | --- | --- |
| Connexion refusée | lève après ≈ 4,3 s (5 retries, `Math.exp(i) * 50` ms [S17]) | lève après ≈ 50 ms |
| Serveur qui ne répond pas | aucun délai dans le SDK : l'appel dure jusqu'à la limite de la fonction | lève `TimeoutError` à 800 ms, retries compris |
| Réponse HTTP en erreur | lève tout de suite (pas de retry : il ne couvre que le réseau [S17]) | idem |

- `signal` en **fonction** : un signal neuf par commande, partagé par ses retries. À l'expiration
  la commande **lève**, et le wrapper `redis.get` renvoie `null` (cache manqué).
- `signal` **statique** (`signal: AbortSignal.timeout(800)`) : il expire 800 ms après la création
  du client, puis le SDK ne fait plus aucun appel et fabrique une réponse 200 — avec
  l'auto-pipelining (actif par défaut) chaque commande lève `TypeError: res.map is not a function`,
  sans lui elle renvoie `null`. Le cache et le rate limit sont alors morts jusqu'au recyclage de
  l'instance.
- Remplacer les `console.warn` du wrapper par `logger.warn("[redis] get failed", { message })`,
  sans la clé complète si elle contient un identifiant d'utilisateur.

### Rate limit (`src/lib/rate-limit.ts`)

```ts
new Ratelimit({ redis: redisClient, limiter: Ratelimit.slidingWindow(5, "60 s"), timeout: 1_000 });
```

Au-delà du `timeout` (défaut 5 000 ms), la requête passe avec `reason: "timeout"` [S18]. Avec le
client borné à 800 ms, c'est le client qui lève le premier et `checkRateLimit` laisse passer par
son `catch` : dans les deux cas la requête passe (fail-open, point à arbitrer C). Le cache
éphémère (actif par défaut) refuse localement un identifiant déjà bloqué sans appeler Redis [S18].

### Resend (`src/lib/email.ts`) — E9

```ts
const { data, error } = await resend.emails.send(
  { from: "Klik&Go <noreply@klikandgo.app>", to: [to], subject, html },
  { idempotencyKey: key },               // ex. `order-ready/${orderId}`
);
if (error) {
  const status = error.statusCode;
  return { ok: false as const, retryable: status === null || status === 429 || status >= 500, reason: error.name };
}
return { ok: true as const, id: data.id };
```

- Le SDK 6.9.1 renvoie `{ data, error }` et **ne lève jamais**, panne réseau comprise
  (`statusCode: null`) ; il n'expose pas de délai. Envoyer **après** la transaction métier, jamais
  dedans.
- La forme du résultat est celle de `background-jobs-notifications` (« transport honnête »,
  version complète dans son references/email-resend.md § 2) : ne pas en inventer une seconde.
- Si un délai est indispensable dans un handler : `withDeadline` (§ 3) — il borne l'attente sans
  annuler la requête.
- Sans `RESEND_API_KEY` en production : `logger.error("[email] RESEND_API_KEY manquante")` une
  fois par instance et `{ ok: false, retryable: false, reason: "not_configured" }` — pas de `true`.
  L'adresse du destinataire ne va pas dans le log.

### web-push (`src/lib/push.ts`) — E10

```ts
await webpush.sendNotification(sub, payload, { timeout: 5_000 });
```

`timeout` est un délai de socket, pas un délai de réponse complète (types `@types/web-push`). Un
404 ou un 410 du service push signifie un abonnement mort : le supprimer, ne pas retenter ; 429 et
5xx se retentent (`background-jobs-notifications`, règle 9).

### Anthropic (`api/chat`, `api/boucher/images/enhance-prompt`, `lib/services/support-ai.ts`) — E13

```ts
new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 12_000, maxRetries: 1 });
```

Défaut du SDK 0.74 : 10 minutes et 2 nouvelles tentatives, **délais dépassés compris** [S19]. Sur
une fonction de 30 s, le défaut garantit un 504 de plateforme au lieu d'un message propre. Avec
`12_000` et `1`, le pire cas est 2 × 12 s plus l'attente entre les deux : sous 30 s. Pour un seul
essai long, `timeout: 20_000, maxRetries: 0` ; jamais `20_000` avec un retry (40 s).

### Prisma (`src/lib/prisma.ts`)

- URL : `connect_timeout` 5 s et `pool_timeout` 10 s par défaut [S13]. Avec `connection_limit=1`
  (réglage documenté par CLAUDE.md, non vérifié en production : `prisma-expert`, point A2), les
  requêtes d'un `Promise.all` passent l'une après l'autre, et celle qui attend la connexion plus
  de `pool_timeout` échoue en `P2024`.
- Transactions interactives : `maxWait` 2 000 ms, `timeout` 5 000 ms par défaut (lus dans
  `@prisma/client/runtime/library.js`) ; les services de commande passent
  `TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 }`. Aucun appel réseau externe dans une
  transaction.
- Classer par **code**, pas par texte (messages vérifiés dans `prisma/prisma-engines`,
  `libs/user-facing-errors`) [S20]. **Un seul classifieur** : `mapPrismaError` d'`api-route-conventions`
  (references/wrapper.md § 4b), branché dans `handleApiError`. Ce skill fixe ce qu'il doit
  garantir côté fiabilité :

| Code | Sens | Réponse (contrat : `api-route-conventions`) | Exigence de ce skill |
| --- | --- | --- | --- |
| `PrismaClientInitializationError` (`errorCode`), P1001, P1002, P1008, P1017 | base injoignable, délai, connexion fermée | `INTERNAL_ERROR` 500 aujourd'hui ; 503 = point à arbitrer I | **`Sentry.captureException` avant de répondre** (E8) ; pas de retry dans la requête |
| P2024 | délai d'attente du pool | idem | idem |
| P2034 | conflit d'écriture ou interblocage | rejouer **toute** la transaction dans le service (patron `withTxRetry` de `prisma-expert`, transactions-concurrence.md § 7) ; s'il remonte : 409 | seul code rejouable ; 1 à 2 rejeux, jitter, aucun effet externe dans la fonction rejouée |
| P2002 | contrainte unique | 409, ou rejeu idempotent lu par `uniqueViolationFields` (`src/lib/prisma-errors.ts`) | pas de retry |
| P2025 | enregistrement requis absent | 404 | pas de retry |
| P2028 | erreur d'API de transaction (souvent délai dépassé) | 500 | Sentry ; chercher d'abord un `prisma.` dans le callback (`prisma-expert`) |

  `P1002` n'est pas dans l'ensemble `PRISMA_CONNECTIVITY` proposé par `api-route-conventions` :
  l'y ajouter lors de la mise en œuvre. Ajout attendu dans la branche « connexion » de
  `handleApiError` :

```ts
Sentry.captureException(error, { tags: { route: context ?? "unknown", kind: "db_unavailable" } });
```

## 3. Borne d'attente générique

```ts
export async function withDeadline<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: deadline ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
```

À réserver aux SDK sans délai (Resend, `prisma.$queryRaw` de la sonde). L'opération continue en
arrière-plan : ne jamais l'utiliser autour d'une écriture qu'on risquerait de relancer. À placer
dans `src/lib` avec son test unitaire (fonction pure).

## 4. Dégradation : tester qu'elle marche

Les modes dégradés rarement exercés cassent le jour où l'on en a besoin [S11]. Avant de livrer un
changement dans ce domaine, en local (variables passées **sur la ligne de commande**, qui priment
sur les fichiers d'environnement ; ne pas éditer ces fichiers) :

- Redis refusé : `UPSTASH_REDIS_REST_URL=http://127.0.0.1:9 UPSTASH_REDIS_REST_TOKEN=x npm run dev`
  → les pages répondent, un `warn` par commande, pas de seconde perdue. Redis **muet** (le cas qui
  bloque) : `node .claude/skills/reliability-observability/scripts/upstash-timeout-check.mjs`.
- Base : arrêter le conteneur Postgres local → `/api/health` 503 en moins de 3,5 s ; un handler
  API renvoie l'erreur de `handleApiError` et **un seul** événement Sentry (si DSN de dev) ; sous
  `next start` (après un build fait base allumée), une page ISR déjà générée reste servie [S16].
- Resend sans clé → la commande est créée ; le log dit `not_configured`.
