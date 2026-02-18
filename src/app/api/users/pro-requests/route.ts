import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { isAdmin, isBoucher } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ── GET /api/users/pro-requests ──────────────
// Boucher: sees pending pro requests from users who favorited their shop
// Admin: sees all pending pro requests
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string> | undefined)?.role;

    if (!userId) {
      return apiError("UNAUTHORIZED", "Authentification requise");
    }

    if (!isBoucher(role) && !isAdmin(role)) {
      return apiError("FORBIDDEN", "Acces reserve aux bouchers et admins");
    }

    const where: Record<string, unknown> = {
      role: "CLIENT_PRO_PENDING",
    };

    // Boucher: only users who favorited their shop
    if (role === "boucher") {
      const shops = await prisma.shop.findMany({
        where: { ownerId: userId },
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
    });

    return apiSuccess(users);
  } catch (error) {
    return handleApiError(error);
  }
}
