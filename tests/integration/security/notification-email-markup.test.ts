// @vitest-environment node
// The e-mails of src/lib/notifications.ts print what a butcher typed (his shop's name, a
// promotion's label or code) as text, on a real PostgreSQL: a shop renamed
// `<a href="https://evil.example">Payer ici</a>` puts no link in a customer's e-mail. Only the
// outgoing transports are simulated.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { sendEmail } from "@/lib/email";
import { sendNotification, type NotifData, type NotifEvent } from "@/lib/notifications";
import { useCleanDatabase } from "../helpers/db";
import { createTestShop, createTestUser } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const MARKUP = '<a href="https://evil.example">Payer ici</a>';
const MARKUP_AS_TEXT = "&lt;a href=&quot;https://evil.example&quot;&gt;Payer ici&lt;/a&gt;";

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
});

async function emailOf(event: NotifEvent, data: Omit<NotifData, "userId" | "shopId">) {
  const customer = await createTestUser();
  const shop = await createTestShop({ name: MARKUP });

  const result = await sendNotification(event, {
    ...data,
    userId: customer.id,
    shopId: shop.id,
    shopName: shop.name,
  });

  expect(result.channels).toContain("email");
  const [[, , html]] = vi.mocked(sendEmail).mock.calls;
  return html;
}

describe("inline e-mails of the notification service", () => {
  it.each<[string, NotifEvent, Omit<NotifData, "userId" | "shopId">]>([
    [
      "FLASH_OFFER: shop name, label and code",
      "FLASH_OFFER",
      { promoLabel: MARKUP, promoCode: MARKUP },
    ],
    ["PROMO_NEW: label and code", "PROMO_NEW", { promoLabel: MARKUP, promoCode: MARKUP }],
    [
      "LOYALTY_REWARD_EARNED: amount and code",
      "LOYALTY_REWARD_EARNED",
      { rewardAmount: MARKUP, rewardCode: MARKUP },
    ],
    ["LOYALTY_REWARD_EARNED: message", "LOYALTY_REWARD_EARNED", { message: MARKUP }],
  ])("%s made of markup are printed as text", async (_case, event, data) => {
    const html = await emailOf(event, data);

    expect(html).toContain(MARKUP_AS_TEXT);
    expect(html).not.toContain(MARKUP);
  });
});

describe("price adjustment e-mails", () => {
  it.each<[NotifEvent, string]>([
    ["PRICE_ADJUSTMENT_PENDING", "Répondez dans les 5 minutes"],
    ["PRICE_ADJUSTMENT_AUTO_APPROVED", "Prix ajusté après la pesée : 18,00 €"],
    ["PRICE_ADJUSTMENT_ACCEPTED", "nouveau total 18,00 €"],
    ["PRICE_ADJUSTMENT_REJECTED", "Le client a refusé : le prix de la commande"],
    ["PRICE_ADJUSTMENT_EXPIRED", "Le client n&#39;a pas répondu : le prix de la commande"],
  ])("%s prints the order number as text and says the real rule", async (event, rule) => {
    const html = await emailOf(event, {
      orderNumber: MARKUP,
      originalTotal: 1500,
      newTotal: 1800,
    });

    expect(html).toContain(MARKUP_AS_TEXT);
    expect(html).not.toContain(MARKUP);
    expect(html).toContain(rule);
    expect(html).not.toMatch(/validé automatiquement|à la baisse|escalad/i);
  });

  it("a decrease applied without asking says the price went down", async () => {
    const html = await emailOf("PRICE_ADJUSTMENT_AUTO_APPROVED", {
      orderNumber: "KG26-000001",
      originalTotal: 1800,
      newTotal: 1500,
    });

    expect(html).toContain("Le prix de votre commande a baissé : 15,00 €");
  });

  it("a shop whose customer did not answer is told the price stays", async () => {
    const html = await emailOf("PRICE_ADJUSTMENT_EXPIRED", {
      orderNumber: "KG26-000001",
      originalTotal: 1500,
      newTotal: 1800,
    });

    expect(html).toContain("reste à 15,00 €");
    expect(html).toContain("Repesez dans sa marge ou retirez l&#39;article.");
  });
});
