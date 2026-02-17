// PATCH /api/admin/shops/[shopId]/validate — Approve or reject a shop
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { z } from "zod";

export const dynamic = "force-dynamic";

const validateSchema = z.object({
  approved: z.boolean(),
  plan: z.enum(["STARTER", "PRO", "PREMIUM"]).optional().default("STARTER"),
  trialDays: z.number().int().min(0).max(90).optional().default(14),
  adminNote: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = params;
    const body = await req.json();
    const data = validateSchema.parse(body);

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, visible: true, ownerId: true, referredByShop: true },
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

      // Process referral if applicable
      if (shop.referredByShop) {
        try {
          const referrerShop = await prisma.shop.findUnique({
            where: { shopReferralCode: shop.referredByShop },
            select: { id: true, name: true, ownerId: true },
          });

          if (referrerShop) {
            // Create referral record
            await prisma.referral.create({
              data: {
                referrerShopId: referrerShop.id,
                referredShopId: shopId,
                referrerRewardApplied: true,
                referredRewardApplied: true,
              },
            });

            // +30 days for referrer
            const referrerSub = await prisma.subscription.findUnique({
              where: { shopId: referrerShop.id },
            });
            if (referrerSub) {
              const currentEnd = referrerSub.currentPeriodEnd || referrerSub.trialEndsAt || new Date();
              const newEnd = new Date(currentEnd);
              newEnd.setDate(newEnd.getDate() + 30);

              await prisma.subscription.update({
                where: { shopId: referrerShop.id },
                data: referrerSub.status === "TRIAL"
                  ? { trialEndsAt: newEnd }
                  : { currentPeriodEnd: newEnd },
              });
            }

            // +30 days for referred (on top of trial)
            const newTrialEnd = new Date(trialEndsAt);
            newTrialEnd.setDate(newTrialEnd.getDate() + 30);
            await prisma.subscription.update({
              where: { shopId },
              data: { trialEndsAt: newTrialEnd },
            });

            // Notify both
            const referrerOwner = await prisma.user.findUnique({
              where: { clerkId: referrerShop.ownerId },
              select: { id: true },
            });
            if (referrerOwner) {
              await sendNotification("ACCOUNT_APPROVED", {
                userId: referrerOwner.id,
                shopName: referrerShop.name,
                message: `🎉 Parrainage validé ! Vous bénéficiez d'1 mois gratuit supplémentaire grâce au parrainage de ${shop.name}.`,
              });
            }
          }
        } catch (refErr) {
          console.error("[admin/validate] Referral processing error:", refErr);
        }
      }

      // Notify the approved boucher
      const owner = await prisma.user.findUnique({
        where: { clerkId: shop.ownerId },
        select: { id: true },
      });
      if (owner) {
        await sendNotification("ACCOUNT_APPROVED", {
          userId: owner.id,
          shopName: shop.name,
        });
      }

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
