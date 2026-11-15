// PATCH /api/admin/shops/[shopId]/validate — Approve or reject a shop (admin only).
// Approving lists the shop and dates the act; a suspended shop must be reactivated first (409).
// Rejecting unlists it and cancels its vacation, whose end would list it again.
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request-body";
import { sendNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyIndexNow } from "@/lib/indexnow";
import { validationIndexNowUrls } from "@/lib/seo/indexnow-urls";
import { approveShop, setShopPublished } from "@/lib/services/shops/moderation";
import { FIELD_NOT_EDITABLE_HERE } from "@/lib/validators";
import { z } from "zod";

export const dynamic = "force-dynamic";

const validateSchema = z
  .object({
    approved: z.boolean(),
    adminNote: z.string().trim().max(500).optional(),
  })
  .strict(FIELD_NOT_EDITABLE_HERE);

export async function PATCH(req: NextRequest, { params }: { params: { shopId: string } }) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = params;
    const data = validateSchema.parse(await readJsonBody(req));

    if (data.approved) {
      const approval = await approveShop(shopId);
      if (!approval.ok) return apiError(approval.code, approval.message);

      const shop = await prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { name: true, ownerId: true, referredByShop: true, city: true },
      });

      // The listing changes the home page and the shop's city pages; the shop page itself is
      // never submitted (src/lib/seo/indexnow-urls.ts). Awaited: a serverless function may be
      // frozen once it has answered. notifyIndexNow never throws: it logs its own failures.
      await notifyIndexNow(validationIndexNowUrls(shop.city));

      if (shop.referredByShop) {
        try {
          const referrerShop = await prisma.shop.findUnique({
            where: { shopReferralCode: shop.referredByShop },
            select: { id: true, name: true, ownerId: true },
          });

          if (referrerShop) {
            await prisma.referral.create({
              data: {
                referrerShopId: referrerShop.id,
                referredShopId: shopId,
                referrerRewardApplied: true,
                referredRewardApplied: true,
              },
            });

            const referrerOwner = await prisma.user.findUnique({
              where: { clerkId: referrerShop.ownerId },
              select: { id: true },
            });
            if (referrerOwner) {
              await sendNotification("ACCOUNT_APPROVED", {
                userId: referrerOwner.id,
                shopName: referrerShop.name,
                message: `🎉 Parrainage validé ! ${shop.name} a rejoint Klik&Go grâce à votre parrainage.`,
              });
            }
          }
        } catch {
          // Referral processing failed — non-critical, shop is still validated
        }
      }

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

      await writeAuditLog({
        actorId: admin.userId,
        action: "shop.validate",
        target: "Shop",
        targetId: shopId,
        details: { adminNote: data.adminNote },
      });

      return apiSuccess({ approved: true });
    }

    const rejection = await setShopPublished(shopId, false);
    if (!rejection.ok) return apiError(rejection.code, rejection.message);

    await writeAuditLog({
      actorId: admin.userId,
      action: "shop.reject",
      target: "Shop",
      targetId: shopId,
      details: { adminNote: data.adminNote },
    });

    return apiSuccess({ approved: false });
  } catch (error) {
    return handleApiError(error, "admin/shops/validate");
  }
}
