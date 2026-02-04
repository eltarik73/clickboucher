import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { stockActionSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { notificationService } from "@/lib/services";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const data = stockActionSchema.parse(body);

    // 1. Verify order is in STOCK_ISSUE status
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    if (order.status !== "STOCK_ISSUE") {
      return apiError("VALIDATION_ERROR", "La commande n'est pas en rupture de stock");
    }

    // 2. Find the affected item
    const item = order.items.find((i) => i.id === data.orderItemId);
    if (!item) return apiError("NOT_FOUND", "Article introuvable");

    let timelineMessage = "";
    let priceAdjustment = 0;

    switch (data.action) {
      case "REPLACE": {
        // Replace with another product
        if (data.replacementProductId) {
          const replacement = await prisma.product.findUnique({
            where: { id: data.replacementProductId },
          });
          if (!replacement) return apiError("NOT_FOUND", "Produit de remplacement introuvable");

          await prisma.orderItem.update({
            where: { id: item.id },
            data: {
              productId: replacement.id,
              name: replacement.name,
              imageUrl: replacement.imageUrl,
              unitPriceCents: replacement.priceCents,
              totalPriceCents: replacement.priceCents * item.quantity,
              stockAction: "REPLACE",
            },
          });

          priceAdjustment = (replacement.priceCents * item.quantity) - item.totalPriceCents;
          timelineMessage = `"${item.name}" remplacé par "${replacement.name}"`;
        } else {
          timelineMessage = `"${item.name}" remplacé par "${data.replacementName || "produit alternatif"}"`;
          await prisma.orderItem.update({
            where: { id: item.id },
            data: {
              name: data.replacementName || item.name + " (remplacement)",
              stockAction: "REPLACE",
            },
          });
        }
        break;
      }

      case "REMOVE": {
        // Remove item from order
        priceAdjustment = -item.totalPriceCents;
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { stockAction: "REMOVE", totalPriceCents: 0 },
        });
        timelineMessage = `"${item.name}" retiré de la commande`;
        break;
      }

      case "CONTACT": {
        // Contact client for decision
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { stockAction: "CONTACT" },
        });
        timelineMessage = `Boucher contacte le client au sujet de "${item.name}"`;

        await notificationService.sendOrderUpdate(
          order.id,
          "Rupture de stock",
          `"${item.name}" n'est plus disponible. Votre boucher vous contacte pour trouver une solution.`
        );
        break;
      }
    }

    // 3. Update order total + move back to PREPARING
    const newTotal = Math.max(0, order.totalCents + priceAdjustment);
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: "PREPARING",
        totalCents: newTotal,
        timeline: {
          create: {
            status: "PREPARING",
            message: `Rupture résolue : ${timelineMessage}`,
            detail: priceAdjustment !== 0
              ? `Ajustement prix : ${priceAdjustment > 0 ? "+" : ""}${(priceAdjustment / 100).toFixed(2)} €`
              : undefined,
          },
        },
      },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    return apiSuccess(updatedOrder);
  } catch (error) {
    return handleApiError(error);
  }
}
