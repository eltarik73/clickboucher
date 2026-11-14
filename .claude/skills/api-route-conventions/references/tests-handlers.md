# Tester un route handler

Identifiants `[S…]`/`[L…]` : voir [sources.md](sources.md). Stratégie d'ensemble (pyramide, Playwright,
base de test) : skill `testing-strategy`. Ici : comment tester **un handler** avec Vitest 4, sans
réseau ni base. Modèle complet et vert [L7] : `templates/examples/product-stock.route.test.ts`.

## 1. Principe

Un handler App Router est une fonction `(req, segment) => Promise<Response>` : on l'importe et on
l'appelle. Pas de serveur, pas de bibliothèque d'appel de route. On remplace **les frontières** —
session, base, rate limit, services tiers — et on laisse tourner tout le reste : la fabrique, Zod,
`apiSuccess` / `apiError`, la logique du handler.

| On mocke | On ne mocke jamais |
| --- | --- |
| `@/lib/prisma` | `@/lib/api/route-core`, `route-auth`, `route-open` (c'est le contrat testé) |
| le helper d'auth appelé (`@/lib/boucher-auth`…) et les autres helpers importés par `route-auth` | `@/lib/api/errors` |
| `@/lib/rate-limit` | les schémas de `@/lib/validators` |
| `@/lib/notifications`, `@/lib/emails/*`, Stripe, Resend, Anthropic, Blob | une fonction pure de `src/lib` (machine à états, commission, horaires) |
| `@/lib/logger` (pour le silence et pour vérifier un `warn`) | |

## 2. Squelette

```ts
// @vitest-environment node            ← l'environnement par défaut du projet est jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({ product: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }));

const boucherAuthMock = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuthMock);
vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/get-or-create-user", () => ({ getOrCreateUser: vi.fn() }));

const rateLimitMock = vi.hoisted(() => ({ checkRateLimit: vi.fn(), rateLimits: { api: {} } }));
vi.mock("@/lib/rate-limit", () => rateLimitMock);
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  boucherAuthMock.getAuthenticatedBoucher.mockResolvedValue({ userId: "user-db-1", shopId: "shop-1" });
  rateLimitMock.checkRateLimit.mockResolvedValue({ success: true });
});

it("…", async () => {
  const { PATCH } = await import("@/app/api/products/[id]/stock/route");
  const res = await PATCH(
    new NextRequest("http://localhost/api/products/p1/stock", { method: "PATCH", body: JSON.stringify({ inStock: false }) }),
    { params: { id: "p1" } }
  );
  expect(res.status).toBe(200);
});
```

Points qui font perdre du temps :

- `vi.mock` est remonté en tête de fichier : une variable utilisée dans sa fabrique doit être créée
  par `vi.hoisted` [S19].
- `@/lib/prisma` exporte le client par défaut **et** sous le nom `prisma` : fournir les deux clés
  (`default` est obligatoire pour un export par défaut [S19]).
- `vi.clearAllMocks()` efface l'historique mais **garde** les implémentations ; `mockResolvedValueOnce`
  d'un test qui n'a pas consommé sa valeur déborde sur le suivant. En cas de doute :
  `vi.resetAllMocks()` puis reposer les valeurs par défaut [S19].
- Construire la requête avec `new NextRequest(url, init)` : le cast `new Request(...) as unknown as
  NextRequest` des anciens tests n'a ni `nextUrl` ni `cookies`.
- Fichier de test : `tests/api/<famille>/<route>.test.ts`, lancé par `npm run test` (projet Vitest
  `unit`, environnement `jsdom` par défaut, d'où l'en-tête `// @vitest-environment node`). Le moteur
  lui-même est testé dans `src/lib/__tests__/api-route-core.test.ts`.

## 3. Ce que chaque handler doit prouver

| Cas | Assertion | Toujours ? |
| --- | --- | --- |
| Sans session | 401, **aucun** appel Prisma | oui (sauf `openRoute`) |
| Mauvais rôle | 403, aucune écriture | routes boucher et admin |
| **Ressource d'un autre tenant** | 404 (ou 403 pendant la transition) et **aucune écriture** ; l'appel Prisma contient `shopId` / `userId` du demandeur | oui dès qu'il y a un identifiant dans l'URL ou le corps |
| Entrée invalide | 400, `error.code === "VALIDATION_ERROR"`, `error.details.<champ>` présent, aucun effet | oui s'il y a `body` ou `query` |
| Champ interdit dans le corps (`role`, `shopId`, `priceCents`…) | il n'arrive pas dans `data` de l'écriture Prisma | toute route d'écriture |
| Limite atteinte | 429 + `Retry-After`, aucun effet | routes à `rateLimit` sensible (commande, code promo, IA) |
| Succès | statut, enveloppe exacte, arguments de l'écriture Prisma, effets de bord déclenchés | oui |
| Rejeu | deuxième appel identique : même réponse, un seul effet | créations et transitions |
| Panne d'une dépendance | Prisma qui lève ⇒ 500 `INTERNAL_ERROR`, corps sans le message d'origine | une fois par famille |

Écrire les assertions sur ce que voit l'appelant (statut, corps, en-têtes) et sur les **arguments**
des écritures ; pas sur le nombre d'appels internes ni sur l'ordre des lectures, que la prochaine
refactorisation changera.

## 4. Tester l'isolation entre boutiques (le test qui manque aujourd'hui)

`tests/security/multitenant.test.ts` vérifie des copies de fonctions, pas un handler (etat-du-code
E11). Le test utile, pour chaque route qui prend un identifiant :

```ts
it("ne modifie pas le produit d'une autre boutique", async () => {
  boucherAuthMock.getAuthenticatedBoucher.mockResolvedValue({ userId: "u-A", shopId: "shop-A" });
  prismaMock.product.findUnique.mockResolvedValue({ shopId: "shop-B" });       // le produit est à B

  const res = await PATCH(patch({ inStock: false }), { params: { id: "p-de-B" } });

  expect([403, 404]).toContain(res.status);
  expect(prismaMock.product.update).not.toHaveBeenCalled();
});
```

Quand la requête est bornée au tenant (`updateMany({ where: { id, shopId } })`), l'assertion devient :
`expect(prismaMock.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p-de-B", shopId: "shop-A" } }))`
et le statut attendu est 404.

## 5. Reproduire un bug de squelette avant de le corriger

Les deux écarts E1 et E2 ont été reproduits ainsi sur le code actuel [L3] ; garder ce patron pour toute
correction (« d'abord le test rouge ») :

```ts
it("POST /api/cart avec un JSON mal formé", async () => {
  const { POST } = await import("@/app/api/cart/route");
  const res = await POST(new NextRequest("http://localhost/api/cart", { method: "POST", body: "{oups" }));
  expect(res.status).toBe(400);            // 500 aujourd'hui
});

it("GET /api/admin/orders?page=abc", async () => {
  const { GET } = await import("@/app/api/admin/orders/route");
  const res = await GET(new NextRequest("http://localhost/api/admin/orders?page=abc"));
  expect(res.status).toBe(400);            // aujourd'hui : findMany({ skip: NaN })
});
```

## 6. Handler contre une vraie base (projet `integration`)

Quand l'assertion porte sur ce que la base renvoie vraiment (champs exposés, contrainte unique,
filtre de tenant appliqué par SQL), mocker Prisma ne prouve rien. Modèle existant :
`tests/integration/api/public-exposure.test.ts` — seuls les helpers d'auth sont mockés (identité
de l'appelant), les données viennent des fabriques de `tests/integration/helpers/`, la base est
nettoyée par `useCleanDatabase()`. Lancer par `npm run test:integration` (PostgreSQL local, schéma
`itest` ; voir `testing-strategy`). Un handler migré sur une fabrique s'y teste de la même façon :
mocker `@/lib/auth/server-auth` (et `boucher-auth`, `admin-auth` selon la fabrique), jamais
`route-core`.

## 7. Ce que ces tests ne couvrent pas

- Le middleware (matcher, redirections) : `src/lib/__tests__/middleware-matcher.test.ts`.
- Les courses entre deux transactions : `tests/integration/orders/*-races.test.ts`,
  `create-order-concurrency.test.ts` — `testing-strategy`, `order-lifecycle-realtime`.
- Les en-têtes ajoutés par Vercel (`x-vercel-cache`, `x-forwarded-for`) : à constater sur un
  déploiement Vercel. Il n'y a pas de preview pour les branches `claude/**` (`CLAUDE.md` § CI/CD) ;
  une lecture seule par `curl -sI` sur une URL publique de production suffit pour `x-vercel-cache`.
- Le mode de rendu : un handler sur fabrique est dynamique. `calendar-events`, prérendu, ne se
  vérifie que dans la table de `npm run build`.
- Le parcours complet : Playwright (`tests/e2e`).
