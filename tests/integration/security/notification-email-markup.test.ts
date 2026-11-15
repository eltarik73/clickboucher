// @vitest-environment node
// The e-mails written inline by src/lib/notifications.ts print what a butcher typed (his shop's
// name, a promotion's label or code) as text, on a real PostgreSQL: a shop renamed
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
    [
      "PRICE_ADJUSTMENT_ESCALATED: shop name and order number",
      "PRICE_ADJUSTMENT_ESCALATED",
      { orderNumber: MARKUP, originalTotal: 1500, newTotal: 1800 },
    ],
  ])("%s made of markup are printed as text", async (_case, event, data) => {
    const html = await emailOf(event, data);

    expect(html).toContain(MARKUP_AS_TEXT);
    expect(html).not.toContain(MARKUP);
  });
});
