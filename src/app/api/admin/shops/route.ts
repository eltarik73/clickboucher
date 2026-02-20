import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// Admin-only: all shops with counts + owner info + subscription
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const shops = await prisma.shop.findMany({
      include: {
        subscription: {
          select: { plan: true, status: true, trialEndsAt: true, validatedAt: true },
        },
        _count: { select: { products: true, orders: true, reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Fetch boucher users for owner names
    const ownerIds = [...new Set(shops.map((s) => s.ownerId))];
    const owners = await prisma.user.findMany({
      where: { clerkId: { in: ownerIds } },
      select: { clerkId: true, firstName: true, lastName: true, email: true },
    });
    const ownerMap = new Map(owners.map((o) => [o.clerkId, o]));

    const data = shops.map((s) => {
      const owner = ownerMap.get(s.ownerId);
      return {
        ...s,
        ownerName: owner
          ? `${owner.firstName} ${owner.lastName}`
          : s.ownerId,
        ownerEmail: owner?.email || null,
        productCount: s._count.products,
        orderCount: s._count.orders,
        reviewCount: s._count.reviews,
      };
    });

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "admin/shops");
  }
}

// Admin-only: list boucher users (for owner select)
export async function POST() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const bouchers = await prisma.user.findMany({
      where: { role: "BOUCHER" },
      select: {
        clerkId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { firstName: "asc" },
    });

    return apiSuccess(bouchers);
  } catch (error) {
    return handleApiError(error, "admin/shops/bouchers");
  }
}
