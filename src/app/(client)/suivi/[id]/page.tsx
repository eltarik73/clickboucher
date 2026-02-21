export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import prisma from "@/lib/prisma";
import SuiviClient from "./SuiviClient";

export default async function SuiviPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

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
      user: { select: { firstName: true, lastName: true, customerNumber: true } },
    },
  });

  if (!order) notFound();

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
      }}
    />
  );
}
