// @vitest-environment node
//
// The order request carries the customer's choice of weighing tolerance, a choice and never an
// amount: the rate, the cap and the estimated total are decided by the server (src/lib/pricing/
// tolerance.ts). Online payment stays refused.
import { describe, expect, it } from "vitest";
import { createOrderSchema, orderQuoteRequestSchema } from "@/lib/validators/order";

const ONLINE_REFUSED =
  "Le paiement en ligne n'est pas encore disponible. Réglez sur place au retrait.";

function request(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    shopId: "clshop0000000000000000001",
    items: [{ productId: "clprod000000000000000001", quantity: 2 }],
    paymentMethod: "ON_PICKUP",
    idempotencyKey: "6f1c1f3e-8d2a-4b8e-9a51-0f7c2d3e4a5b",
    expectedTotalCents: 2580,
    ...extra,
  };
}

function issuesOf(body: Record<string, unknown>) {
  const parsed = createOrderSchema.safeParse(body);
  return parsed.success ? [] : parsed.error.issues;
}

describe("createOrderSchema: weighTolerance", () => {
  it.each(["STANDARD", "EXTENDED"])("accepts the choice %s", (choice) => {
    const parsed = createOrderSchema.safeParse(request({ weighTolerance: choice }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.weighTolerance).toBe(choice);
  });

  it("accepts a request without a choice (the server then reads the saved one)", () => {
    const parsed = createOrderSchema.safeParse(request());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.weighTolerance).toBeUndefined();
  });

  it.each([["standard"], ["PREMIUM"], [""], [null], [500], [true], [{ rateBps: 500 }]])(
    "refuses %o",
    (value) => {
      const issues = issuesOf(request({ weighTolerance: value }));
      expect(issues.map((issue) => issue.path.join("."))).toEqual(["weighTolerance"]);
    }
  );

  it.each([
    "weighToleranceRateBps",
    "weighToleranceCapCents",
    "estimatedTotalCents",
    "toleranceCents",
  ])("refuses the amount-like field %s", (field) => {
    const issues = issuesOf(request({ weighTolerance: "STANDARD", [field]: 1000 }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "unrecognized_keys", keys: [field] });
  });
});

describe("online payment stays refused", () => {
  it("createOrderSchema refuses ONLINE with the French message, whatever the tolerance", () => {
    for (const weighTolerance of ["STANDARD", "EXTENDED", undefined]) {
      const issues = issuesOf(request({ paymentMethod: "ONLINE", weighTolerance }));
      expect(issues).toHaveLength(1);
      expect(issues[0].path).toEqual(["paymentMethod"]);
      expect(issues[0].message).toBe(ONLINE_REFUSED);
    }
  });

  it("the quote schema refuses ONLINE with the same message", () => {
    const parsed = orderQuoteRequestSchema.safeParse({
      shopId: "clshop0000000000000000001",
      items: [{ productId: "clprod000000000000000001", quantity: 2 }],
      paymentMethod: "ONLINE",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.success ? null : parsed.error.issues[0].message).toBe(ONLINE_REFUSED);
  });
});

describe("the quote request is unchanged", () => {
  it("does not take a tolerance choice: the cart computes the displayed amount itself", () => {
    const parsed = orderQuoteRequestSchema.safeParse({
      shopId: "clshop0000000000000000001",
      items: [{ productId: "clprod000000000000000001", quantity: 2 }],
      paymentMethod: "ON_PICKUP",
      weighTolerance: "STANDARD",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.success ? null : parsed.error.issues[0]).toMatchObject({
      code: "unrecognized_keys",
      keys: ["weighTolerance"],
    });
  });
});
