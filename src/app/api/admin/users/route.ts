import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck.error) return adminCheck.error;

    // Optional role filter
    const roleFilter = req.nextUrl.searchParams.get("role");
    const where: Prisma.UserWhereInput = roleFilter ? { role: roleFilter as Prisma.EnumRoleFilter } : {};

    // 1. Fetch users with order count (no order data loaded)
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyName: true,
        siret: true,
        sector: true,
        proStatus: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // 2. Get SUM(totalCents) grouped by userId in one query
    const userIds = users.map((u) => u.id);
    const spentByUser = await prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _sum: { totalCents: true },
    });
    const spentMap = new Map(
      spentByUser.map((row) => [row.userId, row._sum.totalCents || 0])
    );

    const data = users.map((u) => ({
      id: u.id,
      clerkId: u.clerkId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      companyName: u.companyName,
      siret: u.siret,
      sector: u.sector,
      proStatus: u.proStatus,
      phone: u.phone,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
      totalSpent: spentMap.get(u.id) || 0,
    }));

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "admin/users");
  }
}
