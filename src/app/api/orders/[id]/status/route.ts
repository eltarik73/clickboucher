import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateOrderStatusSchema } from "@/lib/validators";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { notificationService } from "@/lib/services";

// Status transition rules
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["WEIGHING", "READY", "STOCK_ISSUE", "CANCELLED"],
  WEIGHING: ["WEIGHT_REVIEW", "READY"],
  WEIGHT_REVIEW: ["READY", "CANCELLED"],     // after client validates
  STOCK_ISSUE: ["PREPARING", "CANCELLED"],    // after boucher resolves
  READY: ["COLLECTED"],
  COLLECTED: [],
  CANCELLED: [],
};

const STATUS_MESSAGES: Record<string, string> = {
  ACCEPTED: "Commande acceptée par le boucher",
  PREPARING: "Préparation en cours",
  WEIGHING: "Pesée en cours",
  WEIGHT_REVIEW: "Ajustement poids > +10% — Validation client requise",
  STOCK_ISSUE: "Rupture de stock — Action requise",
  READY: "Commande prête ! Présentez-vous au comptoir.",
  COLLECTED: "Commande retirée — Merci !",
  CANCELLED: "Commande annulée",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const data = updateOrderStatusSchema.parse(body);

    // 1. Get current order
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, orderNumber: true, shopId: true, userId: true },
    });
    if (!order) return apiError("NOT_FOUND", "Commande introuvable");

    // 2. Validate transition
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(data.status)) {
      return apiError(
        "VALIDATION_ERROR",
        `Transition ${order.status} → ${data.status} non autorisée. Transitions possibles : ${allowed.join(", ") || "aucune"}`
      );
    }

    // 3. Update order + add timeline event
    const message = data.message || STATUS_MESSAGES[data.status] || data.status;
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: data.status,
        ...(data.status === "COLLECTED" && { collectedAt: new Date() }),
        timeline: {
          create: { status: data.status, message },
        },
      },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });

    // 4. Send notification
    await notificationService.sendOrderUpdate(
      order.id,
      `Commande ${order.orderNumber}`,
      message
    );

    return apiSuccess(updatedOrder);
  } catch (error) {
    return handleApiError(error);
  }
}
