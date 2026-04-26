// tests/api/checkout/guest.test.ts — Guest checkout (Baymard +23% conversion)
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  rateLimits: { orders: {} },
}));
vi.mock("@/lib/rate-limit", () => rateLimitMock);

const createOrderMock = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock("@/lib/services/orders/create", () => createOrderMock);

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────
function postJson(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const VALID_BODY = {
  email: "alice@example.com",
  firstName: "Alice",
  lastName: "Martin",
  phone: "+33611223344",
  shopId: "shop-1",
  items: [{ productId: "p-1", quantity: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.create.mockResolvedValue({
    id: "user-db-1",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Martin",
    phone: "+33611223344",
    role: "CLIENT",
    clerkId: null,
    guestToken: "tok-abc",
    isGuest: true,
  });
  createOrderMock.createOrder.mockResolvedValue({
    ok: true,
    status: 201,
    order: { id: "order-1", orderNumber: "KG-2026-00001" },
  });
});

// ── Happy path ────────────────────────────────────────────────
describe("POST /api/checkout/guest — happy path", () => {
  it("creates a shadow user + order and sets the guest cookie", async () => {
    const { POST } = await import("@/app/api/checkout/guest/route");
    const res = await POST(postJson("http://localhost/api/checkout/guest", VALID_BODY));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.order.id).toBe("order-1");
    expect(body.data.guestToken).toBe("tok-abc");

    // Shadow user created with clerkId=null + guestToken
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe("alice@example.com");
    expect(createArgs.data.isGuest).toBe(true);
    expect(createArgs.data.guestToken).toBeDefined();
    expect(createArgs.data.role).toBe("CLIENT");

    // createOrder called with the resolved Prisma user
    const orderArgs = createOrderMock.createOrder.mock.calls[0];
    expect(orderArgs[1].id).toBe("user-db-1");
    expect(orderArgs[1].clerkId).toBeNull();

    // Cookie set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/klikgo-guest-token=tok-abc/);
    expect(setCookie?.toLowerCase()).toMatch(/httponly/);
  });
});

// ── Existing Clerk account → 409 ──────────────────────────────
describe("POST /api/checkout/guest — existing Clerk account", () => {
  it("rejects with CONFLICT when an account with this email already has a clerkId", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-db-existing",
      email: "alice@example.com",
      clerkId: "user_clerk_existing",
      guestToken: null,
    });

    const { POST } = await import("@/app/api/checkout/guest/route");
    const res = await POST(postJson("http://localhost/api/checkout/guest", VALID_BODY));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(createOrderMock.createOrder).not.toHaveBeenCalled();
  });
});

// ── Existing guest → reuse ────────────────────────────────────
describe("POST /api/checkout/guest — existing guest", () => {
  it("reuses an existing user when clerkId is null (no Clerk account yet)", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "user-db-2",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Martin",
      phone: "+33611223344",
      role: "CLIENT",
      clerkId: null,
      guestToken: "tok-existing",
      isGuest: true,
    });

    const { POST } = await import("@/app/api/checkout/guest/route");
    const res = await POST(postJson("http://localhost/api/checkout/guest", VALID_BODY));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.guestToken).toBe("tok-existing");
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(createOrderMock.createOrder).toHaveBeenCalledTimes(1);
  });
});

// ── Invalid email → VALIDATION_ERROR ──────────────────────────
describe("POST /api/checkout/guest — invalid email", () => {
  it("returns VALIDATION_ERROR when email is malformed", async () => {
    const { POST } = await import("@/app/api/checkout/guest/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/guest", { ...VALID_BODY, email: "not-an-email" })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(createOrderMock.createOrder).not.toHaveBeenCalled();
  });
});

// ── Order creation fails → bubble up ──────────────────────────
describe("POST /api/checkout/guest — order failure", () => {
  it("propagates createOrder validation error code", async () => {
    createOrderMock.createOrder.mockResolvedValueOnce({
      ok: false,
      code: "STOCK_INSUFFICIENT",
      message: "Boeuf — produit(s) indisponible(s)",
    });

    const { POST } = await import("@/app/api/checkout/guest/route");
    const res = await POST(postJson("http://localhost/api/checkout/guest", VALID_BODY));

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error.code).toBe("STOCK_INSUFFICIENT");
  });
});
