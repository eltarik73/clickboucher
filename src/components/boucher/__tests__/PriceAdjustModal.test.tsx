// The butcher's price adjustment window: before sending, it shows the plan of the server's own
// planner (whether the new price applies at once or needs the customer's yes, or which value is
// typed wrong), names its button accordingly, sends only the lines he changed, never judges the
// platform's cap (the server applies the stored one), and closes only once the server took it.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import PriceAdjustModal from "@/components/boucher/PriceAdjustModal";
import { BREAD, kitchenLine, kitchenOrder, MERGUEZ } from "./kitchen-order-fixtures";

afterEach(cleanup);

function open(onConfirm = vi.fn(async () => true), order: KitchenOrder = kitchenOrder()) {
  const onClose = vi.fn();
  render(<PriceAdjustModal order={order} onClose={onClose} onConfirm={onConfirm} />);
  return { onClose, onConfirm };
}

const weighField = (name = "Merguez") => screen.getByLabelText(`Quantité pesée pour ${name}`);

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

  // 24,50 € -> 34,30 € (+40 %) and 39,20 € (+60 %): the platform's cap, 30 % or 50 % as stored by
  // the webmaster, is the server's to apply; its refusal reaches the kitchen page's toast.
  it.each([
    ["+40 %", "1,49", "+9,80 €"],
    ["+60 %", "1,735", "+14,70 €"],
  ])("lets the butcher send a %s weighing: no cap is judged in the window", (_, kg, step) => {
    open();

    fireEvent.change(weighField(), { target: { value: kg } });

    expect(screen.getByText("Écart de cet ajustement").nextElementSibling).toHaveTextContent(step);
    expect(document.body.textContent).not.toMatch(/ne peut pas dépasser/);
    expect(screen.getByRole("button", { name: "Demander l'accord du client" })).toBeEnabled();
  });

  it("sends a weighing that moves two lines and keeps the total", async () => {
    const cote = kitchenLine({
      id: "d",
      name: "Côte de bœuf",
      unit: "KG",
      quantity: 1,
      weightGrams: 1000,
      priceCents: 2000,
      totalCents: 2000,
      estimatedPriceCents: 2000,
    });
    const order = kitchenOrder({
      totalCents: 4450,
      estimatedTotalCents: 4450,
      items: [MERGUEZ, cote, BREAD],
    });
    const { onConfirm } = open(undefined, order);

    fireEvent.change(weighField(), { target: { value: "1,05" } });
    fireEvent.change(weighField("Côte de bœuf"), { target: { value: "0,95" } });
    expect(screen.getByText("Écart de cet ajustement").nextElementSibling).toHaveTextContent(
      "0,00 €"
    );
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("order-1", {
        adjustmentType: "WEIGHT",
        items: [
          { orderItemId: "a", newQuantity: 1.05 },
          { orderItemId: "d", newQuantity: 0.95 },
        ],
        reason: undefined,
      })
    );
  });

  it("judges a second weighing on the increase since the order, and shows both figures", () => {
    // Merguez already weighed at 1,05 kg (+1,00 €, within the tolerance); now 1,08 kg: this step
    // is +0,60 €, but 1,60 € above its estimate is beyond the 1,22 € the customer accepted.
    const weighedOnce = kitchenOrder({
      totalCents: 2550,
      items: [{ ...MERGUEZ, quantity: 1.05, totalCents: 2100 }, BREAD],
    });
    open(undefined, weighedOnce);

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

  it("names the line typed wrong with the server's sentence, marks it and sends nothing", () => {
    const { onConfirm } = open();

    fireEvent.change(weighField(), { target: { value: "abc" } });

    expect(
      screen.getByText(
        "Merguez : Quantité invalide : poids en grammes entiers, nombre entier pour les pièces"
      )
    ).toBeInTheDocument();
    expect(weighField()).toHaveAttribute("aria-invalid", "true");
    expect(weighField("Pain")).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
