// The butcher's price adjustment window: before sending, it says whether the new price applies at
// once or needs the customer's yes (same rule as the server), names its button accordingly, sends
// only the lines he changed, and closes only once the server took the adjustment.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import PriceAdjustModal from "@/components/boucher/PriceAdjustModal";

afterEach(cleanup);

type Item = KitchenOrder["items"][number];

function line(overrides: Partial<Item> & Pick<Item, "id" | "name">): Item {
  return {
    productId: `product-${overrides.id}`,
    quantity: 1,
    unit: "PIECE",
    priceCents: 450,
    totalCents: 450,
    estimatedPriceCents: 450,
    weightGrams: null,
    sliceCount: null,
    sliceThickness: null,
    variant: null,
    pieceCount: null,
    pieceLabel: null,
    cutOption: null,
    available: true,
    ...overrides,
  };
}

// 24,50 € estimated, STANDARD tolerance: up to 1,22 € of weighing increase without asking.
const ORDER: KitchenOrder = {
  id: "order-1",
  orderNumber: "KG26-000201",
  displayNumber: "#021",
  status: "PREPARING",
  totalCents: 2450,
  discountCents: 0,
  weighToleranceRateBps: 500,
  weighToleranceCapCents: 1000,
  estimatedTotalCents: 2450,
  customerNumber: null,
  isPro: false,
  customerNote: null,
  requestedTime: null,
  estimatedReady: null,
  actualReady: null,
  qrCode: null,
  paymentMethod: "ON_PICKUP",
  pickupSlotStart: null,
  createdAt: "2026-11-15T10:00:00.000Z",
  updatedAt: "2026-11-15T10:00:00.000Z",
  items: [
    line({
      id: "a",
      name: "Merguez",
      unit: "KG",
      quantity: 1,
      weightGrams: 500,
      priceCents: 2000,
      totalCents: 2000,
      estimatedPriceCents: 2000,
    }),
    line({ id: "b", name: "Pain" }),
    line({ id: "c", name: "Barquette épuisée", unit: "BARQUETTE", available: false }),
  ],
  user: { firstName: "Zoé", lastName: "Martin" },
  priceAdjustment: null,
};

function open(onConfirm = vi.fn(async () => true)) {
  const onClose = vi.fn();
  render(<PriceAdjustModal order={ORDER} onClose={onClose} onConfirm={onConfirm} />);
  return { onClose, onConfirm };
}

const weighField = () => screen.getByLabelText("Quantité pesée pour Merguez");

describe("PriceAdjustModal", () => {
  it("opens on the weighing, out-of-stock lines left out, nothing to send yet", () => {
    open();

    expect(screen.getByRole("dialog", { name: "Ajuster le prix · #021" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Quantité pesée pour Barquette épuisée")).toBeNull();
    expect(
      screen.getByText("Remettez au client le ticket de pesée (poids et prix).")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeDisabled();
    expect(document.body.textContent).not.toMatch(/palier|30\s?s\b|escalad/i);
  });

  it("applies a weighing within the tolerance and closes once the server took it", async () => {
    const { onClose, onConfirm } = open();

    fireEvent.change(weighField(), { target: { value: "1,05" } });
    expect(
      screen.getByText("Dans la marge de pesée du client : appliqué sans le déranger.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hausse cumulée depuis la commande : 1,00 €, marge du client : 1,22 €")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith("order-1", {
      adjustmentType: "WEIGHT",
      items: [{ orderItemId: "a", newQuantity: 1.05 }],
      reason: undefined,
    });
  });

  it("asks the customer beyond the tolerance, and says so on its button", () => {
    open();

    fireEvent.change(weighField(), { target: { value: "1.2" } });

    expect(
      screen.getByText(
        "Au-delà de la marge de pesée du client : il doit accepter. " +
          "Sans réponse sous 5 minutes, le prix ne change pas."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Demander l'accord du client" })).toBeEnabled();
  });

  it("judges a second weighing on the increase since the order, and shows both figures", () => {
    // Merguez already weighed at 1,05 kg (+1,00 €, within the tolerance); now 1,08 kg: this step
    // is +0,60 €, but 1,60 € since the order is beyond the 1,22 € the customer accepted.
    const [merguez, ...others] = ORDER.items;
    const weighedOnce: KitchenOrder = {
      ...ORDER,
      totalCents: 2550,
      items: [{ ...merguez, quantity: 1.05, totalCents: 2100 }, ...others],
    };
    render(<PriceAdjustModal order={weighedOnce} onClose={vi.fn()} onConfirm={vi.fn()} />);

    fireEvent.change(weighField(), { target: { value: "1,08" } });

    const step = screen.getByText("Écart de cet ajustement").nextElementSibling;
    expect(step).toHaveTextContent("+0,60 €");
    expect(
      screen.getByText("Hausse cumulée depuis la commande : 1,60 €, marge du client : 1,22 €")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Demander l'accord du client" })).toBeEnabled();
  });

  it("asks the customer for a higher total typed by hand, with the butcher's reason", async () => {
    const { onConfirm } = open();

    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    fireEvent.change(screen.getByLabelText("Nouveau total de la commande"), {
      target: { value: "25,00" },
    });
    fireEvent.change(screen.getByLabelText("Motif (facultatif, le client le lit)"), {
      target: { value: " Pièce plus grosse " },
    });
    expect(screen.getByText("Hausse hors pesée : le client doit accepter.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Demander l'accord du client" }));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("order-1", {
        adjustmentType: "MANUAL",
        newTotalCents: 2500,
        reason: "Pièce plus grosse",
      })
    );
  });

  it("stays open when the server refuses the adjustment", async () => {
    const onConfirm = vi.fn(async () => false);
    const { onClose } = open(onConfirm);

    fireEvent.change(weighField(), { target: { value: "0,9" } });
    expect(
      screen.getByText("Baisse de prix : appliquée tout de suite, le client est prévenu.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeEnabled();
  });

  it("names the line typed wrong and sends nothing", () => {
    open();

    fireEvent.change(weighField(), { target: { value: "1,0505" } });

    expect(
      screen.getByText("Merguez : quantité invalide (poids au gramme près, pièces sans décimale)")
    ).toBeInTheDocument();
    expect(weighField()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeDisabled();
  });

  it("refuses more than the platform's cap before sending", () => {
    open();

    fireEvent.change(weighField(), { target: { value: "1,9" } });

    expect(
      screen.getByText("L'ajustement ne peut pas dépasser +50 % du total actuel (36,75 € au plus).")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Demander l'accord du client" })).toBeDisabled();
  });
});
