// tests/api/loyalty/loyalty.test.ts — Loyalty status (GET) + Boucher loyalty config (GET/PATCH)
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted Prisma mock ───────────────────────────────────────
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  loyaltyRule: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  order: { count: vi.fn() },
  loyaltyReward: { count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const serverAuthMock = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
}));
vi.mock("@/lib/auth/server-auth", () => serverAuthMock);

const boucherAuthMock = vi.hoisted(() => ({
  getAuthenticatedBoucher: vi.fn(),
}));
vi.mock("@/lib/boucher-auth", () => boucherAuthMock);

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────
function getReq(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}
function patchReq(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/loyalty (status) ──────────────────────────────────
describe("GET /api/loyalty — status", () => {
  it("returns { active: false } when no shopId is provided", async () => {
    const { GET } = await import("@/app/api/loyalty/route");
    const res = await GET(getReq("http://localhost/api/loyalty"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.active).toBe(false);
  });

  it("returns { active: false } for anonymous users", async () => {
    serverAuthMock.getServerUserId.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/loyalty/route");
    const res = await GET(getReq("http://localhost/api/loyalty?shopId=shop-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.active).toBe(false);
  });

  it("returns active progress for a logged user with an active rule", async () => {
    serverAuthMock.getServerUserId.mockResolvedValueOnce("user_clerk_1");
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-db-1" });
    prismaMock.loyaltyRule.findFirst.mockResolvedValueOnce({
      ordersRequired: 10,
      rewardPct: 10,
      active: true,
    });
    prismaMock.order.count.mockResolvedValueOnce(7);
    prismaMock.loyaltyReward.count.mockResolvedValueOnce(0);

    const { GET } = await import("@/app/api/loyalty/route");
    const res = await GET(getReq("http://localhost/api/loyalty?shopId=shop-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.active).toBe(true);
    expect(body.data.orderCount).toBe(7);
    expect(body.data.ordersRequired).toBe(10);
    expect(body.data.remaining).toBe(3);
  });
});

// ── GET /api/loyalty/config (boucher) ──────────────────────────
describe("GET /api/loyalty/config — boucher", () => {
  it("returns the shop's loyalty config", async () => {
    boucherAuthMock.getAuthenticatedBoucher.mockResolvedValueOnce({
      userId: "user-db-1",
      shopId: "shop-1",
    });
    prismaMock.loyaltyRule.findFirst.mockResolvedValueOnce({
      active: true,
      ordersRequired: 8,
      rewardPct: 15,
    });

    const { GET } = await import("@/app/api/loyalty/config/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.active).toBe(true);
    expect(body.data.ordersRequired).toBe(8);
    expect(body.data.rewardPct).toBe(15);
    // Only the boucher's own shop is queried — multi-tenant scope.
    expect(prismaMock.loyaltyRule.findFirst).toHaveBeenCalledWith({
      where: { shopId: "shop-1" },
    });
  });
});

// ── PATCH /api/loyalty/config (boucher) ────────────────────────
describe("PATCH /api/loyalty/config — boucher", () => {
  it("upserts the rule scoped to the authenticated shop", async () => {
    boucherAuthMock.getAuthenticatedBoucher.mockResolvedValueOnce({
      userId: "user-db-1",
      shopId: "shop-1",
    });
    prismaMock.loyaltyRule.upsert.mockResolvedValueOnce({
      active: true,
      ordersRequired: 12,
      rewardPct: 20,
    });

    const { PATCH } = await import("@/app/api/loyalty/config/route");
    const res = await PATCH(
      patchReq("http://localhost/api/loyalty/config", {
        active: true,
        ordersRequired: 12,
        rewardPct: 20,
      })
    );

    expect(res.status).toBe(200);
    // Upsert must be scoped to the boucher's own shopId — never trust a body shopId.
    const upsertCall = prismaMock.loyaltyRule.upsert.mock.calls[0][0];
    expect(upsertCall.where).toEqual({ shopId: "shop-1" });
  });

  it("returns the auth error when the user is not a boucher (FORBIDDEN)", async () => {
    const forbidden = new Response(JSON.stringify({ error: "FORBIDDEN" }), {
      status: 403,
    });
    boucherAuthMock.getAuthenticatedBoucher.mockResolvedValueOnce({
      error: forbidden,
    });

    const { PATCH } = await import("@/app/api/loyalty/config/route");
    const res = await PATCH(
      patchReq("http://localhost/api/loyalty/config", { active: true })
    );

    expect(res.status).toBe(403);
    expect(prismaMock.loyaltyRule.upsert).not.toHaveBeenCalled();
  });
});
