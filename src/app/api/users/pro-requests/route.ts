import { getServerUserId } from "@/lib/auth/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin, isBoucher } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ── GET /api/users/pro-requests ──────────────
// Boucher: sees pending pro requests from users who favorited their shop
// Admin: sees all pending pro requests
export async function GET() {
  try {
    const userId = await getServerUserId();

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, role: true } });
    if (!isBoucher(dbUser?.role) && !isAdmin(dbUser?.role)) {
      return apiError("FORBIDDEN", "Acces reserve aux bouchers et admins");
    }

    const where: Record<string, unknown> = {
      role: "CLIENT_PRO_PENDING",
    };

    // Boucher: only users who favorited their shop
    if (isBoucher(dbUser?.role)) {
      const shops = await prisma.shop.findMany({
        where: { OR: [{ ownerId: userId }, { ownerId: dbUser?.id }] },
        select: { id: true },
      });
      const shopIds = shops.map((s) => s.id);

      where.favoriteShops = {
        some: { id: { in: shopIds } },
      };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyName: true,
        siret: true,
        sector: true,
        proStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess(users);
  } catch (error) {
    return handleApiError(error);
  }
}
