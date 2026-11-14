// @vitest-environment node
// Destination : src/lib/__tests__/api-route-core.test.ts (copie à l'identique).
// Verrouille le contrat du moteur de routes : ordre auth → rate limit → validation → handler,
// enveloppe d'erreur, en-têtes. Aucun accès base ni réseau.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  rateLimits: { api: { name: "api-limiter" }, orders: { name: "orders-limiter" } },
}));
vi.mock("@/lib/rate-limit", () => rateLimitMock);

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { apiCached, apiError, apiSuccess } from "@/lib/api/errors";
import { createRoute, readIdempotencyKey, tooManyRequests } from "@/lib/api/route-core";

type FakeAuth = { shopId: string };
const authenticate = vi.fn();
const shopRoute = createRoute<FakeAuth>({
  authenticate,
  principal: (auth) => auth.shopId,
  personalized: true,
});
const anonRoute = createRoute<null>({
  authenticate: () => ({ ok: true, auth: null }),
  principal: () => null,
  personalized: false,
});

function request(
  url: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> }
) {
  return new NextRequest(`http://localhost${url}`, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.mockResolvedValue({ ok: true, auth: { shopId: "shop-1" } });
  rateLimitMock.checkRateLimit.mockResolvedValue({ success: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createRoute — authentification", () => {
  it("renvoie la réponse du helper d'auth sans lire le corps ni appeler le handler", async () => {
    authenticate.mockResolvedValueOnce({
      ok: false,
      response: apiError("UNAUTHORIZED", "Authentification requise"),
    });
    const handler = vi.fn();
    const POST = shopRoute(
      { name: "t/auth", rateLimit: "api", body: z.object({ a: z.string() }) },
      handler
    );

    const res = await POST(request("/api/t", { method: "POST", body: "{pas du json" }));

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(rateLimitMock.checkRateLimit).not.toHaveBeenCalled();
  });
});

describe("createRoute — rate limit", () => {
  it("compose la clé `${name}:${principal}` et répond 429 + Retry-After", async () => {
    rateLimitMock.checkRateLimit.mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 30_000,
    });
    const handler = vi.fn();
    const POST = shopRoute({ name: "orders/accept", rateLimit: "api" }, handler);

    const res = await POST(request("/api/t", { method: "POST" }));

    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      rateLimitMock.rateLimits.api,
      "orders/accept:shop-1"
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(29);
    expect(handler).not.toHaveBeenCalled();
  });

  it("utilise l'IP quand la route n'a pas de principal", async () => {
    const GET = anonRoute({ name: "search", rateLimit: "api" }, () => apiSuccess(null));
    await GET(request("/api/search", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }));
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      rateLimitMock.rateLimits.api,
      "search:ip:203.0.113.7"
    );
  });

  it("tooManyRequests retombe sur 60 s quand `reset` est inconnu", () => {
    expect(tooManyRequests({ success: false }).headers.get("Retry-After")).toBe("60");
  });
});

describe("createRoute — validation", () => {
  const bodySchema = z.object({ estimatedMinutes: z.number().int().min(0) });

  it("JSON mal formé ⇒ 400 VALIDATION_ERROR (jamais 500)", async () => {
    const handler = vi.fn();
    const POST = shopRoute({ name: "t/json", body: bodySchema }, handler);
    const res = await POST(request("/api/t", { method: "POST", body: "{pas du json" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Corps JSON invalide",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("corps vide ⇒ le schéma décide (400 avec détails par champ)", async () => {
    const POST = shopRoute({ name: "t/empty", body: bodySchema }, () => apiSuccess(null));
    const res = await POST(request("/api/t", { method: "POST" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual({ _root: ["Required"] });
  });

  it("schéma en échec ⇒ 400 + details[champ]", async () => {
    const POST = shopRoute({ name: "t/body", body: bodySchema }, () => apiSuccess(null));
    const res = await POST(
      request("/api/t", { method: "POST", body: JSON.stringify({ estimatedMinutes: -1 }) })
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(Object.keys(json.error.details)).toEqual(["estimatedMinutes"]);
  });

  it("params (objet Next 14 ou Promise Next 15), query coercée et body typés arrivent au handler", async () => {
    const PATCH = shopRoute(
      {
        name: "t/all",
        params: z.object({ id: z.string().min(1) }),
        query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
        body: bodySchema,
      },
      ({ auth, params, query, body }) =>
        apiSuccess({
          shopId: auth.shopId,
          id: params.id,
          page: query.page,
          minutes: body.estimatedMinutes,
        })
    );
    const init = { method: "PATCH", body: JSON.stringify({ estimatedMinutes: 15, role: "ADMIN" }) };

    const sync = await PATCH(request("/api/t/o1?page=3", init), { params: { id: "o1" } });
    const asyncRes = await PATCH(request("/api/t/o2", init), {
      params: Promise.resolve({ id: "o2" }),
    });

    expect((await sync.json()).data).toEqual({ shopId: "shop-1", id: "o1", page: 3, minutes: 15 });
    expect((await asyncRes.json()).data).toEqual({
      shopId: "shop-1",
      id: "o2",
      page: 1,
      minutes: 15,
    });
  });

  it("query invalide ⇒ 400 (pas de NaN qui atteint Prisma)", async () => {
    const GET = shopRoute(
      { name: "t/q", query: z.object({ page: z.coerce.number().int().min(1) }) },
      () => apiSuccess(null)
    );
    const res = await GET(request("/api/t?page=abc"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("Paramètres de requête invalides");
  });
});

describe("createRoute — erreurs et en-têtes", () => {
  it("exception ⇒ 500 INTERNAL_ERROR sans fuite du message interne", async () => {
    const GET = shopRoute({ name: "t/boom" }, () => {
      throw new Error("secret: connexion postgres://user:pass@host");
    });
    const res = await GET(request("/api/t"));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("postgres://");
  });

  it("route personnalisée : cache partagé remplacé par private, no-store", async () => {
    const GET = shopRoute({ name: "t/cache" }, () => apiCached({ ok: true }, 60));
    const res = await GET(request("/api/t"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("route ouverte : l'en-tête de apiCached est conservé", async () => {
    const GET = anonRoute({ name: "t/public" }, () => apiCached({ ok: true }, 60));
    const res = await GET(request("/api/t"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("pose x-request-id (repris de x-vercel-id quand il existe)", async () => {
    const GET = anonRoute({ name: "t/id" }, ({ requestId }) => apiSuccess({ requestId }));
    const res = await GET(request("/api/t", { headers: { "x-vercel-id": "cdg1::abc" } }));
    expect(res.headers.get("x-request-id")).toBe("cdg1::abc");
    expect((await res.json()).data.requestId).toBe("cdg1::abc");
  });

  it("ignore un x-request-id hors gabarit fourni par l'appelant", async () => {
    const GET = anonRoute({ name: "t/id" }, () => apiSuccess(null));
    const res = await GET(request("/api/t", { headers: { "x-request-id": "x".repeat(300) } }));
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("laisse remonter l'erreur levée à la lecture des en-têtes (sortie de génération statique de Next)", async () => {
    const handler = vi.fn();
    const GET = anonRoute({ name: "t/static" }, handler);
    const bailout = new Error("Dynamic server usage: request.headers");
    const proxied = new Proxy(request("/api/t"), {
      get(target, prop) {
        if (prop === "headers") throw bailout;
        return Reflect.get(target, prop, target);
      },
    });
    await expect(GET(proxied)).rejects.toBe(bailout);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("readIdempotencyKey", () => {
  it("lit l'en-tête, retire les guillemets, refuse au-delà de 255 caractères", () => {
    expect(
      readIdempotencyKey(request("/api/t", { headers: { "Idempotency-Key": '"8e03978e-40d5"' } }))
    ).toBe("8e03978e-40d5");
    expect(readIdempotencyKey(request("/api/t"))).toBeNull();
    expect(
      readIdempotencyKey(request("/api/t", { headers: { "Idempotency-Key": "x".repeat(256) } }))
    ).toBeNull();
  });
});
