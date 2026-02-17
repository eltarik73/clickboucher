// src/app/api/boucher/products/[id]/snooze/route.ts — Deliveroo-style snooze
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { snoozeProduct } from "@/lib/product-snooze";
import { z } from "zod";

export const dynamic = "force-dynamic";

const snoozeSchema = z.object({
  type: z.enum(["NONE", "ONE_HOUR", "TWO_HOURS", "END_OF_DAY", "INDEFINITE", "CUSTOM"]),
  reason: z.string().max(200).optional(),
  customEnd: z.string().datetime().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params;
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", "Authentification requise");

    // Verify ownership
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, shop: { select: { ownerId: true } } },
    });
    if (!product) return apiError("NOT_FOUND", "Produit introuvable");
    if (product.shop.ownerId !== userId) {
      return apiError("FORBIDDEN", "Ce produit ne vous appartient pas");
    }

    const body = await req.json();
    const data = snoozeSchema.parse(body);

    // Handle CUSTOM type with specific end date
    if (data.type === "CUSTOM" && data.customEnd) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          snoozeType: "CUSTOM",
          snoozedAt: new Date(),
          snoozeEndsAt: new Date(data.customEnd),
          snoozeReason: data.reason || null,
          inStock: false,
        },
      });
    } else {
      await snoozeProduct(productId, data.type, data.reason);
    }

    const updated = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        snoozeType: true,
        snoozedAt: true,
        snoozeEndsAt: true,
        snoozeReason: true,
        inStock: true,
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "boucher/products/snooze");
  }
}
