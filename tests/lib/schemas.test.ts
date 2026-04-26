// tests/lib/schemas.test.ts — Zod schema validation tests
import { describe, it, expect } from "vitest";
import {
  createOrderSchema,
  boucherActionSchema,
  createProductSchema,
  enableAntiGaspiSchema,
  toggleStockSchema,
  rateOrderSchema,
  toggleFavoriteSchema,
} from "@/lib/validators";

describe("createOrderSchema", () => {
  const validOrder = {
    shopId: "cm123abc",
    items: [{ productId: "prod1", quantity: 2, unit: "PIECE" as const }],
  };

  it("accepts valid order", () => {
    const result = createOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects empty shopId", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, shopId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing items", () => {
    const result = createOrderSchema.safeParse({ shopId: "cm123abc" });
    expect(result.success).toBe(false);
  });

  it("accepts optional customerNote", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, customerNote: "Sans oignon" });
    expect(result.success).toBe(true);
  });

  it("rejects customerNote over 500 chars", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, customerNote: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts valid pickupSlotStart", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      pickupSlotStart: "2026-03-15T14:00:00.000Z",
      pickupSlotEnd: "2026-03-15T14:30:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts ON_PICKUP payment method", () => {
    expect(createOrderSchema.safeParse({ ...validOrder, paymentMethod: "ON_PICKUP" }).success).toBe(true);
  });

  it("rejects ONLINE payment method (Stripe not implemented yet)", () => {
    expect(createOrderSchema.safeParse({ ...validOrder, paymentMethod: "ONLINE" }).success).toBe(false);
  });

  it("rejects invalid payment method", () => {
    expect(createOrderSchema.safeParse({ ...validOrder, paymentMethod: "CRYPTO" }).success).toBe(false);
  });
});

describe("boucherActionSchema", () => {
  it("accepts valid accept action", () => {
    const result = boucherActionSchema.safeParse({ action: "accept", estimatedMinutes: 15 });
    expect(result.success).toBe(true);
  });

  it("rejects accept without estimatedMinutes", () => {
    const result = boucherActionSchema.safeParse({ action: "accept" });
    expect(result.success).toBe(false);
  });

  it("rejects accept with estimatedMinutes > 480", () => {
    const result = boucherActionSchema.safeParse({ action: "accept", estimatedMinutes: 500 });
    expect(result.success).toBe(false);
  });

  it("accepts valid deny action", () => {
    const result = boucherActionSchema.safeParse({ action: "deny", reason: "Rupture de stock" });
    expect(result.success).toBe(true);
  });

  it("rejects deny without reason", () => {
    const result = boucherActionSchema.safeParse({ action: "deny" });
    expect(result.success).toBe(false);
  });

  it("accepts mark_ready with no extra fields", () => {
    const result = boucherActionSchema.safeParse({ action: "mark_ready" });
    expect(result.success).toBe(true);
  });

  it("accepts confirm_pickup with valid UUID", () => {
    const result = boucherActionSchema.safeParse({
      action: "confirm_pickup",
      qrCode: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects confirm_pickup with invalid UUID", () => {
    const result = boucherActionSchema.safeParse({ action: "confirm_pickup", qrCode: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown action type", () => {
    const result = boucherActionSchema.safeParse({ action: "explode" });
    expect(result.success).toBe(false);
  });

  it("accepts adjust_weight with valid items", () => {
    const result = boucherActionSchema.safeParse({
      action: "adjust_weight",
      items: [{ orderItemId: "item1", actualWeightGrams: 520 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects adjust_weight with 0 weight", () => {
    const result = boucherActionSchema.safeParse({
      action: "adjust_weight",
      items: [{ orderItemId: "item1", actualWeightGrams: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("createProductSchema", () => {
  const validProduct = {
    name: "Entrecôte Black Angus",
    priceCents: 2990,
    unit: "KG" as const,
    categoryIds: ["clxyz123456789abcdef12345"],
    shopId: "clxyz123456789abcdef12346",
  };

  it("accepts valid product", () => {
    const result = createProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("rejects product without name", () => {
    const result = createProductSchema.safeParse({ ...validProduct, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = createProductSchema.safeParse({ ...validProduct, priceCents: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid unit", () => {
    const result = createProductSchema.safeParse({ ...validProduct, unit: "LITRE" });
    expect(result.success).toBe(false);
  });

  it("rejects empty categoryIds", () => {
    const result = createProductSchema.safeParse({ ...validProduct, categoryIds: [] });
    expect(result.success).toBe(false);
  });

  it("accepts optional promo fields", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      promoPct: 20,
      promoType: "PERCENTAGE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects promoPct over 99", () => {
    const result = createProductSchema.safeParse({ ...validProduct, promoPct: 100 });
    expect(result.success).toBe(false);
  });
});

describe("enableAntiGaspiSchema", () => {
  it("accepts valid anti-gaspi config", () => {
    const result = enableAntiGaspiSchema.safeParse({
      productId: "prod1",
      discountPercent: 30,
      antiGaspiStock: 5,
      reason: "DLC_PROCHE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects discount below 5%", () => {
    const result = enableAntiGaspiSchema.safeParse({ productId: "prod1", discountPercent: 3 });
    expect(result.success).toBe(false);
  });

  it("rejects discount above 80%", () => {
    const result = enableAntiGaspiSchema.safeParse({ productId: "prod1", discountPercent: 90 });
    expect(result.success).toBe(false);
  });
});

describe("toggleStockSchema", () => {
  it("accepts valid toggle", () => {
    expect(toggleStockSchema.safeParse({ inStock: true }).success).toBe(true);
    expect(toggleStockSchema.safeParse({ inStock: false }).success).toBe(true);
  });

  it("rejects missing inStock", () => {
    expect(toggleStockSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-boolean inStock", () => {
    expect(toggleStockSchema.safeParse({ inStock: "yes" }).success).toBe(false);
  });
});

describe("rateOrderSchema", () => {
  it("accepts valid rating", () => {
    const result = rateOrderSchema.safeParse({ rating: 4, comment: "Très bien" });
    expect(result.success).toBe(true);
  });

  it("rejects rating below 1", () => {
    expect(rateOrderSchema.safeParse({ rating: 0 }).success).toBe(false);
  });

  it("rejects rating above 5", () => {
    expect(rateOrderSchema.safeParse({ rating: 6 }).success).toBe(false);
  });
});

describe("toggleFavoriteSchema", () => {
  it("accepts valid CUID userId and shopId", () => {
    expect(toggleFavoriteSchema.safeParse({
      userId: "clxyz123456789abcdef12345",
      shopId: "clxyz123456789abcdef12346",
    }).success).toBe(true);
  });

  it("rejects empty shopId", () => {
    expect(toggleFavoriteSchema.safeParse({
      userId: "clxyz123456789abcdef12345",
      shopId: "",
    }).success).toBe(false);
  });

  it("rejects non-CUID shopId", () => {
    expect(toggleFavoriteSchema.safeParse({
      userId: "clxyz123456789abcdef12345",
      shopId: "shop123",
    }).success).toBe(false);
  });

  it("rejects missing userId", () => {
    expect(toggleFavoriteSchema.safeParse({
      shopId: "clxyz123456789abcdef12345",
    }).success).toBe(false);
  });
});
