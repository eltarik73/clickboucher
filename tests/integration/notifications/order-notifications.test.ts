// @vitest-environment node
// Notifications de commande sur PostgreSQL réel : aucune limite sur les événements transactionnels,
// limite horaire conservée pour le marketing, propriétaire résolu par clerkId ou id Prisma, et les
// deux événements ajoutés (annulation par le client, expiration).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";
import { sendNotification } from "@/lib/notifications";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestOrder, createTestShop, createTestUser } from "../helpers/factories";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const PUSH_SUBSCRIPTION = { endpoint: "https://push.itest/abc", keys: { p256dh: "p", auth: "a" } };

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  vi.mocked(sendPushNotification).mockClear();
});

async function notificationsOf(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

async function shopWithClerkOwner() {
  const owner = await createTestUser({ role: "BOUCHER", pushSubscription: PUSH_SUBSCRIPTION });
  const shop = await createTestShop({ ownerId: owner.clerkId as string, name: "Boucherie du Lac" });
  return { owner, shop };
}

describe("événements transactionnels : jamais limités", () => {
  it("deux ORDER_PENDING de deux commandes de la même boutique créent deux lignes pour le propriétaire", async () => {
    const { owner, shop } = await shopWithClerkOwner();
    const customer = await createTestUser();
    const first = await createTestOrder({ shopId: shop.id, userId: customer.id });
    const second = await createTestOrder({ shopId: shop.id, userId: customer.id });

    for (const order of [first, second]) {
      await sendNotification("ORDER_PENDING", {
        shopId: shop.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: "Fatima.A",
      });
    }

    const rows = await notificationsOf(owner.id);
    expect(rows.map((row) => [row.type, row.orderId])).toEqual([
      ["ORDER_PENDING", first.id],
      ["ORDER_PENDING", second.id],
    ]);
  });

  it("ORDER_ACCEPTED puis ORDER_READY de deux commandes du même client créent quatre lignes", async () => {
    const { shop } = await shopWithClerkOwner();
    const customer = await createTestUser();
    const orders = [
      await createTestOrder({ shopId: shop.id, userId: customer.id }),
      await createTestOrder({ shopId: shop.id, userId: customer.id }),
    ];

    for (const order of orders) {
      const data = {
        userId: customer.clerkId as string,
        orderId: order.id,
        orderNumber: order.orderNumber,
        shopName: shop.name,
      };
      await sendNotification("ORDER_ACCEPTED", { ...data, estimatedMinutes: 20 });
      await sendNotification("ORDER_READY", data);
    }

    const rows = await notificationsOf(customer.id);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.type).sort()).toEqual([
      "ORDER_ACCEPTED",
      "ORDER_ACCEPTED",
      "ORDER_READY",
      "ORDER_READY",
    ]);
  });
});

describe("événements marketing : un par type et par heure", () => {
  it("deux CART_ABANDONED dans l'heure pour le même utilisateur créent une seule ligne", async () => {
    const customer = await createTestUser();

    const first = await sendNotification("CART_ABANDONED", {
      userId: customer.id,
      shopName: "Boucherie du Lac",
      nbItems: 2,
    });
    const second = await sendNotification("CART_ABANDONED", {
      userId: customer.id,
      shopName: "Boucherie du Lac",
      nbItems: 3,
    });

    expect(first.sent).toBe(true);
    expect(second).toEqual({ sent: false, channels: [], rateLimited: true });
    expect(await notificationsOf(customer.id)).toHaveLength(1);
  });
});

describe("propriétaire de la boutique", () => {
  it.each([
    ["l'id Prisma", (user: { id: string; clerkId: string | null }) => user.id],
    ["le clerkId", (user: { id: string; clerkId: string | null }) => user.clerkId as string],
  ])("reçoit ORDER_PENDING quand shop.ownerId contient %s", async (_label, ownerRef) => {
    const owner = await createTestUser({ role: "BOUCHER" });
    const shop = await createTestShop({ ownerId: ownerRef(owner) });
    const customer = await createTestUser();
    const order = await createTestOrder({ shopId: shop.id, userId: customer.id });

    const result = await sendNotification("ORDER_PENDING", {
      shopId: shop.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });

    expect(result.sent).toBe(true);
    expect((await notificationsOf(owner.id)).map((row) => row.type)).toEqual(["ORDER_PENDING"]);
    expect(await notificationsOf(customer.id)).toHaveLength(0);
  });
});

describe("événements ajoutés", () => {
  it("ORDER_CANCELLED_BY_CUSTOMER prévient le propriétaire, en français", async () => {
    const owner = await createTestUser({ role: "BOUCHER", pushSubscription: PUSH_SUBSCRIPTION });
    const shop = await createTestShop({ ownerId: owner.id });
    const customer = await createTestUser();
    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      overrides: { orderNumber: "KG26-000166" },
    });

    const result = await sendNotification("ORDER_CANCELLED_BY_CUSTOMER", {
      shopId: shop.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: "Tarik.B",
    });

    expect(result).toEqual({ sent: true, channels: ["email", "push"] });
    const rows = await notificationsOf(owner.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "ORDER_CANCELLED_BY_CUSTOMER",
      orderId: order.id,
      channel: "PUSH",
      delivered: true,
    });
    expect(rows[0].message).toBe("Tarik.B a annulé la commande #KG26-000166. Ne la préparez pas.");
    expect(await notificationsOf(customer.id)).toHaveLength(0);

    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      owner.email,
      "Commande #KG26-000166 annulée par le client",
      expect.stringContaining("KG26-000166")
    );
    const [, payload] = vi.mocked(sendPushNotification).mock.calls[0];
    expect(payload).toMatchObject({
      title: "Commande annulée par le client",
      body: "#KG26-000166 de Tarik.B — ne la préparez pas",
    });
    expect(payload.url).toMatch(/\/boucher\/commandes$/);
  });

  it("ORDER_EXPIRED prévient le client, en français", async () => {
    const { owner, shop } = await shopWithClerkOwner();
    const customer = await createTestUser({ pushSubscription: PUSH_SUBSCRIPTION });
    const order = await createTestOrder({
      shopId: shop.id,
      userId: customer.id,
      overrides: { orderNumber: "KG26-000167" },
    });

    const result = await sendNotification("ORDER_EXPIRED", {
      userId: customer.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopName: "Boucherie du Lac",
    });

    expect(result).toEqual({ sent: true, channels: ["email", "push"] });
    const rows = await notificationsOf(customer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "ORDER_EXPIRED", orderId: order.id });
    expect(rows[0].message).toBe(
      "Boucherie du Lac n'a pas répondu à temps : votre commande KG26-000167 est annulée. Vous n'avez rien à payer."
    );
    expect(await notificationsOf(owner.id)).toHaveLength(0);

    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      customer.email,
      "Commande KG26-000167 annulée",
      expect.stringContaining("Vous n'avez rien à payer")
    );
    const [, payload] = vi.mocked(sendPushNotification).mock.calls[0];
    expect(payload).toMatchObject({
      title: "Commande annulée",
      body: "Boucherie du Lac n'a pas répondu à temps. Vous n'avez rien à payer.",
    });
    expect(payload.url).toMatch(new RegExp(`/suivi/${order.id}$`));
  });
});
