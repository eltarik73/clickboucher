// @vitest-environment node
// Prénom et nom d'une commande invitée, sur PostgreSQL réel : un nom fait de balisage ou de
// chiffres est refusé (400, message français sur le champ) avant toute écriture, ni commande ni
// ligne users ; un nom composé accentué avec apostrophe est enregistré sous une seule écriture
// (NFC, espaces réduits). Seuls la session Clerk et les transports sortants sont simulés.
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product, Shop } from "@prisma/client";

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
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: async () => null,
  getBoucherOwnerUserId: async () => null,
  resolveUserRole: async () => undefined,
  getTestRole: () => null,
  isTestActivated: () => false,
}));

import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop } from "../helpers/factories";
import { quoteOf, quoteRequest } from "../orders/create-order-fixtures";

const { POST: postGuestCheckout } = await import("@/app/api/checkout/guest/route");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

const FIRST_NAME_INVALID =
  "Le prénom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)";
const LAST_NAME_INVALID =
  "Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets (50 caractères maximum)";
const EMAIL = "zoe.invitee@itest.klikandgo.test";

let shop: Shop;
let product: Product;
let ipSequence = 0;

beforeEach(async () => {
  shop = await createTestShop();
  product = await createTestProduct(shop.id);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A guest checkout body as the cart sends it: the confirmed total is the server's public quote. */
async function guestBody(names: { firstName: string; lastName: string }) {
  const request = quoteRequest(shop.id, [{ productId: product.id, quantity: 1, weightGrams: 500 }]);
  const quote = await quoteOf(request, null);
  return {
    ...request,
    idempotencyKey: randomUUID(),
    expectedTotalCents: quote.amountDueCents,
    weighTolerance: "STANDARD",
    email: EMAIL,
    phone: "06 12 34 56 78",
    ...names,
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
  const json = (await response.json()) as {
    data?: { order: { id: string } };
    error?: { code: string; message: string; details?: Record<string, string[]> };
  };
  return { status: response.status, json };
}

async function writtenRows() {
  const [orders, guests] = await Promise.all([
    prisma.order.count(),
    prisma.user.count({ where: { email: EMAIL } }),
  ]);
  return { orders, guests };
}

describe("POST /api/checkout/guest : prénom et nom", () => {
  it("refuse un prénom fait de balisage : 400 avec le message français du champ, rien d'écrit", async () => {
    const body = await guestBody({ firstName: "<img src=x onerror=alert(1)>", lastName: "Haddad" });

    const { status, json } = await postGuest(body);

    expect(status).toBe(400);
    expect(json.error).toEqual({
      code: "VALIDATION_ERROR",
      message: FIRST_NAME_INVALID,
      details: { firstName: [FIRST_NAME_INVALID] },
    });
    expect(await writtenRows()).toEqual({ orders: 0, guests: 0 });
  });

  it("refuse un nom fait de chiffres : 400 avec le message français du champ, rien d'écrit", async () => {
    const body = await guestBody({ firstName: "Zoé", lastName: "12345" });

    const { status, json } = await postGuest(body);

    expect(status).toBe(400);
    expect(json.error).toEqual({
      code: "VALIDATION_ERROR",
      message: LAST_NAME_INVALID,
      details: { lastName: [LAST_NAME_INVALID] },
    });
    expect(await writtenRows()).toEqual({ orders: 0, guests: 0 });
  });

  it("enregistre « Zoé-Aïcha O'Brien » : 201, prénom et nom de la commande tels que saisis", async () => {
    const body = await guestBody({ firstName: "Zoé-Aïcha", lastName: "O'Brien" });

    const { status, json } = await postGuest(body);

    expect(status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: json.data?.order.id },
      select: { customerFirstName: true, customerLastName: true },
    });
    expect(order).toEqual({ customerFirstName: "Zoé-Aïcha", customerLastName: "O'Brien" });
  });

  it("enregistre un nom saisi décomposé et espacé sous sa forme NFC, espaces réduits", async () => {
    // "Zoe" + U+0301 et "Ai" + U+0308 (accents combinants), espaces autour et doublés.
    const body = await guestBody({ firstName: "  Zoé-Aïcha ", lastName: "O'Brien  Ben Saïd" });

    const { status, json } = await postGuest(body);

    expect(status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: json.data?.order.id },
      select: { customerFirstName: true, customerLastName: true },
    });
    expect(order).toEqual({
      customerFirstName: "Zoé-Aïcha",
      customerLastName: "O'Brien Ben Saïd",
    });
  });
});
