// tests/services/orders/list.test.ts — Unit tests for listOrders service
import { describe, it, expect, beforeEach, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  order: {
    findMany: vi.fn(),
  },
  shop: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const getOrCreateUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/get-or-create-user", () => ({ getOrCreateUser: getOrCreateUserMock }));

const autoApproveMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/price-adjustment", () => ({
  autoApproveExpiredAdjustment: autoApproveMock,
}));

const getAuthenticatedBoucherMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/boucher-auth", () => ({
  getAuthenticatedBoucher: getAuthenticatedBoucherMock,
}));

import { listOrders } from "@/lib/services/orders/list";
import type { NextRequest } from "next/server";

function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("https://klikandgo.app/api/orders");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { nextUrl: url } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findMany.mockResolvedValue([]);
  prismaMock.shop.findMany.mockResolvedValue([]);
  autoApproveMock.mockResolvedValue(undefined);
});

describe("listOrders — CLIENT", () => {
  it("filters by user.id only", async () => {
    getOrCreateUserMock.mockResolvedValue({ id: "user-db-1", role: "CLIENT" });
    await listOrders("user_clerk_1", makeReq());

    const call = prismaMock.order.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "user-db-1" });
    expect(call.take).toBe(50);
  });
});

describe("listOrders — BOUCHER", () => {
  it("filters by the boucher's shopId", async () => {
    getOrCreateUserMock.mockResolvedValue({ id: "boucher-db-1", role: "BOUCHER" });
    getAuthenticatedBoucherMock.mockResolvedValue({ userId: "boucher-db-1", shopId: "shop-A" });

    await listOrders("user_clerk_b", makeReq());

    const call = prismaMock.order.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ shopId: "shop-A" });
  });
});

describe("listOrders — ADMIN", () => {
  it("returns all orders without user/shop filter when no shopId param", async () => {
    getOrCreateUserMock.mockResolvedValue({ id: "admin-db-1", role: "ADMIN" });
    await listOrders("user_clerk_admin", makeReq());

    const call = prismaMock.order.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
  });

  it("scopes to shopId when ADMIN passes ?shopId=X", async () => {
    getOrCreateUserMock.mockResolvedValue({ id: "admin-db-1", role: "ADMIN" });
    // Must be a valid CUID (orderListQuerySchema enforces .cuid())
    const validCuid = "cm5xyz1234abcdefghijklmno";
    await listOrders("user_clerk_admin", makeReq({ shopId: validCuid }));

    const call = prismaMock.order.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ shopId: validCuid });
  });
});

describe("listOrders — auto-approve expired PriceAdjustments", () => {
  it("calls autoApproveExpiredAdjustment then refetches the mutated rows", async () => {
    getOrCreateUserMock.mockResolvedValue({ id: "user-db-1", role: "CLIENT" });

    const expiredOrder = {
      id: "order-expired",
      priceAdjustment: {
        status: "PENDING",
        autoApproveAt: new Date(Date.now() - 60_000), // 1 min in the past
      },
    };
    const refreshedOrder = { id: "order-expired", priceAdjustment: { status: "AUTO_APPROVED" } };

    prismaMock.order.findMany
      .mockResolvedValueOnce([expiredOrder])   // 1st findMany
      .mockResolvedValueOnce([refreshedOrder]); // 2nd findMany after auto-approve

    const result = await listOrders("user_clerk_1", makeReq());

    expect(autoApproveMock).toHaveBeenCalledWith("order-expired");
    expect(prismaMock.order.findMany).toHaveBeenCalledTimes(2);
    if (result.ok) {
      expect(result.orders).toHaveLength(1);
      expect((result.orders[0] as typeof refreshedOrder).priceAdjustment.status).toBe("AUTO_APPROVED");
    }
  });
});
