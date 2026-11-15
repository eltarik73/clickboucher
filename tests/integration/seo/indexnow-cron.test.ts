// @vitest-environment node
// IndexNow sur PostgreSQL réel (C1-SEO, FIX-03, FIX-19, D9) : le cron quotidien n'envoie que les
// pages modifiées depuis le début de la veille (UTC), jamais une page boutique, et rien quand rien
// n'a changé ; la validation d'une boutique n'envoie que l'accueil et la page de sa ville.
// Aucun moteur n'est appelé : le transport (@/lib/indexnow) est simulé, l'auth du cron aussi ; pour
// la validation, seule la session Clerk et les envois sortants sont simulés.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
});
vi.mock("@/lib/indexnow", () => ({ notifyIndexNow: vi.fn(async (_urls: string[]) => undefined) }));
vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: vi.fn(() => true) }));
vi.mock(
  "@clerk/nextjs/server",
  async () => (await import("../security/shop-routes-harness")).clerkMock
);
vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("../security/shop-routes-harness")).serverAuthMock
);
vi.mock("@/lib/email", async () => (await import("../security/shop-routes-harness")).emailMock);
vi.mock("@/lib/push", async () => (await import("../security/shop-routes-harness")).pushMock);
vi.mock(
  "@/lib/whatsapp",
  async () => (await import("../security/shop-routes-harness")).whatsappMock
);

import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { PATCH as patchValidate } from "@/app/api/admin/shops/[shopId]/validate/route";
import { GET as cronIndexNowFresh } from "@/app/api/cron/indexnow-fresh/route";
import { verifyCronAuth } from "@/lib/cron-auth";
import { notifyIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/seo/site";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop } from "../helpers/factories";
import { actAs, call, createAdmin, ownedShop } from "../security/shop-routes-harness";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const notified = vi.mocked(notifyIndexNow);
const RUN_AT = new Date("2031-06-15T03:11:00.000Z");
const YESTERDAY = new Date("2031-06-14T15:00:00.000Z");
const LONG_AGO = new Date("2031-01-01T00:00:00.000Z");

function recipe(slug: string, updatedAt: Date, aiGenerated: boolean): Prisma.RecipeCreateManyInput {
  return {
    slug,
    title: `Recette ${slug}`,
    description: "Recette de test",
    prepTime: 10,
    cookTime: 20,
    totalTime: 30,
    ingredients: [],
    steps: [],
    tags: [],
    meatType: "agneau",
    meatQuantity: "500 g",
    aiGenerated,
    featured: false,
    published: true,
    updatedAt,
  };
}

/** Runs the cron as Vercel would at RUN_AT; the rows are written before the clock is set. */
async function runCron(): Promise<{ status: number; body: { data?: Record<string, unknown> } }> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(RUN_AT);
  const response = await cronIndexNowFresh(
    new NextRequest("http://localhost/api/cron/indexnow-fresh")
  );
  vi.useRealTimers();
  return { status: response.status, body: await response.json() };
}

function sentUrls(): string[] {
  expect(notified).toHaveBeenCalledTimes(1);
  return notified.mock.calls[0][0];
}

describe("GET /api/cron/indexnow-fresh", () => {
  it("sends nothing when no page changed since the start of the previous day", async () => {
    await createTestShop({ city: "Chambéry", validatedAt: LONG_AGO });
    await createTestShop({ city: "Lyon", validatedAt: LONG_AGO });
    await prisma.recipe.createMany({ data: [recipe("tajine", LONG_AGO, false)] });

    const result = await runCron();

    expect(result.status).toBe(200);
    expect(result.body.data).toMatchObject({ urlCount: 0, byFamily: {} });
    expect(notified).not.toHaveBeenCalled();
  });

  it("sends the pages changed yesterday, never a shop page", async () => {
    const chambery = await createTestShop({ city: "Chambéry", validatedAt: YESTERDAY });
    await createTestShop({ city: "Lyon", validatedAt: LONG_AGO });
    await createTestShop({ city: "Grenoble", validatedAt: YESTERDAY, suspendedAt: YESTERDAY });
    await prisma.recipe.createMany({
      data: [recipe("tajine", YESTERDAY, false), recipe("couscous-ia", YESTERDAY, true)],
    });

    const result = await runCron();

    const urls = sentUrls();
    expect(urls.filter((url) => url.includes("/boutique"))).toEqual([]);
    expect(urls.join("\n")).not.toContain(chambery.slug);
    expect([...urls].sort()).toEqual(
      [
        SITE_URL,
        `${SITE_URL}/boucherie-halal/chambery`,
        `${SITE_URL}/recettes`,
        `${SITE_URL}/recettes/tajine`,
      ].sort()
    );
    expect(result.body.data).toMatchObject({
      urlCount: 4,
      byFamily: { static: 2, city: 1, recipe: 1 },
    });
  });

  it("refuses a request without the cron secret and sends nothing", async () => {
    vi.mocked(verifyCronAuth).mockReturnValueOnce(false);

    const result = await runCron();

    expect(result.status).toBe(401);
    expect(notified).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/shops/[shopId]/validate", () => {
  it("sends the home page and the shop's city page when a shop is approved, not the shop page", async () => {
    const { shop } = await ownedShop({ visible: false, city: "Chambéry" });
    actAs(await createAdmin());

    const result = await call(patchValidate, { shopId: shop.id }, { approved: true });

    expect(result.status).toBe(200);
    expect(sentUrls()).toEqual([SITE_URL, `${SITE_URL}/boucherie-halal/chambery`]);
  });

  it("sends the home page only for a shop outside the SEO cities", async () => {
    const { shop } = await ownedShop({ visible: false, city: "Marseille" });
    actAs(await createAdmin());

    expect((await call(patchValidate, { shopId: shop.id }, { approved: true })).status).toBe(200);
    expect(sentUrls()).toEqual([SITE_URL]);
  });

  it("sends nothing when a shop is rejected", async () => {
    const { shop } = await ownedShop({ visible: true, city: "Chambéry" });
    actAs(await createAdmin());

    expect((await call(patchValidate, { shopId: shop.id }, { approved: false })).status).toBe(200);
    expect(notified).not.toHaveBeenCalled();
  });

  describe("IndexNow does not answer", () => {
    const deployEnv = process.env.KLIKGO_DEPLOY_ENV;

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.stubEnv("KLIKGO_DEPLOY_ENV", deployEnv);
    });

    // The real transport of a production deployment; only the network is simulated, so nothing
    // leaves the machine. notifyIndexNow logs the failure and resolves: the route awaits it plainly.
    it("still approves the shop", async () => {
      const transport = await vi.importActual<typeof import("@/lib/indexnow")>("@/lib/indexnow");
      notified.mockImplementationOnce(transport.notifyIndexNow);
      const network = vi.fn(async (_input: string | URL | Request) => {
        throw new TypeError("fetch failed");
      });
      vi.stubGlobal("fetch", network);
      vi.stubEnv("KLIKGO_DEPLOY_ENV", "production");
      const { shop } = await ownedShop({ visible: false, city: "Chambéry" });
      actAs(await createAdmin());

      const result = await call(patchValidate, { shopId: shop.id }, { approved: true });

      expect(network.mock.calls.map(([input]) => String(input))).toEqual([
        "https://api.indexnow.org/IndexNow",
      ]);
      expect(result).toEqual({ status: 200, body: { success: true, data: { approved: true } } });
      expect((await prisma.shop.findUniqueOrThrow({ where: { id: shop.id } })).visible).toBe(true);
    });
  });
});
