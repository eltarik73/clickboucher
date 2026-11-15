// @vitest-environment node
// Publication d'une boutique par les routes (C1-FAILLES-CRITIQUES, D2, D9, D11, D15, D16), sur
// PostgreSQL réel : une boutique jamais validée ne se publie pas elle-même (onboarding, congés),
// seule la validation de l'administration la met en ligne ; les routes du boucher refusent toute
// clé hors de leur schéma ; le cron de fin de congés ne rouvre pas une boutique suspendue ;
// l'inscription crée une boutique hors liste.
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { PATCH as patchValidate } from "@/app/api/admin/shops/[shopId]/validate/route";
import { GET as getOnboarding, PATCH as patchOnboarding } from "@/app/api/boucher/onboarding/route";
import { PATCH as patchShopStatus } from "@/app/api/boucher/shop/status/route";
import { GET as cronVacationEnd } from "@/app/api/cron/vacation-end/route";
import { POST as postRegister } from "@/app/api/shops/register/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestUser } from "../helpers/factories";
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
  vi.unstubAllEnvs();
});

const NOT_PUBLISHED_OWNER =
  "Votre boutique n'est pas encore en ligne : elle doit d'abord être validée par Klik&Go.";
const NOT_ON_VACATION = "La boutique n'est pas en vacances";
const FORBIDDEN_FIELD = "Ce champ ne peut pas être modifié ici";
const VACATION = { start: "2026-12-20T00:00:00.000Z", end: "2027-01-05T00:00:00.000Z" };
const PAST = new Date("2025-01-05T00:00:00.000Z");

describe("une boutique jamais validée ne se publie pas elle-même", () => {
  it.each<[string, () => Promise<ApiResult>, object]>([
    [
      "onboarding { setVisible }",
      () => call(patchOnboarding, {}, { setVisible: true }),
      { status: 400, code: "VALIDATION_ERROR", message: "Données invalides" },
    ],
    [
      "congés",
      () => call(patchShopStatus, {}, { action: "vacation", ...VACATION }),
      { status: 409, code: "CONFLICT", message: NOT_PUBLISHED_OWNER },
    ],
    [
      "fin de congés",
      () => call(patchShopStatus, {}, { action: "end_vacation" }),
      { status: 409, code: "CONFLICT", message: NOT_ON_VACATION },
    ],
  ])("%s : refusé, elle reste hors ligne", async (_label, attempt, expected) => {
    const { owner, shop } = await ownedShop({ visible: false });
    const before = await shopRow(shop.id);
    actAs(owner);

    expect(refusal(await attempt())).toEqual(expected);

    expect(await shopRow(shop.id)).toEqual(before);
  });

  it("la validation par l'administration la publie, date l'acte et prévient le boucher", async () => {
    const admin = await createAdmin();
    const { owner, shop } = await ownedShop({ visible: false, onboardingCompleted: false });
    const before = new Date();
    actAs(admin);

    const result = await call(patchValidate, { shopId: shop.id }, { approved: true });

    expect(result).toEqual({ status: 200, body: { success: true, data: { approved: true } } });
    const row = await shopRow(shop.id);
    expect(row).toMatchObject({ visible: true, onboardingCompleted: true, suspendedAt: null });
    expect(row.validatedAt).toBeInstanceOf(Date);
    expect(row.validatedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(sendEmail).toHaveBeenCalledWith(
      owner.email,
      "🎉 Bienvenue sur Klik&Go !",
      expect.any(String)
    );
    expect(
      await prisma.notification.findMany({ where: { userId: owner.id }, select: { type: true } })
    ).toEqual([{ type: "ACCOUNT_APPROVED" }]);
    expect((await auditTrail(shop.id)).map((entry) => entry.action)).toEqual(["shop.validate"]);
  });

  it("le commutateur visible de l'administration publie une boutique non suspendue", async () => {
    const admin = await createAdmin();
    const { shop } = await ownedShop({ visible: false, featured: false });
    actAs(admin);

    const result = await call(
      patchAdminShop,
      { shopId: shop.id },
      { visible: true, featured: true }
    );

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ id: shop.id, visible: true, featured: true });
    expect(await shopRow(shop.id)).toMatchObject({ visible: true, featured: true });
    expect(await auditTrail(shop.id)).toEqual([
      { actorId: admin.clerkId, action: "shop.toggle", details: { featured: true, visible: true } },
    ]);
  });
});

describe("congés d'une boutique publiée", () => {
  it("le boucher part en congés puis revient : la boutique quitte la liste puis y revient", async () => {
    const { owner, shop } = await ownedShop();
    actAs(owner);

    expect((await call(patchShopStatus, {}, { action: "vacation", ...VACATION })).status).toBe(200);
    expect(await shopRow(shop.id)).toMatchObject({
      visible: false,
      vacationMode: true,
      status: "VACATION",
    });

    expect((await call(patchShopStatus, {}, { action: "end_vacation" })).status).toBe(200);
    expect(await shopRow(shop.id)).toMatchObject({
      visible: true,
      vacationMode: false,
      status: "OPEN",
    });
  });

  it("des congés qui finissent avant de commencer sont refusés (400)", async () => {
    const { owner, shop } = await ownedShop();
    const before = await shopRow(shop.id);
    actAs(owner);

    const result = await call(
      patchShopStatus,
      {},
      {
        action: "vacation",
        start: VACATION.end,
        end: VACATION.start,
      }
    );

    expect(refusal(result)).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(await shopRow(shop.id)).toEqual(before);
  });

  it("le refus de l'administration annule les congés : leur fin ne republie plus", async () => {
    const admin = await createAdmin();
    const { owner, shop } = await ownedShop();
    actAs(owner);
    await call(patchShopStatus, {}, { action: "vacation", ...VACATION });

    actAs(admin);
    expect((await call(patchValidate, { shopId: shop.id }, { approved: false })).status).toBe(200);
    expect(await shopRow(shop.id)).toMatchObject({
      visible: false,
      vacationMode: false,
      vacationEnd: null,
    });

    actAs(owner);
    expect(refusal(await call(patchShopStatus, {}, { action: "end_vacation" }))).toMatchObject({
      status: 409,
      message: NOT_ON_VACATION,
    });
    expect((await shopRow(shop.id)).visible).toBe(false);
  });
});

describe("les routes du boucher refusent une clé hors de leur schéma", () => {
  it.each<[string, () => Promise<ApiResult>]>([
    ["onboarding", () => call(patchOnboarding, {}, { complete: true, visible: true })],
    ["statut pause", () => call(patchShopStatus, {}, { action: "pause", commissionPct: 0 })],
    [
      "statut update_settings",
      () =>
        call(patchShopStatus, {}, { action: "update_settings", prepTimeMin: 20, visible: true }),
    ],
    [
      "statut end_vacation",
      () => call(patchShopStatus, {}, { action: "end_vacation", visible: true }),
    ],
  ])("%s : 400 et la ligne ne bouge pas", async (_label, attempt) => {
    const { owner, shop } = await ownedShop({ visible: false, onboardingCompleted: false });
    const before = await shopRow(shop.id);
    actAs(owner);

    const result = await attempt();

    expect(refusal(result)).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Données invalides",
    });
    expect(result.body.error?.details).toEqual({ _root: [FORBIDDEN_FIELD] });
    expect(await shopRow(shop.id)).toEqual(before);
  });
});

describe("GET /api/boucher/onboarding dit où en est la publication", () => {
  it.each([
    ["UNPUBLISHED", { visible: false }],
    ["PUBLISHED", { visible: true }],
    ["ON_VACATION", { visible: false, vacationMode: true }],
    ["SUSPENDED", { visible: false, suspendedAt: new Date("2026-11-01T10:00:00Z") }],
  ])("%s", async (publication, state) => {
    const { owner } = await ownedShop(state);
    actAs(owner);

    const result = await call(getOnboarding, {});

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ publication, visible: state.visible });
  });
});

describe("cron de fin de congés", () => {
  it("rouvre les congés échus d'une boutique publiée, laisse cachée une boutique suspendue", async () => {
    vi.stubEnv("CRON_SECRET", "itest-cron-secret");
    const vacation = {
      visible: false,
      status: "VACATION",
      vacationMode: true,
      vacationEnd: PAST,
    } as const;
    const { shop: back } = await ownedShop(vacation);
    const { shop: suspended } = await ownedShop({ ...vacation, suspendedAt: PAST });
    const suspendedBefore = await shopRow(suspended.id);

    const result = await call(cronVacationEnd, {}, undefined, {
      headers: { authorization: "Bearer itest-cron-secret" },
    });

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ reopenedCount: 1 });
    expect(await shopRow(back.id)).toMatchObject({
      visible: true,
      status: "OPEN",
      vacationMode: false,
    });
    expect(await shopRow(suspended.id)).toEqual(suspendedBefore);
  });
});

describe("inscription d'un boucher", () => {
  it("POST /api/shops/register crée la boutique hors liste", async () => {
    const user = await createTestUser();
    actAs(user);

    const result = await call(
      postRegister,
      {},
      {
        name: "Boucherie de l'Inscription",
        address: "12 rue des Tests",
        city: "Chambéry",
        phone: "0612345678",
        email: "inscription@itest.klikandgo.test",
        siret: "12345678901234",
      },
      { method: "POST" }
    );

    expect(result.status).toBe(201);
    const shopId = String(result.body.data?.shopId);
    expect(await shopRow(shopId)).toMatchObject({ visible: false, ownerId: user.clerkId });
  });
});
