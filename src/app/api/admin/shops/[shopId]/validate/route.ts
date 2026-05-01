// PATCH /api/admin/shops/[shopId]/validate — Approve or reject a shop
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyIndexNow } from "@/lib/indexnow";
import { z } from "zod";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klikandgo.app";

export const dynamic = "force-dynamic";

const validateSchema = z.object({
  approved: z.boolean(),
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
      const updatedShop = await prisma.shop.update({
        where: { id: shopId },
        data: { visible: true, onboardingCompleted: true },
        select: { slug: true, city: true },
      });

      // Notify Bing/IndexNow that the new shop page + sitemap are indexable
      // (audit GEO 2026 — IndexNow protocol for instant reindexation).
      const indexNowUrls: string[] = [
        `${SITE_URL}/sitemap.xml`,
        `${SITE_URL}/boutique/${updatedShop.slug}`,
        SITE_URL,
      ];
      if (updatedShop.city) {
        const citySlug = updatedShop.city
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        indexNowUrls.push(`${SITE_URL}/boucherie-halal/${citySlug}`);
      }
      notifyIndexNow(indexNowUrls).catch(() => {}); // fire-and-forget

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
    } else {
      await prisma.shop.update({
        where: { id: shopId },
        data: { visible: false },
      });

      await writeAuditLog({
        actorId: admin.userId,
        action: "shop.reject",
        target: "Shop",
        targetId: shopId,
        details: { adminNote: data.adminNote },
      });

      return apiSuccess({ approved: false });
    }
  } catch (error) {
    return handleApiError(error, "admin/shops/validate");
  }
}
