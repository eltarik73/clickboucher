// @vitest-environment node
// Modèle de test d'un handler migré. Destination réelle : tests/api/products/stock.test.ts,
// avec `await import("@/app/api/products/[id]/stock/route")` à la place de l'import relatif.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks hoistés : on remplace les frontières (auth, base, rate limit), jamais le wrapper ──
const prismaMock = vi.hoisted(() => ({
  product: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }));

const boucherAuthMock = vi.hoisted(() => ({ getAuthenticatedBoucher: vi.fn() }));
vi.mock("@/lib/boucher-auth", () => boucherAuthMock);

// route-auth.ts importe aussi ces helpers : on les neutralise pour ne charger ni Clerk ni next/headers.
vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/get-or-create-user", () => ({ getOrCreateUser: vi.fn() }));

const rateLimitMock = vi.hoisted(() => ({ checkRateLimit: vi.fn(), rateLimits: { api: {} } }));
vi.mock("@/lib/rate-limit", () => rateLimitMock);

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { apiError } from "@/lib/api/errors";
import { PATCH } from "./product-stock.route";

function patch(body: unknown) {
  return new NextRequest("http://localhost/api/products/p1/stock", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const segment = { params: { id: "p1" } };

beforeEach(() => {
  vi.clearAllMocks();
  boucherAuthMock.getAuthenticatedBoucher.mockResolvedValue({
    userId: "user-db-1",
    shopId: "shop-1",
  });
  rateLimitMock.checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.product.findUnique.mockResolvedValue({ shopId: "shop-1" });
  prismaMock.product.update.mockResolvedValue({
    id: "p1",
    name: "Merguez",
    inStock: false,
    stockQty: 0,
  });
});

describe("PATCH /api/products/[id]/stock", () => {
  it("401 sans session : aucune lecture en base", async () => {
    boucherAuthMock.getAuthenticatedBoucher.mockResolvedValueOnce({
      error: apiError("UNAUTHORIZED", "Authentification requise"),
    });
    const res = await PATCH(patch({ inStock: false }), segment);
    expect(res.status).toBe(401);
    expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
  });

  it("403 quand le produit appartient à une autre boutique : aucune écriture", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ shopId: "shop-AUTRE" });
    const res = await PATCH(patch({ inStock: false }), segment);
    expect(res.status).toBe(403);
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it("400 avec détails quand le corps ne respecte pas le schéma", async () => {
    const res = await PATCH(patch({ stockQty: -3 }), segment);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details.stockQty).toBeDefined();
    expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
  });

  it("400 (et non 500) sur un JSON mal formé", async () => {
    const res = await PATCH(patch("{oups"), segment);
    expect(res.status).toBe(400);
  });

  it("429 + Retry-After quand la limite est atteinte", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValueOnce({ success: false });
    const res = await PATCH(patch({ inStock: false }), segment);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });

  it("200 : enveloppe { success, data }, stock déduit de la quantité, réponse non cachable", async () => {
    const res = await PATCH(patch({ stockQty: 0 }), segment);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { id: "p1", name: "Merguez", inStock: false, stockQty: 0 },
    });
    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p1" }, data: { stockQty: 0, inStock: false } })
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      rateLimitMock.rateLimits.api,
      "products/stock:shop-1"
    );
  });
});
