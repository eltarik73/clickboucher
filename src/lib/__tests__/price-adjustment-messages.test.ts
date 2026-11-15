// @vitest-environment node
// Phrases des notifications d'ajustement de prix : la vraie règle (5 minutes, le silence ne change
// pas le prix, la marge choisie), jamais « validé automatiquement » ni un montant manquant écrit
// 0,00 €.
import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_ANSWER_NOTICE,
  adjustmentAmount,
  adjustmentAppliedText,
  adjustmentKeptPriceText,
} from "@/lib/price-adjustment-messages";
import { ADJUSTMENT_ANSWER_WINDOW_SECONDS } from "@/lib/pricing/tolerance";

describe("price adjustment messages", () => {
  it("names the real answer window and says silence keeps the price", () => {
    expect(ADJUSTMENT_ANSWER_WINDOW_SECONDS).toBe(300);
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

  it("tells the shop the price stays, after a refusal or a silence", () => {
    const data = { orderNumber: "KG26-000166", originalTotal: 123456, newTotal: 130000 };

    expect(adjustmentKeptPriceText(data, true)).toBe(
      "Le client a refusé : le prix de la commande #KG26-000166 reste à 1234,56 €. Repesez dans sa marge ou retirez l'article."
    );
    expect(adjustmentKeptPriceText(data, false)).toMatch(/^Le client n'a pas répondu : /);
  });

  it("refuses to print a missing amount instead of writing 0,00 €", () => {
    expect(() => adjustmentAmount(undefined, "newTotal")).toThrow(/newTotal/);
    expect(() => adjustmentAppliedText({ newTotal: 1000 })).toThrow(/originalTotal/);
    expect(() => adjustmentKeptPriceText({ orderNumber: "KG26-000001" }, false)).toThrow(
      /originalTotal/
    );
  });
});
