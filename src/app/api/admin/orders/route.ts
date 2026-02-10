import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string>)?.role;
    if (role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || undefined;
    const shopId = sp.get("shopId") || undefined;
    const from = sp.get("from") || undefined;
    const to = sp.get("to") || undefined;
    const search = sp.get("search") || undefined;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20")));

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (shopId) {
      where.shopId = shopId;
    }

    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.gte = new Date(from);
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
      }
      where.createdAt = createdAt;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          isPro: true,
          createdAt: true,
          updatedAt: true,
          estimatedReady: true,
          actualReady: true,
          pickedUpAt: true,
          customerNote: true,
          boucherNote: true,
          denyReason: true,
          qrCode: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          shop: {
            select: { id: true, name: true, slug: true },
          },
          items: {
            select: {
              id: true,
              name: true,
              quantity: true,
              unit: true,
              priceCents: true,
              totalCents: true,
              available: true,
              replacement: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Aggregate stats for the filtered set
    const agg = await prisma.order.aggregate({
      where: {
        ...where,
        status: status
          ? (status as "COMPLETED" | "PICKED_UP" | "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "DENIED" | "CANCELLED" | "PARTIALLY_DENIED")
          : { in: ["COMPLETED", "PICKED_UP"] as const },
      },
      _sum: { totalCents: true },
    });

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      revenue: agg._sum.totalCents || 0,
    });
  } catch (error) {
    return handleApiError(error, "admin/orders");
  }
}
