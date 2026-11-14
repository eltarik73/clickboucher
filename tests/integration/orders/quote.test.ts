// @vitest-environment node
// The server's quote of a basket, on real PostgreSQL: prices from database rows only, weighed
// lines priced once, availability, line validation, and no internal reference in the result.
import { describe, expect, it } from "vitest";

import { quoteOrder } from "@/lib/services/orders/quote";
import { prisma, useCleanDatabase } from "../helpers/db";
import {
  createTestOffer,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "../helpers/factories";
import { customerOf, quoteOf, quoteRequest } from "./create-order-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;

async function shopWithBeef() {
  const shop = await createTestShop();
  const beef = await createTestProduct(shop.id, {
    name: "Entrecôte",
    unit: "KG",
    priceCents: 1911,
  });
  const client = customerOf(await createTestUser());
  return { shop, beef, client };
}

describe("quoteOrder — weighed lines", () => {
  it("prices 500 g, 250 g, 2000 g and 2 × 500 g at 1911 cents/kg as 956, 478, 3822 and 1912", async () => {
    const { shop, beef, client } = await shopWithBeef();
    const quote = await quoteOf(
      quoteRequest(shop.id, [
        { productId: beef.id, quantity: 1, weightGrams: 500 },
        { productId: beef.id, quantity: 1, weightGrams: 250 },
        { productId: beef.id, quantity: 1, weightGrams: 2000 },
        { productId: beef.id, quantity: 2, weightGrams: 500 },
      ]),
      client
    );
    expect(quote.lines.map((line) => line.lineTotalCents)).toEqual([956, 478, 3822, 1912]);
    expect(quote.subtotalCents).toBe(956 + 478 + 3822 + 1912);
    expect(quote.lines.every((line) => line.unitPriceCents === 1911)).toBe(true);
  });

  it("charges no service fee on pay-on-pickup: amountDueCents equals totalCents", async () => {
    const { shop, beef, client } = await shopWithBeef();
    const quote = await quoteOf(
      quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
      client
    );
    expect(quote.serviceFeeCents).toBe(0);
    expect(quote.totalCents).toBe(956);
    expect(quote.amountDueCents).toBe(quote.totalCents);
    expect(quote.discount).toBeNull();
    expect(quote.discountRejection).toBeNull();
  });
});

describe("quoteOrder — unit price from the database", () => {
  it("applies a 20 % promotion with no end date", async () => {
    const shop = await createTestShop();
    const lamb = await createTestProduct(shop.id, {
      unit: "PIECE",
      priceCents: 1000,
      promoPct: 20,
      promoType: "PERCENTAGE",
      promoEnd: null,
    });
    const quote = await quoteOf(quoteRequest(shop.id, [{ productId: lamb.id, quantity: 3 }]), null);
    expect(quote.lines[0]).toMatchObject({
      baseUnitPriceCents: 1000,
      unitPriceCents: 800,
      lineTotalCents: 2400,
    });
  });

  it("prices a cut option from product.cutOptions and stores its database price", async () => {
    const shop = await createTestShop();
    const beef = await createTestProduct(shop.id, {
      priceCents: 1911,
      cutOptions: [{ name: "Haché", priceCents: 2200 }],
    });
    const quote = await quoteOf(
      quoteRequest(shop.id, [
        { productId: beef.id, quantity: 1, weightGrams: 1000, cutOption: "Haché" },
      ]),
      null
    );
    expect(quote.lines[0]).toMatchObject({
      cutOption: "Haché",
      cutPriceCents: 2200,
      unitPriceCents: 2200,
      lineTotalCents: 2200,
    });
  });

  it("gives the pro price to a CLIENT_PRO and the public price to a CLIENT", async () => {
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id, {
      unit: "PIECE",
      priceCents: 1000,
      proPriceCents: 850,
    });
    const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 2 }]);
    const pro = customerOf(await createTestUser({ role: "CLIENT_PRO" }));
    const client = customerOf(await createTestUser({ role: "CLIENT" }));
    expect((await quoteOf(request, pro)).totalCents).toBe(1700);
    expect((await quoteOf(request, client)).totalCents).toBe(2000);
    expect((await quoteOf(request, null)).totalCents).toBe(2000);
  });
});

describe("quoteOrder — refusals", () => {
  it("answers PRODUCTS_MISSING for a product of another shop", async () => {
    const { shop } = await shopWithBeef();
    const other = await createTestShop();
    const foreign = await createTestProduct(other.id);
    const result = await quoteOrder(
      quoteRequest(shop.id, [{ productId: foreign.id, quantity: 1, weightGrams: 500 }]),
      null,
      new Date()
    );
    expect(result).toMatchObject({
      ok: false,
      code: "PRODUCTS_MISSING",
      details: { missingProductIds: [foreign.id] },
    });
  });

  it.each([
    ["inactive", { isActive: false }],
    ["out of stock", { inStock: false }],
    ["snoozed", { snoozeType: "INDEFINITE" as const }],
    ["above its anti-gaspi stock", { isAntiGaspi: true, antiGaspiStock: 1 }],
    ["above its flash-sale stock", { isFlashSale: true, flashSaleStock: 1 }],
    [
      "above the smaller counter of its two limited modes",
      { isAntiGaspi: true, antiGaspiStock: 5, isFlashSale: true, flashSaleStock: 1 },
    ],
  ])("answers STOCK_INSUFFICIENT for a product %s", async (_label, overrides) => {
    const shop = await createTestShop();
    const product = await createTestProduct(shop.id, {
      name: "Merguez",
      unit: "PIECE",
      priceCents: 500,
      ...overrides,
    });
    const result = await quoteOrder(
      quoteRequest(shop.id, [{ productId: product.id, quantity: 2 }]),
      null,
      new Date()
    );
    expect(result).toMatchObject({
      ok: false,
      code: "STOCK_INSUFFICIENT",
      details: { unavailableProductIds: [product.id] },
    });
    expect(result.ok === false && result.message).toContain("Merguez");
  });

  it("answers VALIDATION_ERROR for a KG line without weight, a PIECE line with a weight and an unknown cut", async () => {
    const shop = await createTestShop();
    const beef = await createTestProduct(shop.id, { unit: "KG" });
    const piece = await createTestProduct(shop.id, { unit: "PIECE", priceCents: 500 });

    const noWeight = await quoteOrder(
      quoteRequest(shop.id, [{ productId: beef.id, quantity: 1 }]),
      null,
      new Date()
    );
    expect(noWeight).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(noWeight.ok === false && noWeight.details).toHaveProperty(["items.0.weightGrams"]);

    const pieceWeight = await quoteOrder(
      quoteRequest(shop.id, [{ productId: piece.id, quantity: 1, weightGrams: 300 }]),
      null,
      new Date()
    );
    expect(pieceWeight).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(pieceWeight.ok === false && pieceWeight.details).toHaveProperty(["items.0.weightGrams"]);

    const unknownCut = await quoteOrder(
      quoteRequest(shop.id, [
        { productId: beef.id, quantity: 1, weightGrams: 500, cutOption: "Inconnue" },
      ]),
      null,
      new Date()
    );
    expect(unknownCut).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(unknownCut.ok === false && unknownCut.details).toHaveProperty(["items.0.cutOption"]);
  });

  it("refuses a cut option stored at 0 cents instead of selling the kilogram for nothing", async () => {
    const shop = await createTestShop();
    const beef = await createTestProduct(shop.id, {
      name: "Entrecôte",
      unit: "KG",
      priceCents: 1911,
      cutOptions: [
        { name: "Offert", priceCents: 0 },
        { name: "Haché", priceCents: 2200 },
      ],
    });
    const items = [
      { productId: beef.id, quantity: 1, weightGrams: 500, cutOption: "Haché" },
      { productId: beef.id, quantity: 1, weightGrams: 1000, cutOption: "Offert" },
    ];
    for (const customer of [null, customerOf(await createTestUser({ role: "CLIENT_PRO" }))]) {
      const result = await quoteOrder(quoteRequest(shop.id, items), customer, new Date());
      expect(result).toMatchObject({
        ok: false,
        code: "VALIDATION_ERROR",
        details: { "items.1.cutOption": ["Entrecôte : découpe indisponible"] },
      });
      expect(result.ok === false && result.details).not.toHaveProperty(["items.0.cutOption"]);
    }
  });

  it("reports the minimum order on the subtotal", async () => {
    const shop = await createTestShop({ minOrderCents: 1500 });
    const beef = await createTestProduct(shop.id);
    const quote = await quoteOf(
      quoteRequest(shop.id, [{ productId: beef.id, quantity: 1, weightGrams: 500 }]),
      null
    );
    expect(quote).toMatchObject({ minOrderCents: 1500, belowMinimumOrder: true });
  });
});

describe("quoteOrder — preparation choices match the product and the priced weight", () => {
  async function lambChops() {
    const shop = await createTestShop();
    const chops = await createTestProduct(shop.id, {
      name: "Côtelettes d'agneau",
      unit: "KG",
      priceCents: 2020,
      weightPerPiece: 80,
      pieceLabel: "côtelettes",
      variants: ["Bien épaisses"],
    });
    const plain = await createTestProduct(shop.id, {
      name: "Côtelettes sans calibre",
      unit: "KG",
      priceCents: 2020,
    });
    const veal = await createTestProduct(shop.id, {
      name: "Escalope de veau",
      unit: "TRANCHE",
      priceCents: 2490,
      sliceOptions: {
        defaultSlices: 6,
        minSlices: 2,
        maxSlices: 12,
        thicknesses: ["fine", "epaisse"],
      },
    });
    return { shop, chops, plain, veal };
  }

  async function refusal(shopId: string, line: Parameters<typeof quoteRequest>[1][number]) {
    const result = await quoteOrder(quoteRequest(shopId, [line]), null, new Date());
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    return result.ok ? {} : (result.details ?? {});
  }

  it("accepts 6 côtelettes of 80 g as 480 g with an offered variant, and stores the product's piece label", async () => {
    const { shop, chops } = await lambChops();
    const quote = await quoteOf(
      quoteRequest(shop.id, [
        {
          productId: chops.id,
          quantity: 1,
          weightGrams: 480,
          pieceCount: 6,
          pieceLabel: "steaks géants",
          variant: "Bien épaisses",
        },
      ]),
      null
    );
    expect(quote.lines[0]).toMatchObject({
      pieceCount: 6,
      pieceLabel: "côtelettes",
      variant: "Bien épaisses",
      lineTotalCents: 970,
    });
  });

  it("refuses 12 pieces priced as 50 g, pieces of a product without a weight per piece, and an unknown variant", async () => {
    const { shop, chops, plain } = await lambChops();
    expect(
      await refusal(shop.id, { productId: chops.id, quantity: 1, weightGrams: 50, pieceCount: 12 })
    ).toHaveProperty(["items.0.pieceCount"]);
    expect(
      await refusal(shop.id, { productId: plain.id, quantity: 1, weightGrams: 50, pieceCount: 12 })
    ).toHaveProperty(["items.0.pieceCount"]);
    expect(
      await refusal(shop.id, {
        productId: plain.id,
        quantity: 1,
        weightGrams: 500,
        variant: "Bien épaisses",
      })
    ).toHaveProperty(["items.0.variant"]);
  });

  it("accepts 8 fine slices as 240 g and refuses a wrong weight, a thickness or a count outside the options", async () => {
    const { shop, chops, veal } = await lambChops();
    const quote = await quoteOf(
      quoteRequest(shop.id, [
        {
          productId: veal.id,
          quantity: 2,
          weightGrams: 240,
          sliceCount: 8,
          sliceThickness: "fine",
        },
      ]),
      null
    );
    expect(quote.lines[0]).toMatchObject({
      sliceCount: 8,
      sliceThickness: "fine",
      lineTotalCents: 2 * 598,
    });

    const base = { productId: veal.id, quantity: 1 };
    expect(
      await refusal(shop.id, { ...base, weightGrams: 50, sliceCount: 8, sliceThickness: "fine" })
    ).toHaveProperty(["items.0.sliceCount"]);
    expect(
      await refusal(shop.id, {
        ...base,
        weightGrams: 120,
        sliceCount: 8,
        sliceThickness: "chiffonnade",
      })
    ).toHaveProperty(["items.0.sliceThickness"]);
    expect(
      await refusal(shop.id, { ...base, weightGrams: 600, sliceCount: 20, sliceThickness: "fine" })
    ).toHaveProperty(["items.0.sliceCount"]);
    expect(await refusal(shop.id, { ...base, weightGrams: 240, sliceCount: 8 })).toHaveProperty([
      "items.0.sliceThickness",
    ]);
    expect(
      await refusal(shop.id, {
        productId: chops.id,
        quantity: 1,
        weightGrams: 240,
        sliceCount: 8,
        sliceThickness: "fine",
      })
    ).toHaveProperty(["items.0.sliceCount"]);
  });
});

describe("quoteOrder — limited stock at 0", () => {
  it("refuses an anti-gaspi product whose stock reached 0", async () => {
    const shop = await createTestShop();
    const trays = await createTestProduct(shop.id, {
      unit: "BARQUETTE",
      priceCents: 524,
      isAntiGaspi: true,
      antiGaspiStock: 0,
      antiGaspiOrigPriceCents: 749,
    });
    const result = await quoteOrder(
      quoteRequest(shop.id, [{ productId: trays.id, quantity: 1 }]),
      null,
      new Date()
    );
    expect(result).toMatchObject({
      ok: false,
      code: "STOCK_INSUFFICIENT",
      details: { unavailableProductIds: [trays.id] },
    });
  });

  it("ignores the counter of a limited mode that is off", async () => {
    const shop = await createTestShop();
    const trays = await createTestProduct(shop.id, {
      unit: "BARQUETTE",
      priceCents: 524,
      isAntiGaspi: true,
      antiGaspiStock: 2,
      isFlashSale: false,
      flashSaleStock: 0,
    });
    const result = await quoteOrder(
      quoteRequest(shop.id, [{ productId: trays.id, quantity: 2 }]),
      null,
      new Date()
    );
    expect(result).toMatchObject({ ok: true, quote: { subtotalCents: 1048 } });
  });
});

describe("quoteOrder — discount references stay on the server", () => {
  it("returns no offerId or loyaltyRewardId in the quote, with an offer or a reward applied", async () => {
    const { shop, beef } = await shopWithBeef();
    const user = await createTestUser();
    const offer = await createTestOffer({ code: "DIX", discountValue: 10 });
    await prisma.loyaltyReward.create({
      data: {
        userId: user.id,
        tier: 3,
        rewardType: "FIXED",
        rewardCents: 200,
        code: "KG-QUOTE1",
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
    const items = [{ productId: beef.id, quantity: 2, weightGrams: 500 }];

    const withOffer = await quoteOf(quoteRequest(shop.id, items, offer.code), customerOf(user));
    expect(withOffer.discount).toEqual({ code: "DIX", label: offer.name, discountCents: 191 });
    const withReward = await quoteOf(quoteRequest(shop.id, items, "KG-QUOTE1"), customerOf(user));
    expect(withReward.discount?.discountCents).toBe(200);

    for (const quote of [withOffer, withReward]) {
      const json = JSON.stringify(quote);
      expect(json).not.toContain("offerId");
      expect(json).not.toContain("loyaltyRewardId");
      expect(json).not.toContain(offer.id);
      expect(Object.keys(quote).sort()).toEqual(
        [
          "amountDueCents",
          "belowMinimumOrder",
          "discount",
          "discountRejection",
          "lines",
          "minOrderCents",
          "paymentMethod",
          "serviceFeeCents",
          "shopId",
          "subtotalCents",
          "totalCents",
        ].sort()
      );
    }
  });
});
