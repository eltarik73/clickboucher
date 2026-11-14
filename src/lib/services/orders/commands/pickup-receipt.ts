// src/lib/services/orders/commands/pickup-receipt.ts — the receipt e-mailed to the customer once the
// order is collected, whichever way the pickup was confirmed.
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { formatCustomerNumber } from "@/lib/order-number-format";
import { sendOrderReceiptEmail } from "@/lib/emails/order-receipt";

const DEFAULT_VAT_RATE = 5.5;

export async function sendPickupReceipt(orderId: string, pickedUpAt: Date): Promise<void> {
  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { vatRate: true } } } },
        shop: {
          select: {
            name: true,
            address: true,
            city: true,
            siret: true,
            fullAddress: true,
            vatRate: true,
          },
        },
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    const sent = await sendOrderReceiptEmail(order.user.email, {
      orderId: order.id,
      displayNumber: order.displayNumber ?? `#${order.orderNumber}`,
      customerFirstName: order.user.firstName,
      customerLastName: order.user.lastName,
      customerNumber: formatCustomerNumber(order.customerNumber),
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        totalCents: item.totalCents,
        weightGrams: item.weightGrams,
        available: item.available,
        vatRate: item.product.vatRate ?? order.shop.vatRate ?? DEFAULT_VAT_RATE,
      })),
      totalCents: order.totalCents,
      discountCents: order.discountCents,
      serviceFeeCents: order.serviceFeeCents,
      shopName: order.shop.name,
      shopAddress: order.shop.address,
      shopCity: order.shop.city,
      shopSiret: order.shop.siret,
      shopFullAddress: order.shop.fullAddress,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      pickedUpAt,
    });
    if (!sent) logger.warn("[orders/pickup] Receipt e-mail not sent", { orderId });
  } catch (error) {
    // The pickup is committed: a failed receipt is reported, it never undoes the pickup.
    logger.error("[orders/pickup] Receipt e-mail failed", { orderId, error });
  }
}
