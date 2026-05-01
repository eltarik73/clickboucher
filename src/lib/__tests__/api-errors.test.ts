// @vitest-environment node
//
// Tests for the standardized API response helpers in src/lib/api/errors.ts.
// Every API route in the project funnels through these — a regression here
// would silently change the contract every client/Boucher/Webmaster call
// depends on (status codes + JSON shape).

import { describe, it, expect } from "vitest";
import {
  apiError,
  apiSuccess,
  apiPaginated,
  formatZodError,
} from "@/lib/api/errors";
import { z, ZodError } from "zod";

describe("apiSuccess", () => {
  it("should respond with HTTP 200 and { success: true, data } by default", async () => {
    const res = apiSuccess({ hello: "world" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { hello: "world" } });
  });

  it("should honor a custom status code (e.g. 201 for create)", async () => {
    const res = apiSuccess({ id: "x" }, 201);
    expect(res.status).toBe(201);
  });
});

describe("apiError", () => {
  it("should map UNAUTHORIZED -> 401", async () => {
    const res = apiError("UNAUTHORIZED", "Connexion requise");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Connexion requise");
  });

  it("should map NOT_FOUND -> 404", () => {
    expect(apiError("NOT_FOUND", "x").status).toBe(404);
  });

  it("should map VALIDATION_ERROR -> 400 and include details when provided", async () => {
    const res = apiError("VALIDATION_ERROR", "Bad input", { name: ["required"] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.details).toEqual({ name: ["required"] });
  });

  it("should map RATE_LIMITED -> 429", () => {
    expect(apiError("RATE_LIMITED", "x").status).toBe(429);
  });

  it("should map INTERNAL_ERROR -> 500", () => {
    expect(apiError("INTERNAL_ERROR", "x").status).toBe(500);
  });
});

describe("apiPaginated", () => {
  it("should return data + correct pagination meta (totalPages rounds up)", async () => {
    // 25 total items, perPage=10 → expect 3 pages (Math.ceil(25/10))
    const res = apiPaginated([{ id: 1 }, { id: 2 }], 25, 1, 10);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(body.pagination).toEqual({
      page: 1,
      perPage: 10,
      total: 25,
      totalPages: 3,
    });
  });
});

describe("formatZodError", () => {
  it("should group Zod issues by field path", () => {
    const schema = z.object({ name: z.string().min(3), age: z.number().int() });
    let captured: ZodError | null = null;
    const parsed = schema.safeParse({ name: "ab", age: 1.5 });
    if (!parsed.success) captured = parsed.error;
    expect(captured).not.toBeNull();
    const details = formatZodError(captured as ZodError);
    // Both issues should land under their respective field keys
    expect(Object.keys(details).sort()).toEqual(["age", "name"]);
    expect(details.name.length).toBeGreaterThan(0);
    expect(details.age.length).toBeGreaterThan(0);
  });

  it("should bucket root-level errors under '_root'", () => {
    // Root errors have an empty path — we want them addressable in the response
    const schema = z.string();
    const parsed = schema.safeParse(123);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const details = formatZodError(parsed.error);
      expect(details._root).toBeDefined();
    }
  });
});
