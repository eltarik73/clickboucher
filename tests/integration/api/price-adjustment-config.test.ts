// @vitest-environment node
// Réglage plateforme des ajustements de prix sur PostgreSQL réel : seul le plafond de sécurité d'un
// ajustement (pa_max_increase_pct) reste réglable. PATCH n'accepte que lui (Zod strict, entier de 1
// à 100), l'écrit, l'audite et vide le cache ; les anciens réglages restés en base ne sont ni lus
// ni renvoyés. Simulé : le helper d'auth admin.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ admin: { userId: "admin-itest" } as unknown }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn(async () => session.admin) }));

import { apiError } from "@/lib/api/errors";
import { invalidateConfig } from "@/lib/feature-flags";
import { getPriceAdjConfig } from "@/lib/price-adjustment";
import { GET, PATCH } from "@/app/api/webmaster/config/price-adjustment/route";
import { prisma, useCleanDatabase } from "../helpers/db";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const KEY = "pa_max_increase_pct";

function patch(body: unknown) {
  return PATCH(
    new NextRequest("http://localhost/api/webmaster/config/price-adjustment", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function stored(key: string) {
  return (await prisma.platformConfig.findUnique({ where: { key } }))?.value ?? null;
}

beforeEach(() => {
  session.admin = { userId: "admin-itest" };
  // The database is emptied before each test; the 2-minute cache of platform_config is not.
  invalidateConfig(KEY);
});

describe("PATCH /api/webmaster/config/price-adjustment", () => {
  it("stores the cap, audits it and serves the new value at once", async () => {
    expect(await getPriceAdjConfig()).toEqual({ maxIncreasePct: 50 });

    const response = await patch({ maxIncreasePct: 40 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { maxIncreasePct: 40 } });
    expect(await stored(KEY)).toBe("40");
    expect(await getPriceAdjConfig()).toEqual({ maxIncreasePct: 40 });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { targetId: KEY } });
    expect(audit).toMatchObject({ actorId: "admin-itest", action: "config.update" });
    expect(audit.details).toEqual({ from: null, to: "40" });
  });

  it.each<Record<string, unknown>>([
    { enableAutoApprove: true },
    { maxIncreasePct: 40, requireReason: false },
  ])("refuses any other setting (%o) and writes nothing", async (body) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.platformConfig.count()).toBe(0);
  });

  it.each([
    [0, "Le plafond est d'au moins 1 %"],
    [101, "Le plafond est d'au plus 100 %"],
    [12.5, "Le plafond est un nombre entier de pourcents"],
  ])("refuses a cap of %s with a French message", async (maxIncreasePct, message) => {
    const response = await patch({ maxIncreasePct });

    expect(response.status).toBe(400);
    expect((await response.json()).error.details.maxIncreasePct).toEqual([message]);
    expect(await stored(KEY)).toBeNull();
  });

  it("is refused to a non-admin", async () => {
    session.admin = { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };

    expect((await patch({ maxIncreasePct: 40 })).status).toBe(403);
    expect(await stored(KEY)).toBeNull();
  });
});

describe("GET /api/webmaster/config/price-adjustment", () => {
  it("returns the cap alone, whatever former settings remain stored", async () => {
    await prisma.platformConfig.createMany({
      data: [
        { key: KEY, value: "35" },
        { key: "pa_enable_auto_approve", value: "true" },
        { key: "pa_require_reason", value: "true" },
      ],
    });

    const response = await GET();

    expect(await response.json()).toEqual({ success: true, data: { maxIncreasePct: 35 } });
  });
});
