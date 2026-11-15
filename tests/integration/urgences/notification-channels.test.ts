// @vitest-environment node
// Canaux enregistrés sur PostgreSQL réel : un canal n'entre dans order.notifSent et ne rend la
// notification « délivrée » que si son transport a réellement envoyé. L'abonnement push n'est
// effacé que lorsque le service de push le dit disparu, jamais sur un échec passager ni sans clés
// VAPID.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import { sendWhatsAppMessage, sendWhatsAppRaw } from "@/lib/whatsapp";
import { sendNotification } from "@/lib/notifications";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const PUSH_SUBSCRIPTION = { endpoint: "https://push.itest/abc", keys: { p256dh: "p", auth: "a" } };

beforeEach(() => {
  vi.mocked(sendEmail).mockReset().mockResolvedValue(true);
  vi.mocked(sendPushNotification).mockReset().mockResolvedValue("sent");
  vi.mocked(sendWhatsAppMessage).mockReset().mockResolvedValue(true);
  vi.mocked(sendWhatsAppRaw).mockReset().mockResolvedValue(true);
});

async function acceptedOrderFor(customer: { id: string }) {
  const shop = await createTestShop({ name: "Boucherie du Lac" });
  const order = await createTestOrder({
    shopId: shop.id,
    userId: customer.id,
    overrides: { orderNumber: "KG26-000166" },
  });
  const data = {
    userId: customer.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    shopName: shop.name,
    estimatedMinutes: 20,
  };
  return { order, data };
}

async function notifSentOf(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { notifSent: true },
  });
  return order.notifSent;
}

async function notificationsOf(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

describe("e-mail", () => {
  it("un e-mail que le transport n'a pas envoyé n'est ni enregistré sur la commande ni compté délivré", async () => {
    const customer = await createTestUser();
    const { order, data } = await acceptedOrderFor(customer);
    vi.mocked(sendEmail).mockResolvedValue(false);

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(result).toEqual({ sent: false, channels: [] });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      customer.email,
      "✅ Commande KG26-000166 acceptée !",
      expect.stringContaining("KG26-000166")
    );
    expect(await notifSentOf(order.id)).toBeNull();
    const rows = await notificationsOf(customer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "ORDER_ACCEPTED", orderId: order.id, delivered: false });
  });

  // Témoin : sans lui, ne jamais enregistrer l'e-mail passerait le cas ci-dessus.
  it("un e-mail envoyé est enregistré sur la commande et la notification est délivrée", async () => {
    const customer = await createTestUser();
    const { order, data } = await acceptedOrderFor(customer);

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(result).toEqual({ sent: true, channels: ["email"] });
    const notifSent = await notifSentOf(order.id);
    expect(notifSent).toEqual([
      { event: "ORDER_ACCEPTED", channels: ["email"], at: expect.any(String) },
    ]);
    const rows = await notificationsOf(customer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "ORDER_ACCEPTED", channel: "EMAIL", delivered: true });
  });
});

describe("WhatsApp", () => {
  it.each([
    ["avec gabarit (ORDER_ACCEPTED)", "ORDER_ACCEPTED" as const, sendWhatsAppMessage],
    ["en texte libre (ORDER_PREPARING)", "ORDER_PREPARING" as const, sendWhatsAppRaw],
  ])(
    "un message %s que Twilio n'a pas envoyé n'est pas enregistré",
    async (_label, event, transport) => {
      const customer = await createTestUser({ phone: "+33612345678", notifEmail: false });
      const { order, data } = await acceptedOrderFor(customer);
      vi.mocked(transport).mockResolvedValue(false);

      const result = await sendNotification(event, data);

      expect(vi.mocked(transport)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(transport).mock.calls[0][0]).toBe("+33612345678");
      expect(result).toEqual({ sent: false, channels: [] });
      expect(await notifSentOf(order.id)).toBeNull();
      const rows = await notificationsOf(customer.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: event, delivered: false });
    }
  );

  it("un message envoyé par Twilio est enregistré", async () => {
    const customer = await createTestUser({ phone: "+33612345678", notifEmail: false });
    const { order, data } = await acceptedOrderFor(customer);

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(result).toEqual({ sent: true, channels: ["whatsapp"] });
    expect(await notifSentOf(order.id)).toEqual([
      { event: "ORDER_ACCEPTED", channels: ["whatsapp"], at: expect.any(String) },
    ]);
  });
});

describe("push", () => {
  async function subscribedCustomer() {
    return createTestUser({ notifEmail: false, pushSubscription: PUSH_SUBSCRIPTION });
  }

  async function pushSubscriptionOf(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { pushSubscription: true },
    });
    return user.pushSubscription;
  }

  async function expectNothingRecorded(orderId: string, userId: string) {
    expect(await notifSentOf(orderId)).toBeNull();
    const rows = await notificationsOf(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "ORDER_ACCEPTED", delivered: false });
  }

  it("un push envoyé est enregistré et l'abonnement est conservé", async () => {
    const customer = await subscribedCustomer();
    const { order, data } = await acceptedOrderFor(customer);

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(vi.mocked(sendPushNotification)).toHaveBeenCalledWith(
      PUSH_SUBSCRIPTION,
      expect.objectContaining({ title: "✅ Commande acceptée" })
    );
    expect(result).toEqual({ sent: true, channels: ["push"] });
    expect(await notifSentOf(order.id)).toEqual([
      { event: "ORDER_ACCEPTED", channels: ["push"], at: expect.any(String) },
    ]);
    expect(await pushSubscriptionOf(customer.id)).toEqual(PUSH_SUBSCRIPTION);
  });

  it("un abonnement disparu (404 / 410) n'est pas enregistré et il est effacé", async () => {
    const customer = await subscribedCustomer();
    const { order, data } = await acceptedOrderFor(customer);
    vi.mocked(sendPushNotification).mockResolvedValue("expired");

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(result).toEqual({ sent: false, channels: [] });
    await expectNothingRecorded(order.id, customer.id);
    expect(await pushSubscriptionOf(customer.id)).toBeNull();
  });

  it("un échec passager (500, réseau) n'est pas enregistré et l'abonnement est conservé", async () => {
    const customer = await subscribedCustomer();
    const { order, data } = await acceptedOrderFor(customer);
    vi.mocked(sendPushNotification).mockResolvedValue("failed");

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(result).toEqual({ sent: false, channels: [] });
    await expectNothingRecorded(order.id, customer.id);
    expect(await pushSubscriptionOf(customer.id)).toEqual(PUSH_SUBSCRIPTION);
  });

  it("sans clés VAPID, rien n'est enregistré et l'abonnement est conservé", async () => {
    const customer = await subscribedCustomer();
    const { order, data } = await acceptedOrderFor(customer);
    vi.mocked(sendPushNotification).mockResolvedValue("not_configured");

    const result = await sendNotification("ORDER_ACCEPTED", data);

    expect(result).toEqual({ sent: false, channels: [] });
    await expectNothingRecorded(order.id, customer.id);
    expect(await pushSubscriptionOf(customer.id)).toEqual(PUSH_SUBSCRIPTION);
  });
});
