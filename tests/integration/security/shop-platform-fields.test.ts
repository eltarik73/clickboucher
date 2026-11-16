// @vitest-environment node
// Platform-owned shop fields (C1-FAILLES-CRITIQUES, decisions D1 to D3): no owner route writes the
// commission, the tier, the publication or moderation state, the photos, the slug or the owner; a
// forbidden key is refused (400), never silently dropped. The commission has two writers, both
// admin-only and audited. Handlers are called directly; only the identity is simulated (auth helpers,
// and Clerk's session for requireAdmin, which then reads the role in the database). Real PostgreSQL.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop, User } from "@prisma/client";

vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("../images/product-routes-harness")).serverAuthMock
);
vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("../images/product-routes-harness")).boucherAuthMock
);
vi.mock("@clerk/nextjs/server", async () => {
  const { session } = await import("../images/product-routes-harness");
  return { auth: async () => ({ userId: session.clerkId }), currentUser: async () => null };
});

import { PATCH as patchGlobalCommission } from "@/app/api/admin/commission/global/route";
import { PATCH as patchShopCommission } from "@/app/api/admin/shops/[shopId]/commission/route";
import { PATCH as patchService } from "@/app/api/boucher/service/route";
import { PATCH as patchShop } from "@/app/api/shops/[id]/route";
import { PATCH as patchShopStatus } from "@/app/api/shops/[id]/status/route";
import { actAs, session, type ApiBody } from "../images/product-routes-harness";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop, createTestUser } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const FIELD_REFUSED = { _root: ["Ce champ ne peut pas être modifié ici"] };
const SHOP_PHOTO = "/img/shops/shop-2.jpg";
const INVALID_JSON = {
  status: 400,
  body: {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Le corps de la requête n'est pas du JSON valide" },
  },
};

// Each value differs from the fixture's: accepting the key would change the row.
const PLATFORM_FIELDS: Array<[string, unknown]> = [
  ["commissionPct", 0],
  ["commissionEnabled", false],
  ["tier", "GOLD"],
  ["visible", true],
  ["featured", true],
  ["suspendedAt", null],
  ["validatedAt", "2026-01-01T00:00:00.000Z"],
  ["imageUrl", SHOP_PHOTO],
  ["slug", "x"],
  ["ownerId", "x"],
];

function patch(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function answer(response: Promise<Response>): Promise<{ status: number; body: ApiBody }> {
  const res = await response;
  return { status: res.status, body: (await res.json()) as ApiBody };
}

const rowOf = (id: string) => prisma.shop.findUniqueOrThrow({ where: { id } });

type OwnerRoute = { send: (shopId: string, body: unknown) => Promise<Response>; legit: object };
const SHOP_ROUTE: [string, OwnerRoute] = [
  "PATCH /api/shops/[id]",
  {
    send: (id, body) => patchShop(patch(`/api/shops/${id}`, body), { params: { id } }),
    legit: { name: "Boucherie Renommée" },
  },
];
const SERVICE_ROUTES: Array<[string, OwnerRoute]> = [
  [
    "PATCH /api/shops/[id]/status",
    {
      send: (id, body) =>
        patchShopStatus(patch(`/api/shops/${id}/status`, body), { params: { id } }),
      legit: { prepTimeMin: 30 },
    },
  ],
  [
    "PATCH /api/boucher/service",
    {
      send: (_id, body) => patchService(patch("/api/boucher/service", body)),
      legit: { prepTimeMin: 30 },
    },
  ],
];

let owner: User;
let shop: Shop;

beforeEach(async () => {
  owner = await createTestUser({ role: "BOUCHER" });
  // Never validated (visible false), commission 5 % enabled, threshold 20 %.
  shop = await createTestShop({
    ownerId: owner.id,
    visible: false,
    commissionPct: 5,
    commissionEnabled: true,
    priceAdjustmentThreshold: 20,
  });
  actAs(owner, shop.id);
});

async function expectRefusedUnchanged(
  response: Promise<Response>,
  details: object = FIELD_REFUSED
) {
  const before = await rowOf(shop.id);
  const { status, body } = await answer(response);
  expect(status).toBe(400);
  expect(body.error).toEqual({ code: "VALIDATION_ERROR", message: "Données invalides", details });
  expect(await rowOf(shop.id)).toEqual(before);
}

describe.each([SHOP_ROUTE, ...SERVICE_ROUTES])("%s : aucun champ de la plateforme", (_, route) => {
  it.each(PLATFORM_FIELDS)("refuse %s seul : 400, ligne inchangée", async (key, value) => {
    await expectRefusedUnchanged(route.send(shop.id, { [key]: value }));
  });

  it.each(PLATFORM_FIELDS)(
    "refuse %s avec un champ permis : 400, rien d'écrit",
    async (key, value) => {
      await expectRefusedUnchanged(route.send(shop.id, { ...route.legit, [key]: value }));
    }
  );
});

describe.each(SERVICE_ROUTES)("%s : réglages de service", (_, route) => {
  it.each(["VACATION", "AUTO_PAUSED", "BUSY"])("refuse le statut %s : 400", async (status) => {
    await expectRefusedUnchanged(route.send(shop.id, { status }), {
      status: ["Statut invalide : OPEN, CLOSED ou PAUSED"],
    });
  });

  it("statut PAUSED, préparation 25 min, acceptation auto, 30 commandes/h : 200 et écrit", async () => {
    const body = { status: "PAUSED", prepTimeMin: 25, autoAccept: true, maxOrdersPerHour: 30 };

    expect((await answer(route.send(shop.id, body))).status).toBe(200);
    expect(await rowOf(shop.id)).toMatchObject({ ...body, visible: false, commissionPct: 5 });
  });
});

describe("PATCH /api/shops/[id] : ce que le propriétaire peut faire", () => {
  const send = (body: unknown) => SHOP_ROUTE[1].send(shop.id, body);

  it("nom, horaires, majoration 50 % et seuil 10 % : 200 et écrit, commission intacte", async () => {
    const openingHours = { lundi: { open: "08:00", close: "19:00" } };
    const body = {
      name: "Boucherie Renommée",
      openingHours,
      commissionMarkupPercent: 50,
      priceAdjustmentThreshold: 10,
    };

    expect((await answer(send(body))).status).toBe(200);
    expect(await rowOf(shop.id)).toMatchObject({
      ...body,
      commissionPct: 5,
      commissionEnabled: true,
      visible: false,
    });
  });

  it("le propriétaire d'une boutique suspendue ne lève pas la suspension : 400", async () => {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { suspendedAt: new Date("2026-11-10T09:00:00Z"), suspendReason: "Hygiène" },
    });

    await expectRefusedUnchanged(send({ name: "Réouverture", suspendedAt: null, visible: true }));
  });

  it("sans session : 401 ; boucher d'une autre boutique : 403 ; rien n'est écrit", async () => {
    const before = await rowOf(shop.id);
    session.clerkId = null;
    expect((await send({ name: "Anonyme" })).status).toBe(401);

    const intruder = await createTestUser({ role: "BOUCHER" });
    actAs(intruder, (await createTestShop({ ownerId: intruder.id })).id);
    expect((await send({ name: "Intrus" })).status).toBe(403);
    expect(await rowOf(shop.id)).toEqual(before);
  });
});

describe("commission : écrite par l'administration seule, et tracée", () => {
  let admin: User;
  const sendCommission = (body: unknown) =>
    patchShopCommission(patch(`/api/admin/shops/${shop.id}/commission`, body), {
      params: { shopId: shop.id },
    });
  const sendGlobal = (body: unknown) =>
    patchGlobalCommission(patch("/api/admin/commission/global", body));
  const auditRows = () =>
    prisma.auditLog.findMany({
      select: { actorId: true, action: true, target: true, targetId: true, details: true },
      orderBy: { createdAt: "asc" },
    });

  beforeEach(async () => {
    admin = await createTestUser({ role: "ADMIN" });
    actAs(admin, null);
  });

  it("l'administrateur ne la change pas par PATCH /api/shops/[id] : 400, ligne inchangée", async () => {
    await expectRefusedUnchanged(SHOP_ROUTE[1].send(shop.id, { commissionPct: 12 }));
  });

  it("l'administrateur garde les photos sur PATCH /api/shops/[id] : 200 et écrit", async () => {
    expect((await answer(SHOP_ROUTE[1].send(shop.id, { imageUrl: SHOP_PHOTO }))).status).toBe(200);
    expect((await rowOf(shop.id)).imageUrl).toBe(SHOP_PHOTO);
  });

  it("PATCH /api/admin/shops/[shopId]/commission : 12 % activée, une ligne d'audit à son nom", async () => {
    const response = await answer(sendCommission({ commissionPct: 12, commissionEnabled: true }));

    expect(response.status).toBe(200);
    expect(await rowOf(shop.id)).toMatchObject({ commissionPct: 12, commissionEnabled: true });
    expect(await auditRows()).toEqual([
      {
        actorId: admin.clerkId,
        action: "shop.commission_change",
        target: "Shop",
        targetId: shop.id,
        details: { commissionPct: 12, enabled: true },
      },
    ]);
  });

  it("PATCH /api/admin/shops/[shopId]/commission sans commissionEnabled : le taux seul change", async () => {
    await prisma.shop.update({ where: { id: shop.id }, data: { commissionEnabled: false } });

    expect((await answer(sendCommission({ commissionPct: 7 }))).status).toBe(200);
    expect(await rowOf(shop.id)).toMatchObject({ commissionPct: 7, commissionEnabled: false });
    expect(await auditRows()).toEqual([
      {
        actorId: admin.clerkId,
        action: "shop.commission_change",
        target: "Shop",
        targetId: shop.id,
        details: { commissionPct: 7 },
      },
    ]);
  });

  it("route de la boutique : clé en trop et JSON invalide 400, boucher 403, rien d'écrit", async () => {
    await expectRefusedUnchanged(sendCommission({ commissionPct: 12, tier: "GOLD" }));
    const before = await rowOf(shop.id);
    expect(await answer(sendCommission("{bad"))).toEqual(INVALID_JSON);

    actAs(owner, shop.id);
    expect((await sendCommission({ commissionPct: 0 })).status).toBe(403);
    expect(await rowOf(shop.id)).toEqual(before);
    expect(await auditRows()).toEqual([]);
  });

  it("PATCH /api/admin/commission/global : toutes les boutiques, une ligne d'audit", async () => {
    const other = await createTestShop({ commissionPct: 9 });

    expect((await answer(sendGlobal({ commissionPct: 4 }))).status).toBe(200);
    for (const id of [shop.id, other.id]) {
      expect(await rowOf(id)).toMatchObject({ commissionPct: 4, commissionEnabled: true });
    }
    expect(await auditRows()).toEqual([
      {
        actorId: admin.clerkId,
        action: "commission.global_change",
        target: "Shop",
        targetId: null,
        details: { commissionPct: 4, commissionEnabled: true, updated: 2 },
      },
    ]);
  });

  it("route globale : clé en trop et JSON invalide 400, boucher 403, rien d'écrit", async () => {
    await expectRefusedUnchanged(sendGlobal({ commissionPct: 0, visible: true }));
    const before = await rowOf(shop.id);
    expect(await answer(sendGlobal("{bad"))).toEqual(INVALID_JSON);

    actAs(owner, shop.id);
    expect((await sendGlobal({ commissionPct: 0 })).status).toBe(403);
    expect(await rowOf(shop.id)).toEqual(before);
    expect(await auditRows()).toEqual([]);
  });
});
