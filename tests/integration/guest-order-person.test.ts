// @vitest-environment node
// La personne que nomme une commande invitée, pour CHAQUE lecteur (C1-INVITES, correction IND-1),
// sur PostgreSQL réel.
//
// Une commande invitée passée avec l'e-mail d'un compte est rangée sous la ligne users de ce compte
// (décision D12). Avant cette correction, seule la vue client nommait l'identité saisie : la
// cuisine, le ticket, la liste des clients, l'avis d'annulation, le reçu, les exports et WhatsApp
// nommaient le titulaire du compte, et la commande prenait son numéro client. Un boucher apprenait
// ainsi le nom et le téléphone de n'importe quel membre dont il connaissait l'e-mail (reproduit le
// 2026-11-14 sur la recette). Ici, tout ce que la boutique lit nomme « Inès Typée, 07 11 22 33 44 »
// et rien du membre. Seuls les sessions (server-auth, boucher-auth) et les transports sont simulés.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, Shop, User } from "@prisma/client";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
const session = vi.hoisted(() => ({ clerkId: null as string | null, shopId: "", userId: "" }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));
vi.mock("@/lib/boucher-auth", () => ({
  getAuthenticatedBoucher: async () => ({ userId: session.userId, shopId: session.shopId }),
}));

import { buildTicketHtml } from "@/components/boucher/OrderTicket";
import type { KitchenOrder } from "@/hooks/use-order-polling";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppMessage, sendWhatsAppRaw } from "@/lib/whatsapp";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import { markReady } from "@/lib/services/orders/commands/progress";
import { getNewOrderAlerts } from "@/lib/services/orders/kitchen";
import { getShopDaySummary } from "@/lib/services/orders/shop-summary";
import { getBoucherStats } from "@/lib/services/stats/boucher-stats";
import { prisma, useCleanDatabase } from "./helpers/db";
import {
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "./helpers/factories";
import { quoteOf, quoteRequest } from "./orders/create-order-fixtures";

const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");
const { GET: getKitchen } = await import("@/app/api/boucher/orders/kitchen/route");
const { GET: getClients } = await import("@/app/api/boucher/clients/route");
const { GET: listOrders } = await import("@/app/api/orders/route");
const { GET: exportOrders } = await import("@/app/api/orders/export/route");
const { POST: cancelOrder } = await import("@/app/api/orders/[id]/cancel/route");
const { POST: scanPickup } = await import("@/app/api/boucher/orders/pickup/route");
const { GET: getFinances } = await import("@/app/api/boucher/finances/route");
const { GET: exportFinances } = await import("@/app/api/boucher/finances/export/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const TYPED = { firstName: "Inès", lastName: "Typée", phone: "07 11 22 33 44" };
const TYPED_NAME = { firstName: TYPED.firstName, lastName: TYPED.lastName };
const TYPED_PHONE = "+33711223344";
const MEMBER_PHONE = "+33672255353";
/** Anything that would name the member: first name, last name, phone in any spelling. */
const MEMBER_TRACE = /Samir|Benali|72255353|72 25 53 53/;

let shop: Shop;
let owner: User;
let member: User;
let product: Product;
let ipSequence = 0;

beforeEach(async () => {
  vi.mocked(sendEmail).mockClear();
  vi.mocked(sendWhatsAppMessage).mockClear();
  vi.mocked(sendWhatsAppRaw).mockClear();
  owner = await createTestUser({ role: "BOUCHER" });
  shop = await createTestShop({ ownerId: owner.clerkId as string });
  product = await createTestProduct(shop.id);
  member = await createTestUser({
    email: "compte.membre@itest.klikandgo.test",
    firstName: "Samir",
    lastName: "Benali",
    phone: MEMBER_PHONE,
  });
  session.clerkId = null;
  session.shopId = shop.id;
  session.userId = owner.id;
});

/** A guest order typed by Inès with the member's e-mail. Returns its id and its access cookie. */
async function guestOrderWithMemberEmail({ phone }: { phone?: string } = { phone: TYPED.phone }) {
  ipSequence += 1;
  const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 1, weightGrams: 500 }]);
  const response = await postGuestCheckout(
    new NextRequest("http://localhost/api/checkout/guest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${ipSequence}`,
      },
      body: JSON.stringify({
        ...request,
        idempotencyKey: randomUUID(),
        expectedTotalCents: (await quoteOf(request, null)).amountDueCents,
        weighTolerance: "STANDARD",
        email: member.email,
        firstName: TYPED.firstName,
        lastName: TYPED.lastName,
        ...(phone === undefined ? {} : { phone }),
      }),
    })
  );
  expect(response.status).toBe(201);
  const orderId = ((await response.json()) as { data: { order: { id: string } } }).data.order.id;
  const cookie = response.headers.getSetCookie()[0].split(";")[0];
  return { orderId, cookie };
}

const get = (path: string) => new NextRequest(new URL(path, "http://localhost"));

async function kitchen() {
  const body = (await (await getKitchen(get("/api/boucher/orders/kitchen?history=1"))).json()) as {
    data: { active: KitchenOrder[]; history: Array<{ id: string; user: unknown }> };
  };
  return body.data;
}

describe("une commande invitée passée avec l'e-mail d'un compte, côté boutique", () => {
  it("cuisine, ticket, liste, résumé du jour et export nomment l'identité saisie, sans numéro client", async () => {
    const { orderId } = await guestOrderWithMemberEmail();

    const board = await kitchen();
    const card = board.active.find((order) => order.id === orderId) as KitchenOrder;
    expect(card.user).toEqual({ ...TYPED, phone: TYPED_PHONE, loyaltyBadge: null });
    expect(card.customerNumber).toBeNull();
    expect(JSON.stringify(board)).not.toMatch(MEMBER_TRACE);
    const ticket = buildTicketHtml(card, shop.name);
    expect(ticket).toContain("Inès.T");
    expect(ticket).not.toMatch(MEMBER_TRACE);

    expect((await getShopDaySummary(shop.id, new Date())).recent[0].user).toEqual(TYPED_NAME);
    expect((await getNewOrderAlerts(shop.id, [orderId]))[0].user).toEqual(TYPED_NAME);

    session.clerkId = owner.clerkId;
    const list = await (await listOrders(get("/api/orders"))).text();
    const csv = await (await exportOrders(get("/api/orders/export?format=csv"))).text();
    for (const text of [list, csv]) {
      expect(text).toContain("Inès");
      expect(text).not.toMatch(MEMBER_TRACE);
    }
    expect(csv).toContain(TYPED_PHONE);

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(stored).toMatchObject({ userId: member.id, customerNumber: null });
    expect(await prisma.shopCustomer.count({ where: { userId: member.id } })).toBe(0);
  });

  it("liste des clients : la commande n'est pas attribuée au compte", async () => {
    await guestOrderWithMemberEmail();

    const clients = (await (await getClients(get("/api/boucher/clients"))).json()) as {
      data: Array<Record<string, unknown>>;
    };

    expect(clients.data).toEqual([
      expect.objectContaining({
        userId: null,
        firstName: TYPED.firstName,
        lastName: TYPED.lastName,
        email: member.email,
        orderCount: 1,
        proStatus: null,
      }),
    ]);
    expect(JSON.stringify(clients)).not.toMatch(MEMBER_TRACE);
  });

  it("liste des clients : un membre client de la boutique garde sa ligne, l'invité a la sienne", async () => {
    await createTestOrder({ shopId: shop.id, userId: member.id, status: "PICKED_UP" });
    await guestOrderWithMemberEmail();

    const clients = (await (await getClients(get("/api/boucher/clients"))).json()) as {
      data: Array<{ key: string; userId: string | null; firstName: string; orderCount: number }>;
    };

    expect(
      clients.data.map(({ userId, firstName, orderCount }) => ({ userId, firstName, orderCount }))
    ).toEqual(
      expect.arrayContaining([
        { userId: member.id, firstName: "Samir", orderCount: 1 },
        { userId: null, firstName: TYPED.firstName, orderCount: 1 },
      ])
    );
    expect(new Set(clients.data.map((client) => client.key)).size).toBe(2);
  });

  it("annulation par l'invité : l'avis au boucher et l'historique nomment l'identité saisie", async () => {
    const { orderId, cookie } = await guestOrderWithMemberEmail();

    const cancelled = await cancelOrder(
      new NextRequest(new URL(`/api/orders/${orderId}/cancel`, "http://localhost"), {
        method: "POST",
        headers: { cookie },
      }),
      { params: { id: orderId } }
    );

    expect(cancelled.status).toBe(200);
    const notice = await prisma.notification.findFirstOrThrow({
      where: { type: "ORDER_CANCELLED_BY_CUSTOMER", userId: owner.id },
    });
    expect(notice.message).toContain("Inès.T");
    expect(notice.message).not.toMatch(MEMBER_TRACE);
    expect(JSON.stringify(vi.mocked(sendEmail).mock.calls)).not.toMatch(MEMBER_TRACE);
    const history = (await kitchen()).history.find((order) => order.id === orderId);
    expect(history?.user).toEqual(TYPED_NAME);
  });

  it("acceptation, retrait, reçu, finances et statistiques : l'identité saisie ; WhatsApp au numéro saisi", async () => {
    const { orderId } = await guestOrderWithMemberEmail();
    const now = new Date();
    const command = { orderId, shopId: shop.id, actorId: owner.id, now };
    expect((await acceptOrder({ ...command, estimatedMinutes: 15 })).kind).toBe("done");
    expect((await markReady(command)).kind).toBe("done");
    const { qrCode } = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    const scan = await scanPickup(
      new NextRequest("http://localhost/api/boucher/orders/pickup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qrCode }),
      })
    );
    expect(scan.status).toBe(200);
    expect(((await scan.json()) as { data: { clientName: string } }).data.clientName).toBe(
      "Inès.T"
    );

    const whatsappPhones = [
      ...vi.mocked(sendWhatsAppMessage).mock.calls,
      ...vi.mocked(sendWhatsAppRaw).mock.calls,
    ].map(([phone]) => phone);
    expect(whatsappPhones.length).toBeGreaterThan(0);
    expect(new Set(whatsappPhones)).toEqual(new Set([TYPED_PHONE]));

    const receipt = vi
      .mocked(sendEmail)
      .mock.calls.find(([to, subject]) => to === member.email && /reçu/i.test(subject));
    expect(receipt?.[2]).toContain("Inès T.");
    expect(receipt?.[2]).not.toMatch(MEMBER_TRACE);

    await prisma.order.update({ where: { id: orderId }, data: { paidAt: new Date() } });
    const finances = await (await getFinances()).text();
    const financesCsv = await (await exportFinances(get("/api/boucher/finances/export"))).text();
    for (const text of [finances, financesCsv]) {
      expect(text).toContain("Inès.T");
      expect(text).not.toMatch(MEMBER_TRACE);
    }

    const stats = await getBoucherStats(shop.id, "week");
    expect(stats.ok && JSON.stringify(stats.data)).toContain("Inès Typée");
    expect(JSON.stringify(stats)).not.toMatch(MEMBER_TRACE);
  });

  it("sans téléphone saisi : aucun WhatsApp, jamais au numéro du compte", async () => {
    const { orderId } = await guestOrderWithMemberEmail({});

    expect(
      (
        await acceptOrder({
          orderId,
          shopId: shop.id,
          actorId: owner.id,
          now: new Date(),
          estimatedMinutes: 15,
        })
      ).kind
    ).toBe("done");

    expect(vi.mocked(sendWhatsAppMessage)).not.toHaveBeenCalled();
    expect(vi.mocked(sendWhatsAppRaw)).not.toHaveBeenCalled();
    const card = (await kitchen()).active.find((order) => order.id === orderId);
    expect(card?.user).toEqual({
      firstName: TYPED.firstName,
      lastName: TYPED.lastName,
      phone: null,
      loyaltyBadge: null,
    });
  });
});
