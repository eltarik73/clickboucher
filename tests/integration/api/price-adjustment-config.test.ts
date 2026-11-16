// @vitest-environment node
// The safety cap of one price adjustment on real PostgreSQL: one writer (PATCH /api/webmaster/config,
// which holds pa_max_increase_pct to its rule and stores nothing else for it), one reader
// (getMaxIncreasePct, which never applies a stored value that breaks the rule), and the dedicated
// route that only reads it. Simulated: the admin auth helper.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ admin: { userId: "admin-itest" } as unknown }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn(async () => session.admin) }));

import { apiError } from "@/lib/api/errors";
import { invalidateConfig } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import { getMaxIncreasePct } from "@/lib/price-adjustment";
import { PATCH } from "@/app/api/webmaster/config/route";
import * as capRoute from "@/app/api/webmaster/config/price-adjustment/route";
import { prisma, useCleanDatabase } from "../helpers/db";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const KEY = "pa_max_increase_pct";

function patch(body: string) {
  return PATCH(
    new NextRequest("http://localhost/api/webmaster/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
    })
  );
}

async function stored(key: string) {
  return (await prisma.platformConfig.findUnique({ where: { key } }))?.value ?? null;
}

async function storeCap(value: string) {
  await prisma.platformConfig.create({ data: { key: KEY, value } });
}

beforeEach(() => {
  session.admin = { userId: "admin-itest" };
  // The database is emptied before each test; the 2-minute cache of platform_config is not.
  invalidateConfig(KEY);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getMaxIncreasePct", () => {
  it("is 50 without a stored cap", async () => {
    expect(await getMaxIncreasePct()).toBe(50);
  });

  it("is the stored cap when it follows the rule", async () => {
    await storeCap("40");

    expect(await getMaxIncreasePct()).toBe(40);
  });

  it.each(["0", "900", "12.5", ""])(
    "never applies the stored cap %j: 50, with a warning",
    async (value) => {
      await storeCap(value);
      const warn = vi.spyOn(logger, "warn");

      expect(await getMaxIncreasePct()).toBe(50);
      expect(warn).toHaveBeenCalledWith("[price-adjustment] stored cap refused, default applied", {
        key: KEY,
        stored: value,
        applied: 50,
      });
    }
  );
});

describe("PATCH /api/webmaster/config", () => {
  it("stores a valid cap, audits it once and serves it at once", async () => {
    expect(await getMaxIncreasePct()).toBe(50);

    const response = await patch(JSON.stringify({ key: KEY, value: "30" }));

    expect(response.status).toBe(200);
    expect(await stored(KEY)).toBe("30");
    expect(await getMaxIncreasePct()).toBe(30);
    const audits = await prisma.auditLog.findMany({ where: { targetId: KEY } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorId: "admin-itest", action: "config.update" });
    expect(audits[0].details).toEqual({ from: null, to: "30" });
  });

  it.each([
    ["0", "Le plafond est d'au moins 1 %"],
    ["900", "Le plafond est d'au plus 100 %"],
    ["12.5", "Le plafond est un nombre entier de pourcents"],
    ["abc", "Le plafond est un nombre de pourcents"],
  ])("refuses a cap of %j in French and stores nothing", async (value, message) => {
    await storeCap("40");

    const response = await patch(JSON.stringify({ key: KEY, value }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual({
      code: "VALIDATION_ERROR",
      message,
      details: { value: [message] },
    });
    expect(await stored(KEY)).toBe("40");
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("still stores any text under another key", async () => {
    const response = await patch(JSON.stringify({ key: "support_email", value: "0" }));

    expect(response.status).toBe(200);
    expect(await stored("support_email")).toBe("0");
  });

  it("answers 400 to a body that is not JSON, and stores nothing", async () => {
    const response = await patch("{");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.platformConfig.count()).toBe(0);
  });

  it("is refused to a non-admin", async () => {
    session.admin = { error: apiError("FORBIDDEN", "Accès réservé aux administrateurs") };

    expect((await patch(JSON.stringify({ key: KEY, value: "30" }))).status).toBe(403);
    expect(await stored(KEY)).toBeNull();
  });
});

describe("/api/webmaster/config/price-adjustment", () => {
  it("only reads: no PATCH", () => {
    expect(Object.keys(capRoute).sort()).toEqual(["GET", "dynamic"]);
  });

  it("GET answers the cap the server applies", async () => {
    await storeCap("35");

    const response = await capRoute.GET();

    expect(await response.json()).toEqual({ success: true, data: { maxIncreasePct: 35 } });
  });
});
