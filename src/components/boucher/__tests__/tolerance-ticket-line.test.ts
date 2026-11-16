// @vitest-environment node
// The line of the kitchen ticket that states the weighing tolerance the customer accepted, frozen
// on his order: the terms and the amount they allow on this order, printed under the totals.
// Orders without a frozen tolerance print nothing (every increase needs the customer's yes).
import { describe, expect, it } from "vitest";
import { buildTicketHtml } from "@/components/boucher/OrderTicket";
import { toleranceTicketLine } from "@/components/boucher/tolerance-ticket-line";
import { kitchenOrder } from "./kitchen-order-fixtures";

const NO_TOLERANCE = {
  weighToleranceRateBps: null,
  weighToleranceCapCents: null,
  estimatedTotalCents: null,
};

describe("toleranceTicketLine", () => {
  it("states the STANDARD terms and the amount they allow on a small order", () => {
    const line = toleranceTicketLine({
      weighToleranceRateBps: 500,
      weighToleranceCapCents: 1000,
      estimatedTotalCents: 2450,
    });

    expect(line).toBe(
      "Marge de pesée acceptée : 5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus (jusqu'à 1,22 €)"
    );
  });

  it("caps the STANDARD amount at 10,00 € on a large order", () => {
    const line = toleranceTicketLine({
      weighToleranceRateBps: 500,
      weighToleranceCapCents: 1000,
      estimatedTotalCents: 48_000,
    });

    expect(line).toBe(
      "Marge de pesée acceptée : 5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus (jusqu'à 10,00 €)"
    );
  });

  it("states the EXTENDED terms, capped at 20,00 €", () => {
    expect(
      toleranceTicketLine({
        weighToleranceRateBps: 1000,
        weighToleranceCapCents: 2000,
        estimatedTotalCents: 8_990,
      })
    ).toBe(
      "Marge de pesée acceptée : 10\u00a0% du total estimé, 20,00\u00a0€ au\u00a0plus (jusqu'à 8,99 €)"
    );
    expect(
      toleranceTicketLine({
        weighToleranceRateBps: 1000,
        weighToleranceCapCents: 2000,
        estimatedTotalCents: 31_000,
      })
    ).toBe(
      "Marge de pesée acceptée : 10\u00a0% du total estimé, 20,00\u00a0€ au\u00a0plus (jusqu'à 20,00 €)"
    );
  });

  it("prints nothing for an order created before the tolerance existed", () => {
    expect(toleranceTicketLine(NO_TOLERANCE)).toBeNull();
  });

  it("prints nothing when only part of the frozen terms is present", () => {
    expect(
      toleranceTicketLine({
        weighToleranceRateBps: 500,
        weighToleranceCapCents: 1000,
        estimatedTotalCents: null,
      })
    ).toBeNull();
  });
});

describe("the kitchen ticket", () => {
  it("prints the weighing tolerance frozen on the order under the totals, escaped", () => {
    const ticket = buildTicketHtml(kitchenOrder(), "Boucherie Test");

    expect(ticket).toMatch(
      /<div class="totals">[\s\S]*<div class="tolerance">Marge de pesée acceptée : 5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus \(jusqu&#39;à 1,22 €\)<\/div>\s*<\/div>/
    );
  });

  it("prints no tolerance line for an order created before it existed", () => {
    const ticket = buildTicketHtml(kitchenOrder(NO_TOLERANCE), "Boucherie Test");

    expect(ticket).not.toContain('class="tolerance"');
  });
});
