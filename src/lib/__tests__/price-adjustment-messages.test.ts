// @vitest-environment node
// Phrases des notifications d'ajustement de prix : la vraie règle (5 minutes, le silence ne change
// pas le prix, la marge choisie), jamais « validé automatiquement » ni un montant manquant écrit
// 0,00 €.
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_ANSWER_NOTICE,
  ADJUSTMENT_KEPT_PRICE,
  adjustmentAmount,
  adjustmentAppliedText,
} from "@/lib/price-adjustment-messages";

describe("price adjustment messages", () => {
  it("names the real answer window and says silence keeps the price", () => {
    expect(ADJUSTMENT_ANSWER_NOTICE).toBe(
      "Répondez dans les 5 minutes. Sans réponse de votre part, le prix ne change pas."
    );
  });

  it("tells a decrease from an increase applied within the customer's tolerance", () => {
    expect(adjustmentAppliedText({ originalTotal: 2000, newTotal: 1990 })).toBe(
      "Le prix de votre commande a baissé : 19,90 €"
    );
    expect(adjustmentAppliedText({ originalTotal: 2000, newTotal: 2100 })).toBe(
      "Prix ajusté après la pesée : 21,00 €, dans la marge que vous avez choisie."
    );
  });

  it.each([
    [
      "PRICE_ADJUSTMENT_REJECTED",
      "❌ Ajustement refusé",
      "Le client a refusé : le prix de la commande #KG26-000166 reste à 1234,56 €. Repesez dans sa marge ou retirez l'article.",
    ],
    [
      "PRICE_ADJUSTMENT_EXPIRED",
      "⏱ Pas de réponse du client",
      "Le client n'a pas répondu : le prix de la commande #KG26-000166 reste à 1234,56 €. Repesez dans sa marge ou retirez l'article.",
    ],
  ] as const)("%s tells the shop the price stays: %s", (event, title, text) => {
    const data = { orderNumber: "KG26-000166", originalTotal: 123456, newTotal: 130000 };

    expect(ADJUSTMENT_KEPT_PRICE[event].title).toBe(title);
    expect(ADJUSTMENT_KEPT_PRICE[event].text(data)).toBe(text);
  });

  it("refuses to print a missing amount instead of writing 0,00 €", () => {
    expect(() => adjustmentAmount(undefined, "newTotal")).toThrow(/newTotal/);
    expect(() => adjustmentAppliedText({ newTotal: 1000 })).toThrow(/originalTotal/);
    expect(() =>
      ADJUSTMENT_KEPT_PRICE.PRICE_ADJUSTMENT_EXPIRED.text({ orderNumber: "KG26-000001" })
    ).toThrow(/originalTotal/);
  });
});
