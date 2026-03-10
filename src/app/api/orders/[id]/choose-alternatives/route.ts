import { NextRequest } from "next/server";
import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const choiceSchema = z.object({
  decisions: z.array(
    z.object({
      orderItemId: z.string().min(1),
      action: z.enum(["replace", "remove"]),
      replacementProductId: z.string().optional(),
    })
  ).min(1, "Au moins une decision requise"),
});

// ── POST /api/orders/[id]/choose-alternatives ──
// Client — choose replacements or remove unavailable items, then re-confirm order
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        user: { select: { clerkId: true } },
        shop: { select: { id: true, name: true } },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }
    if (order.user.clerkId !== userId) {
      return apiError("FORBIDDEN", "Cette commande ne vous appartient pas");
    }
    if (order.status !== "PARTIALLY_DENIED") {
      return apiError(
        "VALIDATION_ERROR",
        "Cette commande n'est pas en attente de choix d'alternatives"
      );
    }

    const body = await req.json();
    const { decisions } = choiceSchema.parse(body);

    // Batch fetch all replacement products at once (instead of N findFirst)
    const replacementIds = decisions
      .filter(d => d.action === "replace" && d.replacementProductId)
      .map(d => d.replacementProductId!);
    const replacementProducts = replacementIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: replacementIds }, shopId: order.shop.id },
          select: { id: true, name: true, priceCents: true, unit: true },
        })
      : [];
    const productMap = new Map(replacementProducts.map(p => [p.id, p]));

    // Build all updates, then execute via $transaction
    const itemUpdates = [];
    for (const decision of decisions) {
      const orderItem = order.items.find((i) => i.id === decision.orderItemId);
      if (!orderItem || orderItem.available) continue;

      if (decision.action === "remove") {
        itemUpdates.push(prisma.orderItem.update({
          where: { id: decision.orderItemId },
          data: { replacement: "removed" },
        }));
      } else if (decision.action === "replace" && decision.replacementProductId) {
        const newProduct = productMap.get(decision.replacementProductId);
        if (!newProduct) continue;

        const newTotalCents = newProduct.priceCents * orderItem.quantity;
        itemUpdates.push(prisma.orderItem.update({
          where: { id: decision.orderItemId },
          data: {
            productId: newProduct.id,
            name: newProduct.name,
            priceCents: newProduct.priceCents,
            totalCents: newTotalCents,
            available: true,
            replacement: `Remplace: ${orderItem.name}`,
          },
        }));
      }
    }
    if (itemUpdates.length > 0) await prisma.$transaction(itemUpdates);

    // Recalculate total (only available items)
    const updatedItems = await prisma.orderItem.findMany({
      where: { orderId: id },
    });

    const newTotal = updatedItems
      .filter((i) => i.available)
      .reduce((sum, i) => sum + i.totalCents, 0);

    const allRemoved = updatedItems.every((i) => !i.available);

    // Update order — back to PENDING so boucher can accept
    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: allRemoved ? "DENIED" : "PENDING",
        totalCents: allRemoved ? 0 : newTotal,
        denyReason: allRemoved
          ? "Le client a retire tous les articles"
          : null,
      },
      include: {
        items: { include: { product: true } },
        shop: { select: { id: true, name: true, slug: true } },
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
