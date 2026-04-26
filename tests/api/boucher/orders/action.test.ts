// tests/api/boucher/orders/action.test.ts — Unified PATCH /api/boucher/orders/[orderId]/action
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted Prisma mock ───────────────────────────────────────
// $transaction supports BOTH the callback signature (used by ACCEPT) and the
// array signature (used by ADD_NOTE / batched stock restores).
const prismaMock = vi.hoisted(() => {
  const m = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    product: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cbOrArr: unknown) => {
      if (typeof cbOrArr === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (cbOrArr as any)(m);
      }
      return cbOrArr;
    }),
  };
  return m;
});
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const boucherAuthMock = vi.hoisted(() => ({
  getAuthenticatedBoucher: vi.fn(),
}));
vi.mock("@/lib/boucher-auth", () => boucherAuthMock);

const notificationsMock = vi.hoisted(() => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => notificationsMock);

vi.mock("@/lib/dynamic-prep-time", () => ({
  calculatePrepTime: vi.fn().mockResolvedValue(20),
}));

vi.mock("@/lib/emails/order-receipt", () => ({
  sendOrderReceiptEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────
function patchReq(url: string, body: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const SHOP = {
  id: "shop-1",
  ownerId: "user-db-1",
  name: "Boucherie Test",
  prepTimeMin: 20,
  busyMode: false,
  busyExtraMin: 0,
  address: "1 rue X",
  city: "Lyon",
  siret: null,
  fullAddress: null,
  vatRate: 5.5,
};

const USER = {
  id: "client-1",
  firstName: "Tarik",
  lastName: "B",
  email: "client@klikgo.app",
  clerkId: "user_clerk_client",
  customerNumber: null,
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "KG-2026-00001",
    displayNumber: "001",
    shopId: "shop-1",
    status: "PENDING",
    totalCents: 2000,
    paymentMethod: "ON_SITE",
    estimatedReady: null,
    pickupSlotStart: null,
    qrCode: null,
    createdAt: new Date(),
    items: [
      {
        id: "oi-1",
        orderId: "order-1",
        productId: "prod-1",
        name: "Steak haché",
        unit: "PIECE",
        quantity: 2,
        priceCents: 1000,
        totalCents: 2000,
        weightGrams: null,
        available: true,
        product: {
          id: "prod-1",
          unit: "PIECE",
          isAntiGaspi: false,
          antiGaspiStock: null,
          antiGaspiOrigPriceCents: null,
          priceCents: 1000,
          isFlashSale: false,
          flashSaleStock: null,
          vatRate: 5.5,
          categories: [],
        },
      },
    ],
    shop: SHOP,
    user: USER,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  boucherAuthMock.getAuthenticatedBoucher.mockResolvedValue({
    userId: "user-db-1",
    shopId: "shop-1",
  });
  prismaMock.order.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: where.id,
    ...data,
    items: [],
  }));
  prismaMock.orderEvent.create.mockResolvedValue({});
});

// ── NOT_FOUND ─────────────────────────────────────────────────
describe("PATCH action — NOT_FOUND", () => {
  it("returns 404 when the order does not exist", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(null);

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/missing/action", {
        action: "accept",
        estimatedMinutes: 20,
      }),
      { params: { orderId: "missing" } }
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

// ── FORBIDDEN ─────────────────────────────────────────────────
describe("PATCH action — FORBIDDEN", () => {
  it("returns 403 when the order belongs to another boucher's shop", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(
      makeOrder({ shopId: "shop-OTHER" })
    );

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "accept",
        estimatedMinutes: 20,
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });
});

// ── ACCEPT happy path ─────────────────────────────────────────
describe("PATCH action — ACCEPT happy path", () => {
  it("transitions PENDING → ACCEPTED, runs the transaction, and notifies the client", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder());

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "accept",
        estimatedMinutes: 25,
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // The status update must target ACCEPTED.
    const updateCall = prismaMock.order.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("ACCEPTED");
    // The client must be notified of the acceptance.
    expect(notificationsMock.sendNotification).toHaveBeenCalledWith(
      "ORDER_ACCEPTED",
      expect.objectContaining({ userId: "client-1", orderId: "order-1" })
    );
  });
});

// ── ACCEPT — STOCK_INSUFFICIENT (rollback) ────────────────────
describe("PATCH action — STOCK_INSUFFICIENT", () => {
  it("returns STOCK_INSUFFICIENT when an anti-gaspi stock decrement underflows", async () => {
    const order = makeOrder({
      items: [
        {
          id: "oi-1",
          orderId: "order-1",
          productId: "prod-1",
          name: "Anti-gaspi product",
          unit: "PIECE",
          quantity: 5,
          priceCents: 1000,
          totalCents: 5000,
          weightGrams: null,
          available: true,
          product: {
            id: "prod-1",
            unit: "PIECE",
            isAntiGaspi: true,
            antiGaspiStock: 2, // less than ordered → underflow
            antiGaspiOrigPriceCents: 1500,
            priceCents: 1000,
            isFlashSale: false,
            flashSaleStock: null,
            vatRate: 5.5,
            categories: [],
          },
        },
      ],
    });
    prismaMock.order.findUnique.mockResolvedValueOnce(order);

    // Simulate decrement returning a negative stock to trigger the rollback throw.
    prismaMock.product.update.mockResolvedValueOnce({
      antiGaspiStock: -3,
      antiGaspiOrigPriceCents: 1500,
      priceCents: 1000,
    });

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "accept",
        estimatedMinutes: 20,
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("STOCK_INSUFFICIENT");
    // Notification must NOT be sent when accept rolls back.
    expect(notificationsMock.sendNotification).not.toHaveBeenCalled();
  });
});

// ── MARK READY ───────────────────────────────────────────────
describe("PATCH action — MARK_READY", () => {
  it("transitions ACCEPTED → READY and notifies the client", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder({ status: "ACCEPTED" }));

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "mark_ready",
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(200);
    const updateCall = prismaMock.order.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("READY");
    expect(notificationsMock.sendNotification).toHaveBeenCalledWith(
      "ORDER_READY",
      expect.objectContaining({ orderId: "order-1" })
    );
  });
});

// ── MANUAL PICKUP ────────────────────────────────────────────
describe("PATCH action — MANUAL_PICKUP (READY → PICKED_UP)", () => {
  it("transitions READY → PICKED_UP and triggers the pickup notification", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder({ status: "READY" }));

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "manual_pickup",
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(200);
    const updateCall = prismaMock.order.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("PICKED_UP");
    expect(notificationsMock.sendNotification).toHaveBeenCalledWith(
      "ORDER_PICKED_UP",
      expect.objectContaining({ orderId: "order-1" })
    );
  });
});

// ── DENY ──────────────────────────────────────────────────────
describe("PATCH action — DENY", () => {
  it("transitions PENDING → DENIED and persists the reason", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder());

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "deny",
        reason: "Magasin fermé",
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(200);
    const updateCall = prismaMock.order.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("DENIED");
    expect(updateCall.data.denyReason).toBe("Magasin fermé");
    expect(notificationsMock.sendNotification).toHaveBeenCalledWith(
      "ORDER_DENIED",
      expect.objectContaining({ denyReason: "Magasin fermé" })
    );
  });
});

// ── IDEMPOTENCY (already accepted) ───────────────────────────
describe("PATCH action — idempotency", () => {
  it("returns the current order without re-running the transaction when accept is replayed", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder({ status: "ACCEPTED" }));

    const { PATCH } = await import("@/app/api/boucher/orders/[orderId]/action/route");
    const res = await PATCH(
      patchReq("http://localhost/api/boucher/orders/order-1/action", {
        action: "accept",
        estimatedMinutes: 20,
      }),
      { params: { orderId: "order-1" } }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data._idempotent).toBe(true);
    // No transaction, no notification — the action is a no-op.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(notificationsMock.sendNotification).not.toHaveBeenCalled();
  });
});
