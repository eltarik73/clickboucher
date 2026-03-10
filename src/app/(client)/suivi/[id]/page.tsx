export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import SuiviClient from "./SuiviClient";

export default async function SuiviPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  // Auth check — only order owner can view tracking
  const clerkId = await getServerUserId();
  if (!clerkId) {
    redirect(`/sign-in?redirect_url=/suivi/${id}`);
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      dailyNumber: true,
      displayNumber: true,
      status: true,
      totalCents: true,
      customerNote: true,
      boucherNote: true,
      estimatedReady: true,
      actualReady: true,
      pickedUpAt: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          totalCents: true,
          weightGrams: true,
        },
      },
      shop: { select: { id: true, name: true, address: true, city: true, phone: true } },
      userId: true,
      user: { select: { firstName: true, lastName: true, customerNumber: true, clerkId: true } },
      priceAdjustment: {
        select: {
          id: true,
          originalTotal: true,
          newTotal: true,
          reason: true,
          adjustmentType: true,
          status: true,
          tier: true,
          autoApproveAt: true,
          escalateAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) notFound();

  // Verify order belongs to authenticated user
  if (order.user.clerkId !== clerkId && order.userId !== dbUser?.id) {
    notFound();
  }

  return (
    <SuiviClient
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        displayNumber: order.displayNumber || `#${order.orderNumber}`,
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
        shop: order.shop,
        user: {
          firstName: order.user.firstName,
          lastName: order.user.lastName,
          customerNumber: order.user.customerNumber,
        },
        priceAdjustment: order.priceAdjustment
          ? {
              id: order.priceAdjustment.id,
              originalTotal: order.priceAdjustment.originalTotal,
              newTotal: order.priceAdjustment.newTotal,
              reason: order.priceAdjustment.reason,
              adjustmentType: order.priceAdjustment.adjustmentType,
              status: order.priceAdjustment.status,
              tier: order.priceAdjustment.tier,
              autoApproveAt: order.priceAdjustment.autoApproveAt?.toISOString() ?? null,
              escalateAt: order.priceAdjustment.escalateAt?.toISOString() ?? null,
              createdAt: order.priceAdjustment.createdAt.toISOString(),
            }
          : null,
      }}
    />
  );
}
