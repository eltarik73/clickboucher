// PATCH /api/admin/shops/[shopId]/suspend — Suspend or reactivate a shop
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const suspendSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = await params;
    const body = await req.json();
    const data = suspendSchema.parse(body);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }

    if (data.suspended) {
      // Suspend: hide shop + update subscription
      await prisma.$transaction([
        prisma.shop.update({
          where: { id: shopId },
          data: { visible: false, status: "CLOSED", closedMessage: data.reason || "Boutique suspendue par l'administration" },
        }),
        prisma.subscription.updateMany({
          where: { shopId },
          data: { status: "SUSPENDED", adminNote: data.reason },
        }),
      ]);

      return apiSuccess({ suspended: true });
    } else {
      // Reactivate
      await prisma.$transaction([
        prisma.shop.update({
          where: { id: shopId },
          data: { visible: true, status: "OPEN", closedMessage: null },
        }),
        prisma.subscription.updateMany({
          where: { shopId },
          data: { status: "ACTIVE", adminNote: null },
        }),
      ]);

      return apiSuccess({ suspended: false });
    }
  } catch (error) {
    return handleApiError(error, "admin/shops/suspend");
  }
}
