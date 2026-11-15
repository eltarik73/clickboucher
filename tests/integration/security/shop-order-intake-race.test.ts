// @vitest-environment node
// Une décision de l'administration (suspension, dépublication) prise pendant qu'une commande est
// en train d'être créée, sur PostgreSQL réel (revue de la PR de C1-FAILLES-CRITIQUES).
//
// Le devis lit la publication de la boutique avant la transaction de création. Sans autre
// contrôle, une suspension validée entre ce devis et l'écriture de la commande laissait passer la
// commande. La transaction de création prend désormais un verrou partagé sur la ligne de la
// boutique et relit sa publication dessous (lockShopTakingOrders, order-shop.ts) : une décision
// validée avant est vue, une décision demandée pendant attend la fin de la commande, et deux
// commandes de la même boutique ne s'attendent pas. Seuls les transports sont simulés.
// Trois connexions au moins (pool Prisma par défaut) : une transaction retenue, la commande et
// les lectures du devis ; avec `connection_limit=2` la commande attendrait une connexion, pas le verrou.
import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

import { createOrder } from "@/lib/services/orders/create";
import {
  lockShopTakingOrders,
  ShopStoppedTakingOrdersError,
} from "@/lib/services/orders/order-shop";
import { suspendShop } from "@/lib/services/shops/moderation";
import { SHOP_ON_VACATION_MESSAGE, SHOP_UNAVAILABLE_MESSAGE } from "@/lib/shop-publication";
import { prisma, useCleanDatabase } from "../helpers/db";
import { createTestProduct, createTestShop, createTestUser } from "../helpers/factories";
import { customerOf, quoteRequest } from "../orders/create-order-fixtures";

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

// 350 g à 24,90 €/kg, paiement sur place : « Total à payer » = 872 c.
const PRICE_PER_KG_CENTS = 2490;
const AMOUNT_DUE_CENTS = 872;
const HELD = { maxWait: 5_000, timeout: 10_000 } as const;

let shop: Shop;
let product: Product;
let customer: User;

beforeEach(async () => {
  shop = await createTestShop();
  product = await createTestProduct(shop.id, { priceCents: PRICE_PER_KG_CENTS });
  customer = await createTestUser();
});

const confirmedOrder = () => ({
  ...quoteRequest(shop.id, [{ productId: product.id, quantity: 1, weightGrams: 350 }]),
  idempotencyKey: randomUUID(),
  expectedTotalCents: AMOUNT_DUE_CENTS,
  weighTolerance: "STANDARD",
});

/** A promise the test resolves itself; always opened in a `finally` so no transaction is left open. */
function gate(): { opened: Promise<void>; open: () => void } {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/**
 * Resolves once another session of this database waits for a row lock (polls pg_locks for two
 * seconds at most; other databases of the local cluster are ignored).
 */
async function someoneWaitsForARowLock(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting
      FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE NOT l.granted AND l.locktype IN ('transactionid', 'tuple')
        AND a.datname = current_database()`;
    if (waiting > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("aucune session n'a attendu le verrou de la ligne boutique");
}

describe("commande en cours pendant une décision de l'administration", () => {
  it("une suspension écrite avant l'écriture de la commande : la commande attend puis est refusée", async () => {
    const written = gate();
    const committed = gate();
    // The admin's decision is written (row locked) but not committed when the order arrives:
    // the quote, outside the transaction, still reads the shop as published.
    const suspension = prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shop.id },
        data: { suspendedAt: new Date(), suspendReason: "Contrôle sanitaire", visible: false },
      });
      written.open();
      await committed.opened;
    }, HELD);
    await written.opened;

    const order = createOrder(confirmedOrder(), customerOf(customer));
    try {
      await someoneWaitsForARowLock();
    } finally {
      committed.open();
    }
    await suspension;

    expect(await order).toEqual({
      ok: false,
      code: "SERVICE_DISABLED",
      message: SHOP_UNAVAILABLE_MESSAGE,
    });
    expect(await prisma.order.count()).toBe(0);
  });

  it("une suspension demandée pendant l'écriture d'une commande attend que la commande soit validée", async () => {
    const locked = gate();
    const committed = gate();
    const events: string[] = [];
    const orderTransaction = prisma.$transaction(async (tx) => {
      await lockShopTakingOrders(tx, shop.id);
      locked.open();
      await committed.opened;
      events.push("commande validée");
    }, HELD);
    await locked.opened;

    const suspension = suspendShop(shop.id, "Contrôle sanitaire").then((result) => {
      events.push("suspension appliquée");
      return result;
    });
    try {
      await someoneWaitsForARowLock();
      expect(events).toEqual([]);
    } finally {
      committed.open();
    }

    await orderTransaction;
    expect(await suspension).toEqual({ ok: true });
    expect(events).toEqual(["commande validée", "suspension appliquée"]);
  });

  it("deux commandes de la même boutique partagent le verrou sans s'attendre", async () => {
    const firstLocked = gate();
    const release = gate();
    const first = prisma.$transaction(async (tx) => {
      await lockShopTakingOrders(tx, shop.id);
      firstLocked.open();
      await release.opened;
    }, HELD);
    await firstLocked.opened;

    try {
      await prisma.$transaction((tx) => lockShopTakingOrders(tx, shop.id), HELD);
    } finally {
      release.open();
    }
    await first;
  });
});

describe("lockShopTakingOrders", () => {
  it("refuse une boutique en vacances, suspendue ou inconnue avec le message du client", async () => {
    const onVacation = await createTestShop({ visible: false, vacationMode: true });
    const suspended = await createTestShop({ suspendedAt: new Date() });

    const refusalFor = (shopId: string) =>
      prisma
        .$transaction((tx) => lockShopTakingOrders(tx, shopId))
        .then(
          () => null,
          (error: unknown) => error
        );

    expect(await refusalFor(onVacation.id)).toEqual(
      new ShopStoppedTakingOrdersError(SHOP_ON_VACATION_MESSAGE)
    );
    expect(await refusalFor(suspended.id)).toEqual(
      new ShopStoppedTakingOrdersError(SHOP_UNAVAILABLE_MESSAGE)
    );
    expect(await refusalFor("boutique-inconnue")).toEqual(
      new ShopStoppedTakingOrdersError(SHOP_UNAVAILABLE_MESSAGE)
    );
    expect(await refusalFor(shop.id)).toBeNull();
  });
});
