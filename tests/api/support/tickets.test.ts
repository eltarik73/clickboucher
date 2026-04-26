// tests/api/support/tickets.test.ts — Rate-limit & ownership tests for support tickets
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted Prisma mock ───────────────────────────────────────
const prismaMock = vi.hoisted(() => ({
  shop: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  supportTicket: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  supportMessage: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

// Rate limit mock — bucket replays whatever the test wires up
const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  rateLimits: { tickets: {}, api: {} },
}));
vi.mock("@/lib/rate-limit", () => rateLimitMock);

// Auth helpers
const authMock = vi.hoisted(() => ({
  getAuthenticatedBoucher: vi.fn(),
}));
vi.mock("@/lib/boucher-auth", () => authMock);

const serverAuthMock = vi.hoisted(() => ({
  getServerUserId: vi.fn(),
}));
vi.mock("@/lib/auth/server-auth", () => serverAuthMock);

// AI service is best-effort — stub it out
vi.mock("@/lib/services/support-ai", () => ({
  generateAIResponse: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────
function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.checkRateLimit.mockResolvedValue({ success: true });
});

// ── C3: rate limit ─────────────────────────────────────────────
describe("POST /api/support/tickets — rate limit (C3)", () => {
  it("returns RATE_LIMITED when bucket is exhausted", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValueOnce({ success: false });
    authMock.getAuthenticatedBoucher.mockResolvedValueOnce({
      userId: "user-db-1",
      shopId: "shop-1",
    });

    const { POST } = await import("@/app/api/support/tickets/route");
    const res = await POST(
      jsonRequest("http://localhost/api/support/tickets", {
        shopId: "shop-1",
        subject: "Sujet",
        message: "Message test",
      })
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    // Ticket creation must NOT have happened
    expect(prismaMock.supportTicket.create).not.toHaveBeenCalled();
  });
});

// ── C1: ownership OR clause ────────────────────────────────────
describe("GET /api/support/tickets/[ticketId] — multi-tenant ownership (C1)", () => {
  it("includes shops owned via clerkId AND via dbUserId in the OR clause", async () => {
    serverAuthMock.getServerUserId.mockResolvedValueOnce("user_clerk_1");
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-db-1" });
    prismaMock.shop.findMany.mockResolvedValueOnce([
      { id: "shop-A", ownerId: "user_clerk_1" },
      { id: "shop-B", ownerId: "user-db-1" },
    ]);
    prismaMock.supportTicket.findFirst.mockResolvedValueOnce({
      id: "ticket-1",
      shop: { id: "shop-B", name: "B" },
      messages: [],
    });

    const { GET } = await import("@/app/api/support/tickets/[ticketId]/route");
    const res = await GET({} as unknown as import("next/server").NextRequest, {
      params: { ticketId: "ticket-1" },
    });

    expect(res.status).toBe(200);
    // Verify the OR clause was constructed correctly
    const findManyCall = prismaMock.shop.findMany.mock.calls[0][0];
    expect(findManyCall.where.OR).toEqual([
      { ownerId: "user_clerk_1" },
      { ownerId: "user-db-1" },
    ]);
    // Verify the ticket query was scoped to BOTH shop ids
    const findFirstCall = prismaMock.supportTicket.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.shopId.in).toEqual(["shop-A", "shop-B"]);
  });
});

// ── M2: reopen RESOLVED ticket atomically ──────────────────────
describe("POST /api/support/tickets/[ticketId] — reopen RESOLVED (M2)", () => {
  it("wraps message create + status reopen in a single transaction", async () => {
    serverAuthMock.getServerUserId.mockResolvedValueOnce("user_clerk_1");
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-db-1" });
    prismaMock.shop.findMany.mockResolvedValueOnce([
      { id: "shop-A", ownerId: "user-db-1" },
    ]);
    prismaMock.supportTicket.findFirst.mockResolvedValueOnce({
      id: "ticket-1",
      status: "RESOLVED",
      shopId: "shop-A",
    });
    prismaMock.shop.findUnique.mockResolvedValueOnce({ name: "Boucherie" });
    prismaMock.$transaction.mockResolvedValueOnce([
      { id: "msg-1", ticketId: "ticket-1", role: "user", content: "hi" },
      { id: "ticket-1", status: "OPEN" },
    ]);

    const { POST } = await import("@/app/api/support/tickets/[ticketId]/route");
    const res = await POST(
      jsonRequest("http://localhost/api/support/tickets/ticket-1", { content: "hi" }),
      { params: { ticketId: "ticket-1" } }
    );

    expect(res.status).toBe(201);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // Transaction array must contain BOTH the create and the update
    const txOps = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(txOps).toHaveLength(2);
  });
});
