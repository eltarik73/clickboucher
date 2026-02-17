// GET /api/admin/shops/[shopId] — Admin shop detail
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const { shopId } = await params;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        subscription: true,
        _count: {
          select: { products: true, orders: true, reviews: true, supportTickets: true },
        },
      },
    });

    if (!shop) {
      return apiSuccess(null);
    }

    // Owner info
    const owner = await prisma.user.findFirst({
      where: { clerkId: shop.ownerId },
      select: { clerkId: true, firstName: true, lastName: true, email: true, phone: true },
    });

    // Revenue + commission
    const revenue = await prisma.order.aggregate({
      where: { shopId, status: { in: ["COMPLETED", "PICKED_UP"] } },
      _sum: { totalCents: true, commissionCents: true },
      _count: true,
    });

    // Recent orders
    const recentOrders = await prisma.order.findMany({
      where: { shopId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return apiSuccess({
      ...shop,
      owner: owner
        ? { name: `${owner.firstName} ${owner.lastName}`, email: owner.email, phone: owner.phone }
        : null,
      stats: {
        totalRevenue: revenue._sum.totalCents || 0,
        totalCommission: revenue._sum.commissionCents || 0,
        completedOrders: revenue._count,
        productCount: shop._count.products,
        orderCount: shop._count.orders,
        reviewCount: shop._count.reviews,
        ticketCount: shop._count.supportTickets,
      },
      recentOrders,
    });
  } catch (error) {
    return handleApiError(error, "admin/shops/[shopId]");
  }
}
