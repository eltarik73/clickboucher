# Autorisation par construction (anti-IDOR, anti-BOLA)

Objectif : qu'il soit **impossible d'oublier** le contrôle de propriété, parce qu'il fait partie de
la requête. Sources : [sources.md](sources.md). Tous les blocs de code ont été compilés le
2026-11-13 avec le `tsc` du dépôt contre Prisma 6.19.2 et notre schéma, puis recompilés par le
vérificateur le 2026-11-14 ; le test a été exécuté avec Vitest 4.1.5 contre le vrai handler
(rejoué deux fois le 2026-11-14 : 2 tests verts).

## 1. Le problème, tel que le décrit OWASP

Un IDOR a trois ingrédients : un objet, une référence à cet objet (id, slug, jeton) et **l'absence
de contrôle d'autorisation au niveau de l'objet** [S4]. C'est le risque n° 1 des API (API1:2023,
« Broken Object Level Authorization ») : le contrôle doit exister « dans chaque fonction qui accède
à une source de données à partir d'un identifiant fourni par l'utilisateur » [S2]. ASVS 8.2.2
(niveau 1) l'exige, et 8.4.1 (niveau 2) ajoute des contrôles trans-tenant pour toute application
multi-tenant [S1].

Ce que recommandent les fiches OWASP, et que nous appliquons :

- chercher l'objet **dans l'ensemble auquel l'appelant a droit** (`current_user.projects.find(id)`
  plutôt que `Project.find(id)`) [S4] ;
- inclure la portée du tenant dans la recherche ; un identifiant fourni par le client est un
  sélecteur, pas une preuve [S3] ;
- répondre « introuvable » pour l'objet d'un autre tenant, sans révéler qu'il existe [S3] ;
- un identifiant long et aléatoire (nos `cuid`) est une défense en profondeur contre l'énumération,
  **pas** un contrôle d'accès [S3][S4].

## 2. État du dépôt : « charger puis comparer »

La forme dominante aujourd'hui charge l'objet par son seul id, puis compare :

```ts
// src/app/api/boucher/catalogue/[productId]/route.ts:33-43 (forme actuelle)
const product = await prisma.product.findUnique({ where: { id: params.productId }, select: { id: true, shopId: true } });
if (!product) return apiError("NOT_FOUND", "Produit introuvable");
if (product.shopId !== shopId) return apiError("FORBIDDEN", "Accès refusé");
const updated = await prisma.product.update({ where: { id: params.productId }, data: parsed.data });
```

Elle est **correcte** tant que personne n'oublie le `if`, mais :

- la sécurité repose sur une ligne que rien n'impose (une route copiée sans elle fuit en silence) ;
- la différence 404 / 403 permet de sonder l'existence d'objets d'autres boutiques ;
- la vérification et l'écriture sont deux requêtes (fenêtre TOCTOU, ASVS 15.4.2) [S1] ;
- la seconde requête (`update({ where: { id } })`) n'est pas scoppée du tout.

Mêmes formes : `boucher/images/[id]/route.ts:24-34`, `PATCH` de `products/[id]/route.ts`
(produit chargé par `id`, puis comparaison de `shop.ownerId`), `uploads/product-image/route.ts:65-83`
(le `GET` de `orders/[id]/route.ts` est passé à la forme cible avec le chantier prix : corrigé).
Ne pas les réécrire en masse sans tests ; **toute route nouvelle ou retouchée** adopte la forme du § 3.

Déjà à la forme cible (chantier « prix des commandes », non commité au 2026-11-14 — vérifier que
ces fichiers existent sur votre branche) : `boucher/orders/[orderId]/action/route.ts` ne fait
qu'authentifier puis passer `shopId: authResult.shopId` aux commandes de
`src/lib/services/orders/commands/` ; chacune lit par `where: { id: orderId, shopId }` et répond
`not_found` sinon, et `scopedOrderWhere()` (`commands/outcome.ts`) fabrique ce `where` pour une
portée boutique ou client. C'est le modèle à imiter pour une ressource « commande ».

## 3. La forme cible

### 3.1 Route boucher

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// .strict() : une clé inconnue (shopId, isActive…) fait échouer la requête au lieu d'être ignorée.
const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    priceCents: z.number().int().min(0).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.api, `product-patch:${auth.shopId}`);
    if (!rl.success) return apiError("RATE_LIMITED", "Trop de requêtes");

    const data = patchSchema.parse(await req.json());

    // Le tenant est DANS le where : un id d'une autre boutique donne count = 0.
    const { count } = await prisma.product.updateMany({
      where: { id: params.id, shopId: auth.shopId },
      data,
    });
    if (count === 0) return apiError("NOT_FOUND", "Produit introuvable");

    const product = await prisma.product.findFirst({
      where: { id: params.id, shopId: auth.shopId },
      select: { id: true, name: true, priceCents: true },
    });
    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error, "boucher/products/patch");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;
    const { count } = await prisma.generatedImage.deleteMany({
      where: { id: params.id, shopId: auth.shopId },
    });
    if (count === 0) return apiError("NOT_FOUND", "Image introuvable");
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "boucher/images/delete");
  }
}

// Variante : update() accepte des filtres non uniques à côté de la clé unique (Prisma ≥ 5).
export async function updateScoped(id: string, shopId: string, name: string) {
  return prisma.product.update({
    where: { id, shopId },
    data: { name },
    select: { id: true, name: true },
  });
}
```

Points à remarquer : `shopId` n'apparaît dans aucun schéma Zod ; `.strict()` rejette une clé
`shopId` envoyée par curiosité ; `updateMany`/`deleteMany` renvoient un `count` au lieu de lever.

### 3.2 Route client (objet appartenant à un utilisateur)

```ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getServerUserId } from "@/lib/auth/server-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clerkId = await getServerUserId();
    if (!clerkId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Le propriétaire est DANS le where (relation user.clerkId) : pas de findUnique({ id }) nu.
    const order = await prisma.order.findFirst({
      where: { id: params.id, user: { clerkId } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error, "orders/get");
  }
}
```

### 3.3 Route admin (trans-tenant, donc explicite et journalisée)

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit-log";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ visible: z.boolean() }).strict();

export async function PATCH(req: NextRequest, { params }: { params: { shopId: string } }) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { visible } = bodySchema.parse(await req.json());
    const { count } = await prisma.shop.updateMany({ where: { id: params.shopId }, data: { visible } });
    if (count === 0) return apiError("NOT_FOUND", "Boutique introuvable");

    await writeAuditLog({
      actorId: admin.userId,
      action: "shop.visibility",
      target: "shop",
      targetId: params.shopId,
      details: { visible },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return apiSuccess({ visible });
  } catch (error) {
    return handleApiError(error, "admin/shops/visibility");
  }
}
```

Une route admin ne se « devine » pas à partir d'une route boucher : séparer les fichiers
(`/api/admin/**`, `/api/webmaster/**`) garde l'inventaire lisible (API5:2023 « Broken Function Level
Authorization », API9:2023 « Improper Inventory Management ») [S2].

### 3.4 Un accesseur scoppé, pour ne plus écrire le `where` à la main

À créer dans `src/lib/` quand une équipe refond un domaine ; la portée est fixée une fois. Pour
les commandes, ne pas le dupliquer : `scopedOrderWhere()` existe déjà dans le chantier prix.

```ts
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Accès « par construction » aux données d'une boutique : le shopId est fixé une fois,
 * à partir du helper d'auth, et chaque requête le porte dans son where.
 */
export function shopScope(shopId: string) {
  return {
    product: {
      find: <S extends Prisma.ProductSelect>(id: string, select: S) =>
        prisma.product.findFirst({ where: { id, shopId }, select }),
      list: <S extends Prisma.ProductSelect>(select: S, take = 50, skip = 0) =>
        prisma.product.findMany({
          where: { shopId },
          select,
          take: Math.min(take, 50),
          skip,
          orderBy: { displayOrder: "asc" },
        }),
      update: (id: string, data: Prisma.ProductUpdateManyMutationInput) =>
        prisma.product.updateMany({ where: { id, shopId }, data }),
      remove: (id: string) => prisma.product.deleteMany({ where: { id, shopId } }),
    },
    order: {
      find: <S extends Prisma.OrderSelect>(id: string, select: S) =>
        prisma.order.findFirst({ where: { id, shopId }, select }),
    },
    // Ressource rattachée indirectement : on filtre par la relation.
    productImage: {
      remove: (id: string) =>
        prisma.productImage.deleteMany({ where: { id, product: { shopId } } }),
    },
    // Une liste d'ids reçue du client n'est valable que si TOUS appartiennent à la boutique.
    async ownsAllCategories(ids: string[]): Promise<boolean> {
      const unique = Array.from(new Set(ids));
      const count = await prisma.category.count({ where: { id: { in: unique }, shopId } });
      return count === unique.length;
    },
  };
}
```

Usage :

```ts
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { shopScope } from "@/lib/shop-scope"; // fichier à créer avec le bloc ci-dessus

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const product = await shopScope(auth.shopId).product.find(params.id, {
      id: true,
      name: true,
      priceCents: true,
      proPriceCents: true, // le propriétaire a le droit de voir son tarif pro
      inStock: true,
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");
    return apiSuccess(product);
  } catch (error) {
    return handleApiError(error, "boucher/products/get");
  }
}
```

C'est l'équivalent, chez nous, de la « Data Access Layer » que recommandent Next.js et OWASP :
un point de passage unique qui autorise et renvoie un objet minimal [S11][S9].

## 4. Propriétés et champs (BOPLA : API3:2023, ASVS 8.2.3 et 15.3.1)

Deux fuites symétriques : **lire** un champ qu'on ne devrait pas voir, **écrire** un champ qu'on ne
devrait pas modifier [S2].

### 4.1 Lecture : un `select` nommé par audience

```ts
import type { Prisma } from "@prisma/client";

// DTO du détail de commande côté client : aucune ligne Product entière, aucun identifiant interne.
export const CLIENT_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  displayNumber: true,
  status: true,
  totalCents: true,
  estimatedReady: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      weightGrams: true,
      totalCents: true,
      product: { select: { id: true, name: true, imageUrl: true } },
    },
  },
  shop: { select: { id: true, name: true, slug: true, address: true, city: true, phone: true } },
} satisfies Prisma.OrderSelect;

export type ClientOrderDTO = Prisma.OrderGetPayload<{ select: typeof CLIENT_ORDER_SELECT }>;
```

Champs à ne jamais laisser sortir par défaut :

| Champ | Visible par | Déjà fuité ? |
|---|---|---|
| `Product.proPriceCents` | `CLIENT_PRO`, propriétaire de la boutique, admin | oui : recherche, suggestions, cache produits (0d6fd80) ; détail de commande (`items.product`), corrigé par le chantier prix |
| `User.guestToken` | personne (serveur uniquement) | oui (audit 2026-06-12), corrigé par `sanitizeOrder` |
| `User.clerkId`, `Shop.ownerId` | serveur | renvoyés par `GET /api/orders/[id]` jusqu'au chantier prix, corrigé (projection `src/lib/services/orders/customer-view.ts`) |
| `User.email`, `User.phone` d'un client | le client, le boucher **de la commande concernée**, admin | à vérifier route par route |
| Champs Stripe (`stripeAccountId`, statuts) | boucher propriétaire, admin | — |
| `Order.qrCode` / code de retrait | le client de la commande, le boucher de la boutique | — |

Règle pratique : une réponse **différente selon l'appelant** n'est jamais mise en cache partagé
(`apiCached`, Redis sans dimension d'audience). `GET /api/products/[id]` montre le bon geste :
trois audiences (`PUBLIC`, `PRO`, `MANAGER`), projection publique en liste blanche seule mise en
cache (`apiCached`), variantes pro et propriétaire renvoyées par `apiSuccess` sans cache. Les
listes blanches vivent dans `src/lib/public-projections.ts` (`publicShopSelect`,
`publicProductSelect`, `proProductSelect` ; chantier prix, non commité au 2026-11-14) : une
colonne ajoutée au schéma n'est exposée que si on l'y ajoute. Réutiliser ces `select` plutôt que
d'en écrire un par route.

### 4.2 Écriture : mass assignment

OWASP : préférer un objet d'entrée dédié ne contenant que les champs modifiables, lister les champs
autorisés, ne pas compter sur une liste noire [S5]. Chez nous, c'est le schéma Zod :

- Zod **retire** par défaut les clés inconnues (`z.object({a}).parse({a, role})` → `{a}`), vérifié
  avec la 3.25.76 installée [S22]. `data: parsed.data` est donc sûr **si** le schéma ne contient
  aucun champ privilégié. Le danger est dans le schéma, pas dans le spread.
- Champs à ne **jamais** mettre dans un schéma accessible à un boucher ou à un client : `shopId`
  (hors création, où il est comparé à celui du helper), `userId`, `ownerId`, `role`, `status` d'une
  commande (passer par la machine à états), `totalCents` et prix d'une commande, taux de
  commission, `visible` / validation d'une boutique, compteurs (`rating`, `ratingCount`), champs
  Stripe.
- Un même modèle a souvent **deux** schémas : boucher (`patchCatalogueSchema` : stock et prix) et
  admin. Ne pas réutiliser le schéma admin dans une route boucher.
- `.strict()` sur les mises à jour : une clé inattendue devient une erreur 400 visible en test,
  au lieu d'un champ silencieusement ignoré.
- Jamais `data: body`, `data: { ...body }`, ni `Object.assign(entity, body)`.

## 5. Tester l'isolation

OWASP : créer deux utilisateurs de portées différentes, des objets pour chacun, et vérifier que A
ne peut ni lire ni modifier ceux de B, pour **chaque** opération (lecture, création, mise à jour,
suppression, export, action d'administration) [S4]. La fiche Next.js ajoute : appeler les handlers
directement, sans passer par l'interface, avec les cas non authentifié, non autorisé, mauvais
propriétaire, mauvais tenant [S9].

Modèle exécuté (2 tests verts contre le handler actuel), dans le style de
`tests/api/checkout/guest.test.ts` ; à placer sous `tests/api/` :

```ts
// @vitest-environment node
// Test « mauvais tenant » : le boucher de la boutique A vise un produit de la boutique B.
// Appelle le VRAI handler ; seuls l'auth, Prisma et le logger sont simulés.
import { describe, it, expect, beforeEach, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  product: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const authMock = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => authMock);

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { PATCH } from "@/app/api/boucher/catalogue/[productId]/route";

function patchJson(body: unknown) {
  return new Request("http://localhost/api/boucher/catalogue/prod-b", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getAuthenticatedBoucher.mockResolvedValue({ userId: "user-a", shopId: "shop-a" });
});

describe("PATCH /api/boucher/catalogue/[productId] — isolation entre boutiques", () => {
  it("refuse un produit d'une autre boutique et n'écrit rien", async () => {
    // Le produit existe, mais appartient à shop-b.
    prismaMock.product.findUnique.mockResolvedValue({ id: "prod-b", shopId: "shop-b" });
    prismaMock.product.findFirst.mockResolvedValue(null); // forme « par construction »
    prismaMock.product.updateMany.mockResolvedValue({ count: 0 });

    const res = await PATCH(patchJson({ inStock: false }), { params: { productId: "prod-b" } });

    expect([403, 404]).toContain(res.status); // 404 attendu pour toute nouvelle route
    expect(prismaMock.product.update).not.toHaveBeenCalled();
    const scopedWrites = prismaMock.product.updateMany.mock.calls.filter(
      ([args]) => args?.where?.shopId !== "shop-a"
    );
    expect(scopedWrites).toHaveLength(0); // aucune écriture hors du tenant de l'appelant
  });

  it("renvoie l'erreur du helper quand il n'y a pas de session", async () => {
    authMock.getAuthenticatedBoucher.mockResolvedValue({
      error: new Response(null, { status: 401 }),
    });
    const res = await PATCH(patchJson({ inStock: false }), { params: { productId: "prod-b" } });
    expect(res.status).toBe(401);
    expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
  });
});
```

Portée de ce modèle : avec Prisma simulé, il prouve que le handler **n'écrit pas** hors du tenant
et que le `where` porte `shopId` ; il ne prouve pas que PostgreSQL filtre. Pour une route à la
forme « par construction », ajouter un test contre une vraie base (`npm run test:integration`,
dossier `tests/integration/`, voir `testing-strategy`). `tests/**/*.test.ts` tourne dans le projet
`unit` (`npm run test`).

À ne pas reproduire : `tests/security/multitenant.test.ts` redéfinit ses propres `isAdmin` /
`isBoucher` et teste ces copies ; il reste vert même si `src/lib/roles.ts` change. Un test de
sécurité importe le code réel.

## 6. Pièges propres à notre code

- **`handleApiError` et « introuvable »** : il reconnaît l'erreur Prisma par le texte
  « Record to update not found » (`src/lib/api/errors.ts:160`). Le moteur 6.19.2 installé ne
  contient plus cette chaîne (il contient « No record was found for … ») — constat fait sur le
  binaire du moteur, non rejoué contre une base. Conséquence probable : un `update`/`delete` qui ne
  trouve rien finit en 500 et en événement Sentry. D'où `updateMany`/`deleteMany` + `count`, ou une
  détection par code : `error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"`
  (à ranger dans `src/lib/prisma-errors.ts`, à côté de `uniqueViolationFields()`).
- **`Shop.ownerId` à deux formats** (id Clerk ou id Prisma) : toute comparaison de propriété passe
  par la clause `OR` ; `getAuthenticatedBoucher()` le fait pour vous, s'en servir.
- **`getAuthenticatedBoucher()` met en cache `shopId` 60 s** : un boucher dont la boutique vient
  d'être transférée garde l'ancienne portée jusqu'à expiration ; appeler `invalidateRoleCache`.
- **Mode test** : le rôle BOUCHER ou ADMIN de test reçoit la **première boutique créée**
  (`boucher-auth.ts:28-39`). Ne jamais activer le mode test sur une base de production.
- **Routes à double audience** (`orders/[id]` : client, boucher, admin, invité) : écrire une
  branche par audience, chacune avec son `where` et son `select`, plutôt qu'un chargement commun
  suivi de `if`.
- **Recherche et agrégats** : un `groupBy`, un `count` ou une requête brute sont aussi des lectures
  de tenant ; `shopId` y figure de la même façon.
