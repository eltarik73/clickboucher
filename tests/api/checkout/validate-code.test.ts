// tests/api/checkout/validate-code.test.ts — Promo / loyalty code validation at checkout
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const serverAuthMock = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
}));
vi.mock("@/lib/auth/server-auth", () => serverAuthMock);

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  rateLimits: { promoValidate: {} },
}));
vi.mock("@/lib/rate-limit", () => rateLimitMock);

const validateCodeMock = vi.hoisted(() => ({
  validatePromoCode: vi.fn(),
}));
vi.mock("@/lib/marketing/validate-code", () => validateCodeMock);

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
  code: "WELCOME10",
  cartTotal: 50,
  cartProductIds: ["p-1", "p-2"],
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.checkRateLimit.mockResolvedValue({ success: true });
  serverAuthMock.getServerUserId.mockResolvedValue("user_clerk_1");
  prismaMock.user.findUnique.mockResolvedValue({ id: "user-db-1" });
});

// ── UNAUTHORIZED ──────────────────────────────────────────────
describe("POST /api/checkout/validate-code — UNAUTHORIZED", () => {
  it("returns 401 when there is no session", async () => {
    serverAuthMock.getServerUserId.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/checkout/validate-code/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/validate-code", VALID_BODY)
    );
    expect(res.status).toBe(401);
    expect(validateCodeMock.validatePromoCode).not.toHaveBeenCalled();
  });
});

// ── RATE_LIMITED ──────────────────────────────────────────────
describe("POST /api/checkout/validate-code — RATE_LIMITED", () => {
  it("returns 429 when the bucket is exhausted", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValueOnce({ success: false });
    const { POST } = await import("@/app/api/checkout/validate-code/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/validate-code", VALID_BODY)
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(validateCodeMock.validatePromoCode).not.toHaveBeenCalled();
  });
});

// ── Happy path: promo code ────────────────────────────────────
describe("POST /api/checkout/validate-code — happy path", () => {
  it("returns the offer + computed discount when the code is valid", async () => {
    validateCodeMock.validatePromoCode.mockResolvedValueOnce({
      valid: true,
      offer: {
        id: "offer-1",
        name: "Bienvenue",
        code: "WELCOME10",
        type: "PERCENT",
        discountValue: 10,
        payer: "KLIKGO",
      },
      discount: 5,
    });

    const { POST } = await import("@/app/api/checkout/validate-code/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/validate-code", VALID_BODY)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.valid).toBe(true);
    expect(body.data.discount).toBe(5);
    // The route resolves Clerk → Prisma user id before calling validate.
    const call = validateCodeMock.validatePromoCode.mock.calls[0][0];
    expect(call.userId).toBe("user-db-1");
  });
});

// ── Code does not exist ───────────────────────────────────────
describe("POST /api/checkout/validate-code — invalid code", () => {
  it("returns VALIDATION_ERROR when the code does not exist", async () => {
    validateCodeMock.validatePromoCode.mockResolvedValueOnce({
      valid: false,
      error: "Code promo invalide",
    });

    const { POST } = await import("@/app/api/checkout/validate-code/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/validate-code", VALID_BODY)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Code expired ──────────────────────────────────────────────
describe("POST /api/checkout/validate-code — expired", () => {
  it("returns VALIDATION_ERROR when the code is expired", async () => {
    validateCodeMock.validatePromoCode.mockResolvedValueOnce({
      valid: false,
      error: "Ce code a expiré",
    });

    const { POST } = await import("@/app/api/checkout/validate-code/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/validate-code", VALID_BODY)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/expir/i);
  });
});

// ── Invalid payload ───────────────────────────────────────────
describe("POST /api/checkout/validate-code — VALIDATION_ERROR", () => {
  it("returns VALIDATION_ERROR when the body is malformed", async () => {
    const { POST } = await import("@/app/api/checkout/validate-code/route");
    const res = await POST(
      postJson("http://localhost/api/checkout/validate-code", {
        code: "",
        cartTotal: -1,
        cartProductIds: "not-an-array",
      })
    );
    expect(res.status).toBe(400);
    expect(validateCodeMock.validatePromoCode).not.toHaveBeenCalled();
  });
});
