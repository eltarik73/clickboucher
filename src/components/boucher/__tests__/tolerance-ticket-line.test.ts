// @vitest-environment node
// The line of the kitchen ticket that states the weighing tolerance the customer accepted, frozen
// on his order: the terms and the amount they allow on this order. Orders created before the
// tolerance existed print nothing (no tolerance: every increase needs his yes).
import { describe, expect, it } from "vitest";
import { toleranceTicketLine } from "@/components/boucher/tolerance-ticket-line";

describe("toleranceTicketLine", () => {
  it("states the STANDARD terms and the amount they allow on a small order", () => {
    const line = toleranceTicketLine({
      weighToleranceRateBps: 500,
      weighToleranceCapCents: 1000,
      estimatedTotalCents: 2450,
    });

    expect(line).toBe(
      "Marge de pesée acceptée : 5 % du total estimé, 10,00 € au plus (jusqu'à 1,22 €)"
    );
  });

  it("caps the STANDARD amount at 10,00 € on a large order", () => {
    const line = toleranceTicketLine({
      weighToleranceRateBps: 500,
      weighToleranceCapCents: 1000,
      estimatedTotalCents: 48_000,
    });

    expect(line).toBe(
      "Marge de pesée acceptée : 5 % du total estimé, 10,00 € au plus (jusqu'à 10,00 €)"
    );
  });

  it("states the EXTENDED terms, capped at 20,00 €", () => {
    expect(
      toleranceTicketLine({
        weighToleranceRateBps: 1000,
        weighToleranceCapCents: 2000,
        estimatedTotalCents: 8_990,
      })
    ).toBe("Marge de pesée acceptée : 10 % du total estimé, 20,00 € au plus (jusqu'à 8,99 €)");
    expect(
      toleranceTicketLine({
        weighToleranceRateBps: 1000,
        weighToleranceCapCents: 2000,
        estimatedTotalCents: 31_000,
      })
    ).toBe("Marge de pesée acceptée : 10 % du total estimé, 20,00 € au plus (jusqu'à 20,00 €)");
  });

  it("prints nothing for an order created before the tolerance existed", () => {
    expect(
      toleranceTicketLine({
        weighToleranceRateBps: null,
        weighToleranceCapCents: null,
        estimatedTotalCents: null,
      })
    ).toBeNull();
    expect(toleranceTicketLine({})).toBeNull();
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
