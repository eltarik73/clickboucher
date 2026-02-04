import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateWeightSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import {
  checkWeightDeviation,
  determinePostWeighingStatus,
  formatWeightMessage,
  notificationService,
} from "@/lib/services";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const data = updateWeightSchema.parse(body);

    // 1. Verify order exists and is in WEIGHING status
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    });
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");
    if (order.status !== "WEIGHING") {
      return apiError("VALIDATION_ERROR", `La commande doit être en statut WEIGHING (actuellement: ${order.status})`);
    }

    // 2. Process each weight update
    const checks = [];
    let totalAdjustment = 0;

    for (const weightUpdate of data.items) {
      const item = order.items.find((i) => i.id === weightUpdate.orderItemId);
      if (!item) {
        return apiError("NOT_FOUND", `Article ${weightUpdate.orderItemId} introuvable`);
      }
      if (item.unit !== "KG" || !item.requestedWeight) {
        return apiError("VALIDATION_ERROR", `L'article "${item.name}" n'est pas au poids`);
      }

      // Calculate deviation
      const check = checkWeightDeviation(
        item.requestedWeight,
        weightUpdate.actualWeightGrams,
        item.unitPriceCents,
        item.id
      );
      checks.push(check);

      // Block if underweight beyond tolerance (boucher must complete)
      if (check.underweight) {
        return apiError(
          "WEIGHT_EXCEEDS_TOLERANCE",
          `${item.name} : poids insuffisant (${formatWeightMessage(check)}). Complétez ou demandez l'accord du client.`
        );
      }

      // Update the order item
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          actualWeight: weightUpdate.actualWeightGrams,
          weightDeviation: check.deviationPercent,
          adjustedPriceCents: check.adjustedPriceCents,
          needsValidation: check.exceeds, // > +10%
        },
      });

      totalAdjustment += check.adjustedPriceCents - item.totalPriceCents;
    }

    // 3. Determine next status
    const nextStatus = determinePostWeighingStatus(checks);

    // 4. Calculate new total
    const newTotal = order.totalCents + totalAdjustment;

    // 5. Build timeline detail
    const detailLines = checks
      .map((c) => `${formatWeightMessage(c)}${c.exceeds ? " ⚠️ Validation requise" : " ✅"}`)
      .join("\n");

    // 6. Update order
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: nextStatus,
        totalCents: newTotal,
        weightAdjCents: totalAdjustment,
        timeline: {
          create: {
            status: nextStatus,
            message:
              nextStatus === "WEIGHT_REVIEW"
                ? "Ajustement poids > +10% — Validation client requise"
                : "Pesée terminée — Commande prête",
            detail: detailLines,
          },
        },
      },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    // 7. Notify client if validation needed
    if (nextStatus === "WEIGHT_REVIEW") {
      await notificationService.sendOrderUpdate(
        order.id,
        "Validation requise",
        `Le poids de votre commande ${order.orderNumber} dépasse +10%. Merci de valider le nouveau prix.`
      );
    }

    return apiSuccess({
      order: updatedOrder,
      weightChecks: checks,
      adjustment: totalAdjustment,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
