// @vitest-environment node
// Ce que les lecteurs d'une commande montrent d'un ajustement de prix resté sans réponse, sur
// PostgreSQL réel : la page de suivi et la route qu'elle interroge ferment l'ajustement échu
// (le silence vaut refus) avant de répondre, et la vue webmaster dit pourquoi il a été fermé.
// Seuls l'identité de l'appelant et les transports sortants sont simulés.
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn(async () => true) }));
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: vi.fn(async () => true),
  sendWhatsAppRaw: vi.fn(async () => true),
}));

const auth = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@/lib/auth/server-auth", () => ({
  getServerUserId: vi.fn(async () => auth.clerkId),
  getBoucherOwnerUserId: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: vi.fn(async () => ({ userId: "admin" })) }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));

import { useCleanDatabase } from "../helpers/db";
import {
  ANSWER_WINDOW_MS,
  eventsOf,
  notificationsOf,
  pendingWeighingIncrease,
  reload,
} from "./commands-fixtures";

const { GET: getStatus } = await import("@/app/api/orders/[id]/status/route");
const { GET: getShopAdjustments } =
  await import("@/app/api/admin/shops/[shopId]/adjustments/route");
const { default: SuiviPage } = await import("@/app/(client)/suivi/[id]/page");

// Pas un hook React : la règle ne regarde que le préfixe « use » du nom.
// eslint-disable-next-line react-hooks/rules-of-hooks
useCleanDatabase();

interface ReadAdjustment {
  status: string;
  closeReason: string | null;
}

/** The pending weighing increase of the fixtures, proposed `agoMs` ago, read by its customer. */
async function increaseProposed(agoMs: number) {
  const { world, order } = await pendingWeighingIncrease(new Date(Date.now() - agoMs));
  auth.clerkId = world.customer.clerkId;
  return { world, orderId: order.id };
}

async function readStatus(orderId: string) {
  const response = await getStatus(
    new NextRequest(`http://localhost/api/orders/${orderId}/status`),
    {
      params: { id: orderId },
    }
  );
  const body = (await response.json()) as {
    data: { totalCents: number; priceAdjustment: ReadAdjustment };
  };
  return { status: response.status, order: body.data };
}

describe("GET /api/orders/[id]/status (polled by /suivi)", () => {
  it("closes an adjustment past its deadline as unanswered: price unchanged, shop told once", async () => {
    const { world, orderId } = await increaseProposed(ANSWER_WINDOW_MS + 1_000);

    const first = await readStatus(orderId);
    const second = await readStatus(orderId);

    expect(first.status).toBe(200);
    expect(first.order.totalCents).toBe(2000);
    expect(first.order.priceAdjustment).toMatchObject({
      status: "REJECTED",
      closeReason: "NO_ANSWER",
    });
    expect(second.order.priceAdjustment).toMatchObject({ closeReason: "NO_ANSWER" });
    expect((await reload(orderId)).totalCents).toBe(2000);
    expect(await eventsOf(orderId, "PRICE_ADJUSTMENT_CLOSED")).toHaveLength(1);
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_EXPIRED")).toHaveLength(1);
  });

  it("leaves an adjustment the customer may still answer pending", async () => {
    const { world, orderId } = await increaseProposed(ANSWER_WINDOW_MS - 60_000);

    const { order } = await readStatus(orderId);

    expect(order.priceAdjustment).toMatchObject({ status: "PENDING", closeReason: null });
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_EXPIRED")).toHaveLength(0);
  });
});

describe("the tracking page /suivi/[id]", () => {
  it("renders an adjustment past its deadline as unanswered, the price unchanged", async () => {
    const { world, orderId } = await increaseProposed(ANSWER_WINDOW_MS + 1_000);

    const page = await SuiviPage({ params: { id: orderId }, searchParams: {} });
    const { order } = page.props as {
      order: { totalCents: number; priceAdjustment: ReadAdjustment };
    };

    expect(order.totalCents).toBe(2000);
    expect(order.priceAdjustment).toMatchObject({ status: "REJECTED", closeReason: "NO_ANSWER" });
    expect(await notificationsOf(world.owner.id, "PRICE_ADJUSTMENT_EXPIRED")).toHaveLength(1);
  });
});

describe("GET /api/admin/shops/[shopId]/adjustments", () => {
  it("tells an unanswered adjustment from a refusal by its closeReason", async () => {
    const { world, orderId } = await increaseProposed(ANSWER_WINDOW_MS + 1_000);
    await readStatus(orderId);

    const response = await getShopAdjustments(
      new NextRequest(`http://localhost/api/admin/shops/${world.shop.id}/adjustments`),
      { params: { shopId: world.shop.id } }
    );
    const body = (await response.json()) as { data: { adjustments: ReadAdjustment[] } };

    expect(response.status).toBe(200);
    const [adjustment] = body.data.adjustments;
    expect(adjustment).toMatchObject({ status: "REJECTED", closeReason: "NO_ANSWER" });
  });
});
