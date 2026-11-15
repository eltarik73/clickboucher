// @vitest-environment node
// Recalcul des prix en ligne quand le boucher change sa majoration (PATCH /api/shops/[id]), sur
// PostgreSQL réel (revue de la PR #28) : avant, ce recalcul réécrivait priceCents sans tenir compte
// de l'anti-gaspi. Un anti-gaspi échu gardait alors son prix d'origine à la lecture (le nouveau
// prix ne s'appliquait pas), et un anti-gaspi en cours perdait le prix remisé fixé par le boucher.
// Désormais (src/lib/services/shops/markup-reprice.ts) : produit ordinaire au nouveau prix,
// anti-gaspi échu terminé avec le nouveau prix, anti-gaspi en cours gardé, son prix de retour
// recalculé. Simulés : les helpers d'auth (identité de l'appelant), seule doublure permise ici.
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

import type { Shop, User } from "@prisma/client";
import { antiGaspiEndedColumns } from "@/lib/pricing/anti-gaspi";
import { quoteOrder } from "@/lib/services/orders/quote";
import {
  computeOnlinePriceCents,
  getEffectiveCommissionRate,
} from "@/lib/services/stripe/commission";
import { actAs } from "../images/product-routes-harness";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { quoteRequest } from "../orders/create-order-fixtures";

const { PATCH: patchShop } = await import("@/app/api/shops/[id]/route");

// eslint-disable-next-line react-hooks/rules-of-hooks -- pas un hook React, seul le préfixe « use » compte
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;
const BOUTIQUE = 2000;
const NEW_MARKUP = 100;

let owner: User;
let shop: Shop;

beforeEach(async () => {
  owner = await createTestUser({ role: "BOUCHER" });
  shop = await createTestShop({ ownerId: owner.id, commissionMarkupPercent: 0 });
  actAs(owner, shop.id);
});

/** The online price of a 20 € boutique price once the markup is 100 %. */
function newOnlinePrice(): number {
  return computeOnlinePriceCents(
    BOUTIQUE,
    getEffectiveCommissionRate({ tier: shop.tier, earlyAdopterUntil: shop.earlyAdopterUntil }),
    NEW_MARKUP,
    shop.priceRoundingEnabled
  );
}

function piece(name: string, extra: Record<string, unknown> = {}) {
  return createTestProduct(shop.id, {
    name,
    unit: "PIECE",
    boutiquePriceCents: BOUTIQUE,
    priceCents: BOUTIQUE,
    ...extra,
  });
}

function antiGaspi(name: string, endAt: Date) {
  return piece(name, {
    priceCents: 1000,
    isAntiGaspi: true,
    antiGaspiOrigPriceCents: BOUTIQUE,
    antiGaspiEndAt: endAt,
    antiGaspiStock: 2,
    antiGaspiReason: "DLC proche",
  });
}

async function quotedUnitPrice(productId: string): Promise<number> {
  const quoted = await quoteOrder(
    quoteRequest(shop.id, [{ productId, quantity: 1 }]),
    null,
    new Date()
  );
  if (!quoted.ok) throw new Error(`quoteOrder refused: ${quoted.code} ${quoted.message}`);
  return quoted.quote.lines[0].unitPriceCents;
}

async function changeMarkup(): Promise<number> {
  const response = await patchShop(
    new NextRequest(`http://localhost/api/shops/${shop.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commissionMarkupPercent: NEW_MARKUP }),
    }),
    { params: { id: shop.id } }
  );
  return response.status;
}

describe("PATCH /api/shops/[id] : la majoration change, les prix en ligne suivent", () => {
  it("produit ordinaire, anti-gaspi échu et anti-gaspi en cours", async () => {
    const plain = await piece("Entrecôte");
    const expired = await antiGaspi("Merguez échue", new Date(Date.now() - DAY_MS));
    const running = await antiGaspi("Merguez en cours", new Date(Date.now() + DAY_MS));
    const price = newOnlinePrice();
    expect(price).toBeGreaterThan(BOUTIQUE);

    expect(await changeMarkup()).toBe(200);

    const stored = (id: string) => prisma.product.findUniqueOrThrow({ where: { id } });
    expect(await stored(plain.id)).toMatchObject({ priceCents: price });
    expect(await stored(expired.id)).toMatchObject({ priceCents: price, ...antiGaspiEndedColumns });
    expect(await stored(running.id)).toMatchObject({
      priceCents: 1000,
      isAntiGaspi: true,
      antiGaspiOrigPriceCents: price,
      antiGaspiStock: 2,
    });
    expect(await quotedUnitPrice(plain.id)).toBe(price);
    expect(await quotedUnitPrice(expired.id)).toBe(price);
    expect(await quotedUnitPrice(running.id)).toBe(1000);
  });
});
