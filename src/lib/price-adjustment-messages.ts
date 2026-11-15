// src/lib/price-adjustment-messages.ts — the plain-text sentences of the price adjustment
// notifications, written once: the e-mail templates (src/lib/email-templates.ts) print them through
// escapeHtml, the push, WhatsApp and in-app messages (src/lib/notifications.ts) as they are.
// Pure: no I/O, no clock.
import { ADJUSTMENT_ANSWER_WINDOW_SECONDS } from "@/lib/pricing/tolerance";
import { formatPrice } from "@/lib/utils";

export type AdjustmentMessageData = {
  orderNumber?: string;
  originalTotal?: number;
  newTotal?: number;
};

/** An amount of the adjustment; its absence is a caller's bug, never printed as 0,00 €. */
function cents(value: number | undefined, name: string): number {
  if (value === undefined) throw new Error(`Price adjustment notification without ${name}`);
  return value;
}

/** An amount of the adjustment as written to the customer and the shop: "12,34 €". */
export function adjustmentAmount(value: number | undefined, name: string): string {
  return formatPrice(cents(value, name));
}

/** The customer's answer window (ADJUSTMENT_ANSWER_WINDOW_SECONDS), in every text that names it. */
export const ADJUSTMENT_ANSWER_NOTICE = `Répondez dans les ${ADJUSTMENT_ANSWER_WINDOW_SECONDS / 60} minutes. Sans réponse de votre part, le prix ne change pas.`;

/** What the customer learns of an adjustment applied without asking him. */
export function adjustmentAppliedText(data: AdjustmentMessageData): string {
  const newTotal = cents(data.newTotal, "newTotal");
  const price = formatPrice(newTotal);
  return newTotal < cents(data.originalTotal, "originalTotal")
    ? `Le prix de votre commande a baissé : ${price}`
    : `Prix ajusté après la pesée : ${price}, dans la marge que vous avez choisie.`;
}

function keptPriceText(who: string, data: AdjustmentMessageData): string {
  const price = adjustmentAmount(data.originalTotal, "originalTotal");
  return `${who} : le prix de la commande #${data.orderNumber ?? ""} reste à ${price}. Repesez dans sa marge ou retirez l'article.`;
}

/** What the shop learns, by event, when the customer refused or did not answer: the price stays. */
export const ADJUSTMENT_KEPT_PRICE: Record<
  "PRICE_ADJUSTMENT_REJECTED" | "PRICE_ADJUSTMENT_EXPIRED",
  { title: string; text(data: AdjustmentMessageData): string }
> = {
  PRICE_ADJUSTMENT_REJECTED: {
    title: "❌ Ajustement refusé",
    text: (data) => keptPriceText("Le client a refusé", data),
  },
  PRICE_ADJUSTMENT_EXPIRED: {
    title: "⏱ Pas de réponse du client",
    text: (data) => keptPriceText("Le client n'a pas répondu", data),
  },
};
