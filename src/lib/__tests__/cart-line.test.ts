// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  EMPTY_CART,
  cartLineId,
  cartLineTotalCents,
  cartReducer,
  cartTotalCents,
  type CartItem,
  type CartState,
} from "@/lib/cart/cart-line";
import {
  cartItemFromOrderLine,
  normalizeCartLine,
  normalizeStoredCart,
} from "@/lib/cart/stored-cart";
import { displayedProductPromo, displayedUnitPrice } from "@/lib/pricing/display";
import { lineTotalCents, portionPriceCents } from "@/lib/pricing/line";

type WeighedItem = Extract<CartItem, { unit: "KG" | "TRANCHE" }>;
type CountedItem = Extract<CartItem, { unit: "PIECE" | "BARQUETTE" }>;

const SHOP = { shopId: "shop_1", shopName: "Boucherie Test", shopSlug: "boucherie-test" };

function weighed(overrides: Partial<WeighedItem> = {}): CartItem {
  const base = {
    productId: "prod_entrecote",
    name: "Entrecôte",
    imageUrl: "",
    unit: "KG" as WeighedItem["unit"],
    priceCents: 1911,
    quantity: 1,
    weightGrams: 500,
    ...overrides,
  };
  return { ...base, id: overrides.id ?? cartLineId(base) };
}

function counted(overrides: Partial<CountedItem> = {}): CartItem {
  const base = {
    productId: "prod_merguez",
    name: "Merguez",
    imageUrl: "",
    unit: "PIECE" as CountedItem["unit"],
    priceCents: 574,
    quantity: 3,
    ...overrides,
  };
  return { ...base, id: overrides.id ?? cartLineId(base) };
}

function add(state: CartState, item: CartItem): CartState {
  return cartReducer(state, { type: "ADD_ITEM", payload: { ...item, ...SHOP } });
}

describe("cartLineTotalCents / cartTotalCents", () => {
  it("prices a weighed line exactly like the pricing module", () => {
    const line = weighed();
    expect(cartLineTotalCents(line)).toBe(lineTotalCents(line, 1911));
    expect(cartLineTotalCents(line)).toBe(956);
  });

  it("prices 2 portions of 500 g at 1911 cents/kg at 1912, twice the displayed portion price", () => {
    const line = weighed({ quantity: 2 });
    expect(cartLineTotalCents(line)).toBe(1912);
    expect(cartLineTotalCents(line)).toBe(2 * portionPriceCents(1911, 500));
  });

  it("prices a sliced line per kilogram of its estimated portion", () => {
    const line: CartItem = {
      id: "x",
      productId: "prod_bresaola",
      name: "Bresaola",
      imageUrl: "",
      unit: "TRANCHE",
      priceCents: 4590,
      quantity: 1,
      weightGrams: 180,
      sliceCount: 6,
      thickness: "fine",
    };
    expect(cartLineTotalCents(line)).toBe(lineTotalCents(line, 4590));
    expect(cartLineTotalCents(line)).toBe(826);
  });

  it("prices a counted line as quantity x unit price", () => {
    expect(cartLineTotalCents(counted())).toBe(1722);
    expect(cartLineTotalCents(counted({ unit: "BARQUETTE", priceCents: 1200, quantity: 1 }))).toBe(
      1200
    );
  });

  it("sums the lines, and an empty cart is 0", () => {
    expect(cartTotalCents([weighed({ quantity: 2 }), counted()])).toBe(1912 + 1722);
    expect(cartTotalCents([])).toBe(0);
  });

  it("refuses to price a line that is not a valid request line", () => {
    expect(() => cartLineTotalCents({ ...weighed(), quantity: 0.5 })).toThrow(RangeError);
  });
});

describe("cartLineId", () => {
  it("puts the weight in the id of a weighed line", () => {
    expect(cartLineId({ productId: "p", unit: "KG", weightGrams: 500 })).toBe("p-500g");
    expect(
      cartLineId({
        productId: "p",
        unit: "KG",
        weightGrams: 500,
        variant: "Nature",
        cutOption: "Hachée",
      })
    ).toBe("p-Nature-Hachée-500g");
    expect(
      cartLineId({
        productId: "p",
        unit: "TRANCHE",
        weightGrams: 180,
        thickness: "fine",
        sliceCount: 6,
      })
    ).toBe("p-fine-6-180g");
  });

  it("keeps the product id for a counted line, with its variant", () => {
    expect(cartLineId({ productId: "p", unit: "PIECE" })).toBe("p");
    expect(cartLineId({ productId: "p", unit: "BARQUETTE", variant: "Épicée" })).toBe("p-Épicée");
  });

  it("separates a weight chosen as pieces from the same weight chosen in grams", () => {
    expect(cartLineId({ productId: "p", unit: "KG", weightGrams: 600, pieceCount: 6 })).toBe(
      "p-6pc-600g"
    );
  });
});

describe("cartReducer", () => {
  it("adds the same product at 500 g then at 300 g as two lines", () => {
    const state = add(add(EMPTY_CART, weighed()), weighed({ weightGrams: 300 }));
    expect(state.items).toHaveLength(2);
    expect(state.items.map((i) => [i.weightGrams, i.quantity])).toEqual([
      [500, 1],
      [300, 1],
    ]);
  });

  it("adds the same product twice at 500 g as one line of 2 portions", () => {
    const state = add(add(EMPTY_CART, weighed()), weighed());
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ quantity: 2, weightGrams: 500 });
    expect(cartTotalCents(state.items)).toBe(1912);
  });

  it("merges two lines only when their ids are equal", () => {
    const state = add(add(EMPTY_CART, counted()), counted({ variant: "Épicée" }));
    expect(state.items).toHaveLength(2);
  });

  it("never merges above the line maximum", () => {
    const state = add(add(EMPTY_CART, counted({ quantity: 60 })), counted({ quantity: 60 }));
    expect(state.items[0].quantity).toBe(99);
  });

  it("ignores a line that is not a valid request line", () => {
    expect(add(EMPTY_CART, { ...weighed(), quantity: 0.5 })).toBe(EMPTY_CART);
    expect(add(EMPTY_CART, { ...counted(), weightGrams: 500 } as unknown as CartItem)).toBe(
      EMPTY_CART
    );
  });

  it("replaces the cart when the line comes from another shop", () => {
    const first = add(EMPTY_CART, counted());
    const state = cartReducer(first, {
      type: "ADD_ITEM",
      payload: { ...weighed(), shopId: "shop_2", shopName: "Autre", shopSlug: "autre" },
    });
    expect(state.shopId).toBe("shop_2");
    expect(state.items).toHaveLength(1);
  });

  it("updates a quantity, removes the line at 0, refuses a fractional or excessive quantity", () => {
    const state = add(EMPTY_CART, counted());
    const id = state.items[0].id;
    expect(
      cartReducer(state, { type: "UPDATE_QTY", payload: { id, quantity: 4 } }).items[0].quantity
    ).toBe(4);
    expect(cartReducer(state, { type: "UPDATE_QTY", payload: { id, quantity: 0 } })).toEqual(
      EMPTY_CART
    );
    expect(cartReducer(state, { type: "UPDATE_QTY", payload: { id, quantity: 1.5 } })).toBe(state);
    expect(cartReducer(state, { type: "UPDATE_QTY", payload: { id, quantity: 100 } })).toBe(state);
  });

  it("re-keys a line whose portion weight changes, merging with an existing line of that weight", () => {
    const state = add(add(EMPTY_CART, weighed()), weighed({ weightGrams: 300 }));
    const heavy = state.items[0].id;
    const moved = cartReducer(state, {
      type: "UPDATE_WEIGHT",
      payload: { id: heavy, weightGrams: 300 },
    });
    expect(moved.items).toHaveLength(1);
    expect(moved.items[0]).toMatchObject({
      id: "prod_entrecote-300g",
      quantity: 2,
      weightGrams: 300,
    });

    const changed = cartReducer(state, {
      type: "UPDATE_WEIGHT",
      payload: { id: heavy, weightGrams: 700 },
    });
    expect(changed.items.map((i) => i.id)).toEqual(["prod_entrecote-700g", "prod_entrecote-300g"]);
  });

  it("ignores a weight change on a counted line or to an invalid weight", () => {
    const state = add(add(EMPTY_CART, counted()), weighed());
    expect(
      cartReducer(state, {
        type: "UPDATE_WEIGHT",
        payload: { id: state.items[0].id, weightGrams: 500 },
      })
    ).toBe(state);
    expect(
      cartReducer(state, {
        type: "UPDATE_WEIGHT",
        payload: { id: state.items[1].id, weightGrams: 0 },
      })
    ).toBe(state);
  });
});

describe("normalizeStoredCart", () => {
  function stored(items: unknown[]): unknown {
    return { ...SHOP, items };
  }

  it("turns an old cut price into the line's unit price", () => {
    const state = normalizeStoredCart(
      stored([
        {
          id: "prod_a-Hachée",
          productId: "prod_a",
          name: "A",
          imageUrl: "",
          unit: "KG",
          quantity: 1,
          weightGrams: 500,
          priceCents: 1911,
          cutPriceCents: 2100,
          cutOption: "Hachée",
          quantiteG: 500,
          prixAuKg: 21,
        },
      ])
    );
    expect(state.items).toHaveLength(1);
    expect(state.items[0].priceCents).toBe(2100);
    expect(state.items[0]).not.toHaveProperty("cutPriceCents");
    expect(state.items[0]).not.toHaveProperty("quantiteG");
    expect(state.items[0]).not.toHaveProperty("prixAuKg");
    expect(state.items[0]).toMatchObject({
      id: "prod_a-Hachée-500g",
      cutOption: "Hachée",
      weightGrams: 500,
      quantity: 1,
    });
  });

  it("rebuilds a weighed line without weight from its quantity in kilograms", () => {
    const state = normalizeStoredCart(
      stored([
        { id: "prod_a", name: "A", imageUrl: "", unit: "KG", quantity: 0.5, priceCents: 1911 },
      ])
    );
    expect(state.items[0]).toMatchObject({
      productId: "prod_a",
      quantity: 1,
      weightGrams: 500,
      id: "prod_a-500g",
    });
    expect(cartTotalCents(state.items)).toBe(956);
  });

  it("takes the line id as product id when the product id is missing", () => {
    const state = normalizeStoredCart(
      stored([
        { id: "prod_m", name: "M", imageUrl: "", unit: "PIECE", quantity: 2, priceCents: 300 },
      ])
    );
    expect(state.items[0]).toMatchObject({ id: "prod_m", productId: "prod_m", quantity: 2 });
  });

  it("drops a line with quantity 0, a non-numeric weight, a fractional count or an unknown unit", () => {
    const state = normalizeStoredCart(
      stored([
        { id: "a", name: "A", imageUrl: "", unit: "PIECE", quantity: 0, priceCents: 300 },
        {
          id: "b",
          name: "B",
          imageUrl: "",
          unit: "KG",
          quantity: 1,
          weightGrams: "500",
          priceCents: 1911,
        },
        { id: "c", name: "C", imageUrl: "", unit: "PIECE", quantity: 1.5, priceCents: 300 },
        { id: "d", name: "D", imageUrl: "", unit: "LITRE", quantity: 1, priceCents: 300 },
        { id: "e", name: "E", imageUrl: "", unit: "PIECE", quantity: 1, priceCents: 2.5 },
        { id: "f", name: "F", imageUrl: "", unit: "PIECE", quantity: 1, priceCents: 300 },
      ])
    );
    expect(state.items.map((i) => i.id)).toEqual(["f"]);
  });

  it("drops the weight the old cart left on a counted line", () => {
    const state = normalizeStoredCart(
      stored([
        {
          id: "m",
          name: "M",
          imageUrl: "",
          unit: "PIECE",
          quantity: 1,
          weightGrams: 200,
          priceCents: 300,
        },
      ])
    );
    expect(state.items[0]).not.toHaveProperty("weightGrams");
    expect(cartTotalCents(state.items)).toBe(300);
  });

  it("reads what GET /api/cart returns (cart row id, product id, null image and weight)", () => {
    const state = normalizeStoredCart({
      ...SHOP,
      items: [
        {
          id: "cart_item_1",
          productId: "prod_a",
          name: "A",
          imageUrl: null,
          unit: "KG",
          quantity: 2,
          weightGrams: 250,
          priceCents: 1990,
          inStock: true,
          snoozed: false,
        },
        {
          id: "cart_item_2",
          productId: "prod_b",
          name: "B",
          imageUrl: null,
          unit: "BARQUETTE",
          quantity: 1,
          weightGrams: null,
          priceCents: 1200,
          inStock: true,
          snoozed: false,
        },
      ],
    });
    expect(state.items).toEqual([
      {
        id: "prod_a-250g",
        productId: "prod_a",
        name: "A",
        imageUrl: "",
        unit: "KG",
        quantity: 2,
        weightGrams: 250,
        priceCents: 1990,
      },
      {
        id: "prod_b",
        productId: "prod_b",
        name: "B",
        imageUrl: "",
        unit: "BARQUETTE",
        quantity: 1,
        priceCents: 1200,
      },
    ]);
  });

  it("keeps the optional fields of the right type only", () => {
    const state = normalizeStoredCart(
      stored([
        {
          id: "t",
          productId: "prod_t",
          name: "T",
          imageUrl: "x.jpg",
          unit: "TRANCHE",
          quantity: 1,
          weightGrams: 180,
          priceCents: 4590,
          sliceCount: 6,
          thickness: "fine",
          variant: 3,
          category: "Charcuterie",
        },
      ])
    );
    expect(state.items[0]).toEqual({
      id: "prod_t-fine-6-180g",
      productId: "prod_t",
      name: "T",
      imageUrl: "x.jpg",
      unit: "TRANCHE",
      quantity: 1,
      weightGrams: 180,
      priceCents: 4590,
      sliceCount: 6,
      thickness: "fine",
      category: "Charcuterie",
    });
  });

  it("merges old lines that become the same line", () => {
    const state = normalizeStoredCart(
      stored([
        {
          id: "old-1",
          productId: "prod_a",
          name: "A",
          imageUrl: "",
          unit: "KG",
          quantity: 0.5,
          priceCents: 1911,
        },
        {
          id: "old-2",
          productId: "prod_a",
          name: "A",
          imageUrl: "",
          unit: "KG",
          quantity: 1,
          weightGrams: 500,
          priceCents: 1911,
        },
      ])
    );
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ quantity: 2, weightGrams: 500 });
  });

  it("returns the empty state for garbage, a cart without shop, or a cart left without valid line", () => {
    for (const raw of [
      null,
      undefined,
      "x",
      42,
      [],
      {},
      { items: "x" },
      { shopId: 3, items: [] },
    ]) {
      expect(normalizeStoredCart(raw)).toEqual(EMPTY_CART);
    }
    expect(
      normalizeStoredCart({
        shopId: null,
        items: [{ id: "f", name: "F", imageUrl: "", unit: "PIECE", quantity: 1, priceCents: 300 }],
      })
    ).toEqual(EMPTY_CART);
    expect(normalizeStoredCart(stored([{ id: "a", unit: "PIECE", quantity: 0 }]))).toEqual(
      EMPTY_CART
    );
    expect(normalizeStoredCart(stored([null, "x", 3]))).toEqual(EMPTY_CART);
  });

  it("keeps the shop of a valid cart", () => {
    const state = normalizeStoredCart(
      stored([{ id: "f", name: "F", imageUrl: "", unit: "PIECE", quantity: 1, priceCents: 300 }])
    );
    expect(state).toMatchObject(SHOP);
  });
});

describe("displayedUnitPrice / displayedProductPromo", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const undated = { priceCents: 2237, promoPct: 20, promoType: "PERCENTAGE", promoEnd: null };
  const future = { ...undated, promoEnd: "2026-11-20T00:00:00.000Z" };
  const past = { ...undated, promoEnd: "2026-11-01T00:00:00.000Z" };

  it("applies an active promotion with the pricing module's rounding", () => {
    expect(displayedUnitPrice(undated, now)).toEqual({
      unitPriceCents: 1790,
      baseCents: 2237,
      promo: { kind: "PERCENT", pct: 20 },
    });
    expect(displayedUnitPrice(future, now).unitPriceCents).toBe(1790);
    expect(displayedProductPromo(future, now)).toEqual({ kind: "PERCENT", pct: 20 });
  });

  it("does not show an expired promotion", () => {
    expect(displayedUnitPrice(past, now)).toEqual({
      unitPriceCents: 2237,
      baseCents: 2237,
      promo: null,
    });
    expect(displayedProductPromo(past, now)).toBeNull();
  });

  it("before mount, shows only a promotion without end date", () => {
    expect(displayedUnitPrice(undated, null).unitPriceCents).toBe(1790);
    expect(displayedUnitPrice(future, null)).toEqual({
      unitPriceCents: 2237,
      baseCents: 2237,
      promo: null,
    });
    expect(displayedProductPromo(future, null)).toBeNull();
  });

  it("shows a fixed-amount promotion and never the pro price", () => {
    const fixed = {
      priceCents: 1500,
      proPriceCents: 1200,
      promoType: "FIXED_AMOUNT",
      promoFixedCents: 300,
    };
    expect(displayedUnitPrice(fixed, now)).toEqual({
      unitPriceCents: 1200,
      baseCents: 1500,
      promo: { kind: "FIXED", cents: 300 },
    });
  });
});

describe("normalizeCartLine (chat actions)", () => {
  it("reads a weighed action without weight as kilograms and keeps a weighed action with weight", () => {
    expect(
      normalizeCartLine({ productId: "p", name: "P", unit: "KG", priceCents: 1990, quantity: 2 })
    ).toMatchObject({ id: "p-2000g", quantity: 1, weightGrams: 2000 });
    expect(
      normalizeCartLine({
        productId: "p",
        name: "P",
        unit: "KG",
        priceCents: 1990,
        quantity: 1,
        weightGrams: 500,
      })
    ).toMatchObject({ id: "p-500g", quantity: 1, weightGrams: 500 });
  });

  it("refuses an action with an unknown unit or price", () => {
    expect(
      normalizeCartLine({ productId: "p", name: "P", unit: "KILO", priceCents: 1990, quantity: 1 })
    ).toBeNull();
    expect(
      normalizeCartLine({ productId: "p", name: "P", unit: "KG", priceCents: "19,90", quantity: 1 })
    ).toBeNull();
  });
});

describe("cartItemFromOrderLine", () => {
  const row = {
    productId: "p",
    name: "P",
    imageUrl: null,
    unit: "KG" as const,
    priceCents: 1911,
    cutOption: null,
    variant: null,
    sliceCount: null,
    sliceThickness: null,
    pieceCount: null,
    pieceLabel: null,
  };

  it("rebuilds the portions of a stored weighed row (quantity in kilograms)", () => {
    expect(cartItemFromOrderLine({ ...row, quantity: 1, weightGrams: 500 })).toEqual({
      id: "p-500g",
      productId: "p",
      name: "P",
      imageUrl: "",
      unit: "KG",
      quantity: 2,
      weightGrams: 500,
      priceCents: 1911,
    });
  });

  it("orders a re-weighed row again as one portion of its weighed total", () => {
    expect(cartItemFromOrderLine({ ...row, quantity: 0.47, weightGrams: 500 })).toMatchObject({
      quantity: 1,
      weightGrams: 470,
    });
  });

  it("keeps the cut, variant and slice fields", () => {
    expect(
      cartItemFromOrderLine({
        ...row,
        unit: "TRANCHE",
        quantity: 0.18,
        weightGrams: 180,
        sliceCount: 6,
        sliceThickness: "fine",
        cutOption: "Hachée",
        variant: "Nature",
      })
    ).toMatchObject({
      id: "p-Nature-Hachée-fine-6-180g",
      unit: "TRANCHE",
      quantity: 1,
      weightGrams: 180,
      sliceCount: 6,
      thickness: "fine",
      cutOption: "Hachée",
      variant: "Nature",
    });
  });

  it("orders counted units again, and drops a row the server would refuse", () => {
    expect(
      cartItemFromOrderLine({ ...row, unit: "PIECE", quantity: 3, weightGrams: null })
    ).toMatchObject({ id: "p", quantity: 3 });
    expect(
      cartItemFromOrderLine({ ...row, unit: "PIECE", quantity: 1.5, weightGrams: null })
    ).toBeNull();
    expect(cartItemFromOrderLine({ ...row, quantity: 0, weightGrams: 500 })).toBeNull();
  });
});
