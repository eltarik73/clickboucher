export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authorizeOrderAccess } from "@/lib/auth/order-access";
import { isCredentialShaped, orderAccessPath, orderPagePath } from "@/lib/auth/order-credential";
import { findCustomerOrder } from "@/lib/services/orders/customer-view";
import { formatCustomerNumber } from "@/lib/order-number-format";
import { frozenToleranceOf, isAdjustmentAnswerDue } from "@/lib/pricing/tolerance";
import { settleDueAdjustment } from "@/lib/services/orders/adjustment-answers";
import SuiviClient from "./SuiviClient";

// Tracking page of an order, for its customer: the order's credential cookie or the signed-in owner
// (src/lib/auth/order-access.ts). Anyone else: sign-in without a session, 404 otherwise.
// A price adjustment left unanswered past its window is closed (silence is a refusal) before the
// page is rendered, as GET /api/orders/[id]/status does for the page's polling.
export default async function SuiviPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { guestToken?: string | string[] };
}) {
  const { id } = params;

  // Link of a confirmation sent before C1-INVITES (legacy token in the query string): the token
  // leaves the query string for the access link, which checks it and sets the order's cookie.
  const legacyToken = searchParams.guestToken;
  if (typeof legacyToken === "string" && isCredentialShaped(legacyToken)) {
    redirect(orderAccessPath(id, legacyToken));
  }

  const access = await authorizeOrderAccess(id, cookies());
  if (!access.ok) {
    if (access.status === 401) {
      redirect(`/sign-in?redirect_url=${encodeURIComponent(orderPagePath(id))}`);
    }
    notFound();
  }

  const now = new Date();
  let order = await findCustomerOrder({ id: access.orderId });
  if (order && isAdjustmentAnswerDue(order.priceAdjustment, now)) {
    await settleDueAdjustment(access.orderId, now);
    order = await findCustomerOrder({ id: access.orderId });
  }
  if (!order) notFound();

  return (
    <SuiviClient
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        displayNumber: order.displayNumber || `#${order.orderNumber}`,
        customerNumber: formatCustomerNumber(order.customerNumber),
        status: order.status,
        totalCents: order.totalCents,
        customerNote: order.customerNote,
        boucherNote: order.boucherNote,
        estimatedReady: order.estimatedReady?.toISOString() ?? null,
        actualReady: order.actualReady?.toISOString() ?? null,
        pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          totalCents: i.totalCents,
          weightGrams: i.weightGrams,
        })),
        shop: {
          id: order.shop.id,
          name: order.shop.name,
          address: order.shop.address,
          city: order.shop.city,
          phone: order.shop.phone,
        },
        user: {
          firstName: order.user.firstName,
          lastName: order.user.lastName,
        },
        weighTolerance: frozenToleranceOf(order),
        priceAdjustment: order.priceAdjustment
          ? {
              id: order.priceAdjustment.id,
              originalTotal: order.priceAdjustment.originalTotal,
              newTotal: order.priceAdjustment.newTotal,
              reason: order.priceAdjustment.reason,
              adjustmentType: order.priceAdjustment.adjustmentType,
              status: order.priceAdjustment.status,
              closeReason: order.priceAdjustment.closeReason,
              answerBy: order.priceAdjustment.answerBy?.toISOString() ?? null,
              createdAt: order.priceAdjustment.createdAt.toISOString(),
            }
          : null,
      }}
    />
  );
}
