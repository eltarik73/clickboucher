// What the butcher reads before sending a price adjustment: one sentence per decision of
// decideAdjustment (src/lib/pricing/tolerance.ts), with the customer's tolerance in euros when it
// matters. The words never contradict the server: applied at once, or the customer must accept.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AdjustmentDecision } from "@/lib/pricing/tolerance";
import AdjustmentDecisionNotice from "@/components/boucher/AdjustmentDecisionNotice";

afterEach(cleanup);

const CASES: Array<[AdjustmentDecision, string]> = [
  [
    { decision: "APPLY", reason: "DECREASE", toleranceCents: 122, cumulatedIncreaseCents: -150 },
    "Baisse de prix : appliquée tout de suite, le client est prévenu.",
  ],
  [
    {
      decision: "APPLY",
      reason: "WITHIN_TOLERANCE",
      toleranceCents: 122,
      cumulatedIncreaseCents: 80,
    },
    "Dans la marge de pesée du client (jusqu'à 1,22 €) : appliqué sans le déranger.",
  ],
  [
    {
      decision: "ASK",
      reason: "BEYOND_TOLERANCE",
      toleranceCents: 1000,
      cumulatedIncreaseCents: 1250,
    },
    "Au-delà de la marge du client (10,00 €) : il doit accepter. " +
      "Sans réponse sous 5 minutes, le prix ne change pas.",
  ],
  [
    { decision: "ASK", reason: "NOT_WEIGHING", toleranceCents: 2000, cumulatedIncreaseCents: 0 },
    "Hausse hors pesée : le client doit accepter.",
  ],
  [
    { decision: "ASK", reason: "NO_TOLERANCE", toleranceCents: 0, cumulatedIncreaseCents: null },
    "Commande sans marge de pesée : toute hausse demande l'accord du client.",
  ],
];

describe("AdjustmentDecisionNotice", () => {
  it.each(CASES)("%o reads its exact sentence", (decision, sentence) => {
    render(<AdjustmentDecisionNotice decision={decision} />);

    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it("marks an adjustment applied at once apart from one that waits for the customer", () => {
    const { rerender } = render(<AdjustmentDecisionNotice decision={CASES[1][0]} />);
    expect(screen.getByText(CASES[1][1]).closest("[data-decision]")).toHaveAttribute(
      "data-decision",
      "APPLY"
    );

    rerender(<AdjustmentDecisionNotice decision={CASES[2][0]} />);
    expect(screen.getByText(CASES[2][1]).closest("[data-decision]")).toHaveAttribute(
      "data-decision",
      "ASK"
    );
  });

  it("names no tier, no 30-second delay and no escalation", () => {
    for (const [decision] of CASES) {
      const { container, unmount } = render(<AdjustmentDecisionNotice decision={decision} />);
      expect(container.textContent).not.toMatch(/palier|30\s?s|escalad/i);
      unmount();
    }
  });
});
