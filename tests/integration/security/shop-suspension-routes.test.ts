// @vitest-environment node
// Suspension d'une boutique par les routes (C1-FAILLES-CRITIQUES, D8, D12, D14), sur PostgreSQL
// réel : l'administration suspend, le boucher ne peut plus rien rouvrir ni republier par aucune de
// ses routes (onboarding, statut, service), l'administration ne la republie pas par mégarde
// (validation, commutateur « visible », statut) et seule la réactivation la remet en ligne.
// Avant ce chantier, « resume », « end_vacation » et { setVisible: true } rouvraient la boutique.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Shop, User } from "@prisma/client";

vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
});
vi.mock("@clerk/nextjs/server", async () => (await import("./shop-routes-harness")).clerkMock);
vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("./shop-routes-harness")).serverAuthMock
);
vi.mock("@/lib/email", async () => (await import("./shop-routes-harness")).emailMock);
vi.mock("@/lib/push", async () => (await import("./shop-routes-harness")).pushMock);
vi.mock("@/lib/whatsapp", async () => (await import("./shop-routes-harness")).whatsappMock);

import { PATCH as patchAdminShop } from "@/app/api/admin/shops/[shopId]/route";
import { PATCH as patchSuspend } from "@/app/api/admin/shops/[shopId]/suspend/route";
import { PATCH as patchValidate } from "@/app/api/admin/shops/[shopId]/validate/route";
import { PATCH as patchOnboarding } from "@/app/api/boucher/onboarding/route";
import { PATCH as patchBoucherService } from "@/app/api/boucher/service/route";
import { PATCH as patchShopStatus } from "@/app/api/boucher/shop/status/route";
import { PATCH as patchServiceStatus } from "@/app/api/shops/[id]/status/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  actAs,
  auditTrail,
  call,
  createAdmin,
  ownedShop,
  refusal,
  sendEmail,
  shopRow,
  type ApiResult,
} from "./shop-routes-harness";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

afterEach(() => {
  vi.clearAllMocks();
});

const SUSPENDED_OWNER =
  "Votre boutique est suspendue par Klik&Go. Contactez le support pour la réactiver.";
const SUSPENDED_ADMIN = "Boutique suspendue : réactivez-la d'abord";
const FORBIDDEN_OWNER = { status: 403, code: "FORBIDDEN", message: SUSPENDED_OWNER };
const CONFLICT_ADMIN = { status: 409, code: "CONFLICT", message: SUSPENDED_ADMIN };
const VACATION = { start: "2026-12-20T00:00:00.000Z", end: "2027-01-05T00:00:00.000Z" };

const shopLogs = (shopId: string) =>
  prisma.shopLog.findMany({ where: { shopId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

/** A published shop, then suspended by an admin through the route; the admin stays signed in. */
async function suspendedShop(): Promise<{ admin: User; owner: User; shop: Shop }> {
  const admin = await createAdmin();
  const { owner, shop } = await ownedShop({ onboardingCompleted: false });
  actAs(admin);
  const result = await call(patchSuspend, { shopId: shop.id }, { suspended: true, reason: "Test" });
  expect(result).toEqual({ status: 200, body: { success: true, data: { suspended: true } } });
  return { admin, owner, shop };
}

describe("l'administration suspend une boutique", () => {
  it("la boutique est suspendue, hors ligne et fermée, et l'acte est journalisé", async () => {
    const before = new Date();
    const { admin, shop } = await suspendedShop();

    const row = await shopRow(shop.id);
    expect(row).toMatchObject({ suspendReason: "Test", visible: false, status: "CLOSED" });
    expect(row.suspendedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(await auditTrail(shop.id)).toEqual([
      { actorId: admin.clerkId, action: "shop.suspend", details: { reason: "Test" } },
    ]);
  });

  it("sans motif, la suspension porte le motif par défaut", async () => {
    const admin = await createAdmin();
    const { shop } = await ownedShop();
    actAs(admin);

    expect((await call(patchSuspend, { shopId: shop.id }, { suspended: true })).status).toBe(200);

    expect((await shopRow(shop.id)).suspendReason).toBe("Suspendue par l'administration");
  });
});

describe("le boucher ne rouvre pas sa boutique suspendue", () => {
  const attempts: Array<[string, (shopId: string) => Promise<ApiResult>, object]> = [
    [
      "onboarding { complete }",
      () => call(patchOnboarding, {}, { complete: true }),
      FORBIDDEN_OWNER,
    ],
    ["statut pause", () => call(patchShopStatus, {}, { action: "pause" }), FORBIDDEN_OWNER],
    ["statut resume", () => call(patchShopStatus, {}, { action: "resume" }), FORBIDDEN_OWNER],
    [
      "statut busy",
      () => call(patchShopStatus, {}, { action: "busy", extraMin: 10, durationMin: 30 }),
      FORBIDDEN_OWNER,
    ],
    [
      "statut end_vacation",
      () => call(patchShopStatus, {}, { action: "end_vacation" }),
      FORBIDDEN_OWNER,
    ],
    ["statut end_busy", () => call(patchShopStatus, {}, { action: "end_busy" }), FORBIDDEN_OWNER],
    [
      "statut vacation",
      () => call(patchShopStatus, {}, { action: "vacation", ...VACATION }),
      FORBIDDEN_OWNER,
    ],
    ["statut close", () => call(patchShopStatus, {}, { action: "close" }), FORBIDDEN_OWNER],
    [
      "statut update_settings",
      () => call(patchShopStatus, {}, { action: "update_settings", prepTimeMin: 20 }),
      FORBIDDEN_OWNER,
    ],
    [
      "PATCH /api/boucher/service OPEN",
      () => call(patchBoucherService, {}, { status: "OPEN" }),
      FORBIDDEN_OWNER,
    ],
    [
      "PATCH /api/boucher/service débordée et en pause",
      () => call(patchBoucherService, {}, { busyMode: true, paused: true }),
      FORBIDDEN_OWNER,
    ],
    [
      "PATCH /api/shops/[id]/status OPEN",
      (shopId) => call(patchServiceStatus, { id: shopId }, { status: "OPEN" }),
      FORBIDDEN_OWNER,
    ],
    [
      "PATCH /api/shops/[id]/status préparation 25 min",
      (shopId) => call(patchServiceStatus, { id: shopId }, { prepTimeMin: 25 }),
      FORBIDDEN_OWNER,
    ],
    [
      "onboarding { setVisible }",
      () => call(patchOnboarding, {}, { setVisible: true }),
      { status: 400, code: "VALIDATION_ERROR", message: "Données invalides" },
    ],
  ];

  it.each(attempts)(
    "%s : refusé, ni la ligne ni le journal ne bougent",
    async (_label, attempt, expected) => {
      const { owner, shop } = await suspendedShop();
      const before = await shopRow(shop.id);
      const logsBefore = await shopLogs(shop.id);
      actAs(owner);

      expect(refusal(await attempt(shop.id))).toEqual(expected);

      expect(await shopRow(shop.id)).toEqual(before);
      expect(await shopLogs(shop.id)).toEqual(logsBefore);
    }
  );

  it("onboarding sans complete : rien à écrire, donc rien à refuser", async () => {
    const { owner, shop } = await suspendedShop();
    const before = await shopRow(shop.id);
    actAs(owner);

    const result = await call(patchOnboarding, {}, {});

    expect(result).toEqual({
      status: 200,
      body: { success: true, data: { onboardingCompleted: false } },
    });
    expect(await shopRow(shop.id)).toEqual(before);
  });

  it("un boucher qui appelle la route de suspension reçoit 403", async () => {
    const { owner, shop } = await suspendedShop();
    const before = await shopRow(shop.id);
    actAs(owner);

    const result = await call(patchSuspend, { shopId: shop.id }, { suspended: false });

    expect(result.status).toBe(403);
    expect(await shopRow(shop.id)).toEqual(before);
  });
});

describe("l'administration ne republie pas une boutique suspendue par mégarde", () => {
  it("la validation est refusée (409) : ni publication, ni notification, ni journal", async () => {
    const { owner, shop } = await suspendedShop();
    const before = await shopRow(shop.id);

    const result = await call(patchValidate, { shopId: shop.id }, { approved: true });

    expect(refusal(result)).toEqual(CONFLICT_ADMIN);
    expect(await shopRow(shop.id)).toEqual(before);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await prisma.notification.count({ where: { userId: owner.id } })).toBe(0);
    expect((await auditTrail(shop.id)).map((entry) => entry.action)).toEqual(["shop.suspend"]);
  });

  it.each([
    [
      "le commutateur visible",
      (id: string) => call(patchAdminShop, { shopId: id }, { visible: true }),
    ],
    ["le statut OPEN", (id: string) => call(patchServiceStatus, { id }, { status: "OPEN" })],
  ])("%s est refusé (409) et la ligne ne bouge pas", async (_label, attempt) => {
    const { shop } = await suspendedShop();
    const before = await shopRow(shop.id);

    expect(refusal(await attempt(shop.id))).toEqual(CONFLICT_ADMIN);

    expect(await shopRow(shop.id)).toEqual(before);
  });
});

describe("la réactivation, décision de l'administration seule", () => {
  it("remet la boutique en ligne et ouverte, journalisée ; le boucher reprend la main", async () => {
    const { admin, owner, shop } = await suspendedShop();

    const result = await call(patchSuspend, { shopId: shop.id }, { suspended: false });

    expect(result).toEqual({ status: 200, body: { success: true, data: { suspended: false } } });
    expect(await shopRow(shop.id)).toMatchObject({
      suspendedAt: null,
      suspendReason: null,
      visible: true,
      status: "OPEN",
    });
    expect(await auditTrail(shop.id)).toEqual([
      { actorId: admin.clerkId, action: "shop.suspend", details: { reason: "Test" } },
      { actorId: admin.clerkId, action: "shop.reactivate", details: null },
    ]);

    actAs(owner);
    expect((await call(patchShopStatus, {}, { action: "pause" })).status).toBe(200);
    expect(await shopRow(shop.id)).toMatchObject({ status: "PAUSED", paused: true });
  });

  it("une seconde réactivation est refusée (409)", async () => {
    const { shop } = await suspendedShop();
    await call(patchSuspend, { shopId: shop.id }, { suspended: false });

    const again = await call(patchSuspend, { shopId: shop.id }, { suspended: false });

    expect(refusal(again)).toEqual({
      status: 409,
      code: "CONFLICT",
      message: "La boutique n'est pas suspendue",
    });
  });
});
