// src/lib/services/orders/create.ts — creation of an order, for POST /api/orders (signed-in
// customer) and POST /api/checkout/guest (guest customer).
//
// The order is created from the server's quote (quote.ts), never from amounts sent by the browser:
// the browser sends what it wants and the « Total à payer » it confirmed, and any difference is
// answered with PRICE_CHANGED. Numbers, discount consumption and limited stock are taken inside one
// transaction (numbering.ts, discount-ledger.ts, limited-stock.ts), so either everything is
// written or nothing is, a guest order's credential hash and typed identity included
// (guest-placement.ts). An idempotency key makes a retried request return the order created by
// the first one (create-replay.ts).
import { randomUUID } from "crypto";
import type { Order, OrderItem } from "@prisma/client";

import prisma from "@/lib/prisma";
import { formatZodError } from "@/lib/api/errors";
import { orderPagePath } from "@/lib/auth/order-credential";
import { calculatePrepTime } from "@/lib/dynamic-prep-time";
import { lineUnits, toStoredQuantity } from "@/lib/pricing/line";
import { computeOrderCommissionFromHt } from "@/lib/services/stripe/commission";
import { formatPrice } from "@/lib/utils";
import { createOrderSchema, type CreateOrderRequest } from "@/lib/validators/order";
import { announceNewOrder } from "./announce";
import {
  createdOrderInclude,
  creationFailure,
  findByIdempotencyKey,
  GuestAdmissionRefusedError,
  replayOr,
  type Failure,
} from "./create-replay";
import { consumeLoyaltyReward, consumeOffer } from "./discount-ledger";
import type { ResolvedDiscount } from "./discount";
import { guestOrderColumns, type GuestOrderPlacement } from "./guest-placement";
import { reserveLimitedStock, stockLinesFromItems } from "./limited-stock";
import { allocateCustomerNumber, allocateDailyNumber, allocateOrderNumber } from "./numbering";
import { lockShopTakingOrders } from "./order-shop";
import { prepareOrder, type OrderCustomer, type OrderQuote, type OrderShop } from "./quote";
import { checkShopCanTakeOrder } from "./shop-capacity";
import { ACCEPTED_EVENT_TYPE, stockUnitsPayload } from "./stock-hold";
import { SYSTEM_ACTOR_ID } from "./transition";

export type CreateOrderErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SERVICE_DISABLED"
  | "CAPACITY_EXCEEDED"
  | "PRODUCTS_MISSING"
  | "STOCK_INSUFFICIENT"
  | "PRICE_CHANGED"
  | "CONFLICT"
  | "RATE_LIMITED";

type CreatedOrder = Order & {
  items: OrderItem[];
  shop: { id: string; name: string; slug: string };
};

export type CreateOrderResult =
  | { ok: true; status: 201 | 200; order: CreatedOrder }
  | { ok: false; code: CreateOrderErrorCode; message: string; details?: Record<string, string[]> };

const STALE_CART_MESSAGE =
  "Votre panier n'est plus à jour. Rechargez la page puis validez à nouveau votre commande.";
const PRICE_CHANGED_MESSAGE =
  "Les prix ou la disponibilité ont changé. Vérifiez le nouveau total avant de confirmer.";
const TRANSACTION_OPTIONS = { maxWait: 5000, timeout: 10000 } as const;
const MINUTE_MS = 60_000;

/** Status, timers and QR code of a new order, as the shop is configured (auto-accept or not). */
async function initialState(
  shop: OrderShop,
  request: CreateOrderRequest,
  quote: OrderQuote,
  now: Date
) {
  const itemCount = quote.lines.reduce((sum, line) => sum + lineUnits(line), 0);
  const prepMinutes = await calculatePrepTime({
    shopId: shop.id,
    basePrepMin: shop.prepTimeMin,
    busyMode: shop.busyMode,
    busyExtraMin: shop.busyExtraMin,
    itemCount,
  });
  const slotStart = request.pickupSlotStart ? new Date(request.pickupSlotStart) : null;
  const scheduledFor = slotStart !== null && slotStart.getTime() > now.getTime() ? slotStart : null;
  const accepted = shop.autoAccept;
  return {
    status: accepted ? ("ACCEPTED" as const) : ("PENDING" as const),
    expiresAt: accepted ? null : new Date(now.getTime() + shop.acceptTimeoutMin * MINUTE_MS),
    qrCode: accepted ? randomUUID() : null,
    estimatedReady: accepted
      ? (scheduledFor ?? new Date(now.getTime() + prepMinutes * MINUTE_MS))
      : null,
    prepMinutes,
    scheduledFor,
  };
}

type InitialState = Awaited<ReturnType<typeof initialState>>;

interface Placement {
  request: CreateOrderRequest;
  customer: OrderCustomer;
  shop: OrderShop;
  quote: OrderQuote;
  discount: ResolvedDiscount | null;
  state: InitialState;
  now: Date;
  guest?: GuestOrderPlacement;
}

function insertOrder({
  request,
  customer,
  shop,
  quote,
  discount,
  state,
  now,
  guest,
}: Placement): Promise<{ order: CreatedOrder; displayNumber: string }> {
  // Lock order, the same in every path that creates an order: the shop row (still taking orders,
  // order-shop.ts), guest cap locks, offer, counters (customer, day, year), then the products'
  // limited stock.
  return prisma.$transaction(async (tx) => {
    await lockShopTakingOrders(tx, shop.id);
    const refusal = await guest?.admit?.(tx);
    if (refusal) throw new GuestAdmissionRefusedError(refusal);
    if (discount?.offerId) {
      await consumeOffer(tx, { offerId: discount.offerId, userId: customer.id, now });
    }
    // A guest order takes no shop customer number: the users row it is filed under may be an
    // account the guest proved nothing about (order-person.ts).
    const customerNumber =
      guest === undefined ? await allocateCustomerNumber(tx, shop.id, customer.id) : null;
    const { dailyNumber, displayNumber } = await allocateDailyNumber(tx, shop.id, now);
    const orderNumber = await allocateOrderNumber(tx, now);

    const order = await tx.order.create({
      data: {
        orderNumber,
        dailyNumber,
        displayNumber,
        customerNumber,
        userId: customer.id,
        isPro: customer.role === "CLIENT_PRO",
        shopId: shop.id,
        status: state.status,
        requestedTime: request.requestedTime,
        customerNote: request.customerNote,
        totalCents: quote.totalCents,
        // Present commission model, out of this chantier: the shop's rate applied to totalCents.
        commissionCents: shop.commissionEnabled
          ? computeOrderCommissionFromHt(quote.totalCents, shop.commissionPct / 100)
          : 0,
        discountCents: quote.discount?.discountCents ?? 0,
        discountAmount: (quote.discount?.discountCents ?? 0) / 100,
        discountSource: discount?.source ?? null,
        offerId: discount?.offerId ?? null,
        loyaltyRewardId: discount?.loyaltyRewardId ?? null,
        serviceFeeCents: quote.serviceFeeCents,
        paymentMethod: quote.paymentMethod,
        expiresAt: state.expiresAt,
        qrCode: state.qrCode,
        estimatedReady: state.estimatedReady,
        idempotencyKey: request.idempotencyKey,
        ...guestOrderColumns(guest),
        pickupSlotStart: request.pickupSlotStart ? new Date(request.pickupSlotStart) : null,
        pickupSlotEnd: request.pickupSlotEnd ? new Date(request.pickupSlotEnd) : null,
        items: {
          create: quote.lines.map((line) => ({
            productId: line.productId,
            name: line.name,
            unit: line.unit,
            quantity: toStoredQuantity(line),
            weightGrams: line.weightGrams,
            priceCents: line.unitPriceCents,
            totalCents: line.lineTotalCents,
            estimatedPriceCents: line.lineTotalCents,
            cutOption: line.cutOption,
            cutPriceCents: line.cutPriceCents,
            variant: line.variant,
            sliceCount: line.sliceCount,
            sliceThickness: line.sliceThickness,
            pieceCount: line.pieceCount,
            pieceLabel: line.pieceLabel,
            itemNote: line.itemNote,
          })),
        },
      },
      include: createdOrderInclude,
    });

    if (discount?.loyaltyRewardId) {
      await consumeLoyaltyReward(tx, {
        rewardId: discount.loyaltyRewardId,
        userId: customer.id,
        orderId: order.id,
        now,
      });
    }
    if (state.status === "ACCEPTED") {
      // Same record as the accept command: the units reserved are written into the ACCEPTED
      // event, and every later release gives back exactly those units.
      const stockLines = stockLinesFromItems(order.items);
      await reserveLimitedStock(tx, shop.id, stockLines, now);
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          shopId: shop.id,
          type: ACCEPTED_EVENT_TYPE,
          actorId: SYSTEM_ACTOR_ID,
          payloadJson: { auto: true, qrCode: state.qrCode, ...stockUnitsPayload(stockLines) },
        },
      });
    }
    return { order, displayNumber };
  }, TRANSACTION_OPTIONS);
}

/** body = raw JSON without the guest identity fields; customer = Prisma user already resolved by
 * the route; guest = guest checkout only (credential hash, typed identity, e-mailed link). */
export async function createOrder(
  body: unknown,
  customer: OrderCustomer,
  guest?: GuestOrderPlacement
): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: STALE_CART_MESSAGE,
      details: formatZodError(parsed.error),
    };
  }
  const request = parsed.data;

  const replay = await findByIdempotencyKey(request.idempotencyKey, customer.id);
  if (replay !== null) return replay;

  const now = new Date();
  const prepared = await prepareOrder(request, customer, now);
  if (!prepared.ok) return replayOr(request, customer, prepared);
  const { quote, shop, discount } = prepared;

  const refusal = priceRefusal(request, quote);
  if (refusal !== null) return replayOr(request, customer, refusal);

  const capacity = await checkShopCanTakeOrder(shop, request, now, {
    asGuest: guest !== undefined,
  });
  if (!capacity.ok) return replayOr(request, customer, capacity);

  const placement: Placement = {
    request,
    customer,
    shop,
    quote,
    discount,
    state: await initialState(shop, request, quote, now),
    now,
    guest,
  };
  let created: { order: CreatedOrder; displayNumber: string };
  try {
    created = await insertOrder(placement);
  } catch (error) {
    return creationFailure(error, placement);
  }

  await announceNewOrder({
    ...created,
    customer,
    shop,
    scheduledFor: placement.state.scheduledFor,
    prepMinutes: placement.state.prepMinutes,
    trackingPath: guest ? guest.trackingPath(created.order.id) : orderPagePath(created.order.id),
  });
  return { ok: true, status: 201, order: created.order };
}

/** The quote the order would be created from differs from what the customer confirmed. */
function priceRefusal(request: CreateOrderRequest, quote: OrderQuote): Failure | null {
  if (quote.discountRejection !== null) {
    return { ok: false, code: "PRICE_CHANGED", message: quote.discountRejection.message };
  }
  if (quote.belowMinimumOrder) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: `Commande minimum de ${formatPrice(quote.minOrderCents)} requise`,
    };
  }
  if (quote.amountDueCents !== request.expectedTotalCents) {
    return { ok: false, code: "PRICE_CHANGED", message: PRICE_CHANGED_MESSAGE };
  }
  return null;
}
