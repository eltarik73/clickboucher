// GET /api/boucher/images/gallery — Boucher gallery (shop-scoped)
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const usage = req.nextUrl.searchParams.get("usage");

    const images = await prisma.generatedImage.findMany({
      where: {
        shopId: auth.shopId,
        ...(usage ? { usage } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess(images);
  } catch (err) {
    return handleApiError(err, "boucher/images/gallery");
  }
}
