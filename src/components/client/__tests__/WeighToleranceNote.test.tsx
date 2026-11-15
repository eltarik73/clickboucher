// The weighing tolerance the customer accepted, under the total of his order on /suivi and
// /commande: its terms and the amount they allow on this order; nothing for an order without a
// frozen tolerance.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WeighToleranceNote from "@/components/client/WeighToleranceNote";

afterEach(cleanup);

const STANDARD_ON_24_50 = {
  weighToleranceRateBps: 500,
  weighToleranceCapCents: 1000,
  estimatedTotalCents: 2450,
};

describe("WeighToleranceNote", () => {
  it("states the STANDARD terms and what they allow on a 24,50 € order", () => {
    const { container } = render(<WeighToleranceNote order={STANDARD_ON_24_50} />);

    // The exact text: the no-break spaces of the terms are part of what is shown.
    expect(container.textContent).toBe(
      "Marge de pesée acceptée : 5\u00a0% du total estimé, 10,00\u00a0€ au\u00a0plus, " +
        "soit jusqu'à 1,22 € sur cette commande."
    );
  });

  it.each(["weighToleranceRateBps", "weighToleranceCapCents", "estimatedTotalCents"] as const)(
    "shows nothing when %s is null",
    (column) => {
      const { container } = render(
        <WeighToleranceNote order={{ ...STANDARD_ON_24_50, [column]: null }} />
      );

      expect(container).toBeEmptyDOMElement();
    }
  );
});
