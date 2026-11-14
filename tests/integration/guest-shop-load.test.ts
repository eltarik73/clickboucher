// @vitest-environment node
// Commandes invitées que la boutique n'a pas encore traitées (C1-INVITES, corrections IND-2 et
// IND-3), sur PostgreSQL réel et sans Redis, comme en production.
//
// Avant ces corrections, seule une commande invitée EN ATTENTE était « non traitée » : dans une
// boutique en acceptation automatique, chaque commande invitée naissait acceptée, échappait au
// plafond par personne et déclenchait le mode occupé ; et partout, une vingtaine de commandes
// invitées d'e-mails différents remplissaient le plafond horaire de la boutique, qui refusait
// ensuite les clients connectés pendant une heure (reproduit le 2026-11-14 sur la recette).
// Une règle, GUEST_ORDER_AWAITING_SHOP (src/lib/auth/guest-auth.ts) : une commande invitée en
// attente, ou acceptée automatiquement sans que le boucher y ait touché, ne compte ni dans le mode
// occupé ni dans la capacité des autres clients ; elle a ses propres bornes (par personne, et par
// boutique pour l'heure et le créneau). Seuls la session Clerk et les transports sont simulés.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, Shop, User } from "@prisma/client";

vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
const session = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => session.clerkId,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));

import { rateLimits } from "@/lib/rate-limit";
import { acceptOrder } from "@/lib/services/orders/commands/accept";
import { startPreparing } from "@/lib/services/orders/commands/progress";
import { prisma, useCleanDatabase } from "./helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "./helpers/factories";
import { confirmedBody, customerOf, quoteOf, quoteRequest } from "./orders/create-order-fixtures";

const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");
const { POST: postMemberOrder } = await import("@/app/api/orders/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const CAP_MESSAGE =
  "Trop de commandes en attente de validation pour ces coordonnées. Attendez que la boucherie les ait traitées, ou connectez-vous.";
const DOMAIN = "charge.itest.klikandgo.test";
const HOUR_MS = 60 * 60_000;

let shop: Shop;
let product: Product;
let owner: User;
let sequence = 0;

beforeEach(async () => {
  session.clerkId = null;
  owner = await createTestUser({ role: "BOUCHER" });
  shop = await createTestShop({ ownerId: owner.id, maxOrdersPerHour: 50, autoBusyThreshold: 10 });
  product = await createTestProduct(shop.id);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const line = () => [{ productId: product.id, quantity: 1, weightGrams: 500 }];

interface Answer {
  status: number;
  json: {
    data?: { order: { id: string; status: string } };
    error?: { code: string; message: string };
  };
}

/** One guest checkout, from its own client address, as the cart sends it. */
async function guestOrder(
  contact: { email: string; phone?: string },
  slot?: Date
): Promise<Answer> {
  sequence += 1;
  const request = quoteRequest(shop.id, line());
  const slotFields =
    slot === undefined
      ? {}
      : {
          pickupSlotStart: slot.toISOString(),
          pickupSlotEnd: new Date(slot.getTime() + HOUR_MS / 2).toISOString(),
        };
  const body = {
    ...request,
    ...slotFields,
    idempotencyKey: randomUUID(),
    expectedTotalCents: (await quoteOf(request, null)).amountDueCents,
    firstName: "Nora",
    lastName: "Invitée",
    ...contact,
  };
  const response = await postGuestCheckout(
    new NextRequest("http://localhost/api/checkout/guest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${sequence}` },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, json: (await response.json()) as Answer["json"] };
}

/** One order of a signed-in member, through POST /api/orders. */
async function memberOrder(slot?: Date): Promise<Answer & { member: User }> {
  const member = await createTestUser();
  const slotFields =
    slot === undefined
      ? {}
      : {
          pickupSlotStart: slot.toISOString(),
          pickupSlotEnd: new Date(slot.getTime() + HOUR_MS / 2).toISOString(),
        };
  const body = await confirmedBody(quoteRequest(shop.id, line()), customerOf(member), slotFields);
  session.clerkId = member.clerkId;
  const response = await postMemberOrder(
    new NextRequest("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  session.clerkId = null;
  const json = (await response.json()) as {
    data?: { id: string; status: string };
    error?: Answer["json"]["error"];
  };
  return {
    status: response.status,
    json: { data: json.data && { order: json.data }, error: json.error },
    member,
  };
}

async function rotatingGuestOrders(count: number, slot?: Date): Promise<Answer[]> {
  const answers: Answer[] = [];
  for (let i = 0; i < count; i += 1) {
    answers.push(await guestOrder({ email: `flot-${sequence}-${i}@${DOMAIN}` }, slot));
  }
  return answers;
}

const busyMode = async () =>
  (await prisma.shop.findUniqueOrThrow({ where: { id: shop.id } })).busyMode;

describe("boutique en acceptation automatique", () => {
  beforeEach(async () => {
    shop = await prisma.shop.update({ where: { id: shop.id }, data: { autoAccept: true } });
  });

  it("le rate limiter Redis est inerte, comme en production", () => {
    expect(rateLimits.orders).toBeNull();
  });

  it("e-mail : cinq commandes acceptées automatiquement, la sixième est refusée (429)", async () => {
    const answers: Answer[] = [];
    for (let i = 0; i < 6; i += 1) answers.push(await guestOrder({ email: `meme@${DOMAIN}` }));

    expect(answers.map((answer) => answer.status)).toEqual([201, 201, 201, 201, 201, 429]);
    expect(answers.slice(0, 5).map((answer) => answer.json.data?.order.status)).toEqual(
      Array(5).fill("ACCEPTED")
    );
    expect(answers[5].json.error).toEqual({ code: "RATE_LIMITED", message: CAP_MESSAGE });
    expect(await prisma.order.count()).toBe(5);
  });

  it("téléphone : cinq commandes de cinq e-mails, la sixième au même numéro est refusée", async () => {
    const answers: Answer[] = [];
    for (let i = 0; i < 6; i += 1) {
      answers.push(await guestOrder({ email: `tel-${i}@${DOMAIN}`, phone: "06 99 88 77 66" }));
    }

    expect(answers.map((answer) => answer.status)).toEqual([201, 201, 201, 201, 201, 429]);
    expect(answers[5].json.error?.message).toBe(CAP_MESSAGE);
  });

  it("douze commandes invitées d'e-mails différents ne mettent pas la boutique en mode occupé", async () => {
    const answers = await rotatingGuestOrders(12);

    expect(answers.every((answer) => answer.status === 201)).toBe(true);
    expect(await prisma.order.count({ where: { shopId: shop.id, status: "ACCEPTED" } })).toBe(12);
    expect(await busyMode()).toBe(false);
  });

  it("une commande prise en main par le boucher compte, et ne compte plus dans le plafond de la personne", async () => {
    await prisma.shop.update({ where: { id: shop.id }, data: { autoBusyThreshold: 2 } });
    const placed: Answer[] = [];
    for (let i = 0; i < 5; i += 1) placed.push(await guestOrder({ email: `suivie@${DOMAIN}` }));
    const [first, second] = placed.map((answer) => answer.json.data?.order.id as string);
    for (const orderId of [first, second]) {
      const started = await startPreparing({
        orderId,
        shopId: shop.id,
        actorId: owner.id,
        now: new Date(),
      });
      expect(started.kind).toBe("done");
    }
    expect(await busyMode()).toBe(false);

    // Trois commandes encore non traitées : la personne peut en passer une sixième, et les deux
    // que le boucher prépare comptent dans la charge, qui atteint le seuil de 2.
    expect((await guestOrder({ email: `suivie@${DOMAIN}` })).status).toBe(201);
    expect(await busyMode()).toBe(true);
  });
});

describe("capacité de la boutique : les commandes invitées non traitées ont leur propre borne", () => {
  beforeEach(async () => {
    shop = await prisma.shop.update({ where: { id: shop.id }, data: { maxOrdersPerHour: 4 } });
  });

  it("après maxOrdersPerHour commandes invitées, l'invité suivant est refusé, un membre connecté passe", async () => {
    const answers = await rotatingGuestOrders(5);

    expect(answers.map((answer) => answer.status)).toEqual([201, 201, 201, 201, 429]);
    expect(answers[4].json.error).toEqual({
      code: "CAPACITY_EXCEEDED",
      message: "La boutique est temporairement surchargée",
    });
    const member = await memberOrder();
    expect(member.status).toBe(201);
    expect(member.json.data?.order.status).toBe("PENDING");
  });

  it("les commandes invitées que le boucher a acceptées comptent pour tous", async () => {
    const answers = await rotatingGuestOrders(4);
    for (const answer of answers) {
      const accepted = await acceptOrder({
        orderId: answer.json.data?.order.id as string,
        shopId: shop.id,
        actorId: owner.id,
        estimatedMinutes: 20,
        now: new Date(),
      });
      expect(accepted.kind).toBe("done");
    }

    expect((await memberOrder()).status).toBe(429);
    expect((await guestOrder({ email: `apres@${DOMAIN}` })).status).toBe(429);
  });

  it("créneau : maxOrdersPerSlot commandes invitées le remplissent pour les invités, pas pour les membres", async () => {
    shop = await prisma.shop.update({ where: { id: shop.id }, data: { maxOrdersPerSlot: 2 } });
    const slot = new Date(Math.ceil((Date.now() + 3 * HOUR_MS) / HOUR_MS) * HOUR_MS);

    const answers = await rotatingGuestOrders(3, slot);

    expect(answers.map((answer) => answer.status)).toEqual([201, 201, 429]);
    expect(answers[2].json.error?.message).toBe("Ce créneau est complet");
    expect((await memberOrder(slot)).status).toBe(201);
    expect((await memberOrder(slot)).status).toBe(201);
    expect((await memberOrder(slot)).status).toBe(429);
  });
});
