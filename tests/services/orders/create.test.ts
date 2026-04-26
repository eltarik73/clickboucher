// tests/services/orders/create.test.ts — Unit tests for createOrder service
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted Prisma mock factory ───────────────────────────────
const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  shop: {
    findUnique: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  offer: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  loyaltyReward: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("@/lib/notifications", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/emails/order-confirmation", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/get-or-create-user", () => ({
  getOrCreateUser: vi.fn().mockResolvedValue({
    id: "user-db-1",
    clerkId: "user_clerk_1",
    email: "test@klikgo.app",
    firstName: "Tarik",
    lastName: "B",
    role: "CLIENT",
  }),
}));

vi.mock("@/lib/shop-status", () => ({
  getShopStatus: vi.fn().mockResolvedValue("OPEN"),
  setBusyMode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/dynamic-prep-time", () => ({
  calculatePrepTime: vi.fn().mockResolvedValue(20),
}));

vi.mock("@/lib/services/numbering.service", () => ({
  getNextDailyNumber: vi.fn().mockResolvedValue({ dailyNumber: 1, displayNumber: "001" }),
  ensureCustomerNumber: vi.fn().mockResolvedValue("C001"),
}));

vi.mock("@/lib/emails/order-receipt", () => ({
  sendOrderReceiptEmail: vi.fn().mockResolvedValue(undefined),
}));

// Import AFTER mocks
import { createOrder } from "@/lib/services/orders/create";
import { getShopStatus } from "@/lib/shop-status";

const SHOP = {
  id: "cm123shopid",
  name: "Boucherie Test",
  address: "1 rue X",
  city: "Lyon",
  phone: "+33612345678",
  status: "OPEN",
  autoAccept: true,
  acceptTimeoutMin: 5,
  busyMode: false,
  busyExtraMin: 0,
  prepTimeMin: 20,
  maxOrdersPerSlot: 5,
  maxOrdersPerHour: 20,
  autoBusyThreshold: 10,
  minOrderCents: 0,
  commissionPct: 5,
  commissionEnabled: false,
  vatRate: 5.5,
};

const PRODUCT = {
  id: "prod-1",
  name: "Steak haché",
  shopId: "cm123shopid",
  unit: "PIECE",
  priceCents: 1000,
  proPriceCents: null,
  inStock: true,
  snoozeType: "NONE",
  isAntiGaspi: false,
  antiGaspiStock: null,
  isFlashSale: false,
  flashSaleStock: null,
  promoPct: null,
  promoType: null,
  promoEnd: null,
  promoFixedCents: null,
};

const VALID_BODY = {
  shopId: "cm123shopid",
  items: [{ productId: "prod-1", quantity: 2 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findUnique.mockResolvedValue(null); // no idempotency hit
  prismaMock.order.findFirst.mockResolvedValue(null); // no previous orderNumber
  prismaMock.order.count.mockResolvedValue(0);
  prismaMock.shop.findUnique.mockResolvedValue(SHOP);
  prismaMock.product.findMany.mockResolvedValue([PRODUCT]);
  prismaMock.order.create.mockResolvedValue({
    id: "order-1",
    orderNumber: "KG-2026-00001",
    shopId: SHOP.id,
    items: [],
    shop: { id: SHOP.id, name: SHOP.name, slug: "boucherie-test" },
  });
  // Reset shop-status default
  vi.mocked(getShopStatus).mockResolvedValue("OPEN");
});

describe("createOrder — happy path", () => {
  it("returns ok+201 when payload is valid", async () => {
    const result = await createOrder(VALID_BODY, "user_clerk_1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe(201);
    expect(prismaMock.order.create).toHaveBeenCalledOnce();
  });
});

describe("createOrder — VALIDATION_ERROR", () => {
  it("rejects empty items array", async () => {
    const result = await createOrder({ shopId: "cm123shopid", items: [] }, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing shopId", async () => {
    const result = await createOrder({ items: [{ productId: "p", quantity: 1 }] }, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
  });
});

describe("createOrder — NOT_FOUND", () => {
  it("returns NOT_FOUND when shop is missing", async () => {
    prismaMock.shop.findUnique.mockResolvedValue(null);
    const result = await createOrder(VALID_BODY, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });
});

describe("createOrder — SERVICE_DISABLED", () => {
  it("returns SERVICE_DISABLED when shop is PAUSED", async () => {
    vi.mocked(getShopStatus).mockResolvedValue("PAUSED");
    const result = await createOrder(VALID_BODY, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SERVICE_DISABLED");
  });

  it("returns SERVICE_DISABLED when shop is on VACATION", async () => {
    vi.mocked(getShopStatus).mockResolvedValue("VACATION");
    const result = await createOrder(VALID_BODY, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SERVICE_DISABLED");
  });
});

describe("createOrder — CAPACITY_EXCEEDED", () => {
  it("returns CAPACITY_EXCEEDED when ordersLastHour >= maxOrdersPerHour", async () => {
    prismaMock.order.count.mockResolvedValue(20); // = maxOrdersPerHour
    const result = await createOrder(VALID_BODY, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CAPACITY_EXCEEDED");
  });
});

describe("createOrder — PRODUCTS_MISSING", () => {
  it("returns PRODUCTS_MISSING when productId not in DB", async () => {
    prismaMock.product.findMany.mockResolvedValue([]); // requested product missing
    const result = await createOrder(VALID_BODY, "user_clerk_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PRODUCTS_MISSING");
  });
});

describe("createOrder — idempotency", () => {
  it("returns existing order with status 200 when idempotencyKey matches", async () => {
    const existing = {
      id: "order-existing",
      orderNumber: "KG-2026-00042",
      shopId: SHOP.id,
      items: [],
      shop: { id: SHOP.id, name: SHOP.name, slug: "boucherie-test" },
    };
    prismaMock.order.findUnique.mockResolvedValue(existing);
    const result = await createOrder(
      { ...VALID_BODY, idempotencyKey: "abc-123" },
      "user_clerk_1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.order).toBe(existing);
    }
    expect(prismaMock.order.create).not.toHaveBeenCalled();
  });
});
