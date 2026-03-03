// GET /api/boucher/opt-ins — List proposals from webmaster
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const optIns = await prisma.butcherOptIn.findMany({
      where: { shopId: auth.shopId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            type: true,
            subject: true,
            imageUrl: true,
            startsAt: true,
            endsAt: true,
            promoCodes: {
              select: {
                id: true,
                code: true,
                discountType: true,
                valueCents: true,
                valuePercent: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(optIns);
  } catch (error) {
    return handleApiError(error, "boucher/opt-ins/GET");
  }
}
