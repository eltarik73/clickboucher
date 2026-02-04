import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: "asc" } },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            address: true,
            phone: true,
          },
        },
        payment: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            companyName: true,
          },
        },
      },
    });

    if (!order) {
      return apiError("NOT_FOUND", "Commande introuvable");
    }

    return apiSuccess(order);
  } catch (error) {
    return handleApiError(error);
  }
}
