// @vitest-environment node
// The owner's read-only commission abuse check (commission-audit.readonly.sql), run as it is on
// real PostgreSQL against audit rows written by the two admin commission routes themselves: a rate
// that matches the last admin decision is silent, any other rate is listed. Only the identity is
// simulated (Clerk's session; requireAdmin then reads the role in the database).
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shop } from "@prisma/client";

const clerk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getTestRole: () => null,
  isTestActivated: () => false,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: clerk.userId }),
  currentUser: async () => null,
}));

import { PATCH as patchGlobalCommission } from "@/app/api/admin/commission/global/route";
import { PATCH as patchShopCommission } from "@/app/api/admin/shops/[shopId]/commission/route";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestShop, createTestUser } from "../helpers/factories";

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React
useCleanDatabase();

const AUDIT_SQL = readFileSync(
  path.resolve(
    __dirname,
    "../../../prisma/migrations/20261115120000_c1_failles_critiques/commission-audit.readonly.sql"
  ),
  "utf8"
);
const NO_DECISION = "aucune décision admin tracée (attendu 0)";
const DIFFERS = "diffère de la dernière décision admin";

type Finding = {
  id: string;
  commission_pct: number;
  derniere_decision_admin_pct: number | null;
  constat: string;
};
const findings = async () =>
  (await prisma.$queryRawUnsafe<Finding[]>(AUDIT_SQL)).map(
    ({ id, commission_pct, derniere_decision_admin_pct, constat }) => ({
      id,
      commission_pct,
      derniere_decision_admin_pct,
      constat,
    })
  );

function patch(route: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${route}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setShopRate(shop: Shop, commissionPct: number) {
  const response = await patchShopCommission(
    patch(`/api/admin/shops/${shop.id}/commission`, { commissionPct, commissionEnabled: true }),
    { params: { shopId: shop.id } }
  );
  expect(response.status).toBe(200);
}

async function setGlobalRate(commissionPct: number) {
  const response = await patchGlobalCommission(
    patch("/api/admin/commission/global", { commissionPct })
  );
  expect(response.status).toBe(200);
}

/** What PATCH /api/shops/[id] let a shop owner do before C1-FAILLES-CRITIQUES. */
const ownerWrite = (shop: Shop, commissionPct: number) =>
  prisma.shop.update({ where: { id: shop.id }, data: { commissionPct } });

beforeEach(async () => {
  clerk.userId = (await createTestUser({ role: "ADMIN" })).clerkId;
});

describe("commission-audit.readonly.sql", () => {
  it("n'est qu'une requête de lecture", () => {
    const statement = AUDIT_SQL.replace(/--.*$/gm, "").trim();

    expect(statement.startsWith("WITH admin_decision AS (")).toBe(true);
    expect(statement.indexOf(";")).toBe(statement.length - 1);
    expect(statement).not.toMatch(
      /\b(insert|update|delete|merge|alter|drop|truncate|create|grant|copy|call)\b/i
    );
  });

  it("taux égal à la dernière décision de la boutique : rien ; réécrit hors de la route : listé", async () => {
    const shop = await createTestShop();
    await setShopRate(shop, 7);
    await setShopRate(shop, 12);
    expect(await findings()).toEqual([]);

    await ownerWrite(shop, 3);

    expect(await findings()).toEqual([
      { id: shop.id, commission_pct: 3, derniere_decision_admin_pct: 12, constat: DIFFERS },
    ]);
  });

  it("sans décision tracée : 0 % n'est pas listé, un autre taux l'est", async () => {
    await createTestShop();
    const abused = await createTestShop();
    await ownerWrite(abused, 5);

    expect(await findings()).toEqual([
      { id: abused.id, commission_pct: 5, derniere_decision_admin_pct: null, constat: NO_DECISION },
    ]);
  });

  it("décision globale : couvre les boutiques existantes, pas celles créées après ; la plus récente l'emporte", async () => {
    const tuned = await createTestShop();
    await setShopRate(tuned, 12);
    const plain = await createTestShop();
    await setGlobalRate(4);
    expect(await findings()).toEqual([]);

    await setShopRate(tuned, 8);
    const created = await createTestShop({ commissionPct: 6 });
    await ownerWrite(plain, 0);

    expect(await findings()).toEqual([
      { id: plain.id, commission_pct: 0, derniere_decision_admin_pct: 4, constat: DIFFERS },
      {
        id: created.id,
        commission_pct: 6,
        derniere_decision_admin_pct: null,
        constat: NO_DECISION,
      },
    ]);
  });
});
