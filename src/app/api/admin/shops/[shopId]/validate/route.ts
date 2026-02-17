// PATCH /api/admin/shops/[shopId]/validate — Approve or reject a shop
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

const validateSchema = z.object({
  approved: z.boolean(),
  plan: z.enum(["STARTER", "PRO", "PREMIUM"]).optional().default("STARTER"),
  trialDays: z.number().int().min(0).max(90).optional().default(14),
  adminNote: z.string().max(500).optional(),
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
    const data = validateSchema.parse(body);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, visible: true },
    });
    if (!shop) {
      return apiError("NOT_FOUND", "Boutique introuvable");
    }

    if (data.approved) {
      // Approve: make visible + create/update subscription with trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + data.trialDays);

      await prisma.$transaction([
        prisma.shop.update({
          where: { id: shopId },
          data: { visible: true, onboardingCompleted: true },
        }),
        prisma.subscription.upsert({
          where: { shopId },
          create: {
            shopId,
            plan: data.plan,
            status: "TRIAL",
            trialEndsAt,
            validatedAt: new Date(),
            validatedBy: admin.userId,
            adminNote: data.adminNote,
          },
          update: {
            plan: data.plan,
            status: "TRIAL",
            trialEndsAt,
            validatedAt: new Date(),
            validatedBy: admin.userId,
            adminNote: data.adminNote,
          },
        }),
      ]);

      return apiSuccess({ approved: true, plan: data.plan, trialEndsAt });
    } else {
      // Reject: make invisible
      await prisma.shop.update({
        where: { id: shopId },
        data: { visible: false },
      });

      if (data.adminNote) {
        await prisma.subscription.upsert({
          where: { shopId },
          create: { shopId, plan: "STARTER", status: "CANCELLED", adminNote: data.adminNote },
          update: { status: "CANCELLED", adminNote: data.adminNote },
        });
      }

      return apiSuccess({ approved: false });
    }
  } catch (error) {
    return handleApiError(error, "admin/shops/validate");
  }
}
