// GET /api/admin/support/tickets — List support tickets
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["OPEN", "AI_HANDLED", "ESCALATED", "RESOLVED", "CLOSED"]).optional(),
  shopId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const url = new URL(req.url);
    const query = querySchema.parse({
      status: url.searchParams.get("status") || undefined,
      shopId: url.searchParams.get("shopId") || undefined,
      page: url.searchParams.get("page") || 1,
      perPage: url.searchParams.get("perPage") || 20,
    });

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.shopId) where.shopId = query.shopId;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return apiSuccess({
      tickets,
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    });
  } catch (error) {
    return handleApiError(error, "admin/support/tickets");
  }
}
