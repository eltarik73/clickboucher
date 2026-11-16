// Where the last price adjustment of an order stands, on its kitchen card: waiting for the customer
// with the time he has left (counted after mount, the board refreshes the rest), applied, accepted,
// or closed unapplied with the reason the server recorded and what the butcher can do next.
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import AdjustmentStatusLine from "@/components/boucher/AdjustmentStatusLine";

type Adjustment = NonNullable<KitchenOrder["priceAdjustment"]>;

const NOW = new Date("2026-11-15T10:00:00.000Z");

function adjustment(overrides: Partial<Adjustment>): Adjustment {
  return {
    id: "adj-1",
    originalTotal: 2450,
    newTotal: 2650,
    reason: null,
    adjustmentType: "WEIGHT",
    status: "PENDING",
    answerBy: null,
    closeReason: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AdjustmentStatusLine", () => {
  it("counts down to the customer's deadline, then says it has passed", () => {
    vi.useFakeTimers({ now: NOW });
    const answerBy = new Date(NOW.getTime() + 4 * 60_000 + 5_000).toISOString();
    render(<AdjustmentStatusLine adjustment={adjustment({ answerBy })} />);

    expect(screen.getByText("En attente du client")).toBeInTheDocument();
    expect(screen.getByText("24,50 € → 26,50 €")).toBeInTheDocument();
    expect(screen.getByText("4:05 pour répondre")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("4:04 pour répondre")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4 * 60_000 + 4_000));
    expect(screen.getByText("délai écoulé")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renders no time on the server: the countdown starts after mount", () => {
    const answerBy = new Date(NOW.getTime() + 60_000).toISOString();
    const html = renderToString(<AdjustmentStatusLine adjustment={adjustment({ answerBy })} />);

    expect(html).toContain("En attente du client");
    expect(html).not.toContain("pour répondre");
  });

  it("shows no time for a pending row without a stored deadline", () => {
    render(<AdjustmentStatusLine adjustment={adjustment({ answerBy: null })} />);

    expect(screen.getByText("En attente du client")).toBeInTheDocument();
    expect(screen.queryByText(/pour répondre|délai écoulé/)).toBeNull();
  });

  it.each<[Adjustment["status"], string]>([
    ["AUTO_APPROVED", "Prix ajusté (26,50 €)"],
    ["AUTO_VALIDATED", "Prix ajusté (26,50 €)"],
    ["APPROVED", "Accepté par le client (26,50 €)"],
  ])("%s: %s", (status, text) => {
    render(<AdjustmentStatusLine adjustment={adjustment({ status })} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each<[Adjustment["closeReason"], string]>([
    [
      "CUSTOMER_REFUSED",
      "Refusé par le client — prix inchangé. Repesez dans sa marge ou retirez l'article.",
    ],
    [
      "NO_ANSWER",
      "Sans réponse du client — prix inchangé. Repesez dans sa marge ou retirez l'article.",
    ],
    ["ORDER_CHANGED", "Ajustement annulé : la commande a changé."],
    [null, "Ajustement annulé : la commande a changé."],
  ])("REJECTED with closeReason %s", (closeReason, text) => {
    render(<AdjustmentStatusLine adjustment={adjustment({ status: "REJECTED", closeReason })} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows nothing for an adjustment escalated under the former rule", () => {
    const { container } = render(
      <AdjustmentStatusLine adjustment={adjustment({ status: "ESCALATED" })} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
