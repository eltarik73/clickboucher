// @vitest-environment node
// Item 4 (C1-URGENCES), côté boucher, sur PostgreSQL réel. Passé antiGaspiEndAt, le client paie le
// prix d'origine (antiGaspiOrigPriceCents) et non Product.priceCents. Le boucher doit donc voir ce
// prix dans ses écrans, et le prix qu'il saisit doit devenir celui que paie le client : toute
// écriture de priceCents sur un produit dont l'anti-gaspi est échu termine le mode dans la même
// mise à jour. Relancer l'anti-gaspi d'un produit échu repart du prix d'origine.
//
// Simulés : les helpers d'auth (identité de l'appelant), seule doublure permise ici.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "@/lib/auth/server-auth",
  async () => (await import("../images/product-routes-harness")).serverAuthMock
);
vi.mock(
  "@/lib/boucher-auth",
  async () => (await import("../images/product-routes-harness")).boucherAuthMock
);

import type { Product, Shop, User } from "@prisma/client";
import { quoteOrder } from "@/lib/services/orders/quote";
import { actAs } from "../images/product-routes-harness";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { quoteRequest } from "../orders/create-order-fixtures";

const { GET: getProduct, PATCH: patchProduct } = await import("@/app/api/products/[id]/route");
const { GET: listProducts } = await import("@/app/api/products/route");
const { PATCH: patchCatalogue } = await import("@/app/api/boucher/catalogue/[productId]/route");
const { GET: listAntiGaspi, POST: startAntiGaspi } =
  await import("@/app/api/boucher/anti-gaspi/route");
const { GET: listButcherProducts } = await import("@/app/api/boucher/products/route");
const { POST: duplicateProduct } = await import("@/app/api/products/duplicate/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;
const ORIGINAL = 2000;
const DISCOUNTED = 1000;

type Body = { data?: unknown; error?: { code: string; message: string } };

let owner: User;
let shop: Shop;

beforeEach(async () => {
  owner = await createTestUser({ role: "BOUCHER" });
  shop = await createTestShop({ ownerId: owner.id });
  actAs(owner, shop.id);
});

/**
 * A piece sold 2000 put in anti-gaspi as POST /api/boucher/anti-gaspi does: 1000, original kept,
 * `stock` units left on the anti-gaspi counter.
 */
function antiGaspiProduct(input: { endAt: Date | null; stock: number; name?: string }) {
  return createTestProduct(shop.id, {
    name: input.name ?? "Merguez anti-gaspi",
    unit: "PIECE",
    priceCents: DISCOUNTED,
    isAntiGaspi: true,
    antiGaspiOrigPriceCents: ORIGINAL,
    antiGaspiEndAt: input.endAt,
    antiGaspiStock: input.stock,
    antiGaspiReason: "DLC proche",
  });
}

/** Ended yesterday with its counter at 0, as the product the review reproduced on staging. */
function expired(): Promise<Product> {
  return antiGaspiProduct({ endAt: new Date(Date.now() - DAY_MS), stock: 0 });
}

function running(name?: string): Promise<Product> {
  return antiGaspiProduct({ endAt: new Date(Date.now() + DAY_MS), stock: 3, name });
}

function request(path: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response): Promise<{ status: number; body: Body }> {
  return { status: response.status, body: (await response.json()) as Body };
}

/** Unit price a customer is quoted for one piece of the product today. */
async function quotedUnitPrice(productId: string): Promise<number> {
  const quoted = await quoteOrder(
    quoteRequest(shop.id, [{ productId, quantity: 1 }]),
    null,
    new Date()
  );
  if (!quoted.ok) throw new Error(`quoteOrder refused: ${quoted.code} ${quoted.message}`);
  return quoted.quote.lines[0].unitPriceCents;
}

function storedProduct(id: string) {
  return prisma.product.findUniqueOrThrow({ where: { id } });
}

const MODE_ENDED = {
  isAntiGaspi: false,
  antiGaspiOrigPriceCents: null,
  antiGaspiEndAt: null,
  antiGaspiStock: null,
  antiGaspiReason: null,
};

describe("le boucher change le prix d'un produit dont l'anti-gaspi est échu", () => {
  it("PATCH /api/products/[id] : le prix saisi est celui que paie le client, le mode est terminé", async () => {
    const product = await expired();

    const patched = await read(
      await patchProduct(request(`/api/products/${product.id}`, "PATCH", { priceCents: 600 }), {
        params: { id: product.id },
      })
    );

    expect(patched.status).toBe(200);
    expect(await storedProduct(product.id)).toMatchObject({ priceCents: 600, ...MODE_ENDED });
    expect(await quotedUnitPrice(product.id)).toBe(600);
  });

  it("PATCH /api/boucher/catalogue/[productId] : même règle", async () => {
    const product = await expired();

    const patched = await read(
      await patchCatalogue(
        request(`/api/boucher/catalogue/${product.id}`, "PATCH", { priceCents: 600 }),
        { params: { productId: product.id } }
      )
    );

    expect(patched.status).toBe(200);
    expect(await storedProduct(product.id)).toMatchObject({ priceCents: 600, ...MODE_ENDED });
    expect(await quotedUnitPrice(product.id)).toBe(600);
  });

  it("une modification sans prix laisse les colonnes anti-gaspi : le client paie toujours 2000", async () => {
    const product = await expired();

    const patched = await read(
      await patchProduct(
        request(`/api/products/${product.id}`, "PATCH", { description: "Fines" }),
        {
          params: { id: product.id },
        }
      )
    );

    expect(patched.status).toBe(200);
    expect(await storedProduct(product.id)).toMatchObject({
      description: "Fines",
      priceCents: DISCOUNTED,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: ORIGINAL,
    });
    expect(await quotedUnitPrice(product.id)).toBe(ORIGINAL);
  });

  it("un anti-gaspi encore en cours garde son mode : le prix saisi est le prix remisé", async () => {
    const product = await running();

    await patchProduct(request(`/api/products/${product.id}`, "PATCH", { priceCents: 900 }), {
      params: { id: product.id },
    });

    expect(await storedProduct(product.id)).toMatchObject({
      priceCents: 900,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: ORIGINAL,
      antiGaspiReason: "DLC proche",
    });
    expect(await quotedUnitPrice(product.id)).toBe(900);
  });
});

describe("POST /api/products/duplicate", () => {
  it("copie un produit échu au prix que paie le client, pas au prix remisé échu", async () => {
    const product = await expired();

    const copied = await read(
      await duplicateProduct(request("/api/products/duplicate", "POST", { productId: product.id }))
    );

    expect(copied.status).toBe(200);
    const copy = await storedProduct((copied.body.data as { id: string }).id);
    expect(copy).toMatchObject({ priceCents: ORIGINAL, isAntiGaspi: false });
  });
});

describe("le boucher voit le prix que paie le client", () => {
  it("GET /api/products/[id] (formulaire d'édition) : 2000, hors anti-gaspi", async () => {
    const product = await expired();

    const got = await read(
      await getProduct(request(`/api/products/${product.id}`), {
        params: { id: product.id },
      })
    );

    expect(got.status).toBe(200);
    expect(got.body.data).toMatchObject({ id: product.id, priceCents: ORIGINAL, ...MODE_ENDED });
  });

  it("GET /api/products?shopId (catalogue du boucher) : 2000, hors anti-gaspi", async () => {
    const product = await expired();

    const listed = await read(await listProducts(request(`/api/products?shopId=${shop.id}`)));

    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({ id: product.id, priceCents: ORIGINAL, ...MODE_ENDED }),
    ]);
  });

  it("GET /api/boucher/products (écran anti-gaspi) : 2000, hors anti-gaspi", async () => {
    const product = await expired();

    const listed = await read(await listButcherProducts(request("/api/boucher/products")));

    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({ id: product.id, priceCents: ORIGINAL, ...MODE_ENDED }),
    ]);
  });

  it("GET /api/boucher/anti-gaspi ne liste que les anti-gaspi en cours", async () => {
    await expired();
    const inForce = await running("Côtes en cours");
    const open = await antiGaspiProduct({ endAt: null, stock: 3, name: "Sans date de fin" });

    const listed = await read(await listAntiGaspi());

    expect(listed.status).toBe(200);
    const ids = (listed.body.data as { id: string }[]).map((p) => p.id);
    expect(ids.sort()).toEqual([inForce.id, open.id].sort());
  });
});

describe("POST /api/boucher/anti-gaspi", () => {
  it("relance un anti-gaspi échu à partir du prix d'origine", async () => {
    const product = await expired();
    const endAt = new Date(Date.now() + 2 * DAY_MS);

    const started = await read(
      await startAntiGaspi(
        request("/api/boucher/anti-gaspi", "POST", {
          productId: product.id,
          discountPercent: 30,
          antiGaspiStock: 4,
          endAt: endAt.toISOString(),
        })
      )
    );

    expect(started.status).toBe(200);
    // 2000 × (1 − 0,30) = 1400 ; l'ancien prix remisé (1000) ne sert plus de base.
    expect(await storedProduct(product.id)).toMatchObject({
      isAntiGaspi: true,
      priceCents: 1400,
      antiGaspiOrigPriceCents: ORIGINAL,
      antiGaspiStock: 4,
      antiGaspiEndAt: endAt,
    });
    expect(await quotedUnitPrice(product.id)).toBe(1400);
  });

  it("refuse toujours un produit dont l'anti-gaspi est en cours", async () => {
    const product = await running();

    const started = await read(
      await startAntiGaspi(
        request("/api/boucher/anti-gaspi", "POST", { productId: product.id, discountPercent: 30 })
      )
    );

    expect(started.status).toBe(400);
    expect(started.body.error?.message).toBe("Ce produit est deja en anti-gaspi");
    expect(await storedProduct(product.id)).toMatchObject({
      priceCents: DISCOUNTED,
      antiGaspiOrigPriceCents: ORIGINAL,
    });
  });
});
