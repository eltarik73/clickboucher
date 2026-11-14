// src/lib/services/orders/announce.ts — what follows the commit of a new order: the butcher's alert,
// the customer's confirmation e-mail and the shop's auto-busy check.
//
// Awaited before the HTTP response, so a serverless function cannot be frozen with sends in flight.
// The order exists whatever happens here: a failure is logged, never returned.
import type { Order, OrderItem } from "@prisma/client";

import prisma from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/emails/order-confirmation";
import { logger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications";
import { PARIS_TIME_ZONE } from "@/lib/paris-time";
import { setBusyMode } from "@/lib/shop-status";
import type { OrderShop } from "./quote";

const AUTO_BUSY = { extraMin: 15, durationMin: 30 } as const;

export interface NewOrderAnnouncement {
  order: Order & { items: OrderItem[] };
  displayNumber: string;
  customer: { firstName: string; email: string };
  shop: OrderShop;
  /** Pickup slot start when the order is scheduled for later, else null. */
  scheduledFor: Date | null;
  prepMinutes: number;
}

export async function announceNewOrder(input: NewOrderAnnouncement): Promise<void> {
  const { order, customer, shop, scheduledFor } = input;
  const slot = scheduledFor?.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS_TIME_ZONE,
  });

  const tasks: Array<[string, Promise<unknown>]> = [
    [
      "ORDER_PENDING notification",
      sendNotification("ORDER_PENDING", {
        shopId: order.shopId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: customer.firstName,
        slot,
      }),
    ],
    [
      "confirmation e-mail",
      sendOrderConfirmationEmail(customer.email, {
        orderId: order.id,
        displayNumber: input.displayNumber,
        customerFirstName: customer.firstName,
        items: order.items,
        totalCents: order.totalCents,
        shopName: shop.name,
        shopAddress: shop.address,
        shopCity: shop.city,
        prepTimeMin: scheduledFor === null ? input.prepMinutes : 0,
      }).then((sent) => {
        if (!sent) throw new Error("sendOrderConfirmationEmail returned false");
      }),
    ],
    [
      "auto-busy check",
      prisma.order
        .count({ where: { shopId: shop.id, status: { in: ["PENDING", "ACCEPTED", "PREPARING"] } } })
        .then((activeOrders) =>
          activeOrders >= shop.autoBusyThreshold && !shop.busyMode
            ? setBusyMode(shop.id, AUTO_BUSY)
            : undefined
        ),
    ],
  ];

  const results = await Promise.allSettled(tasks.map(([, task]) => task));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error(`[orders/create] ${tasks[index][0]} failed`, {
        orderId: order.id,
        err: result.reason,
      });
    }
  });
}
