// @vitest-environment node
// The three order routes that read a JSON body (butcher action, QR pickup, customer rating) answer a
// body that is not JSON, or that their schema refuses, with 400 VALIDATION_ERROR, as the quote route
// does: a caller's mistake is neither logged as an error nor reported. Both refusals come before any
// read of the database.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server-auth", () => ({ getServerUserId: async () => "user_itest_body" }));
vi.mock("@/lib/boucher-auth", () => ({
  getAuthenticatedBoucher: async () => ({ userId: "user-itest-body", shopId: "shop-itest-body" }),
}));

import { PATCH as actionRoute } from "@/app/api/boucher/orders/[orderId]/action/route";
import { POST as pickupRoute } from "@/app/api/boucher/orders/pickup/route";
import { POST as rateRoute } from "@/app/api/orders/[id]/rate/route";
import { useCleanDatabase } from "../helpers/db";

// Not a React hook: the rule only looks at the « use » prefix of the name.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const ORDER_ID = "order-itest-body";

function rawRequest(url: string, method: string, body: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body,
  });
}

const ROUTES = [
  {
    name: "PATCH /api/boucher/orders/[orderId]/action",
    field: "action",
    send: (body: string) =>
      actionRoute(rawRequest(`/api/boucher/orders/${ORDER_ID}/action`, "PATCH", body), {
        params: { orderId: ORDER_ID },
      }),
  },
  {
    name: "POST /api/boucher/orders/pickup",
    field: "qrCode",
    send: (body: string) => pickupRoute(rawRequest("/api/boucher/orders/pickup", "POST", body)),
  },
  {
    name: "POST /api/orders/[id]/rate",
    field: "rating",
    send: (body: string) =>
      rateRoute(rawRequest(`/api/orders/${ORDER_ID}/rate`, "POST", body), {
        params: { id: ORDER_ID },
      }),
  },
];

interface ErrorBody {
  success: boolean;
  error: { code: string; details?: Record<string, string[]> };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe.each(ROUTES)("$name", ({ field, send }) => {
  it("answers 400 VALIDATION_ERROR to a body that is not JSON, and logs no error", async () => {
    const response = await send("{ not json");

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("answers 400 VALIDATION_ERROR naming the field to a body its schema refuses, and logs no error", async () => {
    const response = await send("{}");

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.details ?? {})).toContain(field);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
