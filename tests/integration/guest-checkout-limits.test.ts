// @vitest-environment node
// Commande invitée, protections d'entrée (C1-INVITES), sur PostgreSQL réel : plafond de commandes en
// attente par e-mail et par téléphone tenu par la base (sans Redis, comme en production), même
// réponse pour l'e-mail d'un compte, et commandes invitées non traitées hors de la charge de la
// boutique (mode occupé automatique, pause automatique). Seuls la session Clerk et les transports
// sortants sont simulés ; chaque requête porte son propre x-forwarded-for (décision D20).
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderStatus, Product, Shop } from "@prisma/client";

vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => "sent") }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => null,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));

import { orderAccessCookieName } from "@/lib/auth/order-credential";
import { rateLimits } from "@/lib/rate-limit";
import { createOrder } from "@/lib/services/orders/create";
import { expireDueOrders } from "@/lib/services/orders/commands/close";
import { prisma, useCleanDatabase } from "./helpers/db";
import {
  createTestOffer,
  createTestOrder,
  createTestProduct,
  createTestShop,
  createTestUser,
} from "./helpers/factories";
import { confirmedBody, customerOf, quoteOf, quoteRequest } from "./orders/create-order-fixtures";

const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");
const { GET: runAutoCancel } = await import("@/app/api/cron/auto-cancel/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const CAP_MESSAGE =
  "Trop de commandes en attente de validation pour ces coordonnées. Attendez que la boucherie les ait traitées, ou connectez-vous.";
const MINUTE_MS = 60_000;
const DOMAIN = "itest.klikandgo.test";
const IDENTITY = { firstName: "Nora", lastName: "Invitée", phone: "" };

let shop: Shop;
let product: Product;
let ipSequence = 0;

beforeEach(async () => {
  shop = await createTestShop();
  product = await createTestProduct(shop.id, { proPriceCents: 1500 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * A guest checkout body as the cart sends it: the confirmed total is the server's public quote, and
 * the weighing tolerance shown above the order button.
 */
async function guestBody(contact: Record<string, string>, extra: Record<string, unknown> = {}) {
  const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 1, weightGrams: 500 }]);
  const quote = await quoteOf(request, null);
  return {
    ...request,
    idempotencyKey: randomUUID(),
    expectedTotalCents: quote.amountDueCents,
    weighTolerance: "STANDARD",
    ...IDENTITY,
    ...contact,
    ...extra,
  };
}

async function postGuest(body: Record<string, unknown>) {
  ipSequence += 1;
  const response = await postGuestCheckout(
    new NextRequest("http://localhost/api/checkout/guest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${ipSequence}`,
      },
      body: JSON.stringify(body),
    })
  );
  const text = await response.text();
  const json = JSON.parse(text) as {
    data?: { order: { id: string } };
    error?: { code: string; message: string; details?: Record<string, string[]> };
  };
  return { status: response.status, text, json, cookies: response.headers.getSetCookie() };
}

function guestRow(email: string, phone: string | null = null) {
  return createTestUser({ clerkId: null, isGuest: true, email, phone });
}

async function placedOrders(
  userId: string,
  count: number,
  status: OrderStatus,
  placedAsGuest = true
) {
  for (let i = 0; i < count; i += 1) {
    await createTestOrder({ shopId: shop.id, userId, status, overrides: { placedAsGuest } });
  }
}

/** Every key path of a JSON value, so two answers can be compared by shape only. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => keyPaths(item, `${prefix}[]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    `${prefix}.${key}`,
    ...keyPaths(child, `${prefix}.${key}`),
  ]);
}

const shape = (value: unknown) => [...new Set(keyPaths(value))].sort();

describe("plafond des commandes invitées en attente, tenu par PostgreSQL", () => {
  it("le limiteur Redis est inerte, comme en production", () => {
    expect(rateLimits.orders).toBeNull();
  });

  it("e-mail : une sixième commande en attente est refusée (429), rien n'est créé", async () => {
    const guest = await guestRow(`plafond@${DOMAIN}`);
    await placedOrders(guest.id, 5, "PENDING");

    const answer = await postGuest(await guestBody({ email: `PLAFOND@${DOMAIN.toUpperCase()}` }));

    expect(answer.status).toBe(429);
    expect(answer.json.error).toEqual({ code: "RATE_LIMITED", message: CAP_MESSAGE });
    expect(answer.cookies).toEqual([]);
    expect(await prisma.order.count()).toBe(5);
  });

  it("téléphone : cinq commandes en attente saisies avec ce numéro suffisent, quel que soit users.phone", async () => {
    for (let i = 0; i < 5; i += 1) {
      const row = await guestRow(`tel-${i}@${DOMAIN}`, `+3370000000${i}`);
      await createTestOrder({
        shopId: shop.id,
        userId: row.id,
        overrides: { placedAsGuest: true, customerPhone: "+33612345678" },
      });
    }

    const answer = await postGuest(
      await guestBody({ email: `nouveau@${DOMAIN}`, phone: "06 12 34 56 78" })
    );

    expect(answer.status).toBe(429);
    expect(answer.json.error?.message).toBe(CAP_MESSAGE);
    expect(await prisma.order.count()).toBe(5);
  });

  it("téléphone : le numéro d'une ligne users ne compte pas, seul celui saisi sur chaque commande", async () => {
    for (let i = 0; i < 5; i += 1) {
      await placedOrders((await guestRow(`ligne-${i}@${DOMAIN}`, "+33612345678")).id, 1, "PENDING");
    }

    const answer = await postGuest(
      await guestBody({ email: `autre@${DOMAIN}`, phone: "06 12 34 56 78" })
    );

    expect(answer.status).toBe(201);
  });

  it("des commandes acceptées, ou passées connecté, ne bloquent pas", async () => {
    const guest = await guestRow(`acceptees@${DOMAIN}`);
    await placedOrders(guest.id, 5, "ACCEPTED");
    const member = await createTestUser({ email: `membre-connecte@${DOMAIN}` });
    await placedOrders(member.id, 5, "PENDING", false);

    expect((await postGuest(await guestBody({ email: guest.email }))).status).toBe(201);
    expect((await postGuest(await guestBody({ email: member.email }))).status).toBe(201);
  });

  it.each([1, 2, 3, 4, 5])(
    "tour %i : trois envois simultanés à quatre commandes en attente, un seul passe",
    async () => {
      const guest = await guestRow(`course@${DOMAIN}`);
      await placedOrders(guest.id, 4, "PENDING");
      const bodies = await Promise.all([0, 1, 2].map(() => guestBody({ email: guest.email })));

      const answers = await Promise.all(bodies.map(postGuest));

      expect(answers.map((answer) => answer.status).sort()).toEqual([201, 429, 429]);
      const pending = { userId: guest.id, status: "PENDING", placedAsGuest: true } as const;
      expect(await prisma.order.count({ where: pending })).toBe(5);
    }
  );

  it("rejouer la clé d'une commande créée juste sous le plafond : 200 et la même commande", async () => {
    const guest = await guestRow(`rejeu@${DOMAIN}`);
    await placedOrders(guest.id, 4, "PENDING");
    const body = await guestBody({ email: guest.email });

    const created = await postGuest(body);
    const replayed = await postGuest(body);
    const another = await postGuest(await guestBody({ email: guest.email }));

    expect([created.status, replayed.status, another.status]).toEqual([201, 200, 429]);
    const orderId = created.json.data?.order.id as string;
    expect(replayed.json.data?.order.id).toBe(orderId);
    const cookie = `${orderAccessCookieName(orderId)}=`;
    expect(replayed.cookies.some((line) => line.startsWith(cookie))).toBe(true);
    expect(await prisma.order.count({ where: { userId: guest.id } })).toBe(5);
  });
});

describe("l'e-mail d'un compte reçoit la même réponse que tout autre e-mail", () => {
  it("commande rattachée au compte, prix publics, compte inchangé, réponse de même forme", async () => {
    const member = await createTestUser({
      role: "CLIENT_PRO",
      email: `pro@${DOMAIN}`,
      firstName: "Mona",
      lastName: "Pro",
      phone: "+33700000000",
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });

    const memberAnswer = await postGuest(
      await guestBody({ email: `Pro@${DOMAIN}`, firstName: "Intrus", phone: "06 99 99 99 99" })
    );
    const freshAnswer = await postGuest(await guestBody({ email: `inconnu@${DOMAIN}` }));

    expect([memberAnswer.status, freshAnswer.status]).toEqual([201, 201]);
    expect(shape(memberAnswer.json)).toEqual(shape(freshAnswer.json));
    expect(memberAnswer.text.toLowerCase()).not.toContain("compte");
    for (const answer of [memberAnswer, freshAnswer]) {
      const cookie = `${orderAccessCookieName(answer.json.data?.order.id as string)}=`;
      expect(answer.cookies.map((line) => line.startsWith(cookie))).toEqual([true]);
    }
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: memberAnswer.json.data?.order.id },
      include: { items: true },
    });
    expect(order).toMatchObject({
      userId: member.id,
      placedAsGuest: true,
      isPro: false,
      customerFirstName: "Intrus",
      customerLastName: IDENTITY.lastName,
      customerPhone: "+33699999999",
    });
    expect(order.items.map((item) => item.priceCents)).toEqual([product.priceCents]);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).toEqual(before);
  });

  it("la clé d'une commande passée connecté ne se rejoue pas par la commande invitée", async () => {
    const member = await createTestUser({ email: `connecte@${DOMAIN}` });
    const request = quoteRequest(shop.id, [
      { productId: product.id, quantity: 1, weightGrams: 500 },
    ]);
    const body = await confirmedBody(request, customerOf(member));
    const signedIn = await createOrder(body, customerOf(member));
    expect(signedIn.ok).toBe(true);

    const answer = await postGuest({ ...body, ...IDENTITY, email: member.email });

    expect(answer.status).toBe(409);
    expect(answer.json.error?.code).toBe("CONFLICT");
    expect(answer.json.data).toBeUndefined();
    expect(answer.cookies).toEqual([]);
    const stored = await prisma.order.findFirstOrThrow({ where: { userId: member.id } });
    expect(stored).toMatchObject({ placedAsGuest: false, accessTokenHash: null });
  });

  it("un code promo ou une récompense de fidélité est refusé, pour un compte comme pour un inconnu", async () => {
    const member = await createTestUser({ email: `fidele@${DOMAIN}` });
    const offer = await createTestOffer();
    const reward = await prisma.loyaltyReward.create({
      data: {
        userId: member.id,
        tier: 3,
        rewardType: "FIXED",
        rewardCents: 200,
        code: "KG-ITEST1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE_MS),
      },
    });

    for (const promoCode of [offer.code, reward.code]) {
      for (const email of [member.email, `sans-compte@${DOMAIN}`]) {
        const answer = await postGuest(await guestBody({ email }, { promoCode }));
        expect(answer.status, `${promoCode} ${email}`).toBe(409);
        expect(answer.json.error?.message).toBe("Connectez-vous pour utiliser un code promo");
      }
    }
    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).currentUses).toBe(0);
    expect(
      (await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })).usedAt
    ).toBeNull();
  });
});

describe("ligne invitée", () => {
  it.each([1, 2, 3])(
    "tour %i : deux premières commandes simultanées d'un nouvel e-mail",
    async (round) => {
      // Prisma prints a failed query (« prisma:error … Unique constraint failed ») with console.log.
      const printers = [vi.spyOn(console, "log"), vi.spyOn(console, "error")];
      const email = `premiere-${round}@${DOMAIN}`;
      const bodies = await Promise.all([0, 1].map(() => guestBody({ email })));

      const answers = await Promise.all(bodies.map(postGuest));

      expect(answers.map((answer) => answer.status)).toEqual([201, 201]);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
      const printed = printers
        .flatMap((spy) => spy.mock.calls.flat())
        .map(String)
        .join("\n");
      expect(printed).not.toMatch(/Unique constraint|prisma:error/);
    }
  );

  it("téléphone enregistré sous sa forme internationale, sans jeton de personne", async () => {
    const answer = await postGuest(
      await guestBody({ email: `numero@${DOMAIN}`, phone: "06 12 34 56 78" })
    );

    expect(answer.status).toBe(201);
    expect(
      await prisma.order.findUniqueOrThrow({ where: { id: answer.json.data?.order.id } })
    ).toMatchObject({
      placedAsGuest: true,
      customerFirstName: IDENTITY.firstName,
      customerLastName: IDENTITY.lastName,
      customerPhone: "+33612345678",
    });
    expect(
      await prisma.user.findUniqueOrThrow({ where: { email: `numero@${DOMAIN}` } })
    ).toMatchObject({
      phone: "+33612345678",
      guestToken: null,
      clerkId: null,
      isGuest: true,
      role: "CLIENT",
    });
  });

  it.each([
    ["phone", "0612", "Téléphone invalide (ex. 06 12 34 56 78)"],
    ["email", "a@b", "Email invalide"],
  ])(
    "%s « %s » refusé (400) avec le message du champ, rien n'est créé",
    async (field, value, message) => {
      const answer = await postGuest(await guestBody({ email: `champ@${DOMAIN}`, [field]: value }));

      expect(answer.status).toBe(400);
      expect(answer.json.error).toMatchObject({
        code: "VALIDATION_ERROR",
        message,
        details: { [field]: [message] },
      });
      expect(answer.cookies).toEqual([]);
      expect(await prisma.order.count()).toBe(0);
      expect(await prisma.user.count({ where: { isGuest: true } })).toBe(0);
    }
  );

  it("une ligne invitée existante ne reçoit que ce qui lui manque", async () => {
    const guest = await createTestUser({
      clerkId: null,
      isGuest: true,
      email: `incomplet@${DOMAIN}`,
      firstName: "Samir",
      lastName: "",
      phone: null,
    });

    const answer = await postGuest(
      await guestBody({
        email: guest.email,
        firstName: "Autre",
        lastName: "Nom",
        phone: "0611223344",
      })
    );

    expect(answer.status).toBe(201);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: guest.id } })).toMatchObject({
      firstName: "Samir",
      lastName: "Nom",
      phone: "+33611223344",
    });
  });
});

describe("charge de la boutique : une commande invitée non traitée ne compte pas", () => {
  const busyMode = async () =>
    (await prisma.shop.findUniqueOrThrow({ where: { id: shop.id } })).busyMode;

  async function memberOrder() {
    const member = customerOf(await createTestUser());
    const request = quoteRequest(shop.id, [
      { productId: product.id, quantity: 1, weightGrams: 500 },
    ]);
    const result = await createOrder(await confirmedBody(request, member), member);
    expect(result.ok).toBe(true);
  }

  beforeEach(async () => {
    await prisma.shop.update({ where: { id: shop.id }, data: { autoBusyThreshold: 2 } });
  });

  it("deux commandes invitées en attente et une nouvelle commande invitée : pas de mode occupé", async () => {
    const guest = await guestRow(`charge@${DOMAIN}`);
    await placedOrders(guest.id, 2, "PENDING");

    expect((await postGuest(await guestBody({ email: guest.email }))).status).toBe(201);
    expect(await busyMode()).toBe(false);
  });

  it("deux commandes de membres en attente et une nouvelle : mode occupé", async () => {
    await placedOrders((await createTestUser()).id, 2, "PENDING", false);
    await memberOrder();
    expect(await busyMode()).toBe(true);
  });

  it("une commande invitée acceptée compte", async () => {
    await placedOrders((await guestRow(`acceptee@${DOMAIN}`)).id, 1, "ACCEPTED");
    await memberOrder();
    expect(await busyMode()).toBe(true);
  });

  async function twoShopsWithExpiredOrders() {
    const memberShop = await createTestShop();
    const past = { expiresAt: new Date(Date.now() - MINUTE_MS) };
    const guest = await guestRow(`expiree@${DOMAIN}`);
    await createTestOrder({
      shopId: shop.id,
      userId: guest.id,
      overrides: { ...past, placedAsGuest: true },
    });
    const member = await createTestUser();
    await createTestOrder({ shopId: memberShop.id, userId: member.id, overrides: past });
    return memberShop;
  }

  it("cron d'expiration : une commande invitée expirée ne compte pas comme manquée", async () => {
    vi.stubEnv("CRON_SECRET", "itest-cron-secret");
    const memberShop = await twoShopsWithExpiredOrders();

    const response = await runAutoCancel(
      new NextRequest("http://localhost/api/cron/auto-cancel", {
        headers: { authorization: "Bearer itest-cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { data: { cancelledCount: number } }).data.cancelledCount
    ).toBe(2);
    const missed = await prisma.shop.findMany({ select: { id: true, missedOrdersCount: true } });
    expect(Object.fromEntries(missed.map((row) => [row.id, row.missedOrdersCount]))).toEqual({
      [shop.id]: 0,
      [memberShop.id]: 1,
    });
  });

  it("expireDueOrders : boutiques des commandes expirées, et de celles manquées", async () => {
    const memberShop = await twoShopsWithExpiredOrders();
    const now = new Date();

    const result = await expireDueOrders({ now, deadline: new Date(now.getTime() + MINUTE_MS) });

    expect([...result.expiredShopIds].sort()).toEqual([shop.id, memberShop.id].sort());
    expect(result).toMatchObject({ missedShopIds: [memberShop.id], failed: 0, remainingCount: 0 });
  });
});
